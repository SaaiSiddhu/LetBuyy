# Shopify canonical UI patterns deep dive

22 October 2026 · Fresh authenticated observations plus explicitly identified earlier evidence · Research taxonomy, not a claim to Shopify's private source architecture.

Shopify's coherence comes from repeated task contracts: identify the current scope, give the main action clear priority, protect unsaved input, group related information, and keep navigation, data and preview readiness understandable. The observed system supports several header/layout families and several action bars. A single universal header, modal size or floating bar would misrepresent it.

The most useful fresh finding is the **same rendered floating save-bar family on Add product and General settings**. Temporary edits summoned a dark pill with Discard/Save; the inspected class family and paint/spacing matched. At 390 px the product bar transformed into top close/check controls. Attempting sidebar departure retained the form and focused Save. Both temporary edits were discarded; no product or setting was saved.

The second finding is a **two-level header hierarchy**. Native Products, Customers, Orders, Discounts and Analytics used compact 13 px context headings. Product/customer creation and Settings detail also used a 26/32 px task heading. The theme editor kept its separate dedicated toolbar. LetBuyy should express appropriate pattern variants through its existing shared system, preserving its own readable 24/32 task-title role.

## Study structure

| Artifact | Content |
| --- | --- |
| [Headers, actions and bars](01_HEADERS_ACTIONS_AND_BARS.md) | Header variants, CTA hierarchy, measured save-bar behavior, mobile transformation and limitations |
| [Widgets, forms and Settings](02_WIDGETS_FORMS_AND_SETTINGS.md) | Repeated composition rules, form rhythm, field/section behavior and main/Settings comparison |
| [Containers, loading and editor](03_CONTAINERS_LOADING_AND_EDITOR.md) | Container choices, scroll/layer ownership, route/data/preview readiness and dedicated editor scope |
| [Evidence and verification](04_EVIDENCE_AND_VERIFICATION.md) | Fresh/prior/documented coverage, methods, open branches, privacy and official references |
| [Pattern registry](pattern-registry.json) | 32 stable research patterns with states, exceptions, LetBuyy owners, dispositions and acceptance |
| [Measurement index](measurements.json) | Fresh geometry exhibits, actual viewport/DPR, capture-file times and method limitations |
| [Evidence manifest](evidence-manifest.json) | Sanitized exhibit provenance and hashes |

The [LetBuyy canonical-pattern comparison](../../../../implementation/identity-merchant-experience-2026-10-22/08_CANONICAL_PATTERN_COMPARISON.md) maps these findings into the existing implementation plan and gap IDs. It does not apply a redesign or activate deferred capabilities.

## Surface families

| Family | Observed role | Important distinction |
| --- | --- | --- |
| Refreshed merchant shell | Black navigation surrounding a white work area | Shell identity and work content have different paint/scroll roles |
| Native index | Compact context header, task-specific index/empty state | A large repeated page title is not universal |
| Native record form | Compact parent/context row plus larger task heading and grouped fields | Main data and supporting metadata can occupy different columns |
| Settings | Collapsed global rail, local navigation, large configuration task heading | Configuration is still the same store, with a different navigation depth |
| Native focused dialog | Named task, bounded body/footer | Domain dialog measured 620 × 180 px and 24 px radius before validation |
| Embedded Themes | Native host header around a separate channel workspace | Host and embedded content have separate readiness and visual scopes |
| Theme editor | Dedicated toolbar, outline/properties, storefront preview | Global merchant navigation is replaced by editing context |
| Public app-facing Polaris | Documented web components and App Bridge contracts | Public APIs support app consistency; they do not establish every native-admin internal implementation |

The current public App Home reference identifies Polaris **v2.0**. Its Page exposes heading, breadcrumb, action and aside slots. Several native rendered elements also use `s-*` DOM tags/open shadow trees. This is evidence of rendered composition, not proof that every private native route uses exactly the public package/version. [App Home](https://shopify.dev/docs/api/app-home/latest), [Page](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/page).

## Interpretation rules

LIVE and MEASURED describe specific observed states. DOC describes the cited app-facing contract. PRIOR identifies earlier chapters, retaining their original date/state/limits. SOURCE refers to the current LetBuyy checkout. INFERENCE describes the proposed shared rule; OPEN names untested branches. Registry IDs are original research labels.

Fresh measurements traversed open shadow DOM after a first light-DOM-only probe missed the native heading. Zero-size `display:contents` hosts and blank slot text are not absent UI. The first probe remains labeled method-limited. Measurements below use actual CSS viewport/DPR; no screenshot resize is treated as a layout measurement.

The account is an empty trial store. Populated product/order operations, full native bulk selection, permission variants, provider failures and mutation recovery are not demonstrated. Successful UI composition must not be confused with proven backend guarantees.
