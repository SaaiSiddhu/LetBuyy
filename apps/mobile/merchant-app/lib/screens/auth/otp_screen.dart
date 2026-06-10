import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../app/routes.dart';
import '../../services/store_auth_service.dart';
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class OtpScreen extends StatefulWidget {
  const OtpScreen({
    super.key,
    required this.email,
    required this.password,
    this.name,
  });

  final String email;
  final String password;
  final String? name;

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final _otpController = TextEditingController();
  bool _isSubmitting = false;
  bool _isResending = false;
  String? _error;

  @override
  void dispose() {
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final otp = _otpController.text.trim();
    if (otp.length != 6) {
      setState(() => _error = 'Enter the 6-digit verification code.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    try {
      final auth = context.read<StoreAuthService>();
      await auth.signUp(
        widget.email,
        widget.password,
        name: widget.name,
        otp: otp,
      );

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('store_user_email', widget.email);

      if (!mounted) return;
      final store = await context.read<StoreContext>().ensureSelectedStore();
      if (!mounted) return;
      Navigator.pushNamedAndRemoveUntil(
        context,
        store == null ? AppRoutes.wizard : AppRoutes.main,
        (_) => false,
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString().replaceAll('Exception: ', '');
      });
      HapticFeedback.heavyImpact();
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _resend() async {
    setState(() {
      _isResending = true;
      _error = null;
    });

    try {
      final token = await _resolveTurnstileToken();
      if (token == null) return;
      await context.read<StoreAuthService>().requestSignUpOtp(
        widget.email,
        turnstileToken: token,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Verification code sent again.')),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString().replaceAll('Exception: ', '');
      });
    } finally {
      if (mounted) setState(() => _isResending = false);
    }
  }

  Future<String?> _resolveTurnstileToken() async {
    return Navigator.pushNamed<String>(context, AppRoutes.turnstileChallenge);
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Scaffold(
      backgroundColor: colors.bgStart,
      appBar: AppBar(
        backgroundColor: colors.bgStart,
        foregroundColor: colors.textPrimary,
        elevation: 0,
      ),
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(LetbuyySpacingTokens.space24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: LetbuyySpacingTokens.space24),
                Icon(
                  Icons.mark_email_read_outlined,
                  color: colors.accent,
                  size: 42,
                ),
                const SizedBox(height: LetbuyySpacingTokens.space20),
                Text(
                  'Check your email',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: LetbuyySpacingTokens.space8),
                Text(
                  'We sent a 6-digit code to ${widget.email}.',
                  style: TextStyle(color: colors.textSecondary, height: 1.4),
                ),
                const SizedBox(height: LetbuyySpacingTokens.space32),
                TextField(
                  controller: _otpController,
                  autofocus: true,
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.done,
                  maxLength: 6,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(6),
                  ],
                  onSubmitted: (_) => _submit(),
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 8,
                  ),
                  decoration: InputDecoration(
                    counterText: '',
                    hintText: '000000',
                    hintStyle: TextStyle(
                      color: colors.textHint,
                      letterSpacing: 8,
                    ),
                    filled: true,
                    fillColor: colors.card,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: BorderSide(color: colors.cardBorder),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: BorderSide(color: colors.cardBorder),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: BorderSide(color: colors.accent, width: 2),
                    ),
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: LetbuyySpacingTokens.space16),
                  Text(
                    _error!,
                    style: TextStyle(color: colors.error, height: 1.4),
                  ),
                ],
                const Spacer(),
                SizedBox(
                  height: 52,
                  child: ElevatedButton(
                    onPressed: _isSubmitting ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: colors.accent,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: _isSubmitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Verify and continue'),
                  ),
                ),
                TextButton(
                  onPressed: _isResending ? null : _resend,
                  child: Text(_isResending ? 'Sending...' : 'Resend code'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
