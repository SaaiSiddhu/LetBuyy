import React, { useState } from 'react';
import { Badge, Table, Text } from './index';

const meta = {
    title: 'LetBuyy UI/Table',
};

export default meta;

type ProductRow = {
    id: string;
    title: string;
    status: 'Active' | 'Draft';
    inventory: number;
    channel: string;
};

const rows: ProductRow[] = [
    { id: 'prod-1', title: 'Handwoven cotton kurta', status: 'Active', inventory: 42, channel: 'Online store' },
    { id: 'prod-2', title: 'Brass diya gift set', status: 'Draft', inventory: 18, channel: 'Marketplace' },
    { id: 'prod-3', title: 'Block print notebook', status: 'Active', inventory: 96, channel: 'Retail POS' },
];

export function UnifiedTable() {
    const [activeView, setActiveView] = useState('all');
    const [sortKey, setSortKey] = useState('title');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    return (
        <Table<ProductRow>
            rows={rows}
            activeView={activeView}
            onViewChange={setActiveView}
            savedViews={[
                { label: 'All', value: 'all', count: 3 },
                { label: 'Active', value: 'active', count: 2 },
                { label: 'Draft', value: 'draft', count: 1 },
            ]}
            filterChips={[{ label: 'Channel: Online' }]}
            bulkActions={[{ label: 'Archive', onAction: () => undefined }]}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={(key) => {
                setSortKey(key);
                setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
            }}
            columns={[
                {
                    key: 'title',
                    header: 'Product',
                    sortable: true,
                    render: (row) => <Text as="span" variant="strong" reset={false}>{row.title}</Text>,
                },
                {
                    key: 'status',
                    header: 'Status',
                    render: (row) => <Badge label={row.status} variant={row.status === 'Active' ? 'success' : 'info'} />,
                },
                {
                    key: 'inventory',
                    header: 'Inventory',
                    sortable: true,
                    render: (row) => `${row.inventory} in stock`,
                },
                {
                    key: 'channel',
                    header: 'Channel',
                },
            ]}
        />
    );
}
