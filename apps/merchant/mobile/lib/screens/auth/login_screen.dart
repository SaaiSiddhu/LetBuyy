// lib/screens/auth/login_screen.dart
// LOGIN SCREEN — LetBuyy v2 redesign
// No card wrapper · Landscape logo · Inline Turnstile · Social OAuth buttons

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:provider/provider.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../app/store_context.dart';
import '../../services/store_auth_service.dart';
import '../../services/staff_service.dart';
import '../../services/language_service.dart';
import '../../services/theme_provider.dart';
import '../../theme/app_theme_colors.dart';
import '../../config/app_config.dart';
import '../../app/routes.dart';
import '../../widgets/shared/merchant_turnstile_attempt.dart';
import 'error_screen.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Brand colours (kept local so the file is self-contained)
// ─────────────────────────────────────────────────────────────────────────────
const _kPrimary = Color(0xFF6C47FF);
const _kPrimaryLight = Color(0xFF8B6AFF);
const _kPrimaryDark = Color(0xFF4C2EBD);

// ─────────────────────────────────────────────────────────────────────────────

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, this.sessionNotice});
  final String? sessionNotice;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with TickerProviderStateMixin {
  // Controllers
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _mfaController = TextEditingController();
  final _mfaFocus = FocusNode();
  bool _mfaRequired = false;
  String? _mfaEmail;
  final _confirmPasswordController = TextEditingController();
  final _emailFocus = FocusNode();
  final _passwordFocus = FocusNode();
  final _confirmPasswordFocus = FocusNode();
  final _formKey = GlobalKey<FormState>();

  // UI state
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _isLoading = false;
  bool _emailFocused = false;
  bool _passwordFocused = false;
  bool _confirmPasswordFocused = false;
  String? _errorMessage;
  String? _sessionNotice;
  bool _isSignUpMode = false;

  // Inline Turnstile
  WebViewController? _turnstileController;
  final _turnstileAttempt = MerchantTurnstileAttempt();
  String? get _turnstileToken => _turnstileAttempt.token;
  bool get _turnstileWidgetReady => _turnstileAttempt.ready;
  bool get _turnstileError => _turnstileAttempt.error;
  bool get _turnstileExpired => _turnstileAttempt.expired;

  // Auth subscription
  StreamSubscription<AuthState>? _authSub;

  // Entry animation
  late AnimationController _entryController;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

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

    _emailController.addListener(() {
      if (_mfaRequired &&
          _mfaEmail != _emailController.text.trim().toLowerCase() &&
          mounted)
        setState(() {
          _mfaRequired = false;
          _mfaController.clear();
          _mfaEmail = null;
        });
    });
    _loadSavedEmail();
    _sessionNotice = widget.sessionNotice;

    _entryController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _fadeAnim = CurvedAnimation(
      parent: _entryController,
      curve: Curves.easeOut,
    );
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.04),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _entryController, curve: Curves.easeOut));

    _entryController.forward();
    _listenAuthState();
  }

  void _listenAuthState() {
    final authService = context.read<StoreAuthService>();
    _authSub = authService.authStateChanges.listen((state) {
      if (state.event == AuthChangeEvent.signedIn && mounted) {
        _navigateAfterAuth();
      }
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Build the inline Turnstile once the theme is available.
    if (_turnstileController == null && !_turnstileError) {
      _initTurnstile();
    }
  }

  void _restartTurnstile() {
    if (!mounted) return;
    setState(_initTurnstile);
  }

  void _initTurnstile() {
    if (!AppConfig.hasTurnstileSiteKey) return;
    final generation = _turnstileAttempt.begin(),
        isDark = AppThemeColors.of(context).isDark;
    bool active() => mounted && _turnstileAttempt.current(generation);
    void failed() {
      if (active()) setState(() => _turnstileAttempt.fail(generation));
    }

    _turnstileController = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.transparent)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) {
            if (active())
              setState(() => _turnstileAttempt.pageReady(generation));
          },
          onWebResourceError: (error) {
            if (active() && error.isForMainFrame != false)
              setState(
                () => _turnstileAttempt.resourceFailure(
                  generation,
                  isForMainFrame: error.isForMainFrame,
                ),
              );
          },
        ),
      )
      ..addJavaScriptChannel(
        'TurnstileToken',
        onMessageReceived: (message) {
          if (active())
            setState(
              () => _turnstileAttempt.succeed(generation, message.message),
            );
        },
      )
      ..addJavaScriptChannel(
        'TurnstileError',
        onMessageReceived: (_) => failed(),
      )
      ..addJavaScriptChannel(
        'TurnstileExpired',
        onMessageReceived: (_) {
          if (active()) setState(() => _turnstileAttempt.expire(generation));
        },
      );
    unawaited(
      _turnstileController!
          .loadHtmlString(
            merchantTurnstileDocument(
              AppConfig.turnstileSiteKey,
              isDark: isDark,
            ),
            baseUrl: AppConfig.identityBaseUrl,
          )
          .catchError((Object _) => failed()),
    );
  }

  @override
  void dispose() {
    _turnstileAttempt.invalidate();
    _authSub?.cancel();
    _emailController.dispose();
    _passwordController.dispose();
    _mfaController.clear();
    _mfaController.dispose();
    _mfaFocus.dispose();
    _confirmPasswordController.dispose();
    _emailFocus.dispose();
    _passwordFocus.dispose();
    _confirmPasswordFocus.dispose();
    _entryController.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant LoginScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.sessionNotice != widget.sessionNotice) {
      _sessionNotice = widget.sessionNotice;
    }
  }

  // ── Data ──────────────────────────────────────────────────

  Future<void> _loadSavedEmail() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getString('store_user_email');
      if (saved != null && mounted) _emailController.text = saved;
    } catch (_) {}
  }

  // ── Auth ──────────────────────────────────────────────────

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    final email = _emailController.text.trim();
    final password = _passwordController.text;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _sessionNotice = null;
    });

    try {
      final authService = context.read<StoreAuthService>();
      final token = await _resolveTurnstileToken();
      if (token == null) {
        throw Exception('Please complete the security check to continue.');
      }

      if (_isSignUpMode) {
        await authService.requestSignUpOtp(email, turnstileToken: token);
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('store_user_email', email);
        if (!mounted) return;
        Navigator.pushNamed(
          context,
          AppRoutes.otp,
          arguments: {'email': email, 'password': password},
        );
      } else {
        try {
          final user = await authService.signInWithPassword(
            email,
            password,
            turnstileToken: token,
            mfaCode: _mfaRequired ? _mfaController.text.trim() : null,
          );
          if (user == null) throw Exception('Sign-in failed');
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('store_user_email', email);
          if (!mounted) return;
          await _navigateAfterAuth();
        } catch (e) {
          final msg = e.toString().toLowerCase();
          if (msg.contains('invalid login') ||
              msg.contains('user not found') ||
              msg.contains('invalid_credentials')) {
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
          rethrow;
        }
      }
    } on MerchantMfaRequiredException {
      if (!mounted) return;
      setState(() {
        _mfaRequired = true;
        _mfaEmail = email.toLowerCase();
        _mfaController.clear();
        _errorMessage = 'Enter your current authenticator code to sign in.';
        _turnstileAttempt.invalidate();
      });
      // The first password attempt consumed its bot challenge. Recreate the
      // existing widget so the MFA retry carries a fresh proof.
      if (AppConfig.hasTurnstileSiteKey) {
        _turnstileController = null;
        _initTurnstile();
      }
      _mfaFocus.requestFocus();
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

  Future<void> _openPasswordReset() async {
    final auth = context.read<StoreAuthService>();
    await showDialog<void>(
      context: context,
      builder: (_) => PasswordResetDialog(
        initialEmail: _emailController.text,
        requestReset: (email) async {
          final proof = await _resolveTurnstileToken();
          if (proof == null)
            throw StateError('Complete the security check and retry.');
          try {
            await auth.resetPassword(email, turnstileToken: proof);
          } finally {
            if (mounted)
              setState(() {
                _turnstileAttempt.invalidate();
              });
          }
        },
      ),
    );
  }

  Future<String?> _resolveTurnstileToken() async {
    // 1. Compile-time bypass token (local dev)
    if (AppConfig.hasTurnstileToken) return AppConfig.turnstileToken.trim();
    // 2. Token already solved inline
    final inline = _turnstileAttempt.takeToken();
    if (inline != null) {
      setState(() {});
      return inline;
    }
    // 3. Fallback to dedicated challenge screen
    final token = await Navigator.pushNamed(
      context,
      AppRoutes.turnstileChallenge,
    );
    return token is String && token.trim().isNotEmpty ? token.trim() : null;
  }

  bool _navigatingAfterAuth = false;
  bool _storeAccessNeedsRetry = false;
  Future<void> _navigateAfterAuth() async {
    if (_navigatingAfterAuth || ModalRoute.of(context)?.isCurrent != true)
      return;
    _navigatingAfterAuth = true;
    setState(() => _isLoading = true);
    if (context.read<StaffService>().pendingInvitation != null) {
      Navigator.pushNamedAndRemoveUntil(context, AppRoutes.auth, (_) => false);
      return;
    }
    final auth = context.read<StoreAuthService>(),
        actor = context.read<StoreAuthService>().currentUser?.id;
    try {
      if (actor == null) throw StateError('Sign in again');
      final store = await context
          .read<StoreContext>()
          .ensureSelectedStoreForActor(actor);
      if (!mounted || auth.currentUser?.id != actor) return;
      if (store != null) {
        Navigator.pushReplacementNamed(context, AppRoutes.main);
      } else {
        Navigator.pushReplacementNamed(context, AppRoutes.wizard);
      }
    } catch (_) {
      if (!mounted || auth.currentUser?.id != actor) return;
      setState(() {
        _storeAccessNeedsRetry = true;
        _errorMessage =
            'You are signed in. Store access could not load. Retry loading your store.';
      });
    } finally {
      _navigatingAfterAuth = false;
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // ── Build ─────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final recovering = context.select<StoreAuthService, bool>(
      (auth) => auth.hasSessionRecovery,
    );
    if (recovering) {
      return ErrorScreen(
        title: _isLoading
            ? 'Confirming sign-in...'
            : 'Sign-in temporarily unavailable',
        message:
            _errorMessage ??
            'Your saved sign-in is kept securely. Retry to confirm your account before opening your store.',
        onRetry: _isLoading
            ? null
            : () async {
                setState(() {
                  _isLoading = true;
                  _errorMessage = null;
                });
                try {
                  if (await context.read<StoreAuthService>().refreshSession() &&
                      mounted)
                    await _navigateAfterAuth();
                } catch (_) {
                  if (mounted)
                    setState(
                      () => _errorMessage =
                          'Saved sign-in could not be confirmed. Please retry.',
                    );
                } finally {
                  if (mounted) setState(() => _isLoading = false);
                }
              },
        onBackToLogin: () async {
          await context.read<StoreAuthService>().signOut();
          if (mounted)
            setState(() {
              _isLoading = false;
              _errorMessage = null;
            });
        },
      );
    }
    final themeProvider = context.watch<ThemeProvider>();
    final langService = context.watch<LanguageService>();
    final isDark = themeProvider.isDarkMode(context);
    final colors = AppThemeColors.of(context);
    final size = MediaQuery.of(context).size;
    final isKeyboardOpen = MediaQuery.of(context).viewInsets.bottom > 0;

    SystemChrome.setSystemUIOverlayStyle(
      SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: isDark ? Brightness.light : Brightness.dark,
        systemNavigationBarColor: colors.bgStart,
      ),
    );

    return Scaffold(
      // Exact identity web app --bg color
      backgroundColor: isDark
          ? const Color(0xFF0A0912) // rgb(10,9,18)
          : const Color(0xFFFAF9FF), // rgb(250,249,255)
      resizeToAvoidBottomInset: true,
      body: Stack(
        children: [
          // ── Ambient background blobs ──────────────────────
          _AmbientBackground(isDark: isDark),

          // ── Main content ──────────────────────────────────
          SafeArea(
            child: Column(
              children: [
                _buildTopBar(themeProvider, langService, isDark, colors),
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
                            if (!isKeyboardOpen) ...[
                              const SizedBox(height: 28),
                              _buildLogo(isDark),
                              const SizedBox(height: 32),
                              _buildHeader(langService, isDark, colors),
                              const SizedBox(height: 40),
                            ] else ...[
                              const SizedBox(height: 16),
                            ],

                            // ── Notices ──────────────────────
                            if (_sessionNotice != null) ...[
                              _buildNoticeBanner(
                                _sessionNotice!,
                                colors,
                                icon: Icons.lock_clock_rounded,
                                isAccent: true,
                              ),
                              const SizedBox(height: 20),
                            ],
                            if (_errorMessage != null) ...[
                              _buildNoticeBanner(
                                _errorMessage!,
                                colors,
                                icon: Icons.error_outline_rounded,
                                isError: true,
                              ),
                              if (_storeAccessNeedsRetry)
                                TextButton(
                                  onPressed: _isLoading || _navigatingAfterAuth
                                      ? null
                                      : _navigateAfterAuth,
                                  child: const Text('Retry loading your store'),
                                ),
                              const SizedBox(height: 20),
                            ],

                            // ── Form fields ───────────────────
                            Form(
                              key: _formKey,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  _buildField(
                                    controller: _emailController,
                                    focusNode: _emailFocus,
                                    hint: langService.emailAddress,
                                    icon: Icons.mail_outline_rounded,
                                    keyboardType: TextInputType.emailAddress,
                                    isFocused: _emailFocused,
                                    isDark: isDark,
                                    colors: colors,
                                    validator: (v) {
                                      if (v == null || v.trim().isEmpty)
                                        return langService.emailRequired;
                                      if (!v.contains('@') || !v.contains('.'))
                                        return langService.validEmail;
                                      return null;
                                    },
                                  ),
                                  const SizedBox(height: 14),
                                  _buildField(
                                    controller: _passwordController,
                                    focusNode: _passwordFocus,
                                    hint: langService.password,
                                    icon: Icons.lock_outline_rounded,
                                    obscureText: _obscurePassword,
                                    isFocused: _passwordFocused,
                                    isDark: isDark,
                                    colors: colors,
                                    suffixIcon: _visibilityToggle(
                                      _obscurePassword,
                                      () => setState(
                                        () => _obscurePassword =
                                            !_obscurePassword,
                                      ),
                                      isDark,
                                    ),
                                    validator: (v) {
                                      if (v == null || v.isEmpty)
                                        return langService.passwordRequired;
                                      if (_isSignUpMode) {
                                        if (v.length < 8)
                                          return langService.passwordMinLength;
                                        if (!RegExp(r'[a-zA-Z]').hasMatch(v))
                                          return langService
                                              .passwordNeedsLetter;
                                        if (!RegExp(r'[0-9]').hasMatch(v))
                                          return langService
                                              .passwordNeedsNumber;
                                      }
                                      return null;
                                    },
                                    onSubmitted: _isSignUpMode
                                        ? null
                                        : (_) => _handleSubmit(),
                                  ),
                                  if (_mfaRequired && !_isSignUpMode) ...[
                                    const SizedBox(height: 14),
                                    _buildField(
                                      controller: _mfaController,
                                      focusNode: _mfaFocus,
                                      hint: 'Authenticator code',
                                      icon: Icons.security_outlined,
                                      obscureText: true,
                                      keyboardType: TextInputType.number,
                                      isFocused: false,
                                      isDark: isDark,
                                      colors: colors,
                                      validator: (value) =>
                                          RegExp(
                                            r'^\d{6}$',
                                          ).hasMatch(value ?? '')
                                          ? null
                                          : 'Enter your 6-digit authenticator code.',
                                      onSubmitted: (_) => _handleSubmit(),
                                    ),
                                  ],
                                  if (_isSignUpMode) ...[
                                    const SizedBox(height: 14),
                                    _buildField(
                                      controller: _confirmPasswordController,
                                      focusNode: _confirmPasswordFocus,
                                      hint: langService.confirmPassword,
                                      icon: Icons.lock_outline_rounded,
                                      obscureText: _obscureConfirmPassword,
                                      isFocused: _confirmPasswordFocused,
                                      isDark: isDark,
                                      colors: colors,
                                      suffixIcon: _visibilityToggle(
                                        _obscureConfirmPassword,
                                        () => setState(
                                          () => _obscureConfirmPassword =
                                              !_obscureConfirmPassword,
                                        ),
                                        isDark,
                                      ),
                                      validator: (v) {
                                        if (v == null || v.isEmpty)
                                          return langService
                                              .confirmPasswordRequired;
                                        if (v != _passwordController.text)
                                          return langService
                                              .passwordsDoNotMatch;
                                        return null;
                                      },
                                      onSubmitted: (_) => _handleSubmit(),
                                    ),
                                  ],

                                  // ── Forgot password ────────────
                                  if (!_isSignUpMode) ...[
                                    const SizedBox(height: 10),
                                    Align(
                                      alignment: Alignment.centerRight,
                                      child: GestureDetector(
                                        onTap: () {
                                          HapticFeedback.lightImpact();
                                          _openPasswordReset();
                                        },
                                        child: Text(
                                          'Forgot password?',
                                          style: TextStyle(
                                            color: _kPrimary,
                                            fontSize: 13,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],

                                  const SizedBox(height: 28),

                                  // ── CTA button ─────────────────
                                  _buildSubmitButton(langService, isDark),

                                  // ── Inline Turnstile ───────────
                                  const SizedBox(height: 16),
                                  _buildInlineTurnstile(isDark, colors),
                                ],
                              ),
                            ),

                            const SizedBox(height: 28),

                            // ── Divider ────────────────────────
                            _buildDivider(isDark, colors),

                            const SizedBox(height: 24),

                            // ── Social buttons ─────────────────
                            _buildGoogleButton(isDark, colors),
                            const SizedBox(height: 12),
                            _buildAppleButton(isDark, colors),

                            const SizedBox(height: 36),

                            TextButton(
                              onPressed: () => Navigator.pushNamed(
                                context,
                                AppRoutes.acceptStaffInvitation,
                              ),
                              child: const Text('Have a staff invitation?'),
                            ),
                            // ── Footer ─────────────────────────
                            _buildFooter(langService, isDark, colors),

                            const SizedBox(height: 24),
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
    ThemeProvider themeProvider,
    LanguageService langService,
    bool isDark,
    AppThemeColors colors,
  ) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          if (_isSignUpMode)
            _glassBtn(
              onTap: () => setState(() {
                _isSignUpMode = false;
                _confirmPasswordController.clear();
              }),
              child: Icon(
                Icons.arrow_back_ios_new_rounded,
                size: 16,
                color: isDark ? Colors.white70 : Colors.black87,
              ),
              isDark: isDark,
            )
          else
            _buildLanguageSelector(langService, isDark),
          _glassBtn(
            onTap: () {
              HapticFeedback.lightImpact();
              themeProvider.toggleTheme();
            },
            child: Icon(
              isDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
              size: 16,
              color: isDark ? const Color(0xFFFBBF24) : _kPrimary,
            ),
            isDark: isDark,
          ),
        ],
      ),
    );
  }

  Widget _glassBtn({
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

  Widget _buildLanguageSelector(LanguageService langService, bool isDark) {
    return PopupMenuButton<AppLanguage>(
      initialValue: langService.currentLanguage,
      onSelected: (lang) => langService.setLanguage(lang),
      offset: const Offset(0, 42),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      color: isDark ? const Color(0xFF1A1F35) : Colors.white,
      elevation: 8,
      itemBuilder: (context) => AppLanguage.values
          .map(
            (l) => PopupMenuItem(
              value: l,
              height: 42,
              child: Row(
                children: [
                  Text(
                    langService.languageFlagFor(l),
                    style: const TextStyle(fontSize: 16),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    langService.languageNameFor(l),
                    style: TextStyle(
                      color: isDark ? Colors.white : Colors.black87,
                      fontWeight: langService.currentLanguage == l
                          ? FontWeight.w600
                          : FontWeight.w400,
                      fontSize: 13,
                    ),
                  ),
                  if (langService.currentLanguage == l) ...[
                    const Spacer(),
                    const Icon(Icons.check_rounded, size: 15, color: _kPrimary),
                  ],
                ],
              ),
            ),
          )
          .toList(growable: false),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
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
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.public_rounded,
              size: 14,
              color: isDark ? Colors.white60 : Colors.black54,
            ),
            const SizedBox(width: 5),
            Text(
              langService.languageName,
              style: TextStyle(
                color: isDark ? Colors.white : Colors.black87,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(width: 3),
            Icon(
              Icons.expand_more_rounded,
              size: 14,
              color: isDark ? Colors.white38 : Colors.black38,
            ),
          ],
        ),
      ),
    );
  }

  // ── Logo ──────────────────────────────────────────────────

  Widget _buildLogo(bool isDark) {
    return Center(
      child: SvgPicture.asset(
        isDark
            ? 'assets/images/letbuyy-logo-dark.svg'
            : 'assets/images/letbuyy-logo-light.svg',
        height: 52,
        fit: BoxFit.contain,
      ),
    );
  }

  // ── Header ────────────────────────────────────────────────

  Widget _buildHeader(
    LanguageService lang,
    bool isDark,
    AppThemeColors colors,
  ) {
    return Column(
      children: [
        Text(
          _isSignUpMode ? 'Create account' : 'Welcome back',
          style: TextStyle(
            fontSize: 30,
            fontWeight: FontWeight.w800,
            color: colors.textPrimary,
            letterSpacing: -0.8,
            height: 1.1,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          _isSignUpMode
              ? 'Start selling with LetBuyy'
              : 'Sign in to your merchant account',
          style: TextStyle(
            fontSize: 15,
            color: colors.textSecondary,
            height: 1.4,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  // ── Form field ────────────────────────────────────────────

  Widget _buildField({
    required TextEditingController controller,
    required FocusNode focusNode,
    required String hint,
    required IconData icon,
    required bool isFocused,
    required bool isDark,
    required AppThemeColors colors,
    TextInputType keyboardType = TextInputType.text,
    bool obscureText = false,
    Widget? suffixIcon,
    String? Function(String?)? validator,
    void Function(String)? onSubmitted,
  }) {
    final borderRadius = BorderRadius.circular(14);
    final activeBorderColor = _kPrimary;
    final idleBorderColor = isDark
        ? Colors.white.withValues(alpha: 0.10)
        : Colors.black.withValues(alpha: 0.10);

    return TextFormField(
      controller: controller,
      focusNode: focusNode,
      keyboardType: keyboardType,
      obscureText: obscureText,
      style: TextStyle(
        fontSize: 15,
        color: colors.textPrimary,
        fontWeight: FontWeight.w500,
      ),
      validator: validator,
      onFieldSubmitted: onSubmitted,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(
          color: colors.textHint,
          fontSize: 15,
          fontWeight: FontWeight.w400,
        ),
        prefixIcon: Padding(
          padding: const EdgeInsets.only(left: 16, right: 12),
          child: Icon(
            icon,
            size: 18,
            color: isFocused ? activeBorderColor : colors.textTertiary,
          ),
        ),
        prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
        suffixIcon: suffixIcon,
        // identity web app --input-bg:
        // dark: rgb(13,11,22)  light: rgb(255,255,255)
        filled: true,
        fillColor: isDark
            ? const Color(0xFF0D0B16) // rgb(13,11,22)
            : const Color(0xFFFFFFFF), // rgb(255,255,255)
        contentPadding: const EdgeInsets.symmetric(vertical: 16),
        border: OutlineInputBorder(
          borderRadius: borderRadius,
          borderSide: BorderSide(color: idleBorderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: borderRadius,
          borderSide: BorderSide(color: idleBorderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: borderRadius,
          borderSide: BorderSide(color: activeBorderColor, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: borderRadius,
          borderSide: const BorderSide(color: Color(0xFFEF4444)),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: borderRadius,
          borderSide: const BorderSide(color: Color(0xFFEF4444), width: 1.5),
        ),
        errorStyle: const TextStyle(color: Color(0xFFEF4444), fontSize: 11.5),
      ),
    );
  }

  Widget _visibilityToggle(bool isHidden, VoidCallback onTap, bool isDark) {
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
          size: 19,
        ),
      ),
    );
  }

  // ── CTA button ────────────────────────────────────────────

  Widget _buildSubmitButton(LanguageService lang, bool isDark) {
    final label = _isSignUpMode ? lang.signUp : lang.continueBtn;
    return SizedBox(
      height: 52,
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: _isLoading ? null : _handleSubmit,
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
              boxShadow: [
                BoxShadow(
                  color: _kPrimary.withValues(alpha: 0.35),
                  blurRadius: 20,
                  offset: const Offset(0, 6),
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
                        strokeWidth: 2.2,
                      ),
                    )
                  : Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          label,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.2,
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Icon(
                          Icons.arrow_forward_rounded,
                          color: Colors.white,
                          size: 17,
                        ),
                      ],
                    ),
            ),
          ),
        ),
      ),
    );
  }

  // ── Inline Turnstile ──────────────────────────────────────

  Widget _buildInlineTurnstile(bool isDark, AppThemeColors colors) {
    // No site key configured → silently skip (bypass token will be used)
    if (!AppConfig.hasTurnstileSiteKey) return const SizedBox.shrink();

    // Token already solved → show success chip
    if (_turnstileToken != null) {
      return _TurnstileSuccessChip(isDark: isDark);
    }

    // Error state → subtle inline message
    if (_turnstileError) {
      return _TurnstileErrorChip(
        isDark: isDark,
        colors: colors,
        onRetry: _isLoading ? null : _restartTurnstile,
      );
    }

    // Expired state
    if (_turnstileExpired) {
      return _TurnstileExpiredChip(
        isDark: isDark,
        colors: colors,
        onRetry: _restartTurnstile,
      );
    }

    // Loading / rendering widget
    final controller = _turnstileController;
    return AnimatedOpacity(
      opacity: _turnstileWidgetReady ? 1.0 : 0.0,
      duration: const Duration(milliseconds: 400),
      child: Container(
        height: 72,
        clipBehavior: Clip.hardEdge,
        decoration: BoxDecoration(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(14),
        ),
        child: controller != null
            ? WebViewWidget(controller: controller)
            : const SizedBox.shrink(),
      ),
    );
  }

  // ── Divider ───────────────────────────────────────────────

  Widget _buildDivider(bool isDark, AppThemeColors colors) {
    final lineColor = isDark
        ? Colors.white.withValues(alpha: 0.10)
        : Colors.black.withValues(alpha: 0.08);
    return Row(
      children: [
        Expanded(child: Divider(color: lineColor, thickness: 1)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Text(
            'or continue with',
            style: TextStyle(
              color: colors.textTertiary,
              fontSize: 12,
              fontWeight: FontWeight.w500,
              letterSpacing: 0.2,
            ),
          ),
        ),
        Expanded(child: Divider(color: lineColor, thickness: 1)),
      ],
    );
  }

  // ── Social buttons ────────────────────────────────────────

  Widget _buildGoogleButton(bool isDark, AppThemeColors colors) {
    return _SocialButton(
      isDark: isDark,
      colors: colors,
      disabled: true,
      onTap: () {},
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Image.asset('assets/icons/google.png', width: 20, height: 20),
          const SizedBox(width: 10),
          Text(
            'Google sign-in unavailable',
            style: TextStyle(
              color: colors.textPrimary,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAppleButton(bool isDark, AppThemeColors colors) {
    return _SocialButton(
      isDark: isDark,
      colors: colors,
      disabled: true,
      onTap: () {},
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.apple_rounded,
            size: 22,
            color: isDark
                ? Colors.white.withValues(alpha: 0.35)
                : Colors.black.withValues(alpha: 0.3),
          ),
          const SizedBox(width: 8),
          Text(
            'Continue with Apple',
            style: TextStyle(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.35)
                  : Colors.black.withValues(alpha: 0.3),
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: 10),
          _ComingSoonBadge(),
        ],
      ),
    );
  }

  // ── Footer ────────────────────────────────────────────────

  Widget _buildFooter(
    LanguageService lang,
    bool isDark,
    AppThemeColors colors,
  ) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          _isSignUpMode
              ? 'Already have an account? '
              : "Don't have an account? ",
          style: TextStyle(color: colors.textSecondary, fontSize: 14),
        ),
        GestureDetector(
          onTap: () {
            HapticFeedback.lightImpact();
            setState(() {
              _isSignUpMode = !_isSignUpMode;
              _errorMessage = null;
              if (!_isSignUpMode) _confirmPasswordController.clear();
            });
          },
          child: Text(
            _isSignUpMode ? 'Sign in' : 'Sign up →',
            style: const TextStyle(
              color: _kPrimary,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }

  // ── Notice banners ────────────────────────────────────────

  Widget _buildNoticeBanner(
    String message,
    AppThemeColors colors, {
    required IconData icon,
    bool isError = false,
    bool isAccent = false,
  }) {
    final color = isError ? colors.error : _kPrimary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.20)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(5),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 14),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                color: color,
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
// Supporting widgets
// ─────────────────────────────────────────────────────────────────────────────

/// Radial ambient blobs behind everything
class _AmbientBackground extends StatelessWidget {
  const _AmbientBackground({required this.isDark});
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    return SizedBox.expand(
      child: CustomPaint(
        painter: _BlobPainter(isDark: isDark, size: size),
      ),
    );
  }
}

class _BlobPainter extends CustomPainter {
  _BlobPainter({required this.isDark, required this.size});
  final bool isDark;
  final Size size;

  @override
  void paint(Canvas canvas, Size s) {
    // Exact identity web app CSS variables
    // dark:  --bg: rgb(10 9 18)   light: --bg: rgb(250 249 255)
    final base = isDark
        ? const Color(0xFF0A0912) // rgb(10,9,18)
        : const Color(0xFFFAF9FF); // rgb(250,249,255)
    canvas.drawRect(
      Rect.fromLTWH(0, 0, s.width, s.height),
      Paint()..color = base,
    );

    // Top-left blob
    final p1 = Paint()
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 90)
      ..color = _kPrimary.withValues(alpha: isDark ? 0.16 : 0.07);
    canvas.drawCircle(
      Offset(s.width * 0.10, s.height * 0.07),
      s.width * 0.52,
      p1,
    );

    // Bottom-right blob
    final p2 = Paint()
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 110)
      ..color = const Color(0xFF1A56DB).withValues(alpha: isDark ? 0.10 : 0.05);
    canvas.drawCircle(
      Offset(s.width * 0.90, s.height * 0.84),
      s.width * 0.58,
      p2,
    );
  }

  @override
  bool shouldRepaint(covariant _BlobPainter old) =>
      old.isDark != isDark || old.size != size;
}

/// Social sign-in button shell
class _SocialButton extends StatefulWidget {
  const _SocialButton({
    required this.isDark,
    required this.colors,
    required this.onTap,
    required this.child,
    this.disabled = false,
  });

  final bool isDark;
  final AppThemeColors colors;
  final VoidCallback onTap;
  final Widget child;
  final bool disabled;

  @override
  State<_SocialButton> createState() => _SocialButtonState();
}

class _SocialButtonState extends State<_SocialButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: widget.disabled
          ? null
          : (_) => setState(() => _pressed = true),
      onTapUp: widget.disabled
          ? null
          : (_) {
              setState(() => _pressed = false);
              widget.onTap();
            },
      onTapCancel: widget.disabled
          ? null
          : () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.97 : 1.0,
        duration: const Duration(milliseconds: 120),
        child: Container(
          height: 50,
          decoration: BoxDecoration(
            color: widget.isDark
                ? Colors.white.withValues(alpha: widget.disabled ? 0.03 : 0.06)
                : Colors.black.withValues(alpha: widget.disabled ? 0.02 : 0.04),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: widget.isDark
                  ? Colors.white.withValues(
                      alpha: widget.disabled ? 0.07 : 0.11,
                    )
                  : Colors.black.withValues(
                      alpha: widget.disabled ? 0.05 : 0.09,
                    ),
            ),
          ),
          child: widget.child,
        ),
      ),
    );
  }
}

