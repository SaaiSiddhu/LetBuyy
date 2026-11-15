import { ConsoleWorkspace, Panel } from '@/components/_local-ui/console-workspace';

export default function KycReviewLoading() {
    return <ConsoleWorkspace eyebrow="Merchant operations" title="KYC evidence review"
        description="Loading the current document and legal-hold state.">
        <Panel title="Reviewing private evidence">
            <div role="status" aria-live="polite" className="grid gap-3">
                <span>Loading current KYC evidence…</span>
                <span aria-hidden="true" className="h-4 w-2/3 rounded-[var(--lb-radius-md)] bg-[var(--lb-color-surface-subdued)]" />
                <span aria-hidden="true" className="h-4 w-1/2 rounded-[var(--lb-radius-md)] bg-[var(--lb-color-surface-subdued)]" />
            </div>
        </Panel>
    </ConsoleWorkspace>;
}
