'use client';

import React from 'react';
import { Badge, Banner, Button, Card, Table, EmptyState, FilterBar, Input, MaterialIcon, MetricCard, Page, PageContent, PageHeader, Section, Textarea } from './index';
import {
    letbuyyDensityTokens,
    letbuyyColorTokens,
    letbuyyTokenCssVariables,
    type LetbuyyDensity,
    type LetbuyyTheme,
} from './tokens';

type TokenVariable = keyof typeof letbuyyTokenCssVariables.light;

interface TokenSpec {
    label: string;
    variable: TokenVariable;
    role: string;
}

interface StoryRow extends Record<string, unknown> {
    id: string;
    order: string;
    customer: string;
    status: string;
    total: string;
}

const primitiveTokenSpecs = [
    { label: 'Purple 500', variable: '--lb-primitive-color-purple-500', role: 'Brand accent' },
    { label: 'Purple 600', variable: '--lb-primitive-color-purple-600', role: 'Brand hover' },
    { label: 'Purple 700', variable: '--lb-primitive-color-purple-700', role: 'Brand active' },
    { label: 'Gray 100', variable: '--lb-primitive-color-gray-100', role: 'Light page background' },
    { label: 'Gray 200', variable: '--lb-primitive-color-gray-200', role: 'Light border' },
    { label: 'Purple 700', variable: '--lb-primitive-color-purple-700', role: 'AA primary CTA' },
] as const satisfies readonly TokenSpec[];

const brandTokenSpecs = [
    { label: 'Brand Accent', variable: '--lb-color-primary', role: 'Purple brand accent' },
    { label: 'Brand Hover', variable: '--lb-semantic-accent-hover', role: 'Accent hover' },
    { label: 'Brand Active', variable: '--lb-semantic-accent-active', role: 'Accent active' },
    { label: 'Brand Subtle', variable: '--lb-semantic-accent-subtle', role: 'Selected and focus tint' },
] as const satisfies readonly TokenSpec[];

const lightThemeTokenSpecs = [
    { label: 'Page Background', variable: '--lb-semantic-background-page', role: 'Light page canvas' },
    { label: 'Sidebar', variable: '--lb-semantic-background-sidebar', role: 'Light sidebar layer' },
    { label: 'Surface', variable: '--lb-semantic-background-surface', role: 'Light raised surface' },
    { label: 'Card', variable: '--lb-semantic-background-card', role: 'Light card surface' },
    { label: 'Border', variable: '--lb-semantic-border-default', role: 'Light border' },
    { label: 'Text Primary', variable: '--lb-color-text', role: 'Light primary text' },
    { label: 'Text Secondary', variable: '--lb-color-text-subdued', role: 'Light secondary text' },
    { label: 'Primary CTA', variable: '--lb-component-button-primary-bg', role: 'Light primary button background' },
    { label: 'Primary CTA Text', variable: '--lb-component-button-primary-text', role: 'Light primary button text' },
] as const satisfies readonly TokenSpec[];

const darkThemeTokenSpecs = [
    { label: 'Page Background', variable: '--lb-semantic-background-page', role: 'Dark page canvas' },
    { label: 'Sidebar', variable: '--lb-semantic-background-sidebar', role: 'Dark sidebar layer' },
    { label: 'Surface', variable: '--lb-semantic-background-surface', role: 'Dark raised surface' },
    { label: 'Card', variable: '--lb-semantic-background-card', role: 'Dark card surface' },
    { label: 'Border', variable: '--lb-semantic-border-default', role: 'Dark border' },
    { label: 'Text Primary', variable: '--lb-color-text', role: 'Dark primary text' },
    { label: 'Text Secondary', variable: '--lb-color-text-subdued', role: 'Dark secondary text' },
    { label: 'Primary CTA', variable: '--lb-component-button-primary-bg', role: 'Dark primary button background' },
    { label: 'Primary CTA Text', variable: '--lb-component-button-primary-text', role: 'Dark primary button text' },
] as const satisfies readonly TokenSpec[];

const componentTokenSpecs = [
    { label: 'Button Primary', variable: '--lb-component-button-primary-bg', role: 'Primary action background' },
    { label: 'Button Hover', variable: '--lb-component-button-primary-hover', role: 'Primary action hover' },
    { label: 'Button Active', variable: '--lb-component-button-primary-active', role: 'Primary action active' },
    { label: 'Button Text', variable: '--lb-component-button-primary-text', role: 'Primary action text' },
    { label: 'Card Background', variable: '--lb-component-card-bg', role: 'Card fill' },
    { label: 'Card Border', variable: '--lb-component-card-border', role: 'Card edge' },
    { label: 'Sidebar Background', variable: '--lb-component-sidebar-bg', role: 'Navigation layer' },
    { label: 'Sidebar Active', variable: '--lb-component-sidebar-active-bg', role: 'Selected navigation' },
    { label: 'Input Background', variable: '--lb-component-input-bg', role: 'Input fill' },
    { label: 'Table Header', variable: '--lb-component-table-header-bg', role: 'Table header fill' },
] as const satisfies readonly TokenSpec[];

