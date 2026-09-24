// S7/W2 — Next.js server-startup hook (https://nextjs.org/docs/app/guides/instrumentation).
// register() runs once when a new Next.js server instance boots, before it serves any request.
// Used here to warm the theme-engine's lazily-initialized DOMPurify/JSDOM singleton
// (packages/theme-engine/src/theme-renderer.ts's getThemeDomPurify) at boot instead of on
// whichever Liquid-rendering request happens to arrive first — see
// docs/evidence/liquid-load/S7-cold-path-profile.md for the profiled cause this closes.
// Node.js runtime only: jsdom/dompurify are server-only and this hook also runs under the Edge
// runtime, where they are unavailable and unnecessary (Liquid rendering never runs at the edge).
export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;
    const { warmupThemeDomPurify } = await import('@letbuyy/theme-engine');
    warmupThemeDomPurify();
}
