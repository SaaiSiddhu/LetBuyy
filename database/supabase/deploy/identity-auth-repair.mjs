import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// Bounded compatibility install for the live pre-migration schema. It reuses the
// canonical 078/161/175 definitions; it does not replay unrelated migrations or
// alter migration history. The normal history reconciliation remains separate.
const files = [
  '../migrations/078_password_set_intents.sql',
  '../migrations/161_foundation_session_security.sql',
  '../migrations/175_fix_session_rpc_search_path.sql',
  '../migrations/396_password_set_intent_privileges.sql',
];
export function buildIdentityAuthRepair() {
  const sources = files.map(file => ({
    file,
    sql: readFileSync(new URL(file, import.meta.url), 'utf8'),
  }));
  const sql = `BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SELECT pg_advisory_xact_lock(hashtext('letbuyy-identity-auth-repair-20261025'));
DO $preflight$
BEGIN
 IF to_regclass('public.users_custom') IS NULL OR to_regclass('public.sessions') IS NULL
    OR to_regprocedure('public.update_updated_at()') IS NULL THEN
   RAISE EXCEPTION 'Identity auth repair prerequisites missing';
 END IF;
 IF to_regclass('public.auth_password_set_intents') IS NOT NULL
    OR to_regclass('public.session_token_rotation_events') IS NOT NULL
    OR to_regprocedure('public.validate_and_rotate_merchant_session(text,boolean,integer,integer)') IS NOT NULL THEN
   RAISE EXCEPTION 'Identity auth repair refuses an already configured or partially configured schema';
 END IF;
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sessions'
    AND column_name IN ('revoked_at','revoked_reason','last_rotated_at','rotation_count')) THEN
   RAISE EXCEPTION 'Identity auth repair refuses existing session extension columns';
 END IF;
END;
$preflight$;
${sources.map(({ sql }) => sql.replace(/^BEGIN;\s*$/gm, '').replace(/^COMMIT;\s*$/gm, '')).join('\n')}
ALTER TABLE public.session_token_rotation_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.session_token_rotation_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.session_token_rotation_events TO service_role;
REVOKE ALL ON FUNCTION public.validate_and_rotate_merchant_session(text,boolean,integer,integer)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_and_rotate_merchant_session(text,boolean,integer,integer) TO service_role;
DO $tenant_role$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='app_tenant') THEN
   REVOKE ALL ON TABLE public.session_token_rotation_events FROM app_tenant;
   REVOKE ALL ON FUNCTION public.validate_and_rotate_merchant_session(text,boolean,integer,integer) FROM app_tenant;
 END IF;
END $tenant_role$;
NOTIFY pgrst, 'reload schema';
COMMIT;
`;
  return { sql, sources: sources.map(({ file, sql }) => ({ file, sha256: createHash('sha256').update(sql).digest('hex') })) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = process.argv[2];
  if (!output) throw new Error('Provide a private local output SQL path; this command never applies SQL.');
  const result = buildIdentityAuthRepair();
  writeFileSync(output, result.sql, { mode: 0o600, flag: 'wx' });
  writeFileSync(output + '.manifest.json', JSON.stringify({ sources: result.sources, sha256: createHash('sha256').update(result.sql).digest('hex') }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  process.stdout.write('Auth-only SQL package and source manifest written; no database contacted.\n');
}
