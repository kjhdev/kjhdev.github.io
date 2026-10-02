---
title: "Building a Stock Market Daily Briefing System #2: Choosing What Data to Collect"
pubDate: "2026-10-02"
description: "How I defined the data scope for a Korean stock-market daily briefing by focusing on KOSPI and KOSDAQ indices, market breadth, investor flows, sectors, and trading-value rankings instead of collecting everything available."
category: "Project"
tags: ["Korean Stock Market", "Kiwoom REST API", "MySQL", "Python", "Data Pipeline", "Automation"]
lang: "en"
postType: "project"
project: "stock-market-daily-briefing"
seriesOrder: 2
---

In [part 1](/en/posts/stock-market-daily-briefing-system-intro/), I described the overall architecture for collecting Korean stock-market data and turning it into one daily briefing.

The next question was simple:

**What data should the system actually collect?**

It is easy to assume that more stock-market data is always better. In practice, every additional dataset also adds API calls, database tables, unit conversions, missing-data checks, and publishing logic.

This project is not an individual-stock analysis platform. It is a **daily briefing designed to explain the overall market quickly**. Instead of collecting everything available, I first defined the questions the briefing should answer and then collected only the data needed to answer them.

## Five questions the briefing should answer

When reviewing a completed trading day, I mainly want to know five things.

1. How much did KOSPI and KOSDAQ move today?
2. Did many stocks participate, or was the index move concentrated in a few names?
3. Which investor groups were net buyers and sellers?
4. Which sectors were strong or weak?
5. Which stocks attracted the most trading activity?

Once these questions were fixed, the required datasets became much clearer.

```text
Market direction      → KOSPI / KOSDAQ indices
Market participation  → Advancers / unchanged / decliners
Investor flows        → Individual / foreign / institutional net buying
Sector movement       → Sector returns and participation
Attention by stock    → Trading-value rankings
```

The current Office `market` schema is organized around the same structure.

## 1. Start with KOSPI and KOSDAQ indices

The first layer of the briefing is overall market direction.

KOSPI and KOSDAQ closing values and daily percentage changes are enough to tell whether the market finished higher or lower. The collector, however, stores more than just the closing value.

The current index dataset includes:

- Open
- High
- Low
- Close
- Change value
- Change rate
- Volume
- Trading value

These values are stored by trading date and market in `market_index_daily`.

The closing value and change rate become the headline numbers in the briefing, while open, high, and low values help explain the intraday path. Two sessions can both finish up 1%, but one may have risen steadily from the open while another may have fallen sharply before recovering.

The index dataset therefore acts as the reference point for describing the day's market structure, not just a simple up-or-down indicator.

## 2. Add market breadth because the index alone is not enough

A rising index does not mean every stock rose.

A small number of heavily weighted large-cap stocks can lift a capitalization-weighted index even when many listed stocks are falling. The reverse can also happen: the headline index may move only slightly while a large majority of stocks advance.

That is why the second dataset is **market breadth**.

The current `market_breadth_daily` table stores values such as:

- Limit-up stock count
- Advancing stock count
- Unchanged stock count
- Declining stock count
- Limit-down stock count
- Volume
- Trading value

If KOSDAQ rises sharply and the number of advancing stocks is also overwhelmingly high, it is reasonable to describe the move as broad participation across the market rather than an index gain driven by a small number of stocks.

If the index rises while decliners outnumber advancers, the next question should be whether large-cap stocks are carrying the index.

For describing how the market actually felt, index direction and breadth are much more useful when read together.

## 3. Collect investor flows to see who was buying and selling

After market direction, one of the most useful daily checks is investor flow.

The current `market_investor_daily` table stores net buying amounts for KOSPI and KOSDAQ for three groups:

- Individuals
- Foreign investors
- Institutions

This allows the briefing to go beyond a statement such as "KOSPI rose" and describe the structure behind the move.

```text
KOSPI rises
+
Foreign investors are net buyers
+
Institutions are net buyers
+
Individuals are net sellers
```

Combining index direction with investor flows makes it easier to see which groups were supporting or opposing the day's move.

Sector-level investor flows are stored separately in `market_sector_investor_daily`. Market-wide flows and sector flows serve different purposes, so they are not mixed into a single table.

## 4. Sector data shows where the strength actually was

Knowing that the overall market rose does not tell us where capital was concentrated.

The `market_sector_daily` table stores sector-level data including:

- Current sector index value
- Change value and change rate
- Volume and trading value
- Advancers, unchanged stocks, and decliners
- Limit-up and limit-down counts
- Number of listed stocks in the sector

This makes it possible to identify strong and relatively weak sectors in the daily briefing.

The important part is not simply listing the sector with the highest percentage gain. If a sector index rises, I also want to know whether many stocks inside that sector participated in the move.

In other words, **sector returns and sector breadth are read together**.

## 5. Start individual-stock coverage with trading-value rankings

The most difficult question when adding individual stocks to a market briefing is deciding which stocks deserve to appear.

