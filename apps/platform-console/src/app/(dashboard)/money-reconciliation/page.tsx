import { revalidatePath } from 'next/cache';
import { Button, Input, Select, Table, Textarea } from '@letbuyy/ui';
import {
    ConsoleWorkspace,
    EmptyDataState,
    LeadershipMetric,
    MetricGrid,
    Panel,
    StatusPill,
} from '@/components/_local-ui/console-workspace';
import { ConsoleApiErrorPanel } from '@/components/ConsoleDataTable';
import {
    fetchConsoleApi,
    formatDateTime,
    formatMoneyFromPaise,
    type ConsoleDataResponse,
    type ConsolePaginatedResponse,
} from '@/lib/console-api';
import { requireConsoleSession } from '@/lib/console-auth-server';

type SiteSummary = {
    id?: string | null;
    name?: string | null;
    store_name?: string | null;
    subdomain?: string | null;
};

type MoneyReconciliationRow = {
    site_id: string;
    status: 'verified' | 'mismatch';
    wallet_available_minor: number | string;
    ledger_merchant_payable_minor: number | string;
    variance_minor: number | string;
    verified_at: string | null;
    updated_at: string | null;
    sites?: SiteSummary | null;
};

type MoneyReconciliationResolveResult = {
    reconciliation: MoneyReconciliationRow;
    resolution: Record<string, unknown>;
};

const resolutionOptions = [
    { label: 'Request recheck', value: 'request_recheck' },
    { label: 'Provider explained', value: 'provider_explained' },
    { label: 'Acknowledge suspense', value: 'acknowledge_suspense' },
];