const semanticTokenSpecs = [
    { label: 'Success', variable: '--lb-semantic-status-success', role: 'Completed and positive states' },
    { label: 'Warning', variable: '--lb-semantic-status-warning', role: 'Caution and pending states' },
    { label: 'Danger', variable: '--lb-semantic-status-danger', role: 'Error and destructive states' },
    { label: 'Info', variable: '--lb-semantic-status-info', role: 'Informational state only' },
] as const satisfies readonly TokenSpec[];

const storyRows: StoryRow[] = [
    { id: 'row-1', order: '#LB-1042', customer: 'Aarav Mehta', status: 'Paid', total: '₹4,820' },
    { id: 'row-2', order: '#LB-1041', customer: 'Priya Shah', status: 'Pending', total: '₹2,410' },
    { id: 'row-3', order: '#LB-1040', customer: 'Neha Rao', status: 'Refunded', total: '₹1,190' },
];

const spacingSpecs = [
    ['4', '--lb-space-1'],
    ['8', '--lb-space-2'],
    ['12', '--lb-space-3'],
    ['16', '--lb-space-4'],
    ['20', '--lb-space-5'],
    ['24', '--lb-space-6'],
    ['32', '--lb-space-7'],
    ['40', '--lb-space-8'],
] as const;

const typographySpecs = [
    ['Page Title', '--lb-font-size-page-title', '--lb-line-height-page-title', '24'],
    ['Section Title', '--lb-font-size-section-title', '--lb-line-height-section-title', '18'],
    ['Card Title', '--lb-font-size-card-title', '--lb-line-height-card-title', '16'],
    ['Body', '--lb-font-size-body', '--lb-line-height-body', '14'],
    ['Secondary', '--lb-font-size-secondary', '--lb-line-height-secondary', '13'],
    ['Table', '--lb-font-size-table', '--lb-line-height-table', '13'],
    ['Sidebar', '--lb-font-size-sidebar', '--lb-line-height-sidebar', '14'],
    ['Empty State', '--lb-font-size-empty-state', '--lb-line-height-empty-state', '14'],
    ['Caption', '--lb-font-size-caption', '--lb-line-height-caption', '12'],
] as const;

type DensityTokenKey = keyof typeof letbuyyDensityTokens.compact;

const densitySpecs: Array<{ label: string; variable: `--lb-density-${string}`; key: DensityTokenKey }> = [
    { label: 'Sidebar row', variable: '--lb-density-sidebar-row-height', key: 'sidebarRowHeight' },
    { label: 'Input height', variable: '--lb-density-input-height', key: 'inputHeight' },
    { label: 'Button height', variable: '--lb-density-button-height', key: 'buttonHeight' },
    { label: 'Icon button', variable: '--lb-density-icon-button-height', key: 'iconButtonHeight' },
    { label: 'Pill height', variable: '--lb-density-pill-height', key: 'pillHeight' },
    { label: 'Table row', variable: '--lb-density-table-row-height', key: 'tableRowHeight' },
    { label: 'Table header', variable: '--lb-density-table-header-height', key: 'tableHeaderHeight' },
    { label: 'Page gap', variable: '--lb-density-page-gap', key: 'pageGap' },
    { label: 'Card padding', variable: '--lb-density-card-padding', key: 'cardPadding' },
    { label: 'Header height', variable: '--lb-density-header-height', key: 'headerHeight' },
    { label: 'Empty illustration', variable: '--lb-density-empty-state-illustration-width', key: 'emptyStateIllustrationWidth' },
];

const emptyStateKinds = [
    'products',
    'collections',
    'inventory',
    'orders',
    'customers',
    'discounts',
    'marketing',
    'content',
    'domains',
    'themes',
    'analytics',
    'apps',
    'payments',
] as const;

function tokenValue(theme: LetbuyyTheme, variable: TokenVariable) {
    const variables = letbuyyTokenCssVariables[theme] as Record<TokenVariable, string>;
    return variables[variable];
}

function TokenSwatch({ spec, theme }: { spec: TokenSpec; theme?: LetbuyyTheme }) {
    const value = theme ? tokenValue(theme, spec.variable) : `var(${spec.variable})`;

    return (
        <div className="overflow-hidden rounded-[var(--lb-component-card-radius)] border border-[var(--lb-component-card-border)] bg-[var(--lb-component-card-bg)] shadow-[var(--lb-component-card-shadow)]">
            <div
                className="h-[var(--lb-size-control-lg)] border-b border-[var(--lb-component-card-border)]"
                style={{ background: `var(${spec.variable})` }}
                aria-hidden="true"
            />
            <div className="space-y-[var(--lb-space-1)] p-[var(--lb-space-3)]">
                <div className="flex items-start justify-between gap-[var(--lb-space-3)]">
                    <p className="m-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                        {spec.label}
                    </p>
                    <code className="rounded-[var(--lb-radius-md)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                        {value}
                    </code>
                </div>
                <p className="m-0 text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                    {spec.variable}
                </p>
                <p className="m-0 text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                    {spec.role}
                </p>
            </div>
        </div>
    );
}

