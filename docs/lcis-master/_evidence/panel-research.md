# Panel Research — Research-Rigor Audit (Phase 9)

**Role:** Principal Research Lead, independent skeptic  
**Date:** 2026-06-20  
**Scope:** Rigor critique of Phase 1–6 deliverables; discovery only, no implementation changes.

---

## 1. What Is SOLID

- **32% standalone figure is honestly derived.** `inventory-central-intelligence.md §7` enumerates the 68 endpoints and explicitly produces the tiered table (32% / 66% / 81% / 93%). The figure is not extrapolated — it is a counted audit. The DUPLICATION_REPORT cites the exact source. This is the most rigorous quantitative claim in the corpus.
- **:3334 dependency direction is verified.** "40+ synchronous HTTP calls to :3333 per request" is stated in inventory-central-intelligence §8 finding #2 with a code-level note, not asserted. The one-way coupling is solid.
- **"Papaa does not exist" is correctly evidenced.** The archaeology report cites the blueprint document's own future tense; no `apps/papaa`, no external repo, no customer. The YAGNI verdict on CIP deferral is well-grounded.
- **Certification-quintet pattern is documentarily verified.** DOC-ARCH §1.3 walks the actual directory counts; the self-certification critique is structurally correct.
- **Honesty contract enforcement claim is code-level.** `live-adapters.mjs` code-enforced NOT CONNECTED labelling is cited in both inventory and FUTURE_MODEL. This is not asserted.

---

## 2. What Is Under-Evidenced / Needs Verification

### Gap A — The 32% figure is used unfairly as a condemnation
The inventory clearly shows :3334 reaches **66% functionality with V1 running and graphify-out populated** — the normal developer state. The DUPLICATION_REPORT leads with 32% (cold-start, no V1) as the primary characterisation, without surfacing the 66% figure in the verdict table. The "archive :3334" call is technically correct on balance, but the 32% framing is selecting the worst-case operating condition. Any serious reviewer would note: **in actual dev use, :3334 is 66% functional, not 32%.** The conclusion may still be right; the evidence as presented is unfair.

### Gap B — Competitive research is training-knowledge reconstruction
`LCIS_COMPETITIVE_RESEARCH.md §0` explicitly discloses WebSearch/WebFetch routing failures. Only `_evidence/competitive-ai-commerce.md` exists on disk; `_evidence/competitive-engineering-platforms.md` and `_evidence/competitive-observability.md` are cited repeatedly but **absent from the evidence directory** — they were "produced via sub-agents and are being compiled." Key conclusions (Linear sub-50ms as argument against :3334; PagerDuty change-event correlation; Sentry Seer fixability score) rest on these missing files. These are credible design lessons but they are not independently verifiable from the submitted corpus.

### Gap C — "No certification for :3334" treated as evidence of lower quality
The absence of a certification quintet for :3334 is used as evidence supporting archival. But the quintet was self-issued by the same team. Absence of self-certification is not evidence of lower quality; it may just reflect that the V2 team did not repeat the ritual. The archival verdict needs to stand on functional evidence (32%/66%, uninstalled deps) rather than the missing ritual, or the critique of self-certification is inconsistently applied.

### Gap D — "202→32" consolidation is not independently verified
The 32-capability count is the principal analyst's synthesis. The mapping table in DUPLICATION_REPORT §9 is coherent but no cross-check was done (e.g. confirming distinct endpoint routes, verifying the "5 capabilities from :3334 worth migrating" are actually not present in :3333 in any form).

### Gap E — Architecture-intelligence "pure filesystem" claim not spot-checked against :3333
DUPLICATION_REPORT §2.1 says architecture-intelligence has "no :3333 equivalent." The inventory confirms it's pure filesystem. But `inventory-graph-server.md` was not read in this audit to verify :3333 has no drift/layer/service-discovery module. If :3333 does have an overlapping module, the "migrate from :3334" verdict changes.

---

## 3. Missing Research

1. **Independent functional test.** No actual HTTP calls were made to either runtime during discovery. The 32%/66% table is based on code reading, not live observation. One cold-start test of :3334 with only graphify-out populated would confirm or refute the 66% figure.
2. **Cross-check of "5 novel :3334 capabilities" against :3333 source.** The claim that architecture-intelligence, SafetyGuard, verification, context-compression, and browser-validation have no :3333 equivalent is asserted based on inventory, not on a grep of :3333 source.
3. **`competitive-engineering-platforms.md` and `competitive-observability.md` were not produced.** These are the most consequential citations for the "Linear sub-50ms vs :3334 RAG" and "PagerDuty change-event" arguments. Before these drive irreversible decisions, the files should exist.
4. **Archival impact on the `.claude/commands/agent-*.md` slash commands.** All 14 agent slash commands are classified KEEP — but 12 of them query LCIS endpoints. If those endpoints are retired during consolidation, the agents silently degrade. No cross-dependency audit of slash-command → endpoint was done.

---

## 4. Top Recommendations to Harden Rigor

**R1 — Surface the 66% figure alongside 32% in all decision documents.**  
The cold-start 32% is the floor; 66% with V1+graphify is the realistic dev state. Any decision document that uses only the 32% figure to condemn :3334 should be corrected to avoid the appearance of motivated framing. The archival verdict may survive this correction, but it should rest on both numbers.

**R2 — Produce or mark the two missing competitive evidence files.**  
`_evidence/competitive-engineering-platforms.md` and `_evidence/competitive-observability.md` are cited as primary evidence for multiple strategic decisions. Before archiving 155 artifacts or deciding on the "defer CIP" path, these files must either be produced or all conclusions that cite them must be marked "evidence incomplete."

**R3 — Run one live functional test before any archival action.**  
Start :3334 with :3333 running and graphify-out populated. Count which of the 68 endpoints return real data. This takes under an hour and converts the inventory's code-read estimate into observed evidence. Irreversible archival of 155 artifacts should not proceed on a code-read estimate alone.

---

## Biggest Rigor Gap (≤100 words)

**The two competitive evidence files cited as primary support for three major decisions do not exist on disk.** The conclusions that rest on them — Linear sub-50ms as the decisive argument against :3334's round-trip latency; PagerDuty change-event correlation as the "near-term AIOps win"; Sentry Seer as the template for LCIS's execution model — are credible design lessons but are currently unverifiable from the submitted corpus. Combined with the 32%-vs-66% framing gap, this means the strongest arguments for "archive :3334" and "defer CIP" are built on honest-but-incomplete evidence. No irreversible action (archiving, module deletion) should proceed until R2 and R3 above are resolved.

---

*Panel finding: the structural analysis is rigorous; the competitive analysis evidence trail is incomplete. Resolve R1–R3 before any destructive action.*
