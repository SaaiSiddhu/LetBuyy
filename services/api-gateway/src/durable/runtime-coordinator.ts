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
