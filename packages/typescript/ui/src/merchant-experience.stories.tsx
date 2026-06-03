'use client';

import React, { useState } from 'react';
import {
    AppWindow,
    Avatar,
    Badge,
    Banner,
    Button,
    Card,
    CheckCircle2,
    CommandPalette,
    Combobox,
    ConfirmDialog,
    ColorPreviewButton,
    ColorSwatch,
    DataTable,
    EmptyState,
    IndexTable,
    Input,
    MaterialIcon,
    MetricCard,
    Modal,
    Page,
    PageHeader,
    Pagination,
    RadiusPreview,
    SaveBar,
    Section,
    Select,
    Skeleton,
    Tabs,
    Textarea,
    ToastProvider,
    Tooltip,
    letbuyyTokens,
    useToast,
} from './index';

interface ProductStoryRow extends Record<string, unknown> {
    id: string;
    title: string;
    status: string;
    inventory: string;
    channel: string;
}

const sampleRows: ProductStoryRow[] = [
    { id: 'prod-1', title: 'Classic Sneakers', status: 'Active', inventory: '42', channel: 'Online Store' },
    { id: 'prod-2', title: 'Canvas Tote', status: 'Draft', inventory: '18', channel: 'Point of Sale' },
    { id: 'prod-3', title: 'Everyday Hoodie', status: 'Active', inventory: '7', channel: 'Online Store' },
];

function ToastDemo() {
    const { notify } = useToast();
    return (
        <Button
            onClick={() => notify({
                title: 'Product saved',
                description: 'Classic Sneakers is ready for the Online Store.',
                variant: 'success',
            })}
        >
            Show toast
        </Button>
    );
}

function OverlayDemo() {
    const [modalOpen, setModalOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    return (
        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
            <Button variant="secondary" onClick={() => setModalOpen(true)}>
                Open modal
            </Button>
            <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
                Confirm delete
            </Button>
            <Modal
                open={modalOpen}
                title="Edit collection"
                description="Update the customer-facing collection details."
                onClose={() => setModalOpen(false)}
                footer={<Button onClick={() => setModalOpen(false)}>Done</Button>}
            >
                <div className="space-y-[var(--lb-space-4)]">
                    <Input label="Collection title" defaultValue="Featured products" />
                    <Textarea label="Description" defaultValue="A curated list of best-selling products." />
                </div>
            </Modal>
            <ConfirmDialog
                open={confirmOpen}
                title="Delete product"
                description="This product will be removed from every sales channel."
                destructive
                confirmLabel="Delete"
                onConfirm={() => setConfirmOpen(false)}
                onClose={() => setConfirmOpen(false)}
            />
        </div>
    );
}

function CommandPaletteDemo() {
    const [open, setOpen] = useState(true);

    return (
        <>
            <Button variant="secondary" onClick={() => setOpen(true)}>
                Open command palette
            </Button>
            <CommandPalette
                open={open}
                onClose={() => setOpen(false)}
                actions={[
                    {
                        id: 'create-product',
                        label: 'Create product',
                        description: 'Add a new product to the catalog',
                        shortcut: 'n p',
                        icon: <MaterialIcon name="products" />,
                        onSelect: () => setOpen(false),
                    },
                    {
                        id: 'find-order',
                        label: 'Find order',
                        description: 'Search orders by customer or ID',
                        shortcut: 'g o',
                        icon: <MaterialIcon name="orders" />,
                        onSelect: () => setOpen(false),
                    },
                ]}
            />
        </>
    );
}

export default {
    title: 'Merchant Experience/Design System',
};

export function TokenSystem() {
    const lightColors = letbuyyTokens.color.light;

    return (
        <Page>
            <PageHeader
                eyebrow="LetBuyy tokens"
                title="Brand-led neutral system"
                description="A 90 percent neutral merchant UI foundation with violet and indigo accents reserved for focus, action, selection, and status emphasis."
            />
            <div className="grid gap-[var(--lb-space-4)] md:grid-cols-3">
                <Card>
                    <Section title="Brand accents" description="Primary and secondary brand tokens stay exact to the WS1 mission.">
                        <div className="grid gap-[var(--lb-space-3)]">
                            <div className="flex items-center gap-[var(--lb-space-3)]">
                                <ColorSwatch color={lightColors.primary} label="Primary #8B5CF6" size="lg" shape="rounded" />
                                <div>
                                    <p className="m-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">Primary</p>
                                    <p className="m-0 text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">{lightColors.primary}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-[var(--lb-space-3)]">
                                <ColorSwatch color={lightColors.secondary} label="Secondary #6366F1" size="lg" shape="rounded" />
                                <div>
                                    <p className="m-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">Secondary</p>
                                    <p className="m-0 text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">{lightColors.secondary}</p>
                                </div>
                            </div>
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section title="Action contrast" description="Interactive backgrounds use action tokens so foreground contrast remains AA.">
                        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                            <Button>Primary action</Button>
                            <Button variant="secondary">Secondary action</Button>
                            <Button variant="outline">Outline action</Button>
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section title="Motion and shape" description="Radius, shadow, and motion values are semantic CSS variables.">
                        <div className="grid gap-[var(--lb-space-2)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                            <code className="rounded-[var(--lb-radius-md)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-2)]">--lb-radius-lg = {letbuyyTokens.radius.lg}</code>
                            <code className="rounded-[var(--lb-radius-md)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-2)]">--lb-shadow-sm = {letbuyyTokens.shadow.sm}</code>
                            <code className="rounded-[var(--lb-radius-md)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-2)]">--lb-motion-fast = {letbuyyTokens.motion.duration.fast}</code>
                        </div>
                    </Section>
                </Card>
            </div>
        </Page>
    );
}

