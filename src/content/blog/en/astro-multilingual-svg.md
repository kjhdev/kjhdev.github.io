---
title: "Managing SVG Images in a Multilingual Astro Blog"
pubDate: "2026-09-25T07:29:02+09:00"
description: "Learn how to separate localized SVG assets in an Astro blog and validate Markdown references, SVG structure, and external dependencies before deployment."
category: "Astro"
tags: ["Astro", "SVG", "Markdown", "i18n", "Static Site"]
lang: "en"
---

Translating the article text is not enough when diagrams contain their own labels and explanations.

For multilingual technical content, an image with embedded text should normally match the language of the article that displays it. Static sites also benefit from validating image references before deployment, because a missing or malformed asset can otherwise survive until the generated page is viewed.

This article describes a practical way to organize localized SVG files in an Astro blog and validate them before committing a post.

## Separate localized Markdown and image assets

Assume the content is organized by language.

```text
src/content/blog/
├── ko/
│   └── example.md
└── en/
    └── example.md
```

An image without text can be shared by both articles.

If the image contains headings, step names, or explanatory text, separate localized files make the relationship explicit.

```text
public/images/posts/example/
├── workflow-ko.svg
└── workflow-en.svg
```

Including the language in the filename also makes it easier to spot a mismatched reference during review.

## Validate both the Markdown reference and the file

The Korean article can reference the Korean asset.

```md
![배포 전 콘텐츠 검증 흐름](/images/posts/example/workflow-ko.svg)
```

The English article should use the corresponding English asset.

```md
![Content validation flow before deployment](/images/posts/example/workflow-en.svg)
```

Checking the Markdown string alone is not enough. The referenced file must actually exist at that path.

Case differences in filenames can also matter after deployment, so keep the Markdown path and the real filename identical.

## An SVG is text, but it still needs validation

SVG is XML-based and convenient to manage in Git, but its contents should still be checked.

### Root and closing tags

Confirm that the file is a complete SVG document.

```xml
<svg viewBox="0 0 1200 630"
     xmlns="http://www.w3.org/2000/svg">
    ...
</svg>
```

A failed generation step can leave a truncated file even though the file itself exists.

### Valid dimensions

Use a valid `viewBox` or explicit dimensions.

```xml
viewBox="0 0 1200 630"
```

An SVG with zero width or height may exist in the repository but still render incorrectly.

### Scripts and external assets

A static blog illustration generally does not need a `<script>` element.

Avoiding remote fonts and externally hosted images also reduces dependencies that can break when a third-party resource changes or becomes unavailable.

## Treat binary images differently

PNG, JPEG, and WebP files are binary assets, unlike SVG source.

Creating them through a UTF-8 text-file operation can corrupt the output. An automated publishing workflow should therefore distinguish between text and binary image formats.

```text
SVG
→ can be generated as UTF-8 text
→ validate XML structure

PNG / JPEG / WebP
→ use a real image generation tool
→ verify that the file can be decoded
```

A `.png` extension alone does not make a file a valid PNG image.

## Localize alt text too

Localized image files should also have localized alt text.

Instead of repeating every label inside a diagram, describe the main information conveyed by the image in the language of the article.

```md
![Flow from article generation to image validation](...)
```

This keeps the surrounding content natural and improves accessibility.

## Validate before committing automated posts

For generated posts, it is safer to catch asset problems before the commit is created.

A compact workflow is:

```text
Generate Markdown
→ generate images
→ extract Markdown image paths
→ confirm files exist
→ validate SVG or decode binary images
→ build the site
→ commit
```

When the Astro project exposes a build script, run it to verify content parsing and static page generation.

```bash
npm run build
```

A successful build does not prove that every image contains the intended content, so file and image validation should remain separate checks.

## Check that localized files were not swapped

Automation often creates the Korean and English files for the same slug at the same time. That makes accidental copies or swapped language metadata worth checking.

Useful checks include:

- Korean Markdown uses `lang: "ko"`
- English Markdown uses `lang: "en"`
- the two Markdown files are not identical
- Korean content references the `-ko.svg` asset
- English content references the `-en.svg` asset

Commands and technical meaning should stay aligned across languages, but the files themselves should be naturally written for each audience.

## Summary

Image automation in a multilingual Astro blog should not stop after generating an asset.

Separate text-bearing images by language, verify that Markdown paths resolve to real files, and inspect SVG structure, dimensions, scripts, and external dependencies. For PNG, JPEG, and WebP files, verify that a real binary image was generated and can be decoded.

Running the Astro build after those checks provides another layer of validation before the post is committed and reduces the chance of deploying broken or mismatched assets.
