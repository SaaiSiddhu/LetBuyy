import React from 'react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
    Avatar,
    Badge,
    Banner,
    Button,
    Card,
    Checkbox,
    Accordion,
    AppFrame,
    Columns,
    Combobox,
    CommandPalette,
    ConfirmDialog,
    Container,
    DatePicker,
    DesignSystemRoot,
    Disclosure,
    Drawer,
    Dropdown,
    EmptyState,
    Grid,
    InlineError,
    Input,
    Modal,
    Navigation,
    NumberField,
    PageHeaderActions,
    PageHeader,
    Page,
    Pagination,
    Popover,
    Radio,
    SaveBar,
    Section,
    Select,
    SegmentedControl,
    Sidebar,
    Skeleton,
    Switch,
    Tabs,
    Table,
    FilterBar,
    ToastProvider,
    Tooltip,
    Text,
    Textarea,
    formatCurrency,
    formatDate,
    formatNumber,
    isMaterialIconName,
    createLetbuyyBrandVariables,
    letbuyyBreakpointTokens,
    letbuyyShadowTokens,
    letbuyySurfaceTokens,
    letbuyyTailwindScreens,
    letbuyyTokenCss,
    letbuyyTokenCssVariables,
    materialIconName,
    resolvePageIdentity,
    useToast,
    validateLetbuyyBrandContrast,
} from '../../src';
import { cx } from '../../src/utils';

function renderInSystem(ui: React.ReactElement) {
    return render(
        <DesignSystemRoot>
            {ui}
        </DesignSystemRoot>,
    );
}

async function expectAxeClean(container: HTMLElement) {
    expect(await axe(container)).toHaveNoViolations();
}

function hexToRgb(hex: string) {
    const normalized = hex.replace('#', '');
    return {
        r: Number.parseInt(normalized.slice(0, 2), 16),
        g: Number.parseInt(normalized.slice(2, 4), 16),
        b: Number.parseInt(normalized.slice(4, 6), 16),
    };
}

