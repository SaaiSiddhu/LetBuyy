import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_controller.dart';
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
          const Expanded(child: _HomeDeliveryAddressBar()),
        ],
      ),
    );
  }

  // C3 (Firebase SDK removal, 27 September 2026 review continuation): _buildLoyaltyBadge deleted
  // outright, not just hidden -- it read FirebaseFirestore.instance.collection('loyalty') behind a
  // safeFirebaseUserId() == null guard that is always true under canonical auth, so it already
  // rendered nothing (SizedBox.shrink()) for every real buyer; deleting it changes nothing
  // observable. Its own tap target, the '/loyalty' route (LoyaltyScreen), is retired in this same
  // pass -- profile_screen.dart's own doc comment already found LoyaltyScreen "can never show
  // real, changing data for any user" and removed its OTHER entry point; this was the one it
  // missed. See main.dart's own doc comment for the full disposition.

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

// C3 (Firebase SDK removal, 27 September 2026 review finding 3 follow-up): this replaces
// _buildAddressStream/_buildAddressContent, a THIRD independent, legacy Firebase-backed address
// display in this app -- distinct from AddressProvider (already disconnected) and from
// address_selection_sheet.dart's own list (already REWIRE'd onto BuyerAddressApi in an earlier
// commit). It read FirebaseFirestore.instance.collection('addresses') directly, guarded by
// safeFirebaseUserId() == null, which is always true under canonical auth -- so it never crashed,
// but it also always showed the same "Select delivery location"/"Add delivery address" default,
// on the app's most-visited screen, even after a real user picked a real address in the (now-
// working) AddressSelectionSheet. That sheet already returns the selected AddressModel from
// AddressSelectionSheet.show() (Navigator.pop(context, address)) -- this widget's onTap now uses
// that return value directly, and separately loads the buyer's actual default address on account
// change, both through the same canonical BuyerAddressApi and the same monotonic-generation-counter
// pattern already established in address_selection_sheet.dart (see that file's own doc comment for
// the two concurrency bugs a naive token-comparison approach has and why a generation counter avoids
// both).
class _HomeDeliveryAddressBar extends StatefulWidget {
  const _HomeDeliveryAddressBar();

  @override
  State<_HomeDeliveryAddressBar> createState() => _HomeDeliveryAddressBarState();
}

class _HomeDeliveryAddressBarState extends State<_HomeDeliveryAddressBar> {
  int _loadGeneration = 0;
  String? _observedToken;
  bool _loading = false;
  AddressModel? _address;

  bool _isCurrentGeneration(int generation) => mounted && generation == _loadGeneration;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final token = context.read<BuyerSignInController>().token;
    if (token != _observedToken) {
      _observedToken = token;
      _startLoadForToken(token);
    }
  }

  void _startLoadForToken(String? token) {
    final generation = ++_loadGeneration;
    setState(() {
      _address = null;
      _loading = token != null;
    });
    if (token == null) return;
    _fetchDefaultAddress(token, generation);
  }

  Future<void> _fetchDefaultAddress(String token, int generation) async {
    try {
      final addresses = await context.read<BuyerAddressApi>().list(token);
      if (!_isCurrentGeneration(generation)) return;
      BuyerAddress? defaultAddress;
      for (final address in addresses) {
        if (address.isDefault) {
          defaultAddress = address;
          break;
        }
      }
      defaultAddress ??= addresses.isEmpty ? null : addresses.first;
      setState(() {
        _address = defaultAddress == null ? null : _toAddressModel(defaultAddress!);
        _loading = false;
      });
    } catch (_) {
      // Same fail-quiet contract this bar always had (its Firestore predecessor's builder never
      // surfaced a load error either) -- falls back to the "Select delivery location" prompt below.
      if (!_isCurrentGeneration(generation)) return;
      setState(() => _loading = false);
    }
  }

  /// [BuyerAddress] has no photo/lat-long concept of its own -- this is purely a display adapter,
  /// the same mapping address_selection_sheet.dart's own _addressModelFromBuyerAddress already uses.
  AddressModel _toAddressModel(BuyerAddress address) {
    return AddressModel(
      id: address.id,
      userId: '',
      name: address.fullName,
      phone: address.phone ?? '',
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 ?? '',
      city: address.city,
      state: address.state,
      zipcode: address.postalCode,
      country: address.country,
      isDefault: address.isDefault,
      addressType: address.label,
      landmark: address.landmark,
    );
  }

  String get _displayText {
    if (_loading) return 'Loading address...';
    final address = _address;
    if (address == null) return 'Select delivery location';
    var text = '${address.addressLine1}, ${address.city}, ${address.state}';
    if (text.length > 35) text = '${text.substring(0, 32)}...';
    return text;
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () async {
        HapticFeedback.mediumImpact();
        final selected = await AddressSelectionSheet.show(context);
        // The sheet already resolved this exact address against BuyerAddressApi to show it as a
        // pickable card -- using it directly here means the bar updates the instant the sheet
        // closes, with no extra round trip and no risk of racing a background refresh.
        if (selected != null && mounted) {
          setState(() => _address = selected);
        }
      },
      child: Row(
        children: [
          Expanded(
            child: Text(
              _displayText,
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
}
