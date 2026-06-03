'use client';

import React, { useEffect, useRef, useState } from 'react';
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

function AutoToastDemo() {
    const { notify } = useToast();
    const shownRef = useRef(false);

    useEffect(() => {
        if (shownRef.current) return;
        shownRef.current = true;
        notify({
            title: 'Bulk update queued',
            description: '184 product changes are waiting for publishing review.',
            variant: 'success',
            duration: 0,
            dismissLabel: 'Dismiss bulk update toast',
            action: <Button size="sm" variant="secondary">Review queue</Button>,
        });
    }, [notify]);

    return (
        <Button
            variant="secondary"
            onClick={() => notify({
                title: 'Sync restarted',
                description: 'Inventory sync is running in the background.',
                variant: 'info',
                duration: 0,
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

export function WorkflowComponentHardening() {
    const [modalOpen, setModalOpen] = useState(true);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [page, setPage] = useState(3);

    return (
        <Page>
            <PageHeader
                eyebrow="Batch 3"
                title="Workflow component hardening"
                description="Expanded overlay, productivity, avatar, pagination, tooltip, and command APIs for dense merchant workflows."
                primaryAction={{ label: 'Open palette', icon: <MaterialIcon name="search" />, onClick: () => setPaletteOpen(true) }}
                secondaryActions={[{ label: 'Review modal', onClick: () => setModalOpen(true) }]}
            />
            <div className="grid gap-[var(--lb-space-4)] lg:grid-cols-[1.2fr_0.8fr]">
                <Card>
                    <Section title="Operational metrics" description="Metric cards support icons, secondary values, and loading states.">
                        <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                            <MetricCard
                                label="Conversion"
                                value="4.8%"
                                secondaryValue="Online store only"
                                delta="+0.6% from yesterday"
                                deltaTone="positive"
                                icon={<MaterialIcon name="analytics" />}
                                sparkline={[3, 4, 5, 4, 7, 8, 9]}
                            />
                            <MetricCard
                                label="Fulfillment risk"
                                value="12"
                                secondaryValue="Orders need SLA review"
                                delta="3 high priority"
                                deltaTone="negative"
                                icon={<MaterialIcon name="warning" />}
                                sparkline={[8, 7, 9, 12, 11, 14, 12]}
                            />
                            <MetricCard
                                label="Inventory sync"
                                value="Syncing"
                                loading
                                icon={<MaterialIcon name="sync" />}
                            />
                        </div>
                    </Section>
                </Card>
                <Card>
                    <Section title="Team and navigation" description="Avatars expose status labels and pagination can render page controls.">
                        <div className="grid gap-[var(--lb-space-4)]">
                            <div className="flex flex-wrap items-center gap-[var(--lb-space-3)]">
                                <Avatar name="Aarav Merchant" size="lg" status="online" statusLabel="Online" />
                                <Avatar name="Priya Support" status="away" statusLabel="Away" />
                                <Avatar name="LetBuyy Ops" size="sm" status="offline" statusLabel="Offline" />
                                <Tooltip content="Shows support availability without adding text noise." side="right" align="start">
                                    <Button size="icon" variant="ghost" aria-label="Status help" icon={<MaterialIcon name="info" />} />
                                </Tooltip>
                            </div>
                            <Pagination
                                page={page}
                                totalPages={8}
                                onPageChange={setPage}
                                showPageNumbers
                                siblingCount={2}
                                previousLabel="Previous orders page"
                                nextLabel="Next orders page"
                            />
                        </div>
                    </Section>
                </Card>
            </div>
            <Card>
                <Section title="Overlay controls" description="Modal and confirmation dialogs add sizing, dismissal, footer alignment, and guarded action states.">
                    <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                        <Button variant="secondary" onClick={() => setModalOpen(true)}>Open sized modal</Button>
                        <Button variant="destructive" onClick={() => setConfirmOpen(true)}>Open guarded confirm</Button>
                        <Button variant="outline" onClick={() => setPaletteOpen(true)}>Open grouped commands</Button>
                    </div>
                </Section>
            </Card>
            <Modal
                open={modalOpen}
                title="Review bulk product update"
                description="Large dialogs can lock overlay click dismissal and align footer actions for safer merchant changes."
                size="lg"
                closeOnOverlayClick={false}
                footerAlign="between"
                dismissLabel="Close product update review"
                onClose={() => setModalOpen(false)}
                footer={(
                    <>
                        <Button variant="ghost" onClick={() => setModalOpen(false)}>Keep editing</Button>
                        <div className="flex gap-[var(--lb-space-2)]">
                            <Button variant="secondary" onClick={() => setModalOpen(false)}>Schedule</Button>
                            <Button onClick={() => setModalOpen(false)} icon={<MaterialIcon name="check" />}>Apply update</Button>
                        </div>
                    </>
                )}
            >
                <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                    <Input label="Products selected" defaultValue="184" suffixContent="items" readOnly />
                    <Select
                        label="Publish channel"
                        defaultValue="online"
                        options={[
                            { label: 'Online Store', value: 'online' },
                            { label: 'Point of Sale', value: 'pos' },
                        ]}
                    />
                    <Banner title="Review inventory before publishing" variant="info" className="md:col-span-2">
                        Updates affect active products and storefront visibility.
                    </Banner>
                </div>
            </Modal>
            <ConfirmDialog
                open={confirmOpen}
                title="Archive selected products"
                description="Products will leave every active channel."
                destructive
                confirmLabel="Archive products"
                confirmDisabled
                closeOnOverlayClick={false}
                onConfirm={() => setConfirmOpen(false)}
                onClose={() => setConfirmOpen(false)}
            >
                <p className="m-0 text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text-subdued)]">
                    Resolve pending inventory holds before this destructive action can continue.
                </p>
            </ConfirmDialog>
            <CommandPalette
                open={paletteOpen}
                title="Merchant command center"
                placeholder="Search products, orders, or settings"
                emptyMessage="No merchant commands matched"
                footer="Grouped actions include disabled states and keyword matching."
                onClose={() => setPaletteOpen(false)}
                actions={[
                    {
                        id: 'publish-products',
                        label: 'Publish selected products',
                        description: 'Push selected items to Online Store',
                        group: 'Products',
                        keywords: ['catalog', 'channel'],
                        shortcut: 'P P',
                        icon: <MaterialIcon name="publish" />,
                        onSelect: () => setPaletteOpen(false),
                    },
                    {
                        id: 'sync-inventory',
                        label: 'Sync inventory now',
                        description: 'Request a fresh inventory sync',
                        group: 'Products',
                        keywords: ['stock', 'warehouse'],
                        shortcut: 'S I',
                        icon: <MaterialIcon name="sync" />,
                        onSelect: () => setPaletteOpen(false),
                    },
                    {
                        id: 'refund-order',
                        label: 'Refund selected order',
                        description: 'Unavailable while settlement is pending',
                        group: 'Orders',
                        disabled: true,
                        icon: <MaterialIcon name="payment" />,
                        onSelect: () => undefined,
                    },
                ]}
            />
        </Page>
    );
}

export function CommandPaletteWorkflowStates() {
    const [open, setOpen] = useState(true);

    return (
        <Page>
            <PageHeader
                eyebrow="Batch 3"
                title="Grouped command palette"
                description="CommandPalette now supports grouped actions, keyword matching, disabled actions, loading and empty copy, controlled query, and custom footer content."
            />
            <Card>
                <Section title="Palette trigger">
                    <Button onClick={() => setOpen(true)} icon={<MaterialIcon name="search" />}>Open grouped commands</Button>
                </Section>
            </Card>
            <CommandPalette
                open={open}
                title="Merchant command center"
                placeholder="Search merchant workflows"
                footer={(
                    <span>
                        Press Enter to run the selected command. Disabled commands stay visible for workflow context.
                    </span>
                )}
                onClose={() => setOpen(false)}
                actions={[
                    {
                        id: 'create-product',
                        label: 'Create product',
                        description: 'Add a new product to the catalog',
                        group: 'Products',
                        keywords: ['catalog', 'inventory'],
                        shortcut: 'N P',
                        icon: <MaterialIcon name="products" />,
                        onSelect: () => setOpen(false),
                    },
                    {
                        id: 'review-low-stock',
                        label: 'Review low stock',
                        description: 'Open inventory items below threshold',
                        group: 'Products',
                        keywords: ['inventory', 'stock'],
                        shortcut: 'G I',
                        icon: <MaterialIcon name="low_inventory" />,
                        onSelect: () => setOpen(false),
                    },
                    {
                        id: 'capture-payment',
                        label: 'Capture pending payment',
                        description: 'Unavailable until fraud review clears',
                        group: 'Orders',
                        disabled: true,
                        shortcut: 'C P',
                        icon: <MaterialIcon name="payments" />,
                        onSelect: () => undefined,
                    },
                    {
                        id: 'open-settings',
                        label: 'Open checkout settings',
                        description: 'Manage payment and shipping settings',
                        group: 'Settings',
                        keywords: ['checkout', 'payments', 'shipping'],
                        shortcut: 'G S',
                        icon: <MaterialIcon name="settings" />,
                        onSelect: () => setOpen(false),
                    },
                ]}
            />
        </Page>
    );
}

export function ControlComponentHardening() {
    const [tab, setTab] = useState('channels');
    const [market, setMarket] = useState('');
    const [collection, setCollection] = useState('new-arrivals');

    return (
        <Page>
            <PageHeader
                eyebrow="Batch 4"
                title="Control component hardening"
                description="Tabs, Select, and Combobox now support disabled states, richer labels, option metadata, and clearer ARIA/error wiring."
            />
            <div className="grid gap-[var(--lb-space-4)] lg:grid-cols-[0.9fr_1.1fr]">
                <Card>
                    <Section title="Pill tabs" description="Disabled tabs stay visible while keyboard navigation skips unavailable workflow steps.">
                        <Tabs
                            ariaLabel="Publishing workflow"
                            variant="pills"
                            value={tab}
                            onValueChange={setTab}
                            items={[
                                {
                                    value: 'channels',
                                    label: 'Channels',
                                    badge: '4',
                                    icon: <MaterialIcon name="storefront" />,
                                    content: (
                                        <Banner title="Online Store ready" variant="success">
                                            Product publishing can continue for active storefront channels.
                                        </Banner>
                                    ),
                                },
                                {
                                    value: 'inventory',
                                    label: 'Inventory',
                                    icon: <MaterialIcon name="inventory" />,
                                    content: (
                                        <Banner title="Inventory checked" variant="info">
                                            Stock rules are available for this catalog segment.
                                        </Banner>
                                    ),
                                },
                                {
                                    value: 'payments',
                                    label: 'Payments',
                                    icon: <MaterialIcon name="payments" />,
                                    disabled: true,
                                    content: null,
                                },
                            ]}
                        />
                    </Section>
                </Card>
                <Card>
                    <Section title="Native select" description="Select supports placeholder options, prefixes, required marks, label actions, and control sizing.">
                        <div className="grid gap-[var(--lb-space-4)]">
                            <Select
                                label="Primary market"
                                placeholder="Choose a market"
                                required
                                requiredIndicator
                                labelAction={<Button size="sm" variant="ghost">Reset</Button>}
                                prefixContent={<MaterialIcon name="language" />}
                                controlSize="lg"
                                value={market}
                                onChange={(event) => setMarket(event.target.value)}
                                helperText="Used for checkout currency, tax, and shipping defaults."
                                options={[
                                    { label: 'India', value: 'india' },
                                    { label: 'United States', value: 'us' },
                                    { label: 'United Kingdom', value: 'uk', disabled: true },
                                ]}
                            />
                            <Select
                                label="Fulfillment SLA"
                                defaultValue="same-day"
                                controlSize="sm"
                                options={[
                                    { label: 'Same day', value: 'same-day' },
                                    { label: 'Two business days', value: 'two-day' },
                                ]}
                            />
                        </div>
                    </Section>
                </Card>
            </div>
            <Card>
                <Section title="Combobox metadata" description="Combobox options can include descriptions, icons, keyword search, hidden form values, helper text, and disabled states.">
                    <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                        <Combobox
                            name="collection"
                            label="Default collection"
                            helperText="Search by visible label or hidden keyword metadata."
                            value={collection}
                            onValueChange={setCollection}
                            labelAction={<Button size="sm" variant="ghost">Manage</Button>}
                            requiredIndicator
                            options={[
                                {
                                    label: 'New arrivals',
                                    value: 'new-arrivals',
                                    description: 'Recently published products',
                                    keywords: ['fresh', 'latest'],
                                    icon: <MaterialIcon name="new_releases" />,
                                },
                                {
                                    label: 'Best sellers',
                                    value: 'best-sellers',
                                    description: 'Products with the highest order volume',
                                    keywords: ['popular', 'top'],
                                    icon: <MaterialIcon name="trending_up" />,
                                },
                                {
                                    label: 'Wholesale only',
                                    value: 'wholesale',
                                    description: 'Unavailable for Online Store publishing',
                                    disabled: true,
                                    icon: <MaterialIcon name="block" />,
                                },
                            ]}
                        />
                        <Combobox
                            label="Restricted channel"
                            value="locked"
                            disabled
                            error="Channel access is locked for this role."
                            options={[
                                { label: 'Locked channel', value: 'locked' },
                            ]}
                        />
                    </div>
                </Section>
            </Card>
        </Page>
    );
}

export function LayoutComponentHardening() {
    return (
        <Page width="narrow" gap="lg">
            <PageHeader
                compact
                eyebrow="Batch 5"
                title="Layout component hardening"
                titleMetadata={<Badge label="Stable" variant="success" />}
                subtitle={<span>Page, PageHeader, Card, and Section composition for merchant operations.</span>}
                description="Layout primitives now expose width, spacing, metadata, guarded actions, card headers, footers, tones, and section density without changing existing defaults."
                backAction={{ label: 'Products', href: '#', icon: <MaterialIcon name="arrow_back" />, ariaLabel: 'Back to products' }}
                breadcrumbs={[{ label: 'Catalog', href: '#' }, { label: 'Bulk update' }]}
                primaryAction={{ label: 'Publish changes', icon: <MaterialIcon name="publish" /> }}
                secondaryActions={[
                    { label: 'Preview', icon: <MaterialIcon name="visibility" /> },
                    { label: 'Delete draft', icon: <MaterialIcon name="delete" />, destructive: true },
                ]}
            />
            <Card
                title="Bulk update summary"
                description="Card headers and footers can now carry workflow copy and actions."
                action={<Button size="sm" variant="secondary" icon={<MaterialIcon name="edit" />}>Edit</Button>}
                footer={(
                    <div className="flex flex-wrap items-center justify-between gap-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                        <span>Last checked 2 minutes ago</span>
                        <Button size="sm" variant="ghost">View activity</Button>
                    </div>
                )}
                headerDivider
            >
                <Section
                    title="Publishing readiness"
                    description="Section density and footer slots keep operational screens compact."
                    action={<Badge label="Ready" variant="success" />}
                    headingLevel={3}
                    footer={<span className="text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">All readiness checks use shared semantic tokens.</span>}
                >
                    <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                        <MetricCard label="Products" value="184" secondaryValue="Selected for update" icon={<MaterialIcon name="products" />} />
                        <MetricCard label="Channels" value="3" secondaryValue="Online Store, POS, Market" icon={<MaterialIcon name="storefront" />} />
                        <MetricCard label="Risk" value="Low" secondaryValue="No blocked variants" icon={<MaterialIcon name="shield_lock" />} />
                    </div>
                </Section>
                <Section
                    title="Subdued detail band"
                    description="Use subdued sections for secondary settings inside the same card."
                    padding="sm"
                    divider
                    subdued
                    headingLevel={3}
                >
                    <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                        <Badge label="Inventory synced" variant="info" />
                        <Badge label="No pricing conflicts" variant="success" />
                        <Badge label="Checkout tested" variant="default" />
                    </div>
                </Section>
            </Card>
            <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                <Card title="Subdued card" description="Card tone can distinguish lower-priority work." tone="subdued" padding="md">
                    <p className="m-0 text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text-subdued)]">
                        Merchant settings panels can stay visually quiet while still using the shared card primitive.
                    </p>
                </Card>
                <Card title="Compact footer" description="Footer dividers can be disabled when cards sit inside grouped layouts." padding="md" footerDivider={false} footer={<Button size="sm" variant="secondary">Open settings</Button>}>
                    <p className="m-0 text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text-subdued)]">
                        Footer slots accept any token-driven command or status component.
                    </p>
                </Card>
            </div>
        </Page>
    );
}

export function FeedbackComponentHardening() {
    const [bannerVisible, setBannerVisible] = useState(true);

    return (
        <ToastProvider position="bottom-right" duration={0} maxToasts={2}>
            <Page>
                <PageHeader
                    eyebrow="Batch 6"
                    title="Feedback component hardening"
                    description="Feedback primitives now support richer badges, compact banners, positioned toasts, varied skeletons, flexible empty states, and SaveBar placement/tone controls."
                    titleMetadata={<Badge label="Feedback" variant="info" size="md" />}
                />
                <div className="grid gap-[var(--lb-space-4)] lg:grid-cols-[1.1fr_0.9fr]">
                    <Card title="Status and banners" description="Badges and banners can now hide or replace icons, run compact, and carry primary plus secondary actions." headerDivider>
                        <Section>
                            <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                <Badge label="No icon" variant="default" hideIcon />
                                <Badge label="Large success" variant="success" size="md" />
                                <Badge label="Custom icon" variant="warning" icon={<MaterialIcon name="schedule" />} />
                            </div>
                            {bannerVisible && (
                                <Banner
                                    compact
                                    title="Inventory sync paused"
                                    variant="warning"
                                    secondaryAction={<Button size="sm" variant="ghost">Ignore</Button>}
                                    action={<Button size="sm" variant="secondary">Resume</Button>}
                                    onDismiss={() => setBannerVisible(false)}
                                >
                                    Reconnect the warehouse feed before publishing time-sensitive products.
                                </Banner>
                            )}
                            <Banner title="Critical publishing guard" variant="critical" hideIcon action={<Button size="sm" variant="destructive">Resolve</Button>}>
                                Price rules must be reviewed before checkout changes can ship.
                            </Banner>
                        </Section>
                    </Card>
                    <Card title="Skeleton variants" description="Skeleton now supports avatar, media, button, custom widths, animation control, and optional labels." headerDivider>
                        <Section>
                            <div className="grid gap-[var(--lb-space-3)]">
                                <div className="flex items-center gap-[var(--lb-space-3)]">
                                    <Skeleton variant="avatar" label="Loading merchant avatar" />
                                    <div className="flex-1">
                                        <Skeleton lineWidths={['70%', '45%']} label="Loading merchant copy" />
                                    </div>
                                </div>
                                <Skeleton variant="media" className="max-h-32" />
                                <div className="flex gap-[var(--lb-space-2)]">
                                    <Skeleton variant="button" />
                                    <Skeleton variant="button" animated={false} />
                                </div>
                            </div>
                        </Section>
                    </Card>
                </div>
                <div className="grid gap-[var(--lb-space-4)] lg:grid-cols-2">
                    <EmptyState
                        align="start"
                        compact
                        tone="subdued"
                        icon={<MaterialIcon name="reviews" />}
                        title="No review tasks"
                        body={<span>Review queues can use left-aligned empty states without separate app-local wrappers.</span>}
                        primaryAction={<Button size="sm">Create task</Button>}
                        secondaryAction={<Button size="sm" variant="secondary">Import tasks</Button>}
                        footer="Compact empty states fit inside dashboard panels."
                    />
                    <Card title="Toast and save bar" description="ToastProvider can be positioned, and SaveBar can run static, compact, and critical." padding="md">
                        <div className="grid gap-[var(--lb-space-4)]">
                            <AutoToastDemo />
                            <SaveBar
                                state="unsaved"
                                placement="static"
                                tone="critical"
                                compact
                                message="3 checkout-risk settings need review"
                                saveLabel="Review"
                                discardLabel="Dismiss"
                                secondaryAction={<Button size="sm" variant="ghost">Details</Button>}
                            />
                        </div>
                    </Card>
                </div>
            </Page>
        </ToastProvider>
    );
}

export function ActionInputTableHardening() {
    const [query, setQuery] = useState('Classic');
    const [note, setNote] = useState('Apply margin guardrails before publishing.');
    const [selectedRows, setSelectedRows] = useState<React.Key[]>(['prod-1']);

    return (
        <Page>
            <PageHeader
                eyebrow="Batch 7"
                title="Action, input, and table hardening"
                description="Button, Input, Textarea, and DataTable now cover denser merchant workflows while preserving existing compatibility exports."
                titleMetadata={<Badge label="Additive" variant="success" />}
            />
            <div className="grid gap-[var(--lb-space-4)] lg:grid-cols-[0.9fr_1.1fr]">
                <Card title="Action grammar" description="Buttons can align content, wrap long operational labels, and move loading indicators." headerDivider>
                    <Section>
                        <div className="grid gap-[var(--lb-space-3)]">
                            <Button fullWidth justify="between" trailingIcon={<MaterialIcon name="arrow_forward" />}>
                                Publish selected products
                            </Button>
                            <Button loading loadingPosition="trailing" variant="secondary">
                                Syncing inventory
                            </Button>
                            <Button variant="outline" wrap justify="start">
                                Long workflow action label wraps cleanly instead of forcing overflow in constrained merchant panels
                            </Button>
                        </div>
                    </Section>
                </Card>
                <Card title="Field affordances" description="Inputs and textareas can expose clear actions, trailing commands, counts, and resize intent." headerDivider>
                    <Section>
                        <div className="grid gap-[var(--lb-space-4)]">
                            <Input
                                label="Product search"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                leftIcon={<MaterialIcon name="search" />}
                                clearable
                                onClear={() => setQuery('')}
                                showCharacterCount
                                maxLength={40}
                                helperText="Controlled clear affordance for filters and search fields."
                            />
                            <Input
                                label="Price override"
                                prefixContent="₹"
                                suffixContent="INR"
                                defaultValue="2499"
                                trailingAction={<Button size="sm" variant="ghost">Apply</Button>}
                                helperText="Inline trailing actions stay token-driven."
                            />
                            <Textarea
                                label="Bulk edit note"
                                value={note}
                                onChange={(event) => setNote(event.target.value)}
                                maxLength={120}
                                showCharacterCount
                                resize="vertical"
                                helperText="Character counts are included in the described-by chain."
                            />
                        </div>
                    </Section>
                </Card>
            </div>
            <Card title="Selectable compatibility table" description="DataTable now supports row selection, bulk actions, selection labels, and disabled row safety." headerDivider>
                <Section>
                    <DataTable
                        caption="Selectable product table"
                        ariaLabel="Selectable product publishing table"
                        rowKey="id"
                        selectable
                        selectedRowKeys={selectedRows}
                        onSelectionChange={setSelectedRows}
                        selectionLabel="Products selected"
                        density="compact"
                        data={sampleRows}
                        columns={[
                            { key: 'title', header: 'Product', sortable: true },
                            { key: 'status', header: 'Status', render: (value) => <Badge label={String(value)} variant={value === 'Active' ? 'success' : 'warning'} /> },
                            { key: 'inventory', header: 'Inventory', align: 'end' },
                            { key: 'channel', header: 'Channel' },
                        ]}
                        sortKey="title"
                        sortDirection="asc"
                        onSort={() => undefined}
                        bulkActions={(
                            <>
                                <Button size="sm">Publish</Button>
                                <Button size="sm" variant="secondary">Export</Button>
                            </>
                        )}
                        isRowDisabled={(row) => row.status === 'Draft'}
                        selectRowLabel={(row) => `Select ${row.title}`}
                        rowActions={(row) => (
                            <Button size="sm" variant="ghost" trailingIcon={<MaterialIcon name="visibility" />}>
                                View
                                <span className="sr-only"> {row.title}</span>
                            </Button>
                        )}
                    />
                </Section>
            </Card>
        </Page>
    );
}

export function IndexTablePaginationHardening() {
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>(['prod-1']);
    const [page, setPage] = useState(2);
    const [pageSize, setPageSize] = useState(25);

    return (
        <Page>
            <PageHeader
                eyebrow="Batch 8"
                title="Index table and pagination hardening"
                description="IndexTable and Pagination now support controlled table selection, disabled row safety, row actions, sticky headers, summaries, boundary controls, and page-size selection."
                titleMetadata={<Badge label="Tables" variant="info" />}
            />
            <Card title="Controlled merchant index" description="Selection can be driven by the consuming app while disabled rows stay visible but protected." headerDivider>
                <Section>
                    <IndexTable
                        caption="Controlled product index"
                        ariaLabel="Controlled product index table"
                        rows={sampleRows}
                        selectedRowIds={selectedProductIds}
                        onSelectionChange={setSelectedProductIds}
                        selectedLabel={(count) => `${count} products selected`}
                        selectAllLabel="Select all publishable products"
                        selectRowLabel={(row) => `Select ${row.title}`}
                        isRowDisabled={(row) => row.status === 'Draft'}
                        density="compact"
                        stickyHeader
                        savedViews={[
                            { label: 'All', value: 'all', count: 3 },
                            { label: 'Active', value: 'active', count: 2 },
                            { label: 'Draft', value: 'draft', count: 1 },
                        ]}
                        activeView="all"
                        filterChips={[{ label: 'Channel: Online Store' }, { label: 'Inventory below 50' }]}
                        bulkActions={[
                            { label: 'Publish', onAction: () => undefined },
                            { label: 'Export', onAction: () => undefined },
                            { label: 'Archive', destructive: true, disabled: selectedProductIds.length < 2, onAction: () => undefined },
                        ]}
                        columns={[
                            { key: 'title', header: 'Product', sortable: true, width: '34%' },
                            { key: 'status', header: 'Status', render: (row) => <Badge label={row.status} variant={row.status === 'Active' ? 'success' : 'warning'} /> },
                            { key: 'inventory', header: 'Inventory', sortable: true, align: 'end' },
                            { key: 'channel', header: 'Channel' },
                        ]}
                        sortKey="title"
                        sortDirection="asc"
                        onSort={() => undefined}
                        rowActions={(row) => (
                            <Button size="sm" variant="ghost" trailingIcon={<MaterialIcon name="visibility" />}>
                                View
                                <span className="sr-only"> {row.title}</span>
                            </Button>
                        )}
                    />
                </Section>
            </Card>
            <Card title="Pagination command row" description="Pagination can expose summaries, first/last controls, compact mode, disabled states, and page-size changes." headerDivider>
                <Section>
                    <div className="grid gap-[var(--lb-space-4)]">
                        <Pagination
                            ariaLabel="Product index pagination"
                            page={page}
                            totalPages={9}
                            onPageChange={setPage}
                            showPageNumbers
                            showBoundaryControls
                            siblingCount={2}
                            summary={<span>Showing 26-50 of 213 products</span>}
                            pageSize={pageSize}
                            pageSizeOptions={[10, 25, 50]}
                            onPageSizeChange={setPageSize}
                            pageSizeLabel="Products per page"
                        />
                        <Pagination
                            page={1}
                            totalPages={4}
                            onPageChange={() => undefined}
                            compact
                            disabled
                            summary={<span>Background sync is refreshing this list</span>}
                        />
                    </div>
                </Section>
            </Card>
        </Page>
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
