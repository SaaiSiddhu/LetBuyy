import 'package:flutter/material.dart';

// Phase 1R corrective (C2): this widget's build() started with
// `if (safeFirebaseUserId() == null) return const SizedBox.shrink();` -- and canonical
// "Sign in with LetBuyy" never touches FirebaseAuth, so that guard already fired on every
// build, before ever reaching its FirebaseFirestore order query or its ReviewProvider.addReview
// submit path. Both were entirely Firestore-backed with no canonical successor, so this renders
// the same always-empty result directly instead of carrying that dead machinery.
class RateYourPurchasesSection extends StatelessWidget {
  const RateYourPurchasesSection({super.key});

  @override
  Widget build(BuildContext context) {
    return const SizedBox.shrink();
  }
}
