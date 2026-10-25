import React, { useState } from 'react';
import {
    Badge,
    Breadcrumbs,
    Button,
    Card,
    Chart,
    DateRangePicker,
    DensityToggle,
    DescriptionList,
    Divider,
    FilterChips,
    Page,
    PageHeader,
    ProgressBar,
    Section,
    Spinner,
    Text,
    type DateRangeValue,
    type LetbuyyDensity,
} from './index';

const chartData = [
    { label: 'Mon', value: 12000 },
    { label: 'Tue', value: 18500 },
    { label: 'Wed', value: 16200 },
    { label: 'Thu', value: 24400 },
    { label: 'Fri', value: 31800 },
    { label: 'Sat', value: 29200 },
    { label: 'Sun', value: 35600 },
];

const storyWrapper = (children: React.ReactNode) => (
    <Page as="main">
        <PageHeader title="Component Preview" description="Token-driven primitives for merchant workflows." showDescription />
        {children}
    </Page>
);

export default {
    title: 'LetBuyy UI/Checklist Components',
};

export function ChartStory() {
    return storyWrapper(
        <div className="grid gap-[var(--lb-density-card-gap)] lg:grid-cols-3">
            <Chart type="line" ariaLabel="Weekly revenue line chart" data={chartData} />
            <Chart type="area" ariaLabel="Weekly revenue area chart" data={chartData} />
            <Chart type="bar" ariaLabel="Weekly revenue bar chart" data={chartData} />
        </div>,
    );
}

export function ChecklistOverviewStory() {
    const [range, setRange] = useState<DateRangeValue>({
        start: '2026-06-01',
        end: '2026-06-30',
        compareToPrevious: true,
    });
    const [density, setDensity] = useState<LetbuyyDensity>('compact');

    return storyWrapper(
        <div className="grid gap-[var(--lb-density-card-gap)]">
            <Card>
                <Section title="Analytics" description="Chart, date range, progress, and density controls composed together.">
                    <div className="grid gap-[var(--lb-density-card-gap)] xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
                        <Chart type="area" ariaLabel="Revenue overview" data={chartData} />
                        <div className="grid content-start gap-[var(--lb-space-4)]">
                            <DateRangePicker value={range} onChange={setRange} />
                            <DensityToggle value={density} onChange={setDensity} />
                            <ProgressBar label="Opening checklist" value={72} showValue />
                        </div>
                    </div>
                </Section>
            </Card>
            <Card>
                <Section title="List controls" description="Filter chips, breadcrumbs, description lists, separators, spinners, and semantic text.">
                    <div className="grid gap-[var(--lb-space-4)]">
                        <Breadcrumbs
                            items={[
                                { label: 'Home', href: '#' },
                                { label: 'Orders', href: '#' },
                                { label: 'LB-1024' },
                            ]}
                        />
                        <FilterChips
                            chips={[
                                { label: 'Payment', value: 'Paid', onRemove: () => undefined },
                                { label: 'Channel', value: 'Online store', onRemove: () => undefined },
                            ]}
                            onClearAll={() => undefined}
                        />
                        <DescriptionList
                            columns={2}
                            items={[
                                { term: 'Order', description: '#LB-1024' },
                                { term: 'Payment', description: <Badge label="Paid" variant="success" /> },
                                { term: 'Risk', description: <Text variant="positive">Low</Text> },
                                { term: 'Sync event', description: <Text variant="code">order.created</Text> },
                            ]}
                        />
                        <Divider />
                        <div className="flex items-center gap-[var(--lb-space-3)]">
                            <Spinner label="Refreshing orders" />
                            <Text variant="subdued">Refreshing order data</Text>
                        </div>
                    </div>
                </Section>
            </Card>
        </div>,
    );
}

export function DateRangePickerStory() {
    const [range, setRange] = useState<DateRangeValue>({
        start: '2026-06-01',
        end: '2026-06-30',
        compareToPrevious: true,
    });

    return storyWrapper(
        <Card>
            <Section title="Analytics range" description="Native date inputs keep keyboard, locale, and mobile behavior intact.">
                <DateRangePicker value={range} onChange={setRange} />
            </Section>
        </Card>,
    );
}

