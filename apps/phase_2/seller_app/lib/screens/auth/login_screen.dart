// lib/screens/auth/login_screen.dart
// 🔐 ULTRA-RESPONSIVE SELLER OTP LOGIN SCREEN
// ✨ Matches Admin Login Exactly (Pixel-Perfect)
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
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:provider/provider.dart';

import '../../app/routes.dart';
import '../../providers/seller_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with TickerProviderStateMixin {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _emailFocus = FocusNode();
  final _passwordFocus = FocusNode();
  bool _obscurePassword = true;
  final List<TextEditingController> _otpControllers = List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _otpFocusNodes = List.generate(6, (_) => FocusNode());

  // Animation controllers
  late AnimationController _bgAnimController;
  late AnimationController _pulseController;
  late AnimationController _floatController;
  late AnimationController _shimmerController;

  bool _isLoading = false;
  bool _otpSent = false;
  bool _emailFocused = false;
  String? _errorMessage;
  String? _storeName;
  int _resendCooldown = 0;
  Timer? _resendTimer;

  static const String _functionsBaseUrl = 'https://us-central1-letbuy-y.cloudfunctions.net';

  // Responsive breakpoints matching Admin
  static const double _mobileBreakpoint = 600;
  static const double _tabletBreakpoint = 1024;
  static const double _desktopBreakpoint = 1440;

  @override
  void initState() {
    super.initState();
    _emailFocus.addListener(() => setState(() => _emailFocused = _emailFocus.hasFocus));
    _loadSavedEmail();
    _initAnimations();
    
    // Set status bar to transparent so background shows through
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark, // Light mode: dark icons
      statusBarBrightness: Brightness.light, // iOS
    ));
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
    _emailController.dispose();
    _passwordController.dispose();
    _emailFocus.dispose();
    _passwordFocus.dispose();
    for (final c in _otpControllers) {
      c.dispose();
    }
    for (final f in _otpFocusNodes) {
      f.dispose();
    }
    _resendTimer?.cancel();
    _bgAnimController.dispose();
    _pulseController.dispose();
    _floatController.dispose();
    _shimmerController.dispose();
    super.dispose();
  }

  Future<void> _loadSavedEmail() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedEmail = prefs.getString('seller_email');
      if (savedEmail != null) {
        _emailController.text = savedEmail;
      }
    } catch (e) {
      debugPrint('Error loading saved email: $e');
    }
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

  Future<void> _loginWithPassword() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    
    if (email.isEmpty || !email.contains('@')) {
      _showError('Please enter a valid email address');
      return;
    }
    if (password.isEmpty) {
      _showError('Please enter your password');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await http.post(
        Uri.parse('$_functionsBaseUrl/verifySellerPassword'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'email': email, 'password': password}),
      );

      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        final customToken = data['customToken'];
        final userCredential = await FirebaseAuth.instance.signInWithCustomToken(customToken);

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(StorageConstants.keyUserType, 'seller');
        await prefs.setString(StorageConstants.keyUserRole, 'seller');
        await prefs.setString('seller_email', email);

        if (!mounted) return;

        // Load seller data and determine correct route
        final sellerProvider = Provider.of<SellerProvider>(context, listen: false);
        await sellerProvider.loadSeller(userCredential.user!.uid);
        
        if (!mounted) return;
        
        final seller = sellerProvider.currentSeller;
        String targetRoute = AppRoutes.sellerMain;
        
        if (seller != null) {
          if (!seller.emailVerified) {
            targetRoute = AppRoutes.verifyEmail;
          } else {
            // Check if KYC documents were actually submitted (panNumber is set by Cloud Function)
            final hasSubmittedKyc = seller.panNumber.isNotEmpty;
                
            switch (seller.verificationStatus) {
              case VerificationStatus.verified:
                targetRoute = AppRoutes.sellerMain;
                break;
              case VerificationStatus.pending:
                // Show KYC status screen if KYC was submitted
                targetRoute = hasSubmittedKyc ? AppRoutes.kycStatus : AppRoutes.welcome;
                break;
              case VerificationStatus.rejected:
                targetRoute = AppRoutes.kycRejected;
                break;
              case VerificationStatus.suspended:
                targetRoute = AppRoutes.suspended;
                break;
              default:
                final isProfileComplete = seller.storeName.isNotEmpty &&
                    seller.businessAddress.isNotEmpty &&
                    seller.businessCity.isNotEmpty;
                if (!isProfileComplete || !hasSubmittedKyc) {
                  targetRoute = AppRoutes.welcome;
                } else {
                  targetRoute = AppRoutes.kycStatus;
                }
            }
          }
        } else {
          // No seller data found - this is a new seller, go to welcome/KYC
          targetRoute = AppRoutes.welcome;
        }

        Navigator.pushNamedAndRemoveUntil(context, targetRoute, (route) => false);
      } else {
        _showError(data['error'] ?? 'Login failed');
      }
    } catch (e) {
      _showError('Network error. Please try again.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _sendOTP() async {
    final email = _emailController.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      _showError('Please enter a valid email address');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await http.post(
        Uri.parse('$_functionsBaseUrl/sendSellerLoginOTP'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'email': email}),
      );

      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        setState(() {
          _otpSent = true;
          _storeName = data['storeName'];
        });
        _startResendCooldown();

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('seller_email', email);

        _otpFocusNodes[0].requestFocus();

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.email_rounded, color: Colors.white, size: 18),
                ),
                const SizedBox(width: 12),
                const Text('OTP sent to your email', style: TextStyle(fontWeight: FontWeight.w600)),
              ],
            ),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            margin: const EdgeInsets.all(16),
          ));
        }
      } else {
        _showError(data['error'] ?? 'Failed to send OTP');
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
        final userCredential = await FirebaseAuth.instance.signInWithCustomToken(customToken);

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(StorageConstants.keyUserType, 'seller');
        await prefs.setString(StorageConstants.keyUserRole, 'seller');

        if (!mounted) return;

        // Load seller data and determine correct route directly
        final sellerProvider = Provider.of<SellerProvider>(context, listen: false);
        await sellerProvider.loadSeller(userCredential.user!.uid);
        
        if (!mounted) return;
        
        final seller = sellerProvider.currentSeller;
        String targetRoute = AppRoutes.sellerMain; // Default to dashboard
        
        if (seller != null) {
          // Check email verification
          if (!seller.emailVerified) {
            targetRoute = AppRoutes.verifyEmail;
          } else {
            // Check if KYC documents were actually submitted (panNumber is set by Cloud Function)
            final hasSubmittedKyc = seller.panNumber.isNotEmpty;
            
            // Check KYC status
            switch (seller.verificationStatus) {
              case VerificationStatus.verified:
                targetRoute = AppRoutes.sellerMain;
                break;
              case VerificationStatus.pending:
                // Show KYC status screen if KYC was submitted
                targetRoute = hasSubmittedKyc ? AppRoutes.kycStatus : AppRoutes.welcome;
                break;
              case VerificationStatus.rejected:
                targetRoute = AppRoutes.kycRejected;
                break;
              case VerificationStatus.suspended:
                targetRoute = AppRoutes.suspended;
                break;
              default:
                // Check if profile is complete
                final isProfileComplete = seller.storeName.isNotEmpty &&
                    seller.businessAddress.isNotEmpty &&
                    seller.businessCity.isNotEmpty;
                    
                if (!isProfileComplete || !hasSubmittedKyc) {
                  targetRoute = AppRoutes.welcome;
                } else {
                  targetRoute = AppRoutes.kycStatus;
                }
            }
          }
        } else {
          // No seller data found - this is a new seller, go to welcome/KYC
          targetRoute = AppRoutes.welcome;
        }

        // Navigate directly to the correct route (skip splash)
        Navigator.pushNamedAndRemoveUntil(
          context,
          targetRoute,
          (route) => false,
        );
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

  void _goBackToEmail() {
    setState(() {
      _otpSent = false;
      _errorMessage = null;
    });
    for (final c in _otpControllers) {
      c.clear();
    }
    _emailFocus.requestFocus();
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
      resizeToAvoidBottomInset: false, // Allow screen to scroll above keyboard
      extendBodyBehindAppBar: true, // Extend background behind status bar
      backgroundColor: isDark ? const Color(0xFF002c35) : const Color(0xFFF0F4F8),
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
  // MOBILE LAYOUT (< 600px)
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
                child: _buildLoginCard(
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
                SizedBox(height: isCompactHeight ? 20 : 60),
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
                      'LetBuyy\nSeller Portal',
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
                      'Business Management System',
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
                _buildLoginCard(
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
  // TABLET LAYOUT (600px - 1024px)
  // ═══════════════════════════════════════════════════════════════
  Widget _buildTabletLayout(bool isDark, ThemeData theme, bool isLandscape, double screenWidth) {
    final cardWidth = isLandscape ? 420.0 : math.min(480.0, screenWidth * 0.85);

    if (isLandscape) {
      return Row(
        children: [
          Expanded(flex: 5, child: _buildBrandingPanel(isDark, isCompact: true)),
          Expanded(
            flex: 5,
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(32),
                child: _buildLoginCard(
                  isDark: isDark,
                  theme: theme,
                  cardWidth: cardWidth,
                  cardPadding: 36,
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
            const SizedBox(height: 40),
            _buildLoginCard(
              isDark: isDark,
              theme: theme,
              cardWidth: cardWidth,
              cardPadding: 40,
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
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                    color: isDark ? Colors.white : Colors.grey[900],
                    letterSpacing: -0.5,
                  ),
                ),
                Text(
                  'Business Center',
                  style: TextStyle(
                    fontSize: 14,
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ],
        ).animate().fadeIn().slideY(begin: -0.2),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // DESKTOP LAYOUT (> 1024px)
  // ═══════════════════════════════════════════════════════════════
  Widget _buildDesktopLayout(bool isDark, ThemeData theme, bool isLargeDesktop, double screenWidth) {
    final brandingFlex = isLargeDesktop ? 5 : 4;
    final formFlex = isLargeDesktop ? 4 : 5;
    final cardWidth = isLargeDesktop ? 480.0 : 440.0;
    final cardPadding = isLargeDesktop ? 48.0 : 40.0;

    return Row(
      children: [
        Expanded(flex: brandingFlex, child: _buildBrandingPanel(isDark, isCompact: false)),
        Expanded(
          flex: formFlex,
          child: Center(
            child: SingleChildScrollView(
              padding: EdgeInsets.all(isLargeDesktop ? 60 : 40),
              child: _buildLoginCard(
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
                    boxShadow: [
                      BoxShadow(color: Colors.blueAccent.withValues(alpha: 0.15), blurRadius: 120, spreadRadius: 40),
                    ],
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
                    'LetBuyy\nSeller Portal',
                    style: TextStyle(
                      fontSize: isCompact ? 36 : 56,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      height: 1.1,
                      letterSpacing: -1.5,
                      fontFamily: 'Inter',
                    ),
                  ),
                ).animate().fadeIn(delay: 200.ms).slideX(begin: -0.3),
                SizedBox(height: isCompact ? 16 : 24),
                Text(
                  'Business Management System',
                  style: TextStyle(
                    fontSize: isCompact ? 14 : 16,
                    color: Colors.white.withValues(alpha: 0.7),
                    letterSpacing: 0.5,
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
  // LOGIN CARD (Responsive)
  // ═══════════════════════════════════════════════════════════════
  Widget _buildLoginCard({
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
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 40, offset: const Offset(0, 10)),
        ],
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
            _otpSent ? 'Verification' : 'Sign In',
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
                : (_storeName != null ? 'Welcome back, $_storeName' : 'Enter your credentials to proceed'),
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
            child: _otpSent ? _buildOTPSection(isDark, theme, fontSize) : _buildEmailSection(isDark, theme, fontSize),
          ),

          SizedBox(height: fontSize.spacing * 2),

          // Updated Footer - Text Link instead of Button
          Center(
            child: Wrap(
              alignment: WrapAlignment.center,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text("New to LetBuyy? ", style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600], fontSize: fontSize.caption)),
                GestureDetector(
                  onTap: () => Navigator.pushNamed(context, AppRoutes.signup),
                  child: Text(
                    "Create Account",
                    style: TextStyle(
                      color: theme.colorScheme.primary,
                      fontSize: fontSize.caption,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ).animate().fadeIn(delay: 200.ms),


          SizedBox(height: fontSize.spacing),

          Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.lock_outline_rounded, size: 14, color: isDark ? Colors.grey[600] : Colors.grey[400]),
                const SizedBox(width: 8),
                Text(
                  'End-to-End Encrypted',
                  style: TextStyle(color: isDark ? Colors.grey[600] : Colors.grey[400], fontSize: 12, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ).animate().fadeIn(delay: 300.ms),
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

  Widget _buildEmailSection(bool isDark, ThemeData theme, _FontSizes fontSize) {
    return Column(
      key: const ValueKey('email'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Professional Input Container (Polished)
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeInOut,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            color: isDark ? const Color(0xFF262626) : const Color(0xFFF9FAFB),
            border: Border.all(
              color: _emailFocused 
                  ? theme.colorScheme.primary 
                  : (isDark ? Colors.grey[800]! : Colors.grey[300]!),
              width: _emailFocused ? 1.5 : 1,
            ),
            boxShadow: _emailFocused ? [
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
              // Prefix Icon
              TweenAnimationBuilder<Color?>(
                duration: const Duration(milliseconds: 200),
                tween: ColorTween(
                  begin: Colors.grey[400],
                  end: _emailFocused ? theme.colorScheme.primary : Colors.grey[400],
                ),
                builder: (context, color, _) {
                  return Icon(
                    Icons.mail_outline_rounded,
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
                        color: _emailFocused ? theme.colorScheme.primary : Colors.grey[600],
                        fontSize: fontSize.caption,
                        fontWeight: FontWeight.w600,
                        fontFamily: 'Inter',
                      ),
                      child: const Text('Email Address'),
                    ),
                    const SizedBox(height: 4),
                    TextField(
                      controller: _emailController,
                      focusNode: _emailFocus,
                      keyboardType: TextInputType.emailAddress,
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
                        contentPadding: EdgeInsets.zero,
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        errorBorder: InputBorder.none,
                        disabledBorder: InputBorder.none,
                        hintText: 'name@business.com',
                        hintStyle: TextStyle(
                          color: isDark ? Colors.grey[600] : Colors.grey[400],
                          fontWeight: FontWeight.w400,
                        ),
                      ),
                      onSubmitted: (_) => _passwordFocus.requestFocus(),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        
        SizedBox(height: fontSize.spacing),
        
        // Password Field
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeInOut,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            color: isDark ? const Color(0xFF262626) : const Color(0xFFF9FAFB),
            border: Border.all(
              color: _passwordFocus.hasFocus 
                  ? theme.colorScheme.primary 
                  : (isDark ? Colors.grey[800]! : Colors.grey[300]!),
              width: _passwordFocus.hasFocus ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              Icon(
                Icons.lock_outline_rounded,
                color: _passwordFocus.hasFocus ? theme.colorScheme.primary : Colors.grey[400],
                size: fontSize.icon,
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Password',
                      style: TextStyle(
                        color: _passwordFocus.hasFocus ? theme.colorScheme.primary : Colors.grey[600],
                        fontSize: fontSize.caption,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    TextField(
                      controller: _passwordController,
                      focusNode: _passwordFocus,
                      obscureText: _obscurePassword,
                      style: TextStyle(
                        color: isDark ? Colors.white : Colors.grey[900],
                        fontSize: fontSize.input,
                        fontWeight: FontWeight.w600,
                      ),
                      decoration: InputDecoration(
                        isDense: true,
                        filled: false,
                        contentPadding: EdgeInsets.zero,
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        hintText: 'Enter your password',
                        hintStyle: TextStyle(
                          color: isDark ? Colors.grey[600] : Colors.grey[400],
                          fontWeight: FontWeight.w400,
                        ),
                      ),
                      onSubmitted: (_) => _loginWithPassword(),
                    ),
                  ],
                ),
              ),
              GestureDetector(
                onTap: () => setState(() => _obscurePassword = !_obscurePassword),
                child: Icon(
                  _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                  color: Colors.grey[400],
                  size: fontSize.icon,
                ),
              ),
            ],
          ),
        ),
        
        SizedBox(height: fontSize.spacing * 0.5),
        
        // Forgot Password Link
        Align(
          alignment: Alignment.centerRight,
          child: GestureDetector(
            onTap: () => Navigator.pushNamed(context, AppRoutes.forgotPassword),
            child: Text(
              'Forgot Password?',
              style: TextStyle(
                color: theme.colorScheme.primary,
                fontSize: fontSize.caption,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
        
        SizedBox(height: fontSize.spacing * 1.5),
        _buildProfessionalButton(
          onPressed: _isLoading ? null : _loginWithPassword,
          isLoading: _isLoading,
          label: 'Login',
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
            onTap: () => setState(() => _otpSent = false),
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.arrow_back, size: 16, color: isDark ? Colors.grey[400] : Colors.grey[600]),
                  const SizedBox(width: 4),
                  Text('Back', style: TextStyle(fontSize: fontSize.caption, color: isDark ? Colors.grey[400] : Colors.grey[600])),
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
          label: 'Verify Access',
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
          backgroundColor: const Color(0xFF111827), // Professional Dark
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
                  ? [AppColors.primary.withValues(alpha: 0.15), const Color(0xFF002c35), const Color(0xFF002c35)]
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
      Positioned(
        bottom: -size.height * 0.15,
        left: -size.width * 0.15,
        child: AnimatedBuilder(
          animation: _floatController,
          builder: (context, _) {
            return Transform.translate(
              offset: Offset(_floatController.value * 20, 0),
              child: Container(
                width: size.width * 0.35,
                height: size.width * 0.35,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [Colors.cyan.withValues(alpha: 0.2), Colors.transparent],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    ];
  }
}

// ═══════════════════════════════════════════════════════════════
// RESPONSIVE FONT SIZES
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