/// "Coming Soon" amber badge
class _ComingSoonBadge extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFF59E0B),
        borderRadius: BorderRadius.circular(6),
      ),
      child: const Text(
        'COMING SOON',
        style: TextStyle(
          color: Colors.white,
          fontSize: 8.5,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}

/// Shown when Turnstile token has been resolved
class _TurnstileSuccessChip extends StatelessWidget {
  const _TurnstileSuccessChip({required this.isDark});
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF10B981).withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: const Color(0xFF10B981).withValues(alpha: 0.20),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.verified_rounded,
            color: Color(0xFF10B981),
            size: 15,
          ),
          const SizedBox(width: 8),
          Text(
            'Security check passed',
            style: TextStyle(
              color: const Color(0xFF10B981),
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _TurnstileErrorChip extends StatelessWidget {
  const _TurnstileErrorChip({
    required this.isDark,
    required this.colors,
    required this.onRetry,
  });
  final bool isDark;
  final AppThemeColors colors;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: colors.error.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.error.withValues(alpha: 0.20)),
      ),
      child: Row(
        children: [
          Icon(Icons.warning_amber_rounded, color: colors.error, size: 15),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Security check could not be completed. Check your connection and retry.',
              style: TextStyle(
                color: colors.error,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          TextButton(onPressed: onRetry, child: const Text('Retry check')),
        ],
      ),
    );
  }
}