function TokenGrid({ title, description, specs, theme }: { title: string; description: string; specs: readonly TokenSpec[]; theme: LetbuyyTheme }) {
    return (
        <Card>
            <Section title={title} description={description}>
                <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2 xl:grid-cols-4">
                    {specs.map((spec) => (
                        <TokenSwatch key={spec.variable} spec={spec} theme={theme} />
                    ))}
                </div>
            </Section>
        </Card>
    );
}

function TokenFrame({ theme, density = 'compact', children }: { theme?: LetbuyyTheme; density?: LetbuyyDensity; children: React.ReactNode }) {
    return (
        <div
            data-theme={theme}
            data-density={density}
            data-letbuyy-density={density}
            className="min-h-screen bg-[var(--lb-semantic-background-page)] p-[var(--lb-space-5)] text-[color:var(--lb-color-text)]"
        >
            <div className="mx-auto flex max-w-[var(--lb-size-page-max)] flex-col gap-[var(--lb-space-5)]">
                {children}
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    if (status === 'Paid') return <Badge label={status} variant="success" />;
    if (status === 'Pending') return <Badge label={status} variant="warning" />;
    return <Badge label={status} variant="critical" />;
}

function DashboardMetrics() {
    return (
        <div className="grid gap-[var(--lb-space-4)] md:grid-cols-3">
            <MetricCard label="Revenue" value="₹2.4L" delta="+12.8% this week" deltaTone="positive" sparkline={[8, 12, 10, 18, 22, 20, 28]} />
            <MetricCard label="Orders" value="482" delta="+38 today" deltaTone="positive" sparkline={[4, 8, 9, 12, 14, 13, 18]} />
            <MetricCard label="Exceptions" value="7" delta="Needs review" deltaTone="negative" sparkline={[12, 10, 11, 9, 8, 8, 7]} />
        </div>
    );
}

export default {
    title: 'Design Tokens',
};

export function DesignTokens() {
    return (
        <TokenFrame theme="light">
            <PageHeader
                eyebrow="Pro Theme V2"
                title="Design Tokens"
                description="Primitive, semantic, and component token layers rendered from the shared LetBuyy UI package."
            />
            <TokenGrid title="Primitive Tokens" description="Raw color values used to compose semantic tokens." specs={primitiveTokenSpecs} theme="light" />
            <TokenGrid title="Brand Colors" description={`Brand accent source: ${letbuyyColorTokens.brandPurple}`} specs={brandTokenSpecs} theme="light" />
            <TokenGrid title="Component Tokens" description="Component color contracts consume semantic tokens rather than page-level overrides." specs={componentTokenSpecs} theme="light" />
            <TokenGrid title="Semantic Colors" description="State colors stay separate from brand and CTA colors." specs={semanticTokenSpecs} theme="light" />
        </TokenFrame>
    );
}

export function Colors() {
    return <DesignTokens />;
}

export function LightTheme() {
    return (
        <TokenFrame theme="light">
            <PageHeader
                eyebrow="Light mode"
                title="Light Theme"
                description="Soft grey page canvas, white cards, purple primary actions, and purple brand accents."
                primaryAction={{ label: 'Create' }}
                secondaryActions={[{ label: 'Export' }]}
            />
            <TokenGrid title="Light Theme Tokens" description="Light mode resolves hierarchy and CTA strategy from centralized variables." specs={lightThemeTokenSpecs} theme="light" />
            <ButtonHierarchyContent />
        </TokenFrame>
    );
}

export function DarkTheme() {
    return (
        <TokenFrame theme="dark">
            <PageHeader
                eyebrow="Dark mode"
                title="Dark Theme"
                description="Dark mode uses deep surfaces, clear borders, white text, and purple primary actions."
                primaryAction={{ label: 'Create' }}
                secondaryActions={[{ label: 'Export' }]}
            />
            <TokenGrid title="Dark Theme Tokens" description="Dark mode resolves hierarchy and CTA strategy from centralized variables." specs={darkThemeTokenSpecs} theme="dark" />
            <ButtonHierarchyContent />
        </TokenFrame>
    );
}

export function BrandColors() {
    return (
        <TokenFrame theme="light">
            <TokenGrid title="Brand Colors" description={`Brand accent source: ${letbuyyColorTokens.brandPurple}`} specs={brandTokenSpecs} theme="light" />
        </TokenFrame>
    );
}

export function SemanticColors() {
    return (
        <TokenFrame theme="light">
            <TokenGrid title="Semantic Colors" description="Semantic status colors are preserved as non-brand tokens." specs={semanticTokenSpecs} theme="light" />
        </TokenFrame>
    );
}

function SurfaceHierarchyContent() {
    return (
        <Card>
            <Section title="Surface Hierarchy" description="Page, surface, and card colors are deliberately different in the token layer.">
                <div className="rounded-[var(--lb-component-card-radius)] border border-[var(--lb-color-border)] bg-[var(--lb-semantic-background-page)] p-[var(--lb-space-5)]">
                    <div className="grid gap-[var(--lb-space-4)] md:grid-cols-3">
                        <div className="rounded-[var(--lb-component-card-radius)] border border-[var(--lb-color-border)] bg-[var(--lb-semantic-background-surface)] p-[var(--lb-space-4)]">
                            <p className="m-0 text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text-subdued)]">Surface</p>
                            <p className="m-0 text-[length:var(--lb-font-size-h3)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">Navigation shell</p>
                        </div>
                        <div className="rounded-[var(--lb-component-card-radius)] border border-[var(--lb-component-card-border)] bg-[var(--lb-component-card-bg)] p-[var(--lb-space-4)] shadow-[var(--lb-component-card-shadow)]">
                            <p className="m-0 text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text-subdued)]">Card</p>
                            <p className="m-0 text-[length:var(--lb-font-size-h3)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">Primary content</p>
                        </div>
                        <div className="rounded-[var(--lb-component-card-radius)] border border-[var(--lb-color-primary)] bg-[var(--lb-semantic-accent-subtle)] p-[var(--lb-space-4)]">
                            <p className="m-0 text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-primary)]">Accent</p>
                            <p className="m-0 text-[length:var(--lb-font-size-h3)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">Selected state</p>
                        </div>
                    </div>
                </div>
            </Section>
        </Card>
    );
}

function SpacingScaleContent() {
    return (
        <Card>
            <Section title="Spacing Scale" description="The official spacing scale is 4, 8, 12, 16, 24, 32, 48, and 64.">
                <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2 xl:grid-cols-4">
                    {spacingSpecs.map(([label, variable]) => (
                        <div key={variable} className="rounded-[var(--lb-component-card-radius)] border border-[var(--lb-component-card-border)] bg-[var(--lb-component-card-bg)] p-[var(--lb-space-4)]">
                            <div className="mb-[var(--lb-space-3)] h-[var(--lb-space-4)] rounded-[var(--lb-radius-full)] bg-[var(--lb-semantic-accent-subtle)]">
                                <div className="h-full rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary)]" style={{ width: `var(${variable})` }} />
                            </div>
                            <p className="m-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">{label}px</p>
                            <code className="text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">{variable}</code>
                        </div>
                    ))}
                </div>
            </Section>
        </Card>
    );
}

function TypographyScaleContent() {
    return (
        <Card>
            <Section title="Typography Scale" description="Display, heading, body, small, and caption sizes use only 400, 500, 600, and 700 weights.">
                <div className="space-y-[var(--lb-space-3)]">
                    {typographySpecs.map(([label, sizeVar, lineVar, px]) => (
                        <div key={sizeVar} className="rounded-[var(--lb-radius-md)] border border-[var(--lb-component-card-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
                            <p className="m-0 font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]" style={{ fontSize: `var(${sizeVar})`, lineHeight: `var(${lineVar})` }}>
                                {label}
                            </p>
                            <p className="m-0 text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                                {px}px / {sizeVar} / weights 400, 500, 600, 700
                            </p>
                        </div>
                    ))}
                </div>
            </Section>
        </Card>
    );
}

function SidebarHierarchyContent() {
    const navItems = ['Dashboard', 'Products', 'Orders', 'Customers'];
    const supportItems = ['Sales channels', 'Apps', 'Settings'];

    return (
        <div className="grid gap-[var(--lb-space-5)] lg:grid-cols-[280px_1fr]">
            <aside className="rounded-[var(--lb-component-card-radius)] border border-[var(--lb-component-sidebar-border)] bg-[var(--lb-component-sidebar-bg)] p-[var(--lb-space-3)]">
                <div className="space-y-[var(--lb-space-1)]">
                    {navItems.map((item, index) => (
                        <div
                            key={item}
                            className="rounded-[var(--lb-component-sidebar-item-radius)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[length:var(--lb-font-size-small)] font-[var(--lb-font-weight-semibold)]"
                            style={{
                                background: index === 1 ? 'var(--lb-component-sidebar-active-bg)' : 'transparent',
                                color: index === 1 ? 'var(--lb-component-sidebar-active-text)' : 'var(--lb-color-text)',
                            }}
                        >
                            {item}
                        </div>
                    ))}
                </div>
                <div className="mt-[var(--lb-space-5)] space-y-[var(--lb-space-4)]">
                    {supportItems.map((section) => (
                        <div key={section}>
                            <p className="m-0 px-[var(--lb-space-3)] pb-[var(--lb-space-2)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-component-sidebar-section-text)]">
                                {section}
                            </p>
                            <div className="rounded-[var(--lb-component-sidebar-item-radius)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[length:var(--lb-font-size-small)] text-[color:var(--lb-color-text-subdued)]">
                                Manage {section.toLowerCase()}
                            </div>
                        </div>
                    ))}
                </div>
            </aside>
            <div className="rounded-[var(--lb-component-card-radius)] bg-[var(--lb-semantic-background-page)] p-[var(--lb-space-5)]">
                <Card>
                    <Section title="Content Canvas" description="The sidebar, page canvas, and card surface are three separate layers.">
                        <DashboardMetrics />
                    </Section>
                </Card>
            </div>
        </div>
    );
}

function OnboardingPreviewContent() {
    const steps = [
        ['Products', 'Add your first sellable product', 'Done'],
        ['Theme', 'Choose the storefront look', 'Done'],
        ['Domain', 'Connect a custom domain', 'Blocked'],
        ['Payments', 'Enable checkout collection', 'Next'],
        ['Launch', 'Publish the storefront', 'Waiting'],
    ];

    return (
        <div className="space-y-[var(--lb-space-5)]">
            <Card>
                <Section title="Welcome Hero" description="A guided setup narrative gives merchants a next step, completion state, and blockers.">
                    <div className="grid gap-[var(--lb-space-5)] lg:grid-cols-[1fr_280px]">
                        <div>
                            <p className="m-0 text-[length:var(--lb-font-size-h2)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-h2)] text-[color:var(--lb-color-text)]">
                                Launch your store with the essentials in place.
                            </p>
                            <p className="mt-[var(--lb-space-2)] max-w-[var(--lb-size-content-measure)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text-subdued)]">
                                Products and theme are ready. Domain and payments are the current launch blockers.
                            </p>
                        </div>
                        <div className="rounded-[var(--lb-component-card-radius)] border border-[var(--lb-component-card-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
                            <p className="m-0 text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text-subdued)]">Setup progress</p>
                            <p className="m-0 text-[length:var(--lb-font-size-h2)] font-[var(--lb-font-weight-bold)] leading-[var(--lb-line-height-h2)] text-[color:var(--lb-color-text)]">40%</p>
                            <div className="mt-[var(--lb-space-3)] h-[var(--lb-space-2)] rounded-[var(--lb-radius-full)] bg-[var(--lb-component-card-border)]">
                                <div className="h-full w-2/5 rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary)]" />
                            </div>
                        </div>
                    </div>
                </Section>
            </Card>
            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-5">
                {steps.map(([title, body, status]) => (
                    <Card key={title}>
                        <Section title={title} description={body}>
                            <Badge label={status} variant={status === 'Blocked' ? 'warning' : status === 'Done' ? 'success' : 'default'} />
                        </Section>
                    </Card>
                ))}
            </div>
        </div>
    );
}

function EmptyStateSystemContent() {
    return (
        <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2 xl:grid-cols-3">
            {emptyStateKinds.map((kind) => (
                <EmptyState
                    key={kind}
                    kind={kind}
                    title={`${kind.charAt(0).toUpperCase()}${kind.slice(1)} empty state`}
                    body="Illustration, title, description, primary action, and secondary action are supplied through the shared component contract."
                    primaryAction={<Button>Add</Button>}
                    secondaryAction={<Button variant="secondary">Learn more</Button>}
                />
            ))}
        </div>
    );
}

export function SurfaceHierarchy() {
    return (
        <TokenFrame>
            <PageHeader title="Surface Hierarchy" description="The page canvas is soft grey in light mode while cards remain white." />
            <SurfaceHierarchyContent />
        </TokenFrame>
    );
}

function ButtonHierarchyContent() {
    return (
        <Card>
            <Section title="Button Hierarchy" description="Primary buttons use component tokens. Light and dark modes use the AA-safe purple brand ramp. Text remains white.">
                <div className="flex flex-wrap items-center gap-[var(--lb-space-3)]">
                    <Button>Add product</Button>
                    <Button>Save</Button>
                    <Button>Publish</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                </div>
                <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                    <TokenSwatch spec={{ label: 'Primary BG', variable: '--lb-component-button-primary-bg', role: 'Component primary background' }} />
                    <TokenSwatch spec={{ label: 'Primary Text', variable: '--lb-component-button-primary-text', role: 'Component primary text' }} />
                    <TokenSwatch spec={{ label: 'Brand Accent', variable: '--lb-color-primary', role: 'Interactive accent' }} />
                </div>
            </Section>
        </Card>
    );
}

export function ButtonHierarchy() {
    return (
        <TokenFrame>
            <PageHeader title="Button Hierarchy" description="Primary action, secondary action, and accent tokens stay separate." />
            <ButtonHierarchyContent />
        </TokenFrame>
    );
}

export function SpacingScale() {
    return (
        <TokenFrame>
            <PageHeader title="Spacing Scale" description="Official spacing tokens for margins, padding, card gaps, headers, forms, and tables." />
            <SpacingScaleContent />
        </TokenFrame>
    );
}

export function TypographyScale() {
    return (
        <TokenFrame>
            <PageHeader title="Typography Scale" description="Tokenized display, heading, body, small, and caption styles." />
            <TypographyScaleContent />
        </TokenFrame>
    );
}

export function SidebarHierarchy() {
    return (
        <TokenFrame>
            <PageHeader title="Sidebar Hierarchy" description="Sidebar, page canvas, and card layers are separate in both light and dark mode." />
            <SidebarHierarchyContent />
        </TokenFrame>
    );
}

export function CardHierarchy() {
    return (
        <TokenFrame>
            <PageHeader title="Card Hierarchy" description="Cards remain white in light mode, with page depth supplied by the background token." />
            <SurfaceHierarchyContent />
            <div className="grid gap-[var(--lb-space-4)] md:grid-cols-3">
                <Card><Section title="Card"><p className="m-0 text-[color:var(--lb-color-text-subdued)]">Default content card.</p></Section></Card>
                <Card><Section title="Form Card"><Input label="Store name" defaultValue="LetBuyy Demo" /></Section></Card>
                <Card><Section title="Status Card"><Badge label="Selected" /><p className="m-0 text-[color:var(--lb-color-text-subdued)]">Purple is reserved for accents.</p></Section></Card>
            </div>
        </TokenFrame>
    );
}

export function AdminDashboardPreview() {
    return (
        <TokenFrame>
            <Page>
                <PageHeader
                    eyebrow="Merchant control plane"
                    title="Dashboard"
                    description="A token-only preview of the shared admin hierarchy."
                    primaryAction={{ label: 'Create' }}
                    secondaryActions={[{ label: 'Export' }]}
                />
                <DashboardMetrics />
                <OnboardingPreviewContent />
                <Card>
                    <Section title="Store readiness" description="Operational panels inherit surface, border, and text tokens.">
                        <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                            <Badge label="Products live" variant="success" />
                            <Badge label="Checkout pending" variant="warning" />
                            <Badge label="Theme selected" />
                        </div>
                    </Section>
                </Card>
                <EmptyState kind="analytics" title="No campaign selected" body="Use brand accents for selected states and highlights, not as the page canvas." primaryAction={<Button>Create campaign</Button>} secondaryAction={<Button variant="secondary">View templates</Button>} />
            </Page>
        </TokenFrame>
    );
}

export function OnboardingPreview() {
    return (
        <TokenFrame>
            <PageHeader title="Onboarding Preview" description="Dashboard setup flow preview: hero, progress, products, theme, domain, payments, and launch." />
            <OnboardingPreviewContent />
        </TokenFrame>
    );
}

export function EmptyStateSystem() {
    return (
        <TokenFrame>
            <PageHeader title="Empty State System" description="Required illustration packs for products, collections, inventory, orders, customers, discounts, domains, themes, analytics, apps, and payments." />
            <EmptyStateSystemContent />
        </TokenFrame>
    );
}

export function SettingsPreview() {
    return (
        <TokenFrame>
            <Page>
                <PageHeader
                    eyebrow="Settings"
                    title="Store settings"
                    description="Forms, cards, and theme controls inherit V2 component tokens."
                    primaryAction={{ label: 'Save' }}
                    secondaryActions={[{ label: 'Discard' }]}
                />
                <Card>
                    <Section title="Store profile" description="Input colors and focus states are centralized in component tokens.">
                        <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                            <Input label="Store name" defaultValue="LetBuyy Demo" />
                            <Input label="Support email" defaultValue="support@example.com" />
                            <Textarea label="Public description" defaultValue="Premium everyday commerce, configured with shared tokens." />
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section title="Theme editor" description="Purple appears as selected tabs, focus states, badges, and indicators.">
                        <div className="grid gap-[var(--lb-space-3)] md:grid-cols-4">
                            {brandTokenSpecs.map((spec) => (
                                <TokenSwatch key={spec.variable} spec={spec} theme="light" />
                            ))}
                        </div>
                    </Section>
                </Card>
                <Banner title="Token source" variant="info">
                    This Storybook preview reads the same shared CSS variable names consumed by the components.
                </Banner>
            </Page>
        </TokenFrame>
    );
}

export function TablePreview() {
    return (
        <TokenFrame>
            <Page>
                <PageHeader
                    eyebrow="Orders"
                    title="Order table"
                    description="Table background, header, row hover, text, and border colors resolve from component table tokens."
                    primaryAction={{ label: 'Create order' }}
                    secondaryActions={[{ label: 'Export' }]}
                />
                <Card>
                    <Section title="Recent orders" description="Dense operational tables keep neutral surfaces and semantic statuses.">
                        <Table
                            rows={storyRows}
                            columns={[
                                { key: 'order', header: 'Order', sortable: true },
                                { key: 'customer', header: 'Customer' },
                                { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                                { key: 'total', header: 'Total' },
                            ]}
                            sortKey="order"
                            sortDirection="desc"
                        />
                    </Section>
                </Card>
            </Page>
        </TokenFrame>
    );
}

export function CompactMerchantShell() {
    return (
        <TokenFrame>
            <div className="grid min-h-[720px] overflow-hidden rounded-[var(--lb-component-card-radius)] border border-[var(--lb-color-border)] bg-[var(--lb-content-bg)] shadow-[var(--lb-component-card-shadow)] lg:grid-cols-[240px_1fr]">
                <aside className="border-r border-[var(--lb-component-sidebar-border)] bg-[var(--lb-sidebar-bg)] p-[var(--lb-space-3)]">
                    <div className="mb-[var(--lb-space-4)] flex h-[var(--lb-size-control-md)] items-center gap-[var(--lb-space-2)] px-[var(--lb-space-2)] text-[length:var(--lb-font-size-small)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                        <span className="grid h-[var(--lb-size-control-sm)] w-[var(--lb-size-control-sm)] place-items-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-primary)] text-[color:var(--lb-color-text-inverse)]">L</span>
                        Urban Kicks
                    </div>
                    {['Dashboard', 'Products', 'Orders', 'Customers', 'Analytics'].map((item, index) => (
                        <div
                            key={item}
                            className="mb-[var(--lb-space-1)] flex min-h-[var(--lb-size-control-sm)] items-center gap-[var(--lb-space-2)] rounded-[var(--lb-component-sidebar-item-radius)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-small)] font-[var(--lb-font-weight-medium)]"
                            style={{
                                background: index === 1 ? 'var(--lb-component-sidebar-active-bg)' : 'transparent',
                                color: index === 1 ? 'var(--lb-component-sidebar-active-text)' : 'var(--lb-color-text-subdued)',
                            }}
                        >
                            <MaterialIcon name={item.toLowerCase() === 'analytics' ? 'analytics' : item.toLowerCase()} />
                            {item}
                        </div>
                    ))}
                    <div className="mt-[var(--lb-space-5)] border-t border-[var(--lb-component-sidebar-border)] pt-[var(--lb-space-4)]">
                        {['Sales channels', 'Apps', 'Settings'].map((section) => (
                            <p key={section} className="m-0 px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-component-sidebar-section-text)]">
                                {section}
                            </p>
                        ))}
                    </div>
                </aside>
                <Page className="max-w-none">
                    <PageHeader title="Products" primaryAction={{ label: 'Add product', icon: <MaterialIcon name="add" /> }} secondaryActions={[{ label: 'Collections' }]} />
                    <PageContent>
                        <FilterBar
                            search={<Input label="Search products" placeholder="Search products" leftIcon={<MaterialIcon name="search" />} />}
                            filters={<Button variant="secondary"><MaterialIcon name="filter_list" /> Filters</Button>}
                            actions={<Button variant="secondary"><MaterialIcon name="sync" /> Refresh</Button>}
                        />
                        <DashboardMetrics />
                        <TablePreviewContent />
                    </PageContent>
                </Page>
            </div>
        </TokenFrame>
    );
}

