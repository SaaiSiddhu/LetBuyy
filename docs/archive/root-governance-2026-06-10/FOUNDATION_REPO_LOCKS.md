# FOUNDATION_REPO_LOCKS

> **Read before touching anything.** These paths/objects are FROZEN for the foundation step-up. Codex may **consume, import, and wire** them; it may **not** modify, refactor, rename, move, or re-implement them. Editing a frozen target requires an explicit `FROZEN-OVERRIDE: <human-name>` commit trailer; absent that, **STOP and write a BLOCKED report** — do not edit. A pre-commit `gate` (Wave 0) fails any commit that modifies a locked path without the trailer.
>
> FREEZE means *behavior is immutable*. New migrations may **add** schema; they may **never alter the semantics of, drop, or replace** a frozen object. Shipped migrations are forward-only and are never edited regardless.

## LOCKED PATHS — DO NOT MODIFY

### Money / ledger kernel (immutable)
- `database/supabase/migrations/139_executable_foundation_ledger_core.sql` — and specifically these objects must keep their exact semantics:
  - functions: `post_ledger_transaction`, `enforce_ledger_transaction_balance`, `reject_ledger_mutation`, `ensure_ledger_account`, `ledger_balance_breaks`, `current_site_id`, `set_current_site_id`
  - triggers: `ledger_entries_balance_enforced`, `ledger_entries_reject_update`, `ledger_entries_reject_delete`, `ledger_transactions_reject_update`, `ledger_transactions_reject_delete`
- `database/supabase/migrations/141_executable_inventory_reservations.sql` — inventory `SELECT … FOR UPDATE` + SKIP LOCKED reservation logic.
- `database/supabase/migrations/147_executable_order_state_risk.sql` — order state machine.
> Money work (Wave 1) **uses** `post_ledger_transaction` and posts new entries; it must not alter the kernel functions/triggers above. Capture→ledger, refund→ledger, payout safety are new *callers/migrations*, not edits to `139/141/147`.

### Theme model (immutable shape)
- `packages/theme-engine/src/theme-registry.ts` — the `SectionSchema` / `blocks_schema` section/block model. (Wave 6 adds renderer↔registry validation + a schema-migration runner *around* it; it does not change the model shape.)

### Design token source (immutable source of truth)
- `packages/typescript/ui/src/tokens.ts` — the four-layer token source. (Wave 5 *enforces* it and may **add** semantic tokens with an override; it does not fork or replace it.)

### Auth primitives (immutable security guarantees)
- `apps/identity-platform/src/lib/auth/cookies.ts` — the SEC-H3 weak-key refusal + signed httpOnly cookie handling.
- `apps/identity-platform/src/app/api/auth/switch/route.ts` — the device-proof account-switch fix.
- In `packages/auth-core` and `services/api-gateway`: the **bcrypt-12 password hashing**, **AES-GCM TOTP construction**, and **opaque server-revocable session** mechanisms. (Wave 4 *isolates the internal secret* and *adds* idle/rotation/revocation around sessions; it must not weaken these primitives.)

### Structural invariants (immutable rules, not files)
- **Package boundaries:** no `apps/*` imports another app; no `packages/*` imports an app; no `createClient(` in any app `src/`. The acyclic graph (`validate:dependencies`) must stay green.
- **Cross-realm cookie isolation:** storefront customer cookies stay host-only; platform cookies never leak a customer realm and vice-versa. Never set a parent-domain attribute on a storefront cookie.
- **Regulatory decision:** "LetBuyy never custodies money — the licensed PA disburses." No code path may make LetBuyy a money custodian.

## RULE OF ENGAGEMENT
1. If a wave *seems* to require editing a locked target → **STOP**, write a `BLOCKED` entry (status + ledger), and propose the change for human review with a `FROZEN-OVERRIDE` decision. Do not proceed by editing.
2. New migrations **add**; they never edit a shipped migration or alter a frozen object.
3. The pre-commit frozen-path gate is itself locked — do not weaken it.
4. When in doubt, treat the path as locked.
