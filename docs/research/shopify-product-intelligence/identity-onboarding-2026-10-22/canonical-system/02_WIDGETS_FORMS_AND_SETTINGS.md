# Widgets forms and the Settings workspace

## Canonical widget registry

These are original research families. Fresh observations are linked by exhibit number; PRIOR families retain the earlier chapter's scope. Their conceptual reuse does not prove one private internal component.

| Family | Purpose/slots | State and authority rule | Evidence |
| --- | --- | --- | --- |
| Metric/report card | Name, value/undefined, range, chart/report link | No data for range differs from zero and failure; period/population must match drill-through | Fresh Analytics `11` |
| Setup checklist | Task, progress, next action | Completion describes checked facts; optional tasks differ from launch blockers | PRIOR chapter 08 and LetBuyy setup evidence |
| Status badge | Exact entity state, optional icon | Connected, Primary, Active and Private qualify different facts | Fresh Domains `14`/`17`, editor `26` |
| Notice/banner | Important context and appropriate action | Promotion, warning and validation are different meanings | Fresh domain promotion, payment readiness, domain error |
| Section | Heading, optional subheading/accessory/action, related body | Hierarchy survives styling and nesting | Fresh customer `08`, shipping `19`; DOC Section |
| Key-value summary | Target/type/value | Values derive from the owned record | Fresh domain detail `17` |
| Resource/value picker | Label, query/options, selected value | Selection uses existing owned entities; no implied new capability | Fresh product and Hero panels |
| Media area | Upload/select, format guidance | Upload success differs from processing/insertion; failures OPEN | Fresh product form `03` |
| Saved-view/filter toolbar | Query, predicates, reset/save, result scope | Unchanged Save can be disabled; matching scope must be explicit | Fresh customer `07`; populated cases OPEN |
| Table | Headers, cells, actions, pagination where available | Component appearance does not establish server matching | Fresh domains table; DOC Table |
| Empty state | Specific absence, explanation, next action | First-use, plan gate, no segment match and no range data differ | Products/Orders/Customers/Apps/Analytics |
| Preview frame | Mode, scope, ready/error | Embedded preview has independent readiness | Fresh editor `26`; prior detailed measures |
| Activity/history | Events, timestamps and related target | Real durable domain evidence; fresh populated case OPEN | PRIOR app/editor study |

The public Table contract describes responsive list/table presentation, filter and pagination integration. Search/sort remain application logic; documented pagination controls are not proof that a native index uses the same data implementation. [Table](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/table).

## Form composition and rhythm

Fresh Add product showed content/media/category in the main column and status/publishing/organization/template in a supporting column. Price, inventory and shipping used contextual optional controls: Compare-at, Unit price, Charge tax, Cost per item; SKU/barcode/oversell; dimensions/weight/origin/HS code. New customer used overview, default address and tax details, with notes/tags as supporting tasks.

This is progressive disclosure based on task meaning. A form needs a clear main sequence without removing consequences. Stock, publication and payment effects must remain understandable even when optional detail is collapsed.

Field rhythm is distinct from card separation. The fresh product capture shows readable labels, a specific editable boundary, a rich-text toolbar/body, media selection area and related help. A reliable reusable composition includes label/control/help/error, related fields, section boundary and page main/aside layout. Do not infer exact field gap from screenshot scaling; use the computed exhibits for sizes and a direct target measurement for any adoption decision.

Public form guidance recommends structured sections, progressive disclosure and dedicated pages for substantial object editing; large modal forms are discouraged. Its save guidance describes Shopify's conventional explicit form commitment. LetBuyy's existing theme draft/preview contract may differ legitimately and must not be deleted to satisfy a general app-form convention. [Forms and saving](https://shopify.dev/docs/apps/design/user-experience/forms).

Public Section adjusts heading level with nesting and offers contextual treatment, subheading and accessory roles. The transferable requirement is meaningful grouping; Shopify's automatic heading system is not a reason to replace LetBuyy's React framework. [Section](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/section).

### Rich descriptions

The product toolbar exposed formatting, emphasis, color/alignment, link, image/video/table, lists/indentation, clear formatting and Show HTML. This establishes available authoring affordances. No new rich content was saved, no unsafe payload was injected into the real store, and no arbitrary-HTML execution claim is made. Retain the earlier chapter's source-mode evidence and implement a bounded, server-safe LetBuyy contract.

### Validation example

The domain modal's empty Next displayed “Domain can't be blank.” The input association/geometry is in `16-domain-validation.json`; the AX state is preserved. Focus remained on Next in that sample. The message's existence does not prove ideal focus handling or all validation branches. LetBuyy should preserve safe input and associate errors, while choosing a useful focus destination.

## Main workspace versus Settings

| Dimension | Main merchant workspace | Settings |
| --- | --- | --- |
| Global chrome | Expanded 220 px rail in measured native desktop | Collapsed global rail plus local Settings navigation |
| Compact context | Index or parent/task identity | Settings/parent/task identity |
| Large task heading | Create/detail forms; absent on inspected empty indexes | 26/32 px on General, Domains, Payments, Shipping and Users task headings |
| Content alignment | Record form task heading x276 at 1440 | General/Domains task heading x468 at 1440 |
| Action placement | Header/index/empty/task-dependent | Task-specific header/local rows and dirty save overlay |
| Save responsibility | Product uses contextual bar | General uses same rendered bar family |
| Structure | Index, record form and operational data | Related configuration groups, disclosures, links to details |
| Exit | Parent/back and global navigation | Back from Settings restored Analytics in this run |
| Mobile | Main rail becomes quick/menu entry | Persistent settings rail replaced by Settings return/control |
| Capability | Plan/data/role-dependent | Provider/subscription/role/configuration-dependent |

The measured placements are examples, not proposed LetBuyy offsets. Compose around available space and the host's existing shell widths.

## Data and readiness semantics

The Orders trial screen offered a subscription path. Products offered catalog creation. Customers said no customers matched the segment. Analytics displayed no data for some ranges and em dashes for undefined values; report titles linked to supporting reports. These are different states and actions, even in an account with no operational records.

Domains exposed Connected and Primary separately. Payments exposed provider selection and an inactive method, with manual methods and payment configuration as distinct groups. Shipping used grouped disclosures and direct profile routes. Researching these workflows does not authorize importing Shopify's financial fees, shipping products or app ecosystem into LetBuyy.

## LetBuyy adoption consequence

LetBuyy already owns PageHeader, Section (including grouped), BlockStack/InlineStack/Grid, Input/Textarea/Select/Combobox, Table, MetricCard, Badge/Banner/Toast, SaveBar, dialogs and a separate SettingsShell. The work is to complete semantic/state contracts and consistent task recipes at these owners.

Fresh source findings include grouped Section rendering its visible title as a span, settings-specific cards using separate label classes, Page nesting main landmarks, and SaveBar retaining invisible interactive controls in saved state. These are more consequential than matching a pill radius. The [comparison chapter](../../../../implementation/identity-merchant-experience-2026-10-22/08_CANONICAL_PATTERN_COMPARISON.md) records exact ownership and proposed acceptance.
