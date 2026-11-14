import { evaluateLeakyBucket } from '../middleware/rateLimit';
import type { Env } from '../index';

type CoordinatorState = {
    environment: string;
    deploymentEnv: string;
    checkpoint: string;
};

export class LetbuyyRuntimeDurableObject {
    constructor(private readonly state: DurableObjectState, private readonly env: Env) {
        this.state.blockConcurrencyWhile(async () => {
            const initialized = await this.state.storage.get<string>('initialized');
            if (!initialized) {
                await this.state.storage.put('initialized', 'v1-runtime-coordinator');
            }
        });
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        if (request.method === 'GET' && url.pathname.endsWith('/health')) {
            return Response.json(await this.readState());
        }

        if (request.method === 'POST' && url.pathname === '/fixed-window') {
            const body=await request.json().catch(()=>null) as {windowMs?:number;max?:number}|null;
            if(!body || !Number.isInteger(body.windowMs) || !Number.isInteger(body.max) || body.windowMs!<1 || body.windowMs!>86400000 || body.max!<1 || body.max!>1000000) {
                return Response.json({error:{code:'INVALID_ADMISSION'}},{status:400});
            }
            const duration=body.windowMs!,max=body.max!;
            const result=await this.state.storage.transaction(async tx=>{
                const now=Date.now(),resetAt=(Math.floor(now/duration)+1)*duration;
                const previous=await tx.get<{count:number;resetAt:number}>('fixed-window');
                const count=previous?.resetAt===resetAt?Math.min(previous.count+1,Number.MAX_SAFE_INTEGER):1;
                await tx.put('fixed-window',{count,resetAt});
                return {allowed:count<=max,remaining:Math.max(0,max-count),resetAt,unavailable:false};
            });
            return Response.json(result);
        }

        if (request.method === 'POST' && url.pathname === '/query-cost') {
            const body = await request.json().catch(() => null) as { cost?: number; pointsPerSecond?: number; capacity?: number } | null;
            if (!body || ![body.cost, body.pointsPerSecond, body.capacity].every(x => typeof x === 'number' && Number.isFinite(x) && x > 0 && x <= 1000000)) {
                return Response.json({ error: { code: 'INVALID_ADMISSION' } }, { status: 400 });
            }
            const { cost, pointsPerSecond, capacity } = body as { cost: number; pointsPerSecond: number; capacity: number };
            const result = await this.state.storage.transaction(async tx => {
                const entry = await tx.get<{ used: number; updatedAt: number }>('query-cost');
                const result = evaluateLeakyBucket({ entry: entry ?? null, now: Date.now(), cost, pointsPerSecond, capacity });
                await tx.put('query-cost', result.entry);
                return result;
            });
            const { entry: _privateEntry, ...response } = result;
            return Response.json(response);
        }

        if (request.method === 'POST' && url.pathname.endsWith('/checkpoint')) {
            const body = await request.json().catch(() => ({})) as Partial<CoordinatorState>;
            const checkpoint = typeof body.checkpoint === 'string' && body.checkpoint.length > 0
                ? body.checkpoint
                : 'unspecified';
            await this.state.storage.put('checkpoint', checkpoint);
            return Response.json(await this.readState());
        }

        return Response.json({ error: { code: 'NOT_FOUND', message: 'Runtime coordinator route not found' } }, { status: 404 });
    }

    private async readState(): Promise<CoordinatorState> {
        const checkpoint = await this.state.storage.get<string>('checkpoint');
        return {
            environment: this.env.ENVIRONMENT,
            deploymentEnv: this.env.DEPLOYMENT_ENV || this.env.ENVIRONMENT,
            checkpoint: checkpoint || 'not-recorded',
        };
    }
}
