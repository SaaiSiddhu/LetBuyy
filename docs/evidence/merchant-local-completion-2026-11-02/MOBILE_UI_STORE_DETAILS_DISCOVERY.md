# Merchant Store Details source and caller discovery

Reviewed the complete1022-line screen, actual named route and Settings/Dashboard/header callers, relevant canonical StoreService update/asset behavior, existing composed Store Details scope tests and current Gateway profile update contract. This is source/caller discovery. The active normal native/web run separately tests only the owner-name path; complete fields/logo/checkout/GST/iOS acceptance remains open.

Existing protections include the shared MerchantStoreView, fresh selected-store reads, acknowledged revision-bound updates plus fresh readback, unsaved-edit/reload confirmation, unknown-save hold, preserved editable contact/address metadata and access denial retiring selection. Logo save preserves unrelated unsaved text rather than claiming it saved. Client India/GST/contact validation is presentation; server validation and sites ownership/version remain authoritative.

Candidates needing focused composed tests before new repair:

- Equal-key StoreContext/StoreService replacement is not represented by the screen's stored view; old service/provider completion and covered-route feedback/navigation need lifetime tests.
- The logo GestureDetector wraps a labelled Semantics node; test the actual actionable accessible node and keyboard behavior before selecting the existing AccessibleTapRegion, as the earlier switcher defect cannot be assumed identical.
- Field labels are sibling Text nodes while InputDecoration uses hints. Check actual semantics at large text and narrow widths; retain canonical colors and shared input/form owners rather than introducing feature-local components.
- Full profile payload normalizes several scalar optional fields even for a single-field change. Explicit retained/null/unmanaged-key equality needs stronger coverage before claiming full profile preservation.
- Logo upload, version-conflict reload, reply-lost recovery, concurrent web edits and all form fields need their own runtime outcomes. Successful owner-name sync does not establish those stories.

No source, SQL, permission, money or provider behavior was changed by this discovery. Continue source/local qualification through existing owners.
