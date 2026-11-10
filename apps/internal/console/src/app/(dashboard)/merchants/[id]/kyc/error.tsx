'use client';

import { ConsoleWorkspace, Panel } from '@/components/_local-ui/console-workspace';
import { Button } from '@letbuyy/ui';

export default function KycReviewError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ConsoleWorkspace eyebrow="Merchant operations" title="KYC evidence review"
        description="The current KYC review could not be loaded.">
        <Panel title="Review temporarily unavailable">
            <p role="alert" className="mt-0 text-sm">No hold or release was recorded by this page load.</p>
            <Button unstyled type="button" onClick={reset}
                className="rounded-md border border-[var(--lb-color-border)] px-4 py-2 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]">
                Retry review
            </Button>
        </Panel>
    </ConsoleWorkspace>;
}
