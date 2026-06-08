-- App developer registration consent, tax identity, and approval audit fields.
-- App-store developer routes are the single writer for registration; internal ops endpoint owns approval transitions.

ALTER TABLE public.app_developers
    ADD COLUMN IF NOT EXISTS tax_id text,
    ADD COLUMN IF NOT EXISTS agreed_tos boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS agreed_privacy boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS tos_policy_version text,
    ADD COLUMN IF NOT EXISTS privacy_policy_version text,
    ADD COLUMN IF NOT EXISTS consented_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS approval_requested_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS approved_by uuid,
    ADD COLUMN IF NOT EXISTS approval_notes text,
    ADD COLUMN IF NOT EXISTS kyc_status text DEFAULT 'pending'::text NOT NULL;

ALTER TABLE public.app_developers
    ADD CONSTRAINT app_developers_tax_id_check CHECK (((tax_id IS NULL) OR (length(btrim(tax_id)) <= 64))) NOT VALID;

ALTER TABLE public.app_developers
    ADD CONSTRAINT app_developers_kyc_status_check CHECK ((kyc_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'needs_review'::text]))) NOT VALID;

ALTER TABLE ONLY public.app_developers
    ADD CONSTRAINT app_developers_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users_custom(id) ON DELETE SET NULL NOT VALID;

CREATE INDEX IF NOT EXISTS idx_app_developers_status_approval
    ON public.app_developers USING btree (status, approval_requested_at DESC)
    WHERE (status = 'pending'::text);
