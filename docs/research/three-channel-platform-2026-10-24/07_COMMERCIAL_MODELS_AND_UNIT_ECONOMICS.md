# Channel charges franchise pricing and unit economics

## A charge must have a defined consideration

Storefront sales carry zero LetBuyy sales commission. Marketplace uses an approved effective-dated category schedule, including any intentional zero-rate bands. Quick uses its own partner contract. Shared login, catalog or stock never makes every sale subject to every channel's fee.

| Charge | Possible consideration | Accounting and product treatment |
| --- | --- | --- |
| One-time implementation | Documented onboarding, catalog setup, training and launch assistance | Earned according to delivered service; itemize hardware separately |
| Brand association/franchise right | Real licensed brand and specified operating rights/support | Requires a cleared brand and reviewed agreement |
| Refundable security | Defined contractual risk protection | Liability, not GMV/revenue/profit; collection handling needs approval |
| Software subscription | Defined location/user/terminal access and support | Canonical billing; explicit unit and entitlements |
| Royalty or demand fee | Agreed brand/demand/service basis on eligible Quick business | Versioned net basis, scope, exclusions and reversals |
| Per-order fulfillment | Actually delivered pick/pack or orchestration service | Attributable eligible event and cost responsibility |
| Logistics | Agreed delivery/waiting/return service | Show customer charge, seller charge and actual cost distinctly |
| Marketplace commission | Marketplace selling service | Category/price/version snapshot per relevant order line |
| Optional advertising | CPC, CPM or purchase-based campaigns | Verified separate funding and attributable billable events |

Do not stack royalty and Marketplace commission on the same Quick service merely because two names are available. A separate pick/pack service may coexist with a brand royalty only where the contract explains the different consideration and the complete partner economics remain viable.

## Proposed pilot pricing experiments

The following are **LetBuyy planning hypotheses, not competitor benchmarks, approved rates or offers**. Test them against actual cost and partner willingness before setting configuration.

| Model | Suggested experiment | Condition |
| --- | --- | --- |
| Partner supermarket | Itemized onboarding recovery; optional ₹1,999–₹4,999 per location/month software band | Include only delivered work; distinguish existing versus extra equipment |
| Partner supermarket variable service | Compare one 2%–4% eligible Quick-sales service fee against one ₹8–₹15 eligible-order service fee | Choose a service and one primary basis, rather than charging both for the same work |
| Franchisee-owned store | Separately cost one-time brand/training/setup rights; test ₹3,000–₹6,000 monthly software and 1%–3% Quick royalty sensitivity | No final brand fee chosen until real setup cost and brand value are substantiated |
| Managed operator | Operating compensation for actual eligible work, possibly with quality/throughput conditions | Do not charge an inventory-owning franchise package to a service operator automatically |
| Multi-owner custody | Storage/receipt/pick fees only after a scoped custody contract and measurement | Outside the initial simple owner-stock pilot |

These bands are scenario inputs for negotiation design. They are not a recommendation to begin charging. The minimum sustainable platform fee must cover measured infrastructure/support/operating service cost, and the maximum acceptable fee is constrained by the seller's margin and competitive value. Fixed software fees can be deferred during a bounded trial with a clear end, rather than hidden permanently in an unexplainable take rate.

## Order contribution model

Use ex-tax merchandise revenue after order discounts as the basket input. Gross margin is merchandise revenue less landed merchandise cost. Add separate costs only when not already included elsewhere. Salaried pickers belong in fixed operating cost in the following example; packaging is a variable consumable. The marketing allocation is a separate acquisition budget, not a second subtraction of an already-applied order discount.

~~~text
merchandise_margin = basket_net * gross_margin_rate
spoilage = basket_net * spoilage_rate
variable_platform_fee = eligible_fee_basis * contracted_rate
contribution_per_order = merchandise_margin
  - packaging - payment_cost - net_delivery_subsidy
  - marketing_allocation - spoilage - support_return_allowance
  - variable_platform_fee
monthly_operating_result = orders_per_day * operating_days * contribution_per_order
  - fixed_operating_cost - software_subscription
break_even_orders_per_day = (fixed_operating_cost + software_subscription)
  / (operating_days * contribution_per_order)
~~~

