import type { InternalTrustSafetyCase } from '@letbuyy/api-client';
import { Button, Input } from '@letbuyy/ui';
import { revalidatePath } from 'next/cache';
import {
    EmptyDataState,
    MetricGrid,
    OpsMetric,
    OpsWorkspace,
    Panel,
    StatusPill,
} from '@/components/_local-ui/ops-workspace';
import { createPlatformOperationsApiClient } from '@/lib/api/client';

async function openTrustSafetyCase(formData: FormData) {
    'use server';

    const subjectId = String(formData.get('subject_id') || '').trim();
    const title = String(formData.get('title') || '').trim();
    const reason = String(formData.get('reason') || '').trim();
    if (!subjectId || title.length < 3 || reason.length < 8) return;

    const api = await createPlatformOperationsApiClient({ requireSession: true });
    await api.operations.openTrustSafetyCase({
        site_id: String(formData.get('site_id') || '').trim() || null,
        subject_type: String(formData.get('subject_type') || 'site') as 'site',
        subject_id: subjectId,
        category: String(formData.get('category') || 'fraud') as 'fraud',
        severity: String(formData.get('severity') || 'medium') as 'medium',
        title,
        summary: String(formData.get('summary') || '').trim(),
        reason,
        evidence: {
            title: 'Initial operator evidence',
            evidence_type: 'manual',
            source: 'operations',
            description: String(formData.get('summary') || '').trim(),
            content: {},
        },
    });

    revalidatePath('/trust-safety');
}

async function decideTrustSafetyCase(formData: FormData) {
    'use server';

    const caseId = String(formData.get('case_id') || '').trim();
    const decision = String(formData.get('decision') || '').trim();
    const reason = String(formData.get('reason') || '').trim();
    if (!caseId || !['no_violation', 'violation', 'needs_more_info'].includes(decision) || reason.length < 8) return;

    const api = await createPlatformOperationsApiClient({ requireSession: true });
    await api.operations.decideTrustSafetyCase(caseId, {
        decision: decision as 'no_violation' | 'violation' | 'needs_more_info',
        reason,
    });

    revalidatePath('/trust-safety');
}

async function enforceTrustSafetyCase(formData: FormData) {
    'use server';

    const caseId = String(formData.get('case_id') || '').trim();
    const reason = String(formData.get('reason') || '').trim();
    if (!caseId || reason.length < 8) return;

    const api = await createPlatformOperationsApiClient({ requireSession: true });
    await api.operations.enforceTrustSafetyCase(caseId, {
        action: 'suspend_site',
        reason,
        notify_subject: true,
    });

    revalidatePath('/trust-safety');
}

async function fileTrustSafetyAppeal(formData: FormData) {
    'use server';

    const caseId = String(formData.get('case_id') || '').trim();
    const reason = String(formData.get('reason') || '').trim();
    if (!caseId || reason.length < 8) return;

    const api = await createPlatformOperationsApiClient({ requireSession: true });
    await api.operations.fileTrustSafetyAppeal(caseId, {
        reason,
        filed_by_type: 'subject',
    });

    revalidatePath('/trust-safety');
}

async function decideTrustSafetyAppeal(formData: FormData) {
    'use server';

    const appealId = String(formData.get('appeal_id') || '').trim();
    const status = String(formData.get('status') || '').trim();
    const reason = String(formData.get('reason') || '').trim();
    if (!appealId || !['upheld', 'overturned', 'rejected'].includes(status) || reason.length < 8) return;

    const api = await createPlatformOperationsApiClient({ requireSession: true });
    await api.operations.decideTrustSafetyAppeal(appealId, {
        status: status as 'upheld' | 'overturned' | 'rejected',
        reason,
    });

    revalidatePath('/trust-safety');
}

