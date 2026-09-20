# LIQUID V1 CERTIFICATION PACKET (L18)

**Date:** 2026-06-13 · **HEAD:** `77b681f1` · Repository truth. **This is the certification *dossier*, not a completion certificate** — `LIQUID_V1_CERTIFICATION.md` (the GREEN cert) can only be issued after L14–L17 actually pass. No evidence here is fabricated.

## Verdict
> **Liquid engine + render surface: COMPLETE and engine-verified end-to-end.**
> **Production activation (parity-on-staging → canary → flip → React deletion): GATED on deployment + ARB + a constitutional data decision.**

## Phase history (this program, all gate-green commits)
`35a2709b` LB-7 → `05f3adb6` L1 → `27a57510` L2 → `2ac56b61` L3 → `c76780e7` L4 → `ecbe7760` L5 → `b75feea3` L6 → `fd4aea57` L7 → `81c94b01` L8 → `702da62b` L9 → `0e76ac58` L10 → `f3e005ae` L11 → `f81d8c01` L12 → `50980f6b` L13 → `e2272492` L14-parity-record → `77b681f1` bundle-refresh(172).

## Evidence index
| Area | Evidence | Status |
|---|---|---|
| Validators | `node scripts/validate-governance.mjs --lane=gate` | ✅ **107/107** |
| Render tests (engine) | `packages/theme-engine/test/liquid-l*.test.ts` | ✅ **56/56** |
| Launch suite | `tests/launch/*.test.mjs` | ✅ **111/111** |
| Typecheck | `tsc -b packages/theme-engine` | ✅ **0** |
| Bundle persisted (full) | migration `172_liquid_bundle_refresh.sql` (12 templates) + rollback | ✅ |
| Engine parity | `PARITY_REPORT.md` | ✅ green |
| Cross-engine parity | `PARITY_EXECUTION_PACKET.md` | ⏳ pending-staging |
| Canary | `CANARY_EXECUTION_PACKET.md` | ⏳ pending-deploy |
| Flip | `ARB_FLIP_PACKET.md` | ⏳ pending-ARB |
| React removal | `REACT_DECOMMISSION_PACKET.md` + `REACT_DELETION_PLAN.md` | ⏳ pending-constitutional |
| Theme compiler | `liquid-l3-compiler.test.ts` (translator-only, schema-validated) | ✅ |
| Theme authoring | `liquid-l13-authoring.test.ts` (compile-on-publish + desync guard) | ✅ |

## Route coverage (every customer-facing route has a Liquid template)
index · product · collection · search · cart · customers/login · customers/register · customers/account · customers/orders · customers/order(+tracking) · chrome(header/footer). All render-tested; all persisted in the bundle (172).

## Known limitations
- Cross-engine visual/behavioral parity unproven until staging (engine structure/data/security ARE proven).
- Storefront integration (layout.tsx chrome swap, composition-engine drop population, islands, `?search=`, editor wiring) is structurally correct but not live-rendered in-sandbox; verified at L14/L15.
- Cacheable external stylesheet + `/assets` route deferred (CSS is inlined, sanitizer-safe).
- Search uses option-(a) client-filter; a real search endpoint is deferred.

## Open human/constitutional seams (in `EXECUTABLE_HUMAN_REQUIRED.md`)
- `HR-LB12-REGISTER` — shopper register backend (gates **L9 live** registration).
- `HR-LIQUID-PARITY-STAGING` — deployed staging for **L14**.
- `HR-LIQUID-CANARY-DEPLOY` — deployed canary env for **L15**.
- `HR-LIQUID-ARB-FLIP` — ARB sign-off for **L16** (validator-pinned).
- `HR-LIQUID-REACT-DECOMMISSION` — hardening-wave data decision for **L17** (ART-17).

## Foundation invariants — PRESERVED throughout
Money (canonical ledger / checkout origin), Identity (merchant ES256 / customer HS256), Tenancy (RLS), and the render-path security baseline (DOMPurify forbid-list + `outputEscape:'escape'`) were never touched or weakened; the platform flip stayed `deferred`; React storefront intact; production unaffected.

**To issue the GREEN `LIQUID_V1_CERTIFICATION.md`: close the four `HR-LIQUID-*` seams in order (parity → canary → flip → decommission), each producing its proof, then certify.**