function moneyValue(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function siteLabel(row: MoneyReconciliationRow): string {
    return row.sites?.store_name || row.sites?.name || row.sites?.subdomain || row.site_id;
}

function requireActorId(actorId: string | null | undefined): string {
    if (!actorId) throw new Error('Console session is missing an actor id.');
    return actorId;
}

function optionalFormString(value: FormDataEntryValue | null): string | null {
    const trimmed = String(value || '').trim();
    return trimmed.length > 0 ? trimmed : null;
}

async function resolveMoneyBreak(formData: FormData) {
    'use server';

    const session = await requireConsoleSession({ mfa: true });
    const siteId = String(formData.get('site_id') || '').trim();
    const resolution = String(formData.get('resolution') || '').trim();
    const secondaryApproverId = String(formData.get('secondary_approver_id') || '').trim();
    const reason = String(formData.get('reason') || '').trim();

    if (!siteId || !resolution || !secondaryApproverId || reason.length < 8) {
        throw new Error('Money break resolution requires a site, resolution, second approver, and reason.');
    }

    const result = await fetchConsoleApi<ConsoleDataResponse<MoneyReconciliationResolveResult>>(
        `/internal/console/money/reconciliation/${siteId}/resolve`,
        {
            method: 'POST',
            body: {
                actor_id: requireActorId(session.userId),
                actor_email: session.email,
                secondary_approver_id: secondaryApproverId,
                reason,
                resolution,
                provider_reference: optionalFormString(formData.get('provider_reference')),
            },
        }
    );

    if (result.error) throw new Error(result.error);
    revalidatePath('/money-reconciliation');
}

export default async function MoneyReconciliationPage() {
    const [mismatchResult, verifiedResult] = await Promise.all([
        fetchConsoleApi<ConsolePaginatedResponse<MoneyReconciliationRow>>('/internal/console/money/reconciliation', {
            status: 'mismatch',
            reason: 'Operator review of money ledger breaks from platform console.',
            page: 1,
            limit: 25,
        }),
        fetchConsoleApi<ConsolePaginatedResponse<MoneyReconciliationRow>>('/internal/console/money/reconciliation', {
            status: 'verified',
            page: 1,
            limit: 25,
        }),
    ]);
    const mismatches = mismatchResult.data?.data || [];
    const verified = verifiedResult.data?.data || [];
    const totalVariance = mismatches.reduce((sum, row) => sum + Math.abs(moneyValue(row.variance_minor)), 0);

    return (
        <ConsoleWorkspace
            eyebrow="Money"
            title="Ledger Reconciliation"
            description="Operator break-resolution queue backed by canonical ledger reconciliation rows."
        >
            {mismatchResult.error ? <ConsoleApiErrorPanel title="Money breaks API unavailable" message={mismatchResult.error} /> : null}
            {verifiedResult.error ? <ConsoleApiErrorPanel title="Verified reconciliation API unavailable" message={verifiedResult.error} /> : null}

            <MetricGrid>
                <LeadershipMetric label="Breaks" value={String(mismatchResult.data?.meta.total || mismatches.length)} tone={mismatches.length ? 'critical' : 'success'} />
                <LeadershipMetric label="Break variance" value={formatMoneyFromPaise(totalVariance)} tone={totalVariance ? 'critical' : 'success'} />
                <LeadershipMetric label="Verified stores" value={String(verifiedResult.data?.meta.total || verified.length)} tone="success" />
                <LeadershipMetric label="Latest refresh" value={formatDateTime(mismatches[0]?.updated_at || verified[0]?.updated_at)} />
            </MetricGrid>

            <Panel title="Break Resolution Queue" description="Mismatches stay visible until the scheduled queue-worker refresh returns variance 0.">
                {mismatches.length ? (
                    <Table className="shadow-none" containerClassName="overflow-x-auto" tableClassName="min-w-[1080px] text-left text-sm">
                        <thead className="text-[var(--lb-color-text-subdued)]">
                            <tr className="border-b border-[var(--lb-color-border)]">
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)] font-[var(--lb-font-weight-medium)]">Store</th>
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)] font-[var(--lb-font-weight-medium)]">Status</th>
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)] font-[var(--lb-font-weight-medium)]">Wallet</th>
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)] font-[var(--lb-font-weight-medium)]">Canonical</th>
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)] font-[var(--lb-font-weight-medium)]">Variance</th>
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)] font-[var(--lb-font-weight-medium)]">Updated</th>
                                <th className="px-[var(--lb-space-3)] py-[var(--lb-space-3)] font-[var(--lb-font-weight-medium)]">Resolution</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--lb-color-border)]">
                            {mismatches.map((row) => (
                                <tr key={row.site_id}>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)] text-[var(--lb-color-text)]">
                                        <div className="font-[var(--lb-font-weight-medium)]">{siteLabel(row)}</div>
                                        <div className="text-xs text-[var(--lb-color-text-subdued)]">{row.site_id}</div>
                                    </td>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]"><StatusPill value={row.status} tone="critical" /></td>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">{formatMoneyFromPaise(row.wallet_available_minor)}</td>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">{formatMoneyFromPaise(row.ledger_merchant_payable_minor)}</td>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)] text-[var(--lb-color-critical)]">{formatMoneyFromPaise(row.variance_minor)}</td>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)] text-[var(--lb-color-text-subdued)]">{formatDateTime(row.updated_at)}</td>
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">
                                        <form action={resolveMoneyBreak} className="grid min-w-[360px] gap-[var(--lb-space-2)]">
                                            <Input unstyled type="hidden" name="site_id" value={row.site_id} />
                                            <Select name="resolution" hideLabel label="Resolution" defaultValue="request_recheck" options={resolutionOptions} controlSize="sm" />
                                            <div className="grid gap-[var(--lb-space-2)] md:grid-cols-2">
                                                <Input name="secondary_approver_id" placeholder="Second approver ID" />
                                                <Input name="provider_reference" placeholder="Provider/ref optional" />
                                            </div>
                                            <Textarea name="reason" required minLength={8} placeholder="Evidence, suspense account, or recheck reason." rows={2} />
                                            <Button type="submit" size="sm" variant="outline">Record</Button>
                                        </form>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                ) : (
                    <EmptyDataState message="No money ledger breaks are open." />
                )}
            </Panel>

            <Panel title="Verified Sample" description="The merchant balance endpoint remains fail-closed until a store has a verified variance-0 row.">
                {verified.length ? (
                    <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2 xl:grid-cols-3">
                        {verified.slice(0, 6).map((row) => (
                            <div key={row.site_id} className="rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] p-[var(--lb-space-4)]">
                                <p className="m-0 text-sm font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text)]">{siteLabel(row)}</p>
                                <p className="m-0 mt-[var(--lb-space-1)] text-xs text-[var(--lb-color-text-subdued)]">{formatDateTime(row.verified_at || row.updated_at)}</p>
                                <p className="m-0 mt-[var(--lb-space-2)] text-[var(--lb-color-success)]">{formatMoneyFromPaise(row.ledger_merchant_payable_minor)}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <EmptyDataState message="No verified reconciliation rows are available yet." />
                )}
            </Panel>
        </ConsoleWorkspace>
    );
}
