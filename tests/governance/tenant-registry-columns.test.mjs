import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { deriveTenantTablesFromMigrations } from '../../scripts/governance/tenant-registry-common.mjs';

const derive = source => deriveTenantTablesFromMigrations([{ file: '001_columns.sql', source }]);
const scopes = source => derive(source).map(({ table, scopeColumns, tenantColumn, ownerColumns }) => ({ table, scopeColumns, tenantColumn, ownerColumns }));

test('schema discovery preserves spaces, percent signs, fragments and Unicode in checkout paths', async () => {
    const temporary = mkdtempSync(path.join(tmpdir(), 'tenant-registry-path-'));
    try {
        const fixture = path.join(temporary, 'Developer Tools #100% தமிழ்');
        const scripts = path.join(fixture, 'scripts/governance');
        const migrations = path.join(fixture, 'database/supabase/migrations');
        mkdirSync(scripts, { recursive: true });
        mkdirSync(migrations, { recursive: true });
        writeFileSync(path.join(migrations, '001_fixture.sql'), 'CREATE TABLE public.path_probe (id uuid, site_id uuid); CREATE TABLE public.unscoped (id uuid);');
        writeFileSync(path.join(migrations, '002_fixture.sql'), 'ALTER TABLE public.path_probe ADD COLUMN owner_id uuid;');
        const source = readFileSync(new URL('../../scripts/governance/tenant-registry-common.mjs', import.meta.url), 'utf8');
        const modulePath = path.join(scripts, 'tenant-registry-common.mjs');
        writeFileSync(modulePath, source);
        const actual = await import(pathToFileURL(modulePath).href);
        assert.equal(actual.root, fixture);
        assert.deepEqual(actual.deriveTenantTablesFromMigrations().map(({ table, scopeColumns }) => ({ table, scopeColumns })), [{ table: 'path_probe', scopeColumns: ['site_id', 'owner_id'] }]);
        // Reproducing the original URL-path bug must fail on these same files.
        const mutantPath = path.join(scripts, 'encoded-path-mutant.mjs');
        const mutant = source.replace('fileURLToPath(import.meta.url)', 'new URL(import.meta.url).pathname');
        assert.notEqual(mutant, source);
        writeFileSync(mutantPath, mutant);
        const broken = await import(pathToFileURL(mutantPath).href);
        assert.throws(() => broken.deriveTenantTablesFromMigrations(), { code: 'ENOENT' });
    } finally {
        rmSync(temporary, { recursive: true, force: true });
    }
});

test('same-line columns preserve every established tenant and owner predicate', () => {
    assert.deepEqual(scopes('CREATE TABLE public.example (id uuid, site_id uuid, store_id uuid, user_id uuid, owner_id uuid, buyer_account_id uuid);'), [{
        table: 'example', scopeColumns: ['site_id', 'store_id', 'buyer_account_id', 'owner_id', 'user_id'], tenantColumn: 'site_id', ownerColumns: ['buyer_account_id', 'owner_id', 'user_id'],
    }]);
});

test('formatting changes do not change ownership for nested expressions, type modifiers and array defaults', () => {
    const columns = ["id uuid", "amount numeric(18, 6) DEFAULT round(1.234, 2)", "labels text[] DEFAULT ARRAY['a,b', 'c']", "metadata jsonb DEFAULT jsonb_build_object('x,y', jsonb_build_array(1, 2))", "site_id uuid", "store_id uuid", "owner_id uuid", "CONSTRAINT valid CHECK ((amount IN (1, 2)) OR (metadata->>'site_id' = 'not a column'))", "FOREIGN KEY (site_id, owner_id) REFERENCES public.other(site_id, owner_id)"];
    const compact = `CREATE TABLE public.example (${columns.join(', ')});`;
    const multiline = `CREATE TABLE public.example (\n${columns.join(',\n')}\n);`;
    assert.deepEqual(scopes(compact), scopes(multiline));
    assert.deepEqual(derive(compact)[0].scopeColumns, ['site_id', 'store_id', 'owner_id']);
});

test('literals, escaped quotes and comments cannot invent columns or DDL', () => {
    assert.deepEqual(derive(`CREATE TABLE public.no_scope (
        id uuid, note text DEFAULT 'text, site_id uuid, buyer_account_id uuid -- /* comment */',
        escaped text DEFAULT E'can\\'t, store_id uuid',
        quoted text DEFAULT $literal$), site_id uuid); CREATE TABLE public.fake (buyer_account_id uuid);$literal$,
        CHECK (note <> 'ALTER TABLE public.no_scope ADD COLUMN site_id uuid;'),
        CONSTRAINT site_id CHECK (id IS NOT NULL), FOREIGN KEY (id) REFERENCES public.other(site_id),
        /* nested /* site_id uuid, */ buyer_account_id uuid */
        -- site_id uuid,
        tail text
    ); SELECT 'CREATE TABLE public.phantom (site_id uuid);';`), []);
});

test('comment markers in actual strings do not swallow later real columns', () => {
    assert.deepEqual(derive(`CREATE TABLE public.example (id uuid, note text DEFAULT '-- not a comment /* either */', /* gap */ site_id uuid, owner_id uuid);`)[0].scopeColumns, ['site_id', 'owner_id']);
});

