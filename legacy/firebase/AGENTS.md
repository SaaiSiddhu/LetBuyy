# Firebase Legacy Governance

Purpose: Historical Firebase configuration, rules, scripts, and Cloud Functions retained for migration reference only.

Boundary: `legacy/firebase`.

Status: Deprecated. This tree is not an active runtime and must not be imported by apps, services, or shared packages.

Rules:

- Do not add new production behavior here.
- Do not import this tree from active runtime code.
- Migration notes may reference this tree, but active ownership must move to `services/*`, `database/supabase/*`, or `infrastructure/*`.
- Secrets and local Firebase credentials must remain untracked.

