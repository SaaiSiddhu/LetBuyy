import { revalidatePath } from 'next/cache';
import { INTERNAL_PERMISSION_SCOPES } from '@letbuyy/shared-types';
import { Button, Input, Table, Textarea } from '@letbuyy/ui';
import {
    ConsoleApiErrorPanel,
    ConsoleDataTable,
    ConsoleSearchForm,
    StatusBadge,
    type ConsoleDataColumn,
} from '@/components/ConsoleDataTable';
import {
    fetchConsoleApi,
    formatDateTime,
    readPageParam,
    readSearchParam,
    type ConsoleDataResponse,
    type ConsolePaginatedResponse,
} from '@/lib/console-api';
import { requireConsoleSession } from '@/lib/console-auth-server';

type PageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ConsoleEmployee = {
    id: string;
    user_id: string | null;
    email: string | null;
    full_name: string | null;
    phone: string | null;
    role: string | null;
    role_id: string | null;
    permissions: { scopes?: string[] } | string[] | null;
    status: string | null;
    is_active: boolean | null;
    last_login_at: string | null;
    created_by: string | null;
    created_at: string | null;
    updated_at: string | null;
};

type BreakGlassGrant = {
    id: string;
    employee_id: string;
    scope: string;
    reason: string;
    granted_by: string | null;
    expires_at: string | null;
    used_at: string | null;
    revoked_at: string | null;
    created_at: string | null;
    updated_at: string | null;
};

type AccessReviewRecord = {
    id: string;
    reviewer_id: string;
    period: string;
    decisions: Record<string, unknown> | null;
    completed_at: string | null;
    created_at: string | null;
};

function permissionScopes(row: ConsoleEmployee): string[] {
    if (Array.isArray(row.permissions)) {
        return row.permissions.filter((scope): scope is string => typeof scope === 'string');
    }

    return Array.isArray(row.permissions?.scopes)
        ? row.permissions.scopes.filter((scope): scope is string => typeof scope === 'string')
        : [];
}

function employeeLabel(row: ConsoleEmployee | undefined): string {
    if (!row) return 'Unknown employee';
    return row.full_name || row.email || row.id;
}

function currentAccessReviewPeriod(): string {
    const now = new Date();
    const quarter = Math.floor(now.getMonth() / 3) + 1;
    return `${now.getFullYear()}-Q${quarter}`;
}

function breakGlassStatus(grant: BreakGlassGrant): { label: string; tone: 'green' | 'red' | 'amber' } {
    if (grant.revoked_at) return { label: 'revoked', tone: 'red' };
    if (grant.expires_at && Date.parse(grant.expires_at) <= Date.now()) return { label: 'expired', tone: 'amber' };
    return { label: 'active', tone: 'green' };
}

function accessReviewSummary(record: AccessReviewRecord): string {
    const summary = record.decisions?.summary;
    return typeof summary === 'string' && summary.trim() ? summary : 'Review recorded';
}

async function updateEmployeeScopes(formData: FormData) {
    'use server';

    const session = await requireConsoleSession({ mfa: true });
    const employeeId = String(formData.get('employee_id') || '');
    const reason = String(formData.get('reason') || '').trim();
    const scopes = formData
        .getAll('scopes')
        .map((scope) => String(scope))
        .filter((scope) => (INTERNAL_PERMISSION_SCOPES as readonly string[]).includes(scope));

    if (!employeeId || reason.length < 8) {
        throw new Error('Employee scope updates require an employee id and an 8 character reason.');
    }

    const result = await fetchConsoleApi<ConsoleDataResponse<{ employee: ConsoleEmployee }>>(
        `/internal/console/employees/${employeeId}/permissions`,
        {
            method: 'PATCH',
            body: {
                scopes,
                reason,
                actor_email: session.email,
                actor_id: session.userId,
            },
        }
    );

    if (result.error) {
        throw new Error(result.error);
    }

    revalidatePath('/employees');
}

async function grantBreakGlassAccess(formData: FormData) {
    'use server';

    const session = await requireConsoleSession({ mfa: true });
    const employeeId = String(formData.get('employee_id') || '');
    const scope = String(formData.get('scope') || '');
    const reason = String(formData.get('reason') || '').trim();
    const durationHours = Number(formData.get('duration_hours') || 4);

    if (
        !employeeId
        || !(INTERNAL_PERMISSION_SCOPES as readonly string[]).includes(scope)
        || !Number.isFinite(durationHours)
        || durationHours <= 0
        || durationHours > 24
        || reason.length < 8
    ) {
        throw new Error('Break-glass grants require an employee, scope, duration up to 24 hours, and an 8 character reason.');
    }

    const result = await fetchConsoleApi<ConsoleDataResponse<{ grant: BreakGlassGrant }>>(
        '/operations/rbac/break-glass',
        {
            method: 'POST',
            body: {
                employee_id: employeeId,
                scope,
                reason,
                expires_at: new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString(),
                metadata: {
                    source: 'platform_console_employees',
                    requested_by: session.email,
                },
            },
        }
    );

    if (result.error) {
        throw new Error(result.error);
    }

    revalidatePath('/employees');
}

