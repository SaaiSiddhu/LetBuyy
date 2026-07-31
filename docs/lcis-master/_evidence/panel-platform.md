# Platform/IDP Panel Review — LCIS Phase 9

**Reviewer role:** Principal Platform Architect  
**Date:** 2026-06-20  
**Scope:** `apps/lcis` canonical runtime proposal; catalog/entity backbone; CIP deferral; governance relationship; deployment topology

---

## 1. AGREE (and why)

**Catalog-first is the correct backbone.** Every proven internal developer platform — Backstage, Datadog Service Catalog, New Relic Entity Explorer — converges on a typed entity graph as the spine. LCIS's proposed Domain→Service→Operation→Table→Worker→Policy hierarchy directly mirrors that pattern. The existing structural assets (417 tables, 156 RPCs, 651 policies, 22 domains, 116 migrations) are already a catalog in artifact form; naming it explicitly and making it the primary navigation surface is the right abstraction.

**Deferring CIP is correct.** The evidence is dispositive: Papaa does not exist as a repository, a customer, or a shipped product. It exists as a blueprint written in future tense (`reports/papaa-intelligence-blueprint.md`). Extracting `@cip/core` for a hypothetical second product while LCIS itself has zero production presence would be building a platform for the platform — textbook premature generalization. Deferring until a real second product exists and then extracting via refactor (not rewrite) is the correct call.

**One deployment, not per-app embedding.** LCIS is platform intelligence that describes the whole topology. Per-app embedding would create a distributed version-management problem that mirrors the 13-layer accretion disease LCIS already has. One deployment is structurally sound.

**Subtraction doctrine.** 202→32 capabilities is the right direction. The pathology of accretion is well-evidenced; "remove/merge as the default action" is a genuine architectural discipline, not just housekeeping.

---

## 2. CHALLENGE (risky, with evidence)

### Sharpest challenge: `apps/lcis` in the canonical runtime map is an aspirational claim that creates real governance pressure before it is earned.

**The evidence:**
- LCIS today is a local dev tool with zero production presence. `tools/` is absent from `pnpm-workspace.yaml`. Neither runtime has a `vercel.json` or `wrangler.toml`. `graph:ui` runs `node tools/graph-server/server.mjs` — a plain local Node.js process. (`LCIS_REPOSITORY_ARCHAEOLOGY.md` §7, confirmed.)
- The canonical runtime map is governed by the Constitution + `validate-governance.mjs` (108 validators). Adding `apps/lcis` to the map without a `vercel.json`, a turbo pipeline entry, CI build coverage, RBAC, and at least one wired live adapter is adding a **name** to the topology without adding a **reality**. This is exactly the pattern that created 117 self-certified endpoints and 12 version names — the system's own diagnosed pathology.
- The proposal itself acknowledges: "LCIS is 100% a local dev tool with zero production presence" and "Stand up `apps/lcis` v1" is the MVP deliverable. The canonical runtime map should reflect what is **deployed**, not what is intended. Adding `apps/lcis` now conflates intent with reality.

**Concrete risk:** the governance validator currently treats entries in the canonical map as authoritative topology. If `apps/lcis` is declared canonical but has no `vercel.json`, no build script, no CI coverage, and no access control, the validator gate either must be weakened (bad) or the declaration is a lie the validator cannot catch (bad). Either outcome degrades the one thing LCIS is supposed to protect: architectural truth.

### Secondary challenge: The catalog entity model assumes a stable schema that does not exist yet.

The catalog proposes a typed entity type per node (Domain, Service, Operation/RPC, Table, Worker, Policy). But the 202→32 consolidation has not happened. Until consolidation is complete, the catalog will be built over a contradictory, duplicated source. Building the IA surface before the engine is consolidated inverts the dependency.

### Third challenge: RBAC for `apps/lcis` is underdeveloped for an internal tool that exposes security posture and tenant-scoped operational data.

The IA proposes Viewer/Operator/Support/Admin roles (`LCIS_INFORMATION_ARCHITECTURE.md` §5), but the identity mechanism is unspecified. `apps/lcis` would be a fifth Vercel app using the identity-platform issuer (ES256, JWKS). The LCIS entity model does not connect to the existing `verifySiteOwnership` / `LETBUYY_IDENTITY_PUBLIC_JWKS` auth stack. For a surface that exposes "security posture" and "attack surface" views (labeled Operator+), this gap is a launch blocker, not a detail.

---

## 3. MISSING

1. **A deployment gate before canonical map entry.** No criterion is specified for what must be true before `apps/lcis` is added to the runtime map. Suggested gate: `vercel.json` present, build passing in turbo pipeline, at least one live adapter wired (Supabase read-only), RBAC using the platform identity issuer, and the 202→32 consolidation complete. Without this gate, the declaration is premature.

