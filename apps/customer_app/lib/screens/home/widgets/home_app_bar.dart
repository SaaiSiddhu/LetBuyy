import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'address_selection_sheet.dart';
import 'inline_voice_search_overlay.dart';

class HomeAppBar extends StatelessWidget {
  final double scrollOffset;

  const HomeAppBar({
    super.key,
    required this.scrollOffset,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final statusBarHeight = MediaQuery.of(context).padding.top;
    
    // Calculate collapse progress (0 = expanded, 1 = collapsed)
    final double collapseProgress = (scrollOffset / 80).clamp(0.0, 1.0);
    
    // Header heights
    final double addressBarHeight = 44 * (1 - collapseProgress);

    return Container(
      decoration: BoxDecoration(
        // Premium gradient background like Flipkart
        gradient: LinearGradient(
          colors: isDark
              ? [AppColors.primaryDark, AppColors.primaryDarker, AppColors.surfaceDark]
              : [AppColors.primaryDark, AppColors.primary, AppColors.primaryLight],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        // Subtle bottom shadow
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
          SizedBox(height: statusBarHeight),
  
          // Address Bar (collapses)
          AnimatedContainer(
            duration: const Duration(milliseconds: 100),
            height: addressBarHeight,
            child: addressBarHeight > 10
                ? Opacity(
                    opacity: 1 - collapseProgress,
                    child: _buildAddressBar(context, isDark),
                  )
                : const SizedBox.shrink(),
          ),
  
          // Search Bar (Flipkart style - large white rounded)
          _buildSearchBar(context, isDark),
  
          const SizedBox(height: 12),
        ],
      ),
    );
  }

  Widget _buildAddressBar(BuildContext context, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Row(
        children: [
          // Location Icon
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.location_on_rounded, color: Colors.white, size: 16),
          ),
          const SizedBox(width: 10),
          
          // Address Text
          Expanded(child: _buildAddressStream(context)),
          
          // Loyalty Points Badge
          _buildLoyaltyBadge(context),
        ],
      ),
    );
  }

  Widget _buildAddressStream(BuildContext context) {
    // Note: In a stateless widget, we might ideally pass the selected address as a param
    // But for now, we'll keep the stream logic or use a provider if available
    // Assuming Provider usage or local StreamBuilder for self-containment
    
    final userId = FirebaseAuth.instance.currentUser?.uid;
    if (userId == null) return _buildAddressContent(context, 'Select delivery location');

    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('addresses')
          .where('userId', isEqualTo: userId)
          .where('isDefault', isEqualTo: true)
          .limit(1)
          .snapshots(),
      builder: (context, snapshot) {
        String addressText = 'Add delivery address';
        if (snapshot.hasData && snapshot.data!.docs.isNotEmpty) {
          final data = snapshot.data!.docs.first.data() as Map<String, dynamic>;
          final line1 = data['addressLine1'] ?? '';
          final city = data['city'] ?? '';
          final state = data['state'] ?? '';
          addressText = '$line1, $city, $state';
          if (addressText.length > 35) addressText = '${addressText.substring(0, 32)}...';
        }
        return _buildAddressContent(context, addressText);
      },
    );
  }

  Widget _buildAddressContent(BuildContext context, String text) {
    return GestureDetector(
      onTap: () async {
        HapticFeedback.mediumImpact();
        await AddressSelectionSheet.show(context);
        // Note: The parent might need to know about address changes if it maintains state
        // For now, this triggers the sheet which updates Firestore/Provider
      },
      child: Row(
        children: [
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.2,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 4),
          const Icon(Icons.keyboard_arrow_down_rounded, color: Colors.white, size: 20),
        ],
      ),
    );
  }

  Widget _buildLoyaltyBadge(BuildContext context) {
    final userId = FirebaseAuth.instance.currentUser?.uid;
    if (userId == null) return const SizedBox.shrink();

    return StreamBuilder<DocumentSnapshot>(
      stream: FirebaseFirestore.instance.collection('loyalty').doc(userId).snapshots(),
      builder: (context, snapshot) {
        int points = 0;
        if (snapshot.hasData && snapshot.data!.exists) {
          final data = snapshot.data!.data() as Map<String, dynamic>?;
          points = (data?['points'] ?? 0) as int;
        }

        return GestureDetector(
          onTap: () {
            HapticFeedback.lightImpact();
            Navigator.pushNamed(context, '/loyalty');
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFFFD700), Color(0xFFFFA000)],
              ),
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: AppColors.warning.withValues(alpha: 0.4),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.bolt_rounded, color: Colors.white, size: 16),
                const SizedBox(width: 4),
                Text(
                  '$points',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildSearchBar(BuildContext context, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          // Main Search Bar (Large white rounded)
          Expanded(
            child: GestureDetector(
              onTap: () => Navigator.pushNamed(context, '/search'),
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
                        'Search for products, brands...',
                        style: TextStyle(
                          color: Colors.grey[500],
                          fontSize: 15,
                          fontWeight: FontWeight.w400,
                        ),
                      ),
                    ),
                    // Voice Search Icon (Inside Search Bar)
                    GestureDetector(
                      onTap: () {
                        HapticFeedback.mediumImpact();
                        InlineVoiceSearchOverlay.show(context);
                      },
                      child: Container(
                        padding: const EdgeInsets.all(8),
                        child: Icon(Icons.mic_rounded, color: Colors.grey[600], size: 24),
                      ),
                    ),
                    const SizedBox(width: 4),
                  ],
                ),
              ),
            ),
          ),
          
          const SizedBox(width: 12),
          
          // Camera/Visual Search Button (Standalone)
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              Navigator.pushNamed(context, '/visual-search');
            },
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
