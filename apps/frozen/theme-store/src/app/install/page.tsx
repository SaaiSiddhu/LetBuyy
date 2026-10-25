import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, CheckCircle, ExternalLink, Input, Select, Package, Store } from '@letbuyy/ui';
import { MarketplaceInstallUnconfirmedError, ThemeService } from '@/lib/theme-service';
import { LetbuyyApiError } from '@letbuyy/api-client';
import { InstallThemeSchema, ThemeSlugParamSchema } from '@letbuyy/theme-engine';
import { getAccountsUrl, getAdminUrl, getThemeMarketplaceUrl } from '@/lib/public-urls';
import { ThemeInstallFeedbackToast, ThemeInstallSubmitButton } from '@/components/theme-action-feedback';
import { installErrorMessage } from '@/lib/install-feedback';
import { isRequestedInstallVersionCurrent } from '@/lib/install-selection';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Install Theme' };

type InstallPageProps = {
    searchParams?: Promise<{
        theme?: string;
        version?: string;
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
    return [subdomain ? `${subdomain}.letbuyy.com` : '', status].filter(Boolean).join(' - ');
}

async function installThemeAction(formData: FormData) {
    'use server';

    const slug = stringValue(formData.get('theme'));
    const storeId = stringValue(formData.get('store_id'));
    const confirmed = formData.get('confirm_install') === 'yes';
    if (!ThemeSlugParamSchema.safeParse({ slug }).success) redirect('/themes');

    if (!slug || !storeId) {
        redirect(`/install?theme=${encodeURIComponent(slug)}&error=missing_store`);
    }
    if (!confirmed) {
        redirect(`/install?theme=${encodeURIComponent(slug)}&error=missing_confirmation`);
    }

    const intent = InstallThemeSchema.safeParse({ store_id: storeId, expected_version: formData.get('expected_version'),
        expected_package_id: formData.get('expected_package_id'), expected_package_version_id: formData.get('expected_package_version_id') });
    if (!intent.success) redirect(`/install?theme=${encodeURIComponent(slug)}&error=selection_unavailable`);
    let editorHref: string;
    try {
        const receipt = await ThemeService.installTheme(slug, storeId, { version: intent.data.expected_version,
            packageId: intent.data.expected_package_id, packageVersionId: intent.data.expected_package_version_id });
        const ownedStore = (await ThemeService.getUserStores(true)).find(store => store.id === storeId);
        const subdomain = stringValue(ownedStore?.subdomain);
        if (!subdomain) throw new MarketplaceInstallUnconfirmedError();
        const query = new URLSearchParams({ theme_instance_id: receipt.theme_instance_id, theme_package_version_id: receipt.theme_package_version_id });
        editorHref = getAdminUrl(`/${encodeURIComponent(subdomain)}/online-store/themes/${encodeURIComponent(receipt.theme.slug)}/editor?${query}`);
    } catch (error) {
        const code = error instanceof MarketplaceInstallUnconfirmedError ? 'install_unconfirmed'
            : error instanceof LetbuyyApiError && ['THEME_VERSION_CONFLICT', 'THEME_INSTANCE_VERSION_CONFLICT'].includes(error.code) ? 'version_conflict'
            : error instanceof Error && /purchase/i.test(error.message) ? 'purchase_required' : 'install_failed';
        redirect(`/install?theme=${encodeURIComponent(slug)}&error=${code}`);
    }

    redirect(editorHref);
}

export default async function InstallThemePage({ searchParams }: InstallPageProps) {
    const params = await searchParams;
    const slug = params?.theme || '';
    const error = params?.error || '';
    if (!await ThemeService.getSessionUser()) {
        const query = new URLSearchParams({ theme: slug });
        if (params?.version) query.set('version', params.version);
        const returnTo = getThemeMarketplaceUrl(`/install?${query}`);
        redirect(`${getAccountsUrl('/lookup')}?return_to=${encodeURIComponent(returnTo)}`);
    }
    const [theme, stores] = await Promise.all([
        slug ? ThemeService.getThemeBySlug(slug) : Promise.resolve(null),
        ThemeService.getUserStores(true).catch(() => null),
    ]);
    const candidate = theme ? await ThemeService.getThemeInstallSelection(slug).catch(() => null) : null;
    const selection = candidate && isRequestedInstallVersionCurrent(params?.version, candidate.version) ? candidate : null;
    const changedVersion = candidate && params?.version !== undefined && !selection;

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
                        <p className="text-sm text-text-muted">Add this theme to the selected store’s private library. Customize and publish separately.</p>
                        {selection && <p className="text-sm text-text-muted mt-2">Version {selection.version}</p>}
                    </div>
                </div>

                {error && (
                    <div className="mb-6 rounded-lg border border-error/25 bg-error/10 px-4 py-3 text-sm text-error">
                        {installErrorMessage(error)}
                    </div>
                )}

                {!selection ? <div role="alert" className="rounded-xl border border-border bg-surface/40 p-6"><h2 className="text-lg font-semibold">{changedVersion ? 'Theme version changed' : 'Package details unavailable'}</h2><p className="text-sm text-text-muted">{changedVersion ? 'Return to theme details to review its current version before adding it.' : 'Reload these details before adding this design. Its exact package version must be confirmed.'}</p><Link href={changedVersion ? `/themes/${encodeURIComponent(slug)}` : `/install?theme=${encodeURIComponent(slug)}`} className="btn-secondary inline-flex mt-3">{changedVersion ? 'Review current version' : 'Retry package details'}</Link></div> : stores === null ? <div role="alert" className="rounded-xl border border-border bg-surface/40 p-6"><h2 className="text-lg font-semibold">Store list unavailable</h2><p className="text-sm text-text-muted">Your stores could not be confirmed. Retry before adding the theme.</p><Link href={`/install?theme=${encodeURIComponent(slug)}`} className="btn-secondary inline-flex mt-3">Retry store list</Link></div> : stores.length === 0 ? (
                    <div className="rounded-xl border border-border bg-surface/40 p-6 text-center">
                        <Store className="w-8 h-8 text-text-subtle mx-auto mb-3" />
                        <h2 className="text-lg font-semibold mb-2">No stores found</h2>
                        <p className="text-sm text-text-muted mb-5">Create a store before installing marketplace themes.</p>
                        <Link href={getAdminUrl()} className="btn-primary inline-flex items-center gap-2">
                            Open Admin
                            <ExternalLink className="w-4 h-4" />
                        </Link>
                    </div>
                ) : (
                    <form action={installThemeAction} className="space-y-6">
                        <Input unstyled type="hidden" name="theme" value={slug} />
                        <Input unstyled type="hidden" name="expected_version" value={selection.version} />
                        <Input unstyled type="hidden" name="expected_package_id" value={selection.packageId} />
                        <Input unstyled type="hidden" name="expected_package_version_id" value={selection.packageVersionId} />
                        <div>
                            <label htmlFor="store_id" className="block text-sm font-semibold text-text-heading mb-3">
                                Store
                            </label>
                            <Select unstyled
                                id="store_id"
                                name="store_id"
                                required
                                className="w-full px-4 py-3 rounded-lg bg-bg-card border border-border text-text-heading text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                defaultValue=""
                                options={[{ value: '', label: 'Select a store', disabled: true }, ...stores.flatMap((store) => {
                                    const id = stringValue(store.id);
                                    return id ? [{ value: id, label: storeName(store) + (storeSubtitle(store) ? ` - ${storeSubtitle(store)}` : '') }] : [];
                                })]}
                            />
                        </div>

                        <div className="rounded-xl bg-surface/50 p-4 text-sm text-text-muted">
                            Adding creates a private library instance. Your current live theme, catalog and existing drafts stay in place. Customize and publish in the merchant theme editor.
                        </div>

                        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface/40 p-4">
                            <Link href={`/themes/${slug}`} className="btn-secondary inline-flex items-center justify-center gap-2 text-sm">
                                Review theme before install
                                <ExternalLink className="w-4 h-4" />
                            </Link>
                            <label className="flex items-start gap-3 text-sm text-text-muted">
                                <Input unstyled
                                    type="checkbox"
                                    name="confirm_install"
                                    value="yes"
                                    required
                                    className="mt-1 h-4 w-4 rounded border-border"
                                />
                                <span>Add this design to the selected store’s library. Publication is a separate action.</span>
                            </label>
                        </div>

                        <ThemeInstallSubmitButton />
                    </form>
                )}
            </div>
        </div>
    );
}
