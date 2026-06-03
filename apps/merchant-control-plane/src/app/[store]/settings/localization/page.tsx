import { notFound } from 'next/navigation'
import { createMerchantApiClient } from '@/lib/api/client'
import { getSessionUser, getStoreForUser } from '@/lib/auth/session'
import {
    DEFAULT_ADMIN_LOCALE,
    SUPPORTED_ADMIN_LOCALES,
    normalizeAdminLocale,
} from '@/lib/i18n/admin-locales'
import { SettingsPane } from '@/components/settings'
import { Badge, Banner, Card, Input, MaterialIcon, Section, type MaterialIconName } from '@letbuyy/ui'

interface LocalizationPageProps {
    params: Promise<{ store: string }>
}

type LocaleStatus = 'active' | 'available' | 'needs-backend'

const storefrontLocalizationNeeds = [
    'Supported storefront languages',
    'Default buyer language by market',
    'Theme translation publishing',
    'Localized policy and notification copy',
]

function readString(record: Record<string, unknown> | null, key: string, fallback = '') {
    const value = record?.[key]
    return typeof value === 'string' ? value : fallback
}

function getLoadErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unable to load localization settings.'
}

function getLocaleLabel(code: string) {
    const normalized = normalizeAdminLocale(code)
    const locale = SUPPORTED_ADMIN_LOCALES.find((item) => item.code === normalized)
    return locale ? `${locale.language} (${locale.code})` : normalized
}

function SummaryCard({
    iconName,
    label,
    value,
    variant,
}: {
    iconName: MaterialIconName
    label: string
    value: string
    variant: 'success' | 'warning' | 'info'
}) {
    return (
        <Card className="p-[var(--lb-space-4)]">
            <div className="flex items-center gap-[var(--lb-space-3)]">
                <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-primary-soft)] text-[color:var(--lb-color-primary)]">
                    <MaterialIcon name={iconName} className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" />
                </span>
                <div className="min-w-0">
                    <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">{label}</p>
                    <div className="mt-[var(--lb-space-1)]">
                        <Badge label={value} variant={variant} className="max-w-full" />
                    </div>
                </div>
            </div>
        </Card>
    )
}

function LocaleRow({
    language,
    code,
    region,
    direction,
    status,
}: {
    language: string
    code: string
    region: string
    direction: string
    status: LocaleStatus
}) {
    const statusLabel = status === 'active' ? 'Store default' : status === 'available' ? 'Catalog ready' : 'Needs backend'
    const statusVariant = status === 'active' ? 'success' : status === 'available' ? 'info' : 'warning'

    return (
        <div className="grid gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)] md:grid-cols-[1.2fr_0.8fr_auto] md:items-center">
            <div className="min-w-0">
                <p className="m-0 font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">{language}</p>
                <p className="m-0 mt-[var(--lb-space-1)] text-[length:var(--lb-font-size-body-sm)] leading-[var(--lb-line-height-body-sm)] text-[color:var(--lb-color-text-subdued)]">
                    {region} · {direction.toUpperCase()}
                </p>
            </div>
            <span className="text-[length:var(--lb-font-size-body-sm)] leading-[var(--lb-line-height-body-sm)] text-[color:var(--lb-color-text-subdued)]">{code}</span>
            <Badge label={statusLabel} variant={statusVariant} className="self-start md:self-center" />
        </div>
    )
}

