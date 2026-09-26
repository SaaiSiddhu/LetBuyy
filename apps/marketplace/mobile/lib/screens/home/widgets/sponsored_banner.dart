import 'package:flutter/material.dart';

// Phase 1R corrective (C2): SponsoredBannerProvider was entirely FirebaseFirestore-backed
// (a realtime `sponsored_banners` listener) with no canonical successor — sponsored/ad
// placements are a later-phase capability. Its own empty state was already SizedBox.shrink(),
// so this preserves that exact rendering without ever touching Firebase to reach it.
class SponsoredBanner extends StatelessWidget {
  const SponsoredBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return const SizedBox.shrink();
  }
}
