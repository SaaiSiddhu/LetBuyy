'use client';

import { useState } from 'react';

// T8/W2 — the owner's screenshot showed a broken image icon in the checkout header: a
// server-rendered <img> with no client-side error handling has nothing to fall back to when the
// URL 404s or the host is unreachable, and a broken-image icon on a payment page reads as
// untrustworthy. `onError` requires a Client Component; the rest of the page stays server-only.
export default function CheckoutLogo({ logoUrl, storeName }: { logoUrl: string | null; storeName: string }) {
    const [failed, setFailed] = useState(false);

    if (!logoUrl || failed) {
        return <span>{storeName}</span>;
    }

    return (
        // eslint-disable-next-line @next/next/no-img-element -- a merchant logo host is never known
        // ahead of time, so next/image's static remotePatterns allowlist can't cover it; the URL
        // itself is already scheme-validated in branding.tsx before it reaches this component.
        <img
            src={logoUrl}
            alt={storeName}
            className="h-7 w-auto"
            onError={() => setFailed(true)}
        />
    );
}
