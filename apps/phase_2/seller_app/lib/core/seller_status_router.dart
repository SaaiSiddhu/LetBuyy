// lib/core/seller_status_router.dart
// Centralized routing logic based on seller status - Single source of truth

import 'package:flutter/foundation.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import '../app/routes.dart';
import '../services/deep_link_service.dart';

/// Single source of truth for seller status → route mapping
/// This replaces scattered logic in MobileAuthWrapper, WebAuthWrapper, and SellerMainScreen
class SellerStatusRouter {
  /// Determine the correct route for a seller based on their verification status
  /// Returns null if user should be signed out (e.g., suspended)
  static String? getRouteForSeller({
    required SellerModel? seller,
    String? deepLink,
    bool hasFirebaseUser = true,
  }) {
    // No Firebase user at all - go to login
    if (!hasFirebaseUser) {
      debugPrint('🔀 SellerStatusRouter: No Firebase user → login');
      return AppRoutes.login;
    }

    // Firebase user exists but no seller document - new seller
    if (seller == null) {
      debugPrint('🔀 SellerStatusRouter: No seller data → welcome (new seller)');
      return AppRoutes.welcome;
    }

    // Route based on verification status
    switch (seller.verificationStatus) {
      case VerificationStatus.verified:
        return _getVerifiedRoute(seller, deepLink);

      case VerificationStatus.pending:
        // KYC is submitted if panNumber is set (Cloud Function sets this immediately)
        final hasSubmittedKyc = seller.panNumber.isNotEmpty;
        if (hasSubmittedKyc) {
          debugPrint('🔀 SellerStatusRouter: Pending + KYC submitted → kyc-status');
          return AppRoutes.kycStatus;
        } else {
          debugPrint('🔀 SellerStatusRouter: Pending but KYC incomplete → welcome');
          return AppRoutes.welcome;
        }

      case VerificationStatus.rejected:
        debugPrint('🔀 SellerStatusRouter: Rejected → kyc-rejected');
        return AppRoutes.kycRejected;

      case VerificationStatus.suspended:
        debugPrint('🔀 SellerStatusRouter: Suspended → suspended screen');
        return AppRoutes.suspended;

      default:
        return _getIncompleteRoute(seller);
    }
  }

  /// Get route for verified sellers (may include deep link handling)
  static String _getVerifiedRoute(SellerModel seller, String? deepLink) {
    // Check deep link first - if it's a valid app route, use it
    if (deepLink != null && deepLink != '/' && deepLink != '/auth') {
      final deepLinkService = DeepLinkService();
      if (!deepLinkService.isAuthRoute(deepLink)) {
        debugPrint('🔀 SellerStatusRouter: Verified + deep link → $deepLink');
        return deepLink;
      }
    }

    // Check pending deep link (stored before login)
    final pendingLink = DeepLinkService().pendingDeepLink;
    if (pendingLink != null) {
      DeepLinkService().clearPendingDeepLink();
      debugPrint('🔀 SellerStatusRouter: Verified + pending deep link → $pendingLink');
      return pendingLink;
    }

    debugPrint('🔀 SellerStatusRouter: Verified → seller-main');
    return AppRoutes.sellerMain;
  }

  /// Get route for users with incomplete verification
  static String _getIncompleteRoute(SellerModel seller) {
    // Check email verification first
    if (!seller.emailVerified) {
      debugPrint('🔀 SellerStatusRouter: Email not verified → verify-email');
      return AppRoutes.verifyEmail;
    }

    // Check profile completion
    final isProfileComplete = seller.storeName.isNotEmpty && 
                              seller.businessAddress.isNotEmpty;
    if (!isProfileComplete) {
      debugPrint('🔀 SellerStatusRouter: Profile incomplete → kyc-wizard');
      return AppRoutes.kycBusiness;
    }

    // Default to KYC wizard
    debugPrint('🔀 SellerStatusRouter: Status unknown → kyc-wizard');
    return AppRoutes.kycWizard;
  }

  /// Check if a route requires the user to be verified
  static bool requiresVerification(String route) {
    final protectedRoutes = [
      AppRoutes.sellerMain,
      AppRoutes.sellerProducts,
      AppRoutes.sellerOrders,
      AppRoutes.sellerWallet,
      AppRoutes.sellerAnalytics,
      AppRoutes.sellerSettings,
      AppRoutes.sellerReturns,
      AppRoutes.notifications,
    ];
    
    final routePath = route.split('?').first;
    return protectedRoutes.contains(routePath);
  }
}
