import 'package:flutter/material.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

// Phase 1R corrective (C2): ReelService's constructor initialized `_firestore` via
// `firestore ?? FirebaseFirestore.instance` in its initializer list -- eager, not lazy, exactly
// the pattern R1.3's sweep was built to catch and structurally could not (a fallback expression,
// not a bare `= Firebase<Type>.instance` assignment). Confirmed empirically: FirebaseFirestore.instance
// throws synchronously with no Firebase.initializeApp() call. This screen's own State held
// `final ReelService _reelService = ReelService();` as a field initializer, which runs at State
// construction -- i.e. whenever this widget is first built, unconditionally, since it sits in
// MainScreen's/WebMainScreen's IndexedStack alongside every other tab.
//
// Per the corrective review: full canonical reels belong to a later phase (Phase 7); a
// nonfunctional legacy Firebase reel feed is not worth preserving with more try/catch wrappers.
// Replaced outright with this honest placeholder rather than patched. saved_reels_screen.dart
// and widgets/reel_comments_sheet.dart were reachable only from this screen's own UI and are now
// fully orphaned -- deleted along with the '/saved-reels' route.
class ReelsFeedScreen extends StatelessWidget {
  final bool isTabActive;
  final String? initialReelId;

  const ReelsFeedScreen({
    super.key,
    this.isTabActive = true,
    this.initialReelId,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      color: isDark ? Colors.black : Colors.white,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.video_collection_outlined,
                size: 64,
                color: isDark ? Colors.white38 : Colors.grey[400],
              ),
              const SizedBox(height: 20),
              Text(
                'Reels are coming soon',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: isDark ? Colors.white : AppColors.textPrimary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Short product videos will be available in a later update.',
                style: TextStyle(
                  fontSize: 14,
                  color: isDark ? Colors.white54 : Colors.grey[600],
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
