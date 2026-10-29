import { evaluateLeakyBucket } from '../middleware/rateLimit';
import type { Env } from '../index';
import { authorizeTurnstileHostname, readTurnstileCoverage } from '@letbuyy/infrastructure/cloudflare-adapter';
import { TurnstileDomainRequestSchema, turnstileDomainManagement } from '../lib/turnstile-domain-config';

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

        if (request.method === 'POST' && ['/turnstile-hostnames/ensure', '/turnstile-hostnames/status'].includes(url.pathname)) {
            const parsed = TurnstileDomainRequestSchema.safeParse(await request.json().catch(() => null));
            if (!parsed.success) return Response.json({ error: { code: 'INVALID_DOMAIN' } }, { status: 400 });
            const config = turnstileDomainManagement(this.env);
            if (!config) return Response.json({ status: 'configuration_required' });
            const host = parsed.data.hostname;
            if (url.pathname.endsWith('/status')) return Response.json(await readTurnstileCoverage(config, host));
            // One existing coordinator instance per configured account/widget. A
            // provider PUT cannot race another LetBuyy domain registration.
            return this.state.blockConcurrencyWhile(async () => {
                if (await this.state.storage.get('turnstile-operation-in-flight')) {
                    // A lost PUT reply is not permission for another blind overwrite.
                    // Readback may prove this host ready, but further writes stay held
                    // until an operator reconciles and versions the management config.
                    const observed = await readTurnstileCoverage(config, host);
                    return Response.json(observed.status === 'ready' ? observed : { status: 'unavailable' });
                }
                // Persist intent before any possible provider mutation. A crash or
                // failed acknowledgement cannot silently erase its uncertainty.
                await this.state.storage.put('turnstile-operation-in-flight', {
                    site_id: parsed.data.site_id, hostname: host, started_at: new Date().toISOString(),
                });
                const result = await authorizeTurnstileHostname(config, host);
                await this.state.storage.put('turnstile-last-operation', {
                    site_id: parsed.data.site_id, hostname: host, status: result.status,
                    uncertain: result.uncertain === true, checked_at: new Date().toISOString(),
                });
                if (!result.uncertain) await this.state.storage.delete('turnstile-operation-in-flight');
                return Response.json({ status: result.status });
            });
        }

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
