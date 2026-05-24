-- ============================================================================
-- Collections and gift cards runtime alignment
-- Migration: 042_collections_gift_cards_runtime_alignment.sql
-- Purpose:
--   Add soft-delete/audit fields needed for worker-owned collection and gift
--   card management.
-- ============================================================================

ALTER TABLE collections
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_by UUID,
    ADD COLUMN IF NOT EXISTS updated_by UUID;

ALTER TABLE gift_cards
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_by UUID,
    ADD COLUMN IF NOT EXISTS updated_by UUID;

CREATE INDEX IF NOT EXISTS idx_collections_store_active
    ON collections(store_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gift_cards_store_active
    ON gift_cards(store_id, created_at DESC)
    WHERE deleted_at IS NULL;
