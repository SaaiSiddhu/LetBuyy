import Link from 'next/link';
import { z } from 'zod';
import { ConsoleWorkspace, EmptyDataState, Panel, StatusPill } from '@/components/_local-ui/console-workspace';
import { ConsoleApiErrorPanel } from '@/components/ConsoleDataTable';
import { fetchConsoleApi, formatDateTime, readSearchParam, type ConsoleDataResponse } from '@/lib/console-api';
import { requireConsoleSession } from '@/lib/console-auth-server';
import { KycLegalHoldWorkbench, type HoldReceipt, type LegalHold } from './KycLegalHoldWorkbench';

type PageProps = {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};
type ReviewDocument = {
    id: string;
    document_type: string;
    status: string;
    provider_mode: string;
    document_number_last4: string | null;
    has_private_upload: boolean;
    malware_scan_status: string;
    submitted_at: string | null;
};
type ReviewList = { data: ReviewDocument[]; page: number; limit: number; total: number };
type ReviewPage<T> = { data: T[]; page: number; limit: number; total: number };

function pageNumber(value: string) {
    const number = Number(value || '1');
    return Number.isSafeInteger(number) && number > 0 ? number : 1;
}

export default async function MerchantKycReviewPage({ params, searchParams }: PageProps) {
    const { id } = await params;
    const query = await searchParams;
    await requireConsoleSession({ mfa: true });
    const site = z.string().uuid().safeParse(id);
    const reason = readSearchParam(query, 'reason').trim();
    const validReason = z.string().min(8).max(1000).safeParse(reason).success;
    const receiptPage = pageNumber(readSearchParam(query, 'receiptPage'));
    const holdPage = pageNumber(readSearchParam(query, 'holdPage'));
    const [result, receiptResult, holdResult] = site.success && validReason
        ? await Promise.all([
            fetchConsoleApi<ConsoleDataResponse<ReviewList>>(
                `/internal/console/kyc/sites/${site.data}/documents`, { reason, page: 1, limit: 20 }),
            fetchConsoleApi<ConsoleDataResponse<ReviewPage<HoldReceipt>>>(
                `/internal/console/kyc/sites/${site.data}/receipts`, { reason, page: receiptPage, limit: 20 }),
            fetchConsoleApi<ConsoleDataResponse<ReviewPage<LegalHold>>>(
                `/internal/console/kyc/sites/${site.data}/holds`, { reason, page: holdPage, limit: 20 }),
        ]) : [null, null, null];
    const rows = result?.data?.data?.data || [];
    const receipts = receiptResult?.data?.data;
    const holds = holdResult?.data?.data;
    const pageHref = (nextReceiptPage: number, nextHoldPage: number) =>
        `/merchants/${encodeURIComponent(id)}/kyc?reason=${encodeURIComponent(reason)}`
        + `&receiptPage=${nextReceiptPage}&holdPage=${nextHoldPage}`;

    return <ConsoleWorkspace eyebrow="Merchant operations" title="KYC evidence review"
        description="Private evidence requires a current operator session, a review reason, and a clean safety scan before download.">
        <Link href={`/merchants/${encodeURIComponent(id)}`}
            className="text-sm font-medium text-[var(--lb-color-primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]">
            Back to merchant
        </Link>
        <Panel title="Review reason" description="The reason is recorded in the audit log for every evidence read.">
            <form method="GET" className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex flex-1 flex-col gap-2 text-sm font-medium" htmlFor="kyc-review-reason">
                    Reason
                    <input id="kyc-review-reason" name="reason" defaultValue={reason} required minLength={8} maxLength={1000}
                        autoComplete="off" className="w-full rounded-md border border-[var(--lb-color-border)] bg-transparent p-2" />
                </label>
                <button type="submit" className="rounded-md bg-[var(--lb-color-primary)] px-4 py-2 font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]">
                    Review documents
                </button>
            </form>
        </Panel>
        {result?.error ? <><ConsoleApiErrorPanel title="KYC evidence unavailable" message={result.error} />
            <Link href={pageHref(receiptPage, holdPage)} className="text-sm underline">Retry KYC review</Link></> : null}
        {result && !result.error ? <Panel title="Submitted documents" description="Only redacted status and final reference characters are listed here.">
            {rows.length === 0 ? <EmptyDataState message="No submitted KYC evidence was found for this merchant." />
                : <ul className="m-0 list-none divide-y divide-[var(--lb-color-border)] p-0">
                    {rows.map((row) => <li key={row.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="m-0 font-medium">{row.document_type.replaceAll('_', ' ')}</p>
                            <p className="m-0 mt-1 text-xs text-[var(--lb-color-text-subdued)]">
                                {row.document_number_last4 ? `Ends ${row.document_number_last4} · ` : ''}
                                {formatDateTime(row.submitted_at)} · {row.provider_mode}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <StatusPill value={row.status} />
                            <StatusPill value={row.malware_scan_status === 'pending' ? 'no scan result' : `scan ${row.malware_scan_status}`} />
                            {row.has_private_upload && row.malware_scan_status === 'clean' ?
                                <a href={`/api/kyc-evidence/${id}/${row.id}?reason=${encodeURIComponent(reason)}`}
                                    rel="noreferrer"
                                    className="text-sm font-medium text-[var(--lb-color-primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]">
                                    Download evidence
                                </a> : null}
                        </div>
                    </li>)}
                </ul>}
        </Panel> : null}
        {validReason && receiptResult?.status === 403 ? <Panel title="Legal hold access"
            description="A current stepped-up platform compliance administrator is required.">
            <p className="m-0 text-sm">Your session cannot manage private evidence holds.</p>
        </Panel> : null}
        {validReason && receiptResult?.error && receiptResult.status !== 403 ?
            <><ConsoleApiErrorPanel title="Mumbai receipts unavailable" message={receiptResult.error} />
                <Link href={pageHref(receiptPage, holdPage)} className="text-sm underline">Retry receipt review</Link></> : null}
        {validReason && holdResult?.error && holdResult.status !== 403 ?
            <><ConsoleApiErrorPanel title="Legal holds unavailable" message={holdResult.error} />
                <Link href={pageHref(receiptPage, holdPage)} className="text-sm underline">Retry legal-hold review</Link></> : null}
        {site.success && receipts && holds && !receiptResult?.error && !holdResult?.error ? <>
            <KycLegalHoldWorkbench siteId={site.data} receipts={receipts.data} holds={holds.data} />
            <nav aria-label="KYC receipt pages" className="flex flex-wrap items-center gap-3 text-sm">
                <span>Receipts page {receipts.page} · {receipts.total} total</span>
                {receipts.page > 1 ? <Link href={pageHref(receipts.page - 1, holds.page)} className="underline">Previous receipts</Link> : null}
                {receipts.page * receipts.limit < receipts.total ? <Link href={pageHref(receipts.page + 1, holds.page)} className="underline">Next receipts</Link> : null}
            </nav>
            <nav aria-label="Legal hold pages" className="flex flex-wrap items-center gap-3 text-sm">
                <span>Holds page {holds.page} · {holds.total} total</span>
                {holds.page > 1 ? <Link href={pageHref(receipts.page, holds.page - 1)} className="underline">Previous holds</Link> : null}
                {holds.page * holds.limit < holds.total ? <Link href={pageHref(receipts.page, holds.page + 1)} className="underline">Next holds</Link> : null}
            </nav>
        </> : null}
        {!validReason && reason ? <p role="alert" className="text-sm text-[var(--lb-color-danger)]">Enter a reason of 8 to 1000 characters.</p> : null}
    </ConsoleWorkspace>;
}
