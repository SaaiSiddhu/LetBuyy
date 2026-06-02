-- ============================================================================
-- Migration 065: Enterprise SDLC Lifecycle
-- Feature flag governance, rollout stage evidence, sandbox provider isolation,
-- and shadow traffic comparison persistence.
-- ============================================================================

CREATE TABLE IF NOT EXISTS operational_feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_key TEXT NOT NULL,
    environment TEXT NOT NULL CHECK (environment IN ('local', 'development', 'staging', 'production')),
    owner_runtime TEXT NOT NULL,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    kill_switch BOOLEAN NOT NULL DEFAULT FALSE,
    default_variant TEXT,
    rules JSONB NOT NULL DEFAULT '[]',
    rollout_policy JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'active', 'disabled', 'expired')),
    expires_at TIMESTAMPTZ,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (environment, flag_key)
);

CREATE INDEX IF NOT EXISTS idx_operational_feature_flags_runtime
    ON operational_feature_flags(environment, owner_runtime, status)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_operational_feature_flags_site
    ON operational_feature_flags(site_id, environment)
    WHERE deleted_at IS NULL AND site_id IS NOT NULL;

ALTER TABLE operational_feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operational_feature_flags_service_all ON operational_feature_flags;
CREATE POLICY operational_feature_flags_service_all
    ON operational_feature_flags FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS operational_feature_flag_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL UNIQUE,
    flag_key TEXT NOT NULL,
    environment TEXT NOT NULL CHECK (environment IN ('local', 'development', 'staging', 'production')),
    actor_id UUID,
    action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'approved', 'enabled', 'disabled', 'kill-switch', 'rolled-back', 'expired')),
    before_state JSONB NOT NULL DEFAULT '{}',
    after_state JSONB NOT NULL DEFAULT '{}',
    reason TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_operational_feature_flag_audit_events_flag
    ON operational_feature_flag_audit_events(environment, flag_key, recorded_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE operational_feature_flag_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operational_feature_flag_audit_events_service_all ON operational_feature_flag_audit_events;
CREATE POLICY operational_feature_flag_audit_events_service_all
    ON operational_feature_flag_audit_events FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS operational_feature_flag_exposures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exposure_id TEXT NOT NULL UNIQUE,
    flag_key TEXT NOT NULL,
    environment TEXT NOT NULL CHECK (environment IN ('local', 'development', 'staging', 'production')),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    actor_id UUID,
    region TEXT,
    enabled BOOLEAN NOT NULL,
    variant TEXT,
    reason TEXT NOT NULL,
    rule_id TEXT,
    bucket INTEGER CHECK (bucket IS NULL OR (bucket >= 0 AND bucket < 100)),
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_operational_feature_flag_exposures_flag
    ON operational_feature_flag_exposures(environment, flag_key, evaluated_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_operational_feature_flag_exposures_site
    ON operational_feature_flag_exposures(site_id, evaluated_at DESC)
    WHERE deleted_at IS NULL AND site_id IS NOT NULL;

ALTER TABLE operational_feature_flag_exposures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operational_feature_flag_exposures_service_all ON operational_feature_flag_exposures;
CREATE POLICY operational_feature_flag_exposures_service_all
    ON operational_feature_flag_exposures FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS rollout_stage_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id TEXT NOT NULL UNIQUE,
    promotion_id TEXT,
    runtime_root TEXT NOT NULL,
    environment TEXT NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
    strategy TEXT NOT NULL CHECK (strategy IN ('canary', 'blue-green', 'shadow', 'rollback')),
    rollout_percent INTEGER CHECK (rollout_percent IS NULL OR (rollout_percent >= 0 AND rollout_percent <= 100)),
    source_color TEXT CHECK (source_color IS NULL OR source_color IN ('blue', 'green')),
    target_color TEXT CHECK (target_color IS NULL OR target_color IN ('blue', 'green')),
    status TEXT NOT NULL CHECK (status IN ('planned', 'running', 'passed', 'failed', 'rolled-back', 'blocked')),
    gates JSONB NOT NULL DEFAULT '[]',
    score NUMERIC CHECK (score IS NULL OR (score >= 0 AND score <= 10)),
    evidence_url TEXT,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rollout_stage_evidence_runtime
    ON rollout_stage_evidence(environment, runtime_root, strategy, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE rollout_stage_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rollout_stage_evidence_service_all ON rollout_stage_evidence;
CREATE POLICY rollout_stage_evidence_service_all
    ON rollout_stage_evidence FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS shadow_traffic_comparison_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comparison_id TEXT NOT NULL UNIQUE,
    environment TEXT NOT NULL CHECK (environment IN ('staging', 'production')),
    runtime_root TEXT NOT NULL,
    source_version TEXT NOT NULL,
    shadow_version TEXT NOT NULL,
    mirrored_requests INTEGER NOT NULL DEFAULT 0,
    matched_responses INTEGER NOT NULL DEFAULT 0,
    mismatched_responses INTEGER NOT NULL DEFAULT 0,
    p95_latency_delta_ms INTEGER,
    side_effects_blocked BOOLEAN NOT NULL DEFAULT TRUE,
    status TEXT NOT NULL CHECK (status IN ('planned', 'running', 'passed', 'failed', 'aborted')),
    result JSONB NOT NULL DEFAULT '{}',
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shadow_traffic_comparison_runs_runtime
    ON shadow_traffic_comparison_runs(environment, runtime_root, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE shadow_traffic_comparison_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shadow_traffic_comparison_runs_service_all ON shadow_traffic_comparison_runs;
CREATE POLICY shadow_traffic_comparison_runs_service_all
    ON shadow_traffic_comparison_runs FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS sandbox_provider_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL CHECK (provider IN ('stripe', 'razorpay', 'paypal', 'email', 'sms', 'queue', 'search', 'storage')),
    environment TEXT NOT NULL CHECK (environment IN ('local', 'development', 'staging', 'production')),
    mode TEXT NOT NULL CHECK (mode IN ('mock', 'sandbox', 'live')),
    side_effect_policy TEXT NOT NULL CHECK (side_effect_policy IN ('none', 'sandbox-only', 'governed-live')),
    secret_scope TEXT NOT NULL CHECK (secret_scope IN ('local-template', 'development-secret-store', 'staging-secret-store', 'production-secret-store')),
    verification JSONB NOT NULL DEFAULT '{}',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (provider, environment)
);

ALTER TABLE sandbox_provider_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sandbox_provider_contracts_service_all ON sandbox_provider_contracts;
CREATE POLICY sandbox_provider_contracts_service_all
    ON sandbox_provider_contracts FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'operational_feature_flags',
        'operational_feature_flag_audit_events',
        'operational_feature_flag_exposures',
        'rollout_stage_evidence',
        'shadow_traffic_comparison_runs',
        'sandbox_provider_contracts'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'update_' || table_name || '_updated_at'
        ) THEN
            EXECUTE format(
                'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
                'update_' || table_name || '_updated_at',
                table_name
            );
        END IF;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION record_operational_feature_flag_exposure(
    p_exposure_id TEXT,
    p_flag_key TEXT,
    p_environment TEXT,
    p_enabled BOOLEAN,
    p_reason TEXT,
    p_site_id UUID DEFAULT NULL,
    p_actor_id UUID DEFAULT NULL,
    p_region TEXT DEFAULT NULL,
    p_variant TEXT DEFAULT NULL,
    p_rule_id TEXT DEFAULT NULL,
    p_bucket INTEGER DEFAULT NULL,
    p_actor_recorded_by UUID DEFAULT NULL
)
RETURNS operational_feature_flag_exposures
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    exposure operational_feature_flag_exposures%ROWTYPE;
BEGIN
    INSERT INTO operational_feature_flag_exposures (
        exposure_id,
        flag_key,
        environment,
        site_id,
        actor_id,
        region,
        enabled,
        variant,
        reason,
        rule_id,
        bucket,
        created_by,
        updated_by
    )
    VALUES (
        p_exposure_id,
        p_flag_key,
        p_environment,
        p_site_id,
        p_actor_id,
        p_region,
        p_enabled,
        p_variant,
        p_reason,
        p_rule_id,
        p_bucket,
        p_actor_recorded_by,
        p_actor_recorded_by
    )
    ON CONFLICT (exposure_id) DO UPDATE
       SET enabled = EXCLUDED.enabled,
           variant = EXCLUDED.variant,
           reason = EXCLUDED.reason,
           rule_id = EXCLUDED.rule_id,
           bucket = EXCLUDED.bucket,
           evaluated_at = NOW(),
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()
    RETURNING * INTO exposure;

    RETURN exposure;
END;
$$;

CREATE OR REPLACE FUNCTION record_rollout_stage_evidence(
    p_stage_id TEXT,
    p_runtime_root TEXT,
    p_environment TEXT,
    p_strategy TEXT,
    p_status TEXT,
    p_gates JSONB DEFAULT '[]',
    p_score NUMERIC DEFAULT NULL,
    p_rollout_percent INTEGER DEFAULT NULL,
    p_promotion_id TEXT DEFAULT NULL,
    p_source_color TEXT DEFAULT NULL,
    p_target_color TEXT DEFAULT NULL,
    p_evidence_url TEXT DEFAULT NULL,
    p_actor_id UUID DEFAULT NULL
)
RETURNS rollout_stage_evidence
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    stage rollout_stage_evidence%ROWTYPE;
BEGIN
    INSERT INTO rollout_stage_evidence (
        stage_id,
        promotion_id,
        runtime_root,
        environment,
        strategy,
        rollout_percent,
        source_color,
        target_color,
        status,
        gates,
        score,
        evidence_url,
        started_at,
        finished_at,
        created_by,
        updated_by
    )
    VALUES (
        p_stage_id,
        p_promotion_id,
        p_runtime_root,
        p_environment,
        p_strategy,
        p_rollout_percent,
        p_source_color,
        p_target_color,
        p_status,
        COALESCE(p_gates, '[]'),
        p_score,
        p_evidence_url,
        CASE WHEN p_status IN ('running', 'passed', 'failed', 'rolled-back', 'blocked') THEN NOW() ELSE NULL END,
        CASE WHEN p_status IN ('passed', 'failed', 'rolled-back', 'blocked') THEN NOW() ELSE NULL END,
        p_actor_id,
        p_actor_id
    )
    ON CONFLICT (stage_id) DO UPDATE
       SET status = EXCLUDED.status,
           gates = EXCLUDED.gates,
           score = EXCLUDED.score,
           evidence_url = EXCLUDED.evidence_url,
           finished_at = EXCLUDED.finished_at,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()
    RETURNING * INTO stage;

    RETURN stage;
END;
$$;
