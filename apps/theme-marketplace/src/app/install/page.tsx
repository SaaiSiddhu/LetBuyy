import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, CheckCircle, ExternalLink, Package, Store } from '@letbuyy/ui';
import { ThemeService } from '@/lib/theme-service';
import { ThemeInstallFeedbackToast, ThemeInstallSubmitButton } from '@/components/theme-action-feedback';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Install Theme' };

type InstallPageProps = {
    searchParams?: Promise<{
        theme?: string;
        error?: string;
    }>;
};

function stringValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function storeName(store: Record<string, unknown>): string {
    return stringValue(store.store_name) || stringValue(store.name) || stringValue(store.subdomain) || 'Untitled store';
}

function storeSubtitle(store: Record<string, unknown>): string {
    const subdomain = stringValue(store.subdomain);
    const status = stringValue(store.status);
    return [subdomain ? `${subdomain}.letbuyy.store` : '', status].filter(Boolean).join(' - ');
}

async function installThemeAction(formData: FormData) {
    'use server';

    const slug = stringValue(formData.get('theme'));
    const storeId = stringValue(formData.get('store_id'));

    if (!slug || !storeId) {
        redirect(`/install?theme=${encodeURIComponent(slug)}&error=missing_store`);
    }

    try {
        await ThemeService.installTheme(slug, storeId);
    } catch (error) {
        const code = error instanceof Error && error.message.includes('purchase')
            ? 'purchase_required'
            : 'install_failed';
        redirect(`/install?theme=${encodeURIComponent(slug)}&error=${code}`);
    }

    redirect(`/dashboard/installations?installed=${encodeURIComponent(slug)}`);
}

export default async function InstallThemePage({ searchParams }: InstallPageProps) {
    const params = await searchParams;
    const slug = params?.theme || '';
    const error = params?.error || '';
    const [theme, stores] = await Promise.all([
        slug ? ThemeService.getThemeBySlug(slug) : Promise.resolve(null),
        ThemeService.getUserStores(),
    ]);

    if (!slug || !theme) {
        return (
            <div className="container-main py-16 max-w-2xl mx-auto">
                <Link href="/themes" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-heading mb-8">
                    <ArrowLeft className="w-4 h-4" />
                    Back to themes
                </Link>
                <div className="glass-card p-8 text-center">
                    <Package className="w-10 h-10 text-text-subtle mx-auto mb-4" />
                    <h1 className="text-2xl font-bold mb-2">Theme not found</h1>
                    <p className="text-sm text-text-muted mb-6">Choose an approved theme from the marketplace before installing.</p>
                    <Link href="/themes" className="btn-primary inline-flex">Browse Themes</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="container-main py-10 md:py-16 max-w-3xl mx-auto">
            <Link href={`/themes/${slug}`} className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-heading mb-8">
                <ArrowLeft className="w-4 h-4" />
                Back to {stringValue(theme.name) || 'theme'}
            </Link>

            <div className="glass-card p-6 md:p-8">
                <ThemeInstallFeedbackToast error={error} themeName={stringValue(theme.name)} />
                <div className="flex items-start gap-4 mb-8">
                    <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-6 h-6 text-primary-light" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold mb-1">Install {stringValue(theme.name)}</h1>
                        <p className="text-sm text-text-muted">Select a store to apply this approved marketplace theme.</p>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 rounded-lg border border-error/25 bg-error/10 px-4 py-3 text-sm text-error">
                        {error === 'purchase_required'
                            ? 'Purchase this theme before installing it.'
                            : error === 'missing_store'
                                ? 'Choose a store before installing.'
                                : 'Theme installation failed. Try another store or contact support.'}
                    </div>
                )}

                {stores.length === 0 ? (
                    <div className="rounded-xl border border-border bg-surface/40 p-6 text-center">
                        <Store className="w-8 h-8 text-text-subtle mx-auto mb-3" />
                        <h2 className="text-lg font-semibold mb-2">No stores found</h2>
                        <p className="text-sm text-text-muted mb-5">Create a store before installing marketplace themes.</p>
                        <Link href={process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.letbuyy.store'} className="btn-primary inline-flex items-center gap-2">
                            Open Admin
                            <ExternalLink className="w-4 h-4" />
                        </Link>
                    </div>
                ) : (
                    <form action={installThemeAction} className="space-y-6">
                        <input type="hidden" name="theme" value={slug} />
                        <div>
                            <label htmlFor="store_id" className="block text-sm font-semibold text-text-heading mb-3">
                                Store
                            </label>
                            <select
                                id="store_id"
                                name="store_id"
                                required
                                className="w-full px-4 py-3 rounded-lg bg-bg-card border border-border text-text-heading text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                defaultValue=""
                            >
                                <option value="" disabled>Select a store</option>
                                {stores.map((store) => {
                                    const id = stringValue(store.id);
                                    if (!id) return null;
                                    return (
                                        <option key={id} value={id}>
                                            {storeName(store)}{storeSubtitle(store) ? ` - ${storeSubtitle(store)}` : ''}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        <div className="rounded-xl bg-surface/50 p-4 text-sm text-text-muted">
                            Your current storefront styling will be replaced for the selected store.
                        </div>

                        <ThemeInstallSubmitButton />
                    </form>
                )}
            </div>
        </div>
    );
}