test('quoted identifiers preserve PostgreSQL case and escaped identifier contents', () => {
    assert.deepEqual(scopes('CREATE TABLE "public"."quoted" ("odd""column,comma" text, "site_id" uuid, "owner_id" uuid);'), [{ table: 'quoted', scopeColumns: ['site_id', 'owner_id'], tenantColumn: 'site_id', ownerColumns: ['owner_id'] }]);
    assert.deepEqual(derive('CREATE TABLE public.upper_unquoted (ID uuid, SITE_ID uuid);')[0].scopeColumns, ['site_id']);
    assert.deepEqual(derive('CREATE TABLE public.upper_quoted (id uuid, "SITE_ID" uuid);'), [], 'a quoted uppercase identifier is not the lowercase site_id column');
    assert.equal(derive('CREATE TABLE public."escaped""table" (id uuid, site_id uuid);')[0].table, 'escaped"table');
});

test('table constraints and defaults never become ownership columns', () => {
    assert.deepEqual(derive(`CREATE TABLE public.constraints_only (id uuid, caption text DEFAULT 'site_id uuid', PRIMARY KEY(id), UNIQUE(id), FOREIGN KEY(id) REFERENCES public.other(site_id), CHECK(id IS NOT NULL), EXCLUDE USING gist(id WITH =), LIKE public.other INCLUDING ALL);`), []);
});

test('owner-only registration policy remains narrow and unchanged', () => {
    assert.deepEqual(derive('CREATE TABLE public.platform_only (id uuid, user_id uuid, owner_id uuid, developer_id uuid, partner_id uuid, requester_user_id uuid);'), []);
    assert.deepEqual(scopes('CREATE TABLE public.buyer_only (id uuid, buyer_account_id uuid, requester_user_id uuid);'), [{ table: 'buyer_only', scopeColumns: ['buyer_account_id', 'requester_user_id'], tenantColumn: null, ownerColumns: ['buyer_account_id', 'requester_user_id'] }]);
});

test('same-line ALTER additions carry only declared columns, including quoted and nested defaults', () => {
    assert.deepEqual(derive(`CREATE TABLE public.example (id uuid); ALTER TABLE public.example ADD COLUMN note text DEFAULT 'ADD COLUMN buyer_account_id uuid', ADD COLUMN site_id uuid, ADD COLUMN "owner_id" uuid;`)[0].scopeColumns, ['site_id', 'owner_id']);
});

test('quoted fake partition declarations cannot invent inherited tables', () => {
    assert.deepEqual(derive("SELECT 'CREATE TABLE public.fake PARTITION OF public.missing_parent DEFAULT;';"), []);
});

test('unclosed column syntax is refused instead of certifying an incomplete registry', () => {
    assert.throws(() => derive('CREATE TABLE public.example (id uuid, site_id uuid;'), /unterminated|unclosed|unbalanced/i);
    assert.throws(() => derive("CREATE TABLE public.example (id uuid, note text DEFAULT 'unterminated, site_id uuid);"), /unterminated|unclosed/i);
    assert.throws(() => derive('CREATE TABLE public.example (id uuid, /* unterminated site_id uuid);'), /unterminated|unclosed/i);
});

