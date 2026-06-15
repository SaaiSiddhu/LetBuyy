-- 179 — Align the outbox_events partition-shadow with its source table.
--
-- The generic mirror_hot_table_partition_shadow() trigger copies every outbox_events row into the
-- outbox_events_partitioned shadow via `INSERT INTO <shadow> SELECT (NEW).*`. The shadow table was
-- missing the `published_at` column that outbox_events gained, so the positional INSERT raised
--   "INSERT has more expressions than target columns" (SQLSTATE 42601)
-- and broke EVERY outbox write — including theme release publishing via publish_theme_release().
--
-- Additive + idempotent. No data is moved; we only add the missing column so the shadow matches its
-- source column set (and order — published_at is the tail column on outbox_events).
ALTER TABLE public.outbox_events_partitioned
    ADD COLUMN IF NOT EXISTS published_at timestamptz;
