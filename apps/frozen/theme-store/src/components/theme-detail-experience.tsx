import { Card, ExternalLink, Section } from '@letbuyy/ui';
import type { Theme } from '@letbuyy/theme-engine';
import { themeSandboxPreviewHref } from '@/lib/utils';
import ThemeShareButton from './theme-share-button';

function numberScore(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function scoreLabel(value: number | null) {
    return value === null ? 'No recorded score' : `${Math.round(value)}`;
}

function stringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

function changelogEntries(theme: Theme) {
    return Array.isArray(theme.changelog) ? theme.changelog.filter((entry) => entry.version && entry.changes.length > 0) : [];
}

export function ThemeLiveDemoEmbed({ theme }: { theme: Theme }) {
    const src = theme.demo_url || themeSandboxPreviewHref(theme.slug);

    return (
        <Section title="Live demo" description="Preview this theme inside the marketplace before installing it." className="px-0 py-0">
            <Card className="overflow-hidden">
                <div className="flex items-center justify-between gap-[var(--lb-space-3)] border-b border-[var(--lb-color-border)] p-[var(--lb-space-3)]">
                    <p className="m-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                        Embedded preview
                    </p>
                    <a
                        href={src}
                        className="inline-flex min-h-[var(--lb-density-pill-height)] items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-full)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text)]"
                    >
                        <ExternalLink className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                        Open preview
                    </a>
                </div>
                <iframe
                    title={`${theme.name} live demo`}
                    src={src}
                    className="h-[520px] w-full border-0 bg-[var(--lb-color-surface-subdued)]"
                    loading="lazy"
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                    data-testid="theme-live-demo-iframe"
                />
            </Card>
        </Section>
    );
}

export function ThemeQualityFacts({ theme }: { theme: Theme }) {
    const performance = numberScore(theme.performance_report?.lighthouse_performance);
    const accessibility = numberScore(theme.accessibility_report?.lighthouse_accessibility);
    const measuredAt = theme.performance_report?.measured_at || theme.accessibility_report?.measured_at;
    const compatibilityRows: Array<{ term: string; values: string[] }> = [
        { term: 'Browsers', values: stringArray(theme.compatibility?.browsers) },
        { term: 'Locales', values: stringArray(theme.compatibility?.locales) },
        {
            term: 'Platforms',
            values: stringArray(theme.compatibility?.platforms).length > 0
                ? stringArray(theme.compatibility?.platforms)
                : theme.supported_platforms,
        },
        { term: 'Minimum viewport', values: theme.compatibility?.minimum_viewport ? [theme.compatibility.minimum_viewport] : [] },
    ];

    return (
        <Section title="Quality facts" description="Performance, accessibility, compatibility, and version history from marketplace data." className="px-0 py-0">
            <div className="grid gap-[var(--lb-space-3)] lg:grid-cols-2">
                <Card layout="stack" className="gap-[var(--lb-space-3)] p-[var(--lb-density-card-padding)]">
                    <h3 className="m-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                        Measured scores
                    </h3>
                    <dl className="grid grid-cols-2 gap-[var(--lb-space-3)]">
                        <div className="rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] p-[var(--lb-space-3)]">
                            <dt className="text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">Performance</dt>
                            <dd className="m-0 text-[length:var(--lb-font-size-heading-3)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]" data-testid="theme-performance-score">
                                {scoreLabel(performance)}
                            </dd>
                        </div>
                        <div className="rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] p-[var(--lb-space-3)]">
                            <dt className="text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">Accessibility</dt>
                            <dd className="m-0 text-[length:var(--lb-font-size-heading-3)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]" data-testid="theme-accessibility-score">
                                {scoreLabel(accessibility)}
                            </dd>
                        </div>
                    </dl>
                    <p className="m-0 text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                        {measuredAt ? `Measured ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(measuredAt))}` : 'Score appears after the local measurement job records data for this theme.'}
                    </p>
                </Card>

                <Card layout="stack" className="gap-[var(--lb-space-3)] p-[var(--lb-density-card-padding)]">
                    <h3 className="m-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                        Compatibility matrix
                    </h3>
                    <dl className="grid gap-[var(--lb-space-3)]" data-testid="theme-compatibility-matrix">
                        {compatibilityRows.map(({ term, values }) => (
                            <div key={term} className="grid gap-[var(--lb-space-1)]">
                                <dt className="text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text-subdued)]">{term}</dt>
                                <dd className="m-0 text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]">
                                    {values.length > 0 ? values.join(', ') : 'Not specified'}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </Card>
            </div>
        </Section>
    );
}

export function ThemeChangelog({ theme }: { theme: Theme }) {
    const entries = changelogEntries(theme);

    return (
        <Section title="Changelog" description="Version history published with the theme listing." className="px-0 py-0">
            <Card layout="stack" className="gap-[var(--lb-space-3)] p-[var(--lb-density-card-padding)]" data-testid="theme-changelog">
                {entries.length > 0 ? entries.map((entry) => (
                    <article key={entry.version} className="rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] p-[var(--lb-space-3)]">
                        <div className="flex flex-wrap items-center justify-between gap-[var(--lb-space-2)]">
                            <h3 className="m-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                                v{entry.version}
                            </h3>
                            {entry.released_at && (
                                <time className="text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]" dateTime={entry.released_at}>
                                    {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(entry.released_at))}
                                </time>
                            )}
                        </div>
                        <ul className="m-0 mt-[var(--lb-space-2)] grid gap-[var(--lb-space-1)] pl-[var(--lb-space-4)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]">
                            {entry.changes.map((change) => <li key={change}>{change}</li>)}
                        </ul>
                    </article>
                )) : (
                    <p className="m-0 text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]">
                        Changelog entries are not published for this theme yet.
                    </p>
                )}
            </Card>
        </Section>
    );
}

export function ThemeDetailSharePanel({ theme }: { theme: Theme }) {
    return (
        <Card layout="stack" className="gap-[var(--lb-space-3)] p-[var(--lb-density-card-padding)]">
            <h2 className="m-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                Share
            </h2>
            <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                Copy a canonical marketplace link for this theme.
            </p>
            <ThemeShareButton slug={theme.slug} name={theme.name} />
        </Card>
    );
}
