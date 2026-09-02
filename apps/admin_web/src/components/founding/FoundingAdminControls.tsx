'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@letbuyy/ui';

type Props = {
    active: boolean;
    paused: boolean;
    reconcileStatus: string;
    reconcileRepairable: boolean;
};

const BTN =
    'min-h-11 rounded-lg border border-[var(--lb-color-border)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text)] transition-colors hover:bg-[var(--lb-color-surface-subdued)] disabled:opacity-50';

export function FoundingAdminControls({ active, paused, reconcileStatus, reconcileRepairable }: Props) {
    const router = useRouter();
    const [busy, setBusy] = useState<string | null>(null);
    const [siteId, setSiteId] = useState('');
    const [message, setMessage] = useState<string | null>(null);

    async function run(action: string, extra: Record<string, unknown> = {}) {
        setBusy(action);
        setMessage(null);
        try {
            const res = await fetch('/api/founding/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...extra }),
            });
            const json = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) throw new Error(json?.error || 'Action failed');
            setMessage(`${action}: done`);
            router.refresh();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Action failed');
        } finally {
            setBusy(null);
        }
    }

    return (
        <div className="flex flex-col gap-[var(--lb-space-4)] rounded-lg border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)]">
            <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                {paused ? (
                    <Button unstyled type="button" className={BTN} onClick={() => run('resume')} disabled={busy !== null}>Resume program</Button>
                ) : (
                    <Button unstyled type="button" className={BTN} onClick={() => run('pause', { reason: 'admin_pause' })} disabled={busy !== null}>Pause program</Button>
                )}
                {active ? (
                    <Button unstyled type="button" className={BTN} onClick={() => run('disable')} disabled={busy !== null}>Disable program</Button>
                ) : (
                    <Button unstyled type="button" className={BTN} onClick={() => run('enable')} disabled={busy !== null}>Enable program</Button>
                )}
                <Button unstyled type="button" className={BTN} onClick={() => run('reconcile')} disabled={busy !== null}>
                    Reconcile{reconcileRepairable ? ' & repair' : ''} ({reconcileStatus})
                </Button>
            </div>

            <div className="flex flex-wrap items-end gap-[var(--lb-space-2)]">
                <label className="flex flex-col gap-[var(--lb-space-1)]">
                    <span className="text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">Site ID (recovery operations)</span>
                    <Input
                        unstyled
                        value={siteId}
                        onChange={(e) => setSiteId(e.target.value)}
                        placeholder="site uuid"
                        className="min-h-11 w-full rounded-lg border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[var(--lb-font-size-body)] text-[var(--lb-color-text)]"
                    />
                </label>
                <Button unstyled type="button" className={BTN} disabled={!siteId || busy !== null} onClick={() => run('allocate', { site_id: siteId })}>Manual allocate</Button>
                <Button unstyled type="button" className={BTN} disabled={!siteId || busy !== null} onClick={() => run('reclaim', { site_id: siteId })}>Manual reclaim</Button>
                <Button unstyled type="button" className={BTN} disabled={!siteId || busy !== null} onClick={() => run('repair-lock', { site_id: siteId })}>Repair price lock</Button>
            </div>

            {message ? (
                <p className="m-0 text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">{message}</p>
            ) : null}
        </div>
    );
}