async function expireBreakGlassAccess(formData: FormData) {
    'use server';

    await requireConsoleSession({ mfa: true });
    const grantId = String(formData.get('grant_id') || '');
    const reason = String(formData.get('reason') || '').trim();

    if (!grantId || reason.length < 8) {
        throw new Error('Expiring break-glass access requires a grant id and an 8 character reason.');
    }

    const result = await fetchConsoleApi<ConsoleDataResponse<{ grant: BreakGlassGrant }>>(
        `/operations/rbac/break-glass/${grantId}/expire`,
        {
            method: 'POST',
            body: { reason },
        }
    );

    if (result.error) {
        throw new Error(result.error);
    }

    revalidatePath('/employees');
}

async function recordAccessReview(formData: FormData) {
    'use server';

    const session = await requireConsoleSession({ mfa: true });
    const reviewerId = String(formData.get('reviewer_id') || '');
    const period = String(formData.get('period') || '').trim();
    const reason = String(formData.get('reason') || '').trim();
    const summary = String(formData.get('summary') || '').trim();

    if (!reviewerId || !/^[0-9]{4}-(Q[1-4]|0[1-9]|1[0-2])$/.test(period) || reason.length < 8 || summary.length < 8) {
        throw new Error('Access reviews require a reviewer, period, summary, and an 8 character reason.');
    }

    const result = await fetchConsoleApi<ConsoleDataResponse<{ access_review: AccessReviewRecord }>>(
        '/operations/rbac/access-reviews',
        {
            method: 'POST',
            body: {
                reviewer_id: reviewerId,
                period,
                reason,
                completed_at: new Date().toISOString(),
                decisions: {
                    summary,
                    source: 'platform_console_employees',
                    recorded_by: session.email,
                },
                metadata: {
                    source: 'platform_console_employees',
                },
            },
        }
    );

    if (result.error) {
        throw new Error(result.error);
    }

    revalidatePath('/employees');
}

const columns: Array<ConsoleDataColumn<ConsoleEmployee>> = [
    {
        key: 'employee',
        header: 'Employee',
        cell: (row) => (
            <div>
                <p className="font-medium text-zinc-100">{row.full_name || row.email || '-'}</p>
                <p className="mt-1 text-xs text-zinc-500">{row.email || row.id}</p>
            </div>
        ),
    },
    {
        key: 'role',
        header: 'Role',
        cell: (row) => row.role || '-',
    },
    {
        key: 'scope-overrides',
        header: 'Scope Overrides',
        cell: (row) => {
            const scopes = permissionScopes(row);

            return (
                <div className="max-w-sm">
                    <p className="text-xs text-zinc-400">
                        {scopes.length > 0 ? `${scopes.length} explicit scope${scopes.length === 1 ? '' : 's'}` : 'Role defaults only'}
                    </p>
                    {scopes.length > 0 ? (
                        <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{scopes.join(', ')}</p>
                    ) : null}
                </div>
            );
        },
    },
    {
        key: 'status',
        header: 'Status',
        cell: (row) => (
            <StatusBadge
                value={row.is_active ? 'active' : 'inactive'}
                tone={row.is_active ? 'green' : 'red'}
            />
        ),
    },
    {
        key: 'last-login',
        header: 'Last Login',
        cell: (row) => formatDateTime(row.last_login_at),
    },
    {
        key: 'rbac',
        header: 'RBAC',
        cell: (row) => {
            const scopes = permissionScopes(row);

            return (
                <details className="min-w-72 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                    <summary className="cursor-pointer text-xs font-medium text-zinc-300">Assign scopes</summary>
                    <form action={updateEmployeeScopes} className="mt-3 space-y-3">
                        <Input unstyled type="hidden" name="employee_id" value={row.id} />
                        <select
                            name="scopes"
                            multiple
                            defaultValue={scopes}
                            className="h-32 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs text-zinc-100 outline-none focus:border-[var(--lb-color-primary)]"
                        >
                            {INTERNAL_PERMISSION_SCOPES.map((scope) => (
                                <option key={scope} value={scope}>{scope}</option>
                            ))}
                        </select>
                        <Input
                            name="reason"
                            label="Reason"
                            minLength={8}
                            required
                            placeholder="Reason"
                            className="text-xs"
                        />
                        <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            fullWidth
                        >
                            Save scopes
                        </Button>
                    </form>
                </details>
            );
        },
    },
    {
        key: 'created',
        header: 'Created',
        cell: (row) => formatDateTime(row.created_at),
    },
];

