-- DS-5: custom-domain ownership + storefront access controls.
-- Additive only. Runtime writes are owned by services/api-gateway.

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS custom_domain_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS custom_domain_verification_token text,
  ADD COLUMN IF NOT EXISTS access_mode text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS access_password_hash text,
  ADD COLUMN IF NOT EXISTS access_message text,
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false;

ALTER TABLE public.sites
  DROP CONSTRAINT IF EXISTS sites_custom_domain_status_check,
  ADD CONSTRAINT sites_custom_domain_status_check
    CHECK (custom_domain_status = ANY (ARRAY['none'::text, 'pending'::text, 'review'::text, 'verifying'::text, 'active'::text, 'error'::text]));

ALTER TABLE public.sites
  DROP CONSTRAINT IF EXISTS sites_access_mode_check,
  ADD CONSTRAINT sites_access_mode_check
    CHECK (access_mode = ANY (ARRAY['public'::text, 'password'::text, 'preview_only'::text, 'offline'::text]));

CREATE UNIQUE INDEX IF NOT EXISTS sites_custom_domain_unique
  ON public.sites (lower(custom_domain))
  WHERE custom_domain IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sites_custom_domain_status
  ON public.sites (custom_domain_status)
  WHERE custom_domain_status <> 'none';

CREATE INDEX IF NOT EXISTS idx_sites_access_mode
  ON public.sites (access_mode)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sites_published
  ON public.sites (published)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.site_preview_links (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  jti text NOT NULL,
  scope text NOT NULL,
  theme_id text,
  created_by uuid,
  expires_at timestamp with time zone NOT NULL,
  revoked_at timestamp with time zone,
  last_used_at timestamp with time zone,
  hit_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT site_preview_links_pkey PRIMARY KEY (id),
  CONSTRAINT site_preview_links_jti_key UNIQUE (jti),
  CONSTRAINT site_preview_links_scope_check CHECK (scope = ANY (ARRAY['merchant-preview'::text, 'share-link'::text]))
);

CREATE INDEX IF NOT EXISTS idx_site_preview_links_site_id
  ON public.site_preview_links (site_id, expires_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_site_preview_links_active
  ON public.site_preview_links (site_id, jti)
  WHERE revoked_at IS NULL AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_site_preview_links_updated_at ON public.site_preview_links;
CREATE TRIGGER update_site_preview_links_updated_at
  BEFORE UPDATE ON public.site_preview_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.site_preview_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_preview_links service role only" ON public.site_preview_links;
CREATE POLICY "site_preview_links service role only"
  ON public.site_preview_links
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.site_gate_attempts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  ip inet,
  host text NOT NULL,
  ts timestamp with time zone NOT NULL DEFAULT now(),
  ok boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT site_gate_attempts_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_site_gate_attempts_rate
  ON public.site_gate_attempts (site_id, host, ip, ts DESC);

CREATE INDEX IF NOT EXISTS idx_site_gate_attempts_site_ts
  ON public.site_gate_attempts (site_id, ts DESC);

DROP TRIGGER IF EXISTS update_site_gate_attempts_updated_at ON public.site_gate_attempts;
CREATE TRIGGER update_site_gate_attempts_updated_at
  BEFORE UPDATE ON public.site_gate_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.site_gate_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_gate_attempts service role only" ON public.site_gate_attempts;
CREATE POLICY "site_gate_attempts service role only"
  ON public.site_gate_attempts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.site_domain_reviews (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  domain text NOT NULL,
  risk_tier text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  provider_evidence jsonb,
  decision_notes text,
  decided_at timestamp with time zone,
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT site_domain_reviews_pkey PRIMARY KEY (id),
  CONSTRAINT site_domain_reviews_risk_tier_check CHECK (risk_tier = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])),
  CONSTRAINT site_domain_reviews_status_check CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text, 'rejected'::text]))
);

CREATE INDEX IF NOT EXISTS idx_site_domain_reviews_site
  ON public.site_domain_reviews (site_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_site_domain_reviews_status
  ON public.site_domain_reviews (status, risk_tier, created_at DESC)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_site_domain_reviews_updated_at ON public.site_domain_reviews;
CREATE TRIGGER update_site_domain_reviews_updated_at
  BEFORE UPDATE ON public.site_domain_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.site_domain_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_domain_reviews service role only" ON public.site_domain_reviews;
CREATE POLICY "site_domain_reviews service role only"
  ON public.site_domain_reviews
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.domain_orders (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  domain text NOT NULL,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'created',
  years integer NOT NULL DEFAULT 1,
  currency text NOT NULL DEFAULT 'INR',
  amount_minor integer NOT NULL DEFAULT 0,
  payment_provider text NOT NULL DEFAULT 'razorpay',
  payment_reference text NOT NULL,
  registrar_order_id text,
  registrar_payload jsonb,
  dns_payload jsonb,
  vercel_payload jsonb,
  failure_reason text,
  idempotency_key text NOT NULL,
  completed_at timestamp with time zone,
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT domain_orders_pkey PRIMARY KEY (id),
  CONSTRAINT domain_orders_idempotency_key UNIQUE (idempotency_key),
  CONSTRAINT domain_orders_provider_check CHECK (provider = ANY (ARRAY['resellerclub'::text, 'opensrs'::text, 'mock'::text])),
  CONSTRAINT domain_orders_status_check CHECK (status = ANY (ARRAY['created'::text, 'registering'::text, 'provisioning'::text, 'active'::text, 'failed'::text]))
);

CREATE INDEX IF NOT EXISTS idx_domain_orders_site
  ON public.domain_orders (site_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_domain_orders_domain
  ON public.domain_orders (lower(domain))
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_domain_orders_updated_at ON public.domain_orders;
CREATE TRIGGER update_domain_orders_updated_at
  BEFORE UPDATE ON public.domain_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.domain_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "domain_orders service role only" ON public.domain_orders;
CREATE POLICY "domain_orders service role only"
  ON public.domain_orders
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
