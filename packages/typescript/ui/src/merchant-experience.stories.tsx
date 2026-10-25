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
    EmptyState,
    Table,
    Input,
    MaterialIcon,
    MetricCard,
    Modal,
    Page,
    PageHeader,
    Pagination,
    SaveBar,
    Section,
    Select,
    Skeleton,
    Tabs,
    Textarea,
    ToastProvider,
    Tooltip,
    useToast,
} from './index';
import { ColorPreviewButton, ColorSwatch, RadiusPreview } from './preview';
import { letbuyyTokens } from './tokens';

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

const storyTokenColors = letbuyyTokens.color.light;

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

export function UsageGuidelines() {
    return (
        <Page as="main">
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
                            <ColorSwatch color={storyTokenColors.primary} label="Primary swatch" size="lg" />
                            <ColorSwatch color={storyTokenColors.success} label="Success swatch" size="lg" />
                            <RadiusPreview
                                radius={12}
                                label="Radius preview 12px"
                                className="grid h-[var(--lb-size-control-lg)] w-[var(--lb-size-control-lg)] place-items-center border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] text-[color:var(--lb-color-text-subdued)]"
                            >
                                12
                            </RadiusPreview>
                            <ColorPreviewButton color={storyTokenColors.primaryCta} radius={12} className="h-[var(--lb-size-control-md)] px-[var(--lb-space-4)] text-[color:var(--lb-color-primary-cta-text)]">
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
        <Page as="main">
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
            <Page as="main">
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
                            Add a payment provider before enabling checkout.
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

export function EmptyAndLoadingStates() {
    return (
        <Page as="main">
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
        <Page as="main">
            <PageHeader title="Index table" description="Bulk actions, saved views, filters, sorting, and dense scanning." />
            <Table
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
                    <Table
                        rows={sampleRows}
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
        <Page as="main">
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
            <Badge label="Legacy danger alias" variant="critical" />
            <CheckCircle2 className="h-[var(--lb-size-control-sm)] w-[var(--lb-size-control-sm)] text-[color:var(--lb-color-success)]" aria-hidden="true" />
        </div>
    );
}