export function UsageGuidelines() {
    return (
        <Page>
            <PageHeader
                eyebrow="Design system guardrails"
                title="Merchant UI grammar"
                description="Compose merchant screens from shared primitives, semantic tokens, explicit feedback, and keyboard-safe interactions."
            />
            <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                <Card>
                    <Section title="Page structure" description="Start every admin screen with Page, PageHeader, Card, then Section.">
                        <div className="space-y-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text-subdued)]">
                            <p className="m-0">Use the same skeleton for dashboards, settings, lists, editors, and workflow steps.</p>
                            <Badge label="Page -> PageHeader -> Card -> Section" variant="info" />
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section title="Tokens only" description="Use semantic CSS variables for color, spacing, type, radius, shadow, motion, and component sizing.">
                        <div className="grid gap-[var(--lb-space-2)]">
                            {['--lb-color-surface', '--lb-color-text', '--lb-space-4', '--lb-radius-lg', '--lb-shadow-sm'].map((token) => (
                                <code
                                    key={token}
                                    className="rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text)]"
                                >
                                    {token}
                                </code>
                            ))}
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section title="Feedback by default" description="Loading, empty, mutation, saved, and destructive states need explicit UI.">
                        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                            <Badge label="Skeleton" variant="default" />
                            <Badge label="EmptyState" variant="info" />
                            <Badge label="Toast" variant="success" />
                            <Badge label="SaveBar" variant="warning" />
                            <Badge label="ConfirmDialog" variant="critical" />
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section title="Accessibility baseline" description="Controls must be keyboard reachable, labelled, focus-visible, and contrast-safe.">
                        <div className="space-y-[var(--lb-space-3)]">
                            <Button variant="secondary">Focusable control</Button>
                            <Banner title="Accessible status" variant="success">
                                Status content uses semantic roles and tokenized contrast.
                            </Banner>
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section title="Dynamic previews" description="Centralize merchant-provided colors and radii with shared preview primitives.">
                        <div className="flex flex-wrap items-center gap-[var(--lb-space-3)]">
                            <ColorSwatch color="#6366f1" label="Indigo swatch" size="lg" />
                            <ColorSwatch color="#22c55e" label="Green swatch" size="lg" />
                            <RadiusPreview
                                radius={12}
                                label="Radius preview 12px"
                                className="grid h-[var(--lb-size-control-lg)] w-[var(--lb-size-control-lg)] place-items-center border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] text-[color:var(--lb-color-text-subdued)]"
                            >
                                12
                            </RadiusPreview>
                            <ColorPreviewButton color="#111827" radius={12} className="h-[var(--lb-size-control-md)] px-[var(--lb-space-4)] text-[color:var(--lb-color-text-inverse)]">
                                Preview CTA
                            </ColorPreviewButton>
                        </div>
                    </Section>
                </Card>
            </div>
        </Page>
    );
}

