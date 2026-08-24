import type { LiquidRenderedTheme } from '@letbuyy/theme-engine';

// T2a-fix/W2/CAP-C19 — extracted into its own dependency-free module (not left inline in
// composition-engine.tsx) specifically so it stays unit-testable: composition-engine.tsx
// transitively imports 'server-only'-guarded modules (customer-drop.ts) that throw when imported
// outside a Next.js Server Component context, which a plain node:test run is not.
//
// This is the exact assembly step that had the historical bug: a prior version destructured only
// { header, contentForLayout, footer } off result.liquid and concatenated them, silently dropping
// the theme's :root token block + base stylesheet (theme-renderer.ts always produced them
// correctly — packages/theme-engine/test/liquid-l2-assets.test.ts proved that end for years; the
// gap was entirely on this side). See composition-engine.test.ts for the regression guard.
export function assembleLiquidPageFromRenderResult(
    liquid: LiquidRenderedTheme,
): { html: string; headStyleText: string } {
    // Full-Liquid page: header + body + footer are ALL rendered by the Liquid engine (each fragment is
    // sanitized per-section in theme-renderer.ts), so nothing in the storefront chrome is React.
    // layout.tsx drops its React header/footer when rendererEngine === 'liquid'. We concatenate the
    // sanitized fragments (not the full <!doctype> layout document, which can't nest inside a <div>).
    //
    // The theme's own :root token block + base stylesheet (headStyleText) is NOT part of that
    // concatenation: it belongs in <head>, and a nested layout/page component cannot render
    // <html>/<head> directly. headStyleText is already sanitized (theme-renderer.ts's
    // sanitizeLiquidHeadStyleText, the same allowHeadMetadata DOMPurify pass layoutHtml's own
    // wholeDocument sanitization uses) plain CSS TEXT — the caller renders it as a real <style>
    // element anywhere in the tree; Next.js/React hoist <style> elements into <head> regardless of
    // nesting depth, so this reaches the document head without emitting a nested document.
    const { header, contentForLayout, footer, headStyleText } = liquid;
    return { html: `${header || ''}${contentForLayout}${footer || ''}`, headStyleText: headStyleText || '' };
}
