# Release 389 hold — MadeYours review to cart

Final freeze remains held for proposed manifest `1686be9e72bd721b6bcb553951f6fd0cf26bcf7e91af49d714041bee03307615`. Its existing artifacts are unchanged; no intermediate proposal or migration SQL has been generated.

MadeYours owns the read-only review-context producer and variant-bound digest. Pantry owns the actual existing client/controller binding from review to the canonical cart. The final source and affected integration checkpoints must be released by those owners. This gate reuses their canonical contracts and defines no schema, alternate digest, API or cart.

The release depends on actual selected-variant/configuration review invalidation and forwarding at the cart side effect, with canonical server revalidation retained. The owners must identify any necessary factory/markup hook change; that change belongs in the next package proposal. Shared-only API/client/controller changes are pinned as runtime acceptance dependencies and do not justify invented bundle changes.

[Machine-readable dependency](madeyours-review-cart-release-gate.json) records owner responsibilities and pending checkpoints. The [existing editor roundtrip hold](EDITOR_ROUNDTRIP_GATE.md) also remains active: all eight factory corrections and the final all-ten-theme, all-21-template JSON-wire/document gate must be resolved. Threadline stays a protected control outside promotion.

The coordinator will request a new content-addressed proposal after these exact checkpoints are known. No regeneration is performed for each intermediate source edit. No database, browser, build, deployment or SQL application is authorized by this dependency update.
