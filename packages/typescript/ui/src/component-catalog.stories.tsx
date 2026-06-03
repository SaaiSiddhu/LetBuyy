'use client';

import React, { useState } from 'react';
import {
    AppWindow,
    Avatar,
    Badge,
    Banner,
    Button,
    Card,
    Chart,
    ColorPreviewBlock,
    ColorPreviewButton,
    ColorPreviewSurface,
    ColorSwatch,
    CommandPalette,
    Combobox,
    ConfirmDialog,
    DataTable,
    DateRangePicker,
    DensityToggle,
    DescriptionList,
    DesignSystemRoot,
    Divider,
    EmptyState,
    FilterBar,
    FilterChips,
    IndexTable,
    Input,
    MaterialIcon,
    MetricCard,
    Modal,
    Page,
    PageActions,
    PageContent,
    PageHeader,
    PageHeaderActions,
    PageShell,
    Pagination,
    ProgressBar,
    RadiusPreview,
    SaveBar,
    Section,
    Select,
    Skeleton,
    Spinner,
    TableFilterBar,
    Tabs,
    Textarea,
    TextStyle,
    ToastProvider,
    Tooltip,
    useToast,
} from './index';
import type { LetbuyyDensity } from './index';

interface StoryOrder extends Record<string, unknown> {
    id: string;
    order: string;
    customer: string;
    status: 'Paid' | 'Pending' | 'Refunded';
    total: string;
    channel: string;
}

interface StoryProduct {
    id: string;
    title: string;
    status: 'Active' | 'Draft';
    inventory: string;
    channel: string;
}

const orderRows: StoryOrder[] = [
    { id: 'order-1', order: '#LB-2108', customer: 'Aarav Mehta', status: 'Paid', total: 'INR 4,820', channel: 'Online Store' },
    { id: 'order-2', order: '#LB-2107', customer: 'Priya Shah', status: 'Pending', total: 'INR 2,410', channel: 'Point of Sale' },
    { id: 'order-3', order: '#LB-2106', customer: 'Neha Rao', status: 'Refunded', total: 'INR 1,190', channel: 'Online Store' },
];

const productRows: StoryProduct[] = [
    { id: 'product-1', title: 'Classic Sneakers', status: 'Active', inventory: '42 in stock', channel: 'Online Store' },
    { id: 'product-2', title: 'Canvas Tote', status: 'Draft', inventory: '18 in stock', channel: 'Draft' },
    { id: 'product-3', title: 'Everyday Hoodie', status: 'Active', inventory: '7 in stock', channel: 'Online Store' },
];

const chartData = [
    { label: 'Mon', value: 18 },
    { label: 'Tue', value: 24 },
    { label: 'Wed', value: 20 },
    { label: 'Thu', value: 34 },
    { label: 'Fri', value: 28 },
    { label: 'Sat', value: 42 },
    { label: 'Sun', value: 38 },
];

const marketOptions = [
    { label: 'India', value: 'india' },
    { label: 'United States', value: 'us' },
    { label: 'United Kingdom', value: 'uk' },
];

function StoryFrame({ children }: { children: React.ReactNode }) {
    return (
        <DesignSystemRoot theme="light" density="compact" surface="admin">
            <div className="min-h-screen bg-[var(--lb-color-bg)] text-[color:var(--lb-color-text)]">
                {children}
            </div>
        </DesignSystemRoot>
    );
}

function statusBadge(status: StoryOrder['status'] | StoryProduct['status']) {
    if (status === 'Paid' || status === 'Active') return <Badge label={status} variant="success" />;
    if (status === 'Pending') return <Badge label={status} variant="warning" />;
    if (status === 'Refunded') return <Badge label={status} variant="critical" />;
    return <Badge label={status} variant="default" />;
}

function ToastTrigger() {
    const { notify } = useToast();

    return (
        <Button
            variant="secondary"
            onClick={() => notify({
                title: 'Preview saved',
                description: 'Tokenized toast feedback is visible and dismissible.',
                variant: 'success',
            })}
        >
            Show toast
        </Button>
    );
}

