import Link from 'next/link';
import { Bell, Button, Input, Shield, User } from '@letbuyy/ui';
import { ThemeService } from '@/lib/theme-service';
import { getAccountsUrl } from '@/lib/public-urls';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

function formStringValue(value: FormDataEntryValue | null): string {
    return typeof value === 'string' ? value.trim() : '';
}

async function updateSettingsAction(formData: FormData) {
    'use server';

    await ThemeService.updateMarketplaceSettings({
        display_name: formStringValue(formData.get('display_name')),
        support_email: formStringValue(formData.get('support_email')),
        notification_preferences: {
            receipts: formData.get('receipts') === 'on',
            theme_updates: formData.get('theme_updates') === 'on',
            saved_search_alerts: formData.get('saved_search_alerts') === 'on',
        },
    });

    revalidatePath('/dashboard/settings');
    redirect('/dashboard/settings?saved=1');
}

export default async function SettingsPage({ searchParams }: { searchParams?: Promise<{ saved?: string }> }) {
    const params = await searchParams;
    const user = await ThemeService.getSessionUser();
    const settings = await ThemeService.getMarketplaceSettings();
    const accountSecurityHref = getAccountsUrl('/forgot-password');
    const preferences = settings?.notification_preferences && typeof settings.notification_preferences === 'object'
        ? settings.notification_preferences as Record<string, unknown>
        : {};

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold mb-1">Settings</h1>
                <p className="text-sm text-text-muted">Account and marketplace preference status</p>
            </div>

            <div className="space-y-6 max-w-2xl">
                <div className="glass-card p-6">
                    <h2 className="text-base font-semibold text-text-heading flex items-center gap-2 mb-5">
                        <User className="w-4 h-4 text-primary-light" />
                        Profile
                    </h2>
                    {params?.saved === '1' && (
                        <p className="mb-4 rounded-lg border border-success/20 bg-success/10 px-4 py-2 text-sm text-success">
                            Settings saved.
                        </p>
                    )}
                    <form action={updateSettingsAction} className="grid gap-4">
                        <div>
                            <label htmlFor="display_name" className="text-xs text-text-muted block mb-1.5">Display Name</label>
                            <Input unstyled
                                id="display_name"
                                name="display_name"
                                defaultValue={settings?.display_name || user?.fullName || ''}
                                className="h-11 w-full rounded-lg border border-border bg-bg-card px-4 text-sm text-text-heading"
                            />
                        </div>
                        <div>
                            <label htmlFor="support_email" className="text-xs text-text-muted block mb-1.5">Support email</label>
                            <Input unstyled
                                id="support_email"
                                name="support_email"
                                type="email"
                                defaultValue={settings?.support_email || user?.email || ''}
                                className="h-11 w-full rounded-lg border border-border bg-bg-card px-4 text-sm text-text-heading"
                            />
                        </div>
                        <fieldset className="grid gap-3 rounded-lg border border-border p-4">
                            <legend className="px-1 text-xs font-medium text-text-muted">
                                <span className="inline-flex items-center gap-2">
                                    <Bell className="w-4 h-4 text-primary-light" />
                                    Notifications
                                </span>
                            </legend>
                            {[
                                ['receipts', 'Purchase receipts and license updates'],
                                ['theme_updates', 'Theme updates and rollback notices'],
                                ['saved_search_alerts', 'Saved search alerts'],
                            ].map(([name, label]) => (
                                <label key={name} className="flex items-center gap-3 text-sm text-text-heading">
                                    <Input unstyled
                                        type="checkbox"
                                        name={name}
                                        defaultChecked={preferences[name] === true}
                                        className="h-4 w-4 rounded border-border"
                                    />
                                    {label}
                                </label>
                            ))}
                        </fieldset>
                        <Button unstyled type="submit" className="btn-primary inline-flex w-fit px-4 py-2.5 text-sm">
                            Save settings
                        </Button>
                    </form>
                </div>

                <div className="glass-card p-6">
                    <h2 className="text-base font-semibold text-text-heading flex items-center gap-2 mb-5">
                        <Shield className="w-4 h-4 text-primary-light" />
                        Security
                    </h2>
                    <p className="mb-4 text-sm leading-relaxed text-text-muted">
                        Password and multi-factor settings are owned by the identity platform.
                    </p>
                    <Link href={accountSecurityHref} className="btn-secondary inline-flex px-4 py-2.5 text-sm">
                        Open account recovery
                    </Link>
                </div>
            </div>
        </div>
    );
}