class _TurnstileExpiredChip extends StatelessWidget {
  const _TurnstileExpiredChip({
    required this.isDark,
    required this.colors,
    required this.onRetry,
  });
  final bool isDark;
  final AppThemeColors colors;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: colors.warning.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.warning.withValues(alpha: 0.20)),
      ),
      child: Row(
        children: [
          Icon(Icons.timer_off_rounded, color: colors.warning, size: 15),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Security check expired',
              style: TextStyle(
                color: colors.warning,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          GestureDetector(
            onTap: onRetry,
            child: Text(
              'Retry',
              style: TextStyle(
                color: _kPrimary,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Turnstile HTML (inline widget, compact)
// ─────────────────────────────────────────────────────────────────────────────

/// Uses the canonical Identity reset flow and reports success only after its reply.
class PasswordResetDialog extends StatefulWidget {
  const PasswordResetDialog({
    super.key,
    required this.initialEmail,
    required this.requestReset,
  });
  final String initialEmail;
  final Future<void> Function(String email) requestReset;
  @override
  State<PasswordResetDialog> createState() => _PasswordResetDialogState();
}

class _PasswordResetDialogState extends State<PasswordResetDialog> {
  late final _email = TextEditingController(text: widget.initialEmail);
  final _form = GlobalKey<FormState>();
  bool _busy = false, _sent = false;
  String? _error;
  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy || !_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.requestReset(_email.text.trim());
      if (mounted) setState(() => _sent = true);
    } catch (_) {
      if (mounted)
        setState(
          () => _error =
              'Reset instructions could not be requested. Complete the security check and try again.',
        );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Reset password'),
    content: _sent
        ? const Text(
            'If an account exists, reset instructions have been requested for this email.',
          )
        : Form(
            key: _form,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(labelText: 'Email'),
                  enabled: !_busy,
                  validator: (value) =>
                      RegExp(
                        r'^[^\s@]+@[^\s@]+\.[^\s@]+$',
                      ).hasMatch(value?.trim() ?? '')
                      ? null
                      : 'Enter a valid email',
                  onFieldSubmitted: (_) => _submit(),
                ),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(_error!),
                  ),
              ],
            ),
          ),
    actions: [
      TextButton(
        onPressed: _busy ? null : () => Navigator.pop(context),
        child: Text(_sent ? 'Done' : 'Cancel'),
      ),
      if (!_sent)
        FilledButton(
          onPressed: _busy ? null : _submit,
          child: Text(_busy ? 'Requesting…' : 'Request reset'),
        ),
    ],
  );
}
