---
title: "Building a Stock Market Daily Briefing System #1: Why I Started and the Overall Architecture"
pubDate: "2026-09-29"
description: "Why I started building a system that collects Korean stock-market data and automatically turns it into a daily briefing, and how Kiwoom REST API, MySQL, Docker, Astro, and GitHub Actions fit together."
category: "Project"
tags: ["Astro", "Python", "MySQL", "Docker", "Kiwoom REST API", "Automation"]
lang: "en"
postType: "project"
project: "stock-market-daily-briefing"
seriesOrder: 1
---

After the market closes, understanding the day usually means checking several sources separately. I need to see how KOSPI and KOSDAQ moved, which stocks attracted the most trading activity, how investor flows changed, and which issues influenced the market.

If the same information has to be checked every day, it makes sense to collect and organize it automatically. That idea became the starting point of the **Stock Market Daily Briefing System** project.

The goal is not simply to publish more stock-related articles. The goal is to collect market data automatically, validate it, store it, and turn the useful parts into one daily briefing.

This first post explains why the project started and how the overall system is currently designed before moving into the implementation details.

## Changing the direction of the Office blog

`office.bubudev.com` originally focused on Office tools and automation-related articles.

As the site continued to run, however, the content scope became too broad and it was difficult to define a clear long-term direction. Automatically generating articles also did not feel like building a service that was actually used for a specific purpose.

The site therefore changed direction from a general-purpose content blog to a **data-driven site that can publish new information every day**.

The chosen subject was the Korean stock market.

The goal can be summarized in one sentence:

> Automatically create a daily briefing that makes the day's Korean stock-market flow understandable on a single page.

From that goal, I started designing the required data, collection process, storage model, and publishing workflow.

## The goal is not just another stock blog

The important part of this project is not manually writing an opinion about the market every day.

Instead of repeatedly checking multiple sites, copying numbers, and composing the same structure by hand, the repeatable parts should become a system.

The current high-level flow is:

```text
Stock-market data
↓
Kiwoom REST API
↓
Market data collector
↓
MySQL storage
↓
Briefing data processing
↓
Markdown generation
↓
Astro static pages
↓
GitHub Actions deployment
↓
office.bubudev.com
```

The website does not call a stock API every time a visitor opens a page. The required data is collected after the trading day, converted into static content, and then deployed.

## Why keep the site static?

A project that uses stock-market data may sound like it needs a real-time backend server. This project, however, is not a real-time quote service.

Its purpose is to summarize the completed trading day. There is no reason to query a database or external API every time a page is viewed.

```text
Market closes
↓
Collect market data
↓
Generate briefing
↓
Build static HTML
↓
Deploy
↓
Visitors read the completed page
```

This allows the existing Astro site to remain static.

The backend is limited to a **batch process that collects data and generates content**, rather than a server that handles live web requests. The site stays simpler, and an external API problem does not directly affect page viewing.

## Separating data collection from the website

The project uses the Kiwoom REST API for Korean stock-market data.

The collector is not implemented as part of the public website itself. It runs as a separate Docker-based process on the server. The website focuses on presenting generated results, while the collector runs at a scheduled time.

```text
[Collection]
Kiwoom REST API
→ Collector
→ MySQL

[Publishing]
MySQL data
→ Post generator
→ Astro
→ GitHub
→ Deployment
```

This separation makes the system easier to change. Updating API collection logic does not require redesigning the site, while changing the page layout does not require modifying the collector.

## Keeping Office independent from QuantPick

Another project, QuantPick, also collects Korean stock data. Reusing that dataset for Office would have been possible, but the two projects have different purposes.

QuantPick collects long-term data for individual stocks and analysis. Office only needs the subset required to summarize the market for a single day.

The databases are therefore separated as well.

```text
MySQL
├── quant   : QuantPick data
└── market  : Office market briefing data
```

Office uses only the `market` schema. The intention is to prevent changes in one project's collection logic or tables from directly affecting the other project.

## Validate before trusting collected data

Receiving a successful API response does not automatically mean the data is correct.

One of the first components added to the collector was a `preflight` step. Before a broader collection run starts, a small number of API calls checks important values such as the trading date, market index data, and trading-value records.

The basic flow is:

```text
API request
↓
Check response
↓
Validate required data
↓
Store in DB
↓
Validate stored result
```

For a data-driven publishing system, avoiding the publication of incorrect values is more important than simply finishing without an exception.

For that reason, collection logic and validation logic are developed together in this project.

## Running the collector every day at 23:00

The market collector currently runs in Docker on the server.

Scheduling is handled with `systemd timer`, configured to run every day at 23:00. This leaves enough time after market activity has ended before the next content-generation stage begins.

```text
23:00
↓
systemd timer
↓
Run Docker Collector
↓
Collect and validate market data
↓
Store in MySQL
```

A later post will cover why `systemd timer` was chosen instead of `cron` and how a Docker collector can be operated like a scheduled batch job.

## Current technology stack

The main components currently used in the project are:

| Area | Technology |
| --- | --- |
| Market data | Kiwoom REST API |
| Data collection | Python Collector |
| Database | MySQL |
| Runtime | Docker |
| Scheduling | systemd timer |
| Website | Astro |
| Source control | GitHub |
| Deployment | GitHub Actions |
| Service | office.bubudev.com |

The important part is not each technology by itself, but how these pieces are connected into one repeatable workflow.

## Current project status

This project is still in progress.

The basic market-data collection structure, API preflight checks, MySQL storage, Docker runtime, and the daily 23:00 schedule have been configured.

The next stage is connecting the stored data to the actual briefing generation process and making the full path from collection to publishing work as one pipeline.

The current status can be summarized as follows:

```text
Completed or basically configured
- Market data collection structure
- API preflight validation
- MySQL market schema
- Docker Collector
- 23:00 systemd timer

In progress
- Briefing data processing
- Automatic Markdown generation
- Post validation
- End-to-end automation from collection to deployment
```

Rather than waiting until everything is finished and documenting only the final result, this series will record how the structure changes and what problems appear while the system is being built.

## Next step

The next question is **which market data should actually be included in the daily briefing**.

Collecting more data does not automatically create a better briefing. Market indices, trading value, advancing and declining stocks, investor flows, and sector movement all provide different signals. The useful subset needs to be selected first.

The next post will cover **which stock-market data to collect**, and how the data requirements for the briefing are defined.
