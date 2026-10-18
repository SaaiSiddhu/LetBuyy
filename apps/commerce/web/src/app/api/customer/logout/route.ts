// POST /api/customer/logout — Clear session cookie
//
// CSRF hardening (Phase F): logout is a state-mutating POST. SameSite=lax is not enough for
// sibling storefronts: they are same-site, so a cross-origin form can still carry this host-only
// cookie. Only the exact storefront origin may trigger logout.
// Browsers always send Origin on cross-site POSTs. Same-site form submissions and fetch()
// calls from the store's own origin are always allowed; the no-JS <form> fallback works
// because it posts same-origin.
import { NextRequest } from 'next/server';
import { customerLogoutResponse } from '@/lib/customer-logout';

export async function POST(req: NextRequest) {
    return customerLogoutResponse(req);
}
