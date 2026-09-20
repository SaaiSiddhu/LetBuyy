// lib/screens/auth/signup_screen.dart
// 🔐 ULTRA-RESPONSIVE SELLER OTP SIGNUP SCREEN
// ✨ Matches Admin Login Design Exactly (Pixel-Perfect)
// 📜 Includes Terms & Conditions with Scroll-to-Accept Logic
// 📱 Responsive breakpoints: Mobile < 600, Tablet 600-1024, Desktop > 1024, Large > 1440

import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_animate/flutter_animate.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_core/letbuyy_core.dart';

import '../../app/routes.dart';

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> with TickerProviderStateMixin {
  // Form controllers
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _storeNameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final List<TextEditingController> _otpControllers = List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _otpFocusNodes = List.generate(6, (_) => FocusNode());

  // Focus nodes
  final _nameFocus = FocusNode();
  final _emailFocus = FocusNode();
  final _phoneFocus = FocusNode();
  final _storeNameFocus = FocusNode();
  final _passwordFocus = FocusNode();
  final _confirmPasswordFocus = FocusNode();

  // Animation controllers
  late AnimationController _bgAnimController;
  late AnimationController _pulseController;
  late AnimationController _floatController;
  late AnimationController _shimmerController;

  // State
  bool _isLoading = false;
  bool _otpSent = false;
  bool _termsAccepted = false;
  String? _errorMessage;
  String? _sellerId;
  int _resendCooldown = 0;
  Timer? _resendTimer;

  // ═══════════════════════════════════════════════════════
  // INLINE VALIDATION STATE (NEW)
  // ═══════════════════════════════════════════════════════
  
  // Email validation
  bool _emailAvailable = false;
  bool _emailChecking = false;
  bool _emailOtpSent = false;
  bool _emailVerified = false;
  bool _emailOtpLoading = false;
  final _emailOtpController = TextEditingController();
  int _emailOtpCooldown = 0;
  Timer? _emailOtpTimer;
  
  // Phone validation
  bool _phoneAvailable = false;
  bool _phoneChecking = false;
  bool _phoneChecked = false;
  Timer? _phoneDebounce;
  
  // Store name validation
  bool _storeNameAvailable = false;
  bool _storeNameChecking = false;
  bool _storeNameChecked = false;
  Timer? _storeNameDebounce;

  // Focus states
  bool _nameFocused = false;
  bool _emailFocused = false;
  bool _phoneFocused = false;
  bool _storeNameFocused = false;
  bool _passwordFocused = false;
  bool _confirmPasswordFocused = false;
  
  // Password visibility
  bool _passwordVisible = false;
  bool _confirmPasswordVisible = false;

  static const String _functionsBaseUrl = 'https://us-central1-letbuy-y.cloudfunctions.net';

  // Responsive breakpoints matching Admin
  static const double _mobileBreakpoint = 600;
  static const double _tabletBreakpoint = 1024;
  static const double _desktopBreakpoint = 1440;

  @override
  void initState() {
    super.initState();
    _initFocusListeners();
    _initAnimations();
  }

  void _initFocusListeners() {
    _nameFocus.addListener(() => setState(() => _nameFocused = _nameFocus.hasFocus));
    _emailFocus.addListener(() => setState(() => _emailFocused = _emailFocus.hasFocus));
    _phoneFocus.addListener(() => setState(() => _phoneFocused = _phoneFocus.hasFocus));
    _storeNameFocus.addListener(() => setState(() => _storeNameFocused = _storeNameFocus.hasFocus));
    _passwordFocus.addListener(() => setState(() => _passwordFocused = _passwordFocus.hasFocus));
    _confirmPasswordFocus.addListener(() => setState(() => _confirmPasswordFocused = _confirmPasswordFocus.hasFocus));
  }

  void _initAnimations() {
    _bgAnimController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 25),
    )..repeat();

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2500),
    )..repeat(reverse: true);

    _floatController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4000),
    )..repeat(reverse: true);
    
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3000),
    )..repeat();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _storeNameController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _emailOtpController.dispose();
    for (final c in _otpControllers) {
      c.dispose();
    }
    for (final f in _otpFocusNodes) {
      f.dispose();
    }
    _nameFocus.dispose();
    _emailFocus.dispose();
    _phoneFocus.dispose();
    _storeNameFocus.dispose();
    _passwordFocus.dispose();
    _confirmPasswordFocus.dispose();
    _resendTimer?.cancel();
    _emailOtpTimer?.cancel();
    _phoneDebounce?.cancel();
    _storeNameDebounce?.cancel();
    _bgAnimController.dispose();
    _pulseController.dispose();
    _floatController.dispose();
    _shimmerController.dispose();
    super.dispose();
  }

  void _startResendCooldown() {
    _resendCooldown = 60;
    _resendTimer?.cancel();
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_resendCooldown > 0) {
        setState(() => _resendCooldown--);
      } else {
        timer.cancel();
      }
    });
  }

  // ═══════════════════════════════════════════════════════
  // INLINE VALIDATION API METHODS (NEW)
  // ═══════════════════════════════════════════════════════

  void _startEmailOtpCooldown() {
    _emailOtpCooldown = 60;
    _emailOtpTimer?.cancel();
    _emailOtpTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_emailOtpCooldown > 0) {
        setState(() => _emailOtpCooldown--);
      } else {
        timer.cancel();
      }
    });
  }

  /// Check if email is available for registration
  void _checkEmailAvailability(String email) {
    if (email.isEmpty || !email.contains('@')) {
      setState(() {
        _emailAvailable = false;
        _emailChecking = false;
      });
      return;
    }

    setState(() => _emailChecking = true);

    // Debounce the check
    Future.delayed(const Duration(milliseconds: 500), () async {
      if (_emailController.text.trim() != email) return; // User changed input

      try {
        final response = await http.post(
          Uri.parse('$_functionsBaseUrl/checkEmailAvailability'),
          headers: {'Content-Type': 'application/json'},
          body: json.encode({'email': email}),
        );

        final data = json.decode(response.body);
        if (mounted) {
          setState(() {
            _emailChecking = false;
            _emailAvailable = data['available'] == true;
          });
          
          if (!_emailAvailable) {
            _showSnackbar('Email is already registered', isError: true);
          }
        }
      } catch (e) {
        if (mounted) {
          setState(() => _emailChecking = false);
        }
      }
    });
  }

  /// Send OTP to email for verification
  Future<void> _sendSignupEmailOTP() async {
    final email = _emailController.text.trim();
    final name = _nameController.text.trim();
    if (email.isEmpty || !_emailAvailable) return;

    setState(() => _emailOtpLoading = true);

    try {
      final response = await http.post(
        Uri.parse('$_functionsBaseUrl/sendSignupEmailOTP'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'email': email,
          'name': name.isNotEmpty ? name : null, // Send name if available
        }),
      );

      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        setState(() {
          _emailOtpSent = true;
          _emailOtpLoading = false;
        });
        _startEmailOtpCooldown();
        _showSnackbar('OTP sent to your email!', isError: false);
      } else {
        setState(() => _emailOtpLoading = false);
        _showSnackbar(data['error'] ?? 'Failed to send OTP', isError: true);
      }
    } catch (e) {
      setState(() => _emailOtpLoading = false);
      _showSnackbar('Network error. Please try again.', isError: true);
    }
  }

  /// Verify the email OTP
  Future<void> _verifySignupEmailOTP(String otp) async {
    if (otp.length != 6) return;

    final email = _emailController.text.trim();
    setState(() => _emailOtpLoading = true);

    try {
      final response = await http.post(
        Uri.parse('$_functionsBaseUrl/verifySignupEmailOTP'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'email': email, 'otp': otp}),
      );

      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        setState(() {
          _emailVerified = true;
          _emailOtpLoading = false;
        });
        HapticFeedback.mediumImpact();
        _showSnackbar('Email verified successfully!', isError: false);
      } else {
        setState(() => _emailOtpLoading = false);
        HapticFeedback.heavyImpact();
        _showSnackbar(data['error'] ?? 'Invalid OTP', isError: true);
      }
    } catch (e) {
      setState(() => _emailOtpLoading = false);
      _showSnackbar('Verification failed. Please try again.', isError: true);
    }
  }

  /// Check if phone number is available
  void _checkPhoneAvailability(String phone) {
    _phoneDebounce?.cancel();
    
    if (phone.length < 10) {
      setState(() {
        _phoneAvailable = false;
        _phoneChecked = false;
        _phoneChecking = false;
      });
      return;
    }

    setState(() => _phoneChecking = true);

    _phoneDebounce = Timer(const Duration(milliseconds: 500), () async {
      try {
        final response = await http.post(
          Uri.parse('$_functionsBaseUrl/checkPhoneAvailability'),
          headers: {'Content-Type': 'application/json'},
          body: json.encode({'phone': phone}),
        );

        final data = json.decode(response.body);
        if (mounted) {
          setState(() {
            _phoneChecking = false;
            _phoneChecked = true;
            _phoneAvailable = data['available'] == true;
          });
          
          if (!_phoneAvailable) {
            _showSnackbar('Phone number is already registered', isError: true);
          }
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            _phoneChecking = false;
            _phoneChecked = false;
          });
        }
      }
    });
  }

  /// Check if store name is available
  void _checkStoreNameAvailability(String storeName) {
    _storeNameDebounce?.cancel();
    
    if (storeName.trim().length < 3) {
      setState(() {
        _storeNameAvailable = false;
        _storeNameChecked = false;
        _storeNameChecking = false;
      });
      return;
    }

    setState(() => _storeNameChecking = true);

    _storeNameDebounce = Timer(const Duration(milliseconds: 500), () async {
      try {
        final response = await http.post(
          Uri.parse('$_functionsBaseUrl/checkStoreNameAvailability'),
          headers: {'Content-Type': 'application/json'},
          body: json.encode({'storeName': storeName.trim()}),
        );

        final data = json.decode(response.body);
        if (mounted) {
          setState(() {
            _storeNameChecking = false;
            _storeNameChecked = true;
            _storeNameAvailable = data['available'] == true;
          });
          
          if (!_storeNameAvailable) {
            _showSnackbar('Store name is already taken', isError: true);
          }
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            _storeNameChecking = false;
            _storeNameChecked = false;
          });
        }
      }
    });
  }

  /// Show themed snackbar
  void _showSnackbar(String message, {required bool isError}) {
    if (!mounted) return;
    
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                isError ? Icons.error_outline_rounded : Icons.check_circle_outline_rounded,
                color: Colors.white,
                size: 18,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
        backgroundColor: isError ? AppColors.error : AppColors.success,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        margin: const EdgeInsets.all(16),
        duration: Duration(seconds: isError ? 4 : 3),
      ),
    );
  }

  Future<void> _handleSignup() async {
    // Validate fields
    final name = _nameController.text.trim();
    final email = _emailController.text.trim();
    final phone = _phoneController.text.trim();
    final storeName = _storeNameController.text.trim();

    if (name.isEmpty) {
      _showSnackbar('Please enter your full name', isError: true);
      return;
    }
    if (email.isEmpty || !email.contains('@')) {
      _showSnackbar('Please enter a valid email address', isError: true);
      return;
    }
    
    // ═══════════════════════════════════════════════════════
    // NEW: Require email verification before signup
    // ═══════════════════════════════════════════════════════
    if (!_emailVerified) {
      _showSnackbar('Please verify your email first', isError: true);
      return;
    }
    
    if (phone.length < 10) {
      _showSnackbar('Please enter a valid phone number', isError: true);
      return;
    }
    
    // NEW: Check phone availability
    if (_phoneChecked && !_phoneAvailable) {
      _showSnackbar('This phone number is already registered', isError: true);
      return;
    }
    
    if (storeName.isEmpty) {
      _showSnackbar('Please enter your store name', isError: true);
      return;
    }
    
    // NEW: Check store name availability
    if (_storeNameChecked && !_storeNameAvailable) {
      _showSnackbar('This store name is already taken', isError: true);
      return;
    }
    
    // NEW: Validate password
    final password = _passwordController.text;
    final confirmPassword = _confirmPasswordController.text;
    
    if (password.length < 6) {
      _showSnackbar('Password must be at least 6 characters', isError: true);
      return;
    }
    
    if (password != confirmPassword) {
      _showSnackbar('Passwords do not match', isError: true);
      return;
    }
    
    if (!_termsAccepted) {
      _showSnackbar('You must accept the Terms & Conditions', isError: true);
      _showTermsModal(Theme.of(context)); // Auto-open if not accepted
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await http.post(
        Uri.parse('$_functionsBaseUrl/registerSellerForOTP'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'email': email,
          'name': name,
          'phone': '+91$phone', // Assuming India for now
          'storeName': storeName,
          'password': password,
          'emailVerified': _emailVerified, // Send inline verification status
        }),
      );

      final data = json.decode(response.body);

      if (response.statusCode == 201 && data['success'] == true) {
        final requiresOTP = data['requiresOTP'] ?? true;
        
        if (requiresOTP) {
          // Old flow: email not verified inline, needs OTP
          setState(() {
            _otpSent = true;
            _sellerId = data['sellerId'];
          });
          _startResendCooldown();
          _otpFocusNodes[0].requestFocus();

          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(8)),
                    child: const Icon(Icons.email_rounded, color: Colors.white, size: 18),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(child: Text('Verification code sent to your email', style: TextStyle(fontWeight: FontWeight.w600))),
                ],
              ),
              backgroundColor: AppColors.success,
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              margin: const EdgeInsets.all(16),
            ));
          }
        } else {
          // New flow: email already verified inline, account is ready!
          if (mounted) {
            _showSnackbar('Account created successfully! 🎉', isError: false);
            
            // Navigate to login screen after short delay
            await Future.delayed(const Duration(milliseconds: 1500));
            if (mounted) {
              Navigator.of(context).pushReplacementNamed('/login');
            }
          }
        }
      } else {
        _showError(data['error'] ?? 'Registration failed');
      }
    } catch (e) {
      _showError('Network error. Please try again.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _verifyOTP() async {
    final otp = _otpControllers.map((c) => c.text).join();
    if (otp.length != 6) {
      _showError('Please enter complete 6-digit OTP');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await http.post(
        Uri.parse('$_functionsBaseUrl/verifySellerOTP'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'email': _emailController.text.trim(),
          'otp': otp,
        }),
      );

      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        final customToken = data['customToken'];
        await FirebaseAuth.instance.signInWithCustomToken(customToken);

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(StorageConstants.keyUserType, 'seller');
        await prefs.setString(StorageConstants.keyUserRole, 'seller');

        if (!mounted) return;

        // Navigate to KYC wizard for new sellers
        Navigator.pushNamedAndRemoveUntil(context, AppRoutes.welcome, (route) => false);
      } else {
        _showError(data['error'] ?? 'Invalid OTP');
        for (final c in _otpControllers) {
          c.clear();
        }
        _otpFocusNodes[0].requestFocus();
      }
    } catch (e) {
      _showError('Verification failed. Please try again.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _resendOTP() async {
    if (_resendCooldown > 0) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await http.post(
        Uri.parse('$_functionsBaseUrl/resendSellerOTP'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'email': _emailController.text.trim()}),
      );

      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        _startResendCooldown();
        for (final c in _otpControllers) {
          c.clear();
        }
        _otpFocusNodes[0].requestFocus();

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: const Text('New OTP sent!', style: TextStyle(fontWeight: FontWeight.w600)),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            margin: const EdgeInsets.all(16),
          ));
        }
      } else {
        _showError(data['error'] ?? 'Failed to resend OTP');
      }
    } catch (e) {
      _showError('Network error. Please try again.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showError(String message) {
    setState(() => _errorMessage = message);
    HapticFeedback.heavyImpact();
  }

  void _goBackToForm() {
    setState(() {
      _otpSent = false;
      _errorMessage = null;
    });
    for (final c in _otpControllers) {
      c.clear();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // TERMS & CONDITIONS MODAL
  // ═══════════════════════════════════════════════════════════════
  void _showTermsModal(ThemeData theme) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _TermsAndConditionsModal(
        theme: theme,
        onAccept: () {
          setState(() => _termsAccepted = true);
          Navigator.pop(context);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final size = MediaQuery.of(context).size;

    final screenWidth = size.width;
    final screenHeight = size.height;
    final isLandscape = screenWidth > screenHeight;

    final isMobile = screenWidth < _mobileBreakpoint;
    final isTablet = screenWidth >= _mobileBreakpoint && screenWidth < _tabletBreakpoint;
    final isDesktop = screenWidth >= _tabletBreakpoint && screenWidth < _desktopBreakpoint;
    final isLargeDesktop = screenWidth >= _desktopBreakpoint;
    final isCompactHeight = screenHeight < 700;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF080B12) : const Color(0xFFF0F4F8),
      body: Stack(
        children: [
          _buildAnimatedBackground(isDark),
          if (!isMobile) ..._buildFloatingOrbs(isDark, size),
          if (isDesktop || isLargeDesktop)
            Positioned.fill(
              child: CustomPaint(painter: _GridPatternPainter(isDark: isDark)),
            ),
          SafeArea(
            child: _buildResponsiveLayout(
              context: context,
              isDark: isDark,
              theme: theme,
              isMobile: isMobile,
              isTablet: isTablet,
              isDesktop: isDesktop,
              isLargeDesktop: isLargeDesktop,
              isLandscape: isLandscape,
              isCompactHeight: isCompactHeight,
              screenWidth: screenWidth,
              screenHeight: screenHeight,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildResponsiveLayout({
    required BuildContext context,
    required bool isDark,
    required ThemeData theme,
    required bool isMobile,
    required bool isTablet,
    required bool isDesktop,
    required bool isLargeDesktop,
    required bool isLandscape,
    required bool isCompactHeight,
    required double screenWidth,
    required double screenHeight,
  }) {
    if (isMobile) return _buildMobileLayout(isDark, theme, isLandscape, isCompactHeight);
    if (isTablet) return _buildTabletLayout(isDark, theme, isLandscape, screenWidth);
    return _buildDesktopLayout(isDark, theme, isLargeDesktop, screenWidth);
  }

  // ═══════════════════════════════════════════════════════════════
  // MOBILE LAYOUT
  // ═══════════════════════════════════════════════════════════════
  Widget _buildMobileLayout(bool isDark, ThemeData theme, bool isLandscape, bool isCompactHeight) {
    if (isLandscape) {
      return Row(
        children: [
          Expanded(flex: 4, child: _buildMobileBrandingCompact(isDark)),
          Expanded(
            flex: 6,
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: _buildSignupCard(
                  isDark: isDark,
                  theme: theme,
                  cardWidth: double.infinity,
                  cardPadding: 24,
                  showLogo: false,
                  fontSize: _FontSizes.mobile,
                ),
              ),
            ),
          ),
        ],
      );
    }

    return Stack(
      children: [
        Positioned.fill(child: CustomPaint(painter: _GridPatternPainter(isDark: isDark, opacity: 0.02))),
        SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 24, vertical: isCompactHeight ? 20 : 40),
            child: Column(
              children: [
                SizedBox(height: isCompactHeight ? 20 : 40),
                Column(
                  children: [
                    Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: theme.colorScheme.primary.withValues(alpha: 0.3),
                            blurRadius: 20,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(20),
                        child: Image.asset(
                          'assets/icons/app_icon.png',
                          fit: BoxFit.cover,
                        ),
                      ),
                    ).animate().fadeIn().scale(),
                    const SizedBox(height: 24),
                    Text(
                      'Join\nLetBuyy Sellers',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.w800,
                        color: isDark ? Colors.white : const Color(0xFF111827),
                        height: 1.1,
                        letterSpacing: -1.0,
                        fontFamily: 'Inter',
                      ),
                    ).animate().fadeIn(delay: 100.ms).slideY(begin: 0.1),
                    const SizedBox(height: 12),
                    Text(
                      'Start your journey with us',
                      style: TextStyle(
                        fontSize: 14,
                        color: isDark ? Colors.grey[400] : const Color(0xFF6B7280),
                        fontWeight: FontWeight.w500,
                        letterSpacing: 0.2,
                      ),
                    ).animate().fadeIn(delay: 200.ms),
                  ],
                ),
                SizedBox(height: isCompactHeight ? 30 : 50),
                _buildSignupCard(
                  isDark: isDark,
                  theme: theme,
                  cardWidth: double.infinity,
                  cardPadding: 24,
                  showLogo: false,
                  fontSize: _FontSizes.mobile,
                ),
                const SizedBox(height: 32),
                _buildMobileFooter(isDark),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMobileBrandingCompact(bool isDark) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0F2027), Color(0xFF203A43), Color(0xFF2C5364)],
        ),
      ),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.2),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Image.asset(
                  'assets/icons/app_icon.png',
                  fit: BoxFit.cover,
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'LetBuyy\nSeller',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700, height: 1.1, letterSpacing: -0.5),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMobileFooter(bool isDark) {
    return Column(
      children: [
        Text(
          '© ${DateTime.now().year} LetBuyy Corp',
          style: TextStyle(color: isDark ? Colors.grey[600] : Colors.grey[400], fontSize: 11, fontWeight: FontWeight.w500),
        ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // TABLET LAYOUT
  // ═══════════════════════════════════════════════════════════════
  Widget _buildTabletLayout(bool isDark, ThemeData theme, bool isLandscape, double screenWidth) {
    final cardWidth = isLandscape ? 480.0 : math.min(520.0, screenWidth * 0.85);

    if (isLandscape) {
      return Row(
        children: [
          Expanded(flex: 5, child: _buildBrandingPanel(isDark, isCompact: true)),
          Expanded(
            flex: 5,
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(32),
                child: _buildSignupCard(
                  isDark: isDark,
                  theme: theme,
                  cardWidth: cardWidth,
                  cardPadding: 32,
                  showLogo: false,
                  fontSize: _FontSizes.tablet,
                ),
              ),
            ),
          ),
        ],
      );
    }

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _buildTabletHeader(isDark),
            const SizedBox(height: 32),
            _buildSignupCard(
              isDark: isDark,
              theme: theme,
              cardWidth: cardWidth,
              cardPadding: 36,
              showLogo: false,
              fontSize: _FontSizes.tablet,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTabletHeader(bool isDark) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                boxShadow: [
                  BoxShadow(color: AppColors.primary.withValues(alpha: 0.3), blurRadius: 20, offset: const Offset(0, 8)),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: Image.asset(
                  'assets/icons/app_icon.png',
                  fit: BoxFit.cover,
                ),
              ),
            ),
            const SizedBox(width: 16),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'LetBuyy Seller',
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: isDark ? Colors.white : Colors.grey[900], letterSpacing: -0.5),
                ),
                Text(
                  'Join Our Platform',
                  style: TextStyle(fontSize: 14, color: isDark ? Colors.grey[400] : Colors.grey[600], fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ],
        ).animate().fadeIn().slideY(begin: -0.2),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // DESKTOP LAYOUT
  // ═══════════════════════════════════════════════════════════════
  Widget _buildDesktopLayout(bool isDark, ThemeData theme, bool isLargeDesktop, double screenWidth) {
    final brandingFlex = isLargeDesktop ? 5 : 4;
    final formFlex = isLargeDesktop ? 4 : 5;
    final cardWidth = isLargeDesktop ? 520.0 : 480.0;
    final cardPadding = isLargeDesktop ? 44.0 : 36.0;

    return Row(
      children: [
        Expanded(flex: brandingFlex, child: _buildBrandingPanel(isDark, isCompact: false)),
        Expanded(
          flex: formFlex,
          child: Center(
            child: SingleChildScrollView(
              padding: EdgeInsets.all(isLargeDesktop ? 48 : 32),
              child: _buildSignupCard(
                isDark: isDark,
                theme: theme,
                cardWidth: cardWidth,
                cardPadding: cardPadding,
                showLogo: false,
                fontSize: isLargeDesktop ? _FontSizes.largeDesktop : _FontSizes.desktop,
              ),
            ),
          ),
        ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // BRANDING PANEL
  // ═══════════════════════════════════════════════════════════════
  Widget _buildBrandingPanel(bool isDark, {required bool isCompact}) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0F2027), Color(0xFF203A43), Color(0xFF2C5364)],
        ),
      ),
      child: Stack(
        children: [
          CustomPaint(size: Size.infinite, painter: _GridPatternPainter(isDark: true, opacity: 0.03)),
          AnimatedBuilder(
            animation: _floatController,
            builder: (context, _) {
              return Positioned(
                top: 100 + _floatController.value * 20,
                left: 80,
                child: Container(
                  width: 180,
                  height: 180,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: [BoxShadow(color: Colors.blueAccent.withValues(alpha: 0.15), blurRadius: 120, spreadRadius: 40)],
                  ),
                ),
              );
            },
          ),
          Padding(
            padding: EdgeInsets.all(isCompact ? 40 : 60),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: isCompact ? 72 : 88,
                  height: isCompact ? 72 : 88,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(isCompact ? 20 : 24),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.3),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(isCompact ? 20 : 24),
                    child: Image.asset(
                      'assets/icons/app_icon.png',
                      fit: BoxFit.cover,
                    ),
                  ),
                ).animate().fadeIn(duration: 600.ms).slideX(begin: -0.3),
                SizedBox(height: isCompact ? 36 : 48),
                ShaderMask(
                  shaderCallback: (bounds) => const LinearGradient(colors: [Colors.white, Color(0xFFE0E0E0)]).createShader(bounds),
                  child: Text(
                    'Join\nLetBuyy Sellers',
                    style: TextStyle(
                      fontSize: isCompact ? 38 : 48,
                      fontWeight: FontWeight.w900,
                      height: 1.05,
                      letterSpacing: -1.5,
                      fontFamily: 'Inter',
                      color: Colors.white,
                    ),
                  ),
                ).animate().fadeIn(delay: 200.ms).slideX(begin: -0.2),
                SizedBox(height: isCompact ? 16 : 24),
                Text(
                  'Start your business journey\nwith powerful selling tools',
                  style: TextStyle(
                    fontSize: isCompact ? 15 : 17,
                    color: Colors.white.withValues(alpha: 0.7),
                    height: 1.5,
                    fontWeight: FontWeight.w400,
                  ),
                ).animate().fadeIn(delay: 400.ms),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // SIGNUP CARD
  // ═══════════════════════════════════════════════════════════════
  Widget _buildSignupCard({
    required bool isDark,
    required ThemeData theme,
    required double cardWidth,
    required double cardPadding,
    required bool showLogo,
    required _FontSizes fontSize,
  }) {
    return Container(
      width: cardWidth,
      padding: EdgeInsets.all(cardPadding),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.black.withValues(alpha: 0.05)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 40, offset: const Offset(0, 10))],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (showLogo) ...[
            Center(child: _buildMobileBrandingCompact(isDark)),
            const SizedBox(height: 24),
          ],

          Text(
            _otpSent ? 'Verify Email' : 'Create Account',
            style: TextStyle(
              fontSize: fontSize.title,
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : const Color(0xFF111827),
              letterSpacing: -0.5,
            ),
            textAlign: TextAlign.center,
          ).animate().fadeIn(),

          SizedBox(height: fontSize.spacing * 0.5),

          Text(
            _otpSent 
                ? 'Code sent to ${_emailController.text}' 
                : 'Enter your details to get started',
            style: TextStyle(
              fontSize: fontSize.body,
              color: isDark ? Colors.grey[400] : const Color(0xFF6B7280),
              height: 1.5,
            ),
            textAlign: TextAlign.center,
          ).animate().fadeIn(delay: 100.ms),

          SizedBox(height: fontSize.spacing * 2),

          if (_errorMessage != null) _buildErrorMessage(isDark, fontSize),

          AnimatedSwitcher(
            duration: 400.ms,
            switchInCurve: Curves.easeOutCubic,
            switchOutCurve: Curves.easeInCubic,
            child: _otpSent ? _buildOTPSection(isDark, theme, fontSize) : _buildSignupForm(isDark, theme, fontSize),
          ),

          if (!_otpSent) ...[
            SizedBox(height: fontSize.spacing * 2),
            Center(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text("Already have an account? ", style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600], fontSize: fontSize.caption)),
                  GestureDetector(
                    onTap: () => Navigator.pushReplacementNamed(context, AppRoutes.login),
                    child: Text(
                      "Sign In",
                      style: TextStyle(color: theme.colorScheme.primary, fontSize: fontSize.caption, fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
            ).animate().fadeIn(delay: 200.ms),
          ],
        ],
      ),
    ).animate().fadeIn().slideY(begin: 0.1);
  }

  Widget _buildErrorMessage(bool isDark, _FontSizes fontSize) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      margin: EdgeInsets.only(bottom: fontSize.spacing),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFFECACA)),
      ),
      child: Row(
        children: [
          Icon(Icons.info_outline_rounded, color: const Color(0xFFDC2626), size: fontSize.iconSmall),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              _errorMessage!,
              style: TextStyle(color: const Color(0xFFB91C1C), fontSize: fontSize.caption, fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    ).animate().shake();
  }

  Widget _buildSignupForm(bool isDark, ThemeData theme, _FontSizes fontSize) {
    return Column(
      key: const ValueKey('signup'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ─────────────────────────────────────────
        // FULL NAME FIELD
        // ─────────────────────────────────────────
        _buildTextField(
          controller: _nameController,
          focusNode: _nameFocus,
          isFocused: _nameFocused,
          label: 'Full Name',
          hint: 'John Doe',
          icon: Icons.person_outline_rounded,
          isDark: isDark,
          theme: theme,
          fontSize: fontSize,
          textCapitalization: TextCapitalization.words,
        ),
        SizedBox(height: fontSize.spacing),

        // ─────────────────────────────────────────
        // EMAIL FIELD WITH SEND OTP BUTTON
        // ─────────────────────────────────────────
        _buildEmailFieldWithOTP(isDark, theme, fontSize),
        
        // ─────────────────────────────────────────
        // INLINE EMAIL OTP INPUT (appears after send)
        // ─────────────────────────────────────────
        if (_emailOtpSent && !_emailVerified) ...[
          SizedBox(height: fontSize.spacing * 0.75),
          _buildInlineEmailOtpInput(isDark, theme, fontSize),
        ],
        
        SizedBox(height: fontSize.spacing),

        // ─────────────────────────────────────────
        // PHONE FIELD WITH AVAILABILITY CHECK
        // ─────────────────────────────────────────
        _buildPhoneFieldWithValidation(isDark, theme, fontSize),
        SizedBox(height: fontSize.spacing),

        // ─────────────────────────────────────────
        // STORE NAME FIELD WITH AVAILABILITY CHECK
        // ─────────────────────────────────────────
        _buildStoreNameFieldWithValidation(isDark, theme, fontSize),
        SizedBox(height: fontSize.spacing),

        // ─────────────────────────────────────────
        // PASSWORD FIELD
        // ─────────────────────────────────────────
        _buildPasswordField(isDark, theme, fontSize),
        SizedBox(height: fontSize.spacing),

        // ─────────────────────────────────────────
        // CONFIRM PASSWORD FIELD
        // ─────────────────────────────────────────
        _buildConfirmPasswordField(isDark, theme, fontSize),
        SizedBox(height: fontSize.spacing * 1.5),

        // Terms Checkbox
        GestureDetector(
          onTap: () => _showTermsModal(theme),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              children: [
                SizedBox(
                  width: 24,
                  height: 24,
                  child: Checkbox(
                    value: _termsAccepted,
                    onChanged: (val) {
                      if (val == true && !_termsAccepted) {
                         _showTermsModal(theme); // Force read terms
                      } else {
                        setState(() => _termsAccepted = val ?? false);
                      }
                    },
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                    activeColor: theme.colorScheme.primary,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: RichText(
                    text: TextSpan(
                      style: TextStyle(fontSize: fontSize.caption, color: isDark ? Colors.grey[400] : Colors.grey[600], height: 1.4),
                      children: [
                        const TextSpan(text: 'I agree to the '),
                        TextSpan(
                          text: 'Terms & Conditions',
                          style: TextStyle(color: theme.colorScheme.primary, fontWeight: FontWeight.w600),
                        ),
                        const TextSpan(text: ' and '),
                        TextSpan(
                          text: 'Privacy Policy',
                          style: TextStyle(color: theme.colorScheme.primary, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        
        SizedBox(height: fontSize.spacing * 1.5),
        _buildProfessionalButton(
          onPressed: _isLoading ? null : _handleSignup,
          isLoading: _isLoading,
          label: 'Create Account',
          theme: theme,
          fontSize: fontSize,
        ),
      ],
    );
  }

  Widget _buildOTPSection(bool isDark, ThemeData theme, _FontSizes fontSize) {
    final otpBoxSize = fontSize.otpBoxSize;

    return Column(
      key: const ValueKey('otp'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: InkWell(
            onTap: _goBackToForm,
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.arrow_back, size: 16, color: isDark ? Colors.grey[400] : Colors.grey[600]),
                  const SizedBox(width: 4),
                  Text('Edit Details', style: TextStyle(fontSize: fontSize.caption, color: isDark ? Colors.grey[400] : Colors.grey[600])),
                ],
              ),
            ),
          ),
        ),
        SizedBox(height: fontSize.spacing),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: List.generate(6, (index) {
            return AnimatedBuilder(
              animation: _pulseController,
              builder: (context, _) {
                return Focus(
                  canRequestFocus: false, // Don't steal focus
                  onKeyEvent: (node, event) {
                    if (event is KeyDownEvent && 
                        event.logicalKey == LogicalKeyboardKey.backspace) {
                      if (_otpControllers[index].text.isEmpty && index > 0) {
                         // Clear previous and move back
                        _otpControllers[index - 1].clear();
                        _otpFocusNodes[index - 1].requestFocus();
                        return KeyEventResult.handled;
                      }
                    }
                    return KeyEventResult.ignored;
                  },
                  child: SizedBox(
                    width: otpBoxSize,
                    height: otpBoxSize * 1.25,
                    child: TextField(
                      controller: _otpControllers[index],
                      focusNode: _otpFocusNodes[index],
                      keyboardType: TextInputType.number,
                      textAlign: TextAlign.center,
                      maxLength: 1,
                      style: TextStyle(
                        fontSize: fontSize.otpText,
                        fontWeight: FontWeight.w600,
                        color: isDark ? Colors.white : Colors.grey[900],
                      ),
                      decoration: InputDecoration(
                        counterText: '',
                        filled: true,
                        fillColor: isDark ? const Color(0xFF262626) : const Color(0xFFF9FAFB),
                        contentPadding: EdgeInsets.zero,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: isDark ? Colors.grey[800]! : Colors.grey[300]!)),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: isDark ? Colors.grey[800]! : Colors.grey[300]!)),
                        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: theme.colorScheme.primary, width: 2)),
                      ),
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      onChanged: (value) {
                        // Forward navigation
                        if (value.isNotEmpty && index < 5) {
                          _otpFocusNodes[index + 1].requestFocus();
                        }
                        // Backward navigation (if current cleared)
                        if (value.isEmpty && index > 0) {
                          _otpFocusNodes[index - 1].requestFocus();
                        }
                        // Auto-verify
                        if (index == 5 && value.isNotEmpty) {
                          final otp = _otpControllers.map((c) => c.text).join();
                          if (otp.length == 6) _verifyOTP();
                        }
                      },
                    ),
                  ),
                );
              },
            ).animate(delay: (50 * index).ms).fadeIn().slideY(begin: 0.3);
          }),
        ),
        SizedBox(height: fontSize.spacing * 1.5),
        _buildProfessionalButton(
          onPressed: _isLoading ? null : _verifyOTP,
          isLoading: _isLoading,
          label: 'Verify & Continue',
          theme: theme,
          fontSize: fontSize,
        ),
        SizedBox(height: fontSize.spacing),
        Center(
          child: TextButton(
            onPressed: _resendCooldown > 0 ? null : _resendOTP,
            style: TextButton.styleFrom(foregroundColor: theme.colorScheme.primary),
            child: Text(
              _resendCooldown > 0 ? 'Resend in ${_resendCooldown}s' : 'Resend Code',
              style: TextStyle(fontSize: fontSize.caption, fontWeight: FontWeight.w600, color: _resendCooldown > 0 ? Colors.grey : theme.colorScheme.primary),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required FocusNode focusNode,
    required bool isFocused,
    required String label,
    required String hint,
    required IconData icon,
    required bool isDark,
    required ThemeData theme,
    required _FontSizes fontSize,
    TextInputType? keyboardType,
    TextCapitalization textCapitalization = TextCapitalization.none,
    int? maxLength,
    String? prefixText,
  }) {
    // Professional Input Layout Container
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeInOut,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: isDark ? const Color(0xFF262626) : const Color(0xFFF9FAFB),
        border: Border.all(
          color: isFocused 
              ? theme.colorScheme.primary 
              : (isDark ? Colors.grey[800]! : Colors.grey[300]!),
          width: isFocused ? 1.5 : 1,
        ),
        boxShadow: isFocused ? [
          BoxShadow(
            color: theme.colorScheme.primary.withValues(alpha: 0.1),
            blurRadius: 8,
            spreadRadius: 0,
            offset: const Offset(0, 2),
          ),
        ] : null,
      ),
      child: Row(
        children: [
          // Animated Prefix Icon
          TweenAnimationBuilder<Color?>(
            duration: const Duration(milliseconds: 200),
            tween: ColorTween(
              begin: Colors.grey[400],
              end: isFocused ? theme.colorScheme.primary : Colors.grey[400],
            ),
            builder: (context, color, _) {
              return Icon(
                icon,
                color: color,
                size: fontSize.icon,
              );
            },
          ),
          const SizedBox(width: 16),
          
          // Label + Input Column
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                AnimatedDefaultTextStyle(
                  duration: const Duration(milliseconds: 200),
                  style: TextStyle(
                    color: isFocused ? theme.colorScheme.primary : Colors.grey[600],
                    fontSize: fontSize.caption,
                    fontWeight: FontWeight.w600,
                    fontFamily: 'Inter',
                  ),
                  child: Text(label),
                ),
                const SizedBox(height: 4),
                TextField(
                  controller: controller,
                  focusNode: focusNode,
                  keyboardType: keyboardType,
                  textCapitalization: textCapitalization,
                  maxLength: maxLength,
                  style: TextStyle(
                    color: isDark ? Colors.white : Colors.grey[900],
                    fontSize: fontSize.input,
                    fontWeight: FontWeight.w600,
                  ),
                  decoration: InputDecoration(
                    isDense: true,
                    filled: false,
                    hoverColor: Colors.transparent,
                    fillColor: Colors.transparent,
                    focusColor: Colors.transparent,
                    prefixText: prefixText,
                    prefixStyle: TextStyle(
                      color: isDark ? Colors.white : Colors.grey[900], 
                      fontSize: fontSize.input, 
                      fontWeight: FontWeight.w600
                    ),
                    counterText: '',
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    errorBorder: InputBorder.none,
                    disabledBorder: InputBorder.none,
                    contentPadding: EdgeInsets.zero,
                    hintText: hint,
                    hintStyle: TextStyle(
                      color: isDark ? Colors.grey[600] : Colors.grey[400],
                      fontWeight: FontWeight.w400,
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

  Widget _buildProfessionalButton({
    required VoidCallback? onPressed,
    required bool isLoading,
    required String label,
    required ThemeData theme,
    required _FontSizes fontSize,
  }) {
    return SizedBox(
      height: fontSize.buttonHeight,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF111827),
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          padding: EdgeInsets.zero,
        ),
        child: isLoading
            ? SizedBox(
                width: fontSize.icon,
                height: fontSize.icon,
                child: const CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation<Color>(Colors.white)),
              )
            : Text(label, style: TextStyle(fontSize: fontSize.button, fontWeight: FontWeight.w600, letterSpacing: 0.2)),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // BACKGROUND EFFECTS
  // ═══════════════════════════════════════════════════════════════
  Widget _buildAnimatedBackground(bool isDark) {
    return AnimatedBuilder(
      animation: _bgAnimController,
      builder: (context, _) {
        return Container(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: Alignment(
                math.sin(_bgAnimController.value * 2 * math.pi) * 0.5,
                math.cos(_bgAnimController.value * 2 * math.pi) * 0.5,
              ),
              radius: 1.5,
              colors: isDark
                  ? [AppColors.primary.withValues(alpha: 0.15), const Color(0xFF080B12), const Color(0xFF080B12)]
                  : [AppColors.primary.withValues(alpha: 0.1), const Color(0xFFF0F4F8), const Color(0xFFF0F4F8)],
            ),
          ),
        );
      },
    );
  }

  List<Widget> _buildFloatingOrbs(bool isDark, Size size) {
    return [
      Positioned(
        top: -size.height * 0.1,
        right: -size.width * 0.1,
        child: AnimatedBuilder(
          animation: _floatController,
          builder: (context, _) {
            return Transform.translate(
              offset: Offset(0, _floatController.value * 30),
              child: Container(
                width: size.width * 0.3,
                height: size.width * 0.3,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [AppColors.primary.withValues(alpha: 0.3), Colors.transparent],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    ];
  }

  // ═══════════════════════════════════════════════════════════════
  // INLINE VALIDATION WIDGET METHODS (NEW)
  // ═══════════════════════════════════════════════════════════════

  /// Email field with Send OTP button and validation indicator
  Widget _buildEmailFieldWithOTP(bool isDark, ThemeData theme, _FontSizes fontSize) {
    final email = _emailController.text.trim();
    final isValidEmail = email.contains('@') && email.contains('.');
    final canSendOtp = isValidEmail && _emailAvailable && !_emailOtpSent && !_emailVerified;
    
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeInOut,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: isDark ? const Color(0xFF262626) : const Color(0xFFF9FAFB),
        border: Border.all(
          color: _emailVerified
              ? AppColors.success
              : (_emailFocused ? theme.colorScheme.primary : (isDark ? Colors.grey[800]! : Colors.grey[300]!)),
          width: _emailFocused || _emailVerified ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              // Email icon
              TweenAnimationBuilder<Color?>(
                duration: const Duration(milliseconds: 200),
                tween: ColorTween(
                  begin: Colors.grey[400],
                  end: _emailVerified ? AppColors.success : (_emailFocused ? theme.colorScheme.primary : Colors.grey[400]),
                ),
                builder: (context, color, _) {
                  return Icon(Icons.mail_outline_rounded, color: color, size: fontSize.icon);
                },
              ),
              const SizedBox(width: 16),
              
              // Email input
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    AnimatedDefaultTextStyle(
                      duration: const Duration(milliseconds: 200),
                      style: TextStyle(
                        color: _emailVerified ? AppColors.success : (_emailFocused ? theme.colorScheme.primary : Colors.grey[600]),
                        fontSize: fontSize.caption,
                        fontWeight: FontWeight.w600,
                      ),
                      child: const Text('Email Address'),
                    ),
                    const SizedBox(height: 4),
                    TextField(
                      controller: _emailController,
                      focusNode: _emailFocus,
                      keyboardType: TextInputType.emailAddress,
                      enabled: !_emailVerified,
                      style: TextStyle(
                        fontSize: fontSize.input,
                        fontWeight: FontWeight.w500,
                        color: isDark ? Colors.white : const Color(0xFF111827),
                      ),
                      decoration: InputDecoration(
                        hintText: 'name@business.com',
                        hintStyle: TextStyle(color: Colors.grey[400], fontWeight: FontWeight.w400),
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        disabledBorder: InputBorder.none,
                        filled: false,
                        isDense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                      onChanged: (value) {
                        setState(() {
                          _emailVerified = false;
                          _emailOtpSent = false;
                        });
                        _checkEmailAvailability(value.trim());
                      },
                    ),
                  ],
                ),
              ),
              
              // Status indicator or Send OTP button
              if (_emailChecking)
                SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation(theme.colorScheme.primary),
                  ),
                )
              else if (_emailVerified)
                const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 24)
              else if (_emailOtpSent)
                const Icon(Icons.schedule_rounded, color: Colors.orange, size: 24)
              else if (canSendOtp)
                GestureDetector(
                  onTap: _emailOtpLoading ? null : _sendSignupEmailOTP,
                  child: AnimatedContainer(
                    duration: 200.ms,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.primary,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: _emailOtpLoading
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation(Colors.white),
                            ),
                          )
                        : Text(
                            'Send OTP',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: fontSize.caption,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                  ),
                )
              else if (!_emailAvailable && isValidEmail)
                Icon(Icons.error_outline_rounded, color: AppColors.error, size: 24),
            ],
          ),
        ],
      ),
    );
  }

  /// Inline OTP input field that appears after "Send OTP"
  Widget _buildInlineEmailOtpInput(bool isDark, ThemeData theme, _FontSizes fontSize) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeInOut,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: isDark ? const Color(0xFF262626) : const Color(0xFFF9FAFB),
        border: Border.all(
          color: isDark ? Colors.grey[800]! : Colors.grey[300]!,
          width: 1,
        ),
      ),
      child: Row(
        children: [
          // Lock icon
          Icon(
            Icons.lock_outline_rounded,
            color: theme.colorScheme.primary,
            size: fontSize.icon,
          ),
          const SizedBox(width: 16),
          
          // OTP input
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Text(
                      'Email OTP',
                      style: TextStyle(
                        color: theme.colorScheme.primary,
                        fontSize: fontSize.caption,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const Spacer(),
                    if (_emailOtpCooldown > 0)
                      Text(
                        'Resend in ${_emailOtpCooldown}s',
                        style: TextStyle(fontSize: 11, color: Colors.grey[500]),
                      )
                    else
                      GestureDetector(
                        onTap: _sendSignupEmailOTP,
                        child: Text(
                          'Resend',
                          style: TextStyle(
                            fontSize: 11,
                            color: theme.colorScheme.primary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                TextField(
                  controller: _emailOtpController,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  style: TextStyle(
                    fontSize: fontSize.input,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 8,
                    color: isDark ? Colors.white : const Color(0xFF111827),
                  ),
                  decoration: InputDecoration(
                    hintText: '• • • • • •',
                    hintStyle: TextStyle(color: Colors.grey[400], fontWeight: FontWeight.w400, letterSpacing: 4),
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    filled: false,
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                    counterText: '',
                  ),
                  onChanged: (value) {
                    setState(() {});
                    if (value.length == 6) {
                      _verifySignupEmailOTP(value);
                    }
                  },
                ),
              ],
            ),
          ),
          
          // Status indicator
          if (_emailOtpLoading)
            SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation(theme.colorScheme.primary),
              ),
            )
          else if (_emailOtpController.text.length == 6)
            Icon(Icons.check_circle_rounded, color: theme.colorScheme.primary, size: 24),
        ],
      ),
    ).animate().fadeIn(duration: 300.ms).slideY(begin: -0.1);
  }

  /// Phone field with real-time availability check
  Widget _buildPhoneFieldWithValidation(bool isDark, ThemeData theme, _FontSizes fontSize) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeInOut,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: isDark ? const Color(0xFF262626) : const Color(0xFFF9FAFB),
        border: Border.all(
          color: _phoneChecked && _phoneAvailable
              ? AppColors.success
              : (_phoneFocused ? theme.colorScheme.primary : (isDark ? Colors.grey[800]! : Colors.grey[300]!)),
          width: _phoneFocused || (_phoneChecked && _phoneAvailable) ? 1.5 : 1,
        ),
      ),
      child: Row(
        children: [
          TweenAnimationBuilder<Color?>(
            duration: const Duration(milliseconds: 200),
            tween: ColorTween(
              begin: Colors.grey[400],
              end: _phoneChecked && _phoneAvailable
                  ? AppColors.success
                  : (_phoneFocused ? theme.colorScheme.primary : Colors.grey[400]),
            ),
            builder: (context, color, _) {
              return Icon(Icons.phone_outlined, color: color, size: fontSize.icon);
            },
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                AnimatedDefaultTextStyle(
                  duration: const Duration(milliseconds: 200),
                  style: TextStyle(
                    color: _phoneChecked && _phoneAvailable
                        ? AppColors.success
                        : (_phoneFocused ? theme.colorScheme.primary : Colors.grey[600]),
                    fontSize: fontSize.caption,
                    fontWeight: FontWeight.w600,
                  ),
                  child: const Text('Phone Number'),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Text(
                      '+91 ',
                      style: TextStyle(
                        fontSize: fontSize.input,
                        fontWeight: FontWeight.w500,
                        color: isDark ? Colors.grey[400] : Colors.grey[600],
                      ),
                    ),
                    Expanded(
                      child: TextField(
                        controller: _phoneController,
                        focusNode: _phoneFocus,
                        keyboardType: TextInputType.phone,
                        maxLength: 10,
                        style: TextStyle(
                          fontSize: fontSize.input,
                          fontWeight: FontWeight.w500,
                          color: isDark ? Colors.white : const Color(0xFF111827),
                        ),
                        decoration: InputDecoration(
                          hintText: '9876543210',
                          hintStyle: TextStyle(color: Colors.grey[400], fontWeight: FontWeight.w400),
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          filled: false,
                          isDense: true,
                          contentPadding: EdgeInsets.zero,
                          counterText: '',
                        ),
                        onChanged: (value) {
                          _checkPhoneAvailability(value);
                        },
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Status indicator
          if (_phoneChecking)
            SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation(theme.colorScheme.primary),
              ),
            )
          else if (_phoneChecked && _phoneAvailable)
            const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 24)
          else if (_phoneChecked && !_phoneAvailable)
            const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 24),
        ],
      ),
    );
  }

  /// Store name field with real-time availability check
  Widget _buildStoreNameFieldWithValidation(bool isDark, ThemeData theme, _FontSizes fontSize) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeInOut,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: isDark ? const Color(0xFF262626) : const Color(0xFFF9FAFB),
        border: Border.all(
          color: _storeNameChecked && _storeNameAvailable
              ? AppColors.success
              : (_storeNameFocused ? theme.colorScheme.primary : (isDark ? Colors.grey[800]! : Colors.grey[300]!)),
          width: _storeNameFocused || (_storeNameChecked && _storeNameAvailable) ? 1.5 : 1,
        ),
      ),
      child: Row(
        children: [
          TweenAnimationBuilder<Color?>(
            duration: const Duration(milliseconds: 200),
            tween: ColorTween(
              begin: Colors.grey[400],
              end: _storeNameChecked && _storeNameAvailable
                  ? AppColors.success
                  : (_storeNameFocused ? theme.colorScheme.primary : Colors.grey[400]),
            ),
            builder: (context, color, _) {
              return Icon(Icons.store_outlined, color: color, size: fontSize.icon);
            },
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                AnimatedDefaultTextStyle(
                  duration: const Duration(milliseconds: 200),
                  style: TextStyle(
                    color: _storeNameChecked && _storeNameAvailable
                        ? AppColors.success
                        : (_storeNameFocused ? theme.colorScheme.primary : Colors.grey[600]),
                    fontSize: fontSize.caption,
                    fontWeight: FontWeight.w600,
                  ),
                  child: const Text('Store Name'),
                ),
                const SizedBox(height: 4),
                TextField(
                  controller: _storeNameController,
                  focusNode: _storeNameFocus,
                  textCapitalization: TextCapitalization.words,
                  style: TextStyle(
                    fontSize: fontSize.input,
                    fontWeight: FontWeight.w500,
                    color: isDark ? Colors.white : const Color(0xFF111827),
                  ),
                  decoration: InputDecoration(
                    hintText: 'My Awesome Store',
                    hintStyle: TextStyle(color: Colors.grey[400], fontWeight: FontWeight.w400),
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    filled: false,
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                  onChanged: (value) {
                    _checkStoreNameAvailability(value);
                  },
                ),
              ],
            ),
          ),
          // Status indicator
          if (_storeNameChecking)
            SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation(theme.colorScheme.primary),
              ),
            )
          else if (_storeNameChecked && _storeNameAvailable)
            const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 24)
          else if (_storeNameChecked && !_storeNameAvailable)
            const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 24),
        ],
      ),
    );
  }

  /// Password field with visibility toggle
  Widget _buildPasswordField(bool isDark, ThemeData theme, _FontSizes fontSize) {
    final password = _passwordController.text;
    final isValid = password.length >= 6;
    
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeInOut,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: isDark ? const Color(0xFF262626) : const Color(0xFFF9FAFB),
        border: Border.all(
          color: isValid && password.isNotEmpty
              ? AppColors.success
              : (_passwordFocused ? theme.colorScheme.primary : (isDark ? Colors.grey[800]! : Colors.grey[300]!)),
          width: _passwordFocused || (isValid && password.isNotEmpty) ? 1.5 : 1,
        ),
      ),
      child: Row(
        children: [
          TweenAnimationBuilder<Color?>(
            duration: const Duration(milliseconds: 200),
            tween: ColorTween(
              begin: Colors.grey[400],
              end: isValid && password.isNotEmpty
                  ? AppColors.success
                  : (_passwordFocused ? theme.colorScheme.primary : Colors.grey[400]),
            ),
            builder: (context, color, _) {
              return Icon(Icons.lock_outline_rounded, color: color, size: fontSize.icon);
            },
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                AnimatedDefaultTextStyle(
                  duration: const Duration(milliseconds: 200),
                  style: TextStyle(
                    color: isValid && password.isNotEmpty
                        ? AppColors.success
                        : (_passwordFocused ? theme.colorScheme.primary : Colors.grey[600]),
                    fontSize: fontSize.caption,
                    fontWeight: FontWeight.w600,
                  ),
                  child: const Text('Password'),
                ),
                const SizedBox(height: 4),
                TextField(
                  controller: _passwordController,
                  focusNode: _passwordFocus,
                  obscureText: !_passwordVisible,
                  style: TextStyle(
                    fontSize: fontSize.input,
                    fontWeight: FontWeight.w500,
                    color: isDark ? Colors.white : const Color(0xFF111827),
                  ),
                  decoration: InputDecoration(
                    hintText: 'Min 6 characters',
                    hintStyle: TextStyle(color: Colors.grey[400], fontWeight: FontWeight.w400),
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    filled: false,
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                  onChanged: (value) => setState(() {}),
                ),
              ],
            ),
          ),
          // Visibility toggle
          GestureDetector(
            onTap: () => setState(() => _passwordVisible = !_passwordVisible),
            child: Icon(
              _passwordVisible ? Icons.visibility_off_outlined : Icons.visibility_outlined,
              color: Colors.grey[400],
              size: 22,
            ),
          ),
          if (isValid && password.isNotEmpty) ...[
            const SizedBox(width: 8),
            const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 24),
          ],
        ],
      ),
    );
  }

  /// Confirm password field with matching validation
  Widget _buildConfirmPasswordField(bool isDark, ThemeData theme, _FontSizes fontSize) {
    final password = _passwordController.text;
    final confirmPassword = _confirmPasswordController.text;
    final isMatch = password.isNotEmpty && confirmPassword.isNotEmpty && password == confirmPassword;
    final isMismatch = confirmPassword.isNotEmpty && password != confirmPassword;
    
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeInOut,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: isDark ? const Color(0xFF262626) : const Color(0xFFF9FAFB),
        border: Border.all(
          color: isMatch
              ? AppColors.success
              : (isMismatch ? AppColors.error : (_confirmPasswordFocused ? theme.colorScheme.primary : (isDark ? Colors.grey[800]! : Colors.grey[300]!))),
          width: _confirmPasswordFocused || isMatch || isMismatch ? 1.5 : 1,
        ),
      ),
      child: Row(
        children: [
          TweenAnimationBuilder<Color?>(
            duration: const Duration(milliseconds: 200),
            tween: ColorTween(
              begin: Colors.grey[400],
              end: isMatch
                  ? AppColors.success
                  : (isMismatch ? AppColors.error : (_confirmPasswordFocused ? theme.colorScheme.primary : Colors.grey[400])),
            ),
            builder: (context, color, _) {
              return Icon(Icons.lock_outline_rounded, color: color, size: fontSize.icon);
            },
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                AnimatedDefaultTextStyle(
                  duration: const Duration(milliseconds: 200),
                  style: TextStyle(
                    color: isMatch
                        ? AppColors.success
                        : (isMismatch ? AppColors.error : (_confirmPasswordFocused ? theme.colorScheme.primary : Colors.grey[600])),
                    fontSize: fontSize.caption,
                    fontWeight: FontWeight.w600,
                  ),
                  child: const Text('Confirm Password'),
                ),
                const SizedBox(height: 4),
                TextField(
                  controller: _confirmPasswordController,
                  focusNode: _confirmPasswordFocus,
                  obscureText: !_confirmPasswordVisible,
                  style: TextStyle(
                    fontSize: fontSize.input,
                    fontWeight: FontWeight.w500,
                    color: isDark ? Colors.white : const Color(0xFF111827),
                  ),
                  decoration: InputDecoration(
                    hintText: 'Re-enter password',
                    hintStyle: TextStyle(color: Colors.grey[400], fontWeight: FontWeight.w400),
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    filled: false,
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                  onChanged: (value) => setState(() {}),
                ),
              ],
            ),
          ),
          // Visibility toggle
          GestureDetector(
            onTap: () => setState(() => _confirmPasswordVisible = !_confirmPasswordVisible),
            child: Icon(
              _confirmPasswordVisible ? Icons.visibility_off_outlined : Icons.visibility_outlined,
              color: Colors.grey[400],
              size: 22,
            ),
          ),
          if (isMatch) ...[
            const SizedBox(width: 8),
            const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 24),
          ] else if (isMismatch) ...[
            const SizedBox(width: 8),
            const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 24),
          ],
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// CHECKBOX & TERMS MODAL
// ═══════════════════════════════════════════════════════════════
class _TermsAndConditionsModal extends StatefulWidget {
  final ThemeData theme;
  final VoidCallback onAccept;