async function reinstateTrustSafetyCase(formData: FormData) {
    'use server';

    const caseId = String(formData.get('case_id') || '').trim();
    const secondaryApproverId = String(formData.get('secondary_approver_id') || '').trim();
    const reason = String(formData.get('reason') || '').trim();
    if (!caseId || !secondaryApproverId || reason.length < 8) return;

    const api = await createPlatformOperationsApiClient({ requireSession: true });
    await api.operations.reinstateTrustSafetyCase(caseId, {
        secondary_approver_id: secondaryApproverId,
        reason,
    });

    revalidatePath('/trust-safety');
}

export default async function TrustSafetyOperationsPage() {
    let cases: InternalTrustSafetyCase[] = [];
    let loadError: string | null = null;

    try {
        const api = await createPlatformOperationsApiClient({ requireSession: true });
        const response = await api.operations.trustSafetyCases({ limit: 25 });
        cases = response.data;
    } catch (error) {
        loadError = error instanceof Error ? error.message : 'Unable to load Trust & Safety cases';
    }

    const open = cases.filter((caseRow) => caseRow.status === 'open' || caseRow.status === 'under_review').length;
    const actioned = cases.filter((caseRow) => caseRow.status === 'actioned').length;
    const appealed = cases.filter((caseRow) => caseRow.status === 'appealed').length;

    return (
        <OpsWorkspace
            eyebrow="Trust & Safety"
            title="Trust & Safety Casework"
            description="Employee execution queue for case review, enforcement, appeals, and dual-control reinstatement."
        >
            <MetricGrid>
                <OpsMetric label="Cases loaded" value={String(cases.length)} detail="/v1/operations/trust-safety/cases" />
                <OpsMetric label="Open review" value={String(open)} tone={open > 0 ? 'warning' : 'success'} />
                <OpsMetric label="Actioned" value={String(actioned)} tone={actioned > 0 ? 'critical' : 'success'} />
                <OpsMetric label="Appealed" value={String(appealed)} tone={appealed > 0 ? 'warning' : 'success'} />
            </MetricGrid>

            <section className="grid gap-[var(--lb-space-5)] xl:grid-cols-[0.8fr_1.2fr]">
                <Panel title="Open Case" description="Create a durable T&S case with initial evidence and a reason.">
                    <form action={openTrustSafetyCase} className="grid gap-[var(--lb-space-3)]">
                        <label className="grid gap-[var(--lb-space-2)]">
                            <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">Site ID</span>
                            <Input name="site_id" placeholder="Optional site UUID" />
                        </label>
                        <label className="grid gap-[var(--lb-space-2)]">
                            <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">Subject ID</span>
                            <Input name="subject_id" required placeholder="Site, app, theme, or developer id" />
                        </label>
                        <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                            <SelectField name="subject_type" label="Subject" values={['site', 'app', 'theme', 'developer', 'custom']} />
                            <SelectField name="category" label="Category" values={['fraud', 'illegal_goods', 'counterfeit', 'phishing', 'abuse_report', 'other']} />
                            <SelectField name="severity" label="Severity" values={['medium', 'high', 'critical', 'low']} />
                        </div>
                        <label className="grid gap-[var(--lb-space-2)]">
                            <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">Title</span>
                            <Input name="title" required placeholder="Case title" />
                        </label>
                        <TextAreaField name="summary" label="Evidence summary" minLength={0} />
                        <TextAreaField name="reason" label="Open reason" />
                        <Button type="submit">Open case</Button>
                    </form>
                </Panel>

                <Panel title="Case Queue" description="Decision, enforcement, appeal, and reinstatement actions are reason-captured and audited.">
                    {loadError ? (
                        <EmptyDataState message={loadError} />
                    ) : cases.length === 0 ? (
                        <EmptyDataState message="No Trust & Safety cases are in the queue." />
                    ) : (
                        <div className="grid gap-[var(--lb-space-4)]">
                            {cases.map((caseRow) => <TrustSafetyCaseCard key={caseRow.id} caseRow={caseRow} />)}
                        </div>
                    )}
                </Panel>
            </section>

            <Panel title="Appeal Decision" description="Appeals must be decided by a different reviewer than the original enforcement reviewer.">
                <form action={decideTrustSafetyAppeal} className="grid gap-[var(--lb-space-3)] md:grid-cols-[1fr_0.8fr_1.4fr_auto] md:items-end">
                    <label className="grid gap-[var(--lb-space-2)]">
                        <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">Appeal ID</span>
                        <Input name="appeal_id" required placeholder="Appeal UUID" />
                    </label>
                    <SelectField name="status" label="Decision" values={['upheld', 'overturned', 'rejected']} />
                    <TextAreaField name="reason" label="Decision reason" />
                    <Button type="submit">Decide appeal</Button>
                </form>
            </Panel>
        </OpsWorkspace>
    );
}

