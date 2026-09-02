// ============================================================
// CUSTOM PAYMENT SHEET
// Premium custom payment UI with UPI, Cards, and UPI Apps
// ============================================================

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'upi_payment_widget.dart';
import 'card_payment_widget.dart';

/// Custom Payment Sheet - Shows UPI, Cards, and other payment options
class CustomPaymentSheet extends StatefulWidget {
  final double amount;
  final String userName;
  final String userEmail;
  final String userPhone;
  final void Function(PaymentResult) onPaymentComplete;
  final void Function(String) onError;
  final VoidCallback? onCodSelected;

  const CustomPaymentSheet({
    super.key,
    required this.amount,
    required this.userName,
    required this.userEmail,
    required this.userPhone,
    required this.onPaymentComplete,
    required this.onError,
    this.onCodSelected,
  });

  /// Show the payment sheet as a modal bottom sheet
  static Future<void> show({
    required BuildContext context,
    required double amount,
    required String userName,
    required String userEmail,
    required String userPhone,
    required void Function(PaymentResult) onPaymentComplete,
    required void Function(String) onError,
    VoidCallback? onCodSelected,
  }) async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => CustomPaymentSheet(
        amount: amount,
        userName: userName,
        userEmail: userEmail,
        userPhone: userPhone,
        onPaymentComplete: onPaymentComplete,
        onError: onError,
        onCodSelected: onCodSelected,
      ),
    );
  }

  @override
  State<CustomPaymentSheet> createState() => _CustomPaymentSheetState();
}

