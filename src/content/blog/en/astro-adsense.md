---
title: "Add Google AdSense to Astro GitHub Pages"
pubDate: "2026-09-21T08:09:44+09:00"
description: "Learn how to add Google AdSense to an Astro GitHub Pages blog, publish ads.txt at the site root, and verify the deployed HTML and crawler access."
category: "Blog"
tags: ["Astro", "GitHub Pages", "AdSense", "ads.txt", "SEO"]
lang: "en"
---

# Add Google AdSense to Astro GitHub Pages

Connecting Google AdSense to an Astro site hosted on GitHub Pages mainly requires two pieces.

The first is the AdSense script in the page `<head>`. The second is an `ads.txt` file that is reachable from the site root.

This guide shows where to place both files and how to verify the deployed result.

## Add the AdSense script to the shared layout

If multiple Astro pages share the same `<head>`, you do not need to repeat the AdSense script on every page.

A shared layout is usually the easiest place to manage it.

Assume the project looks like this:

```text
src/
├── layouts/
│   └── BaseLayout.astro
└── pages/
```

Add the code supplied by AdSense inside the `<head>` of `BaseLayout.astro`.

```html
<head>
    <script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-0000000000000000"
        crossorigin="anonymous">
    </script>
</head>
```

Replace `ca-pub-0000000000000000` with your own AdSense publisher value.

There is no need to expose a real publisher ID in tutorials or public examples.

## Check how Astro handles external scripts

Astro can process normal `<script>` elements during the build.

The Astro documentation explains that `is:inline` can be used when an external script should be emitted into the final HTML without Astro processing it.

```html
<script
    is:inline
    async
    src="https://example.com/external.js">
</script>
```

A `<script>` element with attributes other than `src` can also fall into Astro's unprocessed-script behavior.

The important step is not just choosing syntax. Inspect the generated HTML and confirm that the AdSense script appears in the form you expect.

## Check the root page separately

A multilingual blog may use a shared layout for `/ko/` and `/en/` while `/` uses a separate `index.astro` file.

For example:

```text
src/pages/index.astro
src/layouts/BaseLayout.astro
```

If the root page does not use `BaseLayout.astro`, adding AdSense only to the shared layout will not add it to `/`.

Check the actual structure:

```text
/      → which layout does it use?
/ko/   → does it use BaseLayout?
/en/   → does it use BaseLayout?
```

When AdSense should be available site-wide, verify every page type rather than assuming one shared layout covers the entire site.

## Put ads.txt in the public directory

Files inside Astro's `public/` directory are copied to the build output as static assets.

Create:

```text
public/ads.txt
```

A basic Google AdSense entry has this format:

```text
google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0
```

Replace `pub-0000000000000000` with your publisher ID.

After deployment, the file should be reachable from the root URL:

```text
https://username.github.io/ads.txt
```

If the site uses a custom domain, it should also be available from that domain root:

```text
https://example.com/ads.txt
```

Google's AdSense documentation instructs publishers to upload `ads.txt` to the site's root directory.

## Build before deploying to GitHub Pages

Run the production build after making the changes.

```bash
npm run build
```

If the Astro project defines additional validation commands, run those as well.

Confirm that the generated output contains `ads.txt`.

```text
dist/
├── ads.txt
├── index.html
└── ...
```

You can also check whether the generated pages contain the AdSense script.

```bash
grep -R "adsbygoogle.js" dist
```

## Verify the deployed site

After GitHub Pages finishes deploying, open the `ads.txt` URL directly.

```text
https://example.com/ads.txt
```

Its contents should appear as plain text.

Google recommends confirming that the file is reachable from the root domain, returns HTTP 200, and is not blocked by `robots.txt`.

Next, inspect the page source and search for `adsbygoogle.js`.

```text
view-source:https://example.com/
```

For a multilingual site, check `/`, `/ko/`, and `/en/` separately.

## When AdSense still says ads.txt is missing

AdSense may continue to show a missing status for a while even after the file is available in a browser.

Google notes that changes can take time to be reflected, and sites with fewer ad requests may take longer to be reviewed.

Check these items first:

```text
ads.txt is reachable from the site root
HTTP status is 200
publisher ID has no typo
robots.txt does not block crawling
HTTP and HTTPS access are configured correctly
```

If those conditions are correct, avoid repeatedly changing a valid file and allow time for AdSense to crawl it and update the status.

## Separate public identifiers from secrets

GitHub Pages repositories are often public.

An AdSense publisher ID is visible in the site's AdSense script and `ads.txt`, so it is not a secret in the same sense as a private API key or password.

For documentation, however, generalized examples are easier to reuse:

```text
ca-pub-0000000000000000
pub-0000000000000000
```

Do not confuse values intended to be published by AdSense with actual secrets such as API keys, passwords, authentication tokens, or private keys.

## Summary

The core setup for AdSense on Astro GitHub Pages is straightforward:

```text
1. Add the AdSense script to the shared head layout
2. Create public/ads.txt
3. Verify the deployed HTML and /ads.txt directly
```

For multilingual sites, also check whether the root page bypasses the shared layout.

The final deployed output matters more than the source change itself. Verify that the script is present in the generated HTML and that `ads.txt` is actually reachable from the site root.

## References

- Google AdSense: Connect your site to AdSense
  https://support.google.com/adsense/answer/7584263
- Google AdSense: ads.txt guide
  https://support.google.com/adsense/answer/12171612
- Google AdSense: Ensure your ads.txt files can be crawled
  https://support.google.com/adsense/answer/7679060
- Astro: Scripts and event handling
  https://docs.astro.build/en/guides/client-side-scripts/
