// Named owned-database SQL-result seam, not a managed Hyperdrive emulator.
// Hold only the existing site reader's result for one exact selector. Real
// Gateway, PostgreSQL wire, REST policy rows and native Cache API remain live.
import assert from 'node:assert/strict';
import type { OwnedDatabase } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';

const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const identifier = (value: string) => '"' + value.replaceAll('"', '""') + '"';
type Snapshot = { metadata: Record<string, unknown> | null; store: Record<string, unknown> | null };

export function holdOwnedStorefrontSqlSnapshot(owned: OwnedDatabase, siteId: string, handle: string) {
    assert.match(siteId, /^[a-f0-9-]{36}$/i);
    assert.match(handle, /^[a-z0-9-]{3,80}$/);
    const signature = 'public.read_published_storefront_site_v1(text,boolean)';
    const original = owned.psql(`SELECT pg_get_functiondef(${quote(signature)}::regprocedure);`);
    const owner = owned.psql(`SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid=${quote(signature)}::regprocedure;`);
    const snapshot = JSON.parse(owned.psql(`SELECT json_build_object('metadata',public.read_published_storefront_site_v1(${quote(handle)},true),'store',public.read_published_storefront_site_v1(${quote(handle)},false));`)) as Snapshot;
    for (const row of [snapshot.metadata, snapshot.store]) if (row) assert.equal(row.id, siteId);
    const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
    const liveName = 'owned_live_storefront_' + suffix;
    const liveDefinition = original.replace('FUNCTION public.read_published_storefront_site_v1(', `FUNCTION public.${liveName}(`);
    assert.notEqual(liveDefinition, original, 'only the expected canonical SQL reader may be held');
    const json = (row: Snapshot['metadata']) => row ? quote(JSON.stringify(row)) + '::jsonb' : 'NULL::jsonb';
    const delimiter = '$owned_snapshot_' + suffix + '$';
    // Keep the original function OID and ACL: existing prepared statements must
    // see the held result too. The private backup has the same definer owner and
    // is not an additional public entrypoint. Everything is restored exactly.
    owned.script(`BEGIN;
      ${liveDefinition};
      ALTER FUNCTION public.${liveName}(text,boolean) OWNER TO ${identifier(owner)};
      REVOKE ALL ON FUNCTION public.${liveName}(text,boolean) FROM PUBLIC,anon,authenticated,service_role,authenticator;
      CREATE OR REPLACE FUNCTION public.read_published_storefront_site_v1(p_handle text,p_id_only boolean)
      RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,public AS ${delimiter}
        SELECT CASE WHEN p_handle IN (${quote(handle)},${quote('id:' + siteId.toLowerCase())})
          THEN CASE WHEN p_id_only THEN ${json(snapshot.metadata)} ELSE ${json(snapshot.store)} END
          ELSE public.${liveName}(p_handle,p_id_only) END;
      ${delimiter};
      COMMIT;`);
    let restored = false;
    return {
        snapshot,
        read: () => JSON.parse(owned.psql(`SELECT json_build_object('metadata',public.read_published_storefront_site_v1(${quote(handle)},true),'store',public.read_published_storefront_site_v1(${quote(handle)},false));`)) as Snapshot,
        restore() {
            if (restored) return;
            owned.script(`BEGIN;\n${original};\nDROP FUNCTION public.${liveName}(text,boolean);\nCOMMIT;`);
            assert.equal(owned.psql(`SELECT pg_get_functiondef(${quote(signature)}::regprocedure);`), original);
            restored = true;
        },
    };
}
