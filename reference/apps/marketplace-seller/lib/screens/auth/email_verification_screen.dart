// lib/screens/auth/email_verification_screen.dart

import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../l10n/generated/app_localizations.dart';

import '../../providers/seller_provider.dart';
import '../../app/routes.dart';
import 'widgets/auth_layout.dart';

class EmailVerificationScreen extends StatefulWidget {
  final String email;
  final String sellerId;
  final String userName;

  const EmailVerificationScreen({
    super.key, 
    required this.email,
    this.sellerId = '',
    this.userName = '',
  });

  @override
  State<EmailVerificationScreen> createState() =>
      _EmailVerificationScreenState();
}

class _EmailVerificationScreenState extends State<EmailVerificationScreen> {
  Timer? _checkTimer;
  bool _isLoading = false;
  bool _isResending = false;
  bool _emailSent = false;
  int _resendSeconds = 0;
  Timer? _resendTimer;
  String? _error;
  
  String _actualEmail = '';
  static const String _functionsBaseUrl = 
      'https://us-central1-letbuy-y.cloudfunctions.net';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _initializeEmail());
  }

  @override
  void dispose() {
    _checkTimer?.cancel();
    _resendTimer?.cancel();
    super.dispose();
  }
  
  void _initializeEmail() {
    if (widget.email.isNotEmpty) {
      _actualEmail = widget.email;
    } else {
      final sellerProvider = context.read<SellerProvider>();
      final seller = sellerProvider.currentSeller;
      _actualEmail = seller?.email ?? '';
    }
    
    if (_actualEmail.isEmpty) {
      setState(() {
        _error = 'No email address available. Please log in again.';
        _isLoading = false;
      });
      return;
    }
    
    setState(() {});
    _sendVerificationEmail();
  }

  void _startVerificationCheck() {
    _checkTimer?.cancel();
    _checkTimer = Timer.periodic(const Duration(seconds: 5), (timer) {
      _checkEmailVerified();
    });
  }

  void _startResendCooldown() {
    _resendSeconds = 60;
    _resendTimer?.cancel();
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_resendSeconds > 0) {
        if (mounted) setState(() => _resendSeconds--);
      } else {
        timer.cancel();
      }
    });
  }

  Future<void> _sendVerificationEmail() async {
    if (!mounted) return;
    setState(() { _isLoading = true; _error = null; });

    try {
      // Prioritize values passed via widget (from navigation), fallback to provider
      String sellerId = widget.sellerId;
      String userName = widget.userName;
      String emailToUse = _actualEmail;
      
      // Fallback to provider if widget values are empty
      if (sellerId.isEmpty || userName.isEmpty) {
        final sellerProvider = context.read<SellerProvider>();
        final seller = sellerProvider.currentSeller;
        if (sellerId.isEmpty) sellerId = seller?.sellerId ?? '';
        if (userName.isEmpty) userName = seller?.name ?? seller?.storeName ?? 'Seller';
      }
      
      if (sellerId.isEmpty || emailToUse.isEmpty) {
        if (mounted) setState(() { _error = 'Invalid data. Please try again or contact support.'; _isLoading = false; });
        return;
      }
      
      final response = await http.post(
        Uri.parse('$_functionsBaseUrl/sendSellerVerificationEmail'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({ 'email': emailToUse, 'userName': userName, 'sellerId': sellerId }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['result']?['success'] == true) {
        if (mounted) {
          setState(() { _emailSent = true; _isLoading = false; });
          _showSuccess(context, 'Verification email sent! Check your inbox.');
          _startVerificationCheck();
          _startResendCooldown();
        }
      } else {
        throw Exception(data['result']?['message'] ?? 'Failed to send email');
      }
    } catch (e) {
      if (mounted) setState(() { _error = 'Failed to send verification email.'; _isLoading = false; });
    }
  }

  Future<void> _checkEmailVerified() async {
    try {
      final sellerProvider = context.read<SellerProvider>();
      await sellerProvider.refreshSellerData();
      if (sellerProvider.currentSeller?.emailVerified == true) {
        _checkTimer?.cancel();
        if (mounted) {
          _showSuccess(context, 'Email verified successfully!');
          Navigator.pushReplacementNamed(context, AppRoutes.kycBusiness);
        }
      }
    } catch (e) { /* ignore */ }
  }

  Future<void> _resendVerificationEmail() async {
    if (_resendSeconds > 0 || _isResending) return;
    setState(() => _isResending = true);

    try {
      final seller = context.read<SellerProvider>().currentSeller;
      if (seller == null) throw Exception('Seller data not found');

      final response = await http.post(
        Uri.parse('$_functionsBaseUrl/resendSellerVerificationEmail'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({ 'sellerId': seller.sellerId }),
      );
      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['result']?['success'] == true) {
        if (mounted) {
          setState(() { _emailSent = true; _error = null; });
          _showSuccess(context, 'Verification email resent!');
          _startResendCooldown();
          _startVerificationCheck();
        }
      } else {
        throw Exception(data['result']?['message'] ?? 'Failed to resend');
      }
    } catch (e) {
      if (mounted) _showError(context, 'Failed to resend: ${e.toString()}');
    } finally {
      if (mounted) setState(() => _isResending = false);
    }
  }

  void _showSuccess(BuildContext context, String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.green,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _showError(BuildContext context, String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _continueToNextStep() => Navigator.pushReplacementNamed(context, AppRoutes.kycBusiness);
  void _goBack() => Navigator.pushReplacementNamed(context, AppRoutes.login);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final l10n = AppLocalizations.of(context)!;
    final displayEmail = _actualEmail;

    String title = l10n.verifyEmail;
    String subtitle = 'Please verify your email address to continue';
    
    if (_isLoading) {
      title = l10n.sendingEmail;
      subtitle = 'Please wait...';
    } else if (_emailSent) {
      title = l10n.checkYourEmail;
      subtitle = '${l10n.emailVerificationSent} to $displayEmail';
    } else if (_error != null) {
      title = l10n.emailNotSent;
      subtitle = _error!;
    }

    return AuthLayout(
      title: title,
      subtitle: subtitle,
      showBackButton: true,
      onBackPressed: _goBack,
      child: Column(
        children: [
          _buildContent(displayEmail, isDark, l10n),
          const SizedBox(height: 32),
          _buildFooter(theme, l10n),
        ],
      ),
    );
  }

  Widget _buildContent(String displayEmail, bool isDark, AppLocalizations l10n) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 100,
          height: 100,
          decoration: BoxDecoration(
            color: _emailSent ? Colors.green.withValues(alpha: 0.1) : (_error != null ? Colors.red.withValues(alpha: 0.1) : Colors.blue.withValues(alpha: 0.1)),
            shape: BoxShape.circle,
          ),
          child: _isLoading
              ? const Center(child: CircularProgressIndicator(strokeWidth: 3))
              : Icon(
                  _emailSent ? Icons.mark_email_read_outlined : (_error != null ? Icons.error_outline : Icons.mark_email_unread_outlined),
                  size: 50,
                  color: _emailSent ? Colors.green : (_error != null ? Colors.red : Colors.blue),
                ),
        ),
        const SizedBox(height: 32),
        if (_emailSent) ...[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: isDark ? Colors.grey[800] : Colors.grey[100],
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: isDark ? Colors.grey[700]! : Colors.grey[200]!),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                const SizedBox(width: 12),
                Flexible(child: Text(l10n.waitingForVerification, style: TextStyle(color: isDark ? Colors.grey[300] : Colors.grey[700], fontSize: 14))),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.amber.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                Icon(Icons.info_outline, color: Colors.amber[700], size: 20),
                const SizedBox(width: 12),
                Expanded(child: Text(l10n.clickLinkToVerify, style: TextStyle(color: isDark ? Colors.amber[200] : Colors.amber[900], fontSize: 13))),
              ],
            ),
          ),
        ],
        if (_error != null) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.red.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                const Icon(Icons.error_outline, color: Colors.red, size: 20),
                const SizedBox(width: 12),
                Expanded(child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13))),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildFooter(ThemeData theme, AppLocalizations l10n) {
    return Column(
      children: [
        if (!_isLoading) ...[
          Container(
            width: double.infinity,
            height: 56,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              gradient: _resendSeconds > 0 
                ? null 
                : (theme.brightness == Brightness.dark 
                    ? AppColors.primaryGradientDark 
                    : AppColors.primaryGradient),
              color: _resendSeconds > 0 ? (theme.brightness == Brightness.dark ? Colors.grey[800] : Colors.grey[200]) : null,
              boxShadow: _resendSeconds > 0 ? null : [BoxShadow(color: theme.colorScheme.primary.withValues(alpha: 0.35), blurRadius: 20, offset: const Offset(0, 10))],
            ),
            child: ElevatedButton.icon(
              onPressed: _resendSeconds > 0 || _isResending ? null : _resendVerificationEmail,
              icon: _isResending ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Icon(Icons.refresh, color: _resendSeconds > 0 ? Colors.grey : Colors.white),
              label: Text(_resendSeconds > 0 ? '${l10n.resendIn} ${_resendSeconds}s' : (_emailSent ? l10n.resend : l10n.verifyEmail), style: TextStyle(color: _resendSeconds > 0 ? Colors.grey : Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
              style: ElevatedButton.styleFrom(backgroundColor: Colors.transparent, shadowColor: Colors.transparent, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
            ),
          ),
        ],
        const SizedBox(height: 16),
        TextButton(
          onPressed: _continueToNextStep,
          child: Text(l10n.skipAndContinue, style: TextStyle(color: theme.brightness == Brightness.dark ? Colors.grey[400] : Colors.grey[600], decoration: TextDecoration.underline)),
        ),
      ],
    );
  }
}
