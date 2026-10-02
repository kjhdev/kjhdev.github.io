---
title: "Building a Stock Market Daily Briefing System #3: Why I Added Preflight Validation Before Full Collection"
pubDate: "2026-10-02"
description: "Why the Korean stock-market collector runs preflight validation before full collection, checking authentication, the latest KOSPI trading date and index values, trading-value rankings, and API request usage before data is stored."
category: "Project"
tags: ["Korean Stock Market", "Kiwoom REST API", "Python", "Data Validation", "Preflight", "Automation"]
lang: "en"
postType: "project"
project: "stock-market-daily-briefing"
seriesOrder: 3
---

In [part 2](/en/posts/stock-market-daily-briefing-data-design/), I defined which datasets the daily market briefing should collect.

Once the scope includes indices, market breadth, investor flows, sectors, and trading-value rankings, the next obvious step is to call the APIs and store the results.

While building the collector, however, one problem became more important than simply making the requests work.

**A successful API request does not necessarily mean the returned data is safe to publish.**

A request that fails clearly is relatively easy to handle because the program stops with an error. The more dangerous case is when a request succeeds but the trading date is not what I expected, an important list is empty, or abnormal values continue into the next stage as if they were valid.

For that reason, the Office market collector has a separate `preflight` stage that makes only a small number of API calls before the full collection run begins.

## Preflight is a small gate before the expensive work starts

The purpose of `preflight` in this project is not to validate every dataset in advance.

Its job is to answer a simpler question: **is the basic collection environment healthy enough to start the full batch?**

The current flow can be simplified as follows.

```text
Run preflight
↓
Check API authentication
↓
Request KOSPI index data
↓
Inspect returned trading date and core index values
↓
Request trading-value ranking
↓
Confirm the response contains rows
↓
Check current API request usage
↓
Only then proceed to the full collection run
```

Instead of storing dozens of records first and discovering a basic problem later, the collector checks a few representative endpoints at the beginning.

## Why not just run the full collector immediately?

At first, a single full-collection program seems sufficient.

```text
Call APIs
→ collect everything
→ save to DB
→ validate
```

The problem is that this makes failures more expensive.

### It can waste API requests

If the first important response is already abnormal, continuing through the rest of the endpoints only consumes the request budget.

API calls are a resource in an automated batch. When several endpoints are combined, it is better to detect a broken state as early as possible.

### Partial data can remain in the database

If an error appears halfway through collection, some tables may contain new rows while others remain empty.

If summary generation or publishing logic runs against that partial state, the problem becomes harder to understand than a simple failed API request.

### The failure scope becomes harder to isolate

Without a preflight step, it can be unclear whether the problem is authentication, the index endpoint, a ranking endpoint, parsing logic, or one of the later collection stages.

If preflight itself fails, I know to investigate the environment and the core APIs before looking at the full batch.

## 1. Authentication is checked first

The current `preflight_market.py` starts by requesting a Kiwoom REST API token.

```text
Create KiwoomClient
↓
issue_token()
↓
Begin core data checks
```

If authentication is not working, there is no reason to continue with market-data requests.

This sounds obvious, but it matters in scheduled jobs. A token problem, environment-variable issue, or API configuration error should be exposed before a chain of dependent requests starts.

## 2. KOSPI is used to inspect the trading date and core index values

After authentication, preflight requests KOSPI index data.

The current collector uses Kiwoom REST API `ka20006` for this step.

The index function ignores dates later than the requested base date, chooses the most recent available trading day, converts the OHLC values, and rejects the response if any required OHLC value is missing.

```text
Requested base date
↓
Index response rows
↓
Keep dates at or before the base date
↓
Choose the latest trading date
↓
Check open / high / low / close
```

Preflight then logs the actual `trade_date`, closing value, and daily change rate returned by this process.

This matters because **the calendar date and the latest trading date are not always the same**.