  const _TermsAndConditionsModal({required this.theme, required this.onAccept});

  @override
  State<_TermsAndConditionsModal> createState() => _TermsAndConditionsModalState();
}

class _TermsAndConditionsModalState extends State<_TermsAndConditionsModal> {
  final ScrollController _scrollController = ScrollController();
  bool _canAccept = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_canAccept &&
        _scrollController.hasClients &&
        _scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 50) {
      setState(() => _canAccept = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = widget.theme.brightness == Brightness.dark;

    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Drag Handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 12, bottom: 20),
              width: 48,
              height: 4,
              decoration: BoxDecoration(color: Colors.grey[400], borderRadius: BorderRadius.circular(2)),
            ),
          ),
          
          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              children: [
                Text(
                  'Terms & Conditions',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w700,
                    color: isDark ? Colors.white : Colors.grey[900],
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Please read the entire agreement to continue.',
                  style: TextStyle(color: Colors.grey[600], fontSize: 13),
                ),
              ],
            ),
          ),
          
          Divider(color: Colors.grey.withValues(alpha: 0.2), height: 32),

          // Scrollable Content
          Expanded(
            child: SingleChildScrollView(
              controller: _scrollController,
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                   // Header Content
                   Center(
                     child: Column(
                       children: [
                         Icon(Icons.gavel_rounded, size: 48, color: widget.theme.colorScheme.primary),
                         const SizedBox(height: 16),
                         const Text('SELLER TERMS AND CONDITIONS', textAlign: TextAlign.center, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, letterSpacing: 0.5)),
                         const SizedBox(height: 8),
                         Text('LetBuyy Technologies Private Limited', textAlign: TextAlign.center, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.grey[700])),
                         const Text('Effective Date: 18-12-2025 | Version 1.0', textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: Colors.grey)),
                         Divider(height: 32, color: Colors.grey.withValues(alpha: 0.2)),
                       ],
                     ),
                   ),
                  ..._terms.map((term) => _buildSection(term['title']!, term['content']!)),
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),

          // Footer Actions
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
              boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, -5))],
            ),
            child: Column(
              children: [
                 if (!_canAccept)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(
                      'Scroll to the bottom to accept',
                      style: TextStyle(color: Colors.grey[500], fontSize: 12, fontWeight: FontWeight.w500),
                    ),
                  ),
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: ElevatedButton(
                    onPressed: _canAccept ? widget.onAccept : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: widget.theme.colorScheme.primary,
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: isDark ? Colors.grey[800] : Colors.grey[200],
                      disabledForegroundColor: Colors.grey[500],
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 0,
                    ),
                    child: const Text('I Accept Terms & Conditions', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSection(String title, String content) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, height: 1.3)),
          const SizedBox(height: 12),
          Text(content, style: const TextStyle(fontSize: 14, height: 1.6, color: Colors.grey)),
        ],
      ),
    );
  }

  final List<Map<String, String>> _terms = const [
    {
      'title': '1. INTRODUCTION AND ACCEPTANCE',
      'content': 'Welcome to LetBuyy. These Seller Terms and Conditions ("Agreement") constitute a legally binding contract between you ("Seller," "You," or "Your") and LetBuyy Technologies Private Limited ("LetBuyy," "We," "Us," or "Our"), a company incorporated under the laws of India, governing your use of the LetBuyy platform as a seller.\n\nBy registering as a seller, creating a seller account, listing products, or otherwise using our platform to sell products or services, you acknowledge that you have read, understood, and agree to be bound by these Terms. If you do not agree to these Terms, you must not register or use our platform as a seller.\n\nTHIS AGREEMENT CONTAINS IMPORTANT PROVISIONS INCLUDING LIMITATIONS OF LIABILITY, INDEMNIFICATION OBLIGATIONS, AND DISPUTE RESOLUTION PROCEDURES. PLEASE READ CAREFULLY.',
    },
    {
      'title': '2. DEFINITIONS',
      'content': 'In this Agreement, unless the context otherwise requires:\n\n• "Platform" means the LetBuyy mobile application, website, and all associated services, APIs, and technologies.\n• "Seller Store" means your dedicated storefront on the Platform, including your subdomain (e.g., yourstore.letbuyy.com).\n• "Products" means all goods, merchandise, and items listed for sale by you on the Platform.\n• "Content" means all text, images, videos, descriptions, logos, trademarks, and other materials uploaded or created by you on the Platform.\n• "Buyer" or "Customer" means any individual or entity that purchases Products through the Platform.\n• "Commission" means the percentage or fixed fee charged by LetBuyy on each successful transaction.\n• "Settlement" means the transfer of sale proceeds from LetBuyy to the Seller after deducting applicable fees.\n• "Video Content" means product videos, live streams, reels, and other video-based content created for product marketing.',
    },
    {
      'title': '3. SELLER ELIGIBILITY AND REGISTRATION',
      'content': '3.1 Eligibility Requirements\nTo register as a seller on LetBuyy, you must:\n• Be at least 18 years of age and legally competent to enter into binding contracts under Indian law\n• Be a resident of India or a business entity registered and operating in India\n• Possess a valid GSTIN (Goods and Services Tax Identification Number) if your annual turnover exceeds the GST threshold limits\n• Have a valid PAN (Permanent Account Number) for tax purposes\n• Maintain a valid bank account in India for receiving settlements\n• Not be prohibited from selling products under any applicable law or regulation\n• Have all necessary licenses, permits, and authorizations to sell your products\n\n3.2 Registration Process\nDuring registration, you must provide accurate, complete, and current information including:\n• Legal business name or individual name\n• Complete business address with PIN code\n• Valid email address and mobile number\n• GSTIN (if applicable) and PAN details\n• Bank account details (Account number, IFSC code, Account holder name)\n• Identity proof (Aadhaar, Passport, or Voter ID)\n• Business registration documents (if applicable)\n\n3.3 Account Security\nYou are solely responsible for maintaining the confidentiality of your account credentials and for all activities under your account. You must immediately notify LetBuyy of any unauthorized access or security breach. LetBuyy shall not be liable for any loss arising from unauthorized use of your account.',
    },
    {
      'title': '4. PRODUCTS AND LISTINGS',
      'content': '4.1 Product Listing Requirements\nAll product listings must include:\n• Accurate and complete product title and description\n• High-quality images that accurately represent the product\n• Correct pricing in Indian Rupees (INR) including all applicable taxes\n• Accurate stock/inventory information\n• Correct product category and attributes\n• Complete specifications, dimensions, weight, and materials\n• Clear shipping and delivery information\n• Return and refund policy for the product\n\n4.2 Video Content Requirements\nAs LetBuyy is a video-first platform, you are encouraged to create video content for your products. All video content must:\n• Accurately represent the product without misleading claims\n• Not contain offensive, inappropriate, or illegal content\n• Not infringe on any third-party intellectual property rights\n• Comply with the Advertising Standards Council of India (ASCI) guidelines\n• Not contain false or unsubstantiated claims about product benefits\n• Meet minimum quality standards as specified in our Seller Guidelines\n\n4.3 Prohibited Products\nThe following products are strictly prohibited on LetBuyy:\n• Illegal drugs, narcotics, and controlled substances\n• Weapons, firearms, ammunition, and explosives\n• Counterfeit, replica, or pirated goods\n• Stolen property or goods with unclear ownership\n• Products that infringe intellectual property rights\n• Adult content, pornographic material, or sexually explicit products\n• Tobacco products, e-cigarettes, and related items\n• Alcoholic beverages (unless specifically licensed)\n• Hazardous materials and dangerous goods\n• Human organs, body parts, or bodily fluids\n• Products promoting hatred, violence, or discrimination\n• Wildlife products and endangered species\n• Prescription medicines without valid pharmacy license\n• Any product prohibited under Indian law',
    },
    {
      'title': '5. PRICING, FEES, AND PAYMENTS',
      'content': '5.1 Product Pricing\nYou have full control over setting your product prices. All prices must be displayed in Indian Rupees (INR) and must include all applicable taxes (GST). You must not engage in price gouging, predatory pricing, or any pricing practices that violate applicable laws. LetBuyy reserves the right to display competitor pricing or market comparisons.\n\n5.2 Commission and Fees\nLetBuyy charges the following fees (subject to change with prior notice):\n• Platform Commission: A percentage of each sale as specified in your seller dashboard (typically ranging from 5% to 20% depending on category)\n• Payment Gateway Fees: Transaction processing fees charged by payment providers (typically 2-3%)\n• Fixed Fee: A fixed closing fee per transaction (if applicable)\n• GST on Fees: 18% GST will be charged on all LetBuyy fees\n\n5.3 Settlement and Payouts\nSettlement of sale proceeds will be processed as follows:\n• Settlements are processed within 7-14 business days after successful delivery confirmation\n• Minimum payout threshold of ₹100 must be reached before settlement\n• Settlements will be made via NEFT/IMPS/UPI to your registered bank account\n• LetBuyy will deduct applicable TDS (Tax Deducted at Source) as per Income Tax Act, 1961\n• Settlement amounts may be held or adjusted for returns, refunds, chargebacks, or disputes\n\n5.4 Taxes\nYou are solely responsible for determining and fulfilling all tax obligations including GST collection and remittance, income tax filing, TCS (Tax Collected at Source) compliance, and any other applicable taxes. LetBuyy may collect and remit TCS on your behalf as required by law and will provide necessary tax documentation.',
    },
    {
      'title': '6. ORDERS AND FULFILLMENT',
      'content': '6.1 Order Acceptance\nWhen a buyer places an order for your product, you are obligated to fulfill that order unless there are valid grounds for cancellation (such as out-of-stock situations, pricing errors, or suspected fraud). Repeated order cancellations may result in penalties or account suspension.\n\n6.2 Shipping and Delivery\nYou must:\n• Ship orders within the timeframe specified in your listing (typically 1-3 business days)\n• Use appropriate packaging to ensure products arrive undamaged\n• Provide valid tracking information for all shipments\n• Ship only to the address specified by the buyer\n• Comply with all applicable shipping laws and regulations\n• Include proper invoices and documentation with shipments\n\n6.3 Order Cancellation\nIf you must cancel an order, you must do so within 24 hours of order placement and provide a valid reason. Excessive cancellations (more than 5% of orders) may result in account suspension or termination. Buyers may also cancel orders before shipment in accordance with our Buyer Terms.',
    },
    {
      'title': '7. RETURNS, REFUNDS, AND DISPUTES',
      'content': '7.1 Return Policy\nYou must honor returns in the following circumstances:\n• Product received is damaged or defective\n• Product does not match the listing description\n• Wrong product was shipped\n• Product is missing parts or accessories as described\n• Any return window you have specified (minimum 7 days required)\n\n7.2 Refund Processing\nRefunds must be processed within 5-7 business days of receiving the returned product. In case of seller fault, you shall bear the return shipping costs. LetBuyy may directly initiate refunds to protect buyer interests and recover the amount from your future settlements.\n\n7.3 Dispute Resolution\nIn case of disputes between you and buyers, LetBuyy will act as an intermediary and make reasonable efforts to resolve disputes fairly. LetBuyy\'s decision in disputes shall be final and binding. You agree to cooperate fully in any dispute resolution process and provide requested information and documentation.',
    },
    {
      'title': '8. INTELLECTUAL PROPERTY RIGHTS',
      'content': '8.1 Your Content\nYou retain ownership of your Content, but grant LetBuyy a worldwide, non-exclusive, royalty-free, perpetual license to use, reproduce, modify, adapt, publish, translate, distribute, and display your Content for the purpose of operating and promoting the Platform and your products. This license continues even after account termination for content already in use.\n\n8.2 Seller Representations\nYou represent and warrant that:\n• You own or have the right to use all Content you upload\n• Your Content does not infringe any third-party intellectual property rights\n• Your products do not infringe any patents, trademarks, copyrights, or trade secrets\n• You have all necessary licenses to sell branded products\n\n8.3 Brand Authorization\nIf selling branded products, you must provide brand authorization letters or proof of legitimate sourcing upon request. Selling counterfeit or unauthorized products will result in immediate account termination and potential legal action.',
    },
    {
      'title': '9. DATA PROTECTION AND PRIVACY',
      'content': '9.1 Customer Data\nYou will receive customer data solely for the purpose of fulfilling orders. You must:\n• Use customer data only for order fulfillment and related communication\n• Not share, sell, or transfer customer data to third parties\n• Not contact customers for marketing without their explicit consent\n• Implement reasonable security measures to protect customer data\n• Comply with applicable data protection laws including IT Act, 2000 and rules thereunder\n• Delete customer data upon request or account termination\n\n9.2 Data Breach\nYou must immediately notify LetBuyy of any suspected or actual data breach involving customer data. You shall be liable for any damages arising from data breaches caused by your negligence or failure to implement adequate security measures.',
    },
    {
      'title': '10. SELLER CONDUCT AND PROHIBITED ACTIVITIES',
      'content': '10.1 Prohibited Activities\nYou must not engage in any of the following:\n• Creating multiple seller accounts without authorization\n• Manipulating reviews, ratings, or feedback\n• Offering incentives for positive reviews\n• Purchasing from yourself to inflate sales metrics\n• Circumventing the platform to complete transactions outside LetBuyy\n• Sending unsolicited communications to buyers\n• Using automated tools or bots to manipulate the platform\n• Engaging in any fraudulent, deceptive, or illegal activity\n• Harassing, threatening, or abusing buyers or LetBuyy staff\n• Violating any applicable laws or regulations\n\n10.2 Performance Standards\nYou must maintain the following minimum performance standards:\n• Order cancellation rate below 5%\n• On-time shipping rate above 95%\n• Customer response time within 24 hours\n• Return rate below 10%\n• Minimum customer rating of 3.5 stars\nFailure to meet these standards may result in reduced visibility, penalties, or account suspension.',
    },
    {
      'title': '11. LIABILITY AND INDEMNIFICATION',
      'content': '11.1 Limitation of Liability\nTO THE MAXIMUM EXTENT PERMITTED BY LAW, LETBUYY SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, BUSINESS OPPORTUNITIES, OR GOODWILL, ARISING FROM YOUR USE OF THE PLATFORM.\nLETBUYY\'S TOTAL LIABILITY SHALL NOT EXCEED THE TOTAL FEES PAID BY YOU TO LETBUYY IN THE SIX (6) MONTHS PRECEDING THE CLAIM.\n\n11.2 Indemnification\nYou agree to indemnify, defend, and hold harmless LetBuyy, its affiliates, officers, directors, employees, and agents from any claims, damages, losses, liabilities, costs, and expenses (including legal fees) arising from:\n• Your breach of this Agreement\n• Your products, including product liability claims\n• Your Content and its use\n• Your violation of any law or third-party rights\n• Any taxes, duties, or fees you fail to pay\n• Any dispute with buyers',
    },
    {
      'title': '12. ACCOUNT SUSPENSION AND TERMINATION',
      'content': '12.1 Suspension\nLetBuyy may suspend your account immediately and without notice for:\n• Suspected fraudulent activity\n• Violation of this Agreement\n• Failure to meet performance standards\n• Legal requirements or court orders\n• Risk to buyers or the platform\n\n12.2 Termination by LetBuyy\nLetBuyy may terminate your account with 30 days written notice for convenience, or immediately for material breach. Upon termination, all pending settlements will be processed subject to holds for potential returns, refunds, and chargebacks for up to 90 days.\n\n12.3 Termination by Seller\nYou may terminate your account by providing 30 days written notice to LetBuyy. You must fulfill all pending orders before termination. Outstanding fees will be deducted from final settlement.\n\n12.4 Effect of Termination\nUpon termination, your listings will be removed, access to seller tools will be revoked, and you must cease using LetBuyy trademarks. Provisions regarding liability, indemnification, intellectual property licenses, and dispute resolution survive termination.',
    },
    {
      'title': '13. GOVERNING LAW AND DISPUTE RESOLUTION',
      'content': '13.1 Governing Law\nThis Agreement shall be governed by and construed in accordance with the laws of India, without regard to conflict of law principles.\n\n13.2 Arbitration\nAny dispute arising out of or in connection with this Agreement shall be resolved by binding arbitration in accordance with the Arbitration and Conciliation Act, 1996. The arbitration shall be conducted by a sole arbitrator mutually appointed by the parties, or failing agreement, appointed by the Chennai International Arbitration Centre. The seat of arbitration shall be Chennai, Tamil Nadu, India, and proceedings shall be conducted in English.\n\n13.3 Jurisdiction\nSubject to the arbitration clause above, the courts of Chennai, Tamil Nadu, India shall have exclusive jurisdiction over any matters arising from this Agreement.',
    },
    {
      'title': '14. GENERAL PROVISIONS',
      'content': '14.1 Modifications\nLetBuyy reserves the right to modify this Agreement at any time. Changes will be notified via email or platform notification at least 15 days before taking effect. Continued use of the platform after changes take effect constitutes acceptance of the modified terms.\n\n14.2 Entire Agreement\nThis Agreement, together with the Privacy Policy, Seller Guidelines, and any other policies referenced herein, constitutes the entire agreement between you and LetBuyy and supersedes all prior agreements.\n\n14.3 Severability\nIf any provision of this Agreement is held invalid or unenforceable, the remaining provisions shall continue in full force and effect.\n\n14.4 Waiver\nNo waiver of any term shall be deemed a further or continuing waiver of such term or any other term.\n\n14.5 Assignment\nYou may not assign or transfer this Agreement without LetBuyy\'s prior written consent. LetBuyy may assign this Agreement to any affiliate or successor.\n\n14.6 Force Majeure\nNeither party shall be liable for delays or failures in performance resulting from circumstances beyond reasonable control, including natural disasters, war, terrorism, strikes, government actions, or internet failures.\n\n14.7 Notices\nAll notices to LetBuyy must be sent to: LetBuyy Technologies Private Limited, [Address], Email: legal@letbuyy.com. Notices to you will be sent to the email address registered with your account.\n\n14.8 Language\nThis Agreement is executed in English. Any translations are for convenience only, and the English version shall prevail.',
    },
    {
      'title': '15. ACKNOWLEDGMENT AND ACCEPTANCE',
      'content': 'BY CLICKING "I AGREE," "ACCEPT," OR BY REGISTERING AS A SELLER ON LETBUYY, YOU ACKNOWLEDGE THAT:\n• You have read and understood this entire Agreement\n• You agree to be legally bound by all terms and conditions\n• You have the legal capacity and authority to enter into this Agreement\n• You will comply with all applicable laws and regulations\n• All information provided during registration is accurate and complete',
    },
    {
      'title': '16. CONTACT INFORMATION',
      'content': 'For any questions regarding these Terms, please contact:\n\nLetBuyy Technologies Private Limited\n17/354J Kandhasamy Nagar, Vinayagapuram, Attur\nSalem, TamilNadu, 636108\nEmail: support@letbuyy.com\nGrievance Officer: RohitVijay, Email: grievance@letbuyy.com',
    },
  ];
}