export default async function LocalizationPage({ params }: LocalizationPageProps) {
    const { store } = await params
    const user = await getSessionUser()
    if (!user) notFound()

    const storeData = await getStoreForUser(store, user.id)
    if (!storeData) notFound()

    const result = await createMerchantApiClient().stores.get(storeData.id)
        .then((data) => ({ data: data as Record<string, unknown>, loadError: null }))
        .catch((error) => ({ data: null, loadError: getLoadErrorMessage(error) }))

    const storeRecord = result.data
    const rawLocale = readString(storeRecord, 'locale', DEFAULT_ADMIN_LOCALE)
    const normalizedLocale = normalizeAdminLocale(rawLocale)
    const currency = readString(storeRecord, 'currency', 'INR')
    const timezone = readString(storeRecord, 'timezone', 'Asia/Kolkata')
    const activeLocaleLabel = getLocaleLabel(normalizedLocale)

    return (
        <SettingsPane
            store={store}
            title="Languages"
            description="Review the storefront default language and localization readiness for India-first commerce."
            iconName="language"
            secondaryActions={[{
                label: 'Edit general settings',
                href: `/${store}/settings/general`,
                icon: <MaterialIcon name="storefront" className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" />,
            }]}
        >
            {result.loadError && (
                <Banner variant="critical" title="Localization settings could not load">
                    {result.loadError}
                </Banner>
            )}

            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                <SummaryCard
                    iconName="language"
                    label="Default language"
                    value={activeLocaleLabel}
                    variant="success"
                />
                <SummaryCard
                    iconName="public"
                    label="Language catalog"
                    value={`${SUPPORTED_ADMIN_LOCALES.length} locales`}
                    variant="info"
                />
                <SummaryCard
                    iconName="translate"
                    label="Storefront translation"
                    value="Needs backend"
                    variant="warning"
                />
            </div>

            <Card>
                <Section
                    title="Store language defaults"
                    description="The current store settings API exposes one locale value. Multi-language storefront controls need a dedicated localization contract."
                    action={<Badge label="Read-only" variant="info" className="self-start" />}
                >
                    <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                        <Input
                            label="Storefront default language"
                            value={activeLocaleLabel}
                            helperText="Persisted through the existing General settings locale field."
                            disabled
                        />
                        <Input
                            label="Locale code"
                            value={normalizedLocale}
                            helperText="Locale aliases are normalized to the India-first admin locale catalog."
                            disabled
                        />
                        <Input
                            label="Currency"
                            value={currency}
                            helperText="Currency remains managed from General settings."
                            disabled
                        />
                        <Input
                            label="Timezone"
                            value={timezone}
                            helperText="The current store contract falls back to Asia/Kolkata when timezone is not exposed."
                            disabled
                        />
                    </div>
                </Section>
            </Card>

            <Card>
                <Section
                    title="Available language catalog"
                    description="These locales are available to admin-facing settings today; storefront publishing still needs backend support."
                    action={<Badge label="Catalog" variant="info" className="self-start" />}
                >
                    <div className="grid gap-[var(--lb-space-3)]">
                        {SUPPORTED_ADMIN_LOCALES.map((locale) => (
                            <LocaleRow
                                key={locale.code}
                                language={locale.language}
                                code={locale.code}
                                region={locale.region}
                                direction={locale.direction}
                                status={locale.code === normalizedLocale ? 'active' : 'available'}
                            />
                        ))}
                    </div>
                </Section>
            </Card>

            <Card>
                <Section
                    title="Storefront localization"
                    description="Buyer-facing language enablement requires coordinated store, theme, policy, notification, and market copy contracts."
                    action={<Badge label="Needs backend" variant="warning" className="self-start" />}
                >
                    <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                        {storefrontLocalizationNeeds.map((need) => (
                            <div key={need} className="flex items-start gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-dashed border-[var(--lb-color-border)] bg-[var(--lb-color-surface-muted)] p-[var(--lb-space-4)]">
                                <MaterialIcon name="pending" className="mt-[2px] h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[color:var(--lb-color-warning)]" />
                                <div>
                                    <p className="m-0 font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">{need}</p>
                                    <p className="m-0 mt-[var(--lb-space-1)] text-[length:var(--lb-font-size-body-sm)] leading-[var(--lb-line-height-body-sm)] text-[color:var(--lb-color-text-subdued)]">
                                        Backend contract required before this control can be made editable.
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Section>
            </Card>

            <Banner variant="warning" title="Backend contract required">
                The current settings API persists one default locale only. Supported storefront languages, market-specific defaults, theme translation publishing, and localized content readiness need a store localization endpoint before merchants can manage them here.
            </Banner>
        </SettingsPane>
    )
}
