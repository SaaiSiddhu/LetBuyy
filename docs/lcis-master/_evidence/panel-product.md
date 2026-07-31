# Product Panel Review — LCIS Phase 9

**Reviewer:** Principal Product Architect (skeptic lens; corpus self-certified)
**Date:** 2026-06-20

---

## 1. AGREE + why

The subtraction thesis is correct. 202→32 capabilities, one engine, retiring version-names, catalog as spine — these are the right product instincts. The honesty contract (NOT CONNECTED + source, never fabricated) is a genuine moat that no internal tooling competitor has executed cleanly. Personas-as-saved-views instead of walled modes is right; the V11 five-modes sprawl was the prior pathology. The Linear-doctrine call (opinionated, <50ms, plain names) is the correct operating culture for a tool that will live or die by daily habit.

---

## 2. CHALLENGE + evidence

**The sharpest challenge: there is no primary user with a felt, daily pain.**

Eight surfaces spanning five personas means the proposal has not answered the foundational product question: whose problem are we solving TODAY, badly enough that they would open LCIS before anything else? The corpus is honest that LCIS has zero deployed presence and zero daily users (`LCIS_REPOSITORY_ARCHAEOLOGY.md`). With no usage data, 8 surfaces + 5 personas is a supply-side architecture — designed from capability inventory, not from observed demand. This is exactly how the prior accretion happened (each "layer" solved a hypothetical persona's hypothetical need).

Specific evidence:
- The "Support" persona requires live Supabase data, which is NOT CONNECTED. It is a persona with no viable surface today.
- "Security & Tenancy" and "Readiness" overlap at their primary question ("what's the risk, what to fix"). Two surfaces competing for the same top-of-mind query is a navigation tax, not clarity.
- "Live & Connections" is critical for trust but is almost entirely empty at MVP (0/7 adapters connected). Surfacing emptiness as a primary nav item trains users to expect nothing — the opposite of adoption.
- The ONE thing that makes LCIS indispensable is not covered by any single surface: an engineer asks "what breaks if I change X?" before every PR. That is the highest-frequency, highest-pain, currently-zero-tool-solves-it job. Change Safety is surface #3, not the default home.

---

## 3. MISSING

1. **Adoption hook.** No answer to: how does the first engineer's first session end with a habit formed? Without a forcing function (CI gate that links to LCIS blast-radius, IDE extension, PR comment bot), the app is opened once and forgotten. Every successful internal tool (Linear, Datadog) had a workflow hook, not just a UI.
2. **Success metric.** What does "LCIS is indispensable" look like in measurable terms at 30 days post-ship? DAU? PR-blast-radius queries/week? Zero data is being collected to answer this.
3. **Time-to-first-answer.** The docs spec <50ms UI interactions but say nothing about the journey from "engineer hears about LCIS" to "engineer gets a useful answer." If that journey requires reading a 94-line experience-architecture doc, adoption fails.

---

## 4. Recommendations (top 5)

**R1 — Sharper MVP: one surface, one persona, one workflow.** MVP = Change Safety only, for the on-PR engineer. Not 8 surfaces. One page: type a symbol or file → blast radius + ownership + related RLS/money flags, all cited. Ship it as a `pnpm lcis blast <symbol>` CLI AND a `apps/lcis` single-page URL (`/blast`). Everything else is phase 2.

**R2 — Force the adoption hook before the UI.** Wire LCIS blast-radius output into the CI PR check (a comment or annotation) BEFORE building the full app. This is the forcing function that makes engineers discover the tool organically instead of through evangelism.

**R3 — Cut "Live & Connections" from MVP nav.** With 0/7 adapters connected it is a honesty display of emptiness. It belongs in System/Settings at MVP, promoted to primary nav only when 2+ adapters are live. Showing it prominently now makes the product feel broken.

**R4 — Merge Readiness into Home.** The "are we ready to launch?" answer is a once-a-sprint question for founders. It does not warrant a dedicated primary nav item at MVP. Home dashboard with a Readiness card is sufficient; promote to its own surface when founders are daily users.

**R5 — Instrument before you expand.** Before adding surface #2 beyond Change Safety, instrument: queries/day, which blast-radius queries are run, which answers are cited in PRs. Build surface #2 from that signal, not from the capability inventory.

---

## Crisper MVP + path

**MVP (v1):** `apps/lcis` = one surface — Change Safety (`/blast`). CLI: `pnpm lcis blast <symbol>`. CI: PR comment with blast radius on every merge touching a high-criticality file. No Home dashboard, no Live & Connections, no Security surface. Catalog is the browse layer behind Change Safety (click a node from blast output → entity detail). ⌘K navigates within blast results only.

**Path:** (1) Ship blast-radius CLI + CI hook → (2) Ship `apps/lcis/blast` page → (3) Instrument 30 days → (4) Add Catalog browse based on what engineers actually searched → (5) Wire Supabase adapter → unlock Live + Support persona → (6) Add Home/Readiness when founders are daily users.

The "intelligence OS for the ecosystem" is a coherent 3-year destination. It is not an MVP. The risk is building the OS before proving anyone needs the first room.

---

*Filed by the product panel, Phase 9. Not a blocker; advisory to the master architecture synthesis.*
