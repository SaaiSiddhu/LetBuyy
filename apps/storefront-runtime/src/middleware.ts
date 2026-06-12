/**
 * LB-1 (V1_SCOPE_LOCK_2026_06_12): wire the storefront host-routing proxy as
 * Next.js middleware.
 *
 * `src/proxy.ts` has always contained the complete subdomain / custom-domain /
 * gate / preview routing logic, but Next.js only executes a root-level
 * `middleware.ts`. Without this file, `{store}.letbuyy.com` and custom-domain
 * requests were never rewritten to `/store/[subdomain]/...` and storefront
 * access gating never ran.
 *
 * The matcher is intentionally an inline literal (kept in sync with
 * `config.matcher` in `./proxy`) because Next.js statically analyses the
 * `config` export of this file and does not reliably resolve re-exported
 * objects.
 */
export { proxy as middleware } from './proxy';

export const config = {
  matcher: ['/((?!api/|_next/|_static/|[\\w-]+\\.\\w+).*)'],
};
