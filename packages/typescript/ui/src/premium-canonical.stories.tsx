'use client';

import React, { useState } from 'react';
import { Badge, Banner, Button, Card, DesignSystemRoot, Input, MetricCard, Modal, Page, PageHeader, Section, Table, ToastProvider, useToast } from './index';

export default { title: 'Merchant/Premium canonical system', parameters: { layout: 'fullscreen' } };
const rows = [{ id: 'specimen', title: 'Example unpublished product', status: 'Draft', inventory: '—' }];

function Specimen() {
    const [open, setOpen] = useState(false);
    const { notify } = useToast();
    return <Page as="main">
        <PageHeader recipe="index" identity="products" title="Products with a deliberately long translated heading" showDescription description="Shared typography, quiet surfaces and one principal page action." primaryAction={{ label: 'Add a product with a longer localized label', onClick: () => setOpen(true) }} secondaryActions={[{ label: 'Export the current selection', onClick: () => notify({ title: 'Presentation specimen', description: 'No export was dispatched.' }) }]} />
        <Card><Section title="Premium purple roles" description="Admin surface bindings; storefront and Identity retain their own roles."><div className="grid grid-cols-2 gap-[var(--lb-space-3)] sm:grid-cols-4">
            {['--lb-component-sidebar-bg', '--lb-color-primary', '--lb-color-primary-text', '--lb-color-focus-ring', '--lb-color-primary-soft', '--lb-color-bg', '--lb-color-surface', '--lb-component-input-border'].map(role => <div key={role}><div className="h-[var(--lb-space-9)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)]" style={{ background: `var(${role})` }} /><code className="break-all text-[length:var(--lb-font-size-caption)]">{role}</code></div>)}
        </div></Section></Card>
        <div className="grid gap-[var(--lb-space-4)] sm:grid-cols-2"><MetricCard label="Orders · current period" value="0" /><MetricCard label="Average order · after first order" value="—" /></div>
        <Section variant="grouped" title="Store details" description="Same boundary, title and spacing as the main form." columns={2}><Input label="Store name" defaultValue="Example store" helperText="Public name" /><Input label="Contact email" type="email" error="Enter an email address" /></Section>
        <Card><Section title="Catalog" action={<Badge label="Unpublished fixture" variant="warning" />}><Table rows={rows} columns={[{ key: 'title', header: 'Product' }, { key: 'status', header: 'Status', render: row => <Badge label={row.status} variant="warning" /> }, { key: 'inventory', header: 'Inventory' }]} /></Section></Card>
        <Banner variant="warning" title="Save not confirmed">A presentation example of persistent recovery feedback; no success is claimed.</Banner>
        <Modal open={open} onClose={() => setOpen(false)} title="Focused task" description="Existing modal owner and focus behavior." footer={<Button variant="secondary" onClick={() => setOpen(false)}>Close</Button>}><Input label="Optional note" /></Modal>
    </Page>;
}

export const SharedSurfaces = () => <DesignSystemRoot surface="admin" theme="light"><ToastProvider><Specimen /></ToastProvider></DesignSystemRoot>;
