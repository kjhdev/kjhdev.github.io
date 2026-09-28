---
title: "What 2,555 Stocks Taught Me About Batch Data Validation"
pubDate: "2026-09-23T07:30:40+09:00"
description: "A practical validation design learned while loading two years of data for 2,555 stocks: coverage, date ranges, duplicates, consistency rules, source-data exceptions, and rerun safety."
category: "Data Engineering"
tags: ["Python", "MySQL", "Batch", "Data Validation", "ETL"]
lang: "en"
---

The biggest lesson from building a large API collector was that **a finished collector does not mean the stored dataset is correct**.

The real workload covered 2,555 KOSPI and KOSDAQ common stocks. Two years of daily price history produced more than 1.6 million rows. At that scale, checking a few symbols or running only `COUNT(*)` cannot prove completeness.

The success condition therefore changed from "no exception and row count increased" to "collection completed and an independent validator passed."

## Validation pipeline

```text
API collection
→ MySQL load
→ total count
→ coverage for all 2,555 targets
→ per-symbol date range
→ duplicates and consistency
→ accepted source exceptions
→ PASS / WARNING / FAIL
```

A total count is only the first signal:

```sql
SELECT COUNT(*) FROM stock_price_daily;
```

The more important check compares the master list with stored data.

```sql
SELECT m.stock_code
FROM stock_master m
LEFT JOIN stock_price_daily d ON d.stock_code = m.stock_code
GROUP BY m.stock_code
HAVING COUNT(d.stock_code) = 0;
```

The useful metric is not simply "over 1.6 million rows" but **how many of the 2,555 expected symbols are represented correctly**.

## Validate the time range per symbol

```sql
SELECT stock_code,
       COUNT(*) AS cnt,
       MIN(trade_date) AS min_date,
       MAX(trade_date) AS max_date
FROM stock_price_daily
GROUP BY stock_code;
```

A newly listed company cannot have two full years of history, so a smaller row count is not automatically a failure. Validation needs master metadata and expected availability rules.

## Do not classify every zero-row result as a failure

Some managed or exceptional securities can legitimately have no source data. Treating every empty result as a collection failure creates permanent false alarms.

I separated results into:

```text
PASS    expected data and consistency rules satisfied
WARNING explainable source-data exception
FAIL    real omission, duplicate, or invalid value
```

Warnings still record the symbol, state, and reason. An exception without evidence quickly becomes a blind spot.

## A real consistency trap: investor-value residuals

Investor-flow data was checked by comparing component totals. Quantity relationships were useful validation rules, while monetary values produced many residuals because of source units and aggregation behavior.

A strict `difference != 0 → FAIL` rule would have rejected valid data repeatedly. After examining the source behavior, quantity inconsistencies remained failure candidates while monetary residuals were counted as informational warnings.

This changed an important design rule: **validation tolerances should come from observed source behavior, not arbitrary assumptions.**

## Reruns must be safe

A multi-million-row initialization can stop because of a server restart or API limit. Restarting should not create duplicates.

Use a business key such as symbol and trade date:

```sql
UNIQUE KEY uk_stock_date (stock_code, trade_date)
```

Then verify duplicates independently:

```sql
SELECT stock_code, trade_date, COUNT(*)
FROM stock_price_daily
GROUP BY stock_code, trade_date
HAVING COUNT(*) > 1;
```

## Logs should preserve evidence

Useful validation output includes:

```text
total rows
master coverage
per-symbol date anomalies
accepted no-source-data symbols
consistency warning count
duplicate count
final PASS / FAIL
```

A single "success" message is not enough when the dataset later becomes an input to analysis.

## Propagate validation failure

The Python validator exits non-zero when real errors exist:

```python
if errors:
    raise SystemExit(1)
raise SystemExit(0)
```

A shell pipeline can then stop immediately:

```bash
set -e
python collect.py
python validate_raw_data.py --dataset price --history-years 2
```

The same rules can be reused for a two-year initial load and a daily incremental load. The volume changes; the quality gate should not.

The key improvement was redefining "collection complete." It now means coverage, ranges, duplicates, consistency, and known exceptions have been checked—not merely that API calls ended. At large scale, evidence that the data can be trusted is more valuable than a large row count alone.
