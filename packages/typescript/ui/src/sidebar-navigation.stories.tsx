import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { MaterialIcon } from './icons';
import { Navigation, Sidebar } from './app-shell';

/**
 * The merchant sidebar shape: groups whose parent row is itself a destination.
 * Clicking the row navigates; the chevron toggles without navigating.
 */
const meta: Meta<typeof Navigation> = {
    title: 'LetBuyy UI/Sidebar Navigation',
    component: Navigation,
};

export default meta;
type Story = StoryObj<typeof Navigation>;

const icon = (name: string) => <MaterialIcon name={name} size={16} aria-hidden="true" />;

const items = [
    { id: 'dashboard', label: 'Home', href: '/saai/dashboard', icon: icon('home') },
    { id: 'orders', label: 'Orders', href: '/saai/orders', icon: icon('shopping_bag') },
    {
        id: 'products',
        label: 'Products',
        href: '/saai/products',
        icon: icon('inventory_2'),
        active: true,
        children: [
            { id: 'p1', label: 'Add product', href: '/saai/products/new' },
            { id: 'p2', label: 'Collections', href: '/saai/products/collections' },
            { id: 'p3', label: 'Smart collections', href: '/saai/products/smart-collections' },
            { id: 'p4', label: 'Categories', href: '/saai/categories' },
            { id: 'p5', label: 'Export and import', href: '/saai/export' },
        ],
    },
    {
        id: 'inventory',
        label: 'Inventory',
        href: '/saai/products/inventory',
        icon: icon('inventory'),
        children: [
            { id: 'i1', label: 'Inventory history', href: '/saai/products/inventory-history' },
            { id: 'i2', label: 'Reservations', href: '/saai/products/reservations' },
            { id: 'i3', label: 'Locations', href: '/saai/products/locations' },
        ],
    },
    {
        id: 'purchasing',
        label: 'Purchasing',
        href: '/saai/products/purchase-orders',
        icon: icon('local_shipping'),
        children: [
            { id: 'r1', label: 'Transfers', href: '/saai/products/transfers' },
            { id: 'r2', label: 'Receipts', href: '/saai/products/receipts' },
            { id: 'r3', label: 'Vendors', href: '/saai/products/suppliers' },
        ],
    },
    {
        id: 'customers',
        label: 'Customers',
        href: '/saai/customers',
        icon: icon('group'),
        children: [{ id: 'cu1', label: 'Segments', href: '/saai/customers/segments' }],
    },
    {
        // Toggle-only: its own path is one of its children, so no parent link.
        id: 'money',
        label: 'Money',
        icon: icon('payments'),
        children: [
            { id: 'm1', label: 'Billing', href: '/saai/settings/billing' },
            { id: 'm2', label: 'Payouts', href: '/saai/payouts' },
            { id: 'm3', label: 'Gift cards', href: '/saai/products/gift-cards' },
        ],
    },
    { id: 'analytics', label: 'Analytics', href: '/saai/analytics', icon: icon('bar_chart') },
];

export const MerchantSidebar: Story = {
    render: () => (
        <div className="flex h-[720px]">
            <Sidebar header={<strong>LetBuyy</strong>} width="sm">
                <Navigation items={items} />
            </Sidebar>
        </div>
    ),
};
