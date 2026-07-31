# 05 — Automation UI

**Status: blueprint (gated behind `03`'s schema migration).** Not built — a rule-builder over non-existent `automation_rules` would be dead UI.

## Spec (after the automation schema migration)
- **Rule list** — active/inactive rules with trigger + action summary → `automations.rules.list`.
- **Rule builder** — trigger picker (the 6 triggers from the built evaluator) + **condition builder** (field/op/value rows + all|any — identical UX to the smart-collection rule builder already shipped) + **action builder** (send_notification/add_tag/webhook).
- **Execution logs** — `automation_executions` rows (rule, event, status, result) → `automations.executions.list`.

## Reuse
The condition-builder UI is the same pattern as the **shipped** smart-collections rule builder (`phase-5-final/01`). The trigger/condition/action vocabulary is exactly what the built `automation-rule-eval` core implements — so the UI + the engine agree by construction.

**Verdict:** blueprinted to reuse the shipped smart-collection rule-builder UX + the built evaluator vocab; build post-migration with visual verification.