export function PageGrammar() {
    return (
        <Page>
            <PageHeader
                eyebrow="Merchant control plane"
                title="Products"
                description="Manage products, inventory, channels, and product publishing from one place."
                breadcrumbs={[{ label: 'Home', href: '#' }, { label: 'Products' }]}
                primaryAction={{ label: 'Add product', icon: <MaterialIcon name="add" /> }}
                secondaryActions={[{ label: 'Export' }]}
            />
            <Card>
                <Section
                    title="Catalog health"
                    description="Keep storefront-ready products in stock and visible."
                    action={<Badge label="Active" variant="success" />}
                >
                    <div className="grid gap-[var(--lb-space-4)] md:grid-cols-3">
                        <MetricCard label="Revenue" value="₹86,240" delta="+12.4% from last week" deltaTone="positive" sparkline={[4, 8, 7, 12, 18, 15, 22]} />
                        <MetricCard label="Orders" value="128" delta="+8 new today" deltaTone="positive" sparkline={[3, 5, 6, 8, 7, 11, 12]} />
                        <MetricCard label="Low stock" value="7" delta="Needs review" deltaTone="negative" sparkline={[12, 11, 9, 8, 8, 7, 7]} />
                    </div>
                </Section>
            </Card>
        </Page>
    );
}

export function FormsAndFeedback() {
    return (
        <ToastProvider>
            <Page>
                <PageHeader title="Settings" description="Token-driven controls, feedback, and save states." />
                <Card>
                    <Section title="Store profile" description="A compact form with consistent validation and save feedback.">
                        <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                            <Input label="Store name" defaultValue="Urban Kicks Demo" helperText="Shown in checkout and emails." />
                            <Select
                                label="Primary market"
                                defaultValue="india"
                                options={[
                                    { label: 'India', value: 'india' },
                                    { label: 'United States', value: 'us' },
                                ]}
                            />
                            <Combobox
                                label="Default collection"
                                value="featured"
                                options={[
                                    { label: 'Featured products', value: 'featured' },
                                    { label: 'New arrivals', value: 'new' },
                                    { label: 'Sale', value: 'sale' },
                                ]}
                            />
                            <Textarea label="Public description" defaultValue="Premium everyday footwear and accessories." />
                        </div>
                        <Banner title="Payments need attention" variant="warning">
                            Add a payment provider before launching checkout.
                        </Banner>
                        <div className="flex flex-wrap gap-[var(--lb-space-3)]">
                            <ToastDemo />
                            <Tooltip content="This names the focused merchant workflow.">
                                <Button variant="ghost">Hover for tooltip</Button>
                            </Tooltip>
                        </div>
                    </Section>
                </Card>
                <SaveBar state="unsaved" />
            </Page>
        </ToastProvider>
    );
}

export function ComponentApiMatrix() {
    const [bannerVisible, setBannerVisible] = useState(true);

    return (
        <ToastProvider duration={0} maxToasts={2}>
            <Page>
                <PageHeader
                    eyebrow="Batch 2"
                    title="Hardened component APIs"
                    description="Additive props for merchant workflows: icon buttons, prefixed fields, dismissible feedback, richer tables, and controlled save states."
                />
                <div className="grid gap-[var(--lb-space-4)] lg:grid-cols-2">
                    <Card>
                        <Section title="Button and fields" description="Optional icons, pressed state, prefixes, suffixes, label actions, and required indicators.">
                            <div className="grid gap-[var(--lb-space-4)]">
                                <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                    <Button icon={<MaterialIcon name="settings" />}>Configure</Button>
                                    <Button variant="secondary" trailingIcon={<MaterialIcon name="arrow_forward" />}>Review</Button>
                                    <Button variant="outline" pressed>Pressed filter</Button>
                                    <Button size="icon" variant="ghost" aria-label="Search" icon={<MaterialIcon name="search" />} />
                                </div>
                                <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                                    <Input
                                        label="Base price"
                                        requiredIndicator
                                        prefixContent="₹"
                                        suffixContent="INR"
                                        defaultValue="2499"
                                        helperText="Displayed price before discounts."
                                        labelAction={<Button size="sm" variant="ghost">Reset</Button>}
                                    />
                                    <Input
                                        label="Search customers"
                                        controlSize="lg"
                                        leftIcon={<MaterialIcon name="search" />}
                                        placeholder="Name, email, or order ID"
                                    />
                                </div>
                            </div>
                        </Section>
                    </Card>
                    <Card>
                        <Section title="Feedback controls" description="Dismissible banners, persistent toasts, and explicit save controls.">
                            <div className="grid gap-[var(--lb-space-3)]">
                                {bannerVisible && (
                                    <Banner
                                        title="Inventory sync paused"
                                        variant="warning"
                                        onDismiss={() => setBannerVisible(false)}
                                        action={<Button size="sm" variant="secondary">Resume</Button>}
                                    >
                                        Reconnect the sales channel before publishing bulk edits.
                                    </Banner>
                                )}
                                <div className="flex">
                                    <ToastDemo />
                                </div>
                                <SaveBar
                                    state="unsaved"
                                    message="3 product edits pending"
                                    saveDisabled
                                    saveLabel="Save edits"
                                    discardLabel="Discard edits"
                                    className="!static !w-full"
                                />
                            </div>
                        </Section>
                    </Card>
                </div>
                <Card>
                    <Section title="DataTable compatibility upgrade" description="Caption, density, row keys, keyboard row activation, sticky headers, alignment, and row actions.">
                        <DataTable
                            caption="Product publishing table"
                            ariaLabel="Product publishing status"
                            density="compact"
                            stickyHeader
                            rowKey="id"
                            data={sampleRows}
                            columns={[
                                { key: 'title', header: 'Product', sortable: true },
                                { key: 'status', header: 'Status', render: (value) => <Badge label={String(value)} variant={value === 'Active' ? 'success' : 'warning'} /> },
                                { key: 'inventory', header: 'Inventory', align: 'end', sortable: true },
                                { key: 'channel', header: 'Channel' },
                            ]}
                            sortKey="title"
                            sortDirection="asc"
                            onSort={() => undefined}
                            onRowClick={() => undefined}
                            rowActions={(row) => (
                                <Button size="sm" variant="ghost" trailingIcon={<MaterialIcon name="visibility" />}>
                                    View {row.title}
                                </Button>
                            )}
                        />
                    </Section>
                </Card>
            </Page>
        </ToastProvider>
    );
}