export function DensityToggleStory() {
    const [density, setDensity] = useState<LetbuyyDensity>('compact');

    return storyWrapper(
        <Card>
            <Section title="Table density" description="Density changes are surfaced as an explicit segmented control.">
                <DensityToggle value={density} onChange={setDensity} />
                <div className="text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text-subdued)]">
                    Active density: <Text variant="strong">{density}</Text>
                </div>
            </Section>
        </Card>,
    );
}

export function FilterChipsStory() {
    return storyWrapper(
        <Card>
            <Section title="Active filters" description="Clearable filter pills for lists and index views.">
                <FilterChips
                    chips={[
                        { label: 'Status', value: 'Paid', onRemove: () => undefined },
                        { label: 'Channel', value: 'Online store', onRemove: () => undefined },
                        { label: 'Risk', value: 'Low', onRemove: () => undefined },
                    ]}
                    onClearAll={() => undefined}
                />
            </Section>
        </Card>,
    );
}

export function ProgressBarStory() {
    return storyWrapper(
        <Card>
            <Section title="Setup guide" description="Progress states support explicit labels and assistive values.">
                <ProgressBar label="Store launch checklist" value={72} showValue />
                <ProgressBar label="Media upload" value={42} showValue />
            </Section>
        </Card>,
    );
}

export function BreadcrumbsStory() {
    return storyWrapper(
        <Card>
            <Section title="Navigation hierarchy" description="Standalone breadcrumbs can be used inside or outside PageHeader.">
                <Breadcrumbs
                    items={[
                        { label: 'Home', href: '#' },
                        { label: 'Products', href: '#' },
                        { label: 'Classic Sneakers' },
                    ]}
                />
            </Section>
        </Card>,
    );
}

export function DescriptionListStory() {
    return storyWrapper(
        <Card>
            <Section title="Order details" description="Responsive key-value pairs stack on mobile and split on larger screens.">
                <DescriptionList
                    columns={2}
                    items={[
                        { term: 'Order', description: '#LB-1024' },
                        { term: 'Payment', description: <Badge label="Paid" variant="success" /> },
                        { term: 'Customer', description: 'Aarav Mehta' },
                        { term: 'Fulfillment', description: 'Ready to ship' },
                    ]}
                />
            </Section>
        </Card>,
    );
}

export function DividerStory() {
    return storyWrapper(
        <Card>
            <Section title="Separators" description="Horizontal and vertical dividers use border tokens only.">
                <div className="grid gap-[var(--lb-space-4)]">
                    <div className="flex items-center gap-[var(--lb-space-3)]">
                        <Text variant="strong">Orders</Text>
                        <Divider orientation="vertical" />
                        <Text variant="subdued">Today</Text>
                    </div>
                    <Divider />
                    <Text variant="subdued">Section content continues after the divider.</Text>
                </div>
            </Section>
        </Card>,
    );
}

export function SpinnerStory() {
    return storyWrapper(
        <Card>
            <Section title="Loading states" description="Spinner uses the same loader icon as buttons and save bars.">
                <div className="flex items-center gap-[var(--lb-space-4)]">
                    <Spinner size="sm" label="Loading compact data" />
                    <Spinner label="Loading products" />
                    <Spinner size="lg" label="Loading report" />
                    <Button loading>Syncing</Button>
                </div>
            </Section>
        </Card>,
    );
}

export function TextVariantsStory() {
    return storyWrapper(
        <Card>
            <Section title="Text styles" description="Common semantic text treatments without ad-hoc utility strings.">
                <div className="grid gap-[var(--lb-space-2)]">
                    <Text>Default body text</Text>
                    <Text variant="subdued">Subdued supporting text</Text>
                    <Text variant="strong">Strong operational label</Text>
                    <Text variant="positive">+12.5% conversion lift</Text>
                    <Text variant="negative">-3 failed payouts</Text>
                    <Text variant="code">storefront.sync.completed</Text>
                </div>
            </Section>
        </Card>,
    );
}
