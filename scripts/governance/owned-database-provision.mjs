// Provisioning of the gateway database lane's databases inside an owned cluster.
//
// The gateway's database suites need the FULL schema (every migration), a fixture that answers the way Supabase
// does (supabase-faithful-bootstrap.mjs) and the REST layer's roles. Replaying 190-odd migrations costs about twenty
// seconds, so a cluster builds that once, as a pristine template database, and every suite gets its own database
// cloned from it:
//
//   isolation   each suite runs in a database no other suite has touched, and it is dropped when the suite ends.
//               "Reset" is not a sequence of DELETEs: the database is thrown away, so the immutable records the tests
//               create (GST invoices, the gift-card ledger) are never removed by hand and no trigger is bypassed.
//   ownership   the clone carries a database-level setting, letbuyy.fixture_run_id, written by the runner at
//               creation. The REST sidecar and the suites read it back (letbuyy_fixture.run_id()), which is how a
//               database is shown to be this run's and not merely a database with a plausible name.
//
// CREATE DATABASE ... TEMPLATE copies the catalogs and data but not `ALTER DATABASE ... SET` settings, so the
// bootstrap's search_path (which puts `extensions` on it, as Supabase does) is re-applied to every clone.

import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';
import { RUN_ID_PATTERN, dockerAsync } from './executable-pg-fixture.mjs';
import {nativeAuthMigrationEntries,parseNativeAuthMigrationProfile} from './native-auth-migration-profile.mjs';

export const GATEWAY_TEMPLATE_DATABASE = 'letbuyy_tpl_gateway';

const stripUnsupportedPg17Guc = (sql) => sql.replace(/^SET transaction_timeout = 0;\s*$/m, '');

export function parseMigrationCeiling(raw) {
    if (raw === undefined) return undefined;
    if (typeof raw !== 'string' || !/^[1-9]\d{0,5}$/.test(raw)) throw new Error('--through-migration must be a positive integer from 1 to 999999');
    return Number(raw);
}

export function listMigrations(repoRoot, { throughMigration } = {}) {
    if (throughMigration !== undefined && (!Number.isInteger(throughMigration) || throughMigration < 1 || throughMigration > 999999)) throw new Error('Invalid migration ceiling');
    return readdirSync(join(repoRoot, 'database/supabase/migrations'))
        .filter((name) => name.endsWith('.sql') && (throughMigration === undefined || parseInt(name, 10) <= throughMigration))
        .sort((a, b) => {
            const na = parseInt(a.match(/^(\d+)/)?.[1] ?? '0', 10);
            const nb = parseInt(b.match(/^(\d+)/)?.[1] ?? '0', 10);
            return na - nb || a.localeCompare(b);
        });
}

/** Runs a script in one database of a cluster through psql's stdin; a failure names the first error line only. */
export async function psqlScript(cluster, database, sql, what) {
    const result = await dockerAsync(
        ['exec', '-i', cluster.name, 'psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-q'],
        { input: `SET client_min_messages TO warning;\n${sql}`, allowFailure: true },
    );
    if (result.status !== 0) {
        const firstError = `${result.stderr}`.split('\n').find((line) => /ERROR|FATAL/.test(line)) ?? `${result.stderr}`.split('\n').find(Boolean) ?? 'unknown error';
        throw new Error(`${what} failed in ${cluster.name}/${database}: ${firstError.trim().slice(0, 300)}`);
    }
    return result.stdout;
}

const quoted = (identifier) => `"${String(identifier).replaceAll('"', '""')}"`;

/**
 * Builds the pristine template once per cluster: faithful bootstrap, every migration in numeric order, with the REST
 * layer's roles established first, then the fixture schema. Returns the seconds it took.
 */