Break-even has no finite positive solution where contribution is zero or negative. Expansion cannot cure a structurally loss-making order. This simplified model excludes tax, financing, depreciation and central overhead unless explicitly entered; it is an operating sensitivity model, not an investor return forecast.

## Worked sensitivity cases

All values below are invented test inputs in INR, ex-tax. Base order: ₹600 net merchandise basket, 14% merchandise gross margin, ₹6 packaging, ₹7 payment cost, ₹18 net delivery subsidy, ₹10 marketing allocation, 1.5% spoilage, ₹5 support/returns allowance and 2% variable Quick fee. Contribution is ₹17 per order. Software is ₹3,999/month and the modeled month has 30 operating days.

| Scenario | Orders/day | Fixed operating cost/month | Contribution/order | Monthly operating result | Break-even orders/day |
| --- | --- | --- | --- | --- | --- |
| Dedicated franchise base | 200 | ₹120,000 | ₹17 | −₹21,999 | 244 rounded up |
| Existing supermarket incremental case | 150 | ₹45,000 | ₹17 | ₹27,501 | 97 rounded up |
| Lower margin ₹500 basket, 12% margin | 200 | ₹120,000 | −₹2.50 | −₹138,999 | No finite break-even |
| Stronger 20% merchandise margin | 200 | ₹120,000 | ₹53 | ₹194,001 | 78 rounded up |
| Delivery subsidy rises to ₹30 | 200 | ₹120,000 | ₹5 | −₹93,999 | 827 rounded up |

The lower-basket case uses a ₹6 payment-cost input; other applicable base costs/rates remain as stated. Fixed cost values are hypothetical, not researched city rent or payroll quotes. Financial scenarios in FINANCIAL_SCENARIOS.csv expose every input and calculated output so these numbers can be replaced and checked.

The platform's view is separate: at 200 daily ₹600 orders, a hypothetical 2% fee yields ₹72,000/month and subscription ₹3,999, before its own service costs and tax treatment. This is ₹75,999 modeled revenue, not profit. If per-order processing/service cost is ₹3 and location support/allocated infrastructure is ₹10,000, the simplified location contribution is ₹47,999 before central overhead and other costs. Recharging the franchisee's delivery/payment costs does not make those amounts incremental platform margin.

## Setup and working capital worksheet

Collect actual quotes for premises deposit/fitout, racks, chillers/freezers, electrical/backup power, network, scanners/printers/devices, safety requirements, training, signage and installation. Identify asset owner, expected useful life, maintenance, replacement, refundable amount and tax treatment. Keep merchandise working capital, refundable deposits, capex and expenses in separate columns.

For an illustrative one-time service quote, suppose actual catalog/onboarding work costs ₹6,000, training ₹8,000 and launch setup/support ₹6,000. That is ₹20,000 service cost. A 20% service gross-margin target gives a ₹25,000 quote using cost divided by 0.80, before applicable tax; a 20% markup would instead produce ₹24,000. These are example inputs, not measured LetBuyy costs. Hardware, premises and merchandise are separately quoted, and a brand-right fee is not inserted until there is a cleared right and defensible value. If a trial waives this service charge, record the cost as platform-funded acquisition spend rather than pretending setup was free.

Illustration only: at ₹600 revenue and 14% gross margin, modeled merchandise cost is ₹516/order. Two hundred daily orders and twelve days of stock imply ₹1,238,400 of inventory at that cost basis. Supplier credit and existing stock can change incremental funding; payment receivable delays and safety cash can increase it. That calculation explains why a small brand fee is not the total capital required. Do not present it as a required investment for every supermarket.

## Fee basis and reversals

Define eligible Quick sales, discount treatment, tax exclusion, canceled/refunded lines, delivery charges, refunds after a billing cutoff, minimums/caps, rounding and effective dates. Every payable amount must identify the original order/service and contract revision. Reversals use attributable adjustments. Storefront sales remain outside the Quick royalty base even if they use the same product and physical stock.

Marketplace rate selection should consider product category, price bands, permitted exceptions and actual seller economics. Competitor zero-rate programmes show why a flat imported percentage is insufficient. Select real category rates after reviewed worked examples and provider/logistics costs; no live rate table is invented here.
