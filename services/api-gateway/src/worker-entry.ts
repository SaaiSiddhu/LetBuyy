import { createDeferredGatewayHandler } from './lib/deferred-worker';

// Preserve the existing Durable Object ABI without initializing the HTTP router.
export { LetbuyyRuntimeDurableObject } from './durable/runtime-coordinator';

// The module still owns every route, middleware and scheduled operation. Its
// construction runs under the first event's lifetime instead of startup CPU.
export default createDeferredGatewayHandler(async () => (await import('./index')).default);