function TablePreviewContent() {
    return (
        <Table
            rows={storyRows}
            columns={[
                { key: 'order', header: 'Order', sortable: true },
                { key: 'customer', header: 'Customer' },
                { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                { key: 'total', header: 'Total' },
            ]}
            sortKey="order"
            sortDirection="desc"
        />
    );
}

export function TableDensity() {
    return (
        <TokenFrame>
            <PageHeader title="Table Density" primaryAction={{ label: 'Create order' }} secondaryActions={[{ label: 'Export' }]} />
            <FilterBar
                search={<Input label="Search orders" placeholder="Search order, customer, or status" leftIcon={<MaterialIcon name="search" />} />}
                filters={<Button variant="secondary"><MaterialIcon name="filter_list" /> Status</Button>}
                chips={<Badge label="Paid" variant="success" />}
                actions={<Button variant="secondary"><MaterialIcon name="sync" /> Refresh</Button>}
            />
            <TablePreviewContent />
        </TokenFrame>
    );
}

export function EmptyStateIllustrationsV2() {
    return (
        <TokenFrame>
            <PageHeader title="Empty Illustrations V2" primaryAction={{ label: 'Create' }} />
            <EmptyStateSystemContent />
        </TokenFrame>
    );
}

function DensityAuditContent() {
    return (
        <Card>
            <Section title="Density Audit" description="The compact admin density reduces vertical consumption through shared size variables, not page-level overrides.">
                <Table
                    rows={densitySpecs.map((spec) => ({
                        id: spec.key,
                        component: spec.label,
                        compact: letbuyyDensityTokens.compact[spec.key],
                        comfortable: letbuyyDensityTokens.comfortable[spec.key],
                        spacious: letbuyyDensityTokens.spacious[spec.key],
                        variable: spec.variable,
                    }))}
                    columns={[
                        { key: 'component', header: 'Component token' },
                        { key: 'compact', header: 'Compact' },
                        { key: 'comfortable', header: 'Comfortable' },
                        { key: 'spacious', header: 'Spacious' },
                        { key: 'variable', header: 'CSS variable' },
                    ]}
                />
            </Section>
        </Card>
    );
}

function DensityAdminSurface({ density, label, description }: { density: LetbuyyDensity; label: string; description: string }) {
    return (
        <div
            data-density={density}
            data-letbuyy-density={density}
            className="overflow-hidden rounded-[var(--lb-component-card-radius)] border border-[var(--lb-color-border)] bg-[var(--lb-content-bg)] shadow-[var(--lb-component-card-shadow)]"
        >
            <div className="grid min-h-[calc(var(--lb-density-sidebar-row-height)*13)] lg:grid-cols-[minmax(calc(var(--lb-density-sidebar-row-height)*5),calc(var(--lb-density-sidebar-row-height)*6))_1fr]">
                <aside className="border-r border-[var(--lb-component-sidebar-border)] bg-[var(--lb-sidebar-bg)] p-[var(--lb-space-3)]">
                    <div className="mb-[var(--lb-space-3)] flex h-[var(--lb-density-sidebar-row-height)] items-center gap-[var(--lb-space-2)] rounded-[var(--lb-component-sidebar-item-radius)] px-[var(--lb-space-2)] text-[length:var(--lb-font-size-sidebar)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                        <span className="grid h-[var(--lb-density-icon-button-height)] w-[var(--lb-density-icon-button-height)] place-items-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-primary)] text-[color:var(--lb-color-text-inverse)]">L</span>
                        Urban Kicks
                    </div>
                    {['Dashboard', 'Products', 'Orders', 'Customers', 'Marketing'].map((item, index) => (
                        <div
                            key={item}
                            className="mb-[var(--lb-space-1)] flex h-[var(--lb-density-sidebar-row-height)] items-center gap-[var(--lb-space-2)] rounded-[var(--lb-component-sidebar-item-radius)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-sidebar)] font-[var(--lb-font-weight-medium)] [&_.letbuyy-icon]:h-[var(--lb-density-sidebar-icon-size)] [&_.letbuyy-icon]:w-[var(--lb-density-sidebar-icon-size)]"
                            style={{
                                background: index === 1 ? 'var(--lb-component-sidebar-active-bg)' : 'transparent',
                                color: index === 1 ? 'var(--lb-component-sidebar-active-text)' : 'var(--lb-color-text-subdued)',
                            }}
                        >
                            <MaterialIcon name={item.toLowerCase() === 'marketing' ? 'marketing' : item.toLowerCase()} />
                            {item}
                        </div>
                    ))}
                    <div className="mt-[var(--lb-component-sidebar-section-spacing)] border-t border-[var(--lb-component-sidebar-border)] pt-[var(--lb-component-sidebar-nested-spacing)]">
                        {['Sales channels', 'Apps', 'Settings'].map((section) => (
                            <p key={section} className="m-0 px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-component-sidebar-section-text)]">
                                {section}
                            </p>
                        ))}
                    </div>
                </aside>
                <Page className="max-w-none">
                    <PageHeader
                        title={label}
                        description={description}
                        showDescription
                        primaryAction={{ label: 'Add product', icon: <MaterialIcon name="add" /> }}
                        secondaryActions={[{ label: 'Export' }]}
                    />
                    <PageContent>
                        <FilterBar
                            search={<Input placeholder="Search products" leftIcon={<MaterialIcon name="search" />} />}
                            filters={<Button variant="secondary"><MaterialIcon name="filter_list" /> Filter</Button>}
                            chips={<Badge label="Active" variant="success" />}
                            actions={<Button variant="secondary"><MaterialIcon name="sync" /> Refresh</Button>}
                        />
                        <DashboardMetrics />
                        <TablePreviewContent />
                        <EmptyState
                            kind="products"
                            title="No filtered products"
                            body="Empty states stay supportive and compact while actions remain visible."
                            primaryAction={<Button>Add product</Button>}
                            secondaryAction={<Button variant="secondary">Clear filters</Button>}
                        />
                    </PageContent>
                </Page>
            </div>
        </div>
    );
}

