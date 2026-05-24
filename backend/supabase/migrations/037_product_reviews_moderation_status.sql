-- ============================================================================
-- Product review moderation state
-- Migration: 037_product_reviews_moderation_status.sql
-- Purpose:
--   Make review moderation durable instead of encoding only approved/not-approved.
--   This is additive and keeps the legacy is_approved column synchronized for
--   existing storefront reads.
-- ============================================================================

ALTER TABLE product_reviews
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE product_reviews
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE product_reviews
SET status = CASE WHEN is_approved = TRUE THEN 'approved' ELSE COALESCE(status, 'pending') END,
    updated_at = COALESCE(updated_at, NOW())
WHERE status IS NULL
   OR (is_approved = TRUE AND status <> 'approved');

CREATE INDEX IF NOT EXISTS idx_product_reviews_store_status_created
    ON product_reviews(store_id, status, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION sync_product_review_moderation_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IS NULL THEN
        NEW.status := CASE WHEN COALESCE(NEW.is_approved, FALSE) THEN 'approved' ELSE 'pending' END;
    ELSIF TG_OP = 'INSERT' AND COALESCE(NEW.is_approved, FALSE) AND NEW.status = 'pending' THEN
        NEW.status := 'approved';
    END IF;

    NEW.is_approved := NEW.status = 'approved';
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_reviews_moderation_status ON product_reviews;
CREATE TRIGGER trg_product_reviews_moderation_status
    BEFORE INSERT OR UPDATE ON product_reviews
    FOR EACH ROW
    EXECUTE FUNCTION sync_product_review_moderation_status();
