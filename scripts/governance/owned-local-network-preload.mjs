// Supervisor-only deny rule, independent of Identity's provider simulation.
import { verifyOwnedFixture } from './owned-fixture-guard.mjs';
import { withOwnedLocalPortDenials } from './owned-provider-network.mjs';
await verifyOwnedFixture();
const ports = JSON.parse(process.env.LETBUYY_OWNED_BLOCKED_LOCAL_PORTS || 'null');
globalThis.fetch = withOwnedLocalPortDenials(globalThis.fetch.bind(globalThis), ports);
