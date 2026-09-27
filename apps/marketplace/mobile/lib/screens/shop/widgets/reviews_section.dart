import 'package:flutter/material.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

class ReviewsSection extends StatelessWidget {
  final String productId;
  final String productName;
  final bool isDark;

  const ReviewsSection({
    super.key,
    required this.productId,
    required this.productName,
    required this.isDark,
  });

  // Firebase SDK removal pass (27 September 2026 review, finding 5): the "Add/Edit Review"
  // button above the empty state below was still fully wired to AuthService.getCurrentUserId()
  // and DatabaseService.getUserProductReview()/AddReviewDialog's own writes -- a genuinely live,
  // reachable Firebase touchpoint the earlier ReviewProvider disconnect (C2) missed entirely: that
  // pass only removed the Firestore READ path (getReviewsStream/loadReviewStats), never noticing
  // this WRITE path sat right next to it, wired independently. Safe (getCurrentUserId() is always
  // null under canonical auth, so _checkForExistingUserReview always short-circuited before
  // reaching DatabaseService), but a live, tappable "Add Review" button whose dialog can only ever
  // fail is exactly the dishonest-affordance pattern this whole corrective phase exists to remove.
  // ReviewProvider itself already established there is no canonical successor for reviews at all;
  // this widget now just renders the same honest empty state unconditionally, with no way back
  // into Firebase. add_review_dialog.dart was reachable only from the button removed here and is
  // now fully orphaned -- deleted outright, not left as a second, harder-to-find dead end.
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Customer Reviews',
          style: AppTextStyles.titleLarge.copyWith(
            fontWeight: FontWeight.bold,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
        const SizedBox(height: 24),
        Expanded(child: _buildEmptyState()),
      ],
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.reviews_outlined, size: 60, color: isDark ? Colors.grey[700] : Colors.grey[300]),
          const SizedBox(height: 16),
          Text(
            'No Reviews Yet',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white70 : Colors.black87),
          ),
          const SizedBox(height: 8),
          Text(
            'Be the first to share your thoughts!',
            style: TextStyle(color: isDark ? Colors.grey[500] : Colors.grey[600]),
          ),
        ],
      ),
    );
  }
}
