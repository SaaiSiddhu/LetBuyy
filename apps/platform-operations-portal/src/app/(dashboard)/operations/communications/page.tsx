import {
    Badge,
    Banner,
    Button,
    Card,
    Chart,
    DescriptionList,
    FilterBar,
    Input,
    MetricCard,
    Page,
    PageContent,
    PageHeader,
    Section,
    Select,
} from '@letbuyy/ui';
import { createPlatformOperationsApiClient } from '../../../../lib/api/client';
import { CommunicationTemplateIndexTable } from './CommunicationTemplateIndexTable';

type SearchParamValue = string | string[] | undefined;
type TemplateCategory = 'onboarding' | 'payments' | 'shipping' | 'launch';
type TemplateStatus = 'draft' | 'backend_needed';

interface CommunicationsPageProps {
    searchParams?: Promise<Record<string, SearchParamValue>>;
}

interface NotificationRecord {
    id?: string;
    type?: string | null;
    title?: string | null;
    message?: string | null;
    is_read?: boolean | null;
    created_at?: string | null;
}

interface NotificationPreferenceRecord {
    id?: string;
    channel?: string | null;
    category?: string | null;
    enabled?: boolean | null;
}

interface CommunicationsLoadResult {
    recipientCount: number;
    recentNotifications: NotificationRecord[];
    preferences: NotificationPreferenceRecord[];
    loadError: string | null;
}

export interface CommunicationTemplateRow {
    id: string;
    name: string;
    category: TemplateCategory;
    categoryLabel: string;
    channel: string;
    audience: string;
    trigger: string;
    status: TemplateStatus;
    statusLabel: string;
    preview: string;
    backendNeeded: boolean;
}

const CATEGORY_FILTER_OPTIONS = [
    { label: 'All categories', value: 'all' },
    { label: 'Onboarding', value: 'onboarding' },
    { label: 'Payments', value: 'payments' },
    { label: 'Shipping', value: 'shipping' },
    { label: 'Launch', value: 'launch' },
];

const TEMPLATE_ROWS: CommunicationTemplateRow[] = [
    {
        id: 'welcome-next-step',
        name: 'Welcome next step',
        category: 'onboarding',
        categoryLabel: 'Onboarding',
        channel: 'Email',
        audience: 'New merchants',
        trigger: 'Store created, checklist incomplete',
        status: 'backend_needed',
        statusLabel: 'Backend needed',
        preview: 'Welcome to LetBuyy. Your next setup step is ready in the dashboard.',
        backendNeeded: true,
    },
    {
        id: 'payment-setup',
        name: 'Payment setup reminder',
        category: 'payments',
        categoryLabel: 'Payments',
        channel: 'Email',
        audience: 'Stores without verified payments',
        trigger: 'Payment readiness missing',
        status: 'backend_needed',
        statusLabel: 'Backend needed',
        preview: 'Complete COD or online payment setup before launch.',
        backendNeeded: true,
    },
    {
        id: 'shipping-zone',
        name: 'Shipping zone reminder',
        category: 'shipping',
        categoryLabel: 'Shipping',
        channel: 'Email',
        audience: 'Stores without shipping zones',
        trigger: 'Shipping readiness missing',
        status: 'backend_needed',
        statusLabel: 'Backend needed',
        preview: 'Add your delivery zones so shoppers can complete checkout.',
        backendNeeded: true,
    },
    {
        id: 'launch-review',
        name: 'Launch review checklist',
        category: 'launch',
        categoryLabel: 'Launch',
        channel: 'Email',
        audience: 'Merchants nearing launch',
        trigger: 'Checklist reaches 80 percent',
        status: 'backend_needed',
        statusLabel: 'Backend needed',
        preview: 'Review products, payments, shipping, and storefront before going live.',
        backendNeeded: true,
    },
];

