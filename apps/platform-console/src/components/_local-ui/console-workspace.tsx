import type { ReactNode } from 'react';

// [CONSOLIDATE -> @letbuyy/ui] Internal-app dashboard grammar for platform leadership surfaces.
export function ConsoleWorkspace({
    eyebrow,
    title,
    description,
    children,
}: {
    eyebrow: string;
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <main className="mx-auto flex w-full max-w-7xl flex-col gap-[var(--lb-space-5)] px-[var(--lb-space-4)] py-[var(--lb-space-5)] text-[var(--lb-color-text)] sm:px-[var(--lb-space-5)] lg:px-[var(--lb-space-6)]">
            <header className="flex flex-col gap-[var(--lb-space-2)]">
                <p className="m-0 text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase leading-[var(--lb-line-height-caption)] text-[var(--lb-color-primary)]">
                    {eyebrow}
                </p>
                <h1 className="m-0 text-[var(--lb-font-size-display)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-display)] text-[var(--lb-color-text)]">
                    {title}
                </h1>
                <p className="m-0 max-w-3xl text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                    {description}
                </p>
            </header>
            {children}
        </main>
    );
}

export function MetricGrid({ children }: { children: ReactNode }) {
    return <section className="grid gap-[var(--lb-space-4)] sm:grid-cols-2 xl:grid-cols-4">{children}</section>;
}

export function LeadershipMetric({
    label,
    value,
    detail,
    tone = 'neutral',
}: {
    label: string;
    value: string;
    detail?: string;
    tone?: 'neutral' | 'success' | 'warning' | 'critical';
}) {
    const toneClass = {
        neutral: 'text-[var(--lb-color-text-subdued)]',
        success: 'text-[var(--lb-color-success)]',
        warning: 'text-[var(--lb-color-warning)]',
        critical: 'text-[var(--lb-color-critical)]',
    }[tone];

    return (
        <article className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-5)] shadow-[var(--lb-shadow-sm)]">
            <p className="m-0 text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                {label}
            </p>
            <p className="m-0 mt-[var(--lb-space-2)] text-[var(--lb-font-size-display)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-display)] text-[var(--lb-color-text)]">
                {value}
            </p>
            {detail ? (
                <p className={`m-0 mt-[var(--lb-space-2)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] ${toneClass}`}>
                    {detail}
                </p>
            ) : null}
        </article>
    );
}

export function Panel({
    title,
    description,
    children,
    action,
}: {
    title: string;
    description?: string;
    children: ReactNode;
    action?: ReactNode;
}) {
    return (
        <section className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] shadow-[var(--lb-shadow-sm)]">
            <div className="flex flex-col gap-[var(--lb-space-3)] border-b border-[var(--lb-color-border)] p-[var(--lb-space-5)] md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                    <h2 className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">
                        {title}
                    </h2>
                    {description ? (
                        <p className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                            {description}
                        </p>
                    ) : null}
                </div>
                {action}
            </div>
            <div className="p-[var(--lb-space-5)]">{children}</div>
        </section>
    );
}

export function ModuleGrid({ children }: { children: ReactNode }) {
    return <section className="grid gap-[var(--lb-space-4)] lg:grid-cols-2 2xl:grid-cols-3">{children}</section>;
}

export function ModuleCard({
    title,
    description,
    href,
    status,
    details,
}: {
    title: string;
    description: string;
    href: string;
    status: string;
    details: string;
}) {
    return (
        <a
            href={href}
            className="group rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-5)] shadow-[var(--lb-shadow-sm)] transition-colors hover:border-[var(--lb-color-primary)] hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
        >
            <div className="flex items-start justify-between gap-[var(--lb-space-3)]">
                <div className="min-w-0">
                    <h2 className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">
                        {title}
                    </h2>
                    <p className="m-0 mt-[var(--lb-space-2)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                        {description}
                    </p>
                </div>
                <StatusPill value={status} />
            </div>
            <p className="m-0 mt-[var(--lb-space-4)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                {details}
            </p>
        </a>
    );
}

export function StatusPill({ value, tone }: { value: string; tone?: 'success' | 'warning' | 'critical' | 'info' }) {
    const normalized = value.toLowerCase();
    const resolvedTone = tone
        || (['healthy', 'active', 'passed', 'configured', 'published', 'approved'].includes(normalized)
            ? 'success'
            : ['critical', 'failed', 'missing', 'suspended', 'rejected'].includes(normalized)
                ? 'critical'
                : ['pending', 'warning', 'trialing', 'past_due', 'changes_requested'].includes(normalized)
                    ? 'warning'
                    : 'info');
    const toneClass = {
        success: 'border-[var(--lb-color-success)] bg-[var(--lb-color-success-soft)] text-[var(--lb-color-success)]',
        warning: 'border-[var(--lb-color-warning)] bg-[var(--lb-color-warning-soft)] text-[var(--lb-color-warning)]',
        critical: 'border-[var(--lb-color-critical)] bg-[var(--lb-color-critical-soft)] text-[var(--lb-color-critical)]',
        info: 'border-[var(--lb-color-info)] bg-[var(--lb-color-info-soft)] text-[var(--lb-color-info)]',
    }[resolvedTone];

    return (
        <span className={`inline-flex shrink-0 items-center rounded-[var(--lb-radius-full)] border px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] ${toneClass}`}>
            {value.replace(/_/g, ' ')}
        </span>
    );
}

export function SkipBackendPanel({
    title,
    contract,
    children,
}: {
    title: string;
    contract: string;
    children: ReactNode;
}) {
    return (
        <section className="rounded-[var(--lb-radius-lg)] border border-dashed border-[var(--lb-color-warning)] bg-[var(--lb-color-warning-soft)] p-[var(--lb-space-4)]">
            <p className="m-0 text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase leading-[var(--lb-line-height-caption)] text-[var(--lb-color-warning)]">
                [SKIP -- NEEDS BACKEND]
            </p>
            <h2 className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                {title}
            </h2>
            <p className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                Missing contract: {contract}
            </p>
            <div className="mt-[var(--lb-space-3)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                {children}
            </div>
        </section>
    );
}

export function EmptyDataState({ message }: { message: string }) {
    return (
        <div className="rounded-[var(--lb-radius-lg)] border border-dashed border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-6)] text-center text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
            {message}
        </div>
    );
}
