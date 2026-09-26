// lib/widgets/web_mobile_header.dart
// 💎 Mobile-style header for web (adapts HomeAppBar style with hamburger menu)

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace/app/routes.dart';
import '../auth/buyer_sign_in_controller.dart';

/// Mobile-style header for web with hamburger menu
/// Adapts the native mobile app bar design for mobile web
class WebMobileHeader extends StatelessWidget {
  final VoidCallback? onMenuPressed;
  
  const WebMobileHeader({
    super.key,
    this.onMenuPressed,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final statusBarHeight = MediaQuery.of(context).padding.top;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        // Premium gradient background like Flipkart (Exact match to HomeAppBar)
        gradient: LinearGradient(
          colors: isDark
              ? [AppColors.primaryDark, AppColors.primaryDarker, AppColors.surfaceDark]
              : [AppColors.primaryDark, AppColors.primary, AppColors.primaryLight],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: (isDark ? Colors.black : AppColors.primaryDark).withValues(alpha: 0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Top Row: Hamburger + Logo + Actions
          _buildTopRow(context, isDark),
          
          // Address Row (Thin)
          _buildAddressRow(context, isDark),
          
          const SizedBox(height: 8),
          
          // Search Row: Search Bar + Camera Button
          _buildSearchRow(context, isDark),
          
          const SizedBox(height: 12),
        ],
      ),
    );
  }

  Widget _buildTopRow(BuildContext context, bool isDark) {
    // Phase 1R corrective (C2): the "Login" vs. signed-in icon below used to check
    // safeFirebaseCurrentUser() == null, which is always true now that canonical "Sign in with
    // LetBuyy" is the app's sole sign-in and never touches FirebaseAuth -- meaning it always
    // showed "Login" even for a signed-in buyer. Checks the canonical status instead.
    final isSignedIn =
        context.watch<BuyerSignInController>().status == BuyerSignInStatus.signedIn;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          // Hamburger Menu
          if (onMenuPressed != null)
             Padding(
               padding: const EdgeInsets.only(right: 12),
               child: GestureDetector(
                onTap: () {
                  HapticFeedback.lightImpact();
                  onMenuPressed?.call();
                },
                child: const Icon(Icons.menu_rounded, color: Colors.white, size: 24),
              ),
             ),

          // LOGO
          const Text(
            'LetBuyy',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w900,
              fontStyle: FontStyle.italic,
              letterSpacing: 0.5,
            ),
          ),
          
          const Spacer(),

          // App Download Button
          Tooltip(
            message: 'Download App',
            child: GestureDetector(
              onTap: () {
                // TODO: Link to app store
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                child: const Icon(Icons.phone_android_rounded, color: Colors.white, size: 22),
              ),
            ),
          ),

          const SizedBox(width: 8),

          // Login Button
          if (!isSignedIn)
            GestureDetector(
              onTap: () => Navigator.pushNamed(context, AppRoutes.profile),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Row(
                  children: [
                    Icon(Icons.person_rounded, color: AppColors.primary, size: 16),
                    const SizedBox(width: 4),
                    Text(
                      'Login',
                      style: TextStyle(
                        color: AppColors.primary,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            )
          else 
            // User Icon if logged in
            GestureDetector(
               onTap: () => Navigator.pushNamed(context, AppRoutes.profile),
               child: const Icon(Icons.person_outline_rounded, color: Colors.white, size: 24),
            ),
           
           const SizedBox(width: 12),
           
           // Cart
          Consumer<CartProvider>(
            builder: (context, cart, _) {
              return GestureDetector(
                onTap: () => Navigator.pushNamed(context, AppRoutes.cart),
                child: Badge(
                  isLabelVisible: cart.itemCount > 0,
                  label: Text('${cart.itemCount}'),
                  backgroundColor: AppColors.error,
                  child: const Icon(Icons.shopping_cart_outlined, color: Colors.white, size: 24),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildAddressRow(BuildContext context, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Row(
        children: [
          const Icon(Icons.location_on_outlined, color: Colors.white70, size: 14),
          const SizedBox(width: 4),
          Text(
            'Location not set',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.9),
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: _buildAddressText(context, isDark),
          ),
        ],
      ),
    );
  }

  Widget _buildAddressText(BuildContext context, bool isDark) {
    final userId = safeFirebaseUserId();
    if (userId == null) {
      return _addressTapWrapper(context, 'Select delivery location');
    }

    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('addresses')
          .where('userId', isEqualTo: userId)
          .where('isDefault', isEqualTo: true)
          .limit(1)
          .snapshots(),
      builder: (context, snapshot) {
        String text = 'Select delivery location';
        if (snapshot.hasData && snapshot.data!.docs.isNotEmpty) {
          final data = snapshot.data!.docs.first.data() as Map<String, dynamic>;
          final city = data['city'] ?? '';
          final pincode = data['pincode'] ?? '';
          text = city.isNotEmpty ? '$city - $pincode' : 'Select delivery location';
        }
        return _addressTapWrapper(context, text);
      },
    );
  }

  Widget _addressTapWrapper(BuildContext context, String text) {
    return GestureDetector(
      onTap: () => Navigator.pushNamed(context, '/profile/addresses'),
      child: Row(
        children: [
          Flexible(
            child: Text(
              text,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 11,
                fontWeight: FontWeight.bold,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 2),
          const Icon(Icons.keyboard_arrow_right_rounded, color: Colors.white, size: 14),
        ],
      ),
    );
  }

  Widget _buildSearchRow(BuildContext context, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          // Main Search Bar (White)
          Expanded(
            child: GestureDetector(
              onTap: () => Navigator.pushNamed(context, AppRoutes.search),
              child: Container(
                height: 48,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.1),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    const SizedBox(width: 14),
                    Icon(Icons.search_rounded, color: Colors.grey[600], size: 24),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Search for products...',
                        style: TextStyle(
                          color: Colors.grey[500],
                          fontSize: 15,
                          fontWeight: FontWeight.w400,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                     Padding(
                       padding: const EdgeInsets.all(8.0),
                       child: Icon(Icons.mic_rounded, color: Colors.grey[600], size: 24),
                     ),
                  ],
                ),
              ),
            ),
          ),
          
          const SizedBox(width: 12),
          
          // Camera Button (Separate)
          GestureDetector(
            onTap: () => Navigator.pushNamed(context, '/visual-search'),
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
              ),
              child: Icon(
                Icons.camera_alt_outlined,
                color: Colors.white.withValues(alpha: 0.9),
                size: 24,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