// ═══════════════════════════════════════════════════════════════
// RESPONSIVE FONT SIZES (COPIED FROM LOGIN)
// ═══════════════════════════════════════════════════════════════
class _FontSizes {
  final double title;
  final double body;
  final double caption;
  final double label;
  final double input;
  final double button;
  final double icon;
  final double iconSmall;
  final double spacing;
  final double buttonHeight;
  final double inputPadding;
  final double otpBoxSize;
  final double otpText;

  const _FontSizes({
    required this.title,
    required this.body,
    required this.caption,
    required this.label,
    required this.input,
    required this.button,
    required this.icon,
    required this.iconSmall,
    required this.spacing,
    required this.buttonHeight,
    required this.inputPadding,
    required this.otpBoxSize,
    required this.otpText,
  });

  static const mobile = _FontSizes(
    title: 24,
    body: 13,
    caption: 12,
    label: 13,
    input: 15,
    button: 15,
    icon: 20,
    iconSmall: 16,
    spacing: 14,
    buttonHeight: 54,
    inputPadding: 18,
    otpBoxSize: 44,
    otpText: 22,
  );

  static const tablet = _FontSizes(
    title: 28,
    body: 14,
    caption: 13,
    label: 14,
    input: 16,
    button: 16,
    icon: 22,
    iconSmall: 18,
    spacing: 16,
    buttonHeight: 58,
    inputPadding: 20,
    otpBoxSize: 50,
    otpText: 24,
  );

  static const desktop = _FontSizes(
    title: 28,
    body: 14,
    caption: 13,
    label: 14,
    input: 16,
    button: 16,
    icon: 22,
    iconSmall: 18,
    spacing: 18,
    buttonHeight: 60,
    inputPadding: 20,
    otpBoxSize: 52,
    otpText: 26,
  );

  static const largeDesktop = _FontSizes(
    title: 32,
    body: 15,
    caption: 14,
    label: 15,
    input: 17,
    button: 17,
    icon: 24,
    iconSmall: 20,
    spacing: 20,
    buttonHeight: 64,
    inputPadding: 22,
    otpBoxSize: 56,
    otpText: 28,
  );
}

// ═══════════════════════════════════════════════════════════════
// GRID PATTERN PAINTER
// ═══════════════════════════════════════════════════════════════
class _GridPatternPainter extends CustomPainter {
  final bool isDark;
  final double opacity;

  _GridPatternPainter({this.isDark = false, this.opacity = 0.05});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = (isDark ? Colors.white : Colors.grey).withValues(alpha: opacity)
      ..strokeWidth = 1;

    const spacing = 50.0;
    
    for (double x = 0; x < size.width; x += spacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += spacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
