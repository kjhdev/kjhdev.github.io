---
title: "Build a Free Developer Blog with GitHub Pages and Astro"
description: "A practical guide to building and deploying a developer blog for free using Astro, GitHub Pages, and GitHub Actions."
lang: "en"
pubDate: 2026-09-07T14:30:00+09:00
category: "Web Development"
tags:
  - Astro
  - GitHub Pages
  - GitHub Actions
  - Blog
draft: false
---

I decided to build a personal developer blog to document development notes, troubleshooting steps, and solutions I discover while working on real projects.

Using a hosted blogging platform is convenient, but as a developer, it can be useful to manage the source code directly and customize the site structure as needed.

In this post, I will show how to **build a static blog with Astro and deploy it for free with GitHub Pages**.

The final structure looks like this:

```text
Write posts in Markdown
        ↓
Astro
        ↓
Generate static HTML
        ↓
GitHub Actions
        ↓
GitHub Pages
        ↓
https://username.github.io
```

GitHub Pages is a good fit for personal blogs and technical documentation because it can host static websites without a separate web server.

## 1. Create a GitHub Pages Repository

If your GitHub username is `username`, create a repository with the following name:

```text
username.github.io
```

A user-level GitHub Pages repository follows this naming rule:

```text
GitHubUsername.github.io
```

After creating the repository, clone it to your local machine.

```bash
git clone https://github.com/username/username.github.io.git
cd username.github.io
```

This repository will contain the Astro project, and the generated site will later be deployed through GitHub Actions.

## 2. Check the Node.js Version

Before installing Astro, check your Node.js and npm versions.

```bash
node -v
npm -v
```

If you manage multiple Node.js versions, `nvm` is convenient.

For example, to install and use Node.js 22:

```bash
nvm install 22
nvm use 22
```

To make Node.js 22 the default version:

```bash
nvm alias default 22
```

Then confirm the active version.

```bash
node -v
```

## 3. Create the Astro Project

Inside the cloned GitHub repository, run:

```bash
npm create astro@latest .
```

Because I wanted to build the blog structure myself, I selected the minimal template.

```text
Use minimal (empty) template
```

If the project directory is already a cloned Git repository, there is no need to initialize Git again.

After installation, start the development server.

```bash
npm run dev
```

By default, Astro runs at:

```text
http://localhost:4321
```

If the page loads correctly in the browser, the basic Astro project is ready.

## 4. Create the Blog Structure

For this blog, Korean and English versions of the same post are served under separate URLs.

The project structure looks like this:

```text
src/
├── content/
│   └── blog/
│       ├── ko/
│       └── en/
├── layouts/
│   └── BaseLayout.astro
└── pages/
    ├── index.astro
    ├── ko/
    │   └── index.astro
    ├── en/
    │   └── index.astro
    └── [lang]/
        └── posts/
            └── [slug].astro
```

This generates URLs such as:

```text
/ko/posts/first-post/
/en/posts/first-post/
```

Using the same filename for both language versions makes the posts easier to manage.

```text
src/content/blog/ko/first-post.md
src/content/blog/en/first-post.md
```

## 5. Write Posts in Markdown

Astro Content Collections let you define post metadata together with the Markdown content.

For example:

```markdown
---
title: "My First Development Post"
description: "A short description of the post."
lang: "en"
pubDate: 2026-09-07
category: "Flutter"
tags:
  - Flutter
  - Desktop
draft: false
---

Write the actual article content here.
```

You can use `draft: true` to exclude unfinished posts from the visible post list or deployment logic, depending on how the collection is configured.

One of the biggest advantages of a static site generator is that you do not need to create HTML files manually for every article. You only add Markdown files.

## 6. Configure Astro for GitHub Pages

Set the production site URL in `astro.config.mjs`.

```javascript
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://username.github.io',
});
```

If you use the user-level repository `username.github.io`, you do not need a separate `base` path.

If you deploy a normal project repository instead, you may need to configure `base` using the repository name.

## 7. Deploy Automatically with GitHub Actions

Create the following workflow file:

```text
.github/workflows/deploy.yml
```

Example:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Build Astro
        uses: withastro/action@v6

  deploy:
    needs: build
    runs-on: ubuntu-latest

    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

Then open the GitHub repository settings and go to:

```text
Settings
→ Pages
→ Build and deployment
→ Source
→ GitHub Actions
```

This setting is important.

If `Deploy from a branch` is still selected, GitHub may publish the repository contents directly instead of the Astro build output.

## 8. Build and Deploy the Site

Before pushing changes, check that the project builds successfully.

```bash
npm run build
```

If the build finishes without errors, commit and push the project.

```bash
git add .
git commit -m "Set up Astro blog"
git push origin main
```

When changes are pushed to the `main` branch, GitHub Actions starts automatically.

```text
git push
   ↓
GitHub Actions
   ↓
Astro build
   ↓
GitHub Pages deploy
```

Once both the `build` and `deploy` jobs complete successfully, open:

```text
https://username.github.io
```

The site should now be live.

## 9. Publishing New Posts Later

Once the deployment workflow is configured, publishing new content becomes simple.

Add or update a Markdown file, then run:

```bash
git add .
git commit -m "Add new post"
git push origin main
```

GitHub Actions rebuilds and redeploys the site automatically.

You can also work from another computer by cloning the repository and installing the dependencies.

```bash
git clone https://github.com/username/username.github.io.git
cd username.github.io
npm install
npm run dev
```

Before starting work on an existing clone, it is a good habit to pull the latest changes first.

```bash
git pull origin main
```

## Conclusion

Astro and GitHub Pages make it possible to run a developer blog without paying for separate web hosting.

This setup has several advantages:

- The entire blog can be managed with Git.
- Posts can be written in Markdown.
- HTML and CSS can be customized freely.
- Deployment happens automatically after a Git push.
- No application server is required.
- A custom domain can be connected later.

I plan to use this blog to document practical development topics involving Flutter, Spring Boot, Node.js, Docker, and other technologies used in real projects.