function TrustSafetyCaseCard({ caseRow }: { caseRow: InternalTrustSafetyCase }) {
    return (
        <article className="grid gap-[var(--lb-space-4)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
            <div className="grid gap-[var(--lb-space-2)] md:grid-cols-[1fr_auto_auto] md:items-center">
                <div className="min-w-0">
                    <h2 className="m-0 truncate text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">{caseRow.title}</h2>
                    <p className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">
                        {caseRow.subject_type}:{caseRow.subject_id}
                    </p>
                </div>
                <StatusPill value={caseRow.severity} />
                <StatusPill value={caseRow.status} />
            </div>

            <div className="grid gap-[var(--lb-space-3)] xl:grid-cols-2">
                <form action={decideTrustSafetyCase} className="grid gap-[var(--lb-space-3)]">
                    <Input unstyled type="hidden" name="case_id" value={caseRow.id} />
                    <SelectField name="decision" label="Case decision" values={['violation', 'no_violation', 'needs_more_info']} />
                    <TextAreaField name="reason" label="Decision reason" />
                    <Button type="submit">Record decision</Button>
                </form>

                <form action={enforceTrustSafetyCase} className="grid gap-[var(--lb-space-3)]">
                    <Input unstyled type="hidden" name="case_id" value={caseRow.id} />
                    <TextAreaField name="reason" label="Suspend/takedown reason" />
                    <Button type="submit">Suspend site</Button>
                </form>

                <form action={fileTrustSafetyAppeal} className="grid gap-[var(--lb-space-3)]">
                    <Input unstyled type="hidden" name="case_id" value={caseRow.id} />
                    <TextAreaField name="reason" label="Appeal filing reason" />
                    <Button type="submit">File appeal</Button>
                </form>

                <form action={reinstateTrustSafetyCase} className="grid gap-[var(--lb-space-3)]">
                    <Input unstyled type="hidden" name="case_id" value={caseRow.id} />
                    <label className="grid gap-[var(--lb-space-2)]">
                        <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">Second approver ID</span>
                        <Input name="secondary_approver_id" required placeholder="Employee UUID" />
                    </label>
                    <TextAreaField name="reason" label="Reinstatement reason" />
                    <Button type="submit">Reinstate</Button>
                </form>
            </div>
        </article>
    );
}

function SelectField({ name, label, values }: { name: string; label: string; values: string[] }) {
    return (
        <label className="grid gap-[var(--lb-space-2)]">
            <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">{label}</span>
            <select
                name={name}
                className="min-h-11 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm text-[var(--lb-color-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
            >
                {values.map((value) => (
                    <option key={value} value={value}>{formatLabel(value)}</option>
                ))}
            </select>
        </label>
    );
}

function TextAreaField({ name, label, minLength = 8 }: { name: string; label: string; minLength?: number }) {
    return (
        <label className="grid gap-[var(--lb-space-2)]">
            <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">{label}</span>
            <textarea
                name={name}
                rows={3}
                required={minLength > 0}
                minLength={minLength}
                className="w-full rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm text-[var(--lb-color-text)] outline-none placeholder:text-[var(--lb-color-text-subdued)] focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                placeholder={label}
            />
        </label>
    );
}

function formatLabel(value: string): string {
    return value
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
