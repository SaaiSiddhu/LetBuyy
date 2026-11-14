import type { ReactNode } from 'react';
import Link from 'next/link';
import { ConsoleDependencyHealthSchema, type ConsoleDependencyHealth } from '@letbuyy/shared-types';
import { ConsoleApiErrorPanel, StatusBadge } from '@/components/ConsoleDataTable';
import { fetchConsoleApi, type ConsoleDataResponse } from '@/lib/console-api';

type ConsoleSettings = {
    health: ConsoleDependencyHealth;
    environment: string;
    runtime_name: string;
    primary_region: string;
    edge_scope: string;
    console_api_token_configured: boolean;
    csrf_secret_configured: boolean;
    internal_api_secret_configured: boolean;
    queues: Record<string, boolean>;
    bindings: Record<string, boolean>;
};

export default async function ConsoleSettingsPage() {
    const result = await fetchConsoleApi<ConsoleDataResponse<ConsoleSettings>>('/internal/console/settings');
    const settings = result.data?.data;
    const health=ConsoleDependencyHealthSchema.safeParse(settings?.health);

    return (
        <div className="space-y-6 p-8">
            <div>
                <h1 className="text-2xl font-bold text-default">Platform Settings</h1>
                <p className="mt-1 text-sm text-subdued">Current dependency evidence and configuration for this API environment.</p>
            </div>

            {result.error || !settings ? (
                <ConsoleApiErrorPanel title="Settings API unavailable" message={result.error || 'Configuration data was not returned.'} />
            ) : (
                <div className="space-y-6">
                    <SettingsPanel title="Live database connection">
                        {health.success?<><SettingRow label="Observed" value={new Date(health.data.observed_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})+' IST'} /><SettingRow label="Connection" value={health.data.database.status} /><SettingRow label="Read latency" value={health.data.database.latency_ms+' ms'} /><p className="px-5 py-4 text-sm">{health.data.database.action}</p></>:<p role="alert" className="px-5 py-4">Live connection evidence is unavailable. Reload to retry.</p>}
                    </SettingsPanel>
                    <SettingsPanel title="Investigate an operational problem">
                        <p className="px-5 py-4 text-sm">Configured bindings below show presence only. They do not prove provider availability or successful delivery. Recorded runtime samples show their own observation times.</p>
                        <nav aria-label="Dependency recovery" className="flex flex-wrap gap-4 px-5 py-4"><Link className="underline" href="/operations">Runtime evidence and protected job recovery</Link><Link className="underline" href="/webhooks">Webhook delivery evidence</Link><Link className="underline" href="/support">Merchant support</Link></nav>
                    </SettingsPanel>
                    <div className="grid gap-6 xl:grid-cols-2">
                    <SettingsPanel title="Runtime">
                        <SettingRow label="Environment" value={settings?.environment || 'unknown'} />
                        <SettingRow label="Runtime" value={settings?.runtime_name || 'api-gateway'} />
                        <SettingRow label="Primary Region" value={settings?.primary_region || 'unset'} />
                        <SettingRow label="Edge Scope" value={settings?.edge_scope || 'global-edge'} />
                    </SettingsPanel>

                    <SettingsPanel title="Secrets">
                        <BooleanRow label="Console API Token" value={Boolean(settings?.console_api_token_configured)} />
                        <BooleanRow label="CSRF Secret" value={Boolean(settings?.csrf_secret_configured)} />
                        <BooleanRow label="Internal API Secret" value={Boolean(settings?.internal_api_secret_configured)} />
                    </SettingsPanel>

                    <SettingsPanel title="Queues">
                        {Object.entries(settings?.queues || {}).map(([key, value]) => (
                            <BooleanRow key={key} label={labelize(key)} value={value} />
                        ))}
                    </SettingsPanel>

                    <SettingsPanel title="Bindings">
                        {Object.entries(settings?.bindings || {}).map(([key, value]) => (
                            <BooleanRow key={key} label={labelize(key)} value={value} />
                        ))}
                    </SettingsPanel>
                    </div>
                </div>
            )}
        </div>
    );
}

function SettingsPanel({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="rounded-lg border border-line bg-surface">
            <h2 className="border-b border-line px-5 py-4 text-sm font-semibold text-default">{title}</h2>
            <div className="divide-y divide-line">{children}</div>
        </section>
    );
}

function SettingRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-4 px-5 py-4 text-sm">
            <span className="text-subdued">{label}</span>
            <span className="text-right font-medium text-default">{value}</span>
        </div>
    );
}

function BooleanRow({ label, value }: { label: string; value: boolean }) {
    return (
        <div className="flex items-center justify-between gap-4 px-5 py-4 text-sm">
            <span className="text-subdued">{label}</span>
            <StatusBadge value={value ? 'configured' : 'missing'} tone={value ? 'green' : 'red'} />
        </div>
    );
}

function labelize(value: string): string {
    return value
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}
