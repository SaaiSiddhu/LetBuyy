import Link from 'next/link'
import type { StorePaymentConfig, StorePaymentSetup } from '@letbuyy/shared-types'
import { Badge, Banner, Card, ProviderModeBadge, Radio, Section } from '@letbuyy/ui'

const reasons: Record<StorePaymentSetup['blocking_reasons'][number], string> = {
    schema_unavailable: 'Payment configuration is temporarily unavailable.',
    credentials_missing: 'Connect your Razorpay test account to try online checkout.',
    credentials_unverified: 'The saved credentials have not been verified.',
    credentials_unusable: 'The saved credentials could not be read. Reconnect your test account.',
    account_model_unresolved: 'Reconnect your own account to confirm the payment connection.',
    live_checkout_not_qualified: 'Live payments require provider onboarding and settlement qualification.',
}

export function PaymentSetupOverview({ config, store }: { config: StorePaymentConfig & { setup: StorePaymentSetup }; store: string }) {
    const setup = config.setup
    return <>
        <Card>
            <Section title="Choose how you accept payments" description="Use one online payment connection for your store. Cash on delivery is managed separately.">
                <fieldset className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                    <legend className="sr-only">Online payment connection</legend>
                    <Radio name="payment-connection" value="own_account" checked readOnly
                        label="Your Razorpay account"
                        description="Connect your merchant account. Razorpay handles settlement to your verified bank account when live payments are qualified."
                        className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-primary)] bg-[var(--lb-color-primary-soft)] p-[var(--lb-space-4)]" />
                    <Radio name="payment-connection" value="letbuyy_payments" disabled
                        label="LetBuyy Payments, powered by Razorpay"
                        description="Available after provider approval. Merchant onboarding and bank verification must be confirmed before activation."
                        helperText="Not yet available"
                        className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] p-[var(--lb-space-4)]" />
                </fieldset>
            </Section>
        </Card>
        <Card>
            <Section title="Connection readiness" action={setup.environment ? <ProviderModeBadge mode={setup.environment} /> : <Badge label="Not configured" variant="default" />}>
                <dl className="grid gap-[var(--lb-space-4)] md:grid-cols-3">
                    <div><dt className="text-[var(--lb-color-text-subdued)]">Saved key reference</dt><dd className="font-[var(--lb-font-weight-semibold)]">{config.payment_settings.razorpay?.key_id || 'Not connected'}</dd></div>
                    <div><dt className="text-[var(--lb-color-text-subdued)]">Business verification</dt><dd>Not confirmed</dd></div>
                    <div><dt className="text-[var(--lb-color-text-subdued)]">Bank verification</dt><dd>Not confirmed</dd></div>
                </dl>
                {setup.blocking_reasons.length > 0 && <ul className="list-disc space-y-[var(--lb-space-2)] pl-[var(--lb-space-4)]">
                    {setup.blocking_reasons.map(reason => <li key={reason}>{reasons[reason]}</li>)}
                </ul>}
                {setup.environment === 'sandbox' && <Banner variant="info" title="Test payments do not settle to a bank account">
                    Test credentials can validate checkout. They do not establish business approval or create real bank settlements.
                </Banner>}
                <div className="flex flex-wrap gap-[var(--lb-space-4)]">
                    <Link className="text-[var(--lb-color-primary)] underline" href={`/${encodeURIComponent(store)}/settings/business`}>Review business details</Link>
                    <Link className="text-[var(--lb-color-primary)] underline" href={`/${encodeURIComponent(store)}/payouts`}>View payouts and settlements</Link>
                </div>
            </Section>
        </Card>
    </>
}