function relativeLuminance(hex: string) {
    const { r, g, b } = hexToRgb(hex);
    const channels = [r, g, b].map((channel) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground: string, background: string) {
    const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
    const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
    return (lighter + 0.05) / (darker + 0.05);
}

describe('@letbuyy/ui foundation smoke coverage', () => {
    it('renders Card and Section content accessibly', async () => {
        const { container } = renderInSystem(
            <Card>
                <Section title="Inventory" description="Track low stock">
                    <p>12 items need review.</p>
                </Section>
            </Card>,
        );

        expect(screen.getByRole('heading', { name: 'Inventory' })).toBeTruthy();
        expect(screen.getByText('12 items need review.')).toBeTruthy();
        await expectAxeClean(container);
    });

    it('renders Button loading and disabled states', async () => {
        const onClick = vi.fn();
        const { container } = renderInSystem(
            <Button loading onClick={onClick}>
                Save
            </Button>,
        );

        const button = screen.getByRole('button', { name: 'Save' });
        fireEvent.click(button);

        expect(button.hasAttribute('disabled')).toBe(true);
        expect(onClick).not.toHaveBeenCalled();
        await expectAxeClean(container);
    });

    it('renders Button as a link and as a slotted trigger', async () => {
        const { container } = renderInSystem(
            <>
                <Button as="a" href="/products" variant="secondary">
                    Products link
                </Button>
                <Button asChild variant="outline">
                    <a href="/orders">Orders link</a>
                </Button>
            </>,
        );

        expect(screen.getByRole('link', { name: 'Products link' }).getAttribute('href')).toBe('/products');
        expect(screen.getByRole('link', { name: 'Orders link' }).getAttribute('href')).toBe('/orders');
        await expectAxeClean(container);
    });

    it('renders Badge and Banner status variants', async () => {
        const { container } = renderInSystem(
            <>
                <Badge label="Live" variant="success" />
                <Banner title="Sync complete" variant="success">
                    Store data is current.
                </Banner>
            </>,
        );

        expect(screen.getByText('Live')).toBeTruthy();
        expect(screen.getByRole('status')).toBeTruthy();
        await expectAxeClean(container);
    });

    it('keeps banner actions separate from the message and keyboard accessible', async () => {
        const retry = vi.fn();
        const { container } = renderInSystem(
            <Banner title="Themes could not load" variant="critical" action={<Button variant="secondary" onClick={retry}>Retry</Button>}>
                The request timed out.
            </Banner>,
        );
        const banner = screen.getByRole('alert');
        expect(within(banner).getByText('The request timed out.')).toBeTruthy();
        fireEvent.click(within(banner).getByRole('button', { name: 'Retry' }));
        expect(retry).toHaveBeenCalledOnce();
        expect(banner.className).toContain('--lb-component-banner-danger-text');
        await expectAxeClean(container);
    });

    it('renders Input helper and error states', async () => {
        const { container, rerender } = renderInSystem(
            <Input label="Store name" helperText="Shown to shoppers" />,
        );

        const input = screen.getByLabelText('Store name');
        expect(input).toBeTruthy();
        expect(screen.getByText('Shown to shoppers')).toBeTruthy();
        const helperId = input.getAttribute('aria-describedby');
        expect(document.getElementById(helperId ?? '')?.textContent).toBe('Shown to shoppers');

        rerender(
            <DesignSystemRoot>
                <Input label="Store name" error="Store name is required" />
            </DesignSystemRoot>,
        );

        const errorInput = screen.getByLabelText('Store name');
        expect(errorInput).toBeTruthy();
        expect(errorInput.getAttribute('aria-invalid')).toBe('true');
        const errorId = errorInput.getAttribute('aria-describedby');
        expect(document.getElementById(errorId ?? '')?.textContent).toBe('Store name is required');
        expect(screen.getByText('Store name is required')).toBeTruthy();
        await expectAxeClean(container);
    });

    it('generates stable unique IDs and ARIA wiring for duplicate Input and Textarea labels', async () => {
        const { container } = renderInSystem(
            <>
                <Input label="Store name" helperText="First helper" />
                <Input label="Store name" helperText="Second helper" />
                <Textarea label="Store name" error="Description is required" />
            </>,
        );

        const controls = screen.getAllByLabelText('Store name');
        const ids = controls.map((control) => control.id);

        expect(new Set(ids).size).toBe(ids.length);
        expect(controls[0].getAttribute('aria-describedby')).not.toBe(controls[1].getAttribute('aria-describedby'));
        expect(controls[2].getAttribute('aria-invalid')).toBe('true');
        expect(document.getElementById(controls[2].getAttribute('aria-describedby') ?? '')?.textContent).toBe('Description is required');
        await expectAxeClean(container);
    });

    it('renders Skeleton as decorative loading structure', async () => {
        const { container } = renderInSystem(<Skeleton variant="table" lines={2} />);

        expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
        await expectAxeClean(container);
    });

    it('renders EmptyState with actions', async () => {
        const { container } = renderInSystem(
            <EmptyState
                kind="products"
                title="No products"
                body="Add your first product."
                primaryAction={<Button>Add product</Button>}
            />,
        );

        expect(screen.getByRole('heading', { name: 'No products' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Add product' })).toBeTruthy();
        await expectAxeClean(container);
    });

    it('renders Select error state with ARIA wiring', async () => {
        const { container } = renderInSystem(
            <Select
                label="Status"
                error="Choose a status"
                options={[
                    { label: 'Draft', value: 'draft' },
                    { label: 'Published', value: 'published' },
                ]}
            />,
        );

        const select = screen.getByLabelText('Status');
        const errorId = select.getAttribute('aria-describedby');
        expect(select.getAttribute('aria-invalid')).toBe('true');
        expect(document.getElementById(errorId ?? '')?.textContent).toBe('Choose a status');
        await expectAxeClean(container);
    });

    it('renders Checkbox and Radio controls with change callbacks', async () => {
        const onCheckboxChange = vi.fn();
        const onRadioChange = vi.fn();
        const { container } = renderInSystem(
            <>
                <Checkbox label="Track inventory" onCheckedChange={onCheckboxChange} />
                <Radio name="channel" label="Online store" onCheckedChange={onRadioChange} />
            </>,
        );

        fireEvent.click(screen.getByLabelText('Track inventory'));
        fireEvent.click(screen.getByLabelText('Online store'));

        expect(onCheckboxChange).toHaveBeenCalledWith(true);
        expect(onRadioChange).toHaveBeenCalledWith(true);
        await expectAxeClean(container);
    });

    it('renders Combobox and selects options with keyboard input', async () => {
        const onValueChange = vi.fn();
        const { container } = renderInSystem(
            <Combobox
                label="Collection"
                options={[
                    { label: 'Summer', value: 'summer' },
                    { label: 'Winter', value: 'winter' },
                ]}
                onValueChange={onValueChange}
            />,
        );

        const input = screen.getByRole('combobox', { name: 'Collection' });
        fireEvent.focus(input);
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(onValueChange).toHaveBeenCalledWith('winter');
        await expectAxeClean(container);
    });

    it('renders Tabs and changes active panel by keyboard', async () => {
        const { container } = renderInSystem(
            <Tabs
                ariaLabel="Store setup"
                items={[
                    { value: 'details', label: 'Details', content: 'Details panel' },
                    { value: 'shipping', label: 'Shipping', content: 'Shipping panel' },
                ]}
            />,
        );

        const tablist = screen.getByRole('tablist', { name: 'Store setup' });
        const detailsTab = within(tablist).getByRole('tab', { name: 'Details' });
        fireEvent.keyDown(detailsTab, { key: 'ArrowRight' });

        expect(screen.getByRole('tabpanel').textContent).toBe('Shipping panel');
        await expectAxeClean(container);
    });

    it('traps, restores, and dismisses focus in Modal', async () => {
        function ModalHarness() {
            const [open, setOpen] = React.useState(false);
            return (
                <>
                    <button type="button" onClick={() => setOpen(true)}>
                        Open modal
                    </button>
                    <button type="button">Background action</button>
                    <Modal
                        open={open}
                        title="Edit product"
                        description="Update product details"
                        onClose={() => setOpen(false)}
                        footer={<Button>Save product</Button>}
                    >
                        <Input label="Product name" />
                    </Modal>
                </>
            );
        }

        const { container } = renderInSystem(<ModalHarness />);
        const openButton = screen.getByRole('button', { name: 'Open modal' });
        const backgroundButton = screen.getByRole('button', { name: 'Background action' }) as HTMLElement & { inert?: boolean };

        openButton.focus();
        fireEvent.click(openButton);

        const closeButton = await screen.findByRole('button', { name: 'Close' });
        expect(screen.queryByRole('button', { name: 'Close modal' })).toBeNull();
        await waitFor(() => expect(document.activeElement).toBe(closeButton));
        expect(backgroundButton.getAttribute('aria-hidden')).toBe('true');
        expect(backgroundButton.inert).toBe(true);

        fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Save product' }));

        fireEvent.keyDown(document, { key: 'Tab' });
        expect(document.activeElement).toBe(closeButton);

        fireEvent.keyDown(document, { key: 'Escape' });
        await waitFor(() => expect(document.activeElement).toBe(openButton));
        await expectAxeClean(container);
    });

    it('restores the explicit opener when a Modal input takes autofocus', async () => {
        function FinderHarness() {
            const [open, setOpen] = React.useState(false);
            const opener = React.useRef<HTMLButtonElement>(null);
            const input = React.useRef<HTMLInputElement>(null);
            return <>
                <button ref={opener} onClick={() => setOpen(true)}>Find workspace</button>
                <Modal open={open} title="Workspace finder" onClose={() => setOpen(false)} initialFocusRef={input} returnFocusRef={opener}>
                    <Input label="Search workspaces" ref={input} autoFocus />
                </Modal>
            </>;
        }
        renderInSystem(<FinderHarness />);
        const opener = screen.getByRole('button', { name: 'Find workspace' });
        opener.focus(); fireEvent.click(opener);
        await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Search workspaces')));
        fireEvent.keyDown(document, { key: 'Escape' });
        await waitFor(() => expect(document.activeElement).toBe(opener));
    });

    it('traps focus and supports arrow-key roving in CommandPalette', async () => {
        const onClose = vi.fn();
        const onFirst = vi.fn();
        const { container } = renderInSystem(
            <>
                <button type="button">Background action</button>
                <CommandPalette
                    open
                    onClose={onClose}
                    actions={[
                        { id: 'products', label: 'Products', description: 'Open products', onSelect: onFirst },
                        { id: 'orders', label: 'Orders', description: 'Open orders', onSelect: vi.fn() },
                    ]}
                />
            </>,
        );

        const search = screen.getByRole('combobox', { name: 'Search commands' });
        await waitFor(() => expect(document.activeElement).toBe(search));

        fireEvent.keyDown(search, { key: 'ArrowDown' });
        expect(document.activeElement).toBe(screen.getByRole('option', { name: /Products/ }));

        fireEvent.keyDown(document.activeElement ?? search, { key: 'ArrowDown' });
        expect(document.activeElement).toBe(screen.getByRole('option', { name: /Orders/ }));

        fireEvent.keyDown(document.activeElement ?? search, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
        await expectAxeClean(container);
    });

    it('associates Tooltip with its trigger and supports touch reveal', async () => {
        const { container } = renderInSystem(
            <Tooltip content="Names the compact action">
                <Button aria-label="Compact action">?</Button>
            </Tooltip>,
        );

        const trigger = screen.getByRole('button', { name: 'Compact action' });
        const tooltip = screen.getByRole('tooltip');

        expect(trigger.getAttribute('aria-describedby')).toBe(tooltip.id);
        fireEvent.pointerDown(trigger, { pointerType: 'touch' });
        expect(tooltip.className).toContain('opacity-100');
        await expectAxeClean(container);
    });

    it('renders ConfirmDialog custom body copy without a button backdrop', async () => {
        const { container } = renderInSystem(
            <ConfirmDialog
                open
                title="Delete product"
                description="This cannot be undone"
                onClose={() => undefined}
                onConfirm={() => undefined}
                destructive
            >
                <p>Delete this product and cancel pending storefront sync.</p>
            </ConfirmDialog>,
        );

        expect(screen.getByText('Delete this product and cancel pending storefront sync.')).toBeTruthy();
        expect(screen.queryByText('This action can affect merchant data. Review it before continuing.')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Close modal' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
        await expectAxeClean(container);
    });

    it('supports Toast duration and placement options', async () => {
        function ToastTrigger() {
            const { notify } = useToast();
            return (
                <Button onClick={() => notify({ title: 'Inventory saved', duration: 1000, placement: 'bottom-left' })}>
                    Show toast
                </Button>
            );
        }

        vi.useFakeTimers();
        try {
            const { container } = renderInSystem(
                <ToastProvider duration={5000} placement="top-right">
                    <ToastTrigger />
                </ToastProvider>,
            );

            fireEvent.click(screen.getByRole('button', { name: 'Show toast' }));

            expect(screen.getByText('Inventory saved')).toBeTruthy();
            const toastContainers = Array.from(container.querySelectorAll('[aria-live="polite"]'));
            expect(toastContainers.some((element) => element.className.includes('bottom-[var(--lb-space-5)]') && element.className.includes('left-[var(--lb-space-5)]'))).toBe(true);

            act(() => {
                vi.advanceTimersByTime(1000);
            });

            expect(screen.queryByText('Inventory saved')).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it('renders Drawer, Popover, and Dropdown with keyboard-safe dismissal', async () => {
        const onDrawerClose = vi.fn();
        const onDropdownSelect = vi.fn();

        function OverlayHarness() {
            const [drawerOpen, setDrawerOpen] = React.useState(true);
            const [popoverOpen, setPopoverOpen] = React.useState(false);
            const [dropdownOpen, setDropdownOpen] = React.useState(false);
            return (
                <>
                    <button type="button">Background action</button>
                    <Drawer
                        open={drawerOpen}
                        title="Edit filters"
                        description="Drawer filter panel"
                        onClose={() => {
                            onDrawerClose();
                            setDrawerOpen(false);
                        }}
                        footer={<Button>Apply</Button>}
                    >
                        <Input label="Filter name" />
                    </Drawer>
                    <Popover
                        open={popoverOpen}
                        onOpenChange={setPopoverOpen}
                        trigger={<Button variant="secondary">Open popover</Button>}
                        ariaLabel="Product tips"
                    >
                        <p>Use product tags to improve search.</p>
                    </Popover>
                    <Dropdown
                        open={dropdownOpen}
                        onOpenChange={setDropdownOpen}
                        trigger={<Button variant="secondary">Actions</Button>}
                        items={[
                            { id: 'edit', label: 'Edit product', onSelect: onDropdownSelect },
                            { id: 'archive', label: 'Archive product', destructive: true },
                        ]}
                    />
                </>
            );
        }

        const { container } = renderInSystem(<OverlayHarness />);
        const closeButton = await screen.findByRole('button', { name: 'Close' });
        await waitFor(() => expect(document.activeElement).toBe(closeButton));
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onDrawerClose).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole('button', { name: 'Open popover' }));
        expect(screen.getByRole('dialog', { name: 'Product tips' })).toBeTruthy();
        fireEvent.keyDown(screen.getByRole('button', { name: 'Open popover' }), { key: 'Escape' });
        expect(screen.queryByRole('dialog', { name: 'Product tips' })).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
        const editItem = screen.getByRole('menuitem', { name: 'Edit product' });
        expect(editItem).toBeTruthy();
        fireEvent.keyDown(editItem, { key: 'ArrowDown' });
        expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Archive product' }));
        fireEvent.keyDown(document.activeElement ?? editItem, { key: 'ArrowUp' });
        fireEvent.click(screen.getByRole('menuitem', { name: 'Edit product' }));
        expect(onDropdownSelect).toHaveBeenCalledTimes(1);
        await expectAxeClean(container);
    });

    it('renders additive layout and form primitives accessibly', async () => {
        const onSwitchChange = vi.fn();
        const onNumberChange = vi.fn();
        const { container } = renderInSystem(
            <Container width="measure">
                <Grid columns={{ base: 1, md: 2 }} gap="3">
                    <Card>
                        <Columns columns={2} gap="2">
                            <span>Revenue</span>
                            <span>INR 24,000</span>
                        </Columns>
                    </Card>
                    <Card>
                        <Switch label="Publish product" description="Visible to shoppers" onCheckedChange={onSwitchChange} />
                        <NumberField label="Inventory" defaultValue={8} min={0} onValueChange={onNumberChange} />
                        <InlineError>Inventory cannot be negative.</InlineError>
                    </Card>
                </Grid>
            </Container>,
        );

        fireEvent.click(screen.getByRole('switch', { name: 'Publish product' }));
        fireEvent.change(screen.getByLabelText('Inventory'), { target: { value: '12' } });

        expect(onSwitchChange).toHaveBeenCalledWith(true);
        expect(onNumberChange).toHaveBeenCalledWith(12, '12');
        expect(screen.getByRole('alert').textContent).toContain('Inventory cannot be negative.');
        await expectAxeClean(container);
    });

    it('renders date, disclosure, segmented, and app-shell primitives accessibly', async () => {
        const onSegmentChange = vi.fn();
        const { container } = renderInSystem(
            <AppFrame
                sidebar={(
                    <Sidebar header="LetBuyy">
                        <Navigation
                            items={[
                                { id: 'dashboard', label: 'Dashboard', href: '/dashboard', active: true },
                                { id: 'products', label: 'Products', href: '/products', badge: '12' },
                            ]}
                        />
                    </Sidebar>
                )}
                topBar={<span>Storefront</span>}
            >
                <Section title="Publishing">
                    <DatePicker label="Publish date" defaultValue="2026-06-06" />
                    <Disclosure title="Publishing rules" defaultOpen>
                        Rules are evaluated before publishing.
                    </Disclosure>
                    <Accordion
                        items={[
                            { id: 'seo', title: 'SEO', content: 'Search settings' },
                            { id: 'inventory', title: 'Inventory', content: 'Stock settings' },
                        ]}
                    />
                    <SegmentedControl
                        ariaLabel="Mode"
                        value="preview"
                        onValueChange={onSegmentChange}
                        options={[
                            { value: 'preview', label: 'Preview' },
                            { value: 'live', label: 'Live' },
                        ]}
                    />
                </Section>
            </AppFrame>,
        );

        expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Publishing rules' }).getAttribute('aria-expanded')).toBe('true');
        fireEvent.click(screen.getByRole('radio', { name: 'Live' }));
        expect(onSegmentChange).toHaveBeenCalledWith('live');
        await expectAxeClean(container);
    });

    it('renders the unified Table with sorting, selection, and responsive cards', async () => {
        const onSort = vi.fn();
        const onSelectionChange = vi.fn();
        const onBulkAction = vi.fn();
        const rows = [
            { id: 'prod-1', title: 'Kurta', status: 'Active', inventory: 42 },
            { id: 'prod-2', title: 'Notebook', status: 'Draft', inventory: 12 },
        ];

        const { container } = renderInSystem(
            <Table
                rows={rows}
                savedViews={[{ label: 'All', value: 'all', count: 2 }]}
                activeView="all"
                filterChips={[{ label: 'Status: Active' }]}
                bulkActions={[{ label: 'Archive', onAction: onBulkAction }]}
                sortKey="title"
                sortDirection="asc"
                onSort={onSort}
                onSelectionChange={onSelectionChange}
                columns={[
                    { key: 'title', header: 'Product', sortable: true, render: (row) => <Text as="span" variant="strong" reset={false}>{row.title}</Text> },
                    { key: 'status', header: 'Status', render: (row) => <Badge label={row.status} variant={row.status === 'Active' ? 'success' : 'info'} /> },
                    { key: 'inventory', header: 'Inventory', sortable: true },
                ]}
            />,
        );

        fireEvent.click(screen.getAllByRole('button', { name: /Product/ })[0]);
        fireEvent.click(screen.getAllByLabelText('Select row 1')[0]);

        expect(onSort).toHaveBeenCalledWith('title');
        expect(onSelectionChange).toHaveBeenCalledWith(['prod-1'], [rows[0]]);
        expect(screen.getAllByText('Kurta').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Status: Active').length).toBeGreaterThan(0);
        await expectAxeClean(container);
    });

    it('keeps table search, view, columns, selection, and pagination in one workspace', async () => {
        window.localStorage.removeItem('test.table.products');
        const onSearch = vi.fn();
        const onView = vi.fn();
        const onPage = vi.fn();
        const rows = [
            { id: 'one', name: 'Kurta', status: 'Active', inventory: 4 },
            { id: 'two', name: 'Notebook', status: 'Draft', inventory: 8 },
        ];
        const columns = [
            { key: 'name', header: 'Product' },
            { key: 'status', header: 'Status' },
            { key: 'inventory', header: 'Inventory' },
        ];
        const { container } = renderInSystem(
            <Table rows={rows} columns={columns} search={{ label: 'Search products', value: '', onChange: onSearch }}
                filterContent={<span>Category filter</span>}
                savedViews={[{ label: 'All', value: 'all' }, { label: 'Draft', value: 'draft' }]}
                activeView="all" onViewChange={onView} preferencesKey="test.table.products"
                bulkActions={[{ label: 'Archive', onAction: vi.fn() }]}
                pagination={{ page: 1, pageSize: 25, total: 27, onPageChange: onPage, itemLabel: 'products' }} />,
        );

        fireEvent.focus(screen.getByRole('searchbox', { name: 'Search products' }));
        expect(screen.getByRole('dialog', { name: 'Search filters' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Filters' })).toBeNull();
        fireEvent.change(screen.getByRole('searchbox', { name: 'Search products' }), { target: { value: 'Kurta' } });
        expect(onSearch).toHaveBeenCalledWith('Kurta');
        fireEvent.change(screen.getByRole('combobox', { name: 'Table view' }), { target: { value: 'draft' } });
        expect(onView).toHaveBeenCalledWith('draft');
        fireEvent.click(screen.getAllByLabelText('Select row 1')[0]);
        expect(screen.getByText('1 selected')).toBeTruthy();
        fireEvent.click(screen.getByRole('checkbox', { name: 'Show selected only' }));
        expect(within(container.querySelector('table')!).queryByText('Notebook')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Sort and columns' }));
        fireEvent.click(screen.getByRole('button', { name: 'Hide Status column' }));
        expect(within(container.querySelector('table')!).queryByRole('columnheader', { name: 'Status' })).toBeNull();
        expect(window.localStorage.getItem('test.table.products')).toContain('status');
        const drag = screen.getByRole('button', { name: /Drag Inventory column/ });
        fireEvent.dragStart(drag, { dataTransfer: { effectAllowed: 'move', setData: vi.fn() } });
        fireEvent.dragOver(screen.getByText('Status', { selector: 'span' }));
        fireEvent.drop(screen.getByText('Status', { selector: 'span' }));
        expect(JSON.parse(window.localStorage.getItem('test.table.products') || '{}').order).toEqual(['name', 'inventory', 'status']);
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        expect(onPage).toHaveBeenCalledWith(2);
        await expectAxeClean(container);
        window.localStorage.removeItem('test.table.products');
    });

    it('renders canonical 1.0 replacements without deprecated warnings', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        renderInSystem(
            <>
                <Table columns={[{ key: 'name', header: 'Name' }]} rows={[{ id: '1', name: 'Anika' }]} />
                <Page title="Legacy page">
                    <PageHeaderActions>Actions</PageHeaderActions>
                    <FilterBar search={<span>Search</span>} />
                </Page>
                <Table rows={[]} columns={[]} />
                <Text>Legacy text</Text>
                <Badge label="Legacy danger" variant="critical" />
            </>,
        );

        expect(screen.getAllByText('Anika').length).toBeGreaterThan(0);
        expect(screen.getByText('Legacy text')).toBeTruthy();
        expect(warnSpy).not.toHaveBeenCalled();

        warnSpy.mockRestore();
    });

    it('renders canonical Text variants', async () => {
        const { container } = renderInSystem(
            <>
                <Text variant="strong">Legacy strong</Text>
                <Text variant="code">legacy.code</Text>
                <Text as="span" variant="positive" reset={false}>Positive text</Text>
                <Badge label="Legacy danger" variant="critical" />
            </>,
        );

        const legacyStrong = screen.getByText('Legacy strong');
        expect(legacyStrong.tagName.toLowerCase()).toBe('p');
        expect(legacyStrong.className).toContain('font-[var(--lb-font-weight-semibold)]');
        expect(legacyStrong.className).toContain('m-0');
        expect(screen.getByText('legacy.code').tagName.toLowerCase()).toBe('code');
        expect(screen.getByText('Positive text').className).toContain('text-[color:var(--lb-color-success)]');
        expect(screen.getByText('Legacy danger')).toBeTruthy();
        await expectAxeClean(container);
    });

    it('exports strict material icon helpers while loose names still compile', () => {
        const strictName = materialIconName('store');

        expect(strictName).toBe('store');
        expect(isMaterialIconName(strictName)).toBe(true);
        expect(isMaterialIconName('not_a_registered_icon')).toBe(false);
    });

    it('keeps composed PageHeader, SaveBar, Table, and Pagination behavior intact', async () => {
        const onPrimary = vi.fn();
        const onSave = vi.fn();
        const onDiscard = vi.fn();
        const onPageChange = vi.fn();
        const onOpen = vi.fn();
        const onBulk = vi.fn();
        const rows = [
            { id: 'order-1', order: '#1001', customer: 'Meera' },
            { id: 'order-2', order: '#1002', customer: 'Arjun' },
        ];

        const { container } = renderInSystem(
            <>
                <PageHeader
                    title="Orders"
                    breadcrumbs={[
                        { label: 'Home', href: '/' },
                        { label: 'Orders' },
                    ]}
                    primaryAction={{ label: 'Create order', onClick: onPrimary }}
                    secondaryActions={[{ label: 'Export', href: '/exports' }]}
                    showBreadcrumbs
                />
                <SaveBar state="unsaved" onSave={onSave} onDiscard={onDiscard} />
                <Table
                    rows={rows}
                    columns={[
                        { key: 'order', header: 'Order', sortable: true },
                        { key: 'customer', header: 'Customer' },
                    ]}
                    bulkActions={[{ label: 'Archive', onAction: onBulk }]}
                    onRowClick={onOpen}
                />
                <Pagination page={2} totalPages={3} onPageChange={onPageChange} />
            </>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Create order' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
        fireEvent.click(screen.getAllByLabelText('Select row 1')[0]);
        fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
        const desktopOrder = screen.getAllByText('#1001').find((element) => element.closest('tr'));
        const desktopRow = desktopOrder?.closest('tr');
        expect(desktopRow).toBeTruthy();
        fireEvent.click(desktopOrder!);
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));

        expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/');
        expect(screen.getByRole('link', { name: 'Export' }).getAttribute('href')).toBe('/exports');
        expect(desktopRow?.getAttribute('aria-selected')).toBe('true');
        expect(onPrimary).toHaveBeenCalledTimes(1);
        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onDiscard).toHaveBeenCalledTimes(1);
        expect(onBulk).toHaveBeenCalledWith([rows[0]]);
        expect(onOpen).toHaveBeenCalledWith(rows[0]);
        expect(onPageChange).toHaveBeenCalledWith(3);
        await expectAxeClean(container);
    });

    it('supports Pagination page numbers and page-size changes additively', async () => {
        const onPageChange = vi.fn();
        const onPageSizeChange = vi.fn();
        const { container } = renderInSystem(
            <Pagination
                page={3}
                totalPages={8}
                onPageChange={onPageChange}
                showPageNumbers
                pageSize={25}
                pageSizeOptions={[10, 25, 50]}
                onPageSizeChange={onPageSizeChange}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: '4' }));
        fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '50' } });

        expect(screen.getByRole('button', { name: '3' }).getAttribute('aria-current')).toBe('page');
        expect(onPageChange).toHaveBeenCalledWith(4);
        expect(onPageSizeChange).toHaveBeenCalledWith(50);
        await expectAxeClean(container);
    });

    it('supports optional Avatar image alt text and custom EmptyState motifs', async () => {
        const { container } = renderInSystem(
            <>
                <Avatar name="Priya Shah" imageUrl="/avatar.png" alt="Priya Shah profile photo" />
                <EmptyState
                    title="No products"
                    kind="products"
                    illustrationMotifs={{
                        products: <circle data-testid="custom-empty-motif" cx="96" cy="64" r="20" />,
                    }}
                />
            </>,
        );

        expect(screen.getByAltText('Priya Shah profile photo')).toBeTruthy();
        expect(container.querySelector('[data-testid="custom-empty-motif"]')).toBeTruthy();
        await expectAxeClean(container);
    });

    it('exports INR-first formatting helpers from the root API', () => {
        expect(formatCurrency(1234, { maximumFractionDigits: 0 })).toContain('1,234');
        expect(formatCurrency(1234, { maximumFractionDigits: 0 })).toContain('₹');
        expect(formatNumber(1234567)).toBe('12,34,567');
        expect(formatDate('2026-06-06', { timeZone: 'UTC' })).toContain('6');
    });

    it('emits z-index tokens and an auto-theme dark media block', () => {
        expect(letbuyyTokenCssVariables.light['--lb-z-dropdown']).toBe('30');
        expect(letbuyyTokenCssVariables.light['--lb-z-modal']).toBe('60');
        expect(letbuyyTokenCssVariables.light['--lb-z-toast']).toBe('70');
        expect(letbuyyTokenCssVariables.light['--lb-z-tooltip']).toBe('80');
        expect(letbuyyTokenCss).toContain('@media (prefers-color-scheme: dark)');
        expect(letbuyyTokenCss).toContain('@media (prefers-reduced-motion: reduce)');
        expect(letbuyyTokenCss).toContain('[data-theme="auto"], [data-letbuyy-theme="auto"]');
    });

    it('exports breakpoint screens and routes card shadows through the shadow source', () => {
        expect(letbuyyBreakpointTokens).toEqual({
            xs: '360px',
            mobile: '480px',
            sm: '640px',
            md: '768px',
            lg: '1024px',
            xl: '1280px',
        });
        expect(letbuyyTailwindScreens).toEqual(letbuyyBreakpointTokens);
        expect(letbuyyTokenCssVariables.light['--lb-bp-md']).toBe('768px');
        expect(letbuyyTokenCssVariables.dark['--lb-bp-xl']).toBe('1280px');
        expect(letbuyyTokenCssVariables.light['--lb-shadow-card']).toBe(letbuyyShadowTokens.cardLight);
        expect(letbuyyTokenCssVariables.dark['--lb-shadow-card']).toBe(letbuyyShadowTokens.cardDark);
        expect(letbuyyTokenCssVariables.light['--lb-component-card-shadow']).toBe(letbuyyShadowTokens.cardLight);
        expect(letbuyyTokenCssVariables.dark['--lb-component-card-shadow']).toBe(letbuyyShadowTokens.cardDark);
    });

    it('keeps light-mode text token pairs at AA contrast', () => {
        const light = letbuyyTokenCssVariables.light;
        const statusPairs = [
            ['--lb-component-banner-info-text', '--lb-component-banner-info-bg'],
            ['--lb-component-banner-success-text', '--lb-component-banner-success-bg'],
            ['--lb-component-banner-warning-text', '--lb-component-banner-warning-bg'],
            ['--lb-component-banner-danger-text', '--lb-component-banner-danger-bg'],
        ] as const;

        expect(contrastRatio(light['--lb-color-text-muted'], light['--lb-color-surface'])).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(light['--lb-color-primary-text'], light['--lb-color-surface'])).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(light['--lb-color-focus-ring'], light['--lb-color-surface'])).toBeGreaterThanOrEqual(3);

        for (const [textToken, bgToken] of statusPairs) {
            expect(contrastRatio(light[textToken], light[bgToken])).toBeGreaterThanOrEqual(4.5);
        }
    });

    it('uses the AA-safe purple ramp for primary CTA buttons in light and dark themes', () => {
        const themes = [letbuyyTokenCssVariables.light, letbuyyTokenCssVariables.dark] as const;

        for (const variables of themes) {
            expect(variables['--lb-component-button-primary-bg']).toBe('#6D28D9');
            expect(variables['--lb-component-button-primary-hover']).toBe('#5B21B6');
            expect(variables['--lb-component-button-primary-active']).toBe('#4C1D95');
            expect(variables['--lb-component-button-primary-text']).toBe('#FFFFFF');
            expect(contrastRatio(variables['--lb-component-button-primary-text'], variables['--lb-component-button-primary-bg'])).toBeGreaterThanOrEqual(4.5);
            expect(contrastRatio(variables['--lb-component-button-primary-text'], variables['--lb-component-button-primary-hover'])).toBeGreaterThanOrEqual(4.5);
            expect(contrastRatio(variables['--lb-component-button-primary-text'], variables['--lb-component-button-primary-active'])).toBeGreaterThanOrEqual(4.5);
        }
    });

    it('merges Tailwind class conflicts through cx', () => {
        const merged = cx('px-2 py-1 text-red-500', false, null, 'px-4 text-blue-500');

        expect(merged).toContain('px-4');
        expect(merged).toContain('py-1');
        expect(merged).toContain('text-blue-500');
        expect(merged).not.toContain('px-2');
        expect(merged).not.toContain('text-red-500');
    });

    it('emits surface hooks with identity defaults and supports brand overrides', async () => {
        const brand = {
            primary: '#0055FF',
            primaryText: '#003399',
            primaryCta: '#111827',
            primaryCtaHover: '#0F172A',
            primaryCtaText: '#FFFFFF',
            focusRing: '#FF5500',
        };
        const brandVariables = createLetbuyyBrandVariables(brand);
        const { container } = render(
            <DesignSystemRoot surface="identity" brand={brand} dir="rtl">
                <Button>Brand action</Button>
            </DesignSystemRoot>,
        );
        const root = container.querySelector('[data-letbuyy-design-system="true"]') as HTMLElement;

        expect(letbuyySurfaceTokens.identity.light['--lb-color-bg']).toBe(letbuyyTokenCssVariables.light['--lb-color-bg']);
        expect(letbuyySurfaceTokens.storefront.dark['--lb-color-bg']).toBe(letbuyyTokenCssVariables.dark['--lb-color-bg']);
        expect(letbuyyTokenCss).toContain('[data-letbuyy-surface="identity"][data-letbuyy-theme="light"]');
        expect(letbuyyTokenCss).toContain('[data-letbuyy-surface="storefront"][data-letbuyy-theme="auto"]');
        expect(brandVariables['--lb-color-primary']).toBe('#0055FF');
        expect(brandVariables['--lb-component-button-primary-bg']).toBe('#111827');
        expect(brandVariables['--lb-color-focus-ring']).toBe('#FF5500');
        expect(root.getAttribute('data-letbuyy-surface')).toBe('identity');
        expect(root.getAttribute('dir')).toBe('rtl');
        expect(root.style.getPropertyValue('--lb-color-primary')).toBe('#0055FF');
        expect(root.style.getPropertyValue('--lb-component-button-primary-bg')).toBe('#111827');
        await expectAxeClean(container);
    });

    it('validates custom brand contrast and exposes stable page identity resolution', () => {
        const failingChecks = validateLetbuyyBrandContrast({
            primary: '#FFFFFF',
            primaryText: '#FFFFFF',
            primaryCta: '#FFFFFF',
            primaryCtaText: '#FFFFFF',
            focusRing: '#FFFFFF',
        });
        const passingChecks = validateLetbuyyBrandContrast({
            primary: '#0055FF',
            primaryText: '#003399',
            primaryCta: '#111827',
            primaryCtaText: '#FFFFFF',
            focusRing: '#5B21B6',
        });

        expect(failingChecks.some((check) => !check.passes)).toBe(true);
        expect(passingChecks.every((check) => check.passes)).toBe(true);
        expect(resolvePageIdentity('Checkout settings')).toBe('settings');
        expect(resolvePageIdentity('Custom domains')).toBe('domains');
    });

    it('dedupes token style injection for nested DesignSystemRoot trees', () => {
        const { container } = render(
            <DesignSystemRoot>
                <DesignSystemRoot surface="storefront">
                    <Button>Nested action</Button>
                </DesignSystemRoot>
            </DesignSystemRoot>,
        );

        expect(container.querySelectorAll('style[data-letbuyy-token-source="true"]')).toHaveLength(1);
        expect(container.querySelectorAll('[data-letbuyy-design-system="true"]')).toHaveLength(2);
    });
});
