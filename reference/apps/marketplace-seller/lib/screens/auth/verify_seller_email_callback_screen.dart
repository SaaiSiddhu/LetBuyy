// lib/screens/auth/verify_seller_email_callback_screen.dart

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../app/routes.dart';
import 'widgets/auth_layout.dart';

class VerifySellerEmailCallbackScreen extends StatefulWidget {
  final String? token;
  final String? sellerId;

  const VerifySellerEmailCallbackScreen({
    super.key,
    this.token,
    this.sellerId,
  });

  @override
  State<VerifySellerEmailCallbackScreen> createState() =>
      _VerifySellerEmailCallbackScreenState();
}

class _VerifySellerEmailCallbackScreenState
    extends State<VerifySellerEmailCallbackScreen> {
  bool _isLoading = true;
  bool _isSuccess = false;
  String _message = 'Verifying...';
  String? _error;

  static const String _functionsBaseUrl =
      'https://us-central1-letbuy-y.cloudfunctions.net';

  @override
  void initState() {
    super.initState();
    _verifyEmail();
  }

  Future<void> _verifyEmail() async {
    if (widget.token == null || widget.sellerId == null) {
      setState(() {
        _isLoading = false;
        _isSuccess = false;
        _error = 'Invalid verification link.';
        _message = 'Verification Failed';
      });
      return;
    }

    try {
      final response = await http.post(
        Uri.parse('$_functionsBaseUrl/verifySellerEmail'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({ 'token': widget.token, 'sellerId': widget.sellerId }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['result']?['success'] == true) {
        setState(() { _isLoading = false; _isSuccess = true; _message = 'Email Verified!'; });
      } else {
        setState(() { _isLoading = false; _isSuccess = false; _error = data['result']?['message'] ?? 'Failed'; _message = 'Verification Failed'; });
      }
    } catch (e) {
      setState(() { _isLoading = false; _isSuccess = false; _error = 'Network error.'; _message = 'Verification Failed'; });
    }
  }

  void _goToLogin() => Navigator.pushNamedAndRemoveUntil(context, AppRoutes.login, (route) => false);
  void _goToKycWizard() => Navigator.pushNamedAndRemoveUntil(context, AppRoutes.kycBusiness, (route) => false);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context)!;
    
    String title = l10n.verifying;
    String subtitle = l10n.waitingForVerification;
    
    if (_isLoading) {
      title = l10n.verifying;
      subtitle = l10n.waitingForVerification;
    } else if (_isSuccess) {
      title = l10n.emailVerified;
      subtitle = 'Your email has been verified.';
    } else {
      title = l10n.verificationFailed;
      subtitle = 'We couldn\'t verify your email.';
    }

    return AuthLayout(
      title: title,
      subtitle: subtitle,
      showBackButton: false,
      child: Column(
        children: [
          _buildIconContent(theme, l10n),
          const SizedBox(height: 32),
          if (_isSuccess)
            _buildSuccessActions(theme, l10n)
          else if (_error != null)
            _buildErrorActions(theme, l10n)
          else
            const SizedBox.shrink(),
        ],
      ),
    );
  }

  Widget _buildIconContent(ThemeData theme, AppLocalizations l10n) {
    if (_isLoading) {
      return Container(
        width: 100, height: 100,
        decoration: BoxDecoration(color: theme.colorScheme.primary.withValues(alpha: 0.1), shape: BoxShape.circle),
        child: Center(child: CircularProgressIndicator(valueColor: AlwaysStoppedAnimation<Color>(theme.colorScheme.primary), strokeWidth: 3)),
      );
    }
    return Column(
      children: [
        Container(
          width: 100, height: 100,
          decoration: BoxDecoration(color: _isSuccess ? Colors.green.withValues(alpha: 0.1) : Colors.red.withValues(alpha: 0.1), shape: BoxShape.circle),
          child: Icon(_isSuccess ? Icons.check_circle_rounded : Icons.error_rounded, size: 60, color: _isSuccess ? Colors.green : Colors.red),
        ),
        if (_error != null) ...[
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: Colors.red.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
            child: Row(
              children: [
                const Icon(Icons.error_outline, color: Colors.red),
                const SizedBox(width: 12),
                Expanded(child: Text(_error!, style: const TextStyle(color: Colors.red, fontWeight: FontWeight.w500))),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildSuccessActions(ThemeData theme, AppLocalizations l10n) {
    return Column(
      children: [
        Container(
          width: double.infinity, height: 56,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            gradient: theme.brightness == Brightness.dark ? AppColors.primaryGradientDark : AppColors.primaryGradient,
            boxShadow: [BoxShadow(color: theme.colorScheme.primary.withValues(alpha: 0.35), blurRadius: 20, offset: const Offset(0, 10))],
          ),
          child: ElevatedButton.icon(
            onPressed: _goToKycWizard,
            style: ElevatedButton.styleFrom(backgroundColor: Colors.transparent, shadowColor: Colors.transparent, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
            icon: const Icon(Icons.arrow_forward_rounded, color: Colors.white),
            label: Text(l10n.continueToKyc, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
          ),
        ),
        const SizedBox(height: 16),
        TextButton(onPressed: _goToLogin, child: Text(l10n.backToLogin, style: TextStyle(color: theme.brightness == Brightness.dark ? Colors.grey[400] : Colors.grey[600]))),
      ],
    );
  }

  Widget _buildErrorActions(ThemeData theme, AppLocalizations l10n) {
    return Container(
      width: double.infinity, height: 56,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        gradient: LinearGradient(colors: [theme.colorScheme.primary, theme.colorScheme.primary.withValues(alpha: 0.85)]),
        boxShadow: [BoxShadow(color: theme.colorScheme.primary.withValues(alpha: 0.35), blurRadius: 20, offset: const Offset(0, 10))],
      ),
      child: ElevatedButton.icon(
        onPressed: _goToLogin,
        style: ElevatedButton.styleFrom(backgroundColor: Colors.transparent, shadowColor: Colors.transparent, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
        icon: const Icon(Icons.login_rounded, color: Colors.white),
        label: Text(l10n.backToLogin, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
      ),
    );
  }
}
