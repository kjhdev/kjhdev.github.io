// 정적 빌드 산출물에 있는 SEO 메타·내부 링크·로컬 이미지를 확인한다.
// GSC의 실제 색인 상태를 조회하는 도구가 아닌 배포 전 품질 검사이다.
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const origin = 'https://kjhdev.github.io';
const errors = [];
const warn = [];
let checkedLinks = 0;
let checkedImages = 0;
if (!fs.existsSync(dist)) {
  console.error('dist/ 디렉터리가 없습니다. Astro 빌드 후 실행하세요.');
  process.exit(1);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const full = path.join(dir, item.name);
    return item.isDirectory() ? walk(full) : [full];
  });
}
function read(file) {
  return fs.readFileSync(file, 'utf8');
}
function attr(tag, name) {
  const double = tag.match(new RegExp('\\b' + name + '\\s*=\\s*"([^"]*)"', 'i'));
  if (double) return double[1];
  const single = tag.match(new RegExp("\\b" + name + "\\s*=\\s*'([^']*)'", 'i'));
  return single?.[1] ?? null;
}
function tags(html, name) {
  return [...html.matchAll(new RegExp('<' + name + '\\b[^>]*>', 'gi'))].map((m) => m[0]);
}
function urlToFile(link, sourceUrl) {
  let url;
  try { url = new URL(link, sourceUrl); } catch { return null; }
  if (url.origin !== origin) return null;
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return null; }
  // URL에서 상위 디렉터리로 벗어나는 경로는 허용하지 않는다.
  const relative = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  const target = path.resolve(dist, relative);
  if (!(target === dist || target.startsWith(dist + path.sep))) return null;
  if (pathname.endsWith('/')) return path.join(target, 'index.html');
  if (path.extname(pathname)) return target;
  return path.join(target, 'index.html');
}
function normalizedUrl(value) {
  try {
    const u = new URL(value, origin);
    return u.origin + (u.pathname === '/' ? '/' : u.pathname.replace(/\/$/, ''));
  } catch { return value; }
}
function pageUrl(file) {
  const relative = path.relative(dist, file).split(path.sep).join('/');
  const pathname = relative === 'index.html'
    ? '/' : '/' + relative.replace(/\/index\.html$/, '/');
  return origin + pathname;
}

const htmlFiles = walk(dist).filter((f) => f.endsWith('.html'));
const pages = new Map();
for (const file of htmlFiles) {
  const html = read(file);
  const currentUrl = pageUrl(file);
  const links = tags(html, 'link');
  const meta = tags(html, 'meta');
  const canonicalTags = links.filter((tag) => attr(tag, 'rel')?.toLowerCase() === 'canonical');
  const canonical = canonicalTags.length === 1 ? attr(canonicalTags[0], 'href') : null;
  const robots = meta.find((tag) => attr(tag, 'name')?.toLowerCase() === 'robots');
  const noindex = (attr(robots ?? '', 'content') ?? '').toLowerCase().includes('noindex');
  const alternates = links
    .filter((tag) => ['ko', 'en'].includes(attr(tag, 'hreflang') ?? ''))
    .map((tag) => ({ lang: attr(tag, 'hreflang'), href: attr(tag, 'href') }));
  const isAlias = new URL(currentUrl).pathname === '/ko/';

  if (!canonical) errors.push(currentUrl + ': canonical이 정확히 1개가 아닙니다.');
  if (canonical && !isAlias && normalizedUrl(canonical) !== normalizedUrl(currentUrl)) {
    errors.push(currentUrl + ': canonical이 자기 페이지를 가리키지 않습니다: ' + canonical);
  }
  if (isAlias && normalizedUrl(canonical) !== origin + '/') {
    errors.push(currentUrl + ': 이전 홈의 canonical이 /가 아닙니다.');
  }

  for (const tag of tags(html, 'a')) {
    const href = attr(tag, 'href');
    if (!href || href.startsWith('#')) continue;
    const local = urlToFile(href, currentUrl);
    if (!local) continue;
    checkedLinks++;
    if (!fs.existsSync(local)) errors.push(currentUrl + ': 내부 링크 대상 없음: ' + href);
  }
  for (const tag of tags(html, 'img')) {
    const src = attr(tag, 'src');
    if (!src) continue;
    const local = urlToFile(src, currentUrl);
    if (!local) continue;
    checkedImages++;
    if (!fs.existsSync(local)) errors.push(currentUrl + ': 로컬 이미지 없음: ' + src);
  }

  pages.set(normalizedUrl(currentUrl), { noindex, alternates, canonical, url: currentUrl });
}

for (const item of pages.values()) {
  if (item.noindex) continue;
  for (const alt of item.alternates) {
    const counterpart = pages.get(normalizedUrl(alt.href));
    if (!counterpart) {
      errors.push(item.url + ': hreflang 대상 파일 없음: ' + alt.href);
      continue;
    }
    if (counterpart.noindex) errors.push(item.url + ': hreflang 대상이 noindex: ' + alt.href);
    const selfLink = counterpart.alternates.some((other) =>
      normalizedUrl(other.href) === normalizedUrl(item.url)
    );
    if (!selfLink) errors.push(item.url + ': hreflang 상호 연결 없음: ' + alt.href);
  }
}

const sitemapIndex = path.join(dist, 'sitemap-index.xml');
if (!fs.existsSync(sitemapIndex)) {
  errors.push('sitemap-index.xml 파일이 없습니다.');
} else {
  const submaps = [...read(sitemapIndex).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const urls = new Set();
  for (const url of submaps) {
    const file = urlToFile(url, origin + '/');
    if (!file || !fs.existsSync(file)) {
      errors.push('Sitemap 하위 파일 없음: ' + url);
      continue;
    }
    for (const match of read(file).matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const entry = normalizedUrl(match[1]);
      if (urls.has(entry)) errors.push('Sitemap URL 중복: ' + match[1]);
      urls.add(entry);
      if (!pages.has(entry)) errors.push('Sitemap URL에 HTML 페이지 없음: ' + match[1]);
      else if (pages.get(entry).noindex) errors.push('Sitemap에 noindex URL 포함: ' + match[1]);
    }
  }
  if (urls.has(origin + '/ko')) errors.push('이전 대표 주소 /ko/가 Sitemap에 포함됨');
  for (const page of pages.values()) {
    if (page.noindex || normalizedUrl(page.url) === origin + '/ko') continue;
    if (!urls.has(normalizedUrl(page.url))) errors.push('Sitemap에서 색인 대상 URL 누락: ' + page.url);
  }
  console.log('Sitemap 포함 URL:', urls.size);
}

const roots = [origin + '/', origin + '/en'];
for (const root of roots) {
  if (!pages.has(normalizedUrl(root))) errors.push('대표 홈 누락: ' + root);
}
for (const w of warn) console.warn('주의:', w);
console.log('HTML:', htmlFiles.length, '내부 링크:', checkedLinks, '로컬 이미지:', checkedImages);
if (errors.length) {
  for (const error of errors.slice(0, 60)) console.error('오류:', error);
  console.error('총', errors.length, '개 오류 발견');
  process.exit(1);
}
console.log('정적 사이트 SEO·링크 검증 통과');
