export default function ConsoleSettingsPage() {
    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-50">Platform Settings</h1>
                <p className="mt-1 text-sm text-zinc-400">Feature flags, pricing, and global configuration</p>
            </div>
            <div className="space-y-6">
                <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                    <h2 className="text-lg font-semibold text-zinc-50">Feature Flags</h2>
                    <p className="mt-1 text-sm text-zinc-400">Enable or disable platform features globally.</p>
                    {/* TODO: Toggle switches for feature flags */}
                </section>
                <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                    <h2 className="text-lg font-semibold text-zinc-50">Pricing Tiers</h2>
                    <p className="mt-1 text-sm text-zinc-400">Configure subscription plans and pricing.</p>
                    {/* TODO: Pricing tier editor */}
                </section>
                <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                    <h2 className="text-lg font-semibold text-zinc-50">Global Configuration</h2>
                    <p className="mt-1 text-sm text-zinc-400">Platform-wide settings and defaults.</p>
                    {/* TODO: Global config editor */}
                </section>
            </div>
        </div>
    );
}
