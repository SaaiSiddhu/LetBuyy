import { notFound } from 'next/navigation'
import { createMerchantApiClient } from '@/lib/api/client'
import { getSessionUser, getStoreForUser } from '@/lib/auth/session'
import { SettingsPane } from '@/components/settings'
import { Badge, Banner, Card, Input, MaterialIcon, Section, type MaterialIconName } from '@letbuyy/ui'

interface BusinessDetailsPageProps {
    params: Promise<{ store: string }>
}

const INDIAN_GST_STATES: Record<string, string> = {
    '01': 'Jammu and Kashmir',
    '02': 'Himachal Pradesh',
    '03': 'Punjab',
    '04': 'Chandigarh',
    '05': 'Uttarakhand',
    '06': 'Haryana',
    '07': 'Delhi',
    '08': 'Rajasthan',
    '09': 'Uttar Pradesh',
    '10': 'Bihar',
    '11': 'Sikkim',
    '12': 'Arunachal Pradesh',
    '13': 'Nagaland',
    '14': 'Manipur',
    '15': 'Mizoram',
    '16': 'Tripura',
    '17': 'Meghalaya',
    '18': 'Assam',
    '19': 'West Bengal',
    '20': 'Jharkhand',
    '21': 'Odisha',
    '22': 'Chhattisgarh',
    '23': 'Madhya Pradesh',
    '24': 'Gujarat',
    '25': 'Daman and Diu',
    '26': 'Dadra and Nagar Haveli',
    '27': 'Maharashtra',
    '28': 'Andhra Pradesh',
    '29': 'Karnataka',
    '30': 'Goa',
    '31': 'Lakshadweep',
    '32': 'Kerala',
    '33': 'Tamil Nadu',
    '34': 'Puducherry',
    '35': 'Andaman and Nicobar Islands',
    '36': 'Telangana',
    '37': 'Andhra Pradesh',
    '38': 'Ladakh',
    '97': 'Other Territory',
}

function readString(record: Record<string, unknown> | null, key: string, fallback = '') {
    const value = record?.[key]
    return typeof value === 'string' ? value : fallback
}

function hasValue(value: string) {
    return value.trim().length > 0
}

function formatSiteType(value: string) {
    if (!value) return 'Store'
    return value
        .split(/[-_]/)
        .filter(Boolean)
        .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
        .join(' ')
}

function formatGstState(code: string) {
    if (!hasValue(code)) return 'Not configured'
    const stateName = INDIAN_GST_STATES[code]
    return stateName ? `${code} - ${stateName}` : `${code} - Registered state`
}

function getLoadErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unable to load business details.'
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