export default async function EmployeesPage({ searchParams }: PageProps) {
    const params = searchParams ? await searchParams : undefined;
    const q = readSearchParam(params, 'q');
    const status = readSearchParam(params, 'status');
    const page = readPageParam(params);
    const result = await fetchConsoleApi<ConsolePaginatedResponse<ConsoleEmployee>>('/internal/console/employees', {
        q,
        status,
        page,
        limit: 25,
    });
    const activeEmployeesResult = await fetchConsoleApi<ConsolePaginatedResponse<ConsoleEmployee>>('/internal/console/employees', {
        status: 'active',
        page: 1,
        limit: 100,
    });
    const breakGlassResult = await fetchConsoleApi<ConsolePaginatedResponse<BreakGlassGrant>>('/operations/rbac/break-glass', {
        status: 'all',
        page: 1,
        limit: 10,
    });
    const accessReviewsResult = await fetchConsoleApi<ConsolePaginatedResponse<AccessReviewRecord>>('/operations/rbac/access-reviews', {
        page: 1,
        limit: 10,
    });
    const activeEmployees = activeEmployeesResult.data?.data || [];
    const employeeById = new Map(activeEmployees.map((employee) => [employee.id, employee]));
    const breakGlassGrants = breakGlassResult.data?.data || [];
    const accessReviews = accessReviewsResult.data?.data || [];

    return (
        <div className="space-y-6 p-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-50">Employees</h1>
                    <p className="mt-1 text-sm text-zinc-400">Support, operations, and platform team members.</p>
                </div>
                <ConsoleSearchForm placeholder="Search employees..." defaultValue={q}>
                    <select
                        name="status"
                        defaultValue={status}
                        className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus:border-[var(--lb-color-primary)]"
                    >
                        <option value="">All status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </ConsoleSearchForm>
            </div>

            {result.error ? (
                <ConsoleApiErrorPanel title="Employees API unavailable" message={result.error} />
            ) : (
                <ConsoleDataTable
                    columns={columns}
                    rows={result.data?.data || []}
                    meta={result.data?.meta}
                    basePath="/employees"
                    query={{ q, status }}
                    emptyLabel="No employees matched the current filters."
                    getRowKey={(row) => row.id}
                />
            )}

            <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-50">Break-Glass Grants</h2>
                            <p className="mt-1 text-sm text-zinc-400">Time-boxed scope elevation with reason capture and audit.</p>
                        </div>
                        <StatusBadge value={`${breakGlassGrants.length} shown`} tone="zinc" />
                    </div>

                    {breakGlassResult.error ? (
                        <div className="mt-4">
                            <ConsoleApiErrorPanel title="Break-glass API unavailable" message={breakGlassResult.error} />
                        </div>
                    ) : null}

                    <form action={grantBreakGlassAccess} className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_0.5fr]">
                        <label className="space-y-1 text-xs font-medium text-zinc-400">
                            Employee
                            <select
                                name="employee_id"
                                required
                                className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus:border-[var(--lb-color-primary)]"
                            >
                                <option value="">Select employee</option>
                                {activeEmployees.map((employee) => (
                                    <option key={employee.id} value={employee.id}>{employeeLabel(employee)}</option>
                                ))}
                            </select>
                        </label>
                        <label className="space-y-1 text-xs font-medium text-zinc-400">
                            Scope
                            <select
                                name="scope"
                                required
                                className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus:border-[var(--lb-color-primary)]"
                            >
                                <option value="">Select scope</option>
                                {INTERNAL_PERMISSION_SCOPES.map((scope) => (
                                    <option key={scope} value={scope}>{scope}</option>
                                ))}
                            </select>
                        </label>
                        <label className="space-y-1 text-xs font-medium text-zinc-400">
                            Hours
                            <select
                                name="duration_hours"
                                defaultValue="4"
                                className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus:border-[var(--lb-color-primary)]"
                            >
                                <option value="1">1</option>
                                <option value="4">4</option>
                                <option value="8">8</option>
                                <option value="24">24</option>
                            </select>
                        </label>
                        <div className="md:col-span-2">
                            <Input
                                name="reason"
                                label="Reason"
                                minLength={8}
                                required
                                placeholder="Incident, audit, or urgent mitigation reason"
                            />
                        </div>
                        <div className="flex items-end">
                            <Button type="submit" fullWidth>Grant</Button>
                        </div>
                    </form>

                    <div className="mt-5">
                        <Table
                            className="rounded-lg border-zinc-800 bg-zinc-900 shadow-none"
                            containerClassName="overflow-x-auto"
                            tableClassName="min-w-full divide-y divide-zinc-800 text-sm"
                        >
                            <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
                                <tr>
                                    <th className="px-3 py-2 font-medium">Employee</th>
                                    <th className="px-3 py-2 font-medium">Scope</th>
                                    <th className="px-3 py-2 font-medium">Status</th>
                                    <th className="px-3 py-2 font-medium">Expires</th>
                                    <th className="px-3 py-2 font-medium">Expire</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-900 text-zinc-300">
                                {breakGlassGrants.length === 0 ? (
                                    <tr>
                                        <td className="px-3 py-4 text-zinc-500" colSpan={5}>No break-glass grants recorded.</td>
                                    </tr>
                                ) : breakGlassGrants.map((grant) => {
                                    const grantStatus = breakGlassStatus(grant);
                                    const active = grantStatus.label === 'active';

                                    return (
                                        <tr key={grant.id}>
                                            <td className="px-3 py-3">{employeeLabel(employeeById.get(grant.employee_id))}</td>
                                            <td className="px-3 py-3 font-mono text-xs">{grant.scope}</td>
                                            <td className="px-3 py-3"><StatusBadge value={grantStatus.label} tone={grantStatus.tone} /></td>
                                            <td className="px-3 py-3">{formatDateTime(grant.expires_at)}</td>
                                            <td className="px-3 py-3">
                                                {active ? (
                                                    <form action={expireBreakGlassAccess} className="flex min-w-64 gap-2">
                                                        <Input unstyled type="hidden" name="grant_id" value={grant.id} />
                                                        <Input
                                                            name="reason"
                                                            minLength={8}
                                                            required
                                                            placeholder="Expiry reason"
                                                            className="text-xs"
                                                        />
                                                        <Button type="submit" variant="outline" size="sm">Expire</Button>
                                                    </form>
                                                ) : (
                                                    <span className="text-xs text-zinc-500">Closed</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </Table>
                    </div>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-50">Access Reviews</h2>
                        <p className="mt-1 text-sm text-zinc-400">Record periodic RBAC recertification decisions.</p>
                    </div>

                    {accessReviewsResult.error ? (
                        <div className="mt-4">
                            <ConsoleApiErrorPanel title="Access review API unavailable" message={accessReviewsResult.error} />
                        </div>
                    ) : null}

                    <form action={recordAccessReview} className="mt-5 space-y-3">
                        <label className="block space-y-1 text-xs font-medium text-zinc-400">
                            Reviewer
                            <select
                                name="reviewer_id"
                                required
                                className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus:border-[var(--lb-color-primary)]"
                            >
                                <option value="">Select reviewer</option>
                                {activeEmployees.map((employee) => (
                                    <option key={employee.id} value={employee.id}>{employeeLabel(employee)}</option>
                                ))}
                            </select>
                        </label>
                        <Input
                            name="period"
                            label="Period"
                            defaultValue={currentAccessReviewPeriod()}
                            required
                            pattern="[0-9]{4}-(Q[1-4]|0[1-9]|1[0-2])"
                        />
                        <Textarea
                            name="summary"
                            label="Decision summary"
                            minLength={8}
                            required
                            placeholder="Summarize approvals, removals, and follow-ups"
                        />
                        <Input
                            name="reason"
                            label="Reason"
                            minLength={8}
                            required
                            placeholder="Quarterly access review"
                        />
                        <Button type="submit" fullWidth>Record access review</Button>
                    </form>

                    <div className="mt-5 space-y-3">
                        {accessReviews.length === 0 ? (
                            <p className="rounded-lg border border-zinc-800 px-3 py-4 text-sm text-zinc-500">No access reviews recorded.</p>
                        ) : accessReviews.map((review) => (
                            <div key={review.id} className="rounded-lg border border-zinc-800 px-3 py-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium text-zinc-100">{review.period}</p>
                                        <p className="mt-1 text-xs text-zinc-500">
                                            Reviewer {employeeLabel(employeeById.get(review.reviewer_id))} · {formatDateTime(review.completed_at)}
                                        </p>
                                    </div>
                                    <StatusBadge value="recorded" tone="green" />
                                </div>
                                <p className="mt-2 text-sm text-zinc-400">{accessReviewSummary(review)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
