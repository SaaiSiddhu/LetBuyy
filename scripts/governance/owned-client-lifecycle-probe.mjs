// A fixed, synthetic lifecycle probe, never an arbitrary command seam.
import support from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support.ts';
const { startOwnedClientRuntime, requireOwnedDatabase } = support;
const database = requireOwnedDatabase();
if (process.env.LETBUYY_RUNTIME_PROBE_NESTED === '1') {
    process.stdout.write(`OWNER_PID:${process.pid}\n`);
    const nested = startOwnedClientRuntime(database, 'lifecycle-probe', { env:{ LETBUYY_RUNTIME_PROBE_HOLD:'1' } });
    nested.stdout.on('data', chunk => process.stdout.write(chunk));
    nested.stderr.on('data', chunk => process.stderr.write(chunk));
    nested.on('message', message => { if (message?.type === 'owned-client-started') process.stdout.write(`NESTED_SUPERVISOR:${nested.pid}\n`); });
} else {
    process.stdout.write(JSON.stringify({ probePid:process.pid, databaseUrlMatches:process.env.SUPABASE_URL===database.restUrl,
        ambientCredentialAbsent:!process.env.LETBUYY_RUNTIME_AMBIENT_CREDENTIAL })+'\n');
}
// Hold a real client process so termination/parent-death cannot pass vacuously.
if (process.env.LETBUYY_RUNTIME_PROBE_HOLD === '1') process.on('SIGTERM', () => {});
setInterval(() => {}, 1000);
