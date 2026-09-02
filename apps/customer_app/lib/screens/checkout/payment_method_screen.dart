import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:provider/provider.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'widgets/checkout_steps.dart';
import 'order_success_screen.dart';
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
  
  // Loyalty points redemption
  bool _useLoyaltyPoints = false;
  int _loyaltyPointsToUse = 0;

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
    debugPrint('✅ Payment successful: ${response.paymentId}');
    _createOrder(
      razorpayPaymentId: response.paymentId,
      razorpayOrderId: response.orderId,
      razorpaySignature: response.signature,
    );
  }

  void _handlePaymentFailure(PaymentFailureResponse response) {
    if (!mounted) return;

    setState(() => _isProcessing = false);
    _showSnackBar(
      'Payment Failed: ${response.message ?? "Unknown error"}',
      isError: true,
    );
  }

  Future<void> _createOrder({
    String? razorpayPaymentId,
    String? razorpayOrderId,
    String? razorpaySignature,
  }) async {
    setState(() => _isProcessing = true);

    try {
      final userId = FirebaseAuth.instance.currentUser?.uid;
      if (userId == null) throw Exception('User not logged in');

      final cartProvider = context.read<CartProvider>();
      final couponProvider = context.read<CouponProvider>();
      final loyaltyProvider = context.read<LoyaltyProvider>();
      final orderProvider = Provider.of<OrderProvider>(context, listen: false);

      // Calculate total discount
      final couponDiscount = couponProvider.calculateDiscount(
        orderAmount: cartProvider.subtotal,
        items: cartProvider.items,
      );
      final loyaltyDiscount = _useLoyaltyPoints ? _loyaltyPointsToUse.toDouble() : 0.0;
      final totalDiscount = couponDiscount + loyaltyDiscount;

      // ============================================
      // 🛒 GROUP ITEMS BY SELLER
      // ============================================
      final Map<String, List<CartItemModel>> itemsBySeller = {};
      
      for (final item in cartProvider.items) {
        final sellerId = item.sellerId ?? 'unknown';
        if (!itemsBySeller.containsKey(sellerId)) {
          itemsBySeller[sellerId] = [];
        }
        itemsBySeller[sellerId]!.add(item);
      }

      debugPrint('📦 Creating ${itemsBySeller.length} order(s) for ${itemsBySeller.keys.join(", ")}');

      // ============================================
      // 📝 CREATE SEPARATE ORDERS PER SELLER
      // ============================================
      final List<OrderModel> createdOrders = [];
      final totalSubtotal = cartProvider.subtotal;
      bool isFirstOrder = true;

      for (final entry in itemsBySeller.entries) {
        final sellerId = entry.key;
        final sellerItems = entry.value;

        // Calculate seller's portion of the subtotal
        final sellerSubtotal = sellerItems.fold<double>(
          0.0,
          (sum, item) => sum + (item.price * item.quantity),
        );

        // Prorate discount based on subtotal ratio
        final discountRatio = totalSubtotal > 0 ? sellerSubtotal / totalSubtotal : 0.0;
        final sellerDiscount = totalDiscount * discountRatio;
        final sellerTotal = sellerSubtotal - sellerDiscount;

        // Get seller name from first item
        final sellerName = sellerItems.first.sellerName;

        final orderId = FirebaseFirestore.instance.collection('orders').doc().id;

        final order = OrderModel(
          id: orderId,
          userId: userId,
          sellerId: sellerId == 'unknown' ? null : sellerId,
          sellerName: sellerName,
          orderNumber: OrderModel.generateOrderNumber(),
          items: sellerItems,
          deliveryAddress: widget.selectedAddress,
          subtotal: sellerSubtotal,
          discount: sellerDiscount,
          deliveryCharge: 0.0,
          tax: 0.0,
          total: sellerTotal > 0 ? sellerTotal : 0,
          paymentMethod: _selectedPaymentMethod,
          paymentStatus: _selectedPaymentMethod == 'cod' ? 'pending' : 'paid',
          orderStatus: 'pending',
          razorpayOrderId: razorpayOrderId,
          razorpayPaymentId: razorpayPaymentId,
          razorpaySignature: razorpaySignature,
          couponCode: isFirstOrder ? couponProvider.appliedCoupon?.code : null,
          createdAt: DateTime.now(),
        );

        final createdOrderId = await orderProvider.createOrder(order);
        
        if (createdOrderId == null) {
          throw Exception('Failed to create order for seller: $sellerId');
        }

        debugPrint('✅ Order created: ${order.orderNumber} for seller: $sellerId');
        createdOrders.add(order);

        // Redeem loyalty points only on first order (to avoid double-dipping)
        if (isFirstOrder && _useLoyaltyPoints && _loyaltyPointsToUse > 0) {
          await loyaltyProvider.redeemPoints(_loyaltyPointsToUse, createdOrderId);
          debugPrint('🎁 Loyalty points redeemed on order: $createdOrderId');
        }

        isFirstOrder = false;
      }

      await cartProvider.clearCart();
      couponProvider.removeCoupon();

      if (!mounted) return;

      HapticFeedback.heavyImpact();
      
      // Navigate to success screen with the first order (or combined info)
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(
          builder: (_) => OrderSuccessScreen(
            order: createdOrders.first,
            additionalOrders: createdOrders.length > 1 
                ? createdOrders.sublist(1) 
                : null,
          ),
        ),
        (route) => route.isFirst,
      );
    } catch (e) {
      debugPrint('❌ Order creation error: $e');
      _showSnackBar('Error: ${e.toString()}', isError: true);
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  Future<void> _proceedToConfirm() async {
    if (_isProcessing) return;

    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    HapticFeedback.mediumImpact();
    setState(() => _isProcessing = true);

    // 1️⃣ VALIDATE STOCK BEFORE PROCEEDING (NEW)
    final cartProvider = context.read<CartProvider>();
    final stockService = StockService();
    
    debugPrint('🔍 Validating stock for ${cartProvider.items.length} items...');
    final stockValidation = await stockService.validateStock(cartProvider.items);
    
    if (!stockValidation.isValid) {
      setState(() => _isProcessing = false);
      _showOutOfStockDialog(stockValidation.issues);
      return;
    }
    debugPrint('✅ Stock validation passed');

    // 2️⃣ For COD, create order directly
    if (_selectedPaymentMethod == 'cod') {
      _createOrder();
      return;
    }

    if (kIsWeb) {
      setState(() => _isProcessing = false);
      _showSnackBar("Online payments are only available on mobile", isError: true);
      return;
    }


    // Calculate final total with discount
    final couponProvider = context.read<CouponProvider>();
    final discount = couponProvider.calculateDiscount(
      orderAmount: cartProvider.subtotal,
      items: cartProvider.items,
    );
    final loyaltyDiscount = _useLoyaltyPoints ? _loyaltyPointsToUse.toDouble() : 0.0;
    final finalTotal = cartProvider.subtotal - discount - loyaltyDiscount;

    // Generate unique order ID
    final orderId = 'ORD${DateTime.now().millisecondsSinceEpoch}';
    final itemCount = cartProvider.items.length;

    // Open professional Razorpay checkout with custom branding
    final options = {
      'key': 'rzp_test_RrSsugo1yIfjkZ',
      'amount': (finalTotal * 100).toInt(), // Amount in paise
      'currency': 'INR',
      'name': 'LetBuyy',
      'description': '$itemCount ${itemCount == 1 ? 'item' : 'items'} • Order Payment',
      'image': 'https://storage.googleapis.com/letbuy-y.firebasestorage.app/app_assets/logo.png',
      'prefill': {
        'name': widget.selectedAddress.name,
        'email': user.email ?? '',
        'contact': widget.selectedAddress.phone,
      },
      'notes': {
        'user_id': user.uid,
        'order_reference': orderId,
        'shipping_address': '${widget.selectedAddress.addressLine1}, ${widget.selectedAddress.city}',
      },
      'theme': {
        'color': '#00B3B3', // LetBuyy Cyan/Teal primary color
      },
      'modal': {
        'confirm_close': true, // Ask before closing
        'animation': true,
      },
      'retry': {
        'enabled': true,
        'max_count': 3,
      },
      'send_sms_hash': true, // Auto-read OTP
      'remember_customer': true, // Remember for future payments
      'timeout': 300, // 5 minute timeout
      'external': {
        'wallets': ['paytm', 'phonepe', 'gpay'], // Enable external wallets
      },
    };

    try {
      _razorpay?.open(options);
    } catch (e) {
      debugPrint('❌ Razorpay error: $e');
      setState(() => _isProcessing = false);
      _showSnackBar('Failed to open payment: ${e.toString()}', isError: true);
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

  /// Show dialog when stock is insufficient
  void _showOutOfStockDialog(List<StockIssue> issues) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.inventory_2_outlined, color: AppColors.error, size: 24),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                'Stock Unavailable',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Some items in your cart are no longer available:',
              style: TextStyle(
                color: isDark ? Colors.grey[400] : Colors.grey[600],
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 16),
            ...issues.map((issue) => Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.error.withValues(alpha: 0.2)),
              ),
              child: Row(
                children: [
                  Icon(
                    issue.isOutOfStock ? Icons.remove_circle_outline : Icons.warning_amber_rounded,
                    color: AppColors.error,
                    size: 20,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          issue.productName,
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          issue.isOutOfStock 
                              ? 'Out of stock' 
                              : 'Only ${issue.availableStock} available',
                          style: TextStyle(
                            color: AppColors.error,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            )),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              'Update Cart',
              style: TextStyle(
                color: isDark ? Colors.grey[400] : Colors.grey[600],
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.pop(context); // Go back to cart
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Back to Cart'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = context.watch<ThemeProvider>().isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    final cardColor = isDark ? const Color(0xFF1E1E1E) : Colors.white;

    final cart = context.watch<CartProvider>();
    final coupon = context.watch<CouponProvider>();
    
    // Calculate discount with proper parameters
    final subtotal = cart.subtotal;
    final discount = coupon.calculateDiscount(
      orderAmount: subtotal,
      items: cart.items,
    );
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
                  _buildLoyaltyPointsCard(isDark, cardColor, accentColor, subtotal - discount),
                  const SizedBox(height: 12),
                  _buildOrderSummaryCard(
                    subtotal: subtotal,
                    discount: discount + (_useLoyaltyPoints ? _loyaltyPointsToUse.toDouble() : 0),
                    total: subtotal - discount - (_useLoyaltyPoints ? _loyaltyPointsToUse.toDouble() : 0),
                    isDark: isDark,
                    cardColor: cardColor,
                    accentColor: accentColor,
                    coupon: coupon,
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

  Widget _buildLoyaltyPointsCard(bool isDark, Color cardColor, Color accentColor, double orderTotal) {
    return Consumer<LoyaltyProvider>(
      builder: (context, loyaltyProvider, _) {
        final availablePoints = loyaltyProvider.points;
        final maxRedeemable = loyaltyProvider.getMaxRedeemable(orderTotal);
        final tier = loyaltyProvider.currentTier;
        
        if (availablePoints <= 0) {
          return const SizedBox.shrink();
        }

        return _buildCardSection(
          isDark: isDark,
          cardColor: cardColor,
          title: 'Loyalty Points',
          icon: Icons.stars_rounded,
          accentColor: Color(tier.colorValue),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Tier badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Color(tier.colorValue).withValues(alpha: 0.3),
                      Color(tier.colorValue).withValues(alpha: 0.1),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: Color(tier.colorValue).withValues(alpha: 0.5)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.workspace_premium, size: 14, color: Color(tier.colorValue)),
                    const SizedBox(width: 6),
                    Text(
                      '${tier.displayName} Member • ${tier.cashbackPercentage}% Cashback',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Color(tier.colorValue),
                      ),
                    ),
                  ],
                ),
              ),
              
              const SizedBox(height: 16),
              
              // Available points
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.amber.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(Icons.monetization_on_rounded, color: Colors.amber.shade700, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Available Points',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: isDark ? Colors.grey[400] : Colors.grey[600],
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '$availablePoints (₹$availablePoints)',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: isDark ? Colors.white : Colors.black87,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Toggle to use points
                  Switch.adaptive(
                    value: _useLoyaltyPoints,
                    onChanged: maxRedeemable > 0
                        ? (value) {
                            HapticFeedback.selectionClick();
                            setState(() {
                              _useLoyaltyPoints = value;
                              if (value) {
                                _loyaltyPointsToUse = maxRedeemable;
                              } else {
                                _loyaltyPointsToUse = 0;
                              }
                            });
                          }
                        : null,
                    activeColor: accentColor,
                  ),
                ],
              ),
              
              // Slider (when enabled)
              if (_useLoyaltyPoints && maxRedeemable > 0) ...[
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: SliderTheme(
                        data: SliderTheme.of(context).copyWith(
                          activeTrackColor: accentColor,
                          inactiveTrackColor: accentColor.withValues(alpha: 0.2),
                          thumbColor: accentColor,
                          overlayColor: accentColor.withValues(alpha: 0.1),
                          trackHeight: 4,
                        ),
                        child: Slider(
                          value: _loyaltyPointsToUse.toDouble(),
                          min: 0,
                          max: maxRedeemable.toDouble(),
                          divisions: maxRedeemable > 0 ? maxRedeemable : 1,
                          onChanged: (value) {
                            setState(() {
                              _loyaltyPointsToUse = value.round();
                            });
                          },
                        ),
                      ),
                    ),
                  ],
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Use: $_loyaltyPointsToUse points',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: isDark ? Colors.grey[300] : Colors.grey[700],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: AppColors.success.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        '−₹$_loyaltyPointsToUse',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: AppColors.success,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
              
              // Max redemption info
              if (maxRedeemable < availablePoints) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.info.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.info.withValues(alpha: 0.2)),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.info_outline, size: 16, color: AppColors.infoDark),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Max ₹$maxRedeemable can be used on this order (50% limit)',
                          style: TextStyle(
                            fontSize: 11,
                            color: AppColors.infoDark,
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
      },
    );
  }

  Widget _buildOrderSummaryCard({
    required double subtotal,
    required double discount,
    required double total,
    required bool isDark,
    required Color cardColor,
    required Color accentColor,
    required CouponProvider coupon,
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
          
          // Coupon Applied Badge
          if (coupon.appliedCoupon != null) ...[
            const SizedBox(height: 12),
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
                    FontAwesomeIcons.ticket,
                    size: 12,
                    color: AppColors.success,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    '${coupon.appliedCoupon!.code} Applied',
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

  Widget _buildPaymentBadge(IconData icon, String label, bool isDark) {
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
