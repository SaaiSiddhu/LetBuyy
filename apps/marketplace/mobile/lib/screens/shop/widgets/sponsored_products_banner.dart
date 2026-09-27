import 'package:flutter/material.dart';

// Phase 1R corrective (C2): this widget's build() constructed a raw
// FirebaseFirestore.instance.collection('ad_products')...snapshots() stream directly and
// unguarded, on product_details_screen.dart's build path (twice: the sticky header and the
// inline banner) — the single most-navigated-to screen in the app. With Firebase.initializeApp()
// removed (R1.3), FirebaseFirestore.instance throws on first access, so every product-detail view
// would have thrown at build time, before any StreamBuilder error channel could catch it (the same
// class of bug ReelService's constructor had). Sponsored/ad placements have no canonical successor
// yet, so this renders nothing rather than reach for Firebase.
class SponsoredProductsBanner extends StatelessWidget {
  final String? excludeProductId;

  const SponsoredProductsBanner({
    super.key,
    this.excludeProductId,
  });

  @override
  Widget build(BuildContext context) {
    return const SizedBox.shrink();
  }
}
