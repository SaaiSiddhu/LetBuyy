// S1/W6 — environment gate for the Urban Kicks demo/reference route. See page.tsx for why this
// route must be reachable in local/preview and unreachable in production, and why the check is
// fail-closed. Kept in its own module (not exported from page.tsx) because Next.js's App Router
// build validates page.tsx against a strict export allowlist (default/generateMetadata/etc.) and
// rejects any other named export.
export function isDemoRouteEnvironment(): boolean {
    return process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'preview';
}
