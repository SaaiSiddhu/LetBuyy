// lib/screens/auth/otp_screen.dart
// OTP SCREEN — LetBuyy v2 redesign
// 6 individual boxes · paste · SMS autofill · backspace · auto-submit
// Exact identity web-app background colors · matches login page design language

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../app/routes.dart';
import '../../app/store_context.dart';
import '../../config/app_config.dart';
import '../../services/store_auth_service.dart';
import '../../services/theme_provider.dart';
import '../../theme/app_theme_colors.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Constants — identical to login_screen.dart
// ─────────────────────────────────────────────────────────────────────────────
const _kPrimary      = Color(0xFF6C47FF);
const _kPrimaryLight = Color(0xFF8B6AFF);
const _kPrimaryDark  = Color(0xFF4C2EBD);

const _kDarkBg    = Color(0xFF0A0912);  // identity --bg dark
const _kLightBg   = Color(0xFFFAF9FF); // identity --bg light
const _kDarkInput = Color(0xFF0D0B16); // identity --input-bg dark
const _kLightInput= Color(0xFFFFFFFF); // identity --input-bg light

// ─────────────────────────────────────────────────────────────────────────────

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

class _OtpScreenState extends State<OtpScreen> with TickerProviderStateMixin {
  String _otp = '';
  bool _isSubmitting = false;
  bool _isResending  = false;
  String? _error;

  // Resend countdown
  int _resendSeconds = 60;
  Timer? _resendTimer;

  // Entry animation
  late AnimationController _entryCtrl;
  late Animation<double>   _fadeAnim;
  late Animation<Offset>   _slideAnim;

  // Shake animation for error
  late AnimationController _shakeCtrl;
  late Animation<Offset>   _shakeAnim;

