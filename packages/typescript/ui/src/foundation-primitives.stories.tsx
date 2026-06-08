'use client';

import React from 'react';
import {
    Accordion,
    AppFrame,
    Badge,
    Button,
    Card,
    Columns,
    Container,
    DatePicker,
    DesignSystemRoot,
    Disclosure,
    Drawer,
    Dropdown,
    Grid,
    InlineError,
    Input,
    MaterialIcon,
    Navigation,
    NumberField,
    Popover,
    Section,
    SegmentedControl,
    Sidebar,
    Switch,
    Text,
} from './index';

export default {
    title: 'LetBuyy UI/Foundation Primitives',
};

function StorySurface({ children }: { children: React.ReactNode }) {
    return (
        <DesignSystemRoot theme="light" density="compact" surface="admin">
            <div className="min-h-screen bg-[var(--lb-color-bg)] p-[var(--lb-space-5)] text-[color:var(--lb-color-text)]">
                {children}
            </div>
        </DesignSystemRoot>
    );
}

export function DrawerPrimitive() {
    return (
        <StorySurface>
            <Button variant="secondary">Drawer trigger</Button>
            <Drawer
                open
                title="Edit filters"
                description="Focus-trapped drawer with shared overlay behavior."
                onClose={() => undefined}
                footer={(
                    <>
                        <Button variant="secondary">Cancel</Button>
                        <Button>Apply filters</Button>
                    </>
                )}
            >
                <div className="grid gap-[var(--lb-space-4)]">
                    <Input label="Saved view name" defaultValue="High intent buyers" />
                    <Switch label="Show archived products" description="Include archived products in this view." defaultChecked />
                </div>
            </Drawer>
        </StorySurface>
    );
}

export function PopoverAndDropdownPrimitives() {
    return (
        <StorySurface>
            <div className="flex flex-wrap items-start gap-[var(--lb-space-5)]">
                <Popover
                    open
                    trigger={<Button variant="secondary">Product tips</Button>}
                    ariaLabel="Product tips"
                >
                    <div className="grid gap-[var(--lb-space-2)]">
                        <Text as="h3" variant="heading" weight="semibold">Search readiness</Text>
                        <Text tone="subdued">Use tags and collections before publishing.</Text>
                    </div>
                </Popover>
                <Dropdown
                    open
                    trigger={<Button variant="outline">Actions</Button>}
                    items={[
                        { id: 'edit', label: 'Edit product', description: 'Open product editor', icon: <MaterialIcon name="edit" /> },
                        { id: 'duplicate', label: 'Duplicate', icon: <MaterialIcon name="copy" /> },
                        { id: 'archive', label: 'Archive', destructive: true, icon: <MaterialIcon name="archive" /> },
                    ]}
                />
            </div>
        </StorySurface>
    );
}

export function LayoutAndFormPrimitives() {
    return (
        <StorySurface>
            <Container width="page">
                <Grid columns={{ base: 1, md: 2, xl: 3 }} gap="4">
                    <Card>
                        <Section title="Grid and columns" description="Responsive grid tracks use UI-owned breakpoint tokens.">
                            <Columns columns={2} gap="3">
                                <Badge label="Active" variant="success" />
                                <Badge label="Draft" variant="warning" />
                            </Columns>
                        </Section>
                    </Card>
                    <Card>
                        <Section title="Form primitives">
                            <div className="grid gap-[var(--lb-space-3)]">
                                <Switch label="Publish product" description="Visible to shoppers after save." defaultChecked />
                                <NumberField label="Inventory" defaultValue={24} min={0} />
                                <DatePicker label="Publish date" defaultValue="2026-06-06" />
                                <InlineError>Inventory cannot be negative.</InlineError>
                            </div>
                        </Section>
                    </Card>
                    <Card>
                        <Section title="Segmented control">
                            <SegmentedControl
                                ariaLabel="Preview mode"
                                value="desktop"
                                onValueChange={() => undefined}
                                options={[
                                    { value: 'mobile', label: 'Mobile' },
                                    { value: 'desktop', label: 'Desktop' },
                                    { value: 'wide', label: 'Wide' },
                                ]}
                            />
                        </Section>
                    </Card>
                </Grid>
            </Container>
        </StorySurface>
    );
}

export function DisclosureAndAppShellPrimitives() {
    return (
        <StorySurface>
            <AppFrame
                sidebar={(
                    <Sidebar header={<strong>LetBuyy</strong>} footer={<Badge label="Admin" />}>
                        <Navigation
                            items={[
                                { id: 'dashboard', label: 'Dashboard', href: '#dashboard', icon: <MaterialIcon name="dashboard" />, active: true },
                                { id: 'products', label: 'Products', href: '#products', icon: <MaterialIcon name="products" />, badge: '12' },
                                { id: 'orders', label: 'Orders', href: '#orders', icon: <MaterialIcon name="orders" /> },
                            ]}
                        />
                    </Sidebar>
                )}
                topBar={<Text weight="semibold">Urban Kicks</Text>}
                className="min-h-[640px] overflow-hidden rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)]"
            >
                <div className="p-[var(--lb-space-5)]">
                    <Grid columns={{ base: 1, lg: 2 }} gap="4">
                        <Disclosure title="Publishing rules" defaultOpen>
                            Product pages validate inventory, SEO, and payment readiness before publishing.
                        </Disclosure>
                        <Accordion
                            items={[
                                { id: 'seo', title: 'SEO checks', content: 'Title, description, and canonical URL are present.' },
                                { id: 'inventory', title: 'Inventory checks', content: 'Variants have available stock or backorder rules.' },
                            ]}
                            defaultValue="seo"
                        />
                    </Grid>
                </div>
            </AppFrame>
        </StorySurface>
    );
}
