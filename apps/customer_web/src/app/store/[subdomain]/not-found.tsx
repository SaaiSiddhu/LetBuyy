// Store-level not-found boundary.
//
// CONSTRAINT: Next.js 14/15 not-found.tsx does NOT receive route params — the subdomain is
// unavailable here. A Liquid-engine 404 page (bundle.templates.not_found) requires knowing which
// store's bundle to load, which in turn requires the subdomain.
//
// PHASE E DECISION: delegate to the root React 404 component. The Liquid not_found template in
// the bundle is exercised via editor preview and in-isolation tests only for Phase E.
//
// PHASE F scope: the clean seam is proxy-level routing that carries the subdomain into the
// not-found boundary, OR a LiquidRenderOutcomeContext set by the composition engine and consumed
// by the layout boundary. Both patterns are non-trivial and out of scope here.

export { default } from '@/app/not-found';