Weekends and exchange holidays exist, and an API queried with a calendar date may still resolve to the latest available trading session.

An automated collector should therefore not assume that the server date itself is the market date. The actual trading date coming from market data needs to remain visible throughout the pipeline.

## 3. A second, different endpoint checks that list data is available

One successful index request does not prove that every endpoint is healthy.

Preflight therefore checks another API with a different response shape: trading-value rankings through `ka10032`.

The important part is intentionally simple.

```python
rows = data.get("trde_prica_upper")

if not isinstance(rows, list) or not rows:
    raise RuntimeError("Trading-value ranking response is empty")
```

The goal here is not to save the ranking into the production tables.

The goal is to confirm that the API returns an actual list with data in it.

When it is normal, preflight logs the number of rows and the first stock name.

```text
Trading-value ranking OK: 100 rows, first stock ...
```

Checking both an index endpoint and a ranking endpoint gives more confidence than checking authentication alone.

## 4. API request usage is part of the preflight result

When an external API has request limits, request count is operational data too.

`KiwoomClient` tracks how many API calls have been made during the current run. At the end of preflight, the log reports the usage against the configured limit.

```text
Office market preflight complete: API requests 3/20
```

The exact maximum can change with configuration, but the design principle remains the same.

If a supposedly small preflight already consumes more requests than expected, that is worth investigating before the full batch begins.

Keeping request counts in the logs also makes it easier to see how much API cost increases when new datasets are added later.

## Preflight intentionally does not write to the database

One important rule is to separate **diagnostic requests** from **production writes**.

Preflight fetches KOSPI data but does not save it into `market_index_daily`. It also checks the trading-value ranking response without inserting those rows into the ranking table.

```text
preflight
API request → parse → inspect core values → exit

full batch
API request → parse → save to DB → full validation → build summary
```

This makes preflight safe to run repeatedly while debugging.

I can test API connectivity and response shape without cleaning up temporary production rows afterward.

## Concurrent preflight runs are blocked as well

The wrapper script, `scripts/preflight-market.sh`, also uses a file lock.

```bash
exec 9>/tmp/office-market.lock
if ! flock -n 9; then
    echo "Office market collector is already running."
    exit 3
fi
```

If another process using the same lock is already active, the new process exits immediately.

A small test script may not seem to need this at first. In practice, manual checks, scheduled runs, and recovery work can overlap. Without a lock, two processes can hit the same external API at the same time and make the operational state harder to reason about.

As automation grows, **preventing duplicate execution becomes another form of data protection**.

## Passing preflight does not mean every dataset is valid

Preflight is a first gate designed to fail quickly. It is not the final validator.

Even if KOSPI and the trading-value endpoint look normal, the full batch can still encounter problems such as:

- KOSDAQ returning a different trading date
- sector rows being only partially collected
- market-breadth counts being suspiciously small
- investor-flow values being missing
- monetary units not matching expectations
- one ranking type containing fewer than the required number of rows

These problems can only be detected after more of the data has been collected.

That is why the Office collector uses multiple validation layers instead of one large check at the end.

| Stage | Purpose | Typical checks |
| --- | --- | --- |
| Before execution | Prevent invalid execution conditions | File lock, collection window |
| Preflight | Check core API health | Authentication, KOSPI, trading-value ranking, request count |
| During collection | Keep data on one market date | KOSPI/KOSDAQ trading-date match |
| After collection | Validate stored data | Counts, missing values, ranges, units, rankings |
| Before publishing | Verify publishable output | Summary and snapshot generation |

Each stage catches the kind of error that is easiest to detect at that point.

## The full daily batch has stronger safeguards

`preflight_market.py` and `daily_batch.py` serve different purposes.

The full daily batch begins by checking whether it should run at all.

### Weekends are skipped

Saturday and Sunday runs return without collecting market data.

### Final collection is blocked before 20:00 on weekdays

Office is meant to publish an end-of-day market briefing, not a regular-session closing snapshot.

