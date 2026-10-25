# Nine-theme collection/search accessibility review checklist

This checklist was applied read-only to the accepted immutable green-55-before390 checkpoint; results are in FINDINGS.md and findings.json. It complements the strict functional query oracle; it does not replace that oracle, installed lifecycle testing or browser/assistive-technology acceptance. All outputs belong to this directory. Accepted Playfield source and every other factory stay frozen during review.

## Input checkpoint

Before recording final findings, obtain Circuit/coordinator's final artifact checkpoint. Pin its report, oracle/input hashes, each of the 18 HTML hashes and the corresponding factory/discovery hashes. Check that the report describes the supplied HTML and frozen source. If those inputs change, retain the old report as a dated checkpoint and re-review the affected artifacts. Do not silently reuse earlier findings.

The initial report read at preparation start was the older `2026-10-23T08:51:01.211Z` checkpoint with obsolete Playfield source hashes. The later read-only preflight saw a newer `2026-10-23T09:16:56.428Z` report with 18/18 current source snapshots but eight functional findings remaining. Neither checkpoint is treated as the final accessibility review input. `input-readiness.json` records the latest preflight; final review still awaits the requested stable owner checkpoint.

The oracle saves `contentForLayout` HTML, so this review can examine multiple body forms together. It cannot establish uniqueness against an omitted header/footer or prove the assembled page's CSS, hydration, focus appearance or screen-reader output.

| Owner | Slug | Collection HTML | Search HTML | Final review |
|---|---|---|---|---|
| Playfield | letbuyy-bloom | playfield-collection.html | playfield-search.html | Reviewed; see coverage.json |
| Circuit | letbuyy-forge | circuit-collection.html | circuit-search.html | Reviewed; see coverage.json |
| Pantry | letbuyy-refresh | pantry-collection.html | pantry-search.html | Reviewed; see coverage.json |
| Habitat | letbuyy-craft | habitat-collection.html | habitat-search.html | Reviewed; see coverage.json |
| Kindred | letbuyy-summit | kindred-collection.html | kindred-search.html | Reviewed; see coverage.json |
| MadeYours | letbuyy-nova | madeyours-collection.html | madeyours-search.html | Reviewed; see coverage.json |
| Dewdrop | letbuyy-aura | dewdrop-collection.html | dewdrop-search.html | Reviewed; see coverage.json |
| Trailmark | letbuyy-ride | trailmark-collection.html | trailmark-search.html | Reviewed; see coverage.json |
| Marginalia | letbuyy-dawn | marginalia-collection.html | marginalia-search.html | Reviewed; see coverage.json |

## Checklist applied to every artifact

### A. Visible labels and accessible names

- Inventory all data-entry controls and action controls in every form, including the inherited search box. Exclude hidden query-preservation inputs from the visible-control inventory.
- Record persistent visible label/instruction text separately from the computed accessible name. A placeholder or an ARIA-only name does not establish visible instructions. Note intentionally screen-reader-only labels separately, with the actual visible purpose/context, instead of calling them an automatic failure.
- Check explicit `label[for]` targets, wrapped labels, `aria-labelledby` references and `aria-label` overrides. Referenced IDs must resolve to the intended control/text, not another form's instance.
- Check that names describe the action/quantity and include the visible wording. Include physical units in an associated label or description where needed; do not assume the current numeric value explains the measurement.
- Give repeated Remove/Clear actions enough field/value context. A named form/region can help distinguish otherwise repeated Search/Apply controls; absence of a form landmark name alone is not a blanket defect.

Visible instructions and programmatic names are separate checks. [W3C labels/instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html), [W3C label in name](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html).

### B. IDs and relationships across multiple forms

- Build one ID index for the entire artifact document, not one per form. Record duplicate IDs and each affected label/help/error reference.
- Resolve every `for`, `aria-labelledby`, `aria-describedby` and `aria-errormessage` target. Report missing, ambiguous or wrong-element targets with the referring and target selectors.
- Controls may use a valid wrapping label without an ID. Do not manufacture an ID requirement or report an unreferenced decorative duplicate as an automatic WCAG 2.2 failure; report its actual impact and the project uniqueness concern separately.
- Record that header/footer and independent hydration roots remain outside this artifact-only check.

### C. Checkbox/radio grouping

- Each choice needs an individual name; related options also need understandable group context. Prefer native `fieldset`/`legend`, or inspect an equivalent named group and its relationships.
- Evaluate radio grouping by actual form owner plus name, not by document-wide name alone. Check missing names, accidental grouping and duplicate value/label combinations that make choices ambiguous.
- For repeated connector checkboxes, distinguish the group name from each connector's option label. A single independent checkbox does not automatically require a fieldset.
- Keep ordinary native keyboard semantics; do not recommend custom roles or roving tabindex merely to restyle native choices.

