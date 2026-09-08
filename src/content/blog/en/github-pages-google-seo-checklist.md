---
title: "Google SEO Checklist for a GitHub Pages Blog"
pubDate: 2026-09-08T14:24:04+09:00
description: "A practical Google SEO checklist for an Astro and GitHub Pages blog, covering titles, meta descriptions, canonical URLs, sitemaps, robots.txt, hreflang, internal links, and Google Search Console."
category: SEO
tags:
  - GitHub Pages
  - Astro
  - Google SEO
  - Search Console
  - Sitemap
  - robots.txt
lang: en
---

Deploying a blog to GitHub Pages does not automatically mean that every page will be discovered, indexed, and shown prominently in Google Search.

A basic technical SEO setup helps search engines **discover your pages, understand their content, and identify the correct URL to index**.

This guide uses an **Astro + GitHub Pages** development blog as the example and walks through the main Google SEO checks that are worth completing first.

> SEO is not a single meta tag. Your site must be crawlable, each page needs clear metadata, duplicate URLs should be handled consistently, and multilingual pages need a clear relationship.

---

## 1. Quick checklist

Start with these items.

| Item | Priority | What to check |
|---|---|---|
| HTTPS | Required | Every public page loads correctly over HTTPS |
| Unique page title | Required | Every post has a descriptive, unique title |
| Meta description | Recommended | Each page has a useful summary |
| Canonical URL | Important | Each page points to the correct representative URL |
| robots.txt | Important | Googlebot is not accidentally blocked |
| Sitemap | Important | Search engines can discover the important URLs |
| Search Console | Important | Ownership, indexing, and crawl issues can be monitored |
| Internal links | Important | Posts are linked from other pages |
| hreflang | Multilingual sites | Korean and English versions are connected correctly |
| Mobile usability | Important | Pages work well on mobile devices |

---

# 2. Configure Astro's `site` value correctly

Astro uses the `site` setting as the base for features such as sitemap generation and absolute URLs.

Example `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://username.github.io',

  integrations: [
    sitemap(),
  ],
});
```

A GitHub Pages user site normally uses a URL such as:

```text
https://username.github.io
```

If you use a custom domain, configure the actual production domain instead:

```text
https://www.example.com
```

An incorrect `site` value can produce incorrect sitemap or canonical URLs, so it is one of the first settings to verify.

---

# 3. Use a unique `<title>` for every post

The page title is one of the most visible pieces of information in search results.

Avoid using the same title for every page:

```html
<title>My Dev Blog</title>
```

A post page should use the actual post title:

```astro
<title>{title}</title>
```

Example:

```html
<title>Managing Multiple Java Versions on macOS with SDKMAN</title>
```

The title should clearly describe the page.

Avoid keyword stuffing such as:

```text
Java Java Install Java Version Java SDKMAN Java Development
```

Think of the title as a useful description for a reader, not a container for repeated search keywords.

---

# 4. Add a page-specific meta description

A convenient pattern is to keep a `description` field in each Markdown file and render it in the shared layout.

Markdown:

```yaml
---
title: "Managing Multiple Java Versions on macOS with SDKMAN"
description: "Configure SDKMAN and VS Code so each Java project automatically uses the correct JDK."
---
```

Astro layout:

```astro
<meta name="description" content={description} />
```

Google may use this text as a search-result snippet, but it can also select text from the page when that better matches the user's query.

A good description should:

- summarize the real content of the page,
- be unique for the page,
- avoid keyword lists,
- avoid misleading clickbait.

---

# 5. Add a canonical URL

The same content can sometimes be accessible through multiple URLs.

A canonical link helps indicate which URL you prefer as the representative version:

```html
<link
  rel="canonical"
  href="https://username.github.io/en/posts/sdkman-java/"
/>
```

In Astro:

```astro
---
const site = Astro.site ?? new URL('https://username.github.io');
const canonicalURL = new URL(Astro.url.pathname, site);
---

<link rel="canonical" href={canonicalURL} />
```

Google treats canonical information as a signal rather than an absolute command.

Keep the following URLs consistent:

```text
canonical URL
sitemap URL
internal links
actual production URL
```

Avoid sending mixed signals by linking to different variants of the same page.

---

# 6. Generate a sitemap

As the number of posts grows, a sitemap gives search crawlers a clear list of important URLs.

Install Astro's sitemap integration:

```bash
npm install @astrojs/sitemap
```

Configure it:

```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://username.github.io',
  integrations: [sitemap()],
});
```

After the build, a sitemap index is commonly available at:

```text
https://username.github.io/sitemap-index.xml
```

Open the URL directly in a browser and verify that the XML is accessible.

### URLs that may not belong in a sitemap

Depending on the project, you may exclude:

- empty pages,
- test pages,
- `noindex` pages,
- search-result pages,
- duplicate URLs.

The goal is to provide the representative URLs you actually want indexed.

---

# 7. Check `robots.txt`

In an Astro GitHub Pages project, you can put `robots.txt` in the `public` directory.

A simple blog configuration can start with:

```text
User-agent: *
Allow: /

Sitemap: https://username.github.io/sitemap-index.xml
```

After deployment, verify:

```text
https://username.github.io/robots.txt
```

Be especially careful not to leave this in production:

```text
User-agent: *
Disallow: /
```

That blocks crawling across the site.

Also remember that `robots.txt` is not an access-control mechanism. Do not use it to protect private information. Sensitive content should never be published to a public GitHub Pages path in the first place.

---

# 8. Add the site to Google Search Console

Once the technical setup is in place, add the site to Google Search Console.

Search Console helps you:

