import { createMiddleware } from 'hono/factory';
import type { Env } from '../index';

const POSITIVE = new Set(['1', 'true', 'on', 'enabled', 'yes']);

/**
 * ART-22 / ART-16 / NEVER-R3 / AGENT-R13 hard gate.
 *
 * The third-party app platform (app marketplace, App Bridge embed + bridge/fetch,
 * app OAuth2, app billing/revenue share, developer platform) is a FROZEN SEAM, not
 * a live capability. This gate is FAIL-CLOSED: the surface is unreachable unless
 * FEATURE_APP_PLATFORM is explicitly set to a positive value.
 *
 * There is deliberately NO environment-based fallback. `middleware/featureFlags.ts`
 * defaults to `!isProductionRuntime(env)` when its flag is unset, which is fail-OPEN;
 * that behaviour is the defect this gate exists to close, so `isGatewayFeatureEnabled`
 * / `featureGate` are intentionally not reused here.
 *
 * Absent, empty, or malformed value => DISABLED. The variable is intentionally not
 * declared in wrangler.toml for any environment, so every deploy shape is off.
 *
 * Re-enabling is a human-approved constitutional act (ART-22 trigger: ~5,000 merchants
 * plus real inbound developer demand). Do NOT set this variable.
 */
export function isAppPlatformEnabled(env: Pick<Env, 'FEATURE_APP_PLATFORM'>): boolean {
    const value = env.FEATURE_APP_PLATFORM?.trim().toLowerCase();
    return value ? POSITIVE.has(value) : false;
}

export const appPlatformKillSwitch = createMiddleware<{ Bindings: Env }>(async (c, next) => {
    if (isAppPlatformEnabled(c.env)) {
        await next();
        return;
    }

    return c.json(
        { success: false, error: { code: 'APP_PLATFORM_DISABLED', message: 'Not found' } },
        404,
    );
});
