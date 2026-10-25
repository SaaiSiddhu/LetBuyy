# Furniture capability tradeoff — accepted bounded extension

Root reviewed this comparison and Habitat's dimensional requirements, then accepted the finite same-RPC extension for390. Current drafts now require `equipment_length`, `max_width_cm` and `max_depth_cm` as three strict children whenever the optional `measurement_capabilities` object is present. There are no optional child leaves or alternate furniture nesting aliases in the accepted contract.

The selected option reuses the existing canonical query keys, normalized assembled-axis witnesses, fully matched candidate cohort, reader/projection path and catalog-conservation qualification. It adds two independent `{available:boolean}` leaves, not numeric facets, unit counts, ranges, joint-fit claims or another query system. Source unit/operator strings would repeat information already fixed by the canonical cm-threshold queries and are omitted.

Each axis needs its own positive normalized assembled in-stock fully matched witness before pagination and a representable threshold within1000000cm. Width/depth may have different witnesses when no thresholds are active; once both thresholds are active, existing matching must still find the same variant satisfying both and every other predicate. Atomic whole-group inheritance, missing-axis uncertainty and all existing predicates stay unchanged.

The cost of including the two axes is additional strict all-three metadata admission, Habitat per-axis projection/recovery and qualification cases. The benefit is one shared bounded follow-up rather than a second migration solely for the analogous confirmed gap. Root accepted that tradeoff before SQL qualification. The equipment-only revision and its hashes/evidence are preserved under `revisions/01-equipment-only/`.

This acceptance expands **documentation drafts/specifications only**. No migration was applied, no runtime/source changed, and no database/build/browser/cleanup lane started. The active README, source evidence and paired drafts are the review artifacts; source promotion and owned-PG qualification still require root allocation.
