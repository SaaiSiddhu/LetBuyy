import { BackendNeededPane } from '@/components/settings/BackendNeededPane'

interface SecuritySettingsPageProps {
    params: Promise<{ store: string }>
}

export default async function SecuritySettingsPage({ params }: SecuritySettingsPageProps) {
    const { store } = await params

    return (
        <BackendNeededPane
            store={store}
            title="Security"
            description="Prepare stronger merchant account protections for staff and owner access."
            requirement="[SKIP - NEEDS BACKEND: merchant 2FA/passkey/recovery-code endpoints]"
            details={[
                'Required read endpoint: `GET /api/stores/:store/security` or `GET /v1/auth/custom/security?store_id=:id` returning 2FA status, passkey count, recovery-code status, and recent security events.',
                'Required mutation endpoints: `POST /api/stores/:store/security/2fa/setup`, `POST /api/stores/:store/security/2fa/verify`, `POST /api/stores/:store/security/recovery-codes`, and passkey registration endpoints.',
                'Auth core includes MFA claims, but no merchant-facing 2FA setup, passkey, or recovery-code route was found.',
            ]}
        />
    )
}
