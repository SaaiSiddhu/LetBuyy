import type { ReactNode } from 'react';
import { ConsoleApiErrorPanel, StatusBadge } from '@/components/ConsoleDataTable';
import { fetchConsoleApi, type ConsoleDataResponse } from '@/lib/console-api';

type ConsoleSettings = {
    environment: string;
    runtime_name: string;
    primary_region: string;
    failover_region: string;
    console_api_token_configured: boolean;
    csrf_secret_configured: boolean;
    internal_api_secret_configured: boolean;
    queues: Record<string, boolean>;
    bindings: Record<string, boolean>;
};

export default async function ConsoleSettingsPage() {
    const result = await fetchConsoleApi<ConsoleDataResponse<ConsoleSettings>>('/internal/console/settings');
    const settings = result.data?.data;

    return (
        <div className="space-y-6 p-8">
            <div>
                <h1 className="text-2xl font-bold text-zinc-50">Platform Settings</h1>
                <p className="mt-1 text-sm text-zinc-400">Read-only production configuration health from the API worker.</p>
            </div>

            {result.error ? (
                <ConsoleApiErrorPanel title="Settings API unavailable" message={result.error} />
            ) : (
                <div className="grid gap-6 xl:grid-cols-2">
                    <SettingsPanel title="Runtime">
                        <SettingRow label="Environment" value={settings?.environment || 'unknown'} />
                        <SettingRow label="Runtime" value={settings?.runtime_name || 'api-gateway'} />
                        <SettingRow label="Primary Region" value={settings?.primary_region || 'unset'} />
                        <SettingRow label="Failover Region" value={settings?.failover_region || 'unset'} />
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
            )}
        </div>
    );
}

function SettingsPanel({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900">
            <h2 className="border-b border-zinc-800 px-5 py-4 text-sm font-semibold text-zinc-100">{title}</h2>
            <div className="divide-y divide-zinc-800">{children}</div>
        </section>
    );
}

function SettingRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-4 px-5 py-4 text-sm">
            <span className="text-zinc-400">{label}</span>
            <span className="text-right font-medium text-zinc-100">{value}</span>
        </div>
    );
}

function BooleanRow({ label, value }: { label: string; value: boolean }) {
    return (
        <div className="flex items-center justify-between gap-4 px-5 py-4 text-sm">
            <span className="text-zinc-400">{label}</span>
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