export default async function CommunicationsPage({ searchParams }: CommunicationsPageProps) {
    const params = searchParams ? await searchParams : {};
    const query = firstParam(params.q).trim();
    const category = normalizeCategoryFilter(firstParam(params.category));
    const result = await loadCommunications();
    const visibleTemplates = applyFilters(TEMPLATE_ROWS, query, category);
    const summary = summarizeCommunications(result, TEMPLATE_ROWS);

    return (
        <Page>
            <PageHeader
                title="Merchant Communications"
                description="Template-based merchant messaging scaffold for onboarding, payments, shipping, and launch support."
                iconName="mail"
                showDescription
                secondaryActions={[
                    { label: 'Onboarding Support', href: '/operations/onboarding' },
                    { label: 'CRM', href: '/crm' },
                ]}
            />

            <PageContent>
                <div className="grid gap-[var(--lb-density-card-gap)] md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                        label="Visible recipients"
                        value={summary.recipients.toLocaleString('en-IN')}
                        delta="Current session stores only"
                        deltaTone={summary.recipients > 0 ? 'neutral' : 'negative'}
                    />
                    <MetricCard
                        label="Templates"
                        value={summary.templates.toLocaleString('en-IN')}
                        delta="Local scaffold library"
                        deltaTone="neutral"
                    />
                    <MetricCard
                        label="Recent notifications"
                        value={summary.notifications.toLocaleString('en-IN')}
                        delta={`${summary.unread.toLocaleString('en-IN')} unread`}
                        deltaTone={summary.unread > 0 ? 'neutral' : 'positive'}
                    />
                    <MetricCard
                        label="Messaging backend"
                        value="Needed"
                        delta="No employee send workflow"
                        deltaTone="negative"
                    />
                </div>

                <Banner title="Communications backend required" variant="warning">
                    Current data can read the authenticated session&apos;s stores, user notifications, and notification
                    preferences. A real operations messaging workspace needs platform-wide merchant recipients, template
                    storage, consent and channel eligibility, preview rendering, delivery logs, schedule/send endpoints,
                    audit trails, and rate-limit/idempotency controls.
                </Banner>

                {result.loadError ? (
                    <Banner title="Unable to load communications context" variant="critical">
                        {result.loadError}
                    </Banner>
                ) : null}

                <div className="grid gap-[var(--lb-density-card-gap)] xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                    <Card>
                        <Section title="Template mix" description="Scaffold templates grouped by operational support use case.">
                            <Chart
                                ariaLabel="Merchant communication template mix"
                                data={[
                                    { label: 'Onboarding', value: TEMPLATE_ROWS.filter((row) => row.category === 'onboarding').length },
                                    { label: 'Payments', value: TEMPLATE_ROWS.filter((row) => row.category === 'payments').length },
                                    { label: 'Shipping', value: TEMPLATE_ROWS.filter((row) => row.category === 'shipping').length },
                                    { label: 'Launch', value: TEMPLATE_ROWS.filter((row) => row.category === 'launch').length },
                                ]}
                                type="bar"
                                height="md"
                            />
                        </Section>
                    </Card>

                    <Card>
                        <Section title="Messaging contract gaps" description="Current readable context versus required send workflow.">
                            <DescriptionList
                                columns={1}
                                items={[
                                    { term: 'Recipients', description: 'Authenticated session stores only' },
                                    { term: 'Preferences', description: `${result.preferences.length.toLocaleString('en-IN')} preference rows visible` },
                                    { term: 'Send and schedule', description: <Badge label="Backend needed" variant="warning" /> },
                                    { term: 'Audit and delivery logs', description: <Badge label="Backend needed" variant="warning" /> },
                                ]}
                            />
                        </Section>
                    </Card>
                </div>

                <Card>
                    <Section title="Template filters" description="Filter the local communications scaffold.">
                        <form action="/operations/communications" method="get">
                            <FilterBar
                                search={
                                    <Input
                                        label="Search"
                                        name="q"
                                        type="search"
                                        defaultValue={query}
                                        placeholder="Template, audience, or trigger"
                                    />
                                }
                                filters={
                                    <Select
                                        label="Category"
                                        name="category"
                                        defaultValue={category}
                                        options={CATEGORY_FILTER_OPTIONS}
                                    />
                                }
                                actions={<Button type="submit">Search</Button>}
                            />
                        </form>
                    </Section>
                </Card>

                <CommunicationTemplateIndexTable rows={visibleTemplates} />

                <div className="grid gap-[var(--lb-density-card-gap)] lg:grid-cols-3">
                    <Button type="button" variant="outline" disabled>
                        Preview message
                    </Button>
                    <Button type="button" variant="outline" disabled>
                        Schedule send
                    </Button>
                    <Button type="button" variant="outline" disabled>
                        Send now
                    </Button>
                </div>

                <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                    Showing {visibleTemplates.length.toLocaleString('en-IN')} of {TEMPLATE_ROWS.length.toLocaleString('en-IN')} communication templates. Recipient counts are limited to the {result.recipientCount.toLocaleString('en-IN')} stores visible to this session.
                </p>
            </PageContent>
        </Page>
    );
}

async function loadCommunications(): Promise<CommunicationsLoadResult> {
    try {
        const api = await createPlatformOperationsApiClient({ requireSession: true });
        const [stores, notifications, preferences] = await Promise.all([
            api.stores.list({ limit: 50 }),
            safeRead(() => api.requestPaginated<NotificationRecord>('/notifications', { query: { limit: 50 } })),
            safeRead(() => api.requestData<NotificationPreferenceRecord[]>('/notifications/preferences')),
        ]);

        return {
            recipientCount: stores.data.length,
            recentNotifications: notifications.data?.data ?? [],
            preferences: preferences.data ?? [],
            loadError: null,
        };
    } catch (error) {
        return {
            recipientCount: 0,
            recentNotifications: [],
            preferences: [],
            loadError: error instanceof Error ? error.message : 'Unable to load communications context',
        };
    }
}

async function safeRead<T>(loader: () => Promise<T>): Promise<{ data: T | null; error: string | null }> {
    try {
        return { data: await loader(), error: null };
    } catch (error) {
        return {
            data: null,
            error: error instanceof Error ? error.message : 'Data unavailable',
        };
    }
}

function summarizeCommunications(result: CommunicationsLoadResult, rows: CommunicationTemplateRow[]) {
    return {
        recipients: result.recipientCount,
        templates: rows.length,
        notifications: result.recentNotifications.length,
        unread: result.recentNotifications.filter((notification) => notification.is_read === false).length,
    };
}

function applyFilters(rows: CommunicationTemplateRow[], query: string, category: string): CommunicationTemplateRow[] {
    const normalizedQuery = query.toLowerCase();

    return rows.filter((row) => {
        const matchesQuery = !normalizedQuery || `${row.name} ${row.audience} ${row.trigger}`.toLowerCase().includes(normalizedQuery);
        const matchesCategory = category === 'all' || row.category === category;
        return matchesQuery && matchesCategory;
    });
}

function normalizeCategoryFilter(value: string): string {
    return CATEGORY_FILTER_OPTIONS.some((option) => option.value === value) ? value : 'all';
}

function firstParam(value: SearchParamValue): string {
    if (Array.isArray(value)) return value[0] || '';
    return value || '';
}
