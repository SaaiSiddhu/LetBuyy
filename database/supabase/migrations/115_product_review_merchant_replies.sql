-- Merchant reply support for product reviews on mobile.

ALTER TABLE public.product_reviews
    ADD COLUMN IF NOT EXISTS merchant_reply text,
    ADD COLUMN IF NOT EXISTS merchant_reply_by uuid,
    ADD COLUMN IF NOT EXISTS merchant_reply_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_product_reviews_store_replied
    ON public.product_reviews USING btree (store_id, merchant_reply_at DESC)
    WHERE merchant_reply_at IS NOT NULL AND deleted_at IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'product_reviews_merchant_reply_by_fkey'
    ) THEN
        ALTER TABLE public.product_reviews
            ADD CONSTRAINT product_reviews_merchant_reply_by_fkey
            FOREIGN KEY (merchant_reply_by) REFERENCES public.users_custom(id) ON DELETE SET NULL NOT VALID;
    END IF;
END $$;

DROP TRIGGER IF EXISTS update_product_reviews_updated_at ON public.product_reviews;
CREATE TRIGGER update_product_reviews_updated_at
    BEFORE UPDATE ON public.product_reviews
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
