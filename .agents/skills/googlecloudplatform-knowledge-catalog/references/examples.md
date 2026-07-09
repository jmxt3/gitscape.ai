# Examples

## Example 1 — `toolbox/mdcode/README.md`

```typescript
import * as kcmd from 'kcmd';

// Creating a catalog manifest from scratch
const manifest = new kcmd.CatalogManifest(...);
manifest.save('/path/to/root');

// Loading a catalog snapshot from the filesystem
const snapshot = kcmd.CatalogSnapshot.fromPath('/path/to/root');

// Pulling the latest metadata from the Catalog service.
const pullResult = await snapshot.pull();
if (pullResult.success) {
  console.log('Metadata pulled successfully');
}
else {
  console.error('Metadata pull failed:', pullResult.error);
}

// Pushing the modified metadata to the Catalog service.
const pushResult = await snapshot.push();
if (pushResult.success) {
  console.log('Metadata pushed successfully');
}
else {
  console.error('Metadata push failed:', pushResult.error);
}
```

## Example 2 — `toolbox/enrichment/README.md`

```bash
bq query --use_legacy_sql=false <<EOF
CREATE SCHEMA IF NOT EXISTS \`${DEMO_CLOUD_PROJECT}.demo_ecommerce\`
OPTIONS (
  location = 'US',
  labels = [('usage', 'demo')]
);

CREATE TABLE IF NOT EXISTS \`${DEMO_CLOUD_PROJECT}.demo_ecommerce.events\`
PARTITION BY event_date_dt
AS
SELECT
  *,
  PARSE_DATE('%Y%m%d', event_date) AS event_date_dt
FROM
  \`bigquery-public-data.ga4_obfuscated_sample_ecommerce.events_*\`;
EOF
```

## Example 3 — `okf/bundles/crypto_bitcoin/tables/inputs.md`

```sql
SELECT
    block_number,
    SUM(value) AS total_input_value
FROM `bigquery-public-data.crypto_bitcoin.inputs`
WHERE block_number = 600000 -- Example block number
GROUP BY block_number
```

## Example 4 — `okf/bundles/crypto_bitcoin/tables/outputs.md`

```sql
SELECT
  SUM(t.value) AS total_output_value
FROM
  `bigquery-public-data.crypto_bitcoin.outputs` AS t
WHERE
  t.block_number = 123456
```

## Example 5 — `okf/bundles/ga4/references/metrics/avg_pageviews.md`

```sql
SUM(page_view_count) / COUNT(*)
-- where page_view_count is COUNTIF(event_name = 'page_view') per user
```

## Example 6 — `okf/bundles/ga4/references/metrics/avg_spend_per_purchase_session_by_user.md`

```sql
AVG(total_session_spend)
-- where total_session_spend is SUM(COALESCE(...)) for event_name = 'purchase' events within a session, grouped by user_pseudo_id and ga_session_id
```

## Example 7 — `okf/bundles/stackoverflow/tables/posts_answers.md`

```sql
SELECT
  owner_user_id,
  COUNT(id) AS total_answers
FROM
  `bigquery-public-data.stackoverflow.posts_answers`
WHERE
  owner_user_id = 12345 -- Replace with a valid user ID
GROUP BY
  owner_user_id
```

## Example 8 — `okf/bundles/stackoverflow/tables/post_history.md`

```sql
SELECT
  t2.display_name,
  COUNT(t1.id) AS edit_count
FROM
  `bigquery-public-data.stackoverflow.post_history` AS t1
INNER JOIN
  `bigquery-public-data.stackoverflow.users` AS t2
ON
  t1.user_id = t2.id
WHERE
  t1.post_history_type_id = 2 -- Assuming \'2\' means \'Post Edited\'
GROUP BY
  t2.display_name
ORDER BY
  edit_count DESC
LIMIT 5;
```

## Example 9 — `okf/bundles/stackoverflow/tables/tags.md`

```sql
SELECT
    p.title,
    t.tag_name
  FROM
    `bigquery-public-data.stackoverflow.posts_questions` AS p,
    `bigquery-public-data.stackoverflow.tags` AS t
  WHERE
    p.tags LIKE CONCAT(\'%<\', t.tag_name, \'>%\' )
    AND t.tag_name = \'javascript\'
  LIMIT 5
```

## Example 10 — `okf/SPEC.md`

```markdown
---
type: BigQuery Table
title: Customer Orders
description: One row per completed customer order across all channels.
resource: https://console.cloud.google.com/bigquery?p=acme&d=sales&t=orders
tags: [sales, orders, revenue]
timestamp: 2026-05-28T14:30:00Z
---

# Schema

| Column        | Type      | Description                              |
|---------------|-----------|------------------------------------------|
| `order_id`    | STRING    | Globally unique order identifier.        |
| `customer_id` | STRING    | Foreign key into [customers](/tables/customers.md). |
| `total_usd`   | NUMERIC   | Order total in US dollars.               |
| `placed_at`   | TIMESTAMP | When the customer submitted the order.   |

# Joins

Joined with [customers](/tables/customers.md) on `customer_id`.

# Citations

[1] [BigQuery table schema](https://console.cloud.google.com/bigquery?p=acme&d=sales&t=orders)
```

## Example 11 — `okf/SPEC.md`

```markdown
---
type: BigQuery Dataset
title: Sales
description: All sales-related tables for the retail business.
resource: https://console.cloud.google.com/bigquery?p=acme&d=sales
tags: [sales]
timestamp: 2026-05-28T00:00:00Z
---

The sales dataset contains transactional tables, including
[orders](/tables/orders.md) and [customers](/tables/customers.md).
```

## Example 12 — `okf/SPEC.md`

```markdown
---
type: BigQuery Table
title: Orders
description: One row per completed customer order.
resource: https://console.cloud.google.com/bigquery?p=acme&d=sales&t=orders
tags: [sales, orders]
timestamp: 2026-05-28T00:00:00Z
---

# Schema

| Column        | Type      | Description                  |
|---------------|-----------|------------------------------|
| `order_id`    | STRING    | Unique order identifier.     |
| `customer_id` | STRING    | FK to [customers](/tables/customers.md). |
| `total_usd`   | NUMERIC   | Order total in USD.          |

Part of the [sales dataset](/datasets/sales.md).
```
