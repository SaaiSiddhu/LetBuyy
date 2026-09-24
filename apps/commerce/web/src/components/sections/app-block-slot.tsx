import {
    normalizeAppBlockInstances,
    type AppBlockInstance,
} from '@letbuyy/shared-types';
import type { SectionModel, ThemeSettings } from '@letbuyy/theme-engine';
import type { CSSProperties } from 'react';

interface AppBlockSlotProps {
    section: SectionModel;
    theme: ThemeSettings;
}

function textSetting(value: unknown, fallback = ''): string {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function appBlockRecords(section: SectionModel, slot: string): unknown[] {
    return (section.blocks || [])
        .filter((block) => block.isVisible !== false)
        .sort((a, b) => a.order - b.order)
        .map((block) => ({
            id: block.id,
            type: block.type,
            ...block.settings,
            settings: block.settings,
            slot: textSetting(block.settings.slot, slot),
        }));
}

function AppBlockFrame({ block }: { block: AppBlockInstance }) {
    if (!block.iframe_url) return null;

    return (
        <iframe
            src={block.iframe_url}
            title={block.title}
            sandbox="allow-forms allow-popups allow-scripts allow-same-origin"
            loading="lazy"
            className="h-56 w-full rounded-lg border border-black/10 bg-[var(--lb-color-surface)]"
        />
    );
}

function AppBlockCard({ block, theme }: { block: AppBlockInstance; theme: ThemeSettings }) {
    const heading = block.content.heading || block.title;
    const body = block.content.body || '';
    const ctaLabel = block.content.cta_label || '';
    const ctaHref = block.content.cta_href || '';
    const accentStyle: CSSProperties = {
        borderColor: `${theme.primaryColor}33`,
    };

    if (block.render_mode === 'iframe' && block.iframe_url) {
        return (
            <div
                className="rounded-xl border bg-[var(--lb-color-surface)] p-3 shadow-sm"
                data-app-block-app-id={block.app_id}
                data-app-block-extension-id={block.extension_id}
                style={accentStyle}
            >
                <AppBlockFrame block={block} />
            </div>
        );
    }

    return (
        <article
            className="flex h-full flex-col justify-between rounded-xl border bg-[var(--lb-color-surface)] p-5 shadow-sm"
            data-app-block-app-id={block.app_id}
            data-app-block-extension-id={block.extension_id}
            style={accentStyle}
        >
            <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-normal text-black/45">
                    {block.title}
                </p>
                <h3 className="text-lg font-semibold text-black md:text-xl">
                    {heading}
                </h3>
                {body && (
                    <p className="mt-2 text-sm leading-6 text-black/60">
                        {body}
                    </p>
                )}
            </div>
            {ctaLabel && ctaHref && (
                <a
                    href={ctaHref}
                    className="mt-5 inline-flex w-fit items-center rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2"
                    style={{ backgroundColor: theme.primaryColor }}
                >
                    {ctaLabel}
                </a>
            )}
        </article>
    );
}

export default function AppBlockSlot({ section, theme }: AppBlockSlotProps) {
    const slot = textSetting(section.settings.slot, 'storefront.home.after-hero');
    const title = textSetting(section.settings.title);
    const layout = textSetting(section.settings.layout, 'grid');
    const blocks = normalizeAppBlockInstances(appBlockRecords(section, slot), slot);

    if (blocks.length === 0) return null;

    return (
        <section
            className="px-4 py-10 md:px-8 md:py-14"
            data-app-block-slot={slot}
        >
            <div className="mx-auto max-w-screen-xl">
                {title && (
                    <h2 className="mb-6 text-center text-xl font-bold tracking-normal text-black md:text-2xl">
                        {title}
                    </h2>
                )}
                <div className={layout === 'stack'
                    ? 'grid grid-cols-1 gap-4'
                    : 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'}
                >
                    {blocks.map((block) => (
                        <AppBlockCard key={block.id} block={block} theme={theme} />
                    ))}
                </div>
            </div>
        </section>
    );
}
