# Warehouse list controls and canonical metadata readback

1 November 2026. Client source `4aa6be3e6fd7e053e656d065c562d076f2a389fd`; final integrated source `a0b7dad6660107063cbd141f80d674f38a8a1f1f`. Source/private task branch only.

Native locations, suppliers, purchase orders and transfers expose one guarded filter/sort sheet. Search and status apply to the server's full matching population, page resets to one, exact counts belong to that query, and sorting uses the existing stable server order. Cancel has no read effect; Clear restores the canonical query. Store switches clear applied filters and retire private dialogs/reads. Filtered empty lists describe matching records, rather than asserting the whole store is empty. Web purchase-order/transfer workspaces expose the same document-number/status/date-order controls with canonical status enums. Changing filters clears previous rows/counts immediately. Denied or unavailable reads cannot become successful zero counts; clearing a failed filter recovers normal reads.

The expanded actual SDK creation test exposed a separate response mismatch: the location POST inserted a JSONB address, then flattened its response address to a string. The canonical native/SDK readers correctly refused that result. The route now returns the stored canonical record directly; it does not invent a second flat representation. Owned acceptance first creates a supplier as a populated control, then creates a location and reads its same ID/address back through the scoped paged SDK reader.

## Evidence

- Client source: **706/706 full Merchant Flutter**, clean analysis; **64/64 shared Dart models**. Twelve new native filter cases cover apply/cancel/clear/store-switch and filtered-denial recovery across all four lists. These overlap the full count.
- Composed warehouse web lifecycle/journal/actual Next-SDK checks **235/235**; six new rendered filter/clear/delayed-scope/denial checks overlap that count. Targeted React lint and web types pass.
- The final two commits change only the owned test and Gateway location response; native, shared Dart, production web, SDK and shared TypeScript diffs from client source are empty. Gateway **2,006/2,006** and typecheck pass on the response fix.
- Metadata response reproduction: source `46288fb64`, run `2a1f4a92f603`: **38 pass / 1 fail**. Corrected integrated source run `6e8b887f8131`: **39/39**, including all earlier atomic stock, two-variant exact-cost, replay, preflight, deep-page, current-owner denial and guarded rollback tests. Both cleanup receipts have no failures and zero remaining owned containers/networks/volumes.
- Exact-source integrated governance **114 pass**, zero fail/blocked/skip; one not applicable. Earlier client-only source also passed 114. Raw-role/tenant run `0fe15d83d81e` retains **8/8** on unchanged SQL/role contracts; it is not presented as a new hosted run.
- Unchanged option/transport sources retain shared Dart API **97 pass / 6 pre-existing skips**, BFF **24/24**, shared TypeScript **18/18**. Earlier neighboring error-recovery test **1/1** retains its own source boundary.

Receipts: `/private/tmp/letbuyy-warehouse-list-{native-final2,analysis,models,web-final2,web-lint,web-types}.log`, `...-governance.json`; `/private/tmp/letbuyy-warehouse-create-records-{before,after}.json`; `/private/tmp/letbuyy-warehouse-list-and-create-governance.json`. Temporary receipts supplement this durable source record.

## Still open

Location/supplier creation now has a verified basic response/readback contract; durable original-key recovery for uncertain outcomes remains open. Actual two-direction web/mobile writes, conflicts, authenticated owner/staff journeys and the broader 122-item programme are not accepted. Android emulator testing is owner-approved; no extra physical-device prerequisite is imposed. The running emulator remains the older verification APK, open on sign-in. CUA cannot select its non-bundle window; direct secure user sign-in is pending. New debug APK source `1dd5400be` is built/hashed but does not contain the later filter controls and has not been installed. No release signing, push, hosted schema/data change, deployment or production-readiness certification occurred.