function OverlayControls() {
    const [modalOpen, setModalOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [commandOpen, setCommandOpen] = useState(false);

    return (
        <>
            <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                <Button variant="secondary" onClick={() => setModalOpen(true)}>
                    Open modal
                </Button>
                <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
                    Confirm action
                </Button>
                <Button variant="outline" onClick={() => setCommandOpen(true)}>
                    Command palette
                </Button>
            </div>
            <Modal
                open={modalOpen}
                title="Edit storefront section"
                description="Modal content uses responsive spacing and labelled controls."
                onClose={() => setModalOpen(false)}
                footer={(
                    <>
                        <Button variant="secondary" onClick={() => setModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={() => setModalOpen(false)}>
                            Save
                        </Button>
                    </>
                )}
            >
                <div className="grid gap-[var(--lb-space-4)]">
                    <Input label="Section title" defaultValue="Featured arrivals" />
                    <Textarea label="Section note" defaultValue="Use concise merchant copy with visible validation states." />
                </div>
            </Modal>
            <ConfirmDialog
                open={confirmOpen}
                title="Archive theme"
                description="Use ConfirmDialog for destructive or irreversible merchant actions."
                destructive
                confirmLabel="Archive"
                onConfirm={() => setConfirmOpen(false)}
                onClose={() => setConfirmOpen(false)}
            />
            <CommandPalette
                open={commandOpen}
                onClose={() => setCommandOpen(false)}
                actions={[
                    {
                        id: 'add-product',
                        label: 'Add product',
                        description: 'Create a new product listing',
                        shortcut: 'n p',
                        icon: <MaterialIcon name="products" />,
                        onSelect: () => setCommandOpen(false),
                    },
                    {
                        id: 'review-orders',
                        label: 'Review orders',
                        description: 'Open order exceptions',
                        shortcut: 'g o',
                        icon: <MaterialIcon name="orders" />,
                        onSelect: () => setCommandOpen(false),
                    },
                ]}
            />
        </>
    );
}

export default {
    title: 'LetBuyy UI/Component Catalog',
};

export function CoreControlsAndLayout() {
    const [market, setMarket] = useState('india');

    return (
        <StoryFrame>
            <PageShell>
                <PageHeader
                    eyebrow="Component catalog"
                    title="Core controls and layout"
                    description="Use these primitives for merchant forms, settings, and repeated operational workflows."
                    showEyebrow
                    showDescription
                    showBreadcrumbs
                    breadcrumbs={[{ label: 'Design system', href: '#' }, { label: 'Catalog' }]}
                    primaryAction={{ label: 'Primary action', icon: <MaterialIcon name="add" /> }}
                    secondaryActions={[{ label: 'Secondary' }]}
                />
                <PageContent>
                    <Card>
                        <Section
                            title="Buttons, inputs, and selection"
                            description="Controls expose labelled states, focus rings, and density-aware sizing."
                            columns={2}
                        >
                            <div className="grid gap-[var(--lb-space-3)]">
                                <PageHeaderActions>
                                    <Button>Primary</Button>
                                    <Button variant="secondary">Secondary</Button>
                                    <Button variant="outline">Outline</Button>
                                    <Button variant="ghost">Ghost</Button>
                                    <Button variant="destructive">Destructive</Button>
                                    <Button loading>Loading</Button>
                                </PageHeaderActions>
                                <PageActions>
                                    <Button size="sm" variant="secondary">Small</Button>
                                    <Button size="lg">Large</Button>
                                    <Tooltip content="Icon button tooltip">
                                        <Button size="icon" variant="outline" aria-label="Open product tools">
                                            <MaterialIcon name="products" />
                                        </Button>
                                    </Tooltip>
                                </PageActions>
                            </div>
                            <div className="grid gap-[var(--lb-space-3)]">
                                <Input label="Store name" defaultValue="Urban Kicks Demo" helperText="Shown across checkout and email templates." />
                                <Textarea label="Announcement" defaultValue="Free shipping on prepaid orders this week." />
                                <Select
                                    label="Primary market"
                                    value={market}
                                    onChange={(event) => setMarket(event.target.value)}
                                    options={marketOptions}
                                />
                                <Combobox
                                    label="Fulfillment location"
                                    value="mumbai"
                                    options={[
                                        { label: 'Mumbai warehouse', value: 'mumbai' },
                                        { label: 'Delhi warehouse', value: 'delhi' },
                                        { label: 'Bengaluru studio', value: 'bengaluru' },
                                    ]}
                                />
                            </div>
                        </Section>
                    </Card>
                    <Card layout="split">
                        <Section title="Text, badges, and preview tokens" description="Use semantic tone and preview helpers for configurable merchant surfaces.">
                            <div className="grid gap-[var(--lb-space-3)]">
                                <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                    <Badge label="Default" />
                                    <Badge label="Info" variant="info" />
                                    <Badge label="Success" variant="success" />
                                    <Badge label="Warning" variant="warning" />
                                    <Badge label="Critical" variant="critical" />
                                </div>
                                <div className="grid gap-[var(--lb-space-2)]">
                                    <TextStyle variant="strong">Strong merchant label</TextStyle>
                                    <TextStyle variant="subdued">Subdued helper copy for dense forms.</TextStyle>
                                    <TextStyle variant="positive">Positive trend copy.</TextStyle>
                                    <TextStyle variant="negative">Negative exception copy.</TextStyle>
                                    <TextStyle variant="code">--lb-component-card-bg</TextStyle>
                                </div>
                            </div>
                        </Section>
                        <Section title="Theme preview helpers" description="Use preview primitives for user-selected colors and radii without ad-hoc CSS.">
                            <div className="grid gap-[var(--lb-space-3)]">
                                <div className="flex flex-wrap items-center gap-[var(--lb-space-3)]">
                                    <ColorSwatch color="var(--lb-color-primary)" label="Primary token" size="lg" />
                                    <ColorPreviewBlock color="var(--lb-color-success)" label="Success preview" className="h-[var(--lb-size-control-lg)] w-[var(--lb-size-control-lg)] rounded-[var(--lb-radius-md)]" />
                                    <RadiusPreview
                                        radius="var(--lb-radius-xl)"
                                        label="Large radius preview"
                                        className="grid h-[var(--lb-size-control-lg)] w-[var(--lb-size-control-lg)] place-items-center border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)]"
                                    >
                                        R
                                    </RadiusPreview>
                                </div>
                                <ColorPreviewSurface color="var(--lb-color-primary-soft)" label="Primary soft surface" className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] p-[var(--lb-space-3)]">
                                    <TextStyle variant="strong">Preview surface</TextStyle>
                                </ColorPreviewSurface>
                                <ColorPreviewButton color="var(--lb-component-button-primary-bg)" className="h-[var(--lb-density-button-height)] px-[var(--lb-space-4)] text-[color:var(--lb-component-button-primary-text)]">
                                    Preview CTA
                                </ColorPreviewButton>
                            </div>
                        </Section>
                    </Card>
                </PageContent>
            </PageShell>
        </StoryFrame>
    );
}

export function DataNavigationAndAnalytics() {
    const [density, setDensity] = useState<LetbuyyDensity>('compact');

    return (
        <StoryFrame>
            <Page>
                <PageHeader
                    title="Data, navigation, and analytics"
                    description="Use these components for list workflows, dashboard scanning, and drill-down navigation."
                    showDescription
                    primaryAction={{ label: 'Export' }}
                />
                <div className="grid gap-[var(--lb-space-4)]">
                    <Card>
                        <Section title="Analytics cards and chart" description="Charts and metrics use semantic tokens and responsive sizing.">
                            <div className="grid gap-[var(--lb-space-4)] lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                                <div className="grid gap-[var(--lb-space-3)]">
                                    <MetricCard label="Revenue" value="INR 2.4L" delta="+12.8% this week" deltaTone="positive" sparkline={[8, 12, 10, 18, 22, 20, 28]} />
                                    <MetricCard label="Exceptions" value="7" delta="Needs review" deltaTone="negative" sparkline={[12, 10, 11, 9, 8, 8, 7]} />
                                </div>
                                <Chart ariaLabel="Weekly revenue chart" data={chartData} type="area" valueFormatter={(value) => `INR ${value}K`} />
                            </div>
                        </Section>
                    </Card>
                    <Card>
                        <Section title="Filters and table tools" description="FilterBar, TableFilterBar, FilterChips, DateRangePicker, and DensityToggle keep dense lists scannable.">
                            <div className="grid gap-[var(--lb-space-3)]">
                                <FilterBar
                                    search={<Input label="Search orders" defaultValue="#LB" />}
                                    filters={<DateRangePicker label="Order date" value={{ start: '2026-06-01', end: '2026-06-07', compareToPrevious: true }} onChange={() => undefined} />}
                                    chips={<FilterChips chips={[{ id: 'paid', label: 'Paid', onRemove: () => undefined }, { id: 'online', label: 'Online Store', onRemove: () => undefined }]} onClearAll={() => undefined} />}
                                    actions={<DensityToggle value={density} onChange={setDensity} />}
                                />
                                <TableFilterBar
                                    search={<TextStyle variant="subdued">TableFilterBar shares FilterBar behavior for index pages.</TextStyle>}
                                    actions={<Badge label={`Density: ${density}`} variant="info" />}
                                />
                                <DataTable
                                    columns={[
                                        { key: 'order', header: 'Order', sortable: true },
                                        { key: 'customer', header: 'Customer' },
                                        { key: 'status', header: 'Status', render: (value) => statusBadge(value as StoryOrder['status']) },
                                        { key: 'total', header: 'Total' },
                                    ]}
                                    data={orderRows}
                                    sortKey="order"
                                    sortDirection="desc"
                                />
                            </div>
                        </Section>
                    </Card>
                    <Card>
                        <Section title="Index tables and navigation" description="IndexTable switches to card rows on mobile and keeps bulk selection accessible.">
                            <div className="grid gap-[var(--lb-space-3)]">
                                <IndexTable
                                    rows={productRows}
                                    columns={[
                                        { key: 'title', header: 'Product', sortable: true, render: (row) => <TextStyle variant="strong">{row.title}</TextStyle> },
                                        { key: 'status', header: 'Status', render: (row) => statusBadge(row.status) },
                                        { key: 'inventory', header: 'Inventory' },
                                        { key: 'channel', header: 'Channel' },
                                    ]}
                                    savedViews={[
                                        { label: 'All', value: 'all', count: 3 },
                                        { label: 'Active', value: 'active', count: 2 },
                                    ]}
                                    activeView="all"
                                    filterChips={[{ label: 'Online Store' }]}
                                    sortKey="title"
                                    sortDirection="asc"
                                    onSort={() => undefined}
                                    onRowClick={() => undefined}
                                    emptyState={<EmptyState kind="products" title="No products" body="Create the first product before publishing a storefront." />}
                                />
                                <div className="flex flex-col gap-[var(--lb-space-3)] md:flex-row md:items-center md:justify-between">
                                    <Pagination page={2} totalPages={8} onPageChange={() => undefined} />
                                    <DescriptionList
                                        columns={2}
                                        items={[
                                            { term: 'Current view', description: 'All products' },
                                            { term: 'Rows selected', description: '0' },
                                        ]}
                                    />
                                </div>
                            </div>
                        </Section>
                    </Card>
                </div>
            </Page>
        </StoryFrame>
    );
}

export function FeedbackOverlaysAndResponsiveStates() {
    return (
        <StoryFrame>
            <ToastProvider>
                <Page>
                    <PageHeader
                        title="Feedback and overlays"
                        description="Use these components for loading, empty, destructive, and guided workflow states."
                        showDescription
                    />
                    <div className="grid gap-[var(--lb-space-4)]">
                        <Card>
                            <Section title="Feedback primitives" description="Banners, toasts, progress, spinner, skeleton, and empty states make async work explicit.">
                                <div className="grid gap-[var(--lb-space-4)] lg:grid-cols-2">
                                    <div className="grid gap-[var(--lb-space-3)]">
                                        <Banner title="Inventory sync complete" variant="success">
                                            Stock counts were updated for all online channels.
                                        </Banner>
                                        <Banner title="Payment review required" variant="warning" action={<Button variant="secondary">Review</Button>}>
                                            One payout has a missing settlement reference.
                                        </Banner>
                                        <ProgressBar label="Setup guide" value={68} showValue />
                                        <TextStyle variant="subdued">4 of 6 tasks complete</TextStyle>
                                        <div className="flex flex-wrap items-center gap-[var(--lb-space-3)]">
                                            <Spinner label="Loading analytics" />
                                            <ToastTrigger />
                                        </div>
                                    </div>
                                    <div className="grid gap-[var(--lb-space-3)]">
                                        <Skeleton variant="text" lines={4} />
                                        <Skeleton variant="card" />
                                        <EmptyState
                                            kind="apps"
                                            title="No apps installed"
                                            body="Use EmptyState for first-run and filtered-empty list states."
                                            primaryAction={<Button>Browse apps</Button>}
                                            secondaryAction={<Button variant="secondary">Learn more</Button>}
                                        />
                                    </div>
                                </div>
                            </Section>
                        </Card>
                        <Card layout="split">
                            <Section title="Overlays" description="Modal, ConfirmDialog, Tooltip, ToastProvider, and CommandPalette cover interruptive workflows.">
                                <div className="grid gap-[var(--lb-space-3)]">
                                    <OverlayControls />
                                    <Tooltip content="Tooltips name compact icon-only controls.">
                                        <Button size="icon" variant="outline" aria-label="Open analytics">
                                            <AppWindow />
                                        </Button>
                                    </Tooltip>
                                </div>
                            </Section>
                            <Section title="Responsive status layout" description="Tabs, SaveBar, Divider, Avatar, and compact cards stack cleanly on mobile." columns={1}>
                                <Tabs
                                    items={[
                                        {
                                            value: 'profile',
                                            label: 'Profile',
                                            content: (
                                                <div className="flex items-center gap-[var(--lb-space-3)]">
                                                    <Avatar name="Aarav Mehta" />
                                                    <TextStyle variant="strong">Aarav Mehta</TextStyle>
                                                </div>
                                            ),
                                        },
                                        {
                                            value: 'activity',
                                            label: 'Activity',
                                            badge: '3',
                                            content: <TextStyle variant="subdued">Recent merchant activity appears here.</TextStyle>,
                                        },
                                    ]}
                                />
                                <Divider />
                                <SaveBar state="unsaved" onSave={() => undefined} onDiscard={() => undefined} />
                            </Section>
                        </Card>
                    </div>
                </Page>
            </ToastProvider>
        </StoryFrame>
    );
}

FeedbackOverlaysAndResponsiveStates.parameters = {
    viewport: {
        defaultViewport: 'mobile1',
    },
};
