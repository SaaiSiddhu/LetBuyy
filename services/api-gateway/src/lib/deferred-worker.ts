import type { Env } from '../index';

type GatewayRuntime = (typeof import('../index'))['default'];

/** Keep the sole router's construction inside its first event, once per isolate. */
export function createDeferredGatewayHandler(load: () => Promise<GatewayRuntime>) {
    let pending: Promise<GatewayRuntime> | undefined;
    function runtime(): Promise<GatewayRuntime> {
        pending ??= Promise.resolve().then(load).catch((error: unknown) => {
            pending = undefined;
            throw error;
        });
        return pending;
    }

    return {
        async fetch(request: Request, env: Env, ctx: ExecutionContext) {
            return (await runtime()).fetch(request, env, ctx);
        },
        scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
            ctx.waitUntil(runtime().then((handler) => handler.scheduled(controller, env, ctx)));
        },
    } satisfies ExportedHandler<Env>;
}
