'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button, Section } from '@letbuyy/ui';
import type { StoreHealth } from '@letbuyy/shared-types';

const labels = { ready: 'Complete', attention: 'Needs attention', blocked: 'Restricted', unknown: 'Needs checking' };

export function StoreReadinessPanel({ store, health }: { store: string; health: StoreHealth | null }) {
    const router = useRouter();
    const [refreshing, refresh] = useTransition();
    return <Section title="Setup checklist and store health" description="Current saved configuration and recorded verification. These checks do not certify live uptime or payment delivery.">
        <div className="flex flex-wrap items-center justify-between gap-[var(--lb-space-3)]">
            <p role="status">{health ? `${health.readiness.complete} of ${health.readiness.total} checks complete · ${labels[health.readiness.status]}` : 'Setup evidence is unavailable. Retry to check the current store.'}</p>
            <Button variant="secondary" loading={refreshing} onClick={() => refresh(() => router.refresh())}>Check again</Button>
        </div>
        {health && <>
            <p className="text-sm text-subdued">Observed {new Date(health.generated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST. {health.readiness.unknown > 0 ? `${health.readiness.unknown} check(s) need fresh evidence.` : ''}</p>
            <ul className="divide-y divide-border">
                {health.readiness.checks.map(check => <li key={check.id} className="py-[var(--lb-space-4)]">
                    <div className="flex flex-wrap items-start justify-between gap-[var(--lb-space-3)]">
                        <div className="min-w-0 flex-1">
                            <h3 className="font-semibold">{check.label} · {labels[check.status]}{!check.required ? ' · Optional custom domain' : ''}</h3>
                            <p className="mt-[var(--lb-space-2)] text-sm">{check.summary}</p>
                            {check.id === 'domain' && check.checked_at && <p className="mt-[var(--lb-space-2)] text-sm text-subdued">Evidence recorded {new Date(check.checked_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p>}
                        </div>
                        <Link aria-label={`${check.action_label}: ${check.label}`} className="shrink-0 font-medium underline underline-offset-4" href={`/${encodeURIComponent(store)}/${check.web_path}`}>{check.action_label}</Link>
                    </div>
                </li>)}
            </ul>
        </>}
    </Section>;
}
