import { notFound } from 'next/navigation'
import { getSessionUser, getStoreForUser } from '@/lib/auth/session'
import { SettingsPane } from '@/components/settings'
import { Badge, Banner, Card, Input, MaterialIcon, Section, type MaterialIconName } from '@letbuyy/ui'

interface SecurityPageProps {
    params: Promise<{ store: string }>
}

type SecurityState = 'ready' | 'managed' | 'needs-backend'

const authenticationControls: Array<{
    title: string
    description: string
    iconName: MaterialIconName
    state: SecurityState
}> = [
    {
        title: 'Password changes',
        description: 'Password reset and password update flows are owned by the Identity Platform.',
        iconName: 'key',
        state: 'managed',
    },
    {
        title: 'Two-factor authentication',
        description: 'Merchant 2FA enrollment, verification, and recovery enforcement need an API contract.',
        iconName: 'shield_lock',
        state: 'needs-backend',
    },
    {
        title: 'Passkeys',
        description: 'Passkey registration, challenge, and device naming endpoints are not exposed to merchant settings yet.',
        iconName: 'passkey',
        state: 'needs-backend',
    },
    {
        title: 'Recovery codes',
        description: 'Recovery code generation, rotation, and one-time-use tracking require backend support.',
        iconName: 'lock',
        state: 'needs-backend',
    },
]

const monitoringNeeds = [
    'Active device and browser sessions',
    'Security alert delivery preferences',
    'Recent login and password-change history',
    'IP allowlist and VPN enforcement for operators',
]

function statusLabel(state: SecurityState) {
    if (state === 'ready') return 'Ready'
    if (state === 'managed') return 'Identity owned'
    return 'Needs backend'
}

function statusVariant(state: SecurityState): 'success' | 'warning' | 'info' {
    if (state === 'ready') return 'success'
    if (state === 'managed') return 'info'
    return 'warning'
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

function SecurityControlRow({
    title,
    description,
    iconName,
    state,
}: {
    title: string
    description: string
    iconName: MaterialIconName
    state: SecurityState
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
            <Badge label={statusLabel(state)} variant={statusVariant(state)} className="self-start md:self-center" />
        </div>
    )
}

export default async function SecurityPage({ params }: SecurityPageProps) {
    const { store } = await params
    const user = await getSessionUser()
    if (!user) notFound()

    const storeData = await getStoreForUser(store, user.id)
    if (!storeData) notFound()

    const displayName = user.fullName || 'Not provided'

    return (
        <SettingsPane
            store={store}
            title="Security"
            description="Review account security ownership, identity controls, and backend readiness for merchant protection."
            iconName="shield_lock"
            secondaryActions={[{
                label: 'Manage users',
                href: `/${store}/settings/users`,
                icon: <MaterialIcon name="manage_accounts" className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" />,
            }]}
        >
            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                <SummaryCard
                    iconName="shield_lock"
                    label="Current session"
                    value="Authenticated"
                    variant="success"
                />
                <SummaryCard
                    iconName="key"
                    label="Password security"
                    value="Identity owned"
                    variant="info"
                />
                <SummaryCard
                    iconName="passkey"
                    label="MFA and passkeys"
                    value="Needs backend"
                    variant="warning"
                />
            </div>

            <Card>
                <Section
                    title="Signed-in account"
                    description="Session identity is read from the centralized merchant session contract."
                    action={<Badge label="Read-only" variant="info" className="self-start" />}
                >
                    <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                        <Input
                            label="Account email"
                            value={user.email}
                            helperText="Merchant account email is owned by the Identity Platform."
                            disabled
                        />
                        <Input
                            label="Full name"
                            value={displayName}
                            helperText="Profile details are not editable from this security pane."
                            disabled
                        />
                        <Input
                            label="Store access"
                            value={storeData.name}
                            helperText="Store ownership is enforced server-side before this pane renders."
                            disabled
                        />
                        <Input
                            label="Session type"
                            value="HTTP-only merchant session"
                            helperText="The merchant app validates the centralized session cookie server-side."
                            disabled
                        />
                    </div>
                </Section>
            </Card>

            <Card>
                <Section
                    title="Authentication controls"
                    description="Identity-owned flows are separated from backend-needed merchant security controls."
                    action={<Badge label="Mixed readiness" variant="warning" className="self-start" />}
                >
                    <div className="grid gap-[var(--lb-space-3)]">
                        {authenticationControls.map((control) => (
                            <SecurityControlRow key={control.title} {...control} />
                        ))}
                    </div>
                </Section>
            </Card>

            <Card>
                <Section
                    title="Session and risk monitoring"
                    description="Operational security visibility needs dedicated session inventory and audit endpoints before it can be editable."
                    action={<Badge label="Needs backend" variant="warning" className="self-start" />}
                >
                    <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                        {monitoringNeeds.map((need) => (
                            <div key={need} className="flex items-start gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-dashed border-[var(--lb-color-border)] bg-[var(--lb-color-surface-muted)] p-[var(--lb-space-4)]">
                                <MaterialIcon name="pending" className="mt-[2px] h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[color:var(--lb-color-warning)]" />
                                <div>
                                    <p className="m-0 font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">{need}</p>
                                    <p className="m-0 mt-[var(--lb-space-1)] text-[length:var(--lb-font-size-body-sm)] leading-[var(--lb-line-height-body-sm)] text-[color:var(--lb-color-text-subdued)]">
                                        Backend contract required before this control can be managed here.
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Section>
            </Card>

            <Banner variant="warning" title="Backend contract required">
                Merchant 2FA, passkey enrollment, recovery codes, active-session inventory, and login audit history need dedicated auth/security endpoints. Until those exist, this pane exposes the current centralized session and marks advanced controls as backend-needed.
            </Banner>
        </SettingsPane>
    )
}
