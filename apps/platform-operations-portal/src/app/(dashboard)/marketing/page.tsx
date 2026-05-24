export default function MarketingPage() {
    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Marketing</h1>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Campaigns, content, and banners</p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Campaigns</h3>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Manage email and push campaigns</p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Content</h3>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Blog posts and announcements</p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Banners</h3>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Promotional banners and CTAs</p>
                </div>
            </div>
            {/* TODO: Campaign builder, content editor, banner management */}
        </div>
    );
}