[W3C grouping guidance](https://www.w3.org/WAI/tutorials/forms/grouping/).

### D. Button and link actions

- Record the explicit `type` attribute on each button. Identify intended submission controls versus toggles/clear/recovery controls. A missing type is a robustness finding; severity depends on whether its default submission changes the user's task.
- Clear/navigation anchors need an actual destination and an understandable name. Do not call a link a submit button or require `type` on an anchor.
- Check icon-only actions for names. Decorative icons must not become the only unintelligible text in a control's name.
- Record any `formnovalidate`/`novalidate` use and its purpose. Do not suggest bypassing canonical server validation.

[HTML button type reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button#type).

### E. Native required/numeric-pair recovery

- Inspect actual `required`, input type, `min`, `max`, `step`, selected options and associated units/help. A value accepted by the functional query oracle can still be blocked by native HTML constraints; record the control's validity flags against the artifact value.
- For a rendered numeric/unit pair, record native validity for supplied values, both blank, value only and unit only using a detached copy of the actual form. This is an HTML constraint-model observation, not browser acceptance or a second domain parser.
- Do not copy query schemas or reimplement pair rules. Reference the canonical contract and the functional oracle for domain validity. Mark not applicable when the pair is absent.
- Inspect the actual recovery path: clear/remove link, selectable empty option, visible unit/format instruction and associated error/help text. Determine whether native validation traps a user before an ordinary search/sort/clear action or whether an accessible recovery action exists.
- Do not label every required field a defect. State the reproducible blocked task and the evidence. Defer native error-bubble wording, error focus, dynamic `required` updates and server-error recovery until browser/installed lifecycle checks.

[W3C input validation guidance](https://www.w3.org/WAI/tutorials/forms/validation/).

### F. Keyboard order and operability evidence

- Inventory the expected sequential order from native controls, links and `tabindex`. Exclude disabled/hidden/inert content and closed-details descendants appropriately. Flag focusable content under `aria-hidden` for review; ARIA hiding alone does not establish that it is removed from keyboard navigation.
- Record positive tabindex and custom keyboard widgets as manual-review candidates, with the resulting predicted sequence. Do not claim an actual keyboard failure solely from a positive number if no meaningful-order problem is demonstrated.
- Check that fields, grouped choices, Apply/Search, independent clears and pagination form a meaningful task order. Check for controls removed from normal tab order without an evidenced alternative.
- Reserve actual Tab/Shift+Tab, arrows, Enter/Space, Escape, disclosure behavior, focus visibility/obscuring, CSS-reordered layouts and screen-reader announcements for the later browser/AT pass. Static DOM order is not proof of keyboard acceptance.

[W3C focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html).

## Finding and evidence format

Each final finding must contain:

- ID, owner/theme, route, artifact path and SHA256.
- Exact selector that resolves in that artifact; add a form selector or occurrence index when names repeat.
- Short actual HTML excerpt, observed name/label/group/constraint/sequence and the affected task.
- Severity with a concrete reason, smallest owner-directed correction, and a verification expectation.
- Evidence class: observed markup defect, native constraint-model reproduction, or browser/AT review still required. Keep candidates out of confirmed defect totals.

Use separate per-artifact outcomes: observed pass, confirmed defect, review required, not applicable or unavailable. Keep the functional oracle's findings separate. Report the same defect on both routes with both artifact references instead of inflating unrelated issue counts. Shared inherited-source defects should identify the owning shared boundary for coordinator triage, without editing any factory in this review.

## Deliverables after final stable renders

`inputs.json`: final checkpoint and 18 pinned HTML hashes. `inventory.json`: forms, controls, names, relationships, groups, native constraint observations and predicted focus sequence. `FINDINGS.md` plus structured findings: concrete owner/selector defects and separate manual-review candidates. A coverage table must make missing artifact/state evidence explicit.

No browser, build, database, source changes, new dependencies, networked catalogue calls or duplicate filter-domain parser are authorized by this review plan.

Existing local tooling is available without installation: JSDOM from the UI workspace and `dom-accessibility-api` via its existing Testing Library dependency can compute names/descriptions. Record the exact tool version and the artifact CSS limitations with the later inventory. Do not substitute a handwritten filter parser or an automated conformance claim.

Final checkpoint accepted: archive receipt SHA256 `27b75e544285a88fbfe5b05f598c70f60e3ccdbb06f20af5b39ba5d0a6bc0f8c`; exact 24 HTML hashes are pinned in inputs.json. The completed review found one consolidated Circuit label ambiguity and two separate review groups. Native pair observations are explicitly synthetic-before390, not SQL or browser acceptance. Follow-up should target the affected 32 controls after the coordinator supplies Circuit’s new source/render checkpoint.
