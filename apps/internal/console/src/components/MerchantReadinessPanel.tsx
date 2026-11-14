import Link from 'next/link';
import { CheckCircle2, CircleHelp, Clock3, LockKeyhole, MessageSquare } from 'lucide-react';
import type { StoreHealth } from '@letbuyy/shared-types';
import { Panel, StatusPill } from './_local-ui/console-workspace';
import { ConsoleApiErrorPanel } from './ConsoleDataTable';
import { formatDateTime } from '@/lib/console-api';

const states = {
    ready: { label: 'Complete', tone: 'success', Icon: CheckCircle2 },
    attention: { label: 'Needs attention', tone: 'warning', Icon: Clock3 },
    blocked: { label: 'Restricted', tone: 'critical', Icon: LockKeyhole },
    unknown: { label: 'Needs checking', tone: 'info', Icon: CircleHelp },
} as const;
const destinations: Record<string, string> = {
    'settings/general': 'Settings → General', products: 'Products',
    'settings/shipping': 'Settings → Shipping', 'settings/payments': 'Settings → Payments',
    'online-store/themes': 'Online store → Themes', 'settings/domains': 'Settings → Domains',
};
type Check = StoreHealth['readiness']['checks'][number];

function ReadinessCheck({ check }: { check: Check }) {
    const state = states[check.status];
    return <li className="console-check-card" data-state={check.status}>
        <span className="console-check-icon"><state.Icon size={19} strokeWidth={1.8} aria-hidden="true" /></span>
        <div className="console-check-copy">
            <div className="console-check-heading"><h3>{check.label}</h3><StatusPill value={check.status} label={state.label} tone={state.tone} /></div>
            <p>{check.summary}</p>
            {check.status !== 'ready' && <p className="console-check-next">Guide merchant to <strong>{destinations[check.web_path] || check.label}</strong></p>}
            {check.id === 'domain' && check.checked_at && <small>Last evidence {formatDateTime(check.checked_at)}</small>}
        </div>
    </li>;
}

export function MerchantReadinessPanel({ id, health, error }: { id: string; health: StoreHealth | null; error?: string | null }) {
    const pending = health?.readiness.checks.filter(check => check.status !== 'ready') || [];
    const complete = health?.readiness.checks.filter(check => check.status === 'ready') || [];
    return <Panel title="Setup checklist and store health" description="Review launch setup and help the merchant resolve outstanding steps."
        action={health && <StatusPill value={health.readiness.status} label={states[health.readiness.status].label} tone={states[health.readiness.status].tone} />}>
        {error ? <ConsoleApiErrorPanel title="Setup evidence unavailable" message={error} /> : health && <>
            <div className="console-readiness-summary">
                <div><p role="status"><strong>{health.readiness.complete}</strong> of {health.readiness.total} checks complete</p><p className="console-readiness-observed">Observed {formatDateTime(health.generated_at)}</p></div>
                <progress aria-label="Setup checks complete" max={health.readiness.total} value={health.readiness.complete} />
            </div>
            {pending.length > 0 && <ul aria-label="Setup steps requiring attention" className="console-check-grid">{pending.map(check => <ReadinessCheck key={check.id} check={check} />)}</ul>}
            {complete.length > 0 && <details className="console-completed-checks"><summary>Completed checks ({complete.length})</summary><ul aria-label="Completed setup checks" className="console-check-grid">{complete.map(check => <ReadinessCheck key={check.id} check={check} />)}</ul></details>}
            <div className="console-readiness-footer"><p>Based on saved configuration and recorded verification. External uptime and payment delivery need separate confirmation.</p><Link className="console-overview-link" href={`/support?site_id=${id}`}><MessageSquare size={16} aria-hidden="true" />Help through support</Link></div>
        </>}
    </Panel>;
}