export default async function BusinessDetailsPage({ params }: BusinessDetailsPageProps) {
    const { store } = await params
    const user = await getSessionUser()
    if (!user) notFound()

    const storeData = await getStoreForUser(store, user.id)
    if (!storeData) notFound()

    const result = await createMerchantApiClient().stores.get(storeData.id)
        .then((data) => ({ data: data as Record<string, unknown>, loadError: null }))
        .catch((error) => ({ data: null, loadError: getLoadErrorMessage(error) }))

    const storeRecord = result.data
    const storeName = readString(storeRecord, 'name', storeData.name)
    const storeHandle = readString(storeRecord, 'store_name', storeData.store_name)
    const legalName = readString(storeRecord, 'legal_name')
    const displayLegalName = hasValue(legalName) ? legalName : storeName
    const gstin = readString(storeRecord, 'gstin')
    const gstStateCode = readString(storeRecord, 'gst_state_code')
    const invoicePrefix = readString(storeRecord, 'invoice_prefix', 'LBY')
    const siteType = readString(storeRecord, 'site_type', storeData.site_type)

    const legalConfigured = hasValue(legalName)
    const gstConfigured = hasValue(gstin)

    return (
        <SettingsPane
            store={store}
            title="Business details"
            description="Review legal entity, GST registration, billing address readiness, and invoice identity for this store."
            iconName="work"
            secondaryActions={[{
                label: 'Edit general settings',
                href: `/${store}/settings/general`,
                icon: <MaterialIcon name="storefront" className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" />,
            }]}
        >
            {result.loadError && (
                <Banner variant="critical" title="Business details could not load">
                    {result.loadError}
                </Banner>
            )}

            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                <SummaryCard
                    iconName="work"
                    label="Legal entity"
                    value={legalConfigured ? 'Configured' : 'Uses store name'}
                    variant={legalConfigured ? 'success' : 'info'}
                />
                <SummaryCard
                    iconName="request_quote"
                    label="GST registration"
                    value={gstConfigured ? 'Configured' : 'Not configured'}
                    variant={gstConfigured ? 'success' : 'warning'}
                />
                <SummaryCard
                    iconName="location_on"
                    label="Billing address"
                    value="Needs backend"
                    variant="warning"
                />
            </div>

            <Card>
                <Section
                    title="Legal entity"
                    description="These read-only fields are sourced from the existing store contract."
                    action={<Badge label="Read-only" variant="info" className="self-start" />}
                >
                    <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                        <Input
                            label="Legal name"
                            value={displayLegalName}
                            helperText={legalConfigured ? 'Stored legal entity name.' : 'The store name is used until legal_name updates are supported.'}
                            disabled
                        />
                        <Input
                            label="Store handle"
                            value={storeHandle}
                            helperText="The governed store handle cannot be changed from this pane."
                            disabled
                        />
                        <Input
                            label="Business type"
                            value={formatSiteType(siteType)}
                            helperText="Site type changes require a governed migration."
                            disabled
                        />
                        <Input
                            label="Store status"
                            value={readString(storeRecord, 'status', storeData.status)}
                            helperText="Status is controlled by platform and store lifecycle rules."
                            disabled
                        />
                    </div>
                </Section>
            </Card>

            <Card>
                <Section
                    title="GST and invoice identity"
                    description="GST data is used by the order execution adapter when generating GST invoices."
                    action={<Badge label={gstConfigured ? 'GST ready' : 'Needs GSTIN'} variant={gstConfigured ? 'success' : 'warning'} className="self-start" />}
                >
                    <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                        <Input
                            label="GSTIN"
                            value={gstConfigured ? gstin : 'Not configured'}
                            helperText="GSTIN updates need backend support in the store update contract."
                            disabled
                        />
                        <Input
                            label="GST state"
                            value={formatGstState(gstStateCode)}
                            helperText="This state code controls intra-state and inter-state GST treatment."
                            disabled
                        />
                        <Input
                            label="Invoice prefix"
                            value={invoicePrefix}
                            helperText="Current invoice prefix used by GST invoice numbering."
                            disabled
                        />
                        <Input
                            label="Currency"
                            value={readString(storeRecord, 'currency', 'INR')}
                            helperText="Currency is editable from General settings."
                            disabled
                        />
                    </div>
                </Section>
            </Card>

            <Card>
                <Section
                    title="Billing address"
                    description="Registered billing address fields are not available in the current store business-details contract."
                    action={<Badge label="Needs backend" variant="warning" className="self-start" />}
                >
                    <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                        <Input
                            label="Registered address"
                            value="Not available in current store contract"
                            helperText="Backend must expose billing address fields before merchants can manage this here."
                            disabled
                        />
                        <Input
                            label="City, state, and PIN"
                            value="Not available in current store contract"
                            helperText="No billing_address field is exposed for sites in this settings flow."
                            disabled
                        />
                    </div>
                </Section>
            </Card>

            <Banner variant="warning" title="Backend contract required">
                Saving legal entity, GSTIN, GST state, invoice prefix, and registered billing address from this pane needs a business-details update contract. Until that exists, this page exposes the available store fields read-only and keeps billing address as a backend-needed placeholder.
            </Banner>
        </SettingsPane>
    )
}
