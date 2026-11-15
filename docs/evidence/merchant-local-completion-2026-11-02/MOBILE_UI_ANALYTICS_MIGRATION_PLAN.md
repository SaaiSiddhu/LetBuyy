# Analytics frontend migration

Continue the approved entire-app frontend assignment from the archived Customer Detail4 checkpoint, SHA `5f0644af1bb505f15adbf1dfdf896bc4e27f415ce182fc65137be39c2ab980ff`/7486 broad inputs. Android29 and iOS12 are terminal; no fixed-source job remains active. These are feature-specific cohorts within the unreconciled whole-app ledger, not a new programme or release.

## Existing authority and preserved reads

Analytics is a read-only Merchant report reached by the Dashboard and Settings routes. Keep the existing AnalyticsService and SDK. Its five required aggregate reads remain dashboard(store/period), orders(store), revenue(store/period), top-products(store/limit5) and traffic-sources(store/period/limit5), followed by the optional live(store/window15) read. No new endpoint, BFF fan-out, parallel backend, persistence, money calculation or permission is authorized. Dashboard's separate existing mobile composite remains unchanged.

Summary revenue/orders/AOV are the server's rolling period values; daily history uses the server's calendar windows in Asia/Kolkata. Products counts active catalog entries. Top-products is a limited ranking with no period parameter; its fallback omits revenue. Traffic sources use the requested period. Previous-period zero values and real zero daily buckets remain real data. A successful live available:false response is waiting for traffic; a failed live read is unavailable. Missing recency is unknown.

## Presentation plan

1. Keep a visible canonical responsive header and applied-period choice while initial data loads. Preserve the four supported period values; draft selection is applied only on the canonical sheet's Apply action.
2. Capture store/actor/API/query generation. Retire old private values on observed owner changes. Reject late period results. Keep coherent prior data only during a same-scope refresh, with visible pending/failure context. Current access denial retires report content; older optional positives cannot restore it.
3. Publish the five-read primary aggregate before waiting for optional live activity. Show live pending/failure locally. Retry performs existing reads only, with no passive polling added.
4. Use shared StatGrid/StatTile, theme/card/text owners and readable error/empty states. Display the authoritative revenue double with paise; do not use rounded StatsRow input or lifetime-store metric fallbacks. Preserve StatsRow and other callers.
5. Add only safe presence metadata and a read-context getter to the existing client owner where necessary. Preserve original numeric defaults, parsers, SDK arguments, read ordering, notifications and dashboard composite semantics. This is a classified fifth frontend client exception, not a new domain authority. Prove the distinction with parsed preservation and actual client transport tests.
6. Extend the existing recorded chart family into one maintained reusable visual owner used by both Dashboard's public AnimatedRevenueChart wrapper and the Analytics revenue/orders comparisons. Keep exact source points/dates, units and formatting; no recalculated business series. Bound labels, permit large text, show real flat-zero/negative series, use direct/static values and an accessible exact-value alternative. Retain obsolete private presentation methods until replacement gates allow cleanup.
7. Render full product/source labels and limited-population copy. Missing revenue, counts, percentages, daily metrics and comparisons must not become confirmed zero. Do not claim that a successful empty product result proves no sales.

## Finite acceptance

Use real frontend service/SDK plus controlled synthetic transport for meaningful first-load, held optional, query/owner races, denial, zero/missing, refresh and both-theme 320dp/2.4 tests. Shared chart tests preserve existing Dashboard precision/zero/period behavior and add comparison/date/accessibility boundaries. These do not prove database/RLS/hosted reporting.

Then qualify fixed broad source with analysis, full Flutter suite, parsed preservation, protected byte readback and the existing owned governance capsule. Retain the pre-existing protected Staff namespace failure without weakening its policy. New Android normal sign-in/report reads and iOS compile/runtime evidence are separate gates. No provider, production, release or entire119-feature certification follows from this cohort.