- verify whether Google discovered a page,
- check indexing status,
- submit a sitemap,
- inspect individual URLs,
- monitor search impressions and clicks,
- diagnose crawling or indexing problems.

Submit the sitemap generated by your actual build.

For example:

```text
sitemap-index.xml
```

or another sitemap path produced by your configuration.

---

# 9. Inspect newly published URLs

Publishing a post does not mean it will immediately appear in Google Search.

Use **URL Inspection** in Search Console for a specific page:

```text
https://username.github.io/en/posts/github-pages-seo/
```

Useful checks include:

```text
Is the URL known to Google?
Can it be crawled?
What canonical did the site declare?
What canonical did Google select?
```

You can request indexing when appropriate, but an indexing request does not guarantee immediate appearance in search results.

---

# 10. Use `hreflang` for Korean and English versions

If the blog provides both Korean and English versions of the same post, connect them with language annotations.

Example:

```html
<link
  rel="alternate"
  hreflang="ko"
  href="https://username.github.io/ko/posts/sdkman-java/"
/>

<link
  rel="alternate"
  hreflang="en"
  href="https://username.github.io/en/posts/sdkman-java/"
/>
```

In Astro, render the annotations only when the translated pages actually exist:

```astro
{koUrl && (
  <link
    rel="alternate"
    hreflang="ko"
    href={new URL(koUrl, site)}
  />
)}

{enUrl && (
  <link
    rel="alternate"
    hreflang="en"
    href={new URL(enUrl, site)}
  />
)}
```

Do not generate a language alternate URL for a page that does not exist.

---

# 11. Configure Open Graph separately

Open Graph primarily controls how links look when shared through social platforms and messaging apps.

Example:

```html
<meta property="og:title" content="Page title" />
<meta property="og:description" content="Page description" />
<meta property="og:type" content="article" />
<meta property="og:url" content="https://username.github.io/en/posts/example/" />
<meta property="og:image" content="https://username.github.io/images/og-default.png" />
```

Do not treat Open Graph as a direct Google ranking switch.

It is still useful because a correctly rendered shared link can improve how readers discover and understand your content outside search results.

For images, an absolute public URL is usually safer than a path that cannot be resolved outside the page context.

---

# 12. Build useful internal links

Search crawlers discover pages through links as well as sitemaps.

Avoid creating posts that are technically published but not linked from anywhere else.

A useful blog structure might look like:

```text
Home
 ├── Recent posts
 ├── Categories
 │    └── Java
 │         └── SDKMAN article
 └── Related article links
```

At minimum, a post should normally be reachable from:

- the home or post list,
- category pages,
- previous/next navigation,
- related posts,
- contextual links from other articles.

---

# 13. Use meaningful image `alt` text

When an article includes screenshots or diagrams, do not put all important information only inside the image.

Example:

```html
<img
  src="/images/sdkman-vscode-settings.png"
  alt="VS Code Java runtime configuration for a Java 17 project"
/>
```

The alt text should explain what the image represents.

Do not repeat keywords just for SEO.

---

# 14. Minimum Astro + GitHub Pages setup

A practical baseline looks like this.

`astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://username.github.io',
  integrations: [sitemap()],
});
```

`public/robots.txt`:

```text
User-agent: *
Allow: /

Sitemap: https://username.github.io/sitemap-index.xml
```

Shared layout:

```astro
<title>{title}</title>
<meta name="description" content={description} />

<link rel="canonical" href={canonicalURL} />

<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:url" content={canonicalURL} />
```

Markdown:

```yaml
---
title: "Post title"
description: "A concise summary of the post"
category: Java
tags:
  - Java
  - macOS
lang: en
---
```

---

# 15. Verify the deployed output

Do not stop after checking the source code.

Verify the actual production URLs:

```text
https://username.github.io/robots.txt
https://username.github.io/sitemap-index.xml
```

Then inspect the HTML output of a post.

Look for:

```html
<title>...</title>
<meta name="description" ...>
<link rel="canonical" ...>
<meta property="og:title" ...>
<meta property="og:description" ...>
```

If the markup exists only in your source but is missing from the built page, search engines cannot use it.

---

# 16. Final checklist

```text
[ ] Site works over HTTPS
[ ] Every post has a unique title
[ ] Every post has a useful description
[ ] Canonical points to the representative URL
[ ] robots.txt does not block the site
[ ] sitemap-index.xml is accessible
[ ] Important posts are included in the sitemap
[ ] Site is added to Google Search Console
[ ] Sitemap is submitted
[ ] Important post URLs are inspected
[ ] Korean and English pages use hreflang
[ ] Posts have internal links
[ ] Images use meaningful alt text
[ ] Pages work correctly on mobile
```

---

# Conclusion

Technical SEO for GitHub Pages is not fundamentally different from SEO on a traditional hosted site.

The main goal is to make three things clear:

```text
Which pages exist?
↓
What is each page about?
↓
Which URL is the representative version?
```

With Astro, most of this can be centralized through `@astrojs/sitemap`, a shared layout, and Markdown frontmatter.

A good long-term setup is one where adding a new post only requires a strong title and description, while the shared layout automatically handles canonical URLs, Open Graph metadata, and other common SEO markup.

---

## References

- Google Search Central - Canonicalization  
  https://developers.google.com/search/docs/crawling-indexing/canonicalization
- Google Crawling Infrastructure - robots.txt  
  https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec
- Google Search Central  
  https://developers.google.com/search/
- Google Search Console  
  https://search.google.com/search-console/
- Astro Sitemap Integration  
  https://docs.astro.build/en/guides/integrations-guide/sitemap/
