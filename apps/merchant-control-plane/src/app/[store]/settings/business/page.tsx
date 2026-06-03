import { notFound } from 'next/navigation'
import { BackendNeededPane } from '@/components/settings/BackendNeededPane'
import { createMerchantApiClient } from '@/lib/api/client'
import { getSessionUser, getStoreForUser } from '@/lib/auth/session'

interface BusinessSettingsPageProps {
    params: Promise<{ store: string }>
}

export default async function BusinessSettingsPage({ params }: BusinessSettingsPageProps) {
    const { store } = await params
    const user = await getSessionUser()
    if (!user) return notFound()

    const storeData = await getStoreForUser(store, user.id)
    if (!storeData) return notFound()

    const businessData = await createMerchantApiClient().stores.get(storeData.id).catch(() => null)

    return (
        <BackendNeededPane
            store={store}
            title="Business details"
            description="Manage legal identity, GST details, and invoice identity for this store."
            requirement="[SKIP - NEEDS BACKEND: allow business_details fields on sites through PATCH /v1/stores/:id and app boundary PATCH /api/stores/:store/settings]"
            availableToday={[
                { label: 'Legal name', value: businessData?.legal_name || '' },
                { label: 'GSTIN', value: businessData?.gstin || '' },
                { label: 'GST state code', value: businessData?.gst_state_code || '' },
                { label: 'Invoice prefix', value: businessData?.invoice_prefix || '' },
            ]}
            details={[
                'Update allowlist needed: `legal_name`, `gstin`, `gst_state_code`, `invoice_prefix`, and `billing_address` on `PATCH /v1/stores/:id`.',
                'App boundary can already proxy `PATCH /api/stores/:store/settings`, but the worker currently rejects these fields with `No valid fields to update`.',
                'Billing address needs a canonical field or nested object on `sites`; no current field was found for business billing address.',
            ]}
        />
    )
}