The current batch therefore waits until **20:00 KST** so that the KRX and NXT after-market sessions are also finished before final daily data is stored.

This prevents the system from treating the 15:30 regular-session close as the final state of the entire trading day.

### KOSPI and KOSDAQ must resolve to the same trading date

The batch first obtains the actual trading date from KOSPI and then requests KOSDAQ.

If the two `trade_date` values do not match, the batch fails immediately.

```text
KOSPI trade_date
        =
KOSDAQ trade_date
```

A daily briefing should never combine index data from two different trading sessions.

### Completed trading dates are skipped by default

If `daily_summary` already exists for the resolved trading date, the run is recorded as `SKIPPED` instead of collecting everything again.

This prevents duplicate scheduled or manual runs from consuming unnecessary API calls.

A deliberate rerun is still possible through the `--force` option.

## After collection, a separate consistency validator runs again

Once the full dataset has been saved, `validate_daily_data()` checks the database result.

The current validation includes checks such as:

- both KOSPI and KOSDAQ index rows exist
- required index values are present
- index change rates stay within a sanity range
- both market-breadth rows exist
- advancer, unchanged, and decliner counts are non-negative and present
- breadth stock counts are not suspiciously small
- enough sector rows were collected
- sector investor-flow row counts and amount units are correct
- market-level investor flows are present and use the expected unit
- every ranking type has the expected row count, unit, and universe
- total API request count stays within the configured maximum

The overall pipeline therefore looks like this.

```text
preflight
↓
full collection
↓
DB writes
↓
validate_daily_data
↓
build daily_summary
↓
publish snapshot
↓
briefing generation stage
```

If stored data fails validation, it does not proceed into the summary and publishing stages.

## Failure records are operational data too

The full batch records each execution in `collection_run`.

A successful run ends as `SUCCESS`, an already completed trading date can become `SKIPPED`, and an exception is recorded as `FAILED`.

The run record includes information such as:

- start time
- finish time
- requested base date
- resolved trading date
- API request count
- status
- failure message

In automation, storing successful market data is only part of the job. It is also important to know **why a run did not produce data**.

When a scheduled job fails, I want to distinguish an authentication problem, a trading-date mismatch, a validation failure, and a duplicate run instead of only noticing that today's article is missing.

## Preflight made the operating rule simpler

For a manual check, the current command is straightforward.

```bash
bash scripts/preflight-market.sh
```

The normal output I care about is intentionally small.

```text
KOSPI query OK
Trading-value ranking query OK
Office market preflight complete
```

If one of those checks fails, I stop there and inspect authentication, the returned trading date, response structure, or request usage before touching the full batch.

If preflight succeeds, the core API path is considered healthy enough to move forward.

The operating flow becomes:

```text
preflight fails
→ investigate the cause

preflight succeeds
→ run full collection
→ run full consistency validation
→ publish
```

This is easier to reason about than starting the largest job first and diagnosing problems afterward.

## The main idea is to detect failure as early as possible

Validation in a data-collection system should not be one final function added at the end.

It is safer to place several barriers at the earliest points where each class of problem can be recognized.

The current Office approach can be summarized as five rules.

1. Check duplicate execution and timing conditions before work begins.
2. Use a small number of API requests to verify core health before full collection.
3. Keep trading dates and data context consistent during collection.
4. Validate the stored database result after collection.
5. Send only validated data into summary and publishing stages.

The purpose of preflight is therefore not to validate a lot of data.

It is to **prevent a large job from starting in a state that is already known to be unsafe**.

## Next step

Passing preflight still does not prove that the complete daily dataset is correct.

Many issues only become visible after several API results have been stored and compared with one another. At that point, row counts, value ranges, units, market classifications, and ranking completeness all need to be checked.

The next post will cover **how the system validates collected stock-market data after storage**, focusing on the consistency rules inside `validate_daily_data()` and how invalid data is prevented from reaching the daily briefing.
