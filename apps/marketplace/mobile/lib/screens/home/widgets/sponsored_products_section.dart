import 'package:flutter/material.dart';

// Phase 1R corrective (C2): this widget's guarded outer stream (R1.5's _adProductsStream fix)
// always returned Stream.empty(), so it already rendered nothing — but _buildVerticalProductCard's
// nested `FutureBuilder(future: FirebaseFirestore.instance.collection('products').doc(...).get())`
// was an unguarded synchronous-throw risk left dormant only because the outer stream never emits
// (confirmed empirically: FirebaseFirestore.instance throws FirebaseException([core/no-app]) with
// no Firebase.initializeApp() call — the same class of risk sponsored_products_banner.dart had on
// product_details_screen.dart). Sponsored/ad placements have no canonical successor yet, so this
// renders nothing rather than carry Firebase machinery for a feed that's already permanently empty.
class SponsoredProductsSection extends StatelessWidget {
  const SponsoredProductsSection({super.key});

  @override
  Widget build(BuildContext context) {
    return const SizedBox.shrink();
  }
}
