import { Banner, Card, Section } from '@letbuyy/ui'

// Phase N3: staff self-service invite activation is retired -- the gateway
// endpoint this page's form used to call (POST /employees/auth/accept-invite)
// never had a working completion path (see the Phase N3 report) and is now
// removed entirely. This page stays reachable (old invite emails/bookmarks
// may still point here) but renders an explicit unavailable state rather
// than attempting a call that would fail -- ANTI-R9: a stub must never read
// as success, and a removed capability must not look like a transient error.
export default function AcceptInvitePage() {
    return (
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-[var(--lb-space-5)] p-[var(--lb-space-5)]">
            <div className="flex flex-col gap-[var(--lb-space-2)] text-center">
                <span className="text-[var(--lb-font-size-lg)] font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">
                    Staff invite activation is unavailable
                </span>
            </div>
            <Card>
                <Section title="Contact your store owner">
                    <Banner title="Self-service activation is not available" variant="critical">
                        This invite link no longer works. Ask the store owner to add you as staff directly
                        from their Settings &rarr; Staff page instead of sending an email invite.
                    </Banner>
                </Section>
            </Card>
        </div>
    )
}
