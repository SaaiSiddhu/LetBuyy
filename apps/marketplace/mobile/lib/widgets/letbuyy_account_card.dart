// APPID-P4d — the profile screen's "LetBuyy account" card. Shown only when LETBUYY_BUYER_SIGN_IN is
// on (see profile_screen.dart); it signs the app in to the buyer's one LetBuyy account in the system
// browser, and says, in words, what happened: signed in, cancelled, expired, offline, and whether the
// app's existing account was linked.

import 'package:flutter/material.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace/app/routes.dart';
import 'package:provider/provider.dart';

import '../auth/buyer_sign_in_controller.dart';

class LetBuyyAccountCard extends StatelessWidget {
  const LetBuyyAccountCard({super.key, required this.isDark});

  final bool isDark;

  static String? linkMessage(FirebaseLinkResult? result) => switch (result) {
        null => null,
        FirebaseLinkResult.linked || FirebaseLinkResult.alreadyLinked => 'Your existing LetBuyy app account is linked to it.',
        FirebaseLinkResult.notVerified => 'Verify your email address with LetBuyy to link your existing app account.',
        FirebaseLinkResult.emailMismatch => 'Your existing app account uses a different email address, so it wasn’t linked.',
        FirebaseLinkResult.conflict => 'Your existing app account is already linked to another LetBuyy account.',
        FirebaseLinkResult.noVerifiedFirebaseEmail => 'Your existing app account has no verified email address, so it wasn’t linked yet.',
        FirebaseLinkResult.unavailable => 'We couldn’t link your existing app account just now. We’ll try again next time.',
        FirebaseLinkResult.refused => 'We couldn’t link your existing app account. Sign in to it again, then retry.',
      };

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<BuyerSignInController>();
    final status = controller.status;
    final busy = status == BuyerSignInStatus.restoring || status == BuyerSignInStatus.completing;
    final muted = (isDark ? Colors.white : Colors.black).withValues(alpha: 0.6);
    final link = status == BuyerSignInStatus.signedIn ? linkMessage(controller.firebaseLink) : null;

    final String headline = switch (status) {
      BuyerSignInStatus.signedIn => controller.email == null ? 'Signed in' : 'Signed in as ${controller.email}',
      BuyerSignInStatus.waitingForBrowser => 'Finish signing in in your browser',
      BuyerSignInStatus.restoring || BuyerSignInStatus.completing => 'Checking your sign-in…',
      BuyerSignInStatus.signedOut => 'One account for the LetBuyy app and every LetBuyy store',
    };

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: isDark ? 0.05 : 0.7),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: (isDark ? Colors.white : Colors.black).withValues(alpha: isDark ? 0.05 : 0.03)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(headline, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: isDark ? Colors.white : Colors.black87)),
          if (controller.message != null) ...[
            const SizedBox(height: 6),
            Semantics(liveRegion: true, child: Text(controller.message!, style: TextStyle(fontSize: 13, color: muted))),
          ],
          if (link != null) ...[
            const SizedBox(height: 6),
            Text(link, style: TextStyle(fontSize: 13, color: muted)),
          ],
          const SizedBox(height: 12),
          if (busy)
            const Center(child: SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2)))
          else if (status == BuyerSignInStatus.waitingForBrowser)
            OutlinedButton(onPressed: controller.cancel, child: const Text('Cancel sign-in'))
          else if (status == BuyerSignInStatus.signedIn) ...[
            // SUSTAINED-L: the canonical profile/address book, only reachable once signed in.
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
              onPressed: () => Navigator.of(context).pushNamed(AppRoutes.letbuyyAccount),
              child: const Text('Manage profile & addresses'),
            ),
            const SizedBox(height: 8),
            OutlinedButton(onPressed: controller.signOut, child: const Text('Sign out of LetBuyy on this device')),
          ] else
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: AppColors.primary),
              onPressed: controller.signIn,
              child: const Text('Sign in with LetBuyy'),
            ),
        ],
      ),
    );
  }
}