export async function buildGatewayTemplate(cluster, { repoRoot, restPassword, throughMigration, migrationProfile, templateDatabase = GATEWAY_TEMPLATE_DATABASE }) {
    parseNativeAuthMigrationProfile(migrationProfile);
    if(migrationProfile!==undefined&&throughMigration!==undefined)throw new Error('A native auth profile cannot be combined with a migration ceiling');
    // The password is written into SQL text, so it is checked to be what the runner generates (hex), nothing else.
    if (!/^[0-9a-f]{32,}$/.test(restPassword)) throw new Error('the REST role password must be a hex string');
    const started = Date.now();
    await psqlScript(cluster, 'postgres', `CREATE DATABASE ${quoted(templateDatabase)};`, 'creating the template database');
    await psqlScript(cluster, templateDatabase, SUPABASE_FAITHFUL_BOOTSTRAP_SQL, 'the faithful bootstrap');
    // REST transport memberships must exist before migrations freeze their authority profile.
    await psqlScript(cluster, templateDatabase, `
        DO $role$
        BEGIN
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
            CREATE ROLE authenticator LOGIN NOINHERIT;
          END IF;
        END
        $role$;
        ALTER ROLE authenticator PASSWORD '${restPassword}';
        GRANT anon, authenticated, service_role TO authenticator;

    `, 'the REST roles');
    cluster.migrationEvidence = { throughMigration: throughMigration ?? null, migrationProfile: migrationProfile ?? null, applied: [] };
    const names=listMigrations(repoRoot,{throughMigration});
    const entries=migrationProfile===undefined
        ?names.map(name=>({name,source:readFileSync(join(repoRoot,'database/supabase/migrations',name),'utf8')}))
        :nativeAuthMigrationEntries(repoRoot,names,migrationProfile);
    for (const {name,source,canonicalName,canonicalSha256} of entries) {
        await psqlScript(
            cluster,
            templateDatabase,
            stripUnsupportedPg17Guc(source),
            `migration ${name}`,
        );
        cluster.migrationEvidence.applied.push({ name, prefix: parseInt(name, 10), sha256: createHash('sha256').update(source).digest('hex'),...(canonicalName?{canonicalName,canonicalSha256}:{}) });
    }
    await psqlScript(cluster, templateDatabase, `

        -- The run's identity, readable through the REST layer: schema letbuyy_fixture is exposed only by this lane's
        -- sidecar, and only the service role may call it.
        CREATE SCHEMA IF NOT EXISTS letbuyy_fixture;
        GRANT USAGE ON SCHEMA letbuyy_fixture TO service_role;
        CREATE OR REPLACE FUNCTION letbuyy_fixture.run_id() RETURNS text LANGUAGE sql STABLE
          AS $fn$ SELECT current_setting('letbuyy.fixture_run_id', true) $fn$;
        GRANT EXECUTE ON FUNCTION letbuyy_fixture.run_id() TO service_role;
    `, 'the fixture schema');
    // Nobody connects to a template while it is cloned; keeping connections off makes that a rule and not a habit.
    await psqlScript(cluster, 'postgres', `ALTER DATABASE ${quoted(templateDatabase)} WITH ALLOW_CONNECTIONS false;`, 'sealing the template');
    return Math.round((Date.now() - started) / 100) / 10;
}

/** One suite's database, cloned from the template and marked as this run's. */
export async function createSuiteDatabase(cluster, database, runId, { templateDatabase = GATEWAY_TEMPLATE_DATABASE } = {}) {
    if (!RUN_ID_PATTERN.test(runId)) throw new Error('the run id must be 12 hex characters');
    await psqlScript(cluster, 'postgres', `CREATE DATABASE ${quoted(database)} TEMPLATE ${quoted(templateDatabase)};`, 'cloning the template');
    await psqlScript(cluster, 'postgres', `ALTER DATABASE ${quoted(database)} SET search_path = public, extensions;`, 'setting the search_path');
    await psqlScript(cluster, 'postgres', `ALTER DATABASE ${quoted(database)} SET letbuyy.fixture_run_id = '${runId}';`, 'marking the database');
}

export async function dropSuiteDatabase(cluster, database) {
    const result = await dockerAsync(
        ['exec', '-i', cluster.name, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-c', `DROP DATABASE IF EXISTS ${quoted(database)} WITH (FORCE);`],
        { allowFailure: true },
    );
    return result.status === 0;
}
