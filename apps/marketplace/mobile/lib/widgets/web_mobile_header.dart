// lib/widgets/web_mobile_header.dart
// 💎 Mobile-style header for web (adapts HomeAppBar style with hamburger menu)

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';

import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace/app/routes.dart';
import '../auth/buyer_sign_in_controller.dart';
import '../screens/home/widgets/address_selection_sheet.dart';

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
          const Expanded(child: _WebDeliveryAddressBar()),
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

// C3 (Firebase SDK removal): replaces _buildAddressText/_addressTapWrapper -- the web platform's
// own copy of the same bug already fixed in home_app_bar.dart's _HomeDeliveryAddressBar (that
// file's own doc comment has the full account). It read FirebaseFirestore.instance.collection(
// 'addresses') directly, guarded by safeFirebaseUserId() == null, always true under canonical
// auth -- so this header, present on every web page via WebMobileHeader, always showed "Select
// delivery location," never a real signed-in buyer's actual address. Its old tap target,
// '/profile/addresses', is also a dead end: saved_addresses_screen.dart already renders an
// unconditional empty state (its own C2-era retirement comment), so tapping through there could
// never show a real address either -- redirected to AddressSelectionSheet.show(), the same
// canonical, working picker home_app_bar.dart's own bar opens, rather than leave a "fixed the
// display, still send you to a screen that can't show what you just saw" gap. Deliberately not
// fixed here (separately scoped, larger than this header's own bug): saved_addresses_screen.dart's
// and add_address_screen.dart's own dispositions.
class _WebDeliveryAddressBar extends StatefulWidget {
  const _WebDeliveryAddressBar();

  @override
  State<_WebDeliveryAddressBar> createState() => _WebDeliveryAddressBarState();
}

class _WebDeliveryAddressBarState extends State<_WebDeliveryAddressBar> {
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
      if (!_isCurrentGeneration(generation)) return;
      setState(() => _loading = false);
    }
  }

  /// Same display adapter address_selection_sheet.dart's own _addressModelFromBuyerAddress and
  /// home_app_bar.dart's _HomeDeliveryAddressBar._toAddressModel already use.
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
    if (_loading) return 'Loading...';
    final address = _address;
    if (address == null) return 'Select delivery location';
    // Preserves this header's own, more compact "city - postal code" format (distinct from
    // home_app_bar.dart's fuller line1/city/state) -- a deliberate prior design choice for this
    // narrower, mobile-style-on-web header, not something this fix changes.
    return '${address.city} - ${address.zipcode}';
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () async {
        HapticFeedback.mediumImpact();
        final selected = await AddressSelectionSheet.show(context);
        if (selected != null && mounted) {
          setState(() => _address = selected);
        }
      },
      child: Row(
        children: [
          Flexible(
            child: Text(
              _displayText,
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
}
