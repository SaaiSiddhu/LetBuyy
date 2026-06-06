import React from 'react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import {
    Badge,
    Banner,
    Button,
    Card,
    Checkbox,
    Combobox,
    DesignSystemRoot,
    EmptyState,
    Input,
    Radio,
    Section,
    Select,
    Skeleton,
    Tabs,
} from '../../src';

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

    it('renders Input helper and error states', async () => {
        const { container, rerender } = renderInSystem(
            <Input label="Store name" helperText="Shown to shoppers" />,
        );

        const input = screen.getByLabelText('Store name');
        expect(input).toBeTruthy();
        expect(screen.getByText('Shown to shoppers')).toBeTruthy();

        rerender(
            <DesignSystemRoot>
                <Input label="Store name" error="Store name is required" />
            </DesignSystemRoot>,
        );

        const errorInput = screen.getByLabelText('Store name');
        expect(errorInput).toBeTruthy();
        expect(screen.getByText('Store name is required')).toBeTruthy();
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
});
