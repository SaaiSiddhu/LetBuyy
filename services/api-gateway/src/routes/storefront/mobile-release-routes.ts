// CAP-FB-APPUPDATE (D-9) — "is this build still allowed to run".
//
// PUBLIC and unauthenticated by necessity: the gate runs before login and must answer for a build too
// old to authenticate, which is exactly the build most likely to need it.
//
// The response is COMPUTED, never raw policy. The client sends what it is; the server says what that
// means. Returning minimum_supported_build and letting the app compare would put the comparison back
// in the client — the thing this replaces, where a string compare ranks build "10" below "9" and
// silently stops gating with nothing to report it.

import type { Hono } from 'hono';
import type { Env } from '../../index';
import { dbFailureBody, success } from '../../lib/supabase';
import type { AppContext } from './customer-engagement-routes';

const PLATFORMS = ['android', 'ios'] as const;
/// Android versionCode is a 31-bit signed int and the Play Store caps it near this. Anything larger
/// is not a real install; bounding it keeps a hostile or broken client from probing with absurd
/// values.
const MAX_BUILD = 2_100_000_000;

export interface MobileReleaseRow {
    build_number: number;
    version_name: string;
    minimum_supported_build: number;
    update_url: string | null;
    message: string | null;
}

export interface MobileReleaseRoutesDeps {
    /// The newest ACTIVE release for this app and platform, or null when none is published.
    loadLatestRelease: (c: AppContext, platform: string, applicationId: string) => Promise<{ data: MobileReleaseRow | null; error: unknown }>;
}

export function registerMobileReleaseRoutes(
    router: Hono<{ Bindings: Env }>,
    deps: MobileReleaseRoutesDeps,
): void {
    const { loadLatestRelease } = deps;

    router.get('/app-release', async (c) => {
        const platform = (c.req.query('platform') || '').trim().toLowerCase();
        const applicationId = (c.req.query('application_id') || '').trim();
        const rawBuild = c.req.query('build') || '';

        if (!PLATFORMS.includes(platform as typeof PLATFORMS[number]) || !applicationId) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: `platform must be one of ${PLATFORMS.join(', ')} and application_id is required` } }, 400);
        }

        // Strict integer. Number() would accept '4013abc' as NaN but also ' 4013 ' and '4e3', and a
        // build number that parsed loosely would compare wrongly rather than fail.
        if (!/^\d{1,10}$/.test(rawBuild)) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'build must be a positive integer' } }, 400);
        }
        const build = Number.parseInt(rawBuild, 10);
        if (!Number.isSafeInteger(build) || build <= 0 || build > MAX_BUILD) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'build is out of range' } }, 400);
        }

        const { data: release, error } = await loadLatestRelease(c, platform, applicationId);
        if (error) return c.json(dbFailureBody(), 500);

        if (!release) {
            // No published release for this app. FAIL OPEN, deliberately: an unknown app or a
            // misconfigured environment must not lock every install out of the product. The gate
            // exists to stop a known-bad build, not to be a liveness dependency.
            return c.json(success({
                update_available: false,
                force_update: false,
                latest_version: null,
                update_url: null,
                message: null,
            }));
        }

        // The two questions, answered here rather than by the caller.
        const updateAvailable = build < release.build_number;
        const forceUpdate = build < release.minimum_supported_build;

        return c.json(success({
            update_available: updateAvailable,
            force_update: forceUpdate,
            latest_version: release.version_name,
            // Only useful when there is something to do about it, and withholding it otherwise keeps
            // the store link out of responses to already-current installs.
            update_url: updateAvailable ? release.update_url : null,
            message: updateAvailable ? release.message : null,
        }));
    });
}
