import { notFound } from 'next/navigation'
import { BackendNeededPane } from '@/components/settings/BackendNeededPane'
import { createMerchantApiClient } from '@/lib/api/client'
import { getSessionUser, getStoreForUser } from '@/lib/auth/session'

interface LocalizationSettingsPageProps {
    params: Promise<{ store: string }>
}

export default async function LocalizationSettingsPage({ params }: LocalizationSettingsPageProps) {
    const { store } = await params
    const user = await getSessionUser()
    if (!user) return notFound()

    const storeData = await getStoreForUser(store, user.id)
    if (!storeData) return notFound()

    const localizationData = await createMerchantApiClient().stores.get(storeData.id).catch(() => null)

    return (
        <BackendNeededPane
            store={store}
            title="Languages and localization"
            description="Configure store languages, default locale, timezone, and regional formatting."
            requirement="[SKIP - NEEDS BACKEND: store locales endpoint for enabled locales and default storefront locale assignment]"
            availableToday={[
                { label: 'Current store locale', value: localizationData?.locale || 'en-IN' },
                { label: 'Current timezone', value: localizationData?.timezone || 'Asia/Kolkata' },
                { label: 'Currency', value: localizationData?.currency || 'INR' },
            ]}
            details={[
                'Required read endpoint: `GET /api/stores/:store/localization` or `GET /v1/stores/:id/localization` returning enabled locales, default locale, timezone, currency, and formatting defaults.',
                'Required mutation endpoint: `PATCH /api/stores/:store/localization` for enabled locales and default storefront locale.',
                'Theme engine has locale bundle support, but no store-scoped locale management endpoint was found in the merchant app boundary.',
            ]}
        />
    )
}
