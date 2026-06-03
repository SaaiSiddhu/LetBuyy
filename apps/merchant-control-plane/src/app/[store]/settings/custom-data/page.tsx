import { notFound } from 'next/navigation'
import { getSessionUser, getStoreForUser } from '@/lib/auth/session'
import { SettingsPane } from '@/components/settings'
import { Badge, Banner, Card, Input, MaterialIcon, Section, type MaterialIconName } from '@letbuyy/ui'

interface CustomDataPageProps {
    params: Promise<{ store: string }>
}

const customDataSurfaces: Array<{
    title: string
    description: string
    iconName: MaterialIconName
}> = [
    {
        title: 'Store metafields',
        description: 'Store-level custom fields for storefront copy, integrations, and operations metadata.',
        iconName: 'storefront',
    },
    {
        title: 'Product metafields',
        description: 'Product attributes for PDP content, merchandising, filters, and marketplace extensions.',
        iconName: 'inventory_2',
    },
    {
        title: 'Customer and order metafields',
        description: 'Custom lifecycle fields for shoppers, orders, fulfillment, and support workflows.',
        iconName: 'manage_accounts',
    },
    {
        title: 'Metaobjects',
        description: 'Reusable structured objects for size charts, brand stories, FAQs, specifications, and reusable content.',
        iconName: 'deployed_code',
    },
]

const requiredContracts = [
    'Metafield definition schema with tenant ownership',
    'Metaobject type and entry APIs',
    'Validation rules and storefront exposure flags',
    'Audit trail for custom data definition changes',
]

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

function CustomDataSurface({
    title,
    description,
    iconName,
}: {
    title: string
    description: string
    iconName: MaterialIconName
}) {
    return (
        <div className="grid gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)] md:grid-cols-[auto_1fr_auto] md:items-center">
            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] items-center justify-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-primary-soft)] text-[color:var(--lb-color-primary)]">
                <MaterialIcon name={iconName} className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" />
            </span>
            <div className="min-w-0">
                <p className="m-0 font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">{title}</p>
                <p className="m-0 mt-[var(--lb-space-1)] text-[length:var(--lb-font-size-body-sm)] leading-[var(--lb-line-height-body-sm)] text-[color:var(--lb-color-text-subdued)]">{description}</p>
            </div>
            <Badge label="Needs backend" variant="warning" className="self-start md:self-center" />
        </div>
    )
}

export default async function CustomDataPage({ params }: CustomDataPageProps) {
    const { store } = await params
    const user = await getSessionUser()
    if (!user) notFound()

    const storeData = await getStoreForUser(store, user.id)
    if (!storeData) notFound()

    return (
        <SettingsPane
            store={store}
            title="Custom data"
            description="Review custom field and content-model readiness for extensible store data."
            iconName="deployed_code"
            secondaryActions={[{
                label: 'View theme editor',
                href: `/${store}/online-store/themes`,
                icon: <MaterialIcon name="palette" className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" />,
            }]}
        >
            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                <SummaryCard
                    iconName="deployed_code"
                    label="Metafield definitions"
                    value="Needs backend"
                    variant="warning"
                />
                <SummaryCard
                    iconName="category"
                    label="Metaobject types"
                    value="Needs backend"
                    variant="warning"
                />
                <SummaryCard
                    iconName="description"
                    label="Theme schemas"
                    value="Separate system"
                    variant="info"
                />
            </div>

            <Card>
                <Section
                    title="Store context"
                    description="This pane verifies tenant context only; custom data definitions need their own governed API."
                    action={<Badge label="Read-only" variant="info" className="self-start" />}
                >
                    <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                        <Input
                            label="Store"
                            value={storeData.name}
                            helperText="Custom data must remain scoped to this tenant/store."
                            disabled
                        />
                        <Input
                            label="Store handle"
                            value={storeData.store_name}
                            helperText="Definitions require explicit site ownership checks before persistence."
                            disabled
                        />
                        <Input
                            label="Current source"
                            value="Theme schemas only"
                            helperText="The current search found theme schema APIs, not metafield or metaobject settings APIs."
                            disabled
                        />
                        <Input
                            label="Storefront exposure"
                            value="Needs backend"
                            helperText="Public exposure flags must be enforced by backend contracts before rendering."
                            disabled
                        />
                    </div>
                </Section>
            </Card>

            <Card>
                <Section
                    title="Custom data surfaces"
                    description="These Shopify-class extension surfaces are shown as readiness placeholders until APIs exist."
                    action={<Badge label="Needs backend" variant="warning" className="self-start" />}
                >
                    <div className="grid gap-[var(--lb-space-3)]">
                        {customDataSurfaces.map((surface) => (
                            <CustomDataSurface key={surface.title} {...surface} />
                        ))}
                    </div>
                </Section>
            </Card>

            <Card>
                <Section
                    title="Required backend contracts"
                    description="Custom data cannot be editable without schema validation, tenant isolation, and auditability."
                    action={<Badge label="Contract required" variant="warning" className="self-start" />}
                >
                    <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                        {requiredContracts.map((contract) => (
                            <div key={contract} className="flex items-start gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-dashed border-[var(--lb-color-border)] bg-[var(--lb-color-surface-muted)] p-[var(--lb-space-4)]">
                                <MaterialIcon name="pending" className="mt-[2px] h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[color:var(--lb-color-warning)]" />
                                <div>
                                    <p className="m-0 font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">{contract}</p>
                                    <p className="m-0 mt-[var(--lb-space-1)] text-[length:var(--lb-font-size-body-sm)] leading-[var(--lb-line-height-body-sm)] text-[color:var(--lb-color-text-subdued)]">
                                        Backend contract required before merchants can configure this safely.
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Section>
            </Card>

            <Banner variant="warning" title="Backend contract required">
                Metafields and metaobjects need tenant-owned definition APIs, validation rules, storefront exposure controls, and audit history before they can be editable. Theme schemas remain a separate system and are not a substitute for custom data contracts.
            </Banner>
        </SettingsPane>
    )
}