export function EmptyAndLoadingStates() {
    return (
        <Page>
            <PageHeader title="Empty states" description="Designed blanks, skeletons, and next actions." />
            <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                <EmptyState
                    icon={<AppWindow className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                    title="No apps installed"
                    body="Browse vetted apps to add marketing, analytics, and fulfillment tools."
                    primaryAction={<Button>Browse apps</Button>}
                    secondaryAction={<Button variant="secondary">View recommendations</Button>}
                />
                <Card>
                    <Section title="Loading dashboard">
                        <Skeleton variant="card" />
                        <Skeleton lines={4} />
                    </Section>
                </Card>
            </div>
        </Page>
    );
}

export function TablesAndProductivity() {
    return (
        <Page>
            <PageHeader title="Index table" description="Bulk actions, saved views, filters, sorting, and dense scanning." />
            <IndexTable
                rows={sampleRows}
                savedViews={[
                    { label: 'All', value: 'all', count: 3 },
                    { label: 'Active', value: 'active', count: 2 },
                    { label: 'Draft', value: 'draft', count: 1 },
                ]}
                activeView="all"
                filterChips={[{ label: 'Channel: Online Store' }]}
                bulkActions={[
                    { label: 'Publish', onAction: () => undefined },
                    { label: 'Archive', destructive: true, onAction: () => undefined },
                ]}
                columns={[
                    { key: 'title', header: 'Product', sortable: true },
                    { key: 'status', header: 'Status', render: (row) => <Badge label={row.status} variant={row.status === 'Active' ? 'success' : 'warning'} /> },
                    { key: 'inventory', header: 'Inventory', sortable: true },
                    { key: 'channel', header: 'Channel' },
                ]}
                sortKey="title"
                sortDirection="asc"
            />
            <Card>
                <Section title="Data table compatibility">
                    <DataTable
                        data={sampleRows}
                        columns={[
                            { key: 'title', header: 'Product' },
                            { key: 'inventory', header: 'Inventory' },
                        ]}
                    />
                    <Pagination page={1} totalPages={4} onPageChange={() => undefined} />
                </Section>
            </Card>
        </Page>
    );
}

export function OverlaysAndCommandPalette() {
    return (
        <Page>
            <PageHeader title="Guided actions" description="Dialog safety and command-driven productivity." />
            <Card>
                <Section title="Overlays">
                    <div className="flex items-center gap-[var(--lb-space-3)]">
                        <Avatar name="Aarav Merchant" />
                        <Avatar name="LetBuyy Operations" size="lg" />
                        <Badge label="Built for LetBuyy" variant="info" />
                    </div>
                    <OverlayDemo />
                    <CommandPaletteDemo />
                </Section>
            </Card>
        </Page>
    );
}

export function StatusBadges() {
    return (
        <div className="flex flex-wrap gap-[var(--lb-space-2)] p-[var(--lb-space-5)]">
            <Badge label="Default" />
            <Badge label="Info" variant="info" />
            <Badge label="Success" variant="success" />
            <Badge label="Warning" variant="warning" />
            <Badge label="Critical" variant="critical" />
            <Badge label="Legacy danger alias" variant="danger" />
            <CheckCircle2 className="h-[var(--lb-size-control-sm)] w-[var(--lb-size-control-sm)] text-[color:var(--lb-color-success)]" aria-hidden="true" />
        </div>
    );
}
