import type { LetbuyyApiClient } from '@letbuyy/api-client';
import type { Store, StoreSummary } from '@letbuyy/shared-types';
import {
    Banner,
    Badge,
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
import { createPlatformOperationsApiClient } from '../../../lib/api/client';
import { CrmContactIndexTable } from './CrmContactIndexTable';

type SearchParamValue = string | string[] | undefined;
type CrmStage = 'contact_ready' | 'needs_profile' | 'needs_backend';

interface CrmPageProps {
    searchParams?: Promise<Record<string, SearchParamValue>>;
}

export interface CrmContactRow {
    id: string;
    merchantName: string;
    storeHandle: string;
    siteType: string;
    contactName: string;
    contactDetail: string;
    stage: CrmStage;
    stageLabel: string;
    lastInteraction: string;
    notesPreview: string;
    nextAction: string;
    hasContact: boolean;
    hasNotes: boolean;
    interactionSource: 'store_updated' | 'store_published' | 'store_created' | 'unavailable';
}

interface CrmLoadResult {
    rows: CrmContactRow[];
    totalStores: number;
    loadError: string | null;
}

const CRM_FILTER_OPTIONS = [
    { label: 'All contacts', value: 'all' },
    { label: 'Contact ready', value: 'contact_ready' },
    { label: 'Needs profile', value: 'needs_profile' },
    { label: 'Backend needed', value: 'needs_backend' },
];

export default async function CrmPage({ searchParams }: CrmPageProps) {
    const params = searchParams ? await searchParams : {};
    const query = firstParam(params.q).trim();
    const stageFilter = normalizeStageFilter(firstParam(params.stage));
    const result = await loadCrmContacts();
    const visibleRows = applyFilters(result.rows, query, stageFilter);
    const summary = summarizeCrm(result.rows);

    return (
        <Page>
            <PageHeader
                title="Merchant CRM"
                description="Operational merchant relationship workspace derived from the existing store profile APIs."
                iconName="users"
                showDescription
                secondaryActions={[
                    { label: 'Merchant Health', href: '/merchant-health' },
                    { label: 'Operations', href: '/operations' },
                ]}
            />

            <PageContent>
                <div className="grid gap-[var(--lb-density-card-gap)] md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                        label="Merchant contacts"
                        value={summary.totalContacts.toLocaleString('en-IN')}
                        delta={`${result.totalStores.toLocaleString('en-IN')} stores sampled`}
                        deltaTone={summary.totalContacts > 0 ? 'neutral' : 'negative'}
                    />
                    <MetricCard
                        label="Contact ready"
                        value={summary.contactReady.toLocaleString('en-IN')}
                        delta="Email or phone present"
                        deltaTone={summary.contactReady > 0 ? 'positive' : 'negative'}
                    />
                    <MetricCard
                        label="Notes captured"
                        value={summary.notesAvailable.toLocaleString('en-IN')}
                        delta="CRM notes endpoint needed"
                        deltaTone={summary.notesAvailable > 0 ? 'positive' : 'negative'}
                    />
                    <MetricCard
                        label="Interaction source"
                        value={summary.storeUpdated.toLocaleString('en-IN')}
                        delta="Store timestamps only"
                        deltaTone="neutral"
                    />
                </div>

                <Banner title="CRM backend required" variant="warning">
                    Current contact rows are derived from authenticated merchant-owned store profiles. A real employee CRM needs
                    platform-wide merchant accounts, owner contact details, editable notes, interaction history, follow-up tasks,
                    assigned operators, consent state, and audit-backed activity logs.
                </Banner>

                {result.loadError ? (
                    <Banner title="Unable to load CRM scaffold" variant="critical">
                        {result.loadError}
                    </Banner>
                ) : null}

                <div className="grid gap-[var(--lb-density-card-gap)] xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                    <Card>
                        <Section
                            title="CRM coverage"
                            description="How much of the merchant relationship record can be inferred from current store APIs."
                        >
                            <Chart
                                ariaLabel="Merchant CRM coverage"
                                data={[
                                    { label: 'Contact ready', value: summary.contactReady },
                                    { label: 'Needs profile', value: summary.needsProfile },
                                    { label: 'Notes missing', value: summary.notesMissing },
                                ]}
                                type="bar"
                                height="md"
                            />
                        </Section>
                    </Card>

                    <Card>
                        <Section title="CRM contract gaps" description="Visible placeholders until operations CRM data is exposed.">
                            <DescriptionList
                                columns={1}
                                items={[
                                    { term: 'Merchant owner', description: <Badge label="Backend needed" variant="warning" /> },
                                    { term: 'Editable notes', description: <Badge label="Backend needed" variant="warning" /> },
                                    { term: 'Last interaction', description: 'Using store timestamps as the only available signal' },
                                    { term: 'Follow-up tasks', description: <Badge label="Backend needed" variant="warning" /> },
                                ]}
                            />
                        </Section>
                    </Card>
                </div>

                <Card>
                    <Section title="CRM filters" description="Filter the locally derived merchant contact sample.">
                        <form action="/crm" method="get">
                            <FilterBar
                                search={
                                    <Input
                                        label="Search"
                                        name="q"
                                        type="search"
                                        defaultValue={query}
                                        placeholder="Merchant, handle, or contact"
                                    />
                                }
                                filters={
                                    <Select
                                        label="Stage"
                                        name="stage"
                                        defaultValue={stageFilter}
                                        options={CRM_FILTER_OPTIONS}
                                    />
                                }
                                actions={<Button type="submit">Search</Button>}
                            />
                        </form>
                    </Section>
                </Card>

                <CrmContactIndexTable rows={visibleRows} />

                <div className="grid gap-[var(--lb-density-card-gap)] lg:grid-cols-3">
                    <Button type="button" variant="outline" disabled>
                        Add note
                    </Button>
                    <Button type="button" variant="outline" disabled>
                        Log interaction
                    </Button>
                    <Button type="button" variant="outline" disabled>
                        Assign follow-up
                    </Button>
                </div>

                <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                    Showing {visibleRows.length.toLocaleString('en-IN')} of {result.rows.length.toLocaleString('en-IN')} CRM rows from the first {result.totalStores.toLocaleString('en-IN')} stores available to this session.
                </p>
            </PageContent>
        </Page>
    );
}

async function loadCrmContacts(): Promise<CrmLoadResult> {
    try {
        const api = await createPlatformOperationsApiClient({ requireSession: true });
        const stores = await api.stores.list({ limit: 50 });
        const rows = await Promise.all(stores.data.map((store) => buildCrmRow(api, store)));

        return {
            rows,
            totalStores: stores.total,
            loadError: null,
        };
    } catch (error) {
        return {
            rows: [],
            totalStores: 0,
            loadError: error instanceof Error ? error.message : 'Unable to load CRM scaffold',
        };
    }
}

async function buildCrmRow(api: LetbuyyApiClient, summary: StoreSummary): Promise<CrmContactRow> {
    const detail = await safeRead(() => api.stores.get(summary.id));
    const store = detail.data;
    const contactEmail = readString(store?.settings, ['support_email', 'contact_email', 'owner_email', 'email']);
    const contactPhone = readString(store?.settings, ['support_phone', 'contact_phone', 'owner_phone', 'phone']);
    const hasContact = Boolean(contactEmail || contactPhone);
    const storeName = summary.store_name || store?.name || summary.name;
    const legalName = store?.legal_name || null;
    const interaction = getLastInteraction(store);
    const stage = getStage(hasContact, Boolean(store));

    return {
        id: summary.id,
        merchantName: legalName || storeName,
        storeHandle: summary.subdomain,
        siteType: formatLabel(store?.site_type ?? summary.site_type),
        contactName: legalName || storeName,
        contactDetail: contactEmail || contactPhone || 'Owner contact not exposed',
        stage,
        stageLabel: stage === 'contact_ready' ? 'Contact ready' : stage === 'needs_profile' ? 'Needs profile' : 'Backend needed',
        lastInteraction: interaction.label,
        notesPreview: 'No CRM notes endpoint yet. Capture notes when the operations backend is available.',
        nextAction: hasContact ? 'Review relationship history when CRM backend is available' : 'Add owner email or phone through CRM backend',
        hasContact,
        hasNotes: false,
        interactionSource: interaction.source,
    };
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

function getStage(hasContact: boolean, hasStoreDetail: boolean): CrmStage {
    if (!hasStoreDetail) return 'needs_backend';
    if (hasContact) return 'contact_ready';
    return 'needs_profile';
}

function getLastInteraction(store: Store | null): { label: string; source: CrmContactRow['interactionSource'] } {
    if (!store) return { label: 'Store detail unavailable', source: 'unavailable' };

    const candidates = [
        { value: store.updated_at, label: 'Store profile updated', source: 'store_updated' as const },
        { value: store.published_at, label: 'Store published', source: 'store_published' as const },
        { value: store.created_at, label: 'Store created', source: 'store_created' as const },
    ].filter((candidate) => Boolean(candidate.value));

    candidates.sort((left, right) => new Date(right.value || '').getTime() - new Date(left.value || '').getTime());
    const latest = candidates[0];
    if (!latest?.value) return { label: 'No interaction timestamp available', source: 'unavailable' };

    return {
        label: `${latest.label} ${formatDateTime(latest.value)}`,
        source: latest.source,
    };
}

function summarizeCrm(rows: CrmContactRow[]) {
    return {
        totalContacts: rows.length,
        contactReady: rows.filter((row) => row.hasContact).length,
        needsProfile: rows.filter((row) => row.stage === 'needs_profile').length,
        notesAvailable: rows.filter((row) => row.hasNotes).length,
        notesMissing: rows.filter((row) => !row.hasNotes).length,
        storeUpdated: rows.filter((row) => row.interactionSource === 'store_updated').length,
    };
}

function applyFilters(rows: CrmContactRow[], query: string, stageFilter: string): CrmContactRow[] {
    const normalizedQuery = query.toLowerCase();

    return rows.filter((row) => {
        const matchesQuery = !normalizedQuery || `${row.merchantName} ${row.storeHandle} ${row.contactDetail}`.toLowerCase().includes(normalizedQuery);
        const matchesStage = stageFilter === 'all' || row.stage === stageFilter;
        return matchesQuery && matchesStage;
    });
}

function normalizeStageFilter(value: string): string {
    return CRM_FILTER_OPTIONS.some((option) => option.value === value) ? value : 'all';
}

function firstParam(value: SearchParamValue): string {
    if (Array.isArray(value)) return value[0] || '';
    return value || '';
}

function formatLabel(value: string): string {
    return value
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDateTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'at an unavailable time';

    return new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

function readString(source: unknown, keys: string[]): string | null {
    if (!source || typeof source !== 'object') return null;
    const record = source as Record<string, unknown>;

    for (const key of keys) {
        const value = record[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
    }

    return null;
}
