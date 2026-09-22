---
title: "Validating Large Batch Data After Collection"
pubDate: "2026-09-23T07:30:40+09:00"
description: "A practical validation design for large Python and MySQL batch loads, covering per-item coverage, date ranges, consistency rules, expected exceptions, and rerun safety."
category: "Data Engineering"
tags: ["Python", "MySQL", "Batch", "Data Validation", "ETL"]
lang: "en"
---

# Validating Large Batch Data After Collection

When an API load inserts hundreds of thousands or millions of rows into MySQL, a completed `INSERT` does not prove that collection succeeded.

Partial omissions, missing date ranges, and legitimate no-data cases are often more dangerous than a visible exception. This article describes a separate validation stage for large batch loads.

## Separate collection from validation

A collector becomes difficult to maintain when it also owns every validation rule. A separate validator keeps responsibilities clear.

```text
Run collector
  ↓
Load database
  ↓
Validate each dataset
  ↓
PASS / WARNING / FAIL
```

The collector focuses on API calls and persistence. The validator checks whether the stored result satisfies expected conditions.

## Total row count is only a starting point

A total count is useful as a first check.

```sql
SELECT COUNT(*)
FROM stock_data_daily;
```

A large count does not prove completeness. One item may contain many rows while another item is completely missing.

Check the distribution per item as well.

```sql
SELECT item_code,
       COUNT(*) AS row_count,
       MIN(trade_date) AS min_date,
       MAX(trade_date) AS max_date
FROM stock_data_daily
GROUP BY item_code;
```

## Validate coverage per target

If a master table defines active collection targets, compare it with the loaded dataset to find missing items.

```sql
SELECT m.item_code
FROM item_master m
LEFT JOIN stock_data_daily d
    ON d.item_code = m.item_code
WHERE m.active = 1
GROUP BY m.item_code
HAVING COUNT(d.item_code) = 0;
```

The important question is not only how many rows exist, but whether **every expected target has the required data**.

For historical datasets, also validate minimum and maximum dates. Newly registered items may not have the full history, so their start date needs a separate rule.

## Distinguish no source data from collection failure

Treating every zero-row result as a failure creates false alarms.

A suspended, newly registered, or otherwise exceptional item may legitimately have no source data. A validator can classify results into three levels.

```text
PASS    expected conditions satisfied
WARNING acceptable source-data exception
FAIL    missing or inconsistent data
```

Every accepted exception should have a reason. Silently ignoring errors can hide real collection failures.

## Validate relationships inside the data

After coverage checks, validate relationships between columns.

If several component values are expected to equal a total, compare them in SQL or Python.

```text
sum of components == total
```

Small residuals may be legitimate when the source uses unit conversion, rounding, or a different aggregation rule. In that case, define an explicit tolerance and report the difference as an informational warning instead of automatically failing the batch.

The tolerance should come from observed source-data behavior rather than an arbitrary number.

## Rerun safety is part of validation

A failed batch may need to run again. The same item and date should not create duplicate rows.

Where possible, enforce a natural or business key in the database.

```sql
UNIQUE KEY uk_item_date (item_code, trade_date)
```

The collector can then use a project-appropriate rerun strategy such as `INSERT ... ON DUPLICATE KEY UPDATE`.

The validator should still check for duplicates.

```sql
SELECT item_code, trade_date, COUNT(*)
FROM stock_data_daily
GROUP BY item_code, trade_date
HAVING COUNT(*) > 1;
```

## Make validation logs useful to humans

A single `validation succeeded` message provides little evidence when a problem appears later.

Useful summary output includes:

```text
total row count
per-target coverage result
minimum and maximum dates
accepted no-source-data targets
consistency warning count
duplicate count
final PASS / FAIL
```

There is no need to print millions of rows. Log summary counts and only the targets that need attention.

## Stop downstream steps when validation fails

A validator should return a meaningful process exit code as well as readable logs.

```python
if errors:
    raise SystemExit(1)

raise SystemExit(0)
```

A shell script or CI job can then stop subsequent stages after a failed validation.

```bash
python collect.py
python validate_data.py
```

With `set -e`, a non-zero validator exit code prevents the batch from continuing.

## Reuse the same rules for initial and daily loads

A multi-year initial load and a daily incremental batch have different volumes, but many validation rules can be shared.

Pass the dataset and history range as arguments instead of creating a new validator for every collector.

```bash
python validate_data.py --dataset price --history-years 2
python validate_data.py --dataset investor --history-years 2
```

A daily batch can reuse the same rules with a narrower validation period.

## Conclusion

A large collection job is not complete merely because API calls finished or the database row count increased.

Validate total counts, per-target coverage, date ranges, duplicates, internal consistency, and legitimate source-data exceptions before treating the dataset as analysis-ready.

Separating collection from validation and propagating failures to downstream steps gives both initial bulk loads and recurring daily batches a consistent quality gate.
