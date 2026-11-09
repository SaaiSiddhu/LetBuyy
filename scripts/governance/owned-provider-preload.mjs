// Fixed supervisor-only preload for explicit local provider simulation. It is
// outside every application runtime and refuses to start without owned DB proof.
import { verifyOwnedFixture } from './owned-fixture-guard.mjs';
import { createOwnedProviderFetch, validateOwnedProviderFixture } from './owned-provider-network.mjs';

const fixture = await verifyOwnedFixture();
const profile = validateOwnedProviderFixture(JSON.parse(process.env.LETBUYY_OWNED_PROVIDER_PROFILE || 'null'));
const originalFetch = globalThis.fetch.bind(globalThis);
const response = await originalFetch(profile.origin + '/_owned_provider_fixture', {
    headers: { 'X-Owned-Provider-Capability': profile.capability },
    redirect: 'error', signal: AbortSignal.timeout(3000),
});
const acknowledgement = response.ok ? await response.json() : null;
if (acknowledgement?.kind !== profile.kind || acknowledgement?.runId !== fixture.runId
    || acknowledgement?.database !== fixture.database) throw new Error('owned provider fixture ownership refused');
const deniedPorts = process.env.LETBUYY_OWNED_BLOCKED_LOCAL_PORTS === undefined ? [] : JSON.parse(process.env.LETBUYY_OWNED_BLOCKED_LOCAL_PORTS);
globalThis.fetch = createOwnedProviderFetch(originalFetch, profile, deniedPorts);