2. **Auth/identity integration design.** How does `apps/lcis` authenticate its users against the existing ES256 / JWKS identity stack? The RBAC section names roles but is silent on the identity provider, token flow, and how "Operator" role is conferred. This is not a UI detail; it is a security architecture gap on a surface that shows RLS policies and attack surface maps.

3. **The governance validator relationship is advisory-only but the boundary is not enforced.** The document correctly states "governance is supreme; intelligence is advisory" but does not specify how LCIS's catalog and the validator gate stay synchronized when they diverge. When LCIS's domain map says "22 domains" and the validator says differently, who wins and how is the conflict surfaced? A synchronization protocol is needed, not just a policy statement.

4. **Change-event correlation design is claimed but not specified.** Decision 3 calls change-event correlation "the most credible AIOps move LCIS can make before full telemetry." This is correct. But the mechanism — correlating git-tracked deploys + migrations with risk signals — has no data model or implementation sketch. It is the highest-value near-term capability and deserves a design, not just a roadmap mention.

5. **The `tools/` → `apps/lcis` migration path is absent.** The 80+ `.mjs` files in `tools/graph-server/` and 30+ in `tools/central-intelligence/` must become a real workspace package under `apps/lcis`. The consolidation and migration sequence (what moves, what is archived, what becomes an npm package) is not specified. Without it, the "one engine" goal risks becoming a third runtime alongside the two that already exist.

---

## 4. Top 3–5 Recommendations

### Rec 1 (Highest priority): Define and enforce the canonical map entry gate before declaring `apps/lcis` canonical.

Add `apps/lcis` to the **reserved** section of the runtime map (not the active section) with an explicit promotion checklist:
- [ ] `apps/lcis/vercel.json` present, region `bom1`
- [ ] `apps/lcis` declared in `pnpm-workspace.yaml` and turbo pipeline
- [ ] 202→32 consolidation complete; single engine artifact
- [ ] Supabase read-only adapter wired and returning real values (not NOT CONNECTED)
- [ ] Auth via existing ES256 JWKS with platform roles mapped
- [ ] `validate-governance.mjs` covers `apps/lcis` in its topology checks

Only on all-green does `apps/lcis` move to the active runtime map. This preserves the honesty contract at the architecture level, not just the data level.

### Rec 2: Engine-first, surface-second — complete 202→32 before building any `apps/lcis` UI.

The catalog surface is only as good as the engine beneath it. Building the 8-surface IA on top of 202 contradictory, duplicated engine files produces a catalog of duplicated facts. The correct sequence: (1) execute the documented merges and archive the 155 artifacts, (2) define the typed entity schema (Domain/Service/Operation/Table/Worker/Policy) against the consolidated engine, (3) wire the Supabase read-only adapter, (4) then build the `apps/lcis` UI over that stable, tested foundation. Inverting this sequence risks building a beautiful catalog over a broken engine — the V11 experience pattern.

### Rec 3: Specify the auth integration design before any RBAC UI is built.

`apps/lcis` must authenticate via the existing identity-platform issuer (ES256, JWKS endpoint). The Support role's tenant-scoped lookups must go through a `verifySiteOwnership`-equivalent check. Specify: which JWT claims carry the LCIS role, how roles are conferred (admin panel in `platform-console`? seeded? migration?), and how the Support role's `site_id` scope is enforced at the query layer. This design should live in the LCIS architecture doc before any auth code is written.

### Rec 4: Formalize the governance synchronization protocol.

LCIS's catalog and the 108-validator gate both model the platform topology. When they diverge, there must be a defined winner and a surfacing mechanism. Proposed protocol: (1) the validator gate is always authoritative on what is legal/real; (2) LCIS's catalog rebuild is triggered by the same CI event that runs the validator (merge to main); (3) LCIS's catalog includes a "validator agreement" flag per entity — entities the catalog knows about but the validator does not flag as a discovery candidate, not a truth claim. This prevents the two systems from silently drifting apart.

### Rec 5: Write the `tools/` → `apps/lcis` migration sequence as a concrete work breakdown.

The path from two local dev tool directories (80+ unpackaged `.mjs` files + a non-workspace `package.json`) to a real Next.js workspace app with a clean engine boundary needs an explicit migration plan: what is extracted into a `packages/lcis-engine` library (the deterministic core), what becomes `apps/lcis` routes/UI, what is archived, and what is the final workspace declaration. Without this, the "one engine" goal is a statement, not a plan.

---

## Summary verdict

The strategic direction is sound: catalog-first backbone, CIP deferral, engine consolidation, one deployment. The sharpest challenge is that adding `apps/lcis` to the canonical runtime map before the prerequisites exist (workspace membership, build pipeline, auth integration, at least one live adapter) repeats the self-certification pathology at the architecture declaration level. The fix is to gate promotion to the active runtime map behind verifiable criteria, keep `apps/lcis` in the reserved section until those criteria are met, and sequence engine consolidation before UI surface work. The governance synchronization protocol and auth integration design are the two hardest missing pieces and should be specified before any implementation starts.
