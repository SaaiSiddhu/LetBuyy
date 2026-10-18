// One finite, fixed scheduled event against a freshly verified owned database.
// The supervisor supplies the fixture; no arbitrary worker, command or URL seam.
import support from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support.ts';
import worker from '../../services/queue-workers/src/index.ts';

const failure = () => { process.stderr.write('Owned scheduled invocation failed\n'); process.exitCode = 1; };
const timeout = setTimeout(() => { failure(); process.exit(1); }, 80000);
try {
    const owned = support.requireOwnedDatabase();
    const timeText = process.env.N7_SCHEDULED_TIME;
    const loseReply = process.env.N7_LOSE_RECONCILIATION_REPLY;
    const scheduledTime = Number(timeText);
    if (!/^(0|[1-9]\d{0,12})$/.test(timeText ?? '') || !Number.isSafeInteger(scheduledTime)
        || scheduledTime > 4102444800000 || !['0', '1'].includes(loseReply)) {
        throw new Error('Invalid bounded scheduled probe inputs');
    }
    const pending = [], logs = [];
    for (const level of ['info', 'warn', 'error']) console[level] = (...values) => {
        for (const value of values) {
            try {
                const row = JSON.parse(String(value));
                if (row?.route === 'scheduled.money_ledger_reconciliation') logs.push(row);
            } catch { /* Only structured reconciliation observations cross stdout. */ }
        }
    };
    const original = globalThis.fetch, allowed = new URL(owned.restUrl).origin;
    globalThis.fetch = async (input, init) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        if (url.origin !== allowed) throw new Error('External network refused by owned traversal fixture');
        const reply = await original(input, init);
        if (loseReply === '1' && url.pathname.endsWith('/rpc/run_money_ledger_reconciliation_batch_v1') && reply.ok) {
            await reply.text(); throw new Error('Synthetic committed reconciliation response lost');
        }
        return reply;
    };
    // Explicit bindings keep every ambient/provider setting out of the worker.
    await worker.scheduled({ cron: '*/15 * * * *', scheduledTime, noRetry() {} }, {
        ...owned.restEnv(), ENVIRONMENT: 'development', MONEY_LEDGER_RECONCILIATION_BATCH_LIMIT: '2',
    }, { waitUntil(promise) { pending.push(promise); }, passThroughOnException() {} });
    await Promise.all(pending);
    process.stdout.write(JSON.stringify(logs));
} catch { failure(); }
finally { clearTimeout(timeout); }
