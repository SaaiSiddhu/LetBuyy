import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:provider/provider.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'widgets/checkout_steps.dart';
import '../../widgets/premium_scaffold.dart';

class PaymentMethodScreen extends StatefulWidget {
  final AddressModel selectedAddress;
  final double total;

  const PaymentMethodScreen({
    super.key,
    required this.selectedAddress,
    required this.total,
  });

  @override
  State<PaymentMethodScreen> createState() => _PaymentMethodScreenState();
}

class _PaymentMethodScreenState extends State<PaymentMethodScreen> {
  Razorpay? _razorpay;
  bool _isProcessing = false;
  String _selectedPaymentMethod = 'razorpay';

  @override
  void initState() {
    super.initState();
    _initializePaymentServices();
  }

  @override
  void dispose() {
    _razorpay?.clear();
    super.dispose();
  }

  void _initializePaymentServices() {
    if (kIsWeb) return;

    _razorpay = Razorpay();
    _razorpay!.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
    _razorpay!.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentFailure);
    _razorpay!.on(Razorpay.EVENT_EXTERNAL_WALLET, (response) {
      debugPrint("💳 Wallet Selected: ${response.walletName}");
    });
  }

  void _handlePaymentSuccess(PaymentSuccessResponse response) {
    // C3 (Firebase SDK removal, 27 September 2026 review continuation): unreachable in this build
    // -- _proceedToConfirm below never opens Razorpay checkout, so this callback can never fire.
    // Kept only because the Razorpay plugin's own API requires a registered success handler.
    debugPrint('✅ Payment successful (unreachable in this build): ${response.paymentId}');
  }

  void _handlePaymentFailure(PaymentFailureResponse response) {
    if (!mounted) return;

    setState(() => _isProcessing = false);
    _showSnackBar(
      'Payment Failed: ${response.message ?? "Unknown error"}',
      isError: true,
    );
  }

  // C3 (Firebase SDK removal, 27 September 2026 review continuation): order placement
  // (_createOrder, deleted here) was entirely Firestore-backed (DatabaseService.createOrder, with
  // a FirebaseFirestore-derived order id) behind a safeFirebaseUserId()/safeFirebaseCurrentUser()
  // == null guard that is always true now that Firebase is never initialized -- so tapping "Place
  // Order" already did nothing at all, silently, regardless of payment method or stock. There is
  // no canonical order/payment-creation endpoint wired into this app yet: checkout, orders and
  // payments are canonical-backend capabilities services/api-gateway owns
  // (LETBUYY_CANONICAL_SYSTEMS.md), and FB-2/3/4 have so far only moved identity, accounts,
  // addresses and the product/category feed onto it, not order placement -- a missing Flutter
  // integration is not the same fact as a missing backend capability, but neither exists here yet
  // either way. Per the owner's explicit instruction, purchase execution stays honestly
  // unavailable until its own approved phase, rather than silently doing nothing or reaching a
  // legacy failure and calling the journey complete. Local cart and delivery-address selection
  // above this point remain real and working; this is the one remaining boundary. StockService's
  // own Firestore-backed validateStock() is removed along with it -- see stock_service.dart's own
  // deletion, it had no other caller.
  Future<void> _proceedToConfirm() async {
    if (_isProcessing) return;
    HapticFeedback.mediumImpact();
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Checkout isn’t available yet'),
        content: const Text(
          'Placing a real order isn’t supported in this build yet. Your cart and delivery address are saved for when it is.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('OK')),
        ],
      ),
    );
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
    final cardColor = isDark ? const Color(0xFF1E1E1E) : Colors.white;

    final cart = context.watch<CartProvider>();

    // Phase 1R corrective (C2): was context.watch<CouponProvider>()/coupon.calculateDiscount(...).
    // CouponProvider was entirely FirebaseFirestore-backed with no canonical successor; a coupon
    // could never actually load, so this already always evaluated to 0.
    final subtotal = cart.subtotal;
    const discount = 0.0;
    final total = subtotal - discount;

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
                  _buildOrderSummaryCard(
                    subtotal: subtotal,
                    discount: discount,
                    total: subtotal - discount,
                    isDark: isDark,
                    cardColor: cardColor,
                    accentColor: accentColor,
                  ),
                  const SizedBox(height: 12),
                  _buildPaymentCard(isDark, cardColor, accentColor),
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
            color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.shade100,
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
                child: Icon(
                  Icons.map_outlined,
                  color: accentColor,
                  size: 18,
                ),
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
                color: _getAddressTypeColor(addr.addressType!).withValues(alpha: 0.15),
                border: Border.all(
                  color: _getAddressTypeColor(addr.addressType!).withValues(alpha: 0.3),
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

  Widget _buildOrderSummaryCard({
    required double subtotal,
    required double discount,
    required double total,
    required bool isDark,
    required Color cardColor,
    required Color accentColor,
  }) {
    return _buildCardSection(
      isDark: isDark,
      cardColor: cardColor,
      title: 'Price Details',
      icon: Icons.receipt_long_rounded,
      accentColor: accentColor,
      child: Column(
        children: [
          _priceRow("Subtotal", subtotal, isDark),
          if (discount > 0) ...[
            const SizedBox(height: 10),
            _priceRow("Discount", -discount, isDark, color: AppColors.success),
          ],
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Divider(
              color: isDark ? Colors.grey[800] : Colors.grey[200],
              height: 1,
            ),
          ),
          _priceRow("Total Amount", total, isDark, isTotal: true, color: accentColor),

          // Phase 1R corrective (C2): "Coupon Applied" badge removed. CouponProvider was
          // entirely FirebaseFirestore-backed with no canonical successor; appliedCoupon was
          // already always null (coupons could never load), so this never rendered.

          // Savings Badge
          if (discount > 0) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.success.withValues(alpha: isDark ? 0.15 : 0.08),
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

  Widget _buildPaymentCard(bool isDark, Color cardColor, Color accentColor) {
    return _buildCardSection(
      isDark: isDark,
      cardColor: cardColor,
      title: 'Payment Method',
      icon: Icons.payment_rounded,
      accentColor: accentColor,
      child: Column(
        children: [
          // Online Payment Option
          if (!kIsWeb)
            GestureDetector(
              onTap: () {
                setState(() => _selectedPaymentMethod = 'razorpay');
                HapticFeedback.selectionClick();
              },
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: _selectedPaymentMethod == 'razorpay'
                      ? accentColor.withValues(alpha: 0.1)
                      : (isDark ? Colors.grey[850] : Colors.grey[50]),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: _selectedPaymentMethod == 'razorpay'
                        ? accentColor
                        : (isDark ? Colors.grey[700]! : Colors.grey[300]!),
                    width: _selectedPaymentMethod == 'razorpay' ? 2 : 1,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: accentColor.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Icon(
                            Icons.payment_rounded,
                            color: accentColor,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Pay Online (Razorpay)',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w800,
                                  color: isDark ? Colors.white : Colors.black87,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                'UPI, Cards, Wallets & More',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: isDark ? Colors.grey[400] : Colors.grey[600],
                                ),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          width: 24,
                          height: 24,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: _selectedPaymentMethod == 'razorpay'
                                  ? accentColor
                                  : (isDark ? Colors.grey[600]! : Colors.grey[400]!),
                              width: 2,
                            ),
                            color: _selectedPaymentMethod == 'razorpay'
                                ? accentColor
                                : Colors.transparent,
                          ),
                          child: _selectedPaymentMethod == 'razorpay'
                              ? const Icon(Icons.check, color: Colors.white, size: 16)
                              : null,
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _buildPaymentBadge(FontAwesomeIcons.solidCreditCard, 'Card', isDark),
                        _buildPaymentBadge(FontAwesomeIcons.mobileScreenButton, 'UPI', isDark),
                        _buildPaymentBadge(FontAwesomeIcons.wallet, 'Wallet', isDark),
                        _buildPaymentBadge(FontAwesomeIcons.buildingColumns, 'Bank', isDark),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          
          if (!kIsWeb) const SizedBox(height: 12),
          
          // Cash on Delivery Option
          GestureDetector(
            onTap: () {
              setState(() => _selectedPaymentMethod = 'cod');
              HapticFeedback.selectionClick();
            },
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: _selectedPaymentMethod == 'cod'
                    ? accentColor.withValues(alpha: 0.1)
                    : (isDark ? Colors.grey[850] : Colors.grey[50]),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: _selectedPaymentMethod == 'cod'
                      ? accentColor
                      : (isDark ? Colors.grey[700]! : Colors.grey[300]!),
                  width: _selectedPaymentMethod == 'cod' ? 2 : 1,
                ),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.warning.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: FaIcon(
                      FontAwesomeIcons.handHoldingDollar,
                      color: AppColors.warning,
                      size: 20,
                    ),
                  ),
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
                          'Pay when you receive',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: isDark ? Colors.grey[400] : Colors.grey[600],
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: _selectedPaymentMethod == 'cod'
                            ? accentColor
                            : (isDark ? Colors.grey[600]! : Colors.grey[400]!),
                        width: 2,
                      ),
                      color: _selectedPaymentMethod == 'cod'
                          ? accentColor
                          : Colors.transparent,
                    ),
                    child: _selectedPaymentMethod == 'cod'
                        ? const Icon(Icons.check, color: Colors.white, size: 16)
                        : null,
                  ),
                ],
              ),
            ),
          ),
          
          // Web Notice
          if (kIsWeb) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.info.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.info.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.info_outline_rounded,
                    color: AppColors.infoDark,
                    size: 18,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Online payments are supported only on mobile apps',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: isDark ? Colors.white : Colors.grey.shade900,
                      ),
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

  Widget _buildPaymentBadge(FaIconData icon, String label, bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF2C2C2C) : Colors.white,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: isDark ? Colors.grey[700]! : Colors.grey[300]!),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          FaIcon(icon, size: 11, color: isDark ? Colors.grey[400] : Colors.grey[600]),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.grey[300] : Colors.grey[700],
            ),
          ),
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
          Padding(
            padding: const EdgeInsets.all(16),
            child: child,
          ),
        ],
      ),
    );
  }

  Widget _priceRow(String title, double value, bool isDark,
      {Color? color, bool isTotal = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: TextStyle(
            fontWeight: isTotal ? FontWeight.w800 : FontWeight.w600,
            fontSize: isTotal ? 15 : 14,
            color: isDark ? (isTotal ? Colors.white : Colors.grey[300]) : (isTotal ? Colors.black87 : Colors.grey[700]),
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

  Widget _buildBottomBar(double total, bool isDark, Color accentColor, Color cardColor) {
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
        onPressed: _isProcessing ? null : _proceedToConfirm,
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
                  Icon(
                    _selectedPaymentMethod == "cod"
                        ? Icons.check_circle_rounded
                        : Icons.lock_rounded,
                    size: 20,
                  ),
                  const SizedBox(width: 10),
                  Text(
                    _selectedPaymentMethod == "cod"
                        ? "Place Order • ₹${total.toStringAsFixed(0)}"
                        : "Pay ₹${total.toStringAsFixed(0)}",
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
