// Split out of client.ts (T4 W4 / CAP-C24) so this pure predicate is unit-testable without
// pulling in client.ts's `import 'server-only'`, which throws at import time outside a Next.js
// Server Component context — including in a plain node:test run.
//
// `path` is the full request target, including any query string
// (apiClientInputToLetbuyyApiPath appends `url.search`). The nine literal checks below are
// exact-string `===` comparisons, so ANY call carrying a query param — which is most GET calls,
// e.g. `?store_id=...&email=...` — failed every branch, silently skipped signing, and the
// gateway correctly rejected the unsigned request. Match on the pathname alone (query string and
// any trailing slash stripped) so the predicate is invariant to how the caller shaped the URL,
// without changing which nine paths (plus the orders/contact pattern) are matched — this must
// stay an exact allowlist, never a prefix match, since these are internal-only endpoints and
// widening the match would sign — and thus internally-authorize — more than intended.
export function isStorefrontInternalOnlyPath(path: string): boolean {
    const pathname = (path.split('?')[0] || '').replace(/\/+$/, '') || '/';
    return pathname === '/storefront/customer/find-or-create'
        || pathname === '/storefront/customer/by-email'
        || pathname === '/storefront/customer/status'
        || pathname === '/storefront/customer/password'
        || pathname === '/storefront/customer/login-success'
        || pathname === '/storefront/customer/order-credential'
        || pathname === '/storefront/customer/order-credential/login'
        || pathname === '/storefront/customer/order-credential/login-success'
        || pathname === '/storefront/customer/order-stats'
        || /^\/storefront\/[^/]+\/orders\/contact$/.test(pathname);
}