If I only list the biggest percentage gainers, highly volatile small-cap stocks can dominate the result. If I only show the largest companies, I can miss the names that actually attracted the most attention that day.

The first selection rule I chose was **trading value**.

The `market_ranking_daily` table is designed to store ranking type, rank, stock code, stock name, current price, change rate, and the metric used for the ranking.

The daily briefing uses trading-value rankings to see where actual trading activity was concentrated.

A high trading value does not mean a stock is a good investment. The purpose is not to recommend stocks. It is to identify **where the market's attention was concentrated during that session**.

Keeping that distinction explicit also helps prevent the daily briefing from turning into a stock-picking article.

## Separate collection tables from the publishing summary

It would be possible to generate Markdown directly from all of the raw collection tables. The problem is that the post generator would then need to understand the structure of every source table.

Instead, the current design keeps the datasets separated by purpose and then gathers frequently used values into `daily_summary` for the publishing stage.

| Role | Table | Main data |
| --- | --- | --- |
| Market direction | `market_index_daily` | KOSPI/KOSDAQ indices, volume, trading value |
| Market participation | `market_breadth_daily` | Advancers, unchanged stocks, decliners |
| Sector movement | `market_sector_daily` | Sector returns and stock participation |
| Investor flows | `market_investor_daily` | Individual, foreign, institutional net buying |
| Sector flows | `market_sector_investor_daily` | Investor flows by sector |
| Stock attention | `market_ranking_daily` | Trading-value and other ranking data |
| Publishing summary | `daily_summary` | Frequently used briefing values |

This reduces the direct coupling between the collector and the post generator.

For example, if an API response field changes, the collection layer can normalize it while keeping the `daily_summary` structure stable. That limits how much publishing logic needs to change.

## Dates and units are part of the data model

Correct values are not enough. Automated market-data collection also needs correct context.

Several problems can occur even when an API returns a valid response:

- The requested date and returned trading date may differ.
- A market holiday may cause the previous trading day's data to be returned.
- Trading-value units may differ between APIs.
- Similar-looking values may use different market-specific definitions.
- Some datasets may be current while others still belong to the previous session.

For that reason, the tables explicitly store `trade_date`. Monetary fields also keep unit metadata such as `trading_value_unit` and `amount_unit`, and `source_api` records where the value came from.

The collection run itself is tracked in `collection_run`, including start time, finish time, requested base date, actual trading date, request count, and run status.

The design goal is not only to collect numbers, but also to preserve **when each number was collected and under which source and unit assumptions**.

## Why I did not collect every stock dataset from the beginning

A separate project, QuantPick, collects a much broader range of long-term stock-level data, including price history, investor flows, program trading, short selling, margin data, and securities lending.

Office does not need to duplicate all of that data.

The two projects are trying to answer different questions.

```text
QuantPick
→ Which stocks may have higher short-term return potential?

Office Market Briefing
→ What happened in the market today?
```

Different questions require different datasets.

For Office, long-term stock-level data that does not directly help explain the completed trading day was excluded from the initial scope. High-volume real-time data such as tick-by-tick trades and order-book data was also deprioritized because it adds significant collection complexity without directly improving an end-of-day briefing.

Reducing the scope lowers API usage and storage volume, but the more important benefit is that **the set of data that needs to be validated remains clearly defined**.

## Four rules for deciding whether to add a dataset

I currently use four questions before adding new market data.

### 1. Will the briefing actually use it?

Data is not added simply because the API exposes it. It should directly help a reader understand the trading day.

### 2. Can it be collected consistently every day?

For automation, repeatability matters more than successfully fetching a value once. The same dataset should be available in a stable form across trading days.

### 3. Can the result be validated?

The system should be able to check trading dates, row counts, value ranges, and units. Data that cannot be validated reliably is difficult to use in automated publishing.

### 4. Is it worth the API request cost?

External APIs have request limits. A daily briefing that consumes unnecessary calls for low-value data will be difficult to operate reliably over time.

The key distinction is between data that would be nice to have and data that is actually required for the briefing.

## Current briefing data flow

The current flow can be simplified as follows.

```text
KOSPI / KOSDAQ indices
Market breadth
Investor flows
Sectors
Trading-value rankings
        ↓
MySQL market schema
        ↓
daily_summary and briefing processing
        ↓
Markdown post
        ↓
Astro build and deployment
```

Part 1 defined the overall system architecture. This step defines what data is allowed to enter that architecture.

Once the scope was clear, the collector's purpose also became clearer. Its goal is not to store as much stock-market data as possible. Its goal is to **produce a reliable market summary using the same rules every trading day**.

## Next step

Choosing the datasets does not mean the full collector should run immediately.

In automated collection, one of the more dangerous failures is not an API request that clearly fails. It is **incorrect trading dates or abnormal values being accepted and stored as if they were valid**.

For that reason, I added a `preflight` stage that makes only a small number of API calls and checks the trading date and key values before the full collection begins.

The next post will cover **why the system performs preflight validation before a full collection run**, including what is checked and how invalid data is prevented from reaching the publishing pipeline.