  @override
  void initState() {
    super.initState();

    // Entry
    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 650),
    );
    _fadeAnim = CurvedAnimation(parent: _entryCtrl, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.04),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _entryCtrl, curve: Curves.easeOut));
    _entryCtrl.forward();

    // Shake
    _shakeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _shakeAnim = TweenSequence<Offset>([
      TweenSequenceItem(tween: Tween(begin: Offset.zero, end: const Offset(-0.025, 0)), weight: 1),
      TweenSequenceItem(tween: Tween(begin: const Offset(-0.025, 0), end: const Offset(0.025, 0)), weight: 2),
      TweenSequenceItem(tween: Tween(begin: const Offset(0.025, 0), end: const Offset(-0.018, 0)), weight: 2),
      TweenSequenceItem(tween: Tween(begin: const Offset(-0.018, 0), end: const Offset(0.018, 0)), weight: 2),
      TweenSequenceItem(tween: Tween(begin: const Offset(0.018, 0), end: Offset.zero), weight: 1),
    ]).animate(CurvedAnimation(parent: _shakeCtrl, curve: Curves.easeInOut));

    _startResendTimer();
  }

  void _startResendTimer() {
    _resendSeconds = 60;
    _resendTimer?.cancel();
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) { t.cancel(); return; }
      setState(() {
        if (_resendSeconds > 0) {
          _resendSeconds--;
        } else {
          t.cancel();
        }
      });
    });
  }

  @override
  void dispose() {
    _resendTimer?.cancel();
    _entryCtrl.dispose();
    _shakeCtrl.dispose();
    super.dispose();
  }

  // ── Auth ──────────────────────────────────────────────────

  Future<void> _submit() async {
    if (_otp.length != 6) {
      _triggerError('Enter the 6-digit code from your email.');
      return;
    }
    setState(() { _isSubmitting = true; _error = null; });

    try {
      final auth = context.read<StoreAuthService>();
      await auth.signUp(widget.email, widget.password, name: widget.name, otp: _otp);

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
    } catch (e) {
      if (!mounted) return;
      _triggerError(e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _resend() async {
    if (_isResending || _resendSeconds > 0) return;
    setState(() { _isResending = true; _error = null; });

    try {
      final token = await _resolveTurnstileToken();
      if (token == null) return;
      await context.read<StoreAuthService>().requestSignUpOtp(
        widget.email,
        turnstileToken: token,
      );
      if (!mounted) return;
      setState(() => _otp = '');
      _startResendTimer();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('New code sent — check your inbox.'),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          duration: const Duration(seconds: 3),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      _triggerError(e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isResending = false);
    }
  }

  Future<String?> _resolveTurnstileToken() async {
    if (AppConfig.hasTurnstileToken) return AppConfig.turnstileToken.trim();
    final token = await Navigator.pushNamed(context, AppRoutes.turnstileChallenge);
    return token as String?;
  }

  void _triggerError(String msg) {
    HapticFeedback.heavyImpact();
    setState(() => _error = msg);
    _shakeCtrl.forward(from: 0);
  }

  void _onOtpChanged(String value) {
    setState(() {
      _otp = value;
      if (_error != null) _error = null;
    });
    // Auto-submit when all 6 digits filled
    if (value.length == 6 && !_isSubmitting) {
      Future.delayed(const Duration(milliseconds: 280), () {
        if (mounted && _otp.length == 6 && !_isSubmitting) _submit();
      });
    }
  }

  // ── Build ─────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();
    final colors = AppThemeColors.of(context);
    final isDark = themeProvider.isDarkMode(context);
    final size = MediaQuery.of(context).size;

    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: isDark ? Brightness.light : Brightness.dark,
      systemNavigationBarColor: isDark ? _kDarkBg : _kLightBg,
    ));

    return Scaffold(
      backgroundColor: isDark ? _kDarkBg : _kLightBg,
      resizeToAvoidBottomInset: true,
      body: Stack(
        children: [
          // Ambient background
          _AmbientBackground(isDark: isDark),

          SafeArea(
            child: Column(
              children: [
                _buildTopBar(themeProvider, isDark, colors),
                Expanded(
                  child: SingleChildScrollView(
                    padding: EdgeInsets.symmetric(
                      horizontal: size.width > 600 ? 64 : 28,
                    ),
                    physics: const BouncingScrollPhysics(),
                    child: FadeTransition(
                      opacity: _fadeAnim,
                      child: SlideTransition(
                        position: _slideAnim,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const SizedBox(height: 28),

                            // Logo
                            Center(
                              child: SvgPicture.asset(
                                isDark
                                    ? 'assets/images/letbuyy-logo-dark.svg'
                                    : 'assets/images/letbuyy-logo-light.svg',
                                height: 48,
                                fit: BoxFit.contain,
                              ),
                            ),

                            const SizedBox(height: 36),

                            // Animated envelope icon
                            Center(child: _AnimatedEnvelope(isDark: isDark)),

                            const SizedBox(height: 24),

                            // Header
                            Text(
                              'Check your email',
                              style: TextStyle(
                                fontSize: 30,
                                fontWeight: FontWeight.w800,
                                color: colors.textPrimary,
                                letterSpacing: -0.8,
                                height: 1.1,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 10),
                            RichText(
                              textAlign: TextAlign.center,
                              text: TextSpan(
                                style: TextStyle(
                                  fontSize: 14.5,
                                  color: colors.textSecondary,
                                  height: 1.5,
                                ),
                                children: [
                                  const TextSpan(text: 'We sent a 6-digit code to\n'),
                                  TextSpan(
                                    text: widget.email,
                                    style: TextStyle(
                                      color: colors.textPrimary,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ),

                            const SizedBox(height: 40),

                            // Error banner
                            if (_error != null) ...[
                              SlideTransition(
                                position: _shakeAnim,
                                child: _ErrorBanner(message: _error!, colors: colors),
                              ),
                              const SizedBox(height: 20),
                            ],

                            // ── 6-box OTP input ───────────────
                            SlideTransition(
                              position: _shakeAnim,
                              child: _OtpBoxInput(
                                value: _otp,
                                isDark: isDark,
                                colors: colors,
                                hasError: _error != null,
                                onChanged: _onOtpChanged,
                                onSubmitted: () => _submit(),
                              ),
                            ),

                            const SizedBox(height: 36),

                            // CTA button
                            _buildSubmitButton(isDark),

                            const SizedBox(height: 20),

                            // Resend row
                            _buildResendRow(colors),

                            const SizedBox(height: 32),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Top bar ───────────────────────────────────────────────

  Widget _buildTopBar(
      ThemeProvider themeProvider, bool isDark, AppThemeColors colors) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _GlassBtn(
            onTap: () => Navigator.pop(context),
            isDark: isDark,
            child: Icon(Icons.arrow_back_ios_new_rounded,
                size: 16,
                color: isDark ? Colors.white70 : Colors.black87),
          ),
          _GlassBtn(
            onTap: () {
              HapticFeedback.lightImpact();
              themeProvider.toggleTheme();
            },
            isDark: isDark,
            child: Icon(
              isDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
              size: 16,
              color: isDark ? const Color(0xFFFBBF24) : _kPrimary,
            ),
          ),
        ],
      ),
    );
  }

  // ── CTA button ────────────────────────────────────────────

  Widget _buildSubmitButton(bool isDark) {
    final isReady = _otp.length == 6;
    return AnimatedOpacity(
      opacity: isReady ? 1.0 : 0.55,
      duration: const Duration(milliseconds: 200),
      child: SizedBox(
        height: 52,
        child: Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(14),
          child: InkWell(
            onTap: _isSubmitting ? null : _submit,
            borderRadius: BorderRadius.circular(14),
            child: Ink(
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [_kPrimaryLight, _kPrimary, _kPrimaryDark],
                  stops: [0.0, 0.5, 1.0],
                ),
                borderRadius: BorderRadius.circular(14),
                boxShadow: isReady
                    ? [
                        BoxShadow(
                          color: _kPrimary.withValues(alpha: 0.35),
                          blurRadius: 20,
                          offset: const Offset(0, 6),
                        ),
                      ]
                    : null,
              ),
              child: Center(
                child: _isSubmitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2.2),
                      )
                    : Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.verified_rounded,
                              color: Colors.white, size: 17),
                          const SizedBox(width: 8),
                          const Text(
                            'Verify & continue',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.2,
                            ),
                          ),
                        ],
                      ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ── Resend row ────────────────────────────────────────────

  Widget _buildResendRow(AppThemeColors colors) {
    final canResend = _resendSeconds == 0 && !_isResending;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          "Didn't get the code? ",
          style: TextStyle(color: colors.textSecondary, fontSize: 14),
        ),
        GestureDetector(
          onTap: canResend ? _resend : null,
          child: AnimatedDefaultTextStyle(
            duration: const Duration(milliseconds: 200),
            style: TextStyle(
              color: canResend ? _kPrimary : colors.textTertiary,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
            child: _isResending
                ? const Text('Sending…')
                : _resendSeconds > 0
                    ? Text('Resend in ${_resendSeconds}s')
                    : const Text('Resend →'),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6-box OTP Input Widget
// ─────────────────────────────────────────────────────────────────────────────

class _OtpBoxInput extends StatefulWidget {
  const _OtpBoxInput({
    required this.value,
    required this.isDark,
    required this.colors,
    required this.hasError,
    required this.onChanged,
    required this.onSubmitted,
  });

  final String value;
  final bool isDark;
  final AppThemeColors colors;
  final bool hasError;
  final ValueChanged<String> onChanged;
  final VoidCallback onSubmitted;

  @override
  State<_OtpBoxInput> createState() => _OtpBoxInputState();
}

class _OtpBoxInputState extends State<_OtpBoxInput> {
  final _ctrl = TextEditingController();
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(() => setState(() {}));
  }

  @override
  void didUpdateWidget(covariant _OtpBoxInput old) {
    super.didUpdateWidget(old);
    // Keep controller in sync if parent resets value (e.g. resend clears OTP)
    if (widget.value != _ctrl.text) {
      _ctrl.value = TextEditingValue(
        text: widget.value,
        selection: TextSelection.collapsed(offset: widget.value.length),
      );
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _handleChanged(String raw) {
    // Strip non-digits and clamp to 6
    final digits = raw.replaceAll(RegExp(r'[^0-9]'), '');
    final clamped = digits.length > 6 ? digits.substring(digits.length - 6) : digits;

    if (clamped != _ctrl.text) {
      _ctrl.value = TextEditingValue(
        text: clamped,
        selection: TextSelection.collapsed(offset: clamped.length),
      );
    }
    widget.onChanged(clamped);
  }

  @override
  Widget build(BuildContext context) {
    final hasFocus = _focus.hasFocus;
    final value = widget.value;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        HapticFeedback.selectionClick();
        if (_focus.hasFocus) {
          // already focused — no-op
        } else {
          FocusScope.of(context).requestFocus(_focus);
        }
      },
      child: Stack(
        alignment: Alignment.center,
        children: [
          // ── 6 visual boxes ───────────────────────────────
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(6, (i) {
              final isFilled = i < value.length;
              final isActive = hasFocus &&
                  (i == value.length || (i == 5 && value.length == 6));
              final digit = isFilled ? value[i] : '';

              return _OtpBox(
                digit: digit,
                isActive: isActive,
                isFilled: isFilled,
                hasError: widget.hasError,
                isDark: widget.isDark,
                colors: widget.colors,
                index: i,
              );
            }),
          ),

          // ── Invisible TextField (captures all input) ─────
          Opacity(
            opacity: 0,
            child: SizedBox(
              height: 60,
              // Full row width so tap area covers all boxes
              width: MediaQuery.of(context).size.width,
              child: TextField(
                controller: _ctrl,
                focusNode: _focus,
                autofocus: true,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.done,
                autofillHints: const [AutofillHints.oneTimeCode],
                enableInteractiveSelection: true,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                maxLength: 6,
                onChanged: _handleChanged,
                onSubmitted: (_) => widget.onSubmitted(),
                decoration: const InputDecoration(counterText: ''),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Single OTP box
// ─────────────────────────────────────────────────────────────────────────────

class _OtpBox extends StatelessWidget {
  const _OtpBox({
    required this.digit,
    required this.isActive,
    required this.isFilled,
    required this.hasError,
    required this.isDark,
    required this.colors,
    required this.index,
  });

  final String digit;
  final bool isActive;
  final bool isFilled;
  final bool hasError;
  final bool isDark;
  final AppThemeColors colors;
  final int index;

  @override
  Widget build(BuildContext context) {
    final Color borderColor;
    final double borderWidth;

    if (hasError && isFilled) {
      borderColor = const Color(0xFFEF4444);
      borderWidth = 1.5;
    } else if (isActive) {
      borderColor = _kPrimary;
      borderWidth = 2.0;
    } else if (isFilled) {
      borderColor = isDark
          ? Colors.white.withValues(alpha: 0.20)
          : Colors.black.withValues(alpha: 0.12);
      borderWidth = 1.0;
    } else {
      borderColor = isDark
          ? Colors.white.withValues(alpha: 0.10)
          : Colors.black.withValues(alpha: 0.08);
      borderWidth = 1.0;
    }

    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOut,
      margin: const EdgeInsets.symmetric(horizontal: 4),
      width: 46,
      height: 56,
      decoration: BoxDecoration(
        color: isDark ? _kDarkInput : _kLightInput,
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: borderColor, width: borderWidth),
        boxShadow: isActive
            ? [
                BoxShadow(
                  color: _kPrimary.withValues(alpha: 0.20),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ]
            : null,
      ),
      child: Center(
        child: digit.isNotEmpty
            ? AnimatedDefaultTextStyle(
                duration: const Duration(milliseconds: 150),
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: hasError
                      ? const Color(0xFFEF4444)
                      : colors.textPrimary,
                  height: 1,
                ),
                child: Text(digit),
              )
            : isActive
                ? _Cursor(isDark: isDark)
                : const SizedBox.shrink(),
      ),
    );
  }
}

// Blinking cursor for the active empty box
class _Cursor extends StatefulWidget {
  const _Cursor({required this.isDark});
  final bool isDark;

  @override
  State<_Cursor> createState() => _CursorState();
}

class _CursorState extends State<_Cursor> with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 550),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _ctrl,
      child: Container(
        width: 2,
        height: 24,
        decoration: BoxDecoration(
          color: _kPrimary,
          borderRadius: BorderRadius.circular(1),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated envelope icon
// ─────────────────────────────────────────────────────────────────────────────

class _AnimatedEnvelope extends StatefulWidget {
  const _AnimatedEnvelope({required this.isDark});
  final bool isDark;

  @override
  State<_AnimatedEnvelope> createState() => _AnimatedEnvelopeState();
}

class _AnimatedEnvelopeState extends State<_AnimatedEnvelope>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _scaleAnim;
  late Animation<double> _rotAnim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2500),
    )..repeat(reverse: true);
    _scaleAnim = Tween<double>(begin: 1.0, end: 1.06).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
    );
    _rotAnim = Tween<double>(begin: -0.03, end: 0.03).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) => Transform.scale(
        scale: _scaleAnim.value,
        child: Transform.rotate(
          angle: _rotAnim.value,
          child: Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  _kPrimaryLight.withValues(alpha: 0.18),
                  _kPrimary.withValues(alpha: 0.10),
                ],
              ),
              shape: BoxShape.circle,
              border: Border.all(
                color: _kPrimary.withValues(alpha: 0.25),
                width: 1,
              ),
            ),
            child: const Icon(
              Icons.mark_email_read_rounded,
              color: _kPrimary,
              size: 32,
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Error banner
// ─────────────────────────────────────────────────────────────────────────────

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message, required this.colors});
  final String message;
  final AppThemeColors colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: colors.error.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colors.error.withValues(alpha: 0.22)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(5),
            decoration: BoxDecoration(
              color: colors.error.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.error_outline_rounded,
                color: colors.error, size: 14),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                color: colors.error,
                fontSize: 13,
                fontWeight: FontWeight.w500,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared: glass button + ambient background (same as login_screen.dart)
// ─────────────────────────────────────────────────────────────────────────────

class _GlassBtn extends StatelessWidget {
  const _GlassBtn(
      {required this.onTap, required this.isDark, required this.child});
  final VoidCallback onTap;
  final bool isDark;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        padding: const EdgeInsets.all(9),
        decoration: BoxDecoration(
          color: isDark
              ? Colors.white.withValues(alpha: 0.07)
              : Colors.black.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(11),
          border: Border.all(
            color: isDark
                ? Colors.white.withValues(alpha: 0.09)
                : Colors.black.withValues(alpha: 0.07),
          ),
        ),
        child: child,
      ),
    );
  }
}

class _AmbientBackground extends StatelessWidget {
  const _AmbientBackground({required this.isDark});
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return SizedBox.expand(
      child: CustomPaint(
        painter: _BlobPainter(isDark: isDark, size: MediaQuery.of(context).size),
      ),
    );
  }
}

class _BlobPainter extends CustomPainter {
  const _BlobPainter({required this.isDark, required this.size});
  final bool isDark;
  final Size size;

  @override
  void paint(Canvas canvas, Size s) {
    final base = isDark ? _kDarkBg : _kLightBg;
    canvas.drawRect(Rect.fromLTWH(0, 0, s.width, s.height), Paint()..color = base);

    // Top-right blob
    canvas.drawCircle(
      Offset(s.width * 0.88, s.height * 0.07),
      s.width * 0.52,
      Paint()
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 90)
        ..color = _kPrimary.withValues(alpha: isDark ? 0.14 : 0.06),
    );
    // Bottom-left blob
    canvas.drawCircle(
      Offset(s.width * 0.10, s.height * 0.84),
      s.width * 0.58,
      Paint()
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 110)
        ..color = const Color(0xFF1A56DB).withValues(alpha: isDark ? 0.09 : 0.04),
    );
  }

  @override
  bool shouldRepaint(covariant _BlobPainter old) =>
      old.isDark != isDark || old.size != size;
}