class _CustomPaymentSheetState extends State<CustomPaymentSheet>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final CustomCheckoutService _checkoutService = CustomCheckoutService();

  bool _isLoading = false;
  bool _orderCreated = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _initializePayment();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _initializePayment() async {
    setState(() => _isLoading = true);

    // Initialize checkout service
    _checkoutService.initialize(
      onPaymentComplete: (result) {
        if (mounted) {
          Navigator.pop(context);
          widget.onPaymentComplete(result);
        }
      },
      onError: (error) {
        if (mounted) {
          setState(() {
            _errorMessage = error;
            _isLoading = false;
          });
          widget.onError(error);
        }
      },
    );

    // Create Razorpay order
    final orderResult = await _checkoutService.createOrder(
      amount: widget.amount,
      notes: {
        'customer_name': widget.userName,
        'customer_email': widget.userEmail,
      },
    );

    if (mounted) {
      setState(() {
        _isLoading = false;
        _orderCreated = orderResult.success;
        if (!orderResult.success) {
          _errorMessage = orderResult.error ?? 'Failed to create order';
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final backgroundColor = isDark ? const Color(0xFF1A1A1A) : Colors.white;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;

    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Handle bar
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: isDark ? Colors.grey[700] : Colors.grey[300],
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header
          _buildHeader(isDark, accentColor),

          // Loading or Error state
          if (_isLoading)
            const Expanded(
              child: Center(
                child: CircularProgressIndicator(),
              ),
            )
          else if (_errorMessage != null)
            Expanded(
              child: _buildErrorState(isDark, accentColor),
            )
          else ...[
            // Tab bar
            _buildTabBar(isDark, accentColor),

            // Tab content
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  // UPI Tab
                  UpiPaymentWidget(
                    checkoutService: _checkoutService,
                    userName: widget.userName,
                    userEmail: widget.userEmail,
                    userPhone: widget.userPhone,
                    isOrderCreated: _orderCreated,
                  ),

                  // Card Tab
                  CardPaymentWidget(
                    checkoutService: _checkoutService,
                    userName: widget.userName,
                    userEmail: widget.userEmail,
                    userPhone: widget.userPhone,
                    isOrderCreated: _orderCreated,
                  ),

                  // COD Tab
                  _buildCodOption(isDark, accentColor),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildHeader(bool isDark, Color accentColor) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          // Close button
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: isDark ? Colors.grey[800] : Colors.grey[100],
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                Icons.close_rounded,
                color: isDark ? Colors.white70 : Colors.black54,
                size: 20,
              ),
            ),
          ),

          const SizedBox(width: 16),

          // Title
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Choose Payment Method',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Secure payment powered by Razorpay',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),

          // Amount badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [accentColor, accentColor.withValues(alpha: 0.8)],
              ),
              borderRadius: BorderRadius.circular(10),
              boxShadow: [
                BoxShadow(
                  color: accentColor.withValues(alpha: 0.3),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Text(
              '₹${widget.amount.toStringAsFixed(0)}',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabBar(bool isDark, Color accentColor) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      decoration: BoxDecoration(
        color: isDark ? Colors.grey[850] : Colors.grey[100],
        borderRadius: BorderRadius.circular(12),
      ),
      child: TabBar(
        controller: _tabController,
        indicator: BoxDecoration(
          color: accentColor,
          borderRadius: BorderRadius.circular(10),
          boxShadow: [
            BoxShadow(
              color: accentColor.withValues(alpha: 0.3),
              blurRadius: 8,
            ),
          ],
        ),
        indicatorSize: TabBarIndicatorSize.tab,
        dividerColor: Colors.transparent,
        labelColor: Colors.white,
        unselectedLabelColor: isDark ? Colors.grey[400] : Colors.grey[600],
        labelStyle: const TextStyle(
          fontWeight: FontWeight.w700,
          fontSize: 13,
        ),
        unselectedLabelStyle: const TextStyle(
          fontWeight: FontWeight.w600,
          fontSize: 13,
        ),
        padding: const EdgeInsets.all(4),
        tabs: const [
          Tab(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.qr_code_rounded, size: 18),
                SizedBox(width: 6),
                Text('UPI'),
              ],
            ),
          ),
          Tab(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.credit_card_rounded, size: 18),
                SizedBox(width: 6),
                Text('Card'),
              ],
            ),
          ),
          Tab(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.local_shipping_outlined, size: 18),
                SizedBox(width: 6),
                Text('COD'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState(bool isDark, Color accentColor) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.error_outline_rounded,
                size: 48,
                color: AppColors.error,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Payment Initialization Failed',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _errorMessage ?? 'Something went wrong',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: isDark ? Colors.grey[400] : Colors.grey[600],
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _initializePayment,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Retry'),
              style: ElevatedButton.styleFrom(
                backgroundColor: accentColor,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCodOption(bool isDark, Color accentColor) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          const SizedBox(height: 20),

          // COD illustration
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.green.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.payments_outlined,
              size: 64,
              color: Colors.green.shade600,
            ),
          ),

          const SizedBox(height: 24),

          Text(
            'Cash on Delivery',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),

          const SizedBox(height: 12),

          Text(
            'Pay with cash when your order is delivered.\nNo online payment required.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              color: isDark ? Colors.grey[400] : Colors.grey[600],
              height: 1.5,
            ),
          ),

          const SizedBox(height: 32),

          // Info cards
          _buildInfoCard(
            Icons.local_shipping_outlined,
            'Free Delivery',
            'For orders above ₹499',
            Colors.blue,
            isDark,
          ),
          const SizedBox(height: 12),
          _buildInfoCard(
            Icons.check_circle_outline,
            'Quality Check',
            'Inspect before paying',
            Colors.green,
            isDark,
          ),
          const SizedBox(height: 12),
          _buildInfoCard(
            Icons.replay_outlined,
            'Easy Returns',
            '7 days return policy',
            Colors.orange,
            isDark,
          ),

          const SizedBox(height: 32),

          // Confirm COD button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                HapticFeedback.mediumImpact();
                Navigator.pop(context);
                widget.onCodSelected?.call();
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.green.shade600,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                elevation: 0,
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.check_rounded, size: 22),
                  SizedBox(width: 10),
                  Text(
                    'Confirm Cash on Delivery',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCard(
    IconData icon,
    String title,
    String subtitle,
    Color color,
    bool isDark,
  ) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? Colors.grey[850] : Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(width: 14),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              Text(
                subtitle,
                style: TextStyle(
                  fontSize: 12,
                  color: isDark ? Colors.grey[400] : Colors.grey[600],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
