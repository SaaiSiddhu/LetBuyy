import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import '../../auth/buyer_sign_in_controller.dart';
import '../../data/marketplace_checkout.dart';
import 'widgets/checkout_steps.dart';
import '../../widgets/premium_scaffold.dart';

class PaymentMethodScreen extends StatefulWidget {
  final AddressModel selectedAddress;
  final String? buyerEmail;
  final CheckoutAttemptStore? checkoutAttemptStore;
  // Phase 1R shipping-semantics correction (owner-requested completion, same day): both are null
  // unless checkout_screen.dart had a real, backend-confirmed fee for every cart line -- see
  // CartShippingSummary.allKnown's own doc comment. Never a partial sum dressed up as complete.
  final double? total;
  final double? shippingFee;

  const PaymentMethodScreen({
    super.key,
    required this.selectedAddress,
    this.buyerEmail,
    this.checkoutAttemptStore,
    required this.total,
    required this.shippingFee,
  });

  @override
  State<PaymentMethodScreen> createState() => _PaymentMethodScreenState();
}

class _PaymentMethodScreenState extends State<PaymentMethodScreen> {
  bool _isProcessing = false;
  MarketplaceCheckoutReview? _serverReview;
  List<MarketplaceShippingOption> _shippingOptions = const [];
  String? _selectedShippingRateId;
  Set<String> _unavailableListingIds = const {};
  final TextEditingController _emailController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _emailController.text = widget.buyerEmail ?? '';
  }

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _proceedToConfirm() async {
    if (_isProcessing) return;
    HapticFeedback.mediumImpact();
    final cart = context.read<CartProvider>();
    final snapshot = List<CartItemModel>.unmodifiable(cart.items);
    setState(() => _isProcessing = true);
    try {
      final buyer = context.read<BuyerSignInController>();
      final buyerId = buyer.buyerId;
      final sessionToken = buyer.token;
      final buyerNamespace = buyerId ?? 'guest';
      final localCartRevision =
          cart.cart?.updatedAt.millisecondsSinceEpoch ?? 0;
      bool buyerIsUnchanged() =>
          buyer.buyerId == buyerId && buyer.token == sessionToken;
      final checkout = MarketplaceCheckoutService(
        client: context.read<ApiClient>(),
        secureStorage: const FlutterSecureStorage(),
        attemptStore: widget.checkoutAttemptStore,
      );
      final result = await checkout.placeCodOrder(
        items: snapshot,
        address: widget.selectedAddress,
        email: _emailController.text,
        buyerNamespace: buyerNamespace,
        storefrontSessionToken: sessionToken,
        localCartRevision: localCartRevision,
        selectedShippingRateId: _selectedShippingRateId,
        acceptedTotal: _serverReview?.authoritativeTotal,
      );
      if (!mounted) return;
      if (!buyerIsUnchanged()) {
        _showSnackBar(
          'Checkout finished for the account that started it. Sign back into that account to view the order; this account’s cart was left unchanged.',
          isError: true,
        );
        return;
      }
      if (result is MarketplaceCheckoutReview) {
        if ((cart.cart?.updatedAt.millisecondsSinceEpoch ?? 0) !=
            localCartRevision) {
          setState(() {
            _serverReview = null;
            _shippingOptions = const [];
            _selectedShippingRateId = null;
          });
          _showSnackBar(
            'Your cart changed during review. Submit again to price the current cart.',
          );
          return;
        }
        setState(() {
          _serverReview = result;
          _shippingOptions = result.shippingOptions;
          if (result.selectedShippingRateId != null) {
            _selectedShippingRateId = result.selectedShippingRateId;
          } else if (!_shippingOptions.any(
            (option) => option.id == _selectedShippingRateId,
          )) {
            _selectedShippingRateId = null;
          }
        });
        if (result.authoritativeTotal == null) {
          _showSnackBar(
            'Choose a delivery option, then review its server-confirmed total.',
          );
        } else {
          _showSnackBar(
            'Server-confirmed total: ₹${result.authoritativeTotal!.toStringAsFixed(2)}. Review it, then tap Place COD order.',
          );
        }
        return;
      }
      if (result is! MarketplaceCheckoutResult) {
        throw StateError('Unexpected checkout result');
      }

      var cartCleaned = true;
      if (result.matchesCurrentCart) {
        cartCleaned = await cart.removeSnapshot(
          snapshot,
          expectedBuyerId: buyerId,
        );
      }
      if (!mounted) return;
      if (!buyerIsUnchanged()) {
        _showSnackBar(
          'Checkout finished for the account that started it. Sign back into that account to view the order; this account’s cart was left unchanged.',
          isError: true,
        );
        return;
      }
      if (cartCleaned || !result.matchesCurrentCart) {
        await checkout.clearCompletedAttempt(
          buyerNamespace: buyerNamespace,
          cartToken: result.cartToken,
        );
      }
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) => AlertDialog(
          title: const Text('COD order placed'),
          content: Text(
            'Order ${result.orderNumber} is confirmed. Amount due on delivery: ₹${result.total.toStringAsFixed(2)}.${cartCleaned ? '' : '\nYour cart is still saved on this device; open Orders before retrying checkout.'}',
          ),
          actions: [
            FilledButton(
              onPressed: () {
                Navigator.of(dialogContext).pop();
                Navigator.of(context).popUntil((route) => route.isFirst);
              },
              child: const Text('Continue shopping'),
            ),
          ],
        ),
      );
    } on ApiException catch (error) {
      if (mounted) {
        if (error.code == 'MARKETPLACE_LISTING_UNAVAILABLE') {
          final body = error.body;
          final rawIds = body is Map ? body['listing_ids'] : null;
          final listingIds = rawIds is List
              ? rawIds.whereType<String>().where((id) => id.isNotEmpty).toSet()
              : <String>{};
          setState(() {
            _unavailableListingIds = listingIds;
            _serverReview = null;
            _shippingOptions = const [];
            _selectedShippingRateId = null;
          });
        } else if (error.code == 'MARKETPLACE_LISTING_CHANGED') {
          setState(() {
            _serverReview = null;
            _shippingOptions = const [];
            _selectedShippingRateId = null;
          });
        }
        _showSnackBar(error.message, isError: true);
      }
    } catch (error) {
      debugPrint('Marketplace COD checkout failed: $error');
      if (mounted) {
        _showSnackBar(
          'Checkout could not be confirmed. Your cart is saved; retry safely.',
          isError: true,
        );
      }
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  Future<void> _removeUnavailableItems() async {
    if (_unavailableListingIds.isEmpty || _isProcessing) return;
    final buyerId = context.read<BuyerSignInController>().buyerId;
    final cart = context.read<CartProvider>();
    final snapshot = List<CartItemModel>.unmodifiable(
      cart.items.where(
        (item) => _unavailableListingIds.contains(item.marketplaceListingId),
      ),
    );
    if (snapshot.isEmpty) {
      setState(() => _unavailableListingIds = const {});
      return;
    }
    setState(() => _isProcessing = true);
    try {
      final removed = await cart.removeSnapshot(
        snapshot,
        expectedBuyerId: buyerId,
      );
      if (!mounted) return;
      if (!removed) {
        _showSnackBar(
          'The active account changed. Sign in again before changing this cart.',
          isError: true,
        );
        return;
      }
      setState(() {
        _unavailableListingIds = const {};
        _serverReview = null;
        _shippingOptions = const [];
        _selectedShippingRateId = null;
      });
      _showSnackBar('Unavailable items removed from your cart.');
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  Future<void> _openInMaps() async {
    final addr = widget.selectedAddress;

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
              isError
                  ? Icons.error_outline_rounded
                  : Icons.check_circle_outline_rounded,
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
    final cardColor = isDark ? const Color(0xFF1E1E1E) : Colors.white;

    final cart = context.watch<CartProvider>();

    // Phase 1R corrective (C2): was context.watch<CouponProvider>()/coupon.calculateDiscount(...).
    // CouponProvider was entirely FirebaseFirestore-backed with no canonical successor; a coupon
    // could never actually load, so this already always evaluated to 0.
    final subtotal = _serverReview?.subtotal ?? cart.subtotal;
    final discount = _serverReview?.discount ?? 0.0;
    final tax = _serverReview?.tax ?? 0.0;
    // Before the server review, these values are displayed only as estimates from the app cart.
    // After review, all rows come from the same canonical cart/delivery response.
    final shippingFee =
        _serverReview?.shipping ??
        (_serverReview == null ? widget.shippingFee : null);
    final total = _serverReview?.authoritativeTotal ?? widget.total;

    return PremiumScaffold(
      // resizeToAvoidBottomInset handled internally
      // backgroundColor handled internally
      appBar: AppBar(
        backgroundColor: cardColor,
        elevation: 0,
        title: Text(
          'Payment Method',
          style: TextStyle(
            color: isDark ? const Color(0xFFE0E0E0) : const Color(0xFF212121),
            fontWeight: FontWeight.w800,
            fontSize: 18,
            letterSpacing: -0.3,
          ),
        ),
        leading: IconButton(
          icon: Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF2C2C2C) : Colors.grey[100],
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              Icons.arrow_back_ios_new_rounded,
              color: isDark ? const Color(0xFFE0E0E0) : const Color(0xFF212121),
              size: 16,
            ),
          ),
          onPressed: () => Navigator.pop(context),
        ),
        centerTitle: true,
      ),
      body: Column(
        children: [
          const CheckoutSteps(currentStep: 2),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              physics: const BouncingScrollPhysics(),
              child: Column(
                children: [
                  _buildAddressCard(isDark, cardColor, accentColor),
                  const SizedBox(height: 12),
                  _buildEmailField(isDark, cardColor),
                  const SizedBox(height: 12),
                  if (_unavailableListingIds.isNotEmpty) ...[
                    _buildUnavailableItemsCard(isDark, cardColor, accentColor),
                    const SizedBox(height: 12),
                  ],
                  if (_shippingOptions.isNotEmpty) ...[
                    _buildShippingOptions(isDark, cardColor, accentColor),
                    const SizedBox(height: 12),
                  ],
                  _buildOrderSummaryCard(
                    subtotal: subtotal,
                    discount: discount,
                    shippingFee: shippingFee,
                    tax: tax,
                    total: total,
                    isServerPriced: _serverReview?.authoritativeTotal != null,
                    isDark: isDark,
                    cardColor: cardColor,
                    accentColor: accentColor,
                  ),
                  const SizedBox(height: 12),
                  _buildCodPaymentCard(isDark, cardColor, accentColor),
                  const SizedBox(height: 12),
                  _buildSecurityBadge(isDark, accentColor),
                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),
          _buildBottomBar(total, isDark, accentColor, cardColor),
        ],
      ),
    );
  }

  Widget _buildShippingOptions(
    bool isDark,
    Color cardColor,
    Color accentColor,
  ) {
    return _buildCardSection(
      isDark: isDark,
      cardColor: cardColor,
      title: 'Delivery options',
      icon: Icons.local_shipping_outlined,
      accentColor: accentColor,
      child: Column(
        children: _shippingOptions
            .map((option) {
              final eta =
                  option.estimatedDaysMin == null ||
                      option.estimatedDaysMax == null
                  ? null
                  : '${option.estimatedDaysMin}–${option.estimatedDaysMax} days';
              return Material(
                color: cardColor,
                child: RadioListTile<String>(
                  value: option.id,
                  groupValue: _selectedShippingRateId,
                  contentPadding: EdgeInsets.zero,
                  activeColor: accentColor,
                  title: Text(
                    option.name,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  subtitle: eta == null ? null : Text('Seller estimate: $eta'),
                  secondary: Text(
                    option.amount == 0
                        ? 'Free'
                        : '₹${option.amount.toStringAsFixed(2)}',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: accentColor,
                    ),
                  ),
                  onChanged: _isProcessing
                      ? null
                      : (id) {
                          setState(() {
                            _selectedShippingRateId = id;
                            _serverReview = null;
                          });
                        },
                ),
              );
            })
            .toList(growable: false),
      ),
    );
  }

  Widget _buildUnavailableItemsCard(
    bool isDark,
    Color cardColor,
    Color accentColor,
  ) {
    final unavailableItems = context
        .watch<CartProvider>()
        .items
        .where(
          (item) => _unavailableListingIds.contains(item.marketplaceListingId),
        )
        .toList(growable: false);
    return _buildCardSection(
      isDark: isDark,
      cardColor: cardColor,
      title: 'Cart items need attention',
      icon: Icons.warning_amber_rounded,
      accentColor: Colors.deepOrange,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'These products are no longer available. Remove them to continue checkout.',
          ),
          const SizedBox(height: 8),
          ...unavailableItems.map(
            (item) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Text('• ${item.productName}'),
            ),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: _isProcessing ? null : _removeUnavailableItems,
            icon: const Icon(Icons.remove_shopping_cart_outlined),
            label: const Text('Remove unavailable items'),
            style: OutlinedButton.styleFrom(foregroundColor: accentColor),
          ),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(bool isDark, Color cardColor) {
    return AppBar(
      backgroundColor: cardColor,
      elevation: 0,
      title: Text(
        'Payment Method',
        style: TextStyle(
          color: isDark ? Colors.white : Colors.black87,
          fontWeight: FontWeight.w800,
          fontSize: 18,
          letterSpacing: -0.3,
        ),
      ),
      leading: IconButton(
        icon: Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: isDark
                ? Colors.white.withValues(alpha: 0.1)
                : Colors.grey.shade100,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(
            Icons.arrow_back_ios_new_rounded,
            color: isDark ? Colors.white : Colors.black87,
            size: 16,
          ),
        ),
        onPressed: () => Navigator.pop(context),
      ),
      centerTitle: true,
    );
  }

  Widget _buildAddressCard(bool isDark, Color cardColor, Color accentColor) {
    final addr = widget.selectedAddress;

    return _buildCardSection(
      isDark: isDark,
      cardColor: cardColor,
      title: 'Delivery Address',
      icon: Icons.location_on_rounded,
      accentColor: accentColor,
      trailing: addr.latitude != null && addr.longitude != null
          ? IconButton(
              onPressed: _openInMaps,
              icon: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: accentColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(Icons.map_outlined, color: accentColor, size: 18),
              ),
              tooltip: 'Open in Maps',
            )
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Name
          Row(
            children: [
              Icon(
                Icons.person_outline_rounded,
                size: 16,
                color: isDark ? Colors.grey[500] : Colors.grey[600],
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  addr.name,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: isDark ? Colors.white : Colors.black87,
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
                addr.phone,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.grey[300] : Colors.grey[700],
                ),
              ),
            ],
          ),

          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Divider(
              color: isDark ? Colors.grey[800] : Colors.grey[200],
              height: 1,
            ),
          ),

          // Address Line 1
          _buildAddressRow(
            icon: Icons.home_outlined,
            value: addr.addressLine1,
            isDark: isDark,
          ),

          // Address Line 2 (if exists)
          if (addr.addressLine2.isNotEmpty) ...[
            const SizedBox(height: 8),
            _buildAddressRow(
              icon: Icons.location_city_outlined,
              value: addr.addressLine2,
              isDark: isDark,
              isSecondary: true,
            ),
          ],

          // Landmark (if exists)
          if (addr.landmark != null && addr.landmark!.isNotEmpty) ...[
            const SizedBox(height: 8),
            _buildAddressRow(
              icon: Icons.place_outlined,
              value: 'Near ${addr.landmark}',
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
                label: addr.city,
                isDark: isDark,
              ),
              _buildLocationChip(
                icon: Icons.map_outlined,
                label: addr.state,
                isDark: isDark,
              ),
              _buildLocationChip(
                icon: Icons.pin_drop_outlined,
                label: addr.zipcode,
                isDark: isDark,
              ),
            ],
          ),

          // Country (if not India)
          if (addr.country.isNotEmpty && addr.country != 'India') ...[
            const SizedBox(height: 8),
            _buildLocationChip(
              icon: Icons.flag_outlined,
              label: addr.country,
              isDark: isDark,
            ),
          ],

          // Address Type Badge (if exists)
          if (addr.addressType != null && addr.addressType!.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: _getAddressTypeColor(
                  addr.addressType!,
                ).withValues(alpha: 0.15),
                border: Border.all(
                  color: _getAddressTypeColor(
                    addr.addressType!,
                  ).withValues(alpha: 0.3),
                ),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    _getAddressTypeIcon(addr.addressType!),
                    size: 14,
                    color: _getAddressTypeColor(addr.addressType!),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    addr.addressType!.toUpperCase(),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: _getAddressTypeColor(addr.addressType!),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
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
            color: isDark ? Colors.grey[500] : Colors.grey[600],
          ),
        if (!isSecondary) const SizedBox(width: 8),
        if (isSecondary) const SizedBox(width: 24),
        Expanded(
          child: Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.grey[300] : Colors.grey[700],
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
        color: isDark ? Colors.grey[850] : Colors.grey[100],
        borderRadius: BorderRadius.circular(6),
        border: Border.all(
          color: isDark ? Colors.grey[700]! : Colors.grey[300]!,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 12,
            color: isDark ? Colors.grey[400] : Colors.grey[600],
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.grey[300] : Colors.grey[700],
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

  Widget _buildEmailField(bool isDark, Color cardColor) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
        ),
      ),
      child: TextField(
        controller: _emailController,
        keyboardType: TextInputType.emailAddress,
        autofillHints: const [AutofillHints.email],
        textInputAction: TextInputAction.done,
        decoration: InputDecoration(
          labelText: 'Order email',
          hintText: 'name@example.com',
          prefixIcon: const Icon(Icons.email_outlined),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
        ),
      ),
    );
  }

  Widget _buildCodPaymentCard(bool isDark, Color cardColor, Color accentColor) {
    return _buildCardSection(
      isDark: isDark,
      cardColor: cardColor,
      title: 'Payment Method',
      icon: Icons.payments_outlined,
      accentColor: accentColor,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: accentColor.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: accentColor.withValues(alpha: 0.45)),
        ),
        child: Row(
          children: [
            Icon(Icons.local_atm_rounded, color: accentColor, size: 24),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Cash on Delivery',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    'Pay the confirmed order amount when it arrives.',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.check_circle, color: accentColor),
          ],
        ),
      ),
    );
  }

  Widget _buildOrderSummaryCard({
    required double subtotal,
    required double discount,
    required double? shippingFee,
    required double tax,
    required double? total,
    required bool isServerPriced,
    required bool isDark,
    required Color cardColor,
    required Color accentColor,
  }) {
    return _buildCardSection(
      isDark: isDark,
      cardColor: cardColor,
      title: isServerPriced ? 'Server-priced order' : 'Price estimate',
      icon: Icons.receipt_long_rounded,
      accentColor: accentColor,
      child: Column(
        children: [
          _priceRow("Subtotal", subtotal, isDark),
          if (discount > 0) ...[
            const SizedBox(height: 10),
            _priceRow("Discount", -discount, isDark, color: AppColors.success),
          ],
          if (shippingFee != null) ...[
            const SizedBox(height: 10),
            _priceRow("Shipping Fee", shippingFee, isDark),
          ] else if (shippingFee == null) ...[
            const SizedBox(height: 10),
            _priceStatusRow("Shipping Fee", "Pending", isDark),
          ],
          if (tax > 0) ...[
            const SizedBox(height: 10),
            _priceRow('Tax', tax, isDark),
          ],
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Divider(
              color: isDark ? Colors.grey[800] : Colors.grey[200],
              height: 1,
            ),
          ),
          if (total != null)
            _priceRow(
              isServerPriced
                  ? 'Server-confirmed total'
                  : 'Estimate (not final)',
              total,
              isDark,
              isTotal: true,
              color: accentColor,
            )
          else
            _priceStatusRow(
              'Server total',
              'Shown after repricing',
              isDark,
              isTotal: true,
              color: accentColor,
            ),

          // Phase 1R corrective (C2): "Coupon Applied" badge removed. CouponProvider was
          // entirely FirebaseFirestore-backed with no canonical successor; appliedCoupon was
          // already always null (coupons could never load), so this never rendered.

          // Savings Badge
          if (discount > 0) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.success.withValues(
                  alpha: isDark ? 0.15 : 0.08,
                ),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  FaIcon(
                    FontAwesomeIcons.piggyBank,
                    size: 12,
                    color: AppColors.success,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'You saved ₹${discount.toStringAsFixed(0)}!',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.success,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSecurityBadge(bool isDark, Color accentColor) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.success.withValues(alpha: isDark ? 0.15 : 0.08),
        border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(8),
            ),
            child: FaIcon(
              FontAwesomeIcons.shieldHalved,
              color: AppColors.success,
              size: 18,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '100% Secure Payments',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 13,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  'Encrypted & protected transactions',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCardSection({
    required Widget child,
    required bool isDark,
    required Color cardColor,
    required Color accentColor,
    String? title,
    IconData? icon,
    Widget? trailing,
    bool isSelected = false,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isSelected
              ? accentColor
              : (isDark ? Colors.grey[800]! : Colors.grey[200]!),
          width: isSelected ? 2 : 1,
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
                  Expanded(
                    child: Text(
                      title,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.2,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                    ),
                  ),
                  if (trailing != null) trailing,
                ],
              ),
            ),
          Padding(padding: const EdgeInsets.all(16), child: child),
        ],
      ),
    );
  }

  Widget _priceRow(
    String title,
    double value,
    bool isDark, {
    Color? color,
    bool isTotal = false,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: TextStyle(
            fontWeight: isTotal ? FontWeight.w800 : FontWeight.w600,
            fontSize: isTotal ? 15 : 14,
            color: isDark
                ? (isTotal ? Colors.white : Colors.grey[300])
                : (isTotal ? Colors.black87 : Colors.grey[700]),
          ),
        ),
        Text(
          "₹${value.abs().toStringAsFixed(0)}",
          style: TextStyle(
            fontWeight: isTotal ? FontWeight.w800 : FontWeight.w700,
            fontSize: isTotal ? 18 : 14,
            color: color ?? (isDark ? Colors.white : Colors.black87),
          ),
        ),
      ],
    );
  }

  // Phase 1R shipping-semantics correction: the text-status counterpart to [_priceRow], for a
  // line whose value genuinely isn't a number yet -- never a ₹ amount standing in for "we don't
  // know". Mirrors mobile_cart_screen.dart's own _priceStatusRow so both screens read alike.
  Widget _priceStatusRow(
    String title,
    String status,
    bool isDark, {
    Color? color,
    bool isTotal = false,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: TextStyle(
            fontWeight: isTotal ? FontWeight.w800 : FontWeight.w600,
            fontSize: isTotal ? 15 : 14,
            color: isDark
                ? (isTotal ? Colors.white : Colors.grey[300])
                : (isTotal ? Colors.black87 : Colors.grey[700]),
          ),
        ),
        Text(
          status,
          style: TextStyle(
            fontWeight: isTotal ? FontWeight.w800 : FontWeight.w600,
            fontSize: isTotal ? 15 : 13,
            fontStyle: FontStyle.italic,
            color: color ?? (isDark ? Colors.grey[400] : Colors.grey[600]),
          ),
        ),
      ],
    );
  }

  Widget _buildBottomBar(
    double? total,
    bool isDark,
    Color accentColor,
    Color cardColor,
  ) {
    final needsShippingSelection =
        _shippingOptions.isNotEmpty && _selectedShippingRateId == null;
    final hasUnavailableItems = _unavailableListingIds.isNotEmpty;
    return Container(
      padding: EdgeInsets.fromLTRB(
        16,
        16,
        16,
        16 + MediaQuery.of(context).padding.bottom,
      ),
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
          top: BorderSide(
            color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
          ),
        ),
      ),
      child: ElevatedButton(
        onPressed:
            _isProcessing || needsShippingSelection || hasUnavailableItems
            ? null
            : _proceedToConfirm,
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
        child: _isProcessing
            ? Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      color: isDark ? Colors.black : Colors.white,
                      strokeWidth: 2.5,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    'Processing...',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.3,
                    ),
                  ),
                ],
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.receipt_long_rounded, size: 20),
                  const SizedBox(width: 10),
                  Text(
                    needsShippingSelection
                        ? 'Select a delivery option above'
                        : hasUnavailableItems
                        ? 'Remove unavailable cart items'
                        : _serverReview?.authoritativeTotal == null
                        ? (_shippingOptions.isNotEmpty
                              ? 'Review selected delivery total'
                              : 'Review server total')
                        : 'Place COD order • ₹${_serverReview!.authoritativeTotal!.toStringAsFixed(2)}',
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
