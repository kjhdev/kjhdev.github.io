/**
 * 목록 썸네일에는 본문에 실제로 렌더링되는 첫 이미지 주소만 사용한다.
 * Markdown 코드블록과 인라인 코드의 <img> 예시는 이미지가 아니다.
 */
export function extractFirstPostImage(body?: string): string | null {
  if (!body) return null;

  let fence: { marker: string; length: number } | null = null;
  const visibleLines: string[] = [];

  for (const line of body.split(/\r?\n/)) {
    const delimiter = line.match(/^[ \t]*(`{3,}|~{3,})([^\r\n]*)$/);

    if (fence) {
      if (
        delimiter &&
        delimiter[1][0] === fence.marker &&
        delimiter[1].length >= fence.length &&
        delimiter[2].trim() === ''
      ) {
        fence = null;
      }
      visibleLines.push('');
      continue;
    }

    if (delimiter && (delimiter[1][0] === '~' || !delimiter[2].includes('`'))) {
      fence = { marker: delimiter[1][0], length: delimiter[1].length };
      visibleLines.push('');
      continue;
    }

    // Markdown에서 네 칸 이상 들여쓴 줄은 코드블록이다.
    visibleLines.push(/^(?: {4,}|\t)/.test(line) ? '' : line);
  }

  const content = visibleLines
    .join('\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<pre\b[^>]*>[\s\S]*?<\/pre\s*>/gi, '')
    .replace(/<code\b[^>]*>[\s\S]*?<\/code\s*>/gi, '')
    .replace(/(`+)([^\n]*?)\1/g, '');

  const markdownImage = content.match(
    /!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\s*\)/
  );
  const htmlImage = content.match(
    /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i
  );

  // Markdown 이미지와 HTML 이미지 중 본문에서 먼저 나오는 것만 사용한다.
  if (markdownImage && (!htmlImage || (markdownImage.index ?? 0) < (htmlImage.index ?? 0))) {
    return markdownImage[1] ?? markdownImage[2] ?? null;
  }

  return htmlImage?.[1] ?? null;
}
