# App Marketplace Review Queue Runbook

Owner: App Marketplace review operations, with gateway routes owning review mutations.

1. Open the review queue and filter by app, developer, automated-check status, fraud flags, abuse reports, and submission version.
2. Confirm the app has an approved developer, valid manifest, valid OAuth redirect URLs, privacy URL, data-handling disclosure, support SLA, pricing plan, and at least one real screenshot.
3. Review static security scan results before human review. Hard failures block approval until the developer submits a corrected version.
4. For app reviews from merchants, verify the stored active installation proof and review proof row before marking a review verified.
5. For reported reviews or listings, record the moderation decision and keep the report row linked to the decision; do not delete evidence rows during triage.
6. For developer replies, ensure replies address the review content and do not expose merchant private data, credentials, or support tickets.
7. Publish, reject, or keep flagged only through the gateway moderation endpoint so activity events and audit metadata remain consistent.
