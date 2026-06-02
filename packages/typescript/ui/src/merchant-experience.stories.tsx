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

export function EmptyAndLoadingStates() {
    return (
        <Page>
            <PageHeader title="Empty states" description="Designed blanks, skeletons, and next actions." />
            <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                <EmptyState
                    icon={<AppWindow className="h-[1em] w-[1em]" aria-hidden="true" />}
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
            <CheckCircle2 className="h-[var(--lb-size-control-sm)] w-[var(--lb-size-control-sm)] text-[var(--lb-color-success)]" aria-hidden="true" />
        </div>
    );
}
