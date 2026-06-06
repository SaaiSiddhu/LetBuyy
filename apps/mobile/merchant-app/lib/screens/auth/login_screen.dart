// lib/screens/auth/login_screen.dart
// LOGIN SCREEN - LetBuyy identity session auth
// Premium glassmorphism design with smooth animations

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

import '../../services/store_auth_service.dart';
import '../../services/store_service.dart';
import '../../services/language_service.dart';
import '../../services/theme_provider.dart';
import '../../theme/app_theme_colors.dart';
import '../../config/app_config.dart';
import '../../app/routes.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with TickerProviderStateMixin {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _emailFocus = FocusNode();
  final _passwordFocus = FocusNode();
  final _confirmPasswordFocus = FocusNode();
  final _formKey = GlobalKey<FormState>();

  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _isLoading = false;
  bool _emailFocused = false;
  bool _passwordFocused = false;
  bool _confirmPasswordFocused = false;
  String? _errorMessage;

  /// Whether we're in sign-up mode (show confirm password).
  bool _isSignUpMode = false;

  // Animation controllers
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  // Auth state subscription
  StreamSubscription<AuthState>? _authSub;

  @override
  void initState() {
    super.initState();
    _emailFocus.addListener(
      () => setState(() => _emailFocused = _emailFocus.hasFocus),
    );
    _passwordFocus.addListener(
      () => setState(() => _passwordFocused = _passwordFocus.hasFocus),
    );
    _confirmPasswordFocus.addListener(
      () => setState(
        () => _confirmPasswordFocused = _confirmPasswordFocus.hasFocus,
      ),
    );
    _loadSavedEmail();
    _initAnimations();
    _listenAuthState();
  }

  /// Listen for identity session changes.
  void _listenAuthState() {
    final authService = context.read<StoreAuthService>();
    _authSub = authService.authStateChanges.listen((state) {
      if (state.event == AuthChangeEvent.signedIn && mounted) {
        _navigateAfterAuth();
      }
    });
  }

  void _initAnimations() {
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.08).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _authSub?.cancel();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _emailFocus.dispose();
    _passwordFocus.dispose();
    _confirmPasswordFocus.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  Future<void> _loadSavedEmail() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedEmail = prefs.getString('store_user_email');
      if (savedEmail != null) _emailController.text = savedEmail;
    } catch (e) {
      debugPrint('Error loading saved email: $e');
    }
  }

  // ── Auth handlers ────────────────────────────────────────

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    final email = _emailController.text.trim();
    final password = _passwordController.text;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final authService = context.read<StoreAuthService>();
      final turnstileToken = await _resolveTurnstileToken();
      if (turnstileToken == null) {
        throw Exception('Please complete the security check to continue.');
      }

      if (_isSignUpMode) {
        await authService.requestSignUpOtp(
          email,
          turnstileToken: turnstileToken,
        );

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('store_user_email', email);

        if (!mounted) return;
        Navigator.pushNamed(
          context,
          AppRoutes.otp,
          arguments: {'email': email, 'password': password},
        );
      } else {
        // Sign in
        try {
          final user = await authService.signInWithPassword(
            email,
            password,
            turnstileToken: turnstileToken,
          );
          if (user == null) throw Exception('Sign-in failed');

          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('store_user_email', email);

          if (!mounted) return;
          await _navigateAfterAuth();
        } catch (e) {
          final msg = e.toString().toLowerCase();
          // If user not found, switch to sign-up mode
          if (msg.contains('invalid login') ||
              msg.contains('user not found') ||
              msg.contains('invalid_credentials')) {
            if (!_isSignUpMode) {
              setState(() {
                _isSignUpMode = true;
                _isLoading = false;
                _errorMessage = null;
              });
              Future.delayed(
                const Duration(milliseconds: 300),
                () => _confirmPasswordFocus.requestFocus(),
              );
              return;
            }
          }
          rethrow;
        }
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception: ', '');
      });
      HapticFeedback.heavyImpact();
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<String?> _resolveTurnstileToken() async {
    final configured = AppConfig.turnstileToken.trim();
    if (configured.isNotEmpty && !configured.startsWith('SKIP_NEEDS_HUMAN_')) {
      return configured;
    }
    return Navigator.pushNamed<String>(context, AppRoutes.turnstileChallenge);
  }

  Future<void> _navigateAfterAuth() async {
    final storeService = context.read<StoreService>();

    try {
      final store = await storeService.getFirstStore();
      if (!mounted) return;

      if (store != null) {
        Navigator.pushReplacementNamed(context, AppRoutes.main);
      } else {
        Navigator.pushReplacementNamed(context, AppRoutes.wizard);
      }
    } catch (e) {
      if (!mounted) return;
      Navigator.pushReplacementNamed(context, AppRoutes.wizard);
    }
  }

  // ── Build ────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();
    final langService = context.watch<LanguageService>();
    final isDark = themeProvider.isDarkMode(context);
    final size = MediaQuery.of(context).size;
    final isKeyboardOpen = MediaQuery.of(context).viewInsets.bottom > 0;

    SystemChrome.setSystemUIOverlayStyle(
      SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: isDark ? Brightness.light : Brightness.dark,
      ),
    );

    final colors = AppThemeColors.of(context);

    return Scaffold(
      backgroundColor: colors.bgStart,
      resizeToAvoidBottomInset: true,
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: Column(
            children: [
              _buildTopBar(themeProvider, langService, isDark),
              Expanded(
                child: SingleChildScrollView(
                  padding: EdgeInsets.symmetric(
                    horizontal: size.width > 600 ? 60 : 24,
                  ),
                  physics: const BouncingScrollPhysics(),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      if (!isKeyboardOpen) ...[
                        const SizedBox(height: 20),
                        _buildLogo(isDark),
                        const SizedBox(height: 24),
                        _buildHeader(langService, isDark),
                        const SizedBox(height: 32),
                      ] else ...[
                        const SizedBox(height: 12),
                      ],
                      _buildAuthCard(isDark, langService),
                      const SizedBox(height: 32),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTopBar(
    ThemeProvider themeProvider,
    LanguageService langService,
    bool isDark,
  ) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          if (_isSignUpMode)
            _buildGlassButton(
              onTap: () => setState(() {
                _isSignUpMode = false;
                _confirmPasswordController.clear();
              }),
              child: Icon(
                Icons.arrow_back_ios_new_rounded,
                size: 18,
                color: isDark ? Colors.white70 : Colors.black87,
              ),
              isDark: isDark,
            )
          else
            _buildLanguageSelector(langService, isDark),
          _buildThemeToggle(themeProvider, isDark),
        ],
      ),
    );
  }

  Widget _buildGlassButton({
    required VoidCallback onTap,
    required Widget child,
    required bool isDark,
  }) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: isDark
              ? Colors.white.withValues(alpha: 0.08)
              : Colors.white.withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isDark
                ? Colors.white.withValues(alpha: 0.1)
                : Colors.black.withValues(alpha: 0.05),
          ),
        ),
        child: child,
      ),
    );
  }

  Widget _buildLanguageSelector(LanguageService langService, bool isDark) {
    return PopupMenuButton<AppLanguage>(
      initialValue: langService.currentLanguage,
      onSelected: (lang) => langService.setLanguage(lang),
      offset: const Offset(0, 42),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      color: isDark ? const Color(0xFF1E1E2E) : Colors.white,
      elevation: 6,
      itemBuilder: (context) => [
        _buildLanguageItem(
          AppLanguage.english,
          'English',
          '🇬🇧',
          langService,
          isDark,
        ),
        _buildLanguageItem(
          AppLanguage.tamil,
          'தமிழ்',
          '🇮🇳',
          langService,
          isDark,
        ),
        _buildLanguageItem(
          AppLanguage.hindi,
          'हिंदी',
          '🇮🇳',
          langService,
          isDark,
        ),
      ],
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: isDark
              ? Colors.white.withValues(alpha: 0.08)
              : Colors.white.withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isDark
                ? Colors.white.withValues(alpha: 0.1)
                : Colors.black.withValues(alpha: 0.05),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.public_rounded,
              size: 16,
              color: isDark ? Colors.white70 : Colors.black87,
            ),
            const SizedBox(width: 6),
            Text(
              langService.languageName,
              style: TextStyle(
                color: isDark ? Colors.white : Colors.black87,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(width: 4),
            Icon(
              Icons.expand_more_rounded,
              size: 16,
              color: isDark ? Colors.white54 : Colors.black54,
            ),
          ],
        ),
      ),
    );
  }

  PopupMenuItem<AppLanguage> _buildLanguageItem(
    AppLanguage lang,
    String name,
    String flag,
    LanguageService langService,
    bool isDark,
  ) {
    final isSelected = langService.currentLanguage == lang;
    return PopupMenuItem(
      value: lang,
      height: 40,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(flag, style: const TextStyle(fontSize: 16)),
          const SizedBox(width: 10),
          Text(
            name,
            style: TextStyle(
              color: isDark ? Colors.white : Colors.black87,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
              fontSize: 13,
            ),
          ),
          if (isSelected) ...[
            const SizedBox(width: 12),
            const Icon(Icons.check_rounded, size: 16, color: AppColors.primary),
          ],
        ],
      ),
    );
  }

  Widget _buildThemeToggle(ThemeProvider themeProvider, bool isDark) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        themeProvider.toggleTheme();
      },
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: isDark
              ? Colors.white.withValues(alpha: 0.08)
              : Colors.white.withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isDark
                ? Colors.white.withValues(alpha: 0.1)
                : Colors.black.withValues(alpha: 0.05),
          ),
        ),
        child: Icon(
          isDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
          size: 18,
          color: isDark ? const Color(0xFFFBBF24) : AppColors.primary,
        ),
      ),
    );
  }

  Widget _buildLogo(bool isDark) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: Image.asset(
        'assets/icons/app_icon.png',
        width: 72,
        height: 72,
        fit: BoxFit.contain,
      ),
    );
  }

  Widget _buildHeader(LanguageService lang, bool isDark) {
    final title = _isSignUpMode ? lang.signUp : lang.getStarted;
    final subtitle = lang.signInOrCreateStore;

    return Column(
      children: [
        ShaderMask(
          shaderCallback: (bounds) => LinearGradient(
            colors: isDark
                ? [Colors.white, Colors.white70]
                : [const Color(0xFF1E293B), const Color(0xFF475569)],
          ).createShader(bounds),
          child: Text(
            title,
            style: const TextStyle(
              fontSize: 34,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: -1,
              height: 1.1,
            ),
            textAlign: TextAlign.center,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          subtitle,
          style: TextStyle(
            fontSize: 16,
            color: isDark ? Colors.white60 : const Color(0xFF64748B),
            height: 1.4,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildAuthCard(bool isDark, LanguageService lang) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 420),
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.05)
            : Colors.white.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.08)
              : Colors.black.withValues(alpha: 0.06),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.08),
            blurRadius: 40,
            offset: const Offset(0, 20),
          ),
          if (!isDark)
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.05),
              blurRadius: 60,
              spreadRadius: -10,
            ),
        ],
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_errorMessage != null) _buildErrorBanner(),
            _buildInputField(
              controller: _emailController,
              focusNode: _emailFocus,
              hint: lang.emailAddress,
              icon: Icons.mail_outline_rounded,
              keyboardType: TextInputType.emailAddress,
              isFocused: _emailFocused,
              isDark: isDark,
              validator: (v) {
                if (v == null || v.isEmpty) return lang.emailRequired;
                if (!v.contains('@') || !v.contains('.'))
                  return lang.validEmail;
                return null;
              },
            ),
            const SizedBox(height: 18),
            _buildInputField(
              controller: _passwordController,
              focusNode: _passwordFocus,
              hint: lang.password,
              icon: Icons.lock_outline_rounded,
              obscureText: _obscurePassword,
              isFocused: _passwordFocused,
              isDark: isDark,
              suffixIcon: _buildVisibilityToggle(
                _obscurePassword,
                () => setState(() => _obscurePassword = !_obscurePassword),
                isDark,
              ),
              validator: (v) {
                if (v == null || v.isEmpty) return lang.passwordRequired;
                if (_isSignUpMode) {
                  if (v.length < 8) return lang.passwordMinLength;
                  if (!RegExp(r'[a-zA-Z]').hasMatch(v))
                    return lang.passwordNeedsLetter;
                  if (!RegExp(r'[0-9]').hasMatch(v))
                    return lang.passwordNeedsNumber;
                }
                return null;
              },
              onSubmitted: _isSignUpMode ? null : (_) => _handleSubmit(),
            ),
            if (_isSignUpMode) ...[
              const SizedBox(height: 18),
              _buildInputField(
                controller: _confirmPasswordController,
                focusNode: _confirmPasswordFocus,
                hint: lang.confirmPassword,
                icon: Icons.lock_outline_rounded,
                obscureText: _obscureConfirmPassword,
                isFocused: _confirmPasswordFocused,
                isDark: isDark,
                suffixIcon: _buildVisibilityToggle(
                  _obscureConfirmPassword,
                  () => setState(
                    () => _obscureConfirmPassword = !_obscureConfirmPassword,
                  ),
                  isDark,
                ),
                validator: (v) {
                  if (v == null || v.isEmpty)
                    return lang.confirmPasswordRequired;
                  if (v != _passwordController.text)
                    return lang.passwordsDoNotMatch;
                  return null;
                },
                onSubmitted: (_) => _handleSubmit(),
              ),
            ],
            const SizedBox(height: 28),
            _buildSubmitButton(isDark, lang),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorBanner() {
    return Container(
      padding: const EdgeInsets.all(14),
      margin: const EdgeInsets.only(bottom: 24),
      decoration: BoxDecoration(
        color: const Color(0xFFEF4444).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: const Color(0xFFEF4444).withValues(alpha: 0.25),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: const Color(0xFFEF4444).withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.error_outline_rounded,
              color: Color(0xFFEF4444),
              size: 16,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              _errorMessage!,
              style: const TextStyle(
                color: Color(0xFFEF4444),
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInputField({
    required TextEditingController controller,
    required FocusNode focusNode,
    required String hint,
    required IconData icon,
    required bool isFocused,
    required bool isDark,
    TextInputType keyboardType = TextInputType.text,
    bool obscureText = false,
    bool readOnly = false,
    Widget? suffixIcon,
    String? Function(String?)? validator,
    void Function(String)? onSubmitted,
    void Function(String)? onChanged,
  }) {
    return TextFormField(
      controller: controller,
      focusNode: focusNode,
      keyboardType: keyboardType,
      obscureText: obscureText,
      readOnly: readOnly,
      style: TextStyle(
        fontSize: 14,
        color: readOnly
            ? (isDark ? Colors.white38 : Colors.black38)
            : (isDark ? Colors.white : Colors.black87),
        fontWeight: FontWeight.w500,
      ),
      validator: validator,
      onFieldSubmitted: onSubmitted,
      onChanged: onChanged,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(
          color: isDark ? Colors.white30 : const Color(0xFF94A3B8),
          fontWeight: FontWeight.w400,
          fontSize: 14,
        ),
        prefixIcon: Container(
          padding: const EdgeInsets.only(left: 14, right: 10),
          child: Icon(
            icon,
            color: isFocused
                ? AppColors.primary
                : (isDark ? Colors.white30 : const Color(0xFF94A3B8)),
            size: 18,
          ),
        ),
        prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
        suffixIcon: suffixIcon,
        filled: true,
        fillColor: isDark
            ? Colors.white.withValues(alpha: 0.05)
            : const Color(0xFFF8FAFC),
        contentPadding: const EdgeInsets.symmetric(horizontal: 0, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: isDark
                ? Colors.white.withValues(alpha: 0.1)
                : const Color(0xFFE2E8F0),
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: isDark
                ? Colors.white.withValues(alpha: 0.08)
                : const Color(0xFFE2E8F0),
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFEF4444)),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFEF4444), width: 1.5),
        ),
        errorStyle: const TextStyle(color: Color(0xFFEF4444), fontSize: 11),
      ),
    );
  }

  Widget _buildVisibilityToggle(
    bool isHidden,
    VoidCallback onTap,
    bool isDark,
  ) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        onTap();
      },
      child: Padding(
        padding: const EdgeInsets.only(right: 16),
        child: Icon(
          isHidden ? Icons.visibility_off_outlined : Icons.visibility_outlined,
          color: isDark ? Colors.white38 : const Color(0xFF94A3B8),
          size: 20,
        ),
      ),
    );
  }

  Widget _buildSubmitButton(bool isDark, LanguageService lang) {
    final buttonText = _isSignUpMode ? lang.signUp : lang.continueBtn;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: _isLoading ? null : _handleSubmit,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          height: 48,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [AppColors.primaryHover, AppColors.primary],
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.primaryHover.withValues(alpha: 0.3),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Center(
            child: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 2,
                    ),
                  )
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        buttonText,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Icon(
                        Icons.arrow_forward_rounded,
                        color: Colors.white,
                        size: 18,
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}