// Exact frozen future345 SQL is regression data only, never an applied migration.
const FUTURE_345_SQL = String.raw`-- N5-PERSIST-01. Private canonical revision authority only; no upload/player/provider activation.
-- Ready/inspection evidence has NO application writer. A future verified custody owner
-- needs a separately reviewed narrow writer; fixtures must never become production evidence.
BEGIN;
CREATE TABLE public.reel_asset_provenance (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), site_id uuid NOT NULL REFERENCES public.sites(id),
 media_asset_id uuid NOT NULL REFERENCES public.media_assets(id), asset_version text NOT NULL,
 checksum_sha256 text NOT NULL CHECK(checksum_sha256 ~ '^[a-f0-9]{64}$'),
 kind text NOT NULL CHECK(kind IN('video','image','rights')), provider_asset_id text,
 custody_verified_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, created_by uuid, updated_by uuid,
 CHECK(asset_version ~ '^[A-Za-z0-9._:-]{1,200}$'),
 CHECK(provider_asset_id IS NULL OR provider_asset_id ~ '^[A-Za-z0-9_-]{1,200}$'),
 UNIQUE(site_id,media_asset_id,asset_version)
);
CREATE TABLE public.reel_processing_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),site_id uuid NOT NULL REFERENCES public.sites(id),
 provenance_id uuid NOT NULL REFERENCES public.reel_asset_provenance(id),
 provider_asset_id text NOT NULL,provider_event_id text NOT NULL,
 checksum_sha256 text NOT NULL CHECK(checksum_sha256 ~ '^[a-f0-9]{64}$'),
 media_version text NOT NULL,state text NOT NULL CHECK(state='ready'),
 verified_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),deleted_at timestamptz,created_by uuid,updated_by uuid,
 UNIQUE(site_id,provider_event_id)
);
CREATE TABLE public.commerce_reels (
 id uuid PRIMARY KEY,site_id uuid NOT NULL REFERENCES public.sites(id),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','pending_review','approved','rejected','delisted')),
 version integer NOT NULL DEFAULT 0 CHECK(version>=0),current_revision_id uuid,assigned_reviewer_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz,created_by uuid NOT NULL,updated_by uuid NOT NULL
);
CREATE TABLE public.commerce_reel_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),site_id uuid NOT NULL REFERENCES public.sites(id),
 reel_id uuid NOT NULL REFERENCES public.commerce_reels(id),version integer NOT NULL CHECK(version>0),
 selection jsonb NOT NULL,payload jsonb,canonical_payload text,fingerprint text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz,created_by uuid NOT NULL,updated_by uuid NOT NULL,
 UNIQUE(reel_id,version),CHECK((payload IS NULL)=(fingerprint IS NULL)),
 CHECK(fingerprint IS NULL OR fingerprint=encode(sha256(convert_to(canonical_payload,'UTF8')),'hex'))
);
ALTER TABLE public.commerce_reels ADD CONSTRAINT commerce_reels_revision_fk
 FOREIGN KEY(current_revision_id) REFERENCES public.commerce_reel_revisions(id);
CREATE TABLE public.commerce_reel_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),site_id uuid NOT NULL REFERENCES public.sites(id),
 reel_id uuid NOT NULL REFERENCES public.commerce_reels(id),revision_id uuid REFERENCES public.commerce_reel_revisions(id),
 actor_id uuid NOT NULL,actor_realm text NOT NULL,action text NOT NULL,reason text,
 request_key text NOT NULL,command_hash text NOT NULL,result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz,created_by uuid NOT NULL,updated_by uuid NOT NULL,
 UNIQUE(site_id,actor_id,request_key)
);
CREATE TABLE public.reel_review_inspections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),site_id uuid NOT NULL REFERENCES public.sites(id),
 revision_id uuid NOT NULL REFERENCES public.commerce_reel_revisions(id),reviewer_id uuid NOT NULL,
 processing_receipt_id uuid NOT NULL REFERENCES public.reel_processing_receipts(id),
 rights_policy_version text NOT NULL CHECK(length(rights_policy_version)>0),
 inspected_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz,created_by uuid,updated_by uuid,CHECK(expires_at>inspected_at)
);
CREATE FUNCTION public.protect_reel_record_v1() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'REEL_IMMUTABLE_RECORD'; END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['reel_asset_provenance','reel_processing_receipts','commerce_reels','commerce_reel_revisions','commerce_reel_events','reel_review_inspections'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_read ON public.%I FOR SELECT TO app_tenant USING(site_id=public.current_site_id())',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,app_tenant,service_role',t);
  -- service_role inherits app_tenant (164) and bypasses RLS. A read grant to
  -- app_tenant would therefore reopen raw cross-site reads for service_role.
  -- Both roles use the narrow authenticated RPC instead; raw tables stay closed.
  EXECUTE format('CREATE INDEX %I ON public.%I(site_id,created_at,id)',t||'_site_page_idx',t);
  IF t<>'commerce_reels' THEN
   EXECUTE format('CREATE TRIGGER immutable_record BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.protect_reel_record_v1()',t);
  END IF;
 END LOOP;
END $$;

-- Compact ordered JSON, matching the existing CMS builder, not a product-fingerprint reimplementation.
CREATE FUNCTION public.reel_json_compact_v1(p_value json) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
 SELECT CASE json_typeof(p_value)
 WHEN 'object' THEN '{'||coalesce((SELECT string_agg(to_json(key)::text||':'||public.reel_json_compact_v1(value),',' ORDER BY n) FROM json_each(p_value) WITH ORDINALITY x(key,value,n)),'')||'}'
 WHEN 'array' THEN '['||coalesce((SELECT string_agg(public.reel_json_compact_v1(value),',' ORDER BY n) FROM json_array_elements(p_value) WITH ORDINALITY x(value,n)),'')||']'
 ELSE p_value::text END
$$;

-- Actor comes only from verified Gateway identity/Console credentials. Live DB custody
-- and grants are rechecked under locks before reads, writes AND idempotent replays.
CREATE FUNCTION public.reel_actor_v1(p_actor uuid,p_site uuid,p_console jsonb,p_write boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s public.sites;e public.employees;v jsonb;a uuid;
BEGIN
 IF p_console IS NOT NULL THEN
  v:=public.console_permission_snapshot_v1((p_console->>'session_id')::uuid,p_console->>'cookie_sha256',p_write);
  IF NOT coalesce((v->>'accepted')::boolean,false) OR v->>'evidence_hash' IS DISTINCT FROM p_console->>'permission_hash' THEN RAISE EXCEPTION 'REEL_OPERATOR_REQUIRED'; END IF;
  a:=(v->'session'->>'actor_id')::uuid;
  IF a IS NULL OR (p_write AND NOT(coalesce((v->'input'->>'isSuperAdmin')::boolean,false) OR coalesce(v->'input'->>'role' IN('operations','manager','admin'),false))) THEN RAISE EXCEPTION 'REEL_OPERATOR_REQUIRED'; END IF;
  RETURN a;
 END IF;
 IF p_actor IS NULL OR p_site IS NULL OR (nullif(current_setting('app.site_id',true),'') IS NOT NULL AND public.current_site_id() IS DISTINCT FROM p_site) THEN RAISE EXCEPTION 'REEL_MERCHANT_REQUIRED'; END IF;
 SELECT * INTO s FROM public.sites WHERE id=p_site AND deleted_at IS NULL FOR SHARE;
 IF s.id IS NULL THEN RAISE EXCEPTION 'REEL_MERCHANT_REQUIRED'; END IF;
 PERFORM 1 FROM public.users_custom WHERE id=p_actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'REEL_MERCHANT_REQUIRED'; END IF;
 IF s.custom_user_id=p_actor OR s.user_id=p_actor THEN RETURN p_actor; END IF;
 SELECT * INTO e FROM public.employees WHERE store_id=p_site AND user_id=p_actor AND status='active' AND is_active AND deleted_at IS NULL FOR SHARE;
 -- Same content:write matching as canonical evaluateStaffPermission: exact, content:*, or *.
 IF e.id IS NULL OR jsonb_typeof(e.permissions->'granted') IS DISTINCT FROM 'array'
  OR NOT coalesce((e.permissions->'granted') ?| ARRAY['content:write','content:*','*'],false) THEN RAISE EXCEPTION 'REEL_MERCHANT_REQUIRED'; END IF;
 RETURN p_actor;
END $$;

CREATE FUNCTION public.reel_payload_v1(p_site uuid,p_selection jsonb) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE m public.reel_asset_provenance;t public.reel_asset_provenance;r public.reel_processing_receipts;
 l public.channel_listings;p public.products;s public.sites;f text;rights json;v_id uuid;
BEGIN
 SELECT * INTO l FROM public.channel_listings WHERE id=(p_selection->>'listing_id')::uuid;
 SELECT * INTO p FROM public.products WHERE id=l.product_id FOR SHARE;
 SELECT * INTO s FROM public.sites WHERE id=p_site FOR SHARE;
 SELECT * INTO l FROM public.channel_listings WHERE id=l.id FOR SHARE;
 PERFORM 1 FROM public.product_variants WHERE product_id=p.id ORDER BY id FOR SHARE;
 IF l.id IS NULL OR l.site_id IS DISTINCT FROM p_site OR p.site_id IS DISTINCT FROM p_site OR l.product_id IS DISTINCT FROM p.id
  OR l.channel IS DISTINCT FROM 'marketplace' OR l.status IS DISTINCT FROM 'approved' OR l.visibility IS DISTINCT FROM 'public' OR p.is_active IS DISTINCT FROM true OR p.deleted_at IS NOT NULL OR s.status IS DISTINCT FROM 'published' OR s.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'REEL_LISTING_UNAVAILABLE'; END IF;
 f:=public.marketplace_listing_review_fingerprint(l.id);
 IF f IS NULL OR f IS DISTINCT FROM l.approved_product_fingerprint THEN RAISE EXCEPTION 'REEL_PRODUCT_REVISION_STALE'; END IF;
 v_id:=(p_selection->>'variant_id')::uuid;
 IF (v_id IS NULL AND EXISTS(SELECT 1 FROM public.product_variants WHERE product_id=p.id)) OR
  (v_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.product_variants WHERE id=v_id AND product_id=p.id)) THEN RAISE EXCEPTION 'REEL_VARIANT_MISMATCH'; END IF;
 PERFORM 1 FROM public.media_assets WHERE id IN((p_selection->>'media_asset_id')::uuid,(p_selection->>'thumbnail_asset_id')::uuid) AND site_id=p_site ORDER BY id FOR SHARE;
 SELECT a.* INTO m FROM public.reel_asset_provenance a JOIN public.media_assets x ON x.id=a.media_asset_id AND x.site_id=a.site_id
  WHERE a.media_asset_id=(p_selection->>'media_asset_id')::uuid AND a.site_id=p_site AND a.kind='video' AND a.deleted_at IS NULL AND x.deleted_at IS NULL
  AND a.custody_verified_at<=clock_timestamp() AND x.asset_type='video' AND x.public_url IS NULL AND x.checksum_sha256=a.checksum_sha256 ORDER BY a.custody_verified_at DESC,a.id LIMIT 1 FOR SHARE OF a,x;
 SELECT a.* INTO t FROM public.reel_asset_provenance a JOIN public.media_assets x ON x.id=a.media_asset_id AND x.site_id=a.site_id
  WHERE a.media_asset_id=(p_selection->>'thumbnail_asset_id')::uuid AND a.site_id=p_site AND a.kind='image' AND a.deleted_at IS NULL AND x.deleted_at IS NULL
  AND a.custody_verified_at<=clock_timestamp() AND x.asset_type='image' AND x.public_url IS NULL AND x.checksum_sha256=a.checksum_sha256 ORDER BY a.custody_verified_at DESC,a.id LIMIT 1 FOR SHARE OF a,x;
 SELECT * INTO r FROM public.reel_processing_receipts WHERE provenance_id=m.id AND site_id=p_site AND state='ready' AND deleted_at IS NULL
  AND verified_at<=clock_timestamp() AND media_version=m.asset_version AND checksum_sha256=m.checksum_sha256 AND provider_asset_id=m.provider_asset_id ORDER BY verified_at DESC,id LIMIT 1 FOR SHARE;
 IF m.id IS NULL OR t.id IS NULL OR r.id IS NULL OR m.provider_asset_id IS NULL THEN RAISE EXCEPTION 'REEL_CUSTODY_UNAVAILABLE'; END IF;
 PERFORM 1 FROM public.reel_asset_provenance a JOIN public.media_assets x ON x.id=a.media_asset_id JOIN jsonb_array_elements_text(p_selection->'rights_evidence_ids') v ON a.id=v.value::uuid ORDER BY a.id FOR SHARE OF a,x;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_selection->'rights_evidence_ids') v LEFT JOIN public.reel_asset_provenance a
  ON a.id=v.value::uuid AND a.site_id=p_site AND a.kind='rights' AND a.deleted_at IS NULL AND a.custody_verified_at<=clock_timestamp()
  LEFT JOIN public.media_assets x ON x.id=a.media_asset_id AND x.site_id=p_site AND x.deleted_at IS NULL AND x.public_url IS NULL AND x.checksum_sha256=a.checksum_sha256
  WHERE a.id IS NULL OR x.id IS NULL) THEN RAISE EXCEPTION 'REEL_RIGHTS_EVIDENCE_UNAVAILABLE'; END IF;
 SELECT coalesce(json_agg(json_build_object('evidence_id',a.id,'version',a.asset_version,'checksum_sha256',a.checksum_sha256) ORDER BY a.id),'[]'::json) INTO rights
 FROM public.reel_asset_provenance a JOIN jsonb_array_elements_text(p_selection->'rights_evidence_ids') v ON a.id=v.value::uuid;
 RETURN public.reel_json_compact_v1(json_build_object('schema_version',1,'site_id',p_site,
  'media',json_build_object('asset_id',m.media_asset_id,'version',m.asset_version,'checksum_sha256',m.checksum_sha256,'processing_evidence_id',r.id,'provider_asset_id',r.provider_asset_id),
  'product',json_build_object('listing_id',l.id,'product_id',p.id,'variant_id',v_id,'approved_product_fingerprint',f),
  'caption',p_selection->>'caption','thumbnail',json_build_object('asset_id',t.media_asset_id,'version',t.asset_version,'checksum_sha256',t.checksum_sha256),'rights_evidence',rights));
END $$;

CREATE FUNCTION public.mutate_reel_review_v1(p_actor uuid,p_site uuid,p_reel uuid,p_command jsonb,p_console jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a uuid;h text;k text;act text;rr public.commerce_reels;rev public.commerce_reel_revisions;ev public.commerce_reel_events;
 selection jsonb;canonical text;result jsonb;ins public.reel_review_inspections;reason text;
BEGIN
 IF p_reel IS NULL OR p_site IS NULL OR p_command IS NULL OR jsonb_typeof(p_command)<>'object' OR octet_length(p_command::text)>32768
  OR p_command-ARRAY['action','expected_version','idempotency_key','selection','reason']<>'{}' THEN RAISE EXCEPTION 'REEL_REQUEST_INVALID'; END IF;
 act:=p_command->>'action';k:=p_command->>'idempotency_key';reason:=p_command->>'reason';
 IF act IS NULL OR act NOT IN('save','submit','claim','reject','approve','take_down') OR k IS NULL OR length(k) NOT BETWEEN 8 AND 200
  OR k<>btrim(k) OR k~'[[:cntrl:]]' OR coalesce(p_command->>'expected_version','')!~'^[0-9]{1,9}$' THEN RAISE EXCEPTION 'REEL_REQUEST_INVALID'; END IF;
 IF (p_console IS NULL AND act NOT IN('save','submit')) OR(p_console IS NOT NULL AND act IN('save','submit')) THEN RAISE EXCEPTION 'REEL_REALM_DENIED'; END IF;
 a:=public.reel_actor_v1(p_actor,p_site,p_console,true);
 PERFORM pg_advisory_xact_lock(hashtextextended('reel:'||p_reel::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('reel-key:'||p_site::text||a::text||k,0));
 h:=encode(sha256(convert_to(jsonb_build_object('reel',p_reel,'command',p_command)::text,'UTF8')),'hex');
 SELECT * INTO ev FROM public.commerce_reel_events WHERE site_id=p_site AND actor_id=a AND request_key=k;
 IF FOUND THEN IF ev.command_hash<>h THEN RAISE EXCEPTION 'REEL_IDEMPOTENCY_CONFLICT'; END IF;RETURN ev.result||jsonb_build_object('replayed',true);END IF;
 SELECT * INTO rr FROM public.commerce_reels WHERE id=p_reel FOR UPDATE;
 IF rr.id IS NOT NULL AND(rr.site_id<>p_site OR rr.deleted_at IS NOT NULL) THEN RAISE EXCEPTION 'REEL_NOT_FOUND'; END IF;
 IF coalesce(rr.version,0)<>(p_command->>'expected_version')::integer THEN RAISE EXCEPTION 'REEL_VERSION_CONFLICT'; END IF;
 IF act IN('save','submit') THEN
  IF rr.id IS NOT NULL AND rr.status NOT IN('draft','rejected','pending_review','approved') THEN RAISE EXCEPTION 'REEL_STATE_CONFLICT'; END IF;
  selection:=p_command->'selection';
  IF selection IS NULL OR jsonb_typeof(selection)<>'object' OR selection-ARRAY['media_asset_id','listing_id','variant_id','thumbnail_asset_id','caption','rights_evidence_ids']<>'{}'
   OR NOT(selection ?& ARRAY['media_asset_id','listing_id','variant_id','thumbnail_asset_id','caption','rights_evidence_ids'])
   OR jsonb_typeof(selection->'caption') IS DISTINCT FROM 'string' OR length(selection->>'caption')>4000
   OR jsonb_typeof(selection->'rights_evidence_ids') IS DISTINCT FROM 'array' OR jsonb_array_length(selection->'rights_evidence_ids')>20 THEN RAISE EXCEPTION 'REEL_REQUEST_INVALID'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements_text(selection->'rights_evidence_ids'))<>(SELECT count(DISTINCT value::uuid) FROM jsonb_array_elements_text(selection->'rights_evidence_ids')) THEN RAISE EXCEPTION 'REEL_REQUEST_INVALID'; END IF;
  IF selection->>'listing_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.channel_listings WHERE id=(selection->>'listing_id')::uuid AND site_id=p_site) THEN RAISE EXCEPTION 'REEL_LISTING_UNAVAILABLE'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(ARRAY[(selection->>'media_asset_id')::uuid,(selection->>'thumbnail_asset_id')::uuid])v(id)
   WHERE v.id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.media_assets WHERE id=v.id AND site_id=p_site AND deleted_at IS NULL)) THEN RAISE EXCEPTION 'REEL_CUSTODY_UNAVAILABLE'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(selection->'rights_evidence_ids')v WHERE NOT EXISTS(SELECT 1 FROM public.reel_asset_provenance WHERE id=v.value::uuid AND site_id=p_site AND kind='rights' AND deleted_at IS NULL)) THEN RAISE EXCEPTION 'REEL_RIGHTS_EVIDENCE_UNAVAILABLE'; END IF;
  IF act='submit' THEN canonical:=public.reel_payload_v1(p_site,selection); END IF;
  IF rr.id IS NULL THEN INSERT INTO public.commerce_reels(id,site_id,created_by,updated_by) VALUES(p_reel,p_site,a,a) RETURNING * INTO rr; END IF;
  INSERT INTO public.commerce_reel_revisions(site_id,reel_id,version,selection,payload,canonical_payload,fingerprint,created_by,updated_by)
  VALUES(p_site,p_reel,rr.version+1,selection,canonical::jsonb,canonical,CASE WHEN canonical IS NULL THEN NULL ELSE encode(sha256(convert_to(canonical,'UTF8')),'hex') END,a,a) RETURNING * INTO rev;
  UPDATE public.commerce_reels SET version=version+1,current_revision_id=rev.id,status=CASE WHEN act='submit' THEN 'pending_review' ELSE 'draft' END,
   assigned_reviewer_id=NULL,updated_at=clock_timestamp(),updated_by=a WHERE id=p_reel RETURNING * INTO rr;
 ELSE
  IF rr.id IS NULL THEN RAISE EXCEPTION 'REEL_NOT_FOUND'; END IF;
  SELECT * INTO rev FROM public.commerce_reel_revisions WHERE id=rr.current_revision_id AND site_id=p_site FOR SHARE;
  IF rr.created_by=a OR rev.created_by=a OR EXISTS(SELECT 1 FROM public.sites WHERE id=p_site AND(a=custom_user_id OR a=user_id)) THEN RAISE EXCEPTION 'REEL_SELF_REVIEW_DENIED'; END IF;
  IF act='claim' THEN
   IF rr.status<>'pending_review' OR(rr.assigned_reviewer_id IS NOT NULL AND rr.assigned_reviewer_id<>a) THEN RAISE EXCEPTION 'REEL_ASSIGNMENT_REQUIRED'; END IF;
   UPDATE public.commerce_reels SET assigned_reviewer_id=a WHERE id=p_reel;
  ELSE
   IF rr.assigned_reviewer_id IS DISTINCT FROM a OR(act<>'take_down' AND rr.status<>'pending_review') THEN RAISE EXCEPTION 'REEL_ASSIGNMENT_REQUIRED'; END IF;
   IF act IN('reject','take_down') AND(length(coalesce(reason,'')) NOT BETWEEN 8 AND 1000) THEN RAISE EXCEPTION 'REEL_REASON_REQUIRED'; END IF;
   IF act='approve' THEN
    canonical:=public.reel_payload_v1(p_site,rev.selection);
    IF canonical IS DISTINCT FROM rev.canonical_payload THEN RAISE EXCEPTION 'REEL_PRODUCT_REVISION_STALE'; END IF;
    SELECT * INTO ins FROM public.reel_review_inspections WHERE site_id=p_site AND revision_id=rev.id AND reviewer_id=a
     AND processing_receipt_id=(rev.payload->'media'->>'processing_evidence_id')::uuid AND deleted_at IS NULL
     AND inspected_at<=clock_timestamp() AND expires_at>clock_timestamp() ORDER BY inspected_at DESC LIMIT 1 FOR SHARE;
    IF ins.id IS NULL THEN RAISE EXCEPTION 'REEL_INSPECTION_UNAVAILABLE'; END IF;
   END IF;
   IF act='take_down' AND rr.status<>'approved' THEN RAISE EXCEPTION 'REEL_STATE_CONFLICT'; END IF;
   UPDATE public.commerce_reels SET status=CASE act WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'delisted' END WHERE id=p_reel;
  END IF;
  UPDATE public.commerce_reels SET version=version+1,updated_at=clock_timestamp(),updated_by=a WHERE id=p_reel RETURNING * INTO rr;
 END IF;
 result:=jsonb_build_object('reel',to_jsonb(rr),'revision',to_jsonb(rev),'replayed',false);
 INSERT INTO public.commerce_reel_events(site_id,reel_id,revision_id,actor_id,actor_realm,action,reason,request_key,command_hash,result,created_by,updated_by)
 VALUES(p_site,p_reel,rev.id,a,CASE WHEN p_console IS NULL THEN 'merchant' ELSE 'operator' END,act,reason,k,h,result,a,a);
 INSERT INTO public.audit_logs(actor_id,actor_type,action,resource_type,resource_id,metadata)
 VALUES(a,CASE WHEN p_console IS NULL THEN 'user' ELSE 'employee' END,'reel.'||act,'commerce_reel',p_reel,jsonb_build_object('site_id',p_site,'revision_id',rev.id,'version',rr.version,'reason',reason));
 INSERT INTO public.outbox_events(store_id,site_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key,actor_id)
 VALUES(p_site,p_site,'reel',p_reel::text,'reel.review.changed',jsonb_build_object('site_id',p_site,'reel_id',p_reel,'revision_id',rev.id,'action',act,'version',rr.version),
  'reel:'||encode(sha256(convert_to(p_site::text||':'||a::text||':'||k,'UTF8')),'hex'),a);
 RETURN result;
END $$;

CREATE FUNCTION public.read_reel_reviews_v1(p_actor uuid,p_site uuid,p_reel uuid DEFAULT NULL,p_console jsonb DEFAULT NULL,p_page integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a uuid;rows jsonb;rr public.commerce_reels;rev public.commerce_reel_revisions;events jsonb;refs jsonb;
BEGIN
 a:=public.reel_actor_v1(p_actor,p_site,p_console,false);
 IF p_page IS NULL OR p_page NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'REEL_REQUEST_INVALID'; END IF;
 IF p_reel IS NULL THEN
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.updated_at DESC,x.id),'[]') INTO rows FROM
   (SELECT * FROM public.commerce_reels WHERE ((p_console IS NOT NULL AND status<>'draft') OR(p_console IS NULL AND site_id=p_site)) AND deleted_at IS NULL ORDER BY updated_at DESC,id LIMIT 21 OFFSET (p_page-1)*20)x;
  IF p_console IS NULL THEN
   SELECT jsonb_build_object('listings',coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.id,'name',p.name,'variants',coalesce((SELECT jsonb_agg(jsonb_build_object('id',v.id,'title',v.title) ORDER BY v.position,v.id) FROM(SELECT id,title,position FROM public.product_variants WHERE product_id=p.id ORDER BY position,id LIMIT 100)v),'[]'::jsonb)))
    FROM(SELECT * FROM public.channel_listings WHERE site_id=p_site AND channel='marketplace' AND status='approved' AND visibility='public' ORDER BY id LIMIT 100)l JOIN public.products p ON p.id=l.product_id AND p.site_id=p_site AND p.is_active AND p.deleted_at IS NULL
    WHERE l.approved_product_fingerprint=public.marketplace_listing_review_fingerprint(l.id)),'[]'::jsonb),
    'media',coalesce((SELECT jsonb_agg(to_jsonb(v)) FROM(SELECT DISTINCT x.id,x.filename AS label FROM public.reel_asset_provenance a JOIN public.media_assets x ON x.id=a.media_asset_id AND x.site_id=a.site_id AND x.asset_type='video' AND x.public_url IS NULL AND x.deleted_at IS NULL AND x.checksum_sha256=a.checksum_sha256 WHERE a.site_id=p_site AND a.kind='video' AND a.deleted_at IS NULL AND a.custody_verified_at<=clock_timestamp() AND EXISTS(SELECT 1 FROM public.reel_processing_receipts r WHERE r.provenance_id=a.id AND r.site_id=p_site AND r.state='ready' AND r.deleted_at IS NULL AND r.verified_at<=clock_timestamp() AND r.media_version=a.asset_version AND r.checksum_sha256=a.checksum_sha256 AND r.provider_asset_id=a.provider_asset_id) ORDER BY x.id LIMIT 100)v),'[]'::jsonb),
    'thumbnails',coalesce((SELECT jsonb_agg(to_jsonb(v)) FROM(SELECT DISTINCT x.id,x.filename AS label FROM public.reel_asset_provenance a JOIN public.media_assets x ON x.id=a.media_asset_id AND x.site_id=a.site_id AND x.asset_type='image' AND x.public_url IS NULL AND x.deleted_at IS NULL AND x.checksum_sha256=a.checksum_sha256 WHERE a.site_id=p_site AND a.kind='image' AND a.deleted_at IS NULL AND a.custody_verified_at<=clock_timestamp() ORDER BY x.id LIMIT 100)v),'[]'::jsonb),
    'rights',coalesce((SELECT jsonb_agg(to_jsonb(v)) FROM(SELECT a.id,'Evidence '||a.id::text AS label FROM public.reel_asset_provenance a JOIN public.media_assets x ON x.id=a.media_asset_id AND x.site_id=a.site_id AND x.deleted_at IS NULL AND x.public_url IS NULL AND x.checksum_sha256=a.checksum_sha256 WHERE a.site_id=p_site AND a.kind='rights' AND a.deleted_at IS NULL AND a.custody_verified_at<=clock_timestamp() ORDER BY a.id LIMIT 100)v),'[]'::jsonb)) INTO refs;
  END IF;
  RETURN jsonb_build_object('items',(SELECT coalesce(jsonb_agg(value ORDER BY n),'[]') FROM jsonb_array_elements(rows) WITH ORDINALITY x(value,n) WHERE n<=20),'page',p_page,'page_size',20,'has_more',jsonb_array_length(rows)>20,'inspection_available',false,'custody_available',false,'references',refs);
 END IF;
 SELECT * INTO rr FROM public.commerce_reels WHERE id=p_reel AND ((p_console IS NOT NULL AND status<>'draft') OR(p_console IS NULL AND site_id=p_site)) AND deleted_at IS NULL;
 IF rr.id IS NULL THEN RAISE EXCEPTION 'REEL_NOT_FOUND'; END IF;
 SELECT * INTO rev FROM public.commerce_reel_revisions WHERE id=rr.current_revision_id AND site_id=rr.site_id;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',x.id,'revision_id',x.revision_id,'actor_id',x.actor_id,'actor_realm',x.actor_realm,'action',x.action,'reason',x.reason,'created_at',x.created_at) ORDER BY x.created_at DESC,x.id),'[]') INTO events
 FROM(SELECT * FROM public.commerce_reel_events WHERE reel_id=rr.id AND site_id=rr.site_id ORDER BY created_at DESC,id LIMIT 100)x;
 RETURN jsonb_build_object('reel',to_jsonb(rr),'revision',to_jsonb(rev),'events',events,'inspection_available',false,'custody_available',false);
END $$;
REVOKE ALL ON FUNCTION public.protect_reel_record_v1(),public.reel_json_compact_v1(json),public.reel_actor_v1(uuid,uuid,jsonb,boolean),public.reel_payload_v1(uuid,jsonb),public.mutate_reel_review_v1(uuid,uuid,uuid,jsonb,jsonb),public.read_reel_reviews_v1(uuid,uuid,uuid,jsonb,integer) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
GRANT EXECUTE ON FUNCTION public.mutate_reel_review_v1(uuid,uuid,uuid,jsonb,jsonb),public.read_reel_reviews_v1(uuid,uuid,uuid,jsonb,integer) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
`;
test('exact immutable future345 derives its six tenant tables without SQL formatting changes', () => {
    assert.equal(createHash('sha256').update(FUTURE_345_SQL).digest('hex'), '08df585e317cbc164acfd35497e4bc2a295df3e3f9ecdfd04e977defb2750e38');
    const entries = deriveTenantTablesFromMigrations([{ file: '345_canonical_reel_review.sql', source: FUTURE_345_SQL }]);
    assert.deepEqual(entries.map(row => row.table), ['commerce_reel_events', 'commerce_reel_revisions', 'commerce_reels', 'reel_asset_provenance', 'reel_processing_receipts', 'reel_review_inspections']);
    for (const row of entries) {
        assert.deepEqual(row.scopeColumns, ['site_id']); assert.equal(row.tenantColumn, 'site_id'); assert.deepEqual(row.ownerColumns, []);
        assert.deepEqual(row.sourceFiles, ['345_canonical_reel_review.sql']);
    }
});

