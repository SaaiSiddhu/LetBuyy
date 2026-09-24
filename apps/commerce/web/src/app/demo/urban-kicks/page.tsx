import { notFound, redirect } from 'next/navigation';
import { URBAN_KICKS_DEMO_SUBDOMAIN } from '@/lib/demo/urban-kicks-demo';
import { isDemoRouteEnvironment } from '@/lib/demo/demo-route-gate';

// S1/W6 — Urban Kicks is the ARB-approved Liquid reference/canary fixture (render-parity test
// matrix, packages/theme-engine/src/theme-governance.ts), not a buyer-facing surface. This route
// must be reachable for local development and Vercel preview deployments (parity testing) and
// unreachable in production. FAIL CLOSED: only an explicit, positively-confirmed non-production
// signal allows the route through — an unset or unrecognized environment 404s, same as production.
// Mirrors this app's existing `process.env.NODE_ENV === 'production'` convention
// (apps/customer_web/src/proxy.ts) plus Vercel's own VERCEL_ENV, the real signal a Vercel
// preview deployment sets — no new feature-flag system is introduced.
export default function UrbanKicksDemoShortcut() {
    if (!isDemoRouteEnvironment()) {
        notFound();
    }
    redirect(`/preview?demo=urban-kicks&subdomain=${URBAN_KICKS_DEMO_SUBDOMAIN}`);
}
