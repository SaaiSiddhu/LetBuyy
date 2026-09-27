import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:url_launcher/url_launcher.dart';


import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';

import 'add_address_screen.dart';
import 'payment_method_screen.dart';
import 'widgets/checkout_steps.dart';
import '../../widgets/premium_scaffold.dart';
import '../../auth/buyer_sign_in_controller.dart';

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  AddressModel? _selectedAddress;
  bool _isLoadingAddresses = true;
  List<AddressModel> _addresses = [];
  String? _addressLoadError;

  // C3 corrective (27 September 2026 review, finding 4): a monotonic generation counter, the same
  // pattern already established in address_selection_sheet.dart/home_app_bar.dart/
  // web_mobile_header.dart (see address_selection_sheet.dart's own doc comment for why a raw
  // token comparison isn't enough). _loadAddresses() used to check only `mounted` before applying
  // its result -- if the buyer's session ended or a different buyer signed in on this device while
  // the request was in flight, a late response would populate this still-mounted screen with
  // another buyer's addresses. Bumping the generation on every call and checking it's still current
  // before any setState closes that window, and also fixes the silent-failure gap next to it: a
  // failed load used to just stop the spinner, falling through to the same "No addresses found"
  // text a genuinely-empty account shows -- indistinguishable from "you have no addresses" when
  // the real story was "the request failed."
  int _loadGeneration = 0;

  bool _isCurrentGeneration(int generation) => mounted && generation == _loadGeneration;

  /// Protects a response already in flight: a load started for [token] is only ever applied if
  /// that buyer is STILL the current one when the response arrives.
  bool _isStillCurrentBuyer(String token) =>
      mounted && context.read<BuyerSignInController>().token == token;

  // C3 corrective (27 September 2026 review continuation, section 4C): _isStillCurrentBuyer alone
  // only ever protects a response already in flight -- it does nothing if the buyer signs out or a
  // different buyer signs in on this device while this screen is simply sitting idle with A's
  // addresses already loaded and rendered (no request pending to catch the change). This screen's
  // own build() below now watches BuyerSignInController, so didChangeDependencies fires once
  // Flutter next gives this element a dependency-check pass after that identity actually changes --
  // matching address_selection_sheet.dart's/home_app_bar.dart's own established pattern, the
  // previous buyer's records and selection are cleared synchronously, in the same setState, before
  // a fresh load for whoever is current now even starts.
  //
  // That "once Flutter next gives this element a pass" is not necessarily the very next frame: a
  // widget test proved this can be delayed past several frames, including past the point where
  // _isStillCurrentBuyer's own in-flight self-heal (above) already independently noticed the exact
  // same identity change and already re-loaded correctly. Without `_lastLoadStartedForToken`, this
  // method would not know that, and would redundantly clear the just-corrected screen and start a
  // second, unnecessary reload race against nothing. Set at the top of _loadAddresses() (by
  // initState's own first call, this method's own reload, or the in-flight self-heal), it lets
  // this method recognize "a load for this identity was already started" and stay a no-op then,
  // regardless of which path started it or in which order they actually ran.
  bool _hasObservedToken = false;
  String? _observedToken;
  String? _lastLoadStartedForToken;

  @override
  void initState() {
    super.initState();
    _loadAddresses();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final token = context.read<BuyerSignInController>().token;
    if (!_hasObservedToken) {
      // The very first call, right after initState -- initState's own _loadAddresses() call
      // already covers the initial load for whichever buyer (or guest) is current at that point.
      _hasObservedToken = true;
      _observedToken = token;
      return;
    }
    if (token != _observedToken) {
      _observedToken = token;
      if (_lastLoadStartedForToken == token) return;
      setState(() {
        _addresses = [];
        _selectedAddress = null;
        _addressLoadError = null;
      });
      _loadAddresses();
    }
  }

  @override
  void dispose() {
    super.dispose();
  }

  // C3 (Firebase SDK removal): was guarded on safeFirebaseUserId() == null, always true under
  // canonical auth -- but that guard just `return`ed, without ever setting _isLoadingAddresses to
  // false, so every real buyer saw this screen's address section spin forever: not merely "no
  // addresses shown," but stuck loading, permanently, with the "Place Order" button disabled the
  // entire time (hasAddress in _buildBottomBar can never become true). Now reads through the same
  // canonical BuyerAddressApi letbuyy_account_screen.dart and address_selection_sheet.dart use,
  // and resets the loading flag on every path, including "not signed in."
  Future<void> _loadAddresses() async {
    final generation = ++_loadGeneration;
    final token = context.read<BuyerSignInController>().token;
    _lastLoadStartedForToken = token;
    if (token == null) {
      if (_isCurrentGeneration(generation)) {
        setState(() {
          _isLoadingAddresses = false;
          _addressLoadError = null;
        });
      }
      return;
    }
    setState(() {
      _isLoadingAddresses = true;
      _addressLoadError = null;
    });
    try {
      final addresses = await context.read<BuyerAddressApi>().list(token);
      if (!_isCurrentGeneration(generation)) return;
      if (!_isStillCurrentBuyer(token)) {
        // A different buyer is current now than the one this request was made for -- this result
        // belongs to nobody looking at the screen any more. Rather than apply it (another buyer's
        // addresses) or leave this screen stuck on its pre-switch state (a spinner nothing will
        // ever clear, since only this one load was ever in flight), start a fresh load for
        // whoever is actually current -- self-healing rather than a second "stuck loading" bug.
        _loadAddresses();
        return;
      }
      setState(() {
        _addresses = addresses.map(_toAddressModel).toList()
          ..sort((a, b) {
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            return 0;
          });

        if (_addresses.isNotEmpty) {
          _selectedAddress = _addresses.firstWhere(
            (addr) => addr.isDefault,
            orElse: () => _addresses.first,
          );
        } else {
          // C3 corrective (27 September 2026 review continuation): a refreshed, now-empty list
          // (e.g. the previously selected address was the last one and it was deleted, from
          // add_address_screen.dart's own "Add New Address" round trip triggering this reload)
          // used to leave _selectedAddress dangling at its previous, no-longer-listed value.
          _selectedAddress = null;
        }

        _isLoadingAddresses = false;
      });
    } catch (e) {
      debugPrint('Error loading addresses: $e');
      if (!_isCurrentGeneration(generation)) return;
      if (!_isStillCurrentBuyer(token)) {
        _loadAddresses();
        return;
      }
      setState(() {
        _isLoadingAddresses = false;
        _addressLoadError = 'We couldn’t load your addresses right now.';
      });
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

  Future<void> _openInMaps(AddressModel addr) async {
    if (addr.latitude != null && addr.longitude != null) {
      final String googleMapsUrl =
          'https://www.google.com/maps/search/?api=1&query=${addr.latitude},${addr.longitude}';

      final Uri uri = Uri.parse(googleMapsUrl);

      try {
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        } else {
          _showSnackBar('Could not open maps', isError: true);
        }
      } catch (e) {
        debugPrint('Error opening maps: $e');
        _showSnackBar('Error opening maps', isError: true);
      }
    } else {
      _showSnackBar('Location coordinates not available', isError: true);
    }
  }

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(
              isError ? Icons.error_outline_rounded : Icons.check_circle_outline_rounded,
              color: Colors.white,
              size: 20,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ),
        backgroundColor: isError ? AppColors.error : AppColors.success,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        elevation: 4,
        duration: const Duration(seconds: 3),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = context.watch<ThemeProvider>().isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    final cardColor = isDark ? AppColors.surfaceDark : AppColors.surface;
    final backgroundColor = isDark ? AppColors.scaffoldDark : AppColors.scaffoldLight;

    // Establishes the dependency didChangeDependencies() above reacts to -- see that method's own
    // doc comment. The value itself isn't needed here; _loadAddresses() re-reads the token fresh.
    context.watch<BuyerSignInController>();

    final cartProvider = context.watch<CartProvider>();
    final subtotal = cartProvider.subtotal;
    // Phase 1R corrective (C2): was couponProvider.calculateDiscount(). CouponProvider was
    // entirely FirebaseFirestore-backed with no canonical successor; a coupon could never
    // actually load, so this already always evaluated to 0.
    const discount = 0.0;
    final total = subtotal - discount;

    return PremiumScaffold(
      // backgroundColor handled by PremiumScaffold
      appBar: _buildAppBar(isDark, cardColor),
      body: Column(
        children: [
          const CheckoutSteps(currentStep: 1),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              physics: const BouncingScrollPhysics(),
              child: Column(
                children: [
                  _buildAddressSection(isDark, cardColor, accentColor),
                ],
              ),
            ),
          ),
          _buildBottomBar(total, isDark, accentColor, cardColor),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(bool isDark, Color cardColor) {
    return AppBar(
      backgroundColor: cardColor,
      elevation: 0,
      title: Text(
        'Select Address',
        style: TextStyle(
          color: isDark ? AppColors.textLight : AppColors.textPrimary,
          fontWeight: FontWeight.w800,
          fontSize: 18,
          letterSpacing: -0.3,
        ),
      ),
      leading: IconButton(
        icon: Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: isDark ? AppColors.backgroundDark : AppColors.background,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(
            Icons.arrow_back_ios_new_rounded,
            color: isDark ? AppColors.textLight : AppColors.textPrimary,
            size: 16,
          ),
        ),
        onPressed: () => Navigator.pop(context),
      ),
      centerTitle: true,
    );
  }

  Widget _buildAddressSection(bool isDark, Color cardColor, Color accentColor) {
    return _buildCardSection(
      isDark: isDark,
      cardColor: cardColor,
      title: 'Delivery Address',
      icon: Icons.location_on_rounded,
      accentColor: accentColor,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_isLoadingAddresses)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: CircularProgressIndicator(
                  color: accentColor,
                  strokeWidth: 2.5,
                ),
              ),
            )
          else if (_addressLoadError != null)
            Column(
              children: [
                Icon(
                  Icons.error_outline_rounded,
                  size: 48,
                  color: isDark ? Colors.grey[600] : Colors.grey[400],
                ),
                const SizedBox(height: 12),
                Text(
                  _addressLoadError!,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: _loadAddresses,
                  child: const Text('Retry'),
                ),
                const SizedBox(height: 16),
              ],
            )
          else if (_addresses.isEmpty)
            Column(
              children: [
                Icon(
                  Icons.location_off_rounded,
                  size: 48,
                  color: isDark ? Colors.grey[600] : Colors.grey[400],
                ),
                const SizedBox(height: 12),
                Text(
                  'No addresses found',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Please add a delivery address to continue',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: isDark ? Colors.grey[500] : Colors.grey[500],
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
              ],
            )
          else
            Column(
              children: _addresses.map((addr) {
                final isSelected = _selectedAddress?.id == addr.id;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _buildDetailedAddressCard(
                    address: addr,
                    isSelected: isSelected,
                    isDark: isDark,
                    accentColor: accentColor,
                    onTap: () {
                      setState(() => _selectedAddress = addr);
                      HapticFeedback.selectionClick();
                    },
                  ),
                );
              }).toList(),
            ),
          const SizedBox(height: 4),
          OutlinedButton.icon(
            onPressed: () async {
              await Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => const AddAddressScreen(),
                ),
              );
              _loadAddresses();
            },
            icon: Icon(
              Icons.add_location_alt_outlined,
              size: 18,
              color: accentColor,
            ),
            label: Text(
              'Add New Address',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 14,
                color: accentColor,
              ),
            ),
            style: OutlinedButton.styleFrom(
              side: BorderSide(color: accentColor, width: 1.5),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            ),
          ),
        ],
      ),
    );
  }

  // EXACT SAME ADDRESS CARD FROM PAYMENT SCREEN
  Widget _buildDetailedAddressCard({
    required AddressModel address,
    required bool isSelected,
    required bool isDark,
    required Color accentColor,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isSelected
              ? accentColor.withValues(alpha: 0.1)
              : (isDark ? AppColors.surfaceDarkVariant : AppColors.background),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected
                ? accentColor
                : (isDark ? AppColors.borderDark : AppColors.borderLight),
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Name
                      Row(
                        children: [
                          Icon(
                            Icons.person_outline_rounded,
                            size: 16,
                            color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              address.name,
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                color: isDark ? AppColors.textLight : AppColors.textPrimary,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      // Phone
                      Row(
                        children: [
                          Icon(
                            Icons.phone_outlined,
                            size: 16,
                            color: isDark ? Colors.grey[500] : Colors.grey[600],
                          ),
                          const SizedBox(width: 8),
                          Text(
                            address.phone,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: isDark ? Colors.grey[300] : Colors.grey[700],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                // Map button + Radio button
                Row(
                  children: [
                    if (address.latitude != null && address.longitude != null)
                      IconButton(
                        onPressed: () => _openInMaps(address),
                        icon: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: accentColor.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Icon(
                            Icons.map_outlined,
                            color: accentColor,
                            size: 16,
                          ),
                        ),
                        tooltip: 'Open in Maps',
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                      ),
                    const SizedBox(width: 8),
                    Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: isSelected
                              ? accentColor
                              : (isDark ? Colors.grey[600]! : Colors.grey[400]!),
                          width: 2,
                        ),
                        color: isSelected ? accentColor : Colors.transparent,
                      ),
                      child: isSelected
                          ? const Icon(Icons.check, color: Colors.white, size: 16)
                          : null,
                    ),
                  ],
                ),
              ],
            ),

            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Divider(
                color: isDark ? AppColors.borderDark : AppColors.borderLight,
                height: 1,
              ),
            ),

            // Address Line 1
            _buildAddressRow(
              icon: Icons.home_outlined,
              value: address.addressLine1,
              isDark: isDark,
            ),

            // Address Line 2 (if exists)
            if (address.addressLine2.isNotEmpty) ...[
              const SizedBox(height: 8),
              _buildAddressRow(
                icon: Icons.location_city_outlined,
                value: address.addressLine2,
                isDark: isDark,
                isSecondary: true,
              ),
            ],

            // Landmark (if exists)
            if (address.landmark != null && address.landmark!.isNotEmpty) ...[
              const SizedBox(height: 8),
              _buildAddressRow(
                icon: Icons.place_outlined,
                value: 'Near ${address.landmark}',
                isDark: isDark,
              ),
            ],

            const SizedBox(height: 12),

            // City, State, Zipcode
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _buildLocationChip(
                  icon: Icons.location_city,
                  label: address.city,
                  isDark: isDark,
                ),
                _buildLocationChip(
                  icon: Icons.map_outlined,
                  label: address.state,
                  isDark: isDark,
                ),
                _buildLocationChip(
                  icon: Icons.pin_drop_outlined,
                  label: address.zipcode,
                  isDark: isDark,
                ),
              ],
            ),

            // Country (if not India)
            if (address.country.isNotEmpty && address.country != 'India') ...[
              const SizedBox(height: 8),
              _buildLocationChip(
                icon: Icons.flag_outlined,
                label: address.country,
                isDark: isDark,
              ),
            ],

            // Address Type Badge (if exists)
            if (address.addressType != null && address.addressType!.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: _getAddressTypeColor(address.addressType!).withValues(alpha: 0.15),
                  border: Border.all(
                    color: _getAddressTypeColor(address.addressType!).withValues(alpha: 0.3),
                  ),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      _getAddressTypeIcon(address.addressType!),
                      size: 14,
                      color: _getAddressTypeColor(address.addressType!),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      address.addressType!.toUpperCase(),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: _getAddressTypeColor(address.addressType!),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildAddressRow({
    required IconData icon,
    required String value,
    required bool isDark,
    bool isSecondary = false,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (!isSecondary)
          Icon(
            icon,
            size: 16,
            color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
          ),
        if (!isSecondary) const SizedBox(width: 8),
        if (isSecondary) const SizedBox(width: 24),
        Expanded(
          child: Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: isDark ? AppColors.textLight : AppColors.textPrimary,
              height: 1.5,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildLocationChip({
    required IconData icon,
    required String label,
    required bool isDark,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDarkVariant : AppColors.background,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.borderLight,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 12,
            color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: isDark ? AppColors.textLight : AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }

  IconData _getAddressTypeIcon(String type) {
    switch (type.toLowerCase()) {
      case 'home':
        return Icons.home_rounded;
      case 'office':
      case 'work':
        return Icons.work_rounded;
      default:
        return Icons.location_on_rounded;
    }
  }

  Color _getAddressTypeColor(String type) {
    switch (type.toLowerCase()) {
      case 'home':
        return AppColors.info;
      case 'office':
      case 'work':
        return AppColors.warning;
      default:
        return AppColors.accent;
    }
  }

  Widget _buildCardSection({
    required Widget child,
    required bool isDark,
    required Color cardColor,
    required Color accentColor,
    String? title,
    IconData? icon,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null)
            Container(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(
                    color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
                    width: 1,
                  ),
                ),
              ),
              child: Row(
                children: [
                  Icon(icon, color: accentColor, size: 18),
                  const SizedBox(width: 10),
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.2,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                ],
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: child,
          ),
        ],
      ),
    );
  }

  Widget _buildBottomBar(double total, bool isDark, Color accentColor, Color cardColor) {
    final hasAddress = _selectedAddress != null;

    return Container(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.of(context).padding.bottom),
      decoration: BoxDecoration(
        color: cardColor,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.1),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
        border: Border(
          top: BorderSide(color: isDark ? Colors.grey[800]! : Colors.grey[200]!),
        ),
      ),
      child: ElevatedButton(
        onPressed: hasAddress
            ? () {
                HapticFeedback.mediumImpact();
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => PaymentMethodScreen(
                      selectedAddress: _selectedAddress!,
                      total: total,
                    ),
                  ),
                );
              }
            : null,
        style: ElevatedButton.styleFrom(
          minimumSize: const Size(double.infinity, 54),
          backgroundColor: accentColor,
          foregroundColor: isDark ? Colors.black : Colors.white,
          disabledBackgroundColor: accentColor.withValues(alpha: 0.5),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          padding: const EdgeInsets.symmetric(vertical: 14),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              hasAddress ? Icons.arrow_forward_rounded : Icons.location_off_rounded,
              size: 20,
            ),
            const SizedBox(width: 10),
            Text(
              hasAddress ? 'Continue to Payment' : 'Select Address',
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.3,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
