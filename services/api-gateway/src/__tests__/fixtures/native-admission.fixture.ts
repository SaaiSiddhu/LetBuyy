// Native, disposable workerd fixture only. No database, provider credentials or hosted deployment.
import { Hono } from 'hono';
import type { Env } from '../../index';
import { LetbuyyRuntimeDurableObject } from '../../durable/runtime-coordinator';
import { queryCostRateLimit, rateLimit } from '../../middleware/rateLimit';

type SyntheticEnv = Env & {
    SYNTHETIC_COORDINATOR_DELAY_MS?: string;
    SYNTHETIC_COORDINATOR_OUTAGE?: string;
};

export class SyntheticAdmissionCoordinator extends LetbuyyRuntimeDurableObject {
    constructor(state: DurableObjectState, private readonly syntheticEnv: SyntheticEnv) {
        super(state, syntheticEnv);
        const delay = Number(syntheticEnv.SYNTHETIC_COORDINATOR_DELAY_MS || 0);
        if (delay > 0) {
            state.blockConcurrencyWhile(() => new Promise<void>(resolve => setTimeout(resolve, delay)));
        }
    }

    override async fetch(request: Request): Promise<Response> {
        if (this.syntheticEnv.SYNTHETIC_COORDINATOR_OUTAGE === 'true') {
            return Response.json({ error: { code: 'SYNTHETIC_COORDINATOR_OUTAGE' } }, { status: 503 });
        }
        return super.fetch(request);
    }
}

const app = new Hono<{ Bindings: SyntheticEnv }>();
app.use('/query', queryCostRateLimit({ capacity: 2, pointsPerSecond: 0.000001, prefix: 'synthetic-query' }));
app.get('/query', c => c.json({ admitted: true }));
app.use('/fixed', rateLimit({ max: 2, windowMs: 60_000, prefix: 'synthetic-fixed' }));
app.get('/fixed', c => c.json({ admitted: true }));
export default app;