function DensityModePage({ density, label }: { density: LetbuyyDensity; label: string }) {
    return (
        <TokenFrame density={density}>
            <PageHeader title={`${label} Density`} description={`${label} mode is rendered by changing density tokens only.`} showDescription />
            <DensityAuditContent />
            <DensityAdminSurface density={density} label="Products" description="A dense merchant workspace composed from shared LetBuyy UI primitives." />
        </TokenFrame>
    );
}

export function DensityComparison() {
    return (
        <TokenFrame>
            <PageHeader
                title="Density Comparison"
                description="Before approximates the old spacious rhythm. After is the compact admin rhythm used by LetBuyy."
                showDescription
            />
            <div className="grid gap-[var(--lb-density-card-gap)] xl:grid-cols-2">
                <DensityAdminSurface density="spacious" label="Before: spacious" description="Large controls, taller rows, and higher card padding reduce above-the-fold information." />
                <DensityAdminSurface density="compact" label="After: compact" description="Compact controls, 44px rows, and tighter cards increase merchant productivity." />
            </div>
            <DensityAuditContent />
        </TokenFrame>
    );
}

export function CompactDensity() {
    return <DensityModePage density="compact" label="Compact" />;
}

export function ComfortableDensity() {
    return <DensityModePage density="comfortable" label="Comfortable" />;
}

export function SpaciousDensity() {
    return <DensityModePage density="spacious" label="Spacious" />;
}

export function ShopifyStyleAdminPreview() {
    return (
        <TokenFrame density="compact">
            <PageHeader title="Shopify-style Admin Preview" description="LetBuyy components rendered with compact enterprise density and LetBuyy brand tokens." showDescription />
            <DensityAdminSurface density="compact" label="Orders" description="Compact shell, toolbar, metrics, table, and empty-state rhythm from shared UI only." />
        </TokenFrame>
    );
}
