import {
    ConsoleWorkspace,
    ModuleCard,
    ModuleGrid,
    Panel,
    SkipBackendPanel,
} from '@/components/_local-ui/console-workspace';

export default function MarketplaceGovernancePage() {
    return (
        <ConsoleWorkspace
            eyebrow="Marketplace governance"
            title="Marketplace Governance"
            description="Leadership view for app and theme marketplace review readiness, partner risk, policy enforcement, and launch approvals."
        >
            <SkipBackendPanel title="Marketplace review queue for platform console" contract="/v1/internal/console/marketplace-reviews">
                The API gateway exposes `/v1/operations/marketplace-reviews` for authenticated operations reviewers, but the platform console token contract does not expose a console-owned review queue.
            </SkipBackendPanel>

            <ModuleGrid>
                <ModuleCard
                    href="/operations"
                    title="Reviewer Operations"
                    description="The employee operations portal owns marketplace review decisions through the existing operations client."
                    status="available elsewhere"
                    details="Employee portal contract: /v1/operations/marketplace-reviews"
                />
                <ModuleCard
                    href="/audit-logs"
                    title="Review Audit Trail"
                    description="Audit logs can show governance activity once review mutations write platform audit events."
                    status="partial"
                    details="Console contract: /v1/internal/console/audit-logs"
                />
                <ModuleCard
                    href="/trust-safety"
                    title="Policy Enforcement"
                    description="Security enforcement projections can support governance risk review once marketplace policy events are recorded."
                    status="partial"
                    details="Runtime contract: /v1/operations/runtime/overview"
                />
            </ModuleGrid>

            <Panel
                title="Governance Readiness Checklist"
                description="Visible now without inventing backend state."
            >
                <ul className="m-0 grid gap-[var(--lb-space-3)] p-0 text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                    <li className="list-none rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] p-[var(--lb-space-3)]">
                        Partner identity verification needs a console aggregate endpoint.
                    </li>
                    <li className="list-none rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] p-[var(--lb-space-3)]">
                        App/theme automated check summaries are currently scoped to operations review records.
                    </li>
                    <li className="list-none rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] p-[var(--lb-space-3)]">
                        Appeals, takedowns, and emergency disable flows need audited mutation endpoints before they can be interactive.
                    </li>
                </ul>
            </Panel>
        </ConsoleWorkspace>
    );
}
