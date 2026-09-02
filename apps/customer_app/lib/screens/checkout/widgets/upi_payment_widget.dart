// ============================================================
// UPI PAYMENT WIDGET
// Custom UPI payment UI with VPA input and installed apps
// ============================================================

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';

/// UPI Payment Widget - Shows UPI ID input and installed UPI apps
class UpiPaymentWidget extends StatefulWidget {
  final CustomCheckoutService checkoutService;
  final String userName;
  final String userEmail;
  final String userPhone;
  final bool isOrderCreated;

  const UpiPaymentWidget({
    super.key,
    required this.checkoutService,
    required this.userName,
    required this.userEmail,
    required this.userPhone,
    required this.isOrderCreated,
  });

  @override
  State<UpiPaymentWidget> createState() => _UpiPaymentWidgetState();
}

class _UpiPaymentWidgetState extends State<UpiPaymentWidget> {
  final TextEditingController _upiController = TextEditingController();
  final FocusNode _upiFocusNode = FocusNode();

  bool _isValidating = false;
  bool _isVerified = false;
  bool _isPaying = false;
  String? _verifiedName;
  String? _errorMessage;
  List<UpiApp> _installedApps = [];
  bool _loadingApps = true;

  @override
  void initState() {
    super.initState();
    _loadInstalledApps();
  }

  @override
  void dispose() {
    _upiController.dispose();
    _upiFocusNode.dispose();
    super.dispose();
  }

  Future<void> _loadInstalledApps() async {
    final apps = await widget.checkoutService.getInstalledUpiApps();
    if (mounted) {
      setState(() {
        _installedApps = apps;
        _loadingApps = false;
      });
    }
  }

  Future<void> _validateVpa() async {
    final vpa = _upiController.text.trim();
    if (vpa.isEmpty) {
      setState(() => _errorMessage = 'Please enter UPI ID');
      return;
    }

    // Basic format check
    if (!vpa.contains('@')) {
      setState(() => _errorMessage = 'Invalid UPI ID format');
      return;
    }

    setState(() {
      _isValidating = true;
      _errorMessage = null;
      _isVerified = false;
      _verifiedName = null;
    });

    HapticFeedback.lightImpact();

    final result = await widget.checkoutService.validateUpiId(vpa);

    if (mounted) {
      setState(() {
        _isValidating = false;
        if (result.valid) {
          _isVerified = true;
          _verifiedName = result.customerName;
          HapticFeedback.mediumImpact();
        } else {
          _errorMessage = result.error ?? 'Invalid UPI ID';
        }
      });
    }
  }

  Future<void> _payWithUpi() async {
    if (!_isVerified || !widget.isOrderCreated) return;

    setState(() => _isPaying = true);
    HapticFeedback.mediumImpact();

    await widget.checkoutService.payWithUpiId(
      vpa: _upiController.text.trim(),
      userName: widget.userName,
      userEmail: widget.userEmail,
      userPhone: widget.userPhone,
    );

    // Payment result is handled by the service callbacks
    if (mounted) {
      setState(() => _isPaying = false);
    }
  }

