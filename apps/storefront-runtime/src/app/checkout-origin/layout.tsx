// T6/W3 — the checkout.<root> tree deliberately does NOT import
// app/store/[subdomain]/liquid-theme.css, does not render any Liquid theme section, and is not
// wrapped by app/store/[subdomain]/layout.tsx (this directory is a sibling of `store/`, not a
// descendant). It inherits only the root app/layout.tsx (LetBuyy's own --lb-* platform tokens,
// never merchant-authored CSS) and applies merchant branding as sanitized data (see
// branding.tsx), never as a merchant stylesheet.
export default function CheckoutOriginLayout({ children }: { children: React.ReactNode }) {
    return <div className="lb-checkout-origin">{children}</div>;
}
