import React from 'react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DesignSystemRoot, Navigation, isNavItemActive } from '../../src';

function renderInSystem(ui: React.ReactElement) {
    return render(<DesignSystemRoot>{ui}</DesignSystemRoot>);
}

const linkedParent = (overrides: Record<string, unknown> = {}) => ({
    id: 'products',
    label: 'Products',
    href: '/saai/products',
    children: [
        { id: 'c1', label: 'Collections', href: '/saai/products/collections' },
        { id: 'c2', label: 'Categories', href: '/saai/categories' },
    ],
    ...overrides,
});

describe('Navigation — parent that is also a destination', () => {
    it('renders the parent as a link plus a separate disclosure button', () => {
        renderInSystem(<Navigation items={[linkedParent()]} />);

        expect(screen.getByRole('link', { name: 'Products' }).getAttribute('href')).toBe('/saai/products');
        expect(screen.getByRole('button', { name: 'Toggle Products section' })).toBeTruthy();
    });

    it('does not nest the disclosure button inside the anchor', () => {
        const { container } = renderInSystem(<Navigation items={[linkedParent()]} />);
        expect(container.querySelector('a button')).toBeNull();
    });

    it('toggles children without navigating', () => {
        renderInSystem(<Navigation items={[linkedParent()]} />);
        const toggle = screen.getByRole('button', { name: 'Toggle Products section' });

        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        fireEvent.click(toggle);
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByRole('link', { name: 'Collections' })).toBeTruthy();
    });

    it('stays open when the route matches the parent itself', () => {
        renderInSystem(<Navigation items={[linkedParent({ active: true })]} />);

        expect(
            screen.getByRole('button', { name: 'Toggle Products section' }).getAttribute('aria-expanded'),
        ).toBe('true');
    });

    it('marks exactly one row as current when a child is active', () => {
        renderInSystem(
            <Navigation
                items={[
                    linkedParent({
                        active: true,
                        children: [
                            { id: 'c1', label: 'Collections', href: '/saai/products/collections', active: true },
                        ],
                    }),
                ]}
            />,
        );

        expect(document.querySelectorAll('[aria-current="page"]').length).toBe(1);
        expect(screen.getByRole('link', { name: 'Collections' }).getAttribute('aria-current')).toBe('page');
    });

    it('keeps href-less parents as toggle-only rows', () => {
        renderInSystem(<Navigation items={[linkedParent({ href: undefined })]} />);

        expect(screen.queryByRole('link', { name: 'Products' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Products' })).toBeTruthy();
    });

    it('has no axe violations', async () => {
        const { container } = renderInSystem(<Navigation items={[linkedParent({ active: true })]} />);
        expect((await axe(container)).violations).toEqual([]);
    });
});

describe('isNavItemActive — exact matching', () => {
    it('prefix-matches by default so a section stays lit on sub-routes', () => {
        expect(isNavItemActive('/saai/products/collections', '/saai/products')).toBe(true);
    });

    it('does not leak into a sibling section when exact is set', () => {
        // The regression this flag exists for: /products/inventory belongs to
        // the Inventory group and must not also light up Products.
        expect(isNavItemActive('/saai/products/inventory', '/saai/products', true)).toBe(false);
        expect(isNavItemActive('/saai/products', '/saai/products', true)).toBe(true);
    });
});
