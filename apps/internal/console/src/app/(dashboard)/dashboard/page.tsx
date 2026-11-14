import Link from 'next/link';
import { ArrowRight, ArrowUpRight, ChartNoAxesCombined, ClipboardCheck, Clapperboard, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Chart } from '@letbuyy/ui';
import type { InternalConsoleSummary, InternalConsoleAnalytics, ExecutiveCompanyHealth, ExecutiveMrrAnalytics } from '@letbuyy/shared-types';
import { ConsoleWorkspace, LeadershipMetric, MetricGrid, Panel, StatusPill } from '@/components/_local-ui/console-workspace';
import { ConsoleApiErrorPanel } from '@/components/ConsoleDataTable';
import { fetchConsoleApi, formatMoneyFromPaise, type ConsoleDataResponse } from '@/lib/console-api';

export default async function ConsoleDashboardRoutePage() {
    const [summaryResult, analyticsResult, mrrResult, healthResult] = await Promise.all([
        fetchConsoleApi<ConsoleDataResponse<InternalConsoleSummary>>('/internal/console/summary'),
        fetchConsoleApi<ConsoleDataResponse<InternalConsoleAnalytics>>('/internal/console/analytics'),
        fetchConsoleApi<ConsoleDataResponse<ExecutiveMrrAnalytics>>('/internal/console/analytics/mrr', { limit: 13 }),
        fetchConsoleApi<ConsoleDataResponse<ExecutiveCompanyHealth>>('/internal/console/analytics/company-health'),
    ]);
    const summary = summaryResult.data?.data;
    const analytics = analyticsResult.data?.data;
    const mrr = mrrResult.data?.data;
    const latest = mrr?.latest;
    const health = healthResult.data?.data;
    const healthValue = (key: string) => health?.metrics.find(metric => metric.metric_key === key)?.value;
    const count = (value: number | undefined) => value === undefined ? 'Unavailable' : value.toLocaleString('en-IN');
    const date = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
    const trend = [...(mrr?.trend || [])].sort((a, b) => a.period_date.localeCompare(b.period_date));
    const queues = [
        { href: '/approvals', title: 'Protected approvals', detail: 'Review requests before consequential changes.', icon: ClipboardCheck },
        { href: '/reels', title: 'Reel review queue', detail: 'Inspect private submissions and review evidence.', icon: Clapperboard },
        { href: '/trust-safety', title: 'Trust & safety', detail: 'Investigate cases, restrictions and appeals.', icon: ShieldCheck },
        { href: '/incidents', title: 'Incident response', detail: healthValue('incidents.open') === undefined ? 'Review incident ownership and customer impact.' : `${count(healthValue('incidents.open'))} open · Review impact and ownership.`, icon: TriangleAlert },
    ];

    return <ConsoleWorkspace eyebrow="Workspace" title="Platform overview"
        description="Monitor merchant activity, revenue and the work that needs attention.">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-subdued"><span>{date} · India Standard Time</span><Link href="/audit-logs" className="console-overview-link">View activity log<ArrowUpRight size={15} /></Link></div>
        {summaryResult.error && <ConsoleApiErrorPanel title="Platform totals unavailable" message={summaryResult.error} />}
        {mrrResult.error && <ConsoleApiErrorPanel title="Revenue history unavailable" message={mrrResult.error} />}
        {healthResult.error && <ConsoleApiErrorPanel title="Operating signals unavailable" message={healthResult.error} />}
        {analyticsResult.error && <ConsoleApiErrorPanel title="Growth counters unavailable" message={analyticsResult.error} />}
        <MetricGrid>
            <Link href="/stores" className="console-metric-link"><LeadershipMetric label="Merchant stores" value={count(summary?.total_stores)} detail={summary ? `${summary.active_stores.toLocaleString('en-IN')} active stores · all time` : 'Store totals could not be loaded'} /></Link>
            <Link href="/revenue" className="console-metric-link"><LeadershipMetric label="Monthly recurring revenue" value={latest ? formatMoneyFromPaise(latest.mrr_paise) : 'Unavailable'} detail={latest ? `As of ${latest.period_date} · ${mrr?.freshness.stale ? 'stale rollup' : 'current rollup'}` : 'Awaiting a recorded revenue rollup'} tone={latest && !mrr?.freshness.stale ? 'neutral' : 'warning'} /></Link>
            <Link href="/subscriptions" className="console-metric-link"><LeadershipMetric label="Active subscriptions" value={count(summary?.active_subscriptions)} detail={summary ? `${summary.total_subscriptions.toLocaleString('en-IN')} total subscription records` : 'Subscription totals could not be loaded'} /></Link>
            <Link href="/users" className="console-metric-link"><LeadershipMetric label="Platform users" value={count(summary?.total_users)} detail="Registered identity records · all time" /></Link>
        </MetricGrid>
        <div className="console-overview-grid">
            <Panel title="Revenue overview" description="Monthly recurring revenue · INR · recorded periods"
                action={<Link href="/revenue" className="console-overview-link">View revenue<ArrowUpRight size={15} /></Link>}>
                {trend.length >= 2 ? <Chart type="area" height="md" ariaLabel="Recorded monthly recurring revenue in Indian rupees" data={trend.map(row => ({ label: row.period_date, value: row.mrr_paise / 100 }))} />
                    : <div className="console-empty-chart"><ChartNoAxesCombined size={32} strokeWidth={1.5} /><strong>{mrrResult.error ? 'Revenue history is unavailable' : 'Revenue history will appear here'}</strong><p className="max-w-sm text-sm">{mrrResult.error ? 'Retry this section when the data service is available.' : 'Your recurring revenue trend appears after two revenue periods have been recorded.'}</p><Link href="/subscriptions" className="console-overview-link">Review subscriptions<ArrowRight size={15} /></Link></div>}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-subdued"><span>Annual recurring revenue</span><strong className="font-medium text-default">{latest ? formatMoneyFromPaise(latest.arr_paise) : 'Not yet recorded'}</strong></div>
            </Panel>
            <Panel title="Work queues" description="Open a queue to review the next task.">
                {queues.map(queue => <Link className="console-queue-link" key={queue.href} href={queue.href}><span className="console-queue-icon"><queue.icon size={19} strokeWidth={1.7} /></span><span><strong>{queue.title}</strong><small>{queue.detail}</small></span><ArrowRight size={16} /></Link>)}
            </Panel>
        </div>
        <Panel title="Operating signals" description={health?.freshness.computed_at ? `Computed ${new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(health.freshness.computed_at))} IST` : 'No company-health rollup has been recorded yet.'}
            action={<StatusPill value={!health?.freshness.computed_at ? 'Not recorded' : health.freshness.stale ? 'Stale' : 'Current'} tone={!health?.freshness.computed_at || health.freshness.stale ? 'warning' : 'success'} />}>
            <MetricGrid>
                <LeadershipMetric label="Open support tickets" value={count(healthValue('support.open_tickets'))} detail="From the company-health rollup" />
                <LeadershipMetric label="SLA breaches" value={count(healthValue('support.sla_breaches'))} detail="Support deadlines requiring attention" tone={(healthValue('support.sla_breaches') ?? 0) > 0 ? 'warning' : 'neutral'} />
                <LeadershipMetric label="High-risk signals" value={count(healthValue('risk.high_scores'))} detail="Open the risk workspace to investigate" tone={(healthValue('risk.high_scores') ?? 0) > 0 ? 'warning' : 'neutral'} />
                <LeadershipMetric label="Open incidents" value={count(healthValue('incidents.open'))} detail="Review ownership in incident response" tone={(healthValue('incidents.open') ?? 0) > 0 ? 'critical' : 'neutral'} />
            </MetricGrid>
        </Panel>
        <Panel title="Growth snapshot" description={`Last ${analytics?.period_days || 30} days · live platform counters`} action={<Link href="/analytics" className="console-overview-link">Explore analytics<ArrowUpRight size={15} /></Link>}>
            <MetricGrid>
                <LeadershipMetric label="New signups" value={count(analytics?.new_signups)} />
                <LeadershipMetric label="Stores created" value={count(analytics?.stores_created)} />
                <LeadershipMetric label="Subscriptions created" value={count(analytics?.subscriptions_created)} />
                <LeadershipMetric label="Signup → store" value={analytics ? `${analytics.signup_to_store_conversion_percent}%` : 'Unavailable'} detail="Store creation as a share of signups" />
            </MetricGrid>
        </Panel>
    </ConsoleWorkspace>;
}
