#!/usr/bin/env node
// Manual local demo data requested by the owner. Never used by test suites or deployments.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const container = 'supabase_db_letbuyy-web-local-20261021';
const mode = process.argv[2];
if (!['--check', '--apply'].includes(mode) || process.argv.length !== 3) {
    process.stderr.write('Usage: node scripts/dev/seed-console-demo.mjs --check|--apply\n');
    process.exit(1);
}
const sql = readFileSync(new URL('../../database/supabase/seeds/local-console-demo-20261022.sql', import.meta.url), 'utf8');
if (!sql.endsWith('COMMIT;\n')) throw new Error('Expected one explicit final transaction boundary.');
const input = mode === '--check' ? sql.slice(0, -'COMMIT;\n'.length) + 'ROLLBACK;\n' : sql;
const output = execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'], {
    input,
    encoding: 'utf8',
    timeout: 60000,
    maxBuffer: 1024 * 1024,
});
process.stdout.write(output);
process.stdout.write(mode === '--check' ? 'Demo validation rolled back.\n' : 'Local DEMO records ready; no real provider payment or external message was sent.\n');