test('executed DO blocks preserve static ALTER ownership and lineages without reading dynamic SQL strings', () => {
    const entries = deriveTenantTablesFromMigrations([
        { file: '001.sql', source: 'CREATE TABLE public.example (id uuid);' },
        { file: '002.sql', source: `DO $migration$ BEGIN
          IF true THEN ALTER TABLE public.example ADD COLUMN site_id uuid; END IF;
          EXECUTE 'ALTER TABLE public.example ADD COLUMN buyer_account_id uuid;';
          -- ALTER TABLE public.example ADD COLUMN owner_id uuid;
        END $migration$;` },
    ]);
    assert.deepEqual(entries[0].scopeColumns, ['site_id']);
    assert.deepEqual(entries[0].sourceFiles, ['001.sql', '002.sql']);
});

test('a function declaration is not an executed anonymous migration block', () => {
    assert.deepEqual(derive(`CREATE FUNCTION public.deferred() RETURNS void LANGUAGE plpgsql AS $$ BEGIN CREATE TABLE public.deferred_table (site_id uuid); END $$;`), []);
});

test('literal maintenance examples cannot seed a synthetic partition', () => {
    const entries = derive(`CREATE TABLE public.example (id uuid, site_id uuid);
      SELECT public.upsert_retention_policy('example','example',30);
      SELECT $note$SELECT public.ensure_monthly_hot_table_partition('example',DATE '2026-06-01');$note$;
      DO $$ BEGIN
        -- SELECT public.ensure_monthly_hot_table_partition('example',DATE '2026-07-01');
        EXECUTE 'SELECT public.ensure_monthly_hot_table_partition(''example'',DATE ''2026-08-01'');';
      END $$;`);
    assert.deepEqual(entries.map(row => row.table), ['example']);
});

test('standard and language-qualified anonymous blocks derive their actual static columns', () => {
    assert.deepEqual(derive(`CREATE TABLE public.example (id uuid);
      DO 'BEGIN ALTER TABLE public.example ADD COLUMN site_id uuid; END';
      DO LANGUAGE plpgsql $block$ BEGIN ALTER TABLE public.example ADD COLUMN owner_id uuid; END $block$;`)[0].scopeColumns, ['site_id', 'owner_id']);
});

test('deeply nested anonymous blocks fail closed at the technical parser bound', () => {
    let source = 'ALTER TABLE public.example ADD COLUMN site_id uuid;';
    for (let i = 0; i < 34; i++) source = `DO $block${i}$ BEGIN ${source} END $block${i}$;`;
    assert.throws(() => derive(source), /nesting exceeds bounded parser depth/);
});

test('punctuation-valued string literals cannot terminate or split a declaration', () => {
    assert.deepEqual(derive("CREATE TABLE public.example (id uuid, closing text DEFAULT ')', comma text DEFAULT ',', opening text DEFAULT '(', site_id uuid, owner_id uuid);")[0].scopeColumns, ['site_id', 'owner_id']);
});