  Future<void> _payWithApp(UpiApp app) async {
    if (!widget.isOrderCreated) return;

    HapticFeedback.mediumImpact();

    await widget.checkoutService.payWithUpiApp(
      app: app,
      userName: widget.userName,
      userEmail: widget.userEmail,
      userPhone: widget.userPhone,
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // UPI ID Input Section
          _buildSectionTitle('Pay using UPI ID', Icons.qr_code_2_rounded, isDark),
          const SizedBox(height: 12),
          _buildUpiInput(isDark, accentColor),

          const SizedBox(height: 32),

          // Installed UPI Apps Section
          _buildSectionTitle('Pay using UPI Apps', Icons.apps_rounded, isDark),
          const SizedBox(height: 12),
          _buildInstalledApps(isDark, accentColor),

          const SizedBox(height: 24),

          // Security note
          _buildSecurityNote(isDark),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title, IconData icon, bool isDark) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: (isDark ? Colors.white : AppColors.primary).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(
            icon,
            size: 18,
            color: isDark ? Colors.white70 : AppColors.primary,
          ),
        ),
        const SizedBox(width: 12),
        Text(
          title,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
      ],
    );
  }

  Widget _buildUpiInput(bool isDark, Color accentColor) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? Colors.grey[850] : Colors.grey[50],
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: _isVerified
              ? Colors.green
              : _errorMessage != null
                  ? AppColors.error
                  : (isDark ? Colors.grey[700]! : Colors.grey[300]!),
          width: _isVerified || _errorMessage != null ? 2 : 1,
        ),
      ),
      child: Column(
        children: [
          // Input field
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _upiController,
                    focusNode: _upiFocusNode,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.done,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                    decoration: InputDecoration(
                      hintText: 'yourname@upi',
                      hintStyle: TextStyle(
                        color: isDark ? Colors.grey[500] : Colors.grey[400],
                        fontWeight: FontWeight.w500,
                      ),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    onChanged: (_) {
                      if (_isVerified || _errorMessage != null) {
                        setState(() {
                          _isVerified = false;
                          _verifiedName = null;
                          _errorMessage = null;
                        });
                      }
                    },
                    onSubmitted: (_) => _validateVpa(),
                  ),
                ),

                // Verify button
                if (!_isVerified)
                  TextButton(
                    onPressed: _isValidating ? null : _validateVpa,
                    style: TextButton.styleFrom(
                      foregroundColor: accentColor,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 10,
                      ),
                    ),
                    child: _isValidating
                        ? SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation(accentColor),
                            ),
                          )
                        : const Text(
                            'Verify',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                  ),

                // Verified badge
                if (_isVerified)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.green.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.check_circle,
                          color: Colors.green.shade600,
                          size: 16,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          'Verified',
                          style: TextStyle(
                            color: Colors.green.shade600,
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),

          // Verified name or error
          if (_verifiedName != null || _errorMessage != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              decoration: BoxDecoration(
                color: _isVerified
                    ? Colors.green.withValues(alpha: 0.05)
                    : AppColors.error.withValues(alpha: 0.05),
                borderRadius: const BorderRadius.vertical(
                  bottom: Radius.circular(12),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    _isVerified
                        ? Icons.person_outline
                        : Icons.error_outline_rounded,
                    size: 16,
                    color: _isVerified ? Colors.green.shade600 : AppColors.error,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _isVerified
                        ? 'Account: $_verifiedName'
                        : _errorMessage ?? '',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: _isVerified ? Colors.green.shade600 : AppColors.error,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );

    // Pay button is shown below the input
  }

  Widget _buildInstalledApps(bool isDark, Color accentColor) {
    if (_loadingApps) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: CircularProgressIndicator(
            strokeWidth: 2,
            valueColor: AlwaysStoppedAnimation(accentColor),
          ),
        ),
      );
    }

    if (_installedApps.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isDark ? Colors.grey[850] : Colors.grey[50],
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
          ),
        ),
        child: Column(
          children: [
            Icon(
              Icons.app_shortcut_rounded,
              size: 32,
              color: isDark ? Colors.grey[600] : Colors.grey[400],
            ),
            const SizedBox(height: 8),
            Text(
              'No UPI apps detected',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.grey[400] : Colors.grey[600],
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Use UPI ID above to pay',
              style: TextStyle(
                fontSize: 12,
                color: isDark ? Colors.grey[500] : Colors.grey[500],
              ),
            ),
          ],
        ),
      );
    }

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 4,
        childAspectRatio: 0.85,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemCount: _installedApps.length,
      itemBuilder: (context, index) {
        final app = _installedApps[index];
        return _buildAppButton(app, isDark, accentColor);
      },
    );
  }

  Widget _buildAppButton(UpiApp app, bool isDark, Color accentColor) {
    // Get icon for the app
    IconData getIconForApp(String name) {
      switch (name.toLowerCase()) {
        case 'google pay':
          return Icons.g_mobiledata_rounded;
        case 'phonepe':
          return Icons.phone_android_rounded;
        case 'paytm':
          return Icons.wallet_rounded;
        case 'amazon pay':
          return Icons.shopping_bag_outlined;
        case 'bhim':
          return Icons.account_balance_rounded;
        case 'whatsapp':
          return Icons.chat_bubble_outline_rounded;
        case 'cred':
          return Icons.diamond_outlined;
        default:
          return Icons.account_balance_wallet_outlined;
      }
    }

    Color getColorForApp(String name) {
      switch (name.toLowerCase()) {
        case 'google pay':
          return Colors.blue;
        case 'phonepe':
          return Colors.purple;
        case 'paytm':
          return Colors.blue.shade700;
        case 'amazon pay':
          return Colors.orange;
        case 'bhim':
          return Colors.green.shade700;
        case 'whatsapp':
          return Colors.green;
        case 'cred':
          return Colors.grey.shade800;
        default:
          return accentColor;
      }
    }

    final appColor = getColorForApp(app.name);

    return GestureDetector(
      onTap: () => _payWithApp(app),
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? Colors.grey[850] : Colors.grey[50],
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: appColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                getIconForApp(app.name),
                size: 24,
                color: appColor,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              app.name.split(' ').first, // Show first word only
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.grey[300] : Colors.grey[700],
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSecurityNote(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.green.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: Colors.green.withValues(alpha: 0.2),
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.verified_user_rounded,
            color: Colors.green.shade600,
            size: 20,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'Your payment is secured with 256-bit encryption',
              style: TextStyle(
                fontSize: 12,
                color: Colors.green.shade700,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
