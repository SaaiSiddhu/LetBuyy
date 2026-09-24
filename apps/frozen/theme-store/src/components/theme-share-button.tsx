'use client';

import { useState } from 'react';
import { Button, Share2 } from '@letbuyy/ui';
import { themeDetailSharePath } from '@/lib/utils';

export function buildThemeShareUrl(slug: string) {
    const path = themeDetailSharePath(slug);
    if (typeof window === 'undefined') return path;
    return new URL(path, window.location.origin).toString();
}

export default function ThemeShareButton({ slug, name }: { slug: string; name: string }) {
    const [copied, setCopied] = useState(false);

    async function copyLink() {
        const url = buildThemeShareUrl(slug);
        await navigator.clipboard.writeText(url);
        setCopied(true);
    }

    return (
        <div className="grid gap-[var(--lb-space-2)]">
            <Button
                unstyled
                type="button"
                onClick={copyLink}
                className="inline-flex min-h-[var(--lb-density-button-height)] items-center justify-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-secondary-border)] bg-[var(--lb-component-button-secondary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-button-secondary-text)] transition-colors hover:bg-[var(--lb-component-button-secondary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                aria-label={`Copy ${name} marketplace link`}
            >
                <Share2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                Copy link
            </Button>
            {copied && (
                <p className="m-0 text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-component-banner-success-text)]" role="status">
                    Link copied.
                </p>
            )}
        </div>
    );
}
