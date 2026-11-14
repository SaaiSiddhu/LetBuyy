# Console Burgundy & Porcelain — 22 October 2026

The owner approved **E — Burgundy & Porcelain** after reviewing colour samples. This supersedes the graphite/teal direction for the canonical Console. Light mode uses the approved porcelain canvas `#F6F2F3`, wine sidebar `#44232E`, white cards, `#30232B` text and `#8D3F56` actions. Dark mode uses complementary wine and warm neutral layers.

## Implementation

The existing shared `operations` surface owns the palette in `packages/typescript/ui/src/tokens.ts`; its burgundy/porcelain primitives are projected into the DTCG interchange file. Console composition uses sidebar tokens for brand, footer, mobile drawer, headings and search. Shared cards, tables, forms, actions, focus and empty-state illustrations inherit the approved identity. Semantic warning, success and danger colours remain meaningful. Operations solid success/warning fills now use deeper existing green/amber primitives for readable white copy; default solid badges use the burgundy action fill in both themes. No framework upgrade, domain workflow, money rule, permission or schema changes were needed.

The focus shade was tested on porcelain, white and selected wine navigation. Both themes retain readable primary action states and differentiated dark layers. The existing finder, saved theme, pagination, merchant controls and recovery paths remain connected.

## Verification

- Shared UI **52/52**, Console **46/46**, affected types, scoped ESLint and CSS stylelint pass. Final Console production build exits **0** in a separate environment-free source copy.
- Owned browser **49585b5a13ab passes 2/2**: all 20 enabled index pages, four populated details, two frozen-page refusals, pagination, failed-form draft retention, and the visual/keyboard journey. After the final empty-state and solid-status colour mappings, **8f32681027d2 passes 1/1**, repeating theme/reload, finder/account/navigation recovery, shared table surface matching, merchant checklist/catalog pagination, restricted/unavailable states, 1440/390/320px layouts and shared empty states in both themes.
- Final browser text samples: **554 observations**, minimum **4.5078:1**. This is a bounded computed-colour check, not full WCAG or assistive-technology certification. Actual overview, mobile navigation, merchant workspace, table and empty-state screenshots were inspected.
- DTCG parity, public API/protected token-variable snapshots and the design-system ratchet pass. No guard, snapshot or baseline was weakened. The token-alias validator remains red with **18 pre-existing findings**, reproduced byte-identically before/after.
- An intermediate final check targeted an unused subscription empty-state heading. Its failed receipt is retained; the test now uses the active audit table with a no-match search and requires its real empty heading. The next run exposed a real inherited white-on-amber warning contrast failure (3.1858:1). The operations solid status mappings were corrected and their text contrast is now tested. Both failed receipts remain recorded; no application behavior or threshold was weakened.
- Both successful runners record verified cleanup with no remaining owned containers, networks or volumes. Final browser and build runtime sources match the delivered source, excluding generated `next-env.d.ts`.

## Delivery and limits

Source is uncommitted on `develop` at `118209b4fde1b5a15313f4741bcac454690d15c8`. The task began with 175 changed/untracked files; five intended runtime/test files changed and the other 170 were preserved. Ledger/programme continuity and this evidence were then added. Browser data is disposable and synthetic; screenshots show honest unavailable/empty states. No production browser, hosted deployment, real provider action, database migration, push or merge is claimed. Native mobile is outside this Console palette pass. Parent programme acceptance remains unchanged.

[Actual screenshots and runner receipts](../docs/evidence/console-burgundy-porcelain-2026-10-22/) · [structured verification](CONSOLE_BURGUNDY_PORCELAIN_2026-10-22.json). Full local logs/source fingerprints: `/private/tmp/letbuyy-console-burgundy-20261022/`.
