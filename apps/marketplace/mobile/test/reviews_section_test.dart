// Firebase SDK removal pass (27 September 2026 review, finding 5) -- regression coverage for
// reviews_section.dart's "Add/Edit Review" button, found still fully wired to
// AuthService.getCurrentUserId()/DatabaseService.getUserProductReview() (both Firestore-backed)
// after ReviewProvider's own Firestore READ path had already been disconnected in an earlier C2
// pass. That earlier pass only ever removed the read path; this button was a separate, independently-
// wired write path it missed. Safe (getCurrentUserId() is always null under canonical auth, so the
// button's own state check always short-circuited before reaching DatabaseService), but a live,
// tappable affordance whose dialog can only ever fail is the dishonest-UI pattern this phase exists
// to remove -- checks that it is actually gone, not just that the empty state still renders.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_marketplace/screens/shop/widgets/reviews_section.dart';

void main() {
  testWidgets('shows the honest empty state, with no Add/Edit Review affordance left to reach Firebase', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(
        body: ReviewsSection(productId: 'p1', productName: 'Widget', isDark: false),
      ),
    ));

    expect(find.text('No Reviews Yet'), findsOneWidget);
    expect(find.text('Add Review'), findsNothing);
    expect(find.text('Edit Review'), findsNothing);
  });
}
