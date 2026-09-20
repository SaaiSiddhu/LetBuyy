// lib/screens/auth/reset_password_screen.dart
// 🔐 ULTRA-RESPONSIVE SELLER RESET PASSWORD SCREEN
// ✨ Matches Admin/Seller Login Design Exactly (Pixel-Perfect)
// 📱 Responsive breakpoints: Mobile < 600, Tablet 600-1024, Desktop > 1024, Large > 1440

import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_animate/flutter_animate.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../app/routes.dart';

class ResetPasswordScreen extends StatefulWidget {
  final String? token;
  final String? uid;

  const ResetPasswordScreen({super.key, this.token, this.uid});

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> with TickerProviderStateMixin {
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _passwordFocus = FocusNode();
  final _confirmPasswordFocus = FocusNode();
  
  // Animation controllers
  late AnimationController _bgAnimController;
  late AnimationController _pulseController;
  late AnimationController _floatController;
  late AnimationController _shimmerController;

  bool _isLoading = false;
  bool _resetSuccess = false;
  bool _verifyingToken = true;
  bool _tokenValid = false;
  bool _passwordFocused = false;
  bool _confirmPasswordFocused = false;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  String? _errorMessage;

  static const String _functionsBaseUrl = 'https://us-central1-letbuy-y.cloudfunctions.net';

  // Responsive breakpoints matching Admin
  static const double _mobileBreakpoint = 600;
  static const double _tabletBreakpoint = 1024;
  static const double _desktopBreakpoint = 1440;

  @override
  void initState() {
    super.initState();
    _passwordFocus.addListener(() => setState(() => _passwordFocused = _passwordFocus.hasFocus));
    _confirmPasswordFocus.addListener(() => setState(() => _confirmPasswordFocused = _confirmPasswordFocus.hasFocus));
    _initAnimations();
    _verifyToken();
    
    // Set status bar to transparent
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      statusBarBrightness: Brightness.light,
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

  Future<void> _verifyToken() async {
    // If no token provided in constructor, check URL parameters or routing arguments
    // For now assume they are passed correctly via onGenerateRoute
    
    if (widget.token == null || widget.uid == null) {
      // In web, might parse from URL if not passed differently
      // Skipping complex URL parsing here, relying on router injection
      setState(() {
        _verifyingToken = false;
        _tokenValid = false;
        _errorMessage = "Invalid password reset link.";
      });
      return;
    }

    try {
      final response = await http.post(
        Uri.parse('$_functionsBaseUrl/verifySellerResetToken'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'token': widget.token,
          'sellerId': widget.uid,
        }),
      );

      final data = json.decode(response.body);

      if (mounted) {
        setState(() {
          _verifyingToken = false;
          if (response.statusCode == 200 && data['success'] == true) {
            _tokenValid = true;
          } else {
            _tokenValid = false;
            _errorMessage = data['error'] ?? "Link expired or invalid.";
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _verifyingToken = false;
          _tokenValid = false;
          _errorMessage = "Unable to verify link. Network error.";
        });
      }
    }
  }

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _passwordFocus.dispose();
    _confirmPasswordFocus.dispose();
    _bgAnimController.dispose();
    _pulseController.dispose();
    _floatController.dispose();
    _shimmerController.dispose();
    super.dispose();
  }

  Future<void> _resetPassword() async {
    final password = _passwordController.text;
    final confirmPassword = _confirmPasswordController.text;

    if (password.length < 6) {
      _showError('Password must be at least 6 characters');
      return;
    }

    if (password != confirmPassword) {
      _showError('Passwords do not match');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await http.post(
        Uri.parse('$_functionsBaseUrl/resetSellerPassword'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'token': widget.token,
          'sellerId': widget.uid,
          'newPassword': password,
        }),
      );

      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        setState(() {
          _resetSuccess = true;
        });
        
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
                  child: const Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
                ),
                const SizedBox(width: 12),
                const Text('Password changed successfully!', style: TextStyle(fontWeight: FontWeight.w600)),
              ],
            ),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            margin: const EdgeInsets.all(16),
          ));
        }
      } else {
        _showError(data['error'] ?? 'Failed to reset password');
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

  @override
  Widget build(BuildContext context) {
    var l10n = AppLocalizations.of(context);
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
      extendBodyBehindAppBar: true,
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
              l10n: l10n,
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
    required AppLocalizations? l10n,
  }) {
    if (isMobile) return _buildMobileLayout(isDark, theme, isLandscape, isCompactHeight, l10n);
    if (isTablet) return _buildTabletLayout(isDark, theme, isLandscape, screenWidth, l10n);
    return _buildDesktopLayout(isDark, theme, isLargeDesktop, screenWidth, l10n);
  }

  // ═══════════════════════════════════════════════════════════════
  // MOBILE LAYOUT
  // ═══════════════════════════════════════════════════════════════
  Widget _buildMobileLayout(bool isDark, ThemeData theme, bool isLandscape, bool isCompactHeight, AppLocalizations? l10n) {
    if (isLandscape) {
      return Row(
        children: [
          Expanded(flex: 4, child: _buildMobileBrandingCompact(isDark)),
          Expanded(
            flex: 6,
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: _buildResetCard(
                  isDark: isDark,
                  theme: theme,
                  cardWidth: double.infinity,
                  cardPadding: 24,
                  l10n: l10n,
                ),
              ),
            ),
          ),
        ],
      );
    }

    // Portrait layout - MATCHING LOGIN SCREEN EXACTLY
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
                // Branding section - MATCHES LOGIN
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
                // Card with form - MATCHES LOGIN CARD STRUCTURE
                _buildResetCard(
                  isDark: isDark,
                  theme: theme,
                  cardWidth: double.infinity,
                  cardPadding: 24,
                  l10n: l10n,
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
  Widget _buildTabletLayout(bool isDark, ThemeData theme, bool isLandscape, double screenWidth, AppLocalizations? l10n) {
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
                child: _buildResetCard(
                  isDark: isDark,
                  theme: theme,
                  cardWidth: cardWidth,
                  cardPadding: 36,
                  l10n: l10n,
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
            _buildResetCard(
              isDark: isDark,
              theme: theme,
              cardWidth: cardWidth,
              cardPadding: 40,
              l10n: l10n,
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
                  'Reset Verification',
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
  // DESKTOP LAYOUT
  // ═══════════════════════════════════════════════════════════════
  Widget _buildDesktopLayout(bool isDark, ThemeData theme, bool isLargeDesktop, double screenWidth, AppLocalizations? l10n) {
    final brandingFlex = isLargeDesktop ? 5 : 4;
    final formFlex = isLargeDesktop ? 4 : 5;
    final cardWidth = isLargeDesktop ? 480.0 : 440.0;

    return Row(
      children: [
        Expanded(flex: brandingFlex, child: _buildBrandingPanel(isDark, isCompact: false)),
        Expanded(
          flex: formFlex,
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(vertical: 40),
              child: _buildResetCard(
                isDark: isDark,
                theme: theme,
                cardWidth: cardWidth,
                cardPadding: 48,
                l10n: l10n,
              ),
            ),
          ),
        ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // BRANDING PANEL (LEFT SIDE)
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
          // Background pattern
          Positioned.fill(
            child: Opacity(
              opacity: 0.1,
              child: CustomPaint(painter: _GridPatternPainter(isDark: true)), // Always dark pattern on gradient
            ),
          ),
          
          if (!isCompact) ...[
            Positioned(
              top: 100,
              right: 80,
              child: _buildFloatingCard(
                icon: Icons.shield_rounded,
                title: 'Protected',
                subtitle: 'Secure Reset',
                delay: 0,
              ),
            ),
            Positioned(
              bottom: 120,
              left: 60,
              child: _buildFloatingCard(
                icon: Icons.lock_clock_rounded,
                title: 'Expiring Link',
                subtitle: 'Time Sensitive',
                delay: 1500,
              ),
            ),
          ],

          // Centers content
          Center(
            child: Padding(
              padding: const EdgeInsets.all(40),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Image.asset(
                        'assets/icons/app_icon.png',
                        width: isCompact ? 60 : 80,
                        height: isCompact ? 60 : 80,
                      )
                    ),
                  ).animate().fadeIn().scale(),
                  const SizedBox(height: 32),
                  Text(
                    'LetBuyy\nSeller Portal',
                    style: TextStyle(
                      fontSize: isCompact ? 36 : 48,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                      height: 1.1,
                      letterSpacing: -1.0,
                    ),
                  ).animate().fadeIn(delay: 200.ms).slideX(begin: -0.1),
                  const SizedBox(height: 24),
                  Text(
                    'Create a new password.\nMake it strong and memorable\nto secure your business.',
                    style: TextStyle(
                      fontSize: isCompact ? 16 : 18,
                      color: Colors.white70,
                      height: 1.6,
                      fontWeight: FontWeight.w500,
                    ),
                  ).animate().fadeIn(delay: 400.ms),
                ],
              ),
            ),
          ),

          // Footer
          Positioned(
            bottom: 32,
            left: 40,
            child: Text(
              '© ${DateTime.now().year} LetBuyy Corp',
              style: const TextStyle(color: Colors.white30, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFloatingCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required int delay,
  }) {
    return AnimatedBuilder(
      animation: _floatController,
      builder: (context, child) {
        return Transform.translate(
          offset: Offset(0, math.sin(_floatController.value * 2 * math.pi + delay) * 10),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.1),
                  blurRadius: 20,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, color: Colors.white, size: 20),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                    Text(
                      subtitle,
                      style: const TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // CARD & FORM UI - MATCHES LOGIN SCREEN EXACTLY
  // ═══════════════════════════════════════════════════════════════
  Widget _buildResetCard({
    required bool isDark,
    required ThemeData theme,
    required double cardWidth,
    required double cardPadding,
    required AppLocalizations? l10n,
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
          if (_verifyingToken) ...[
            Center(
              child: Column(
                children: [
                  const CircularProgressIndicator(),
                  const SizedBox(height: 24),
                  Text(
                    'Verifying link...',
                    style: TextStyle(
                      fontSize: 16,
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ] else if (!_tokenValid) ...[
            Center(
              child: Column(
                children: [
                  Icon(Icons.broken_image_outlined, size: 60, color: Colors.grey[400]),
                  const SizedBox(height: 16),
                  Text(
                    'Invalid Link',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: isDark ? Colors.white : Colors.grey[900],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _errorMessage ?? 'This reset link is invalid or expired.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                    ),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    height: 52,
                    child: ElevatedButton(
                      onPressed: () => Navigator.pushReplacementNamed(context, AppRoutes.forgotPassword),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF111827),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Request New Link', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                    ),
                  ),
                ],
              ),
            ),
          ] else if (_resetSuccess) ...[
            _buildSuccessState(theme, isDark, l10n)
          ] else ...[
            // Header INSIDE card - MATCHES LOGIN
            Text(
              'Reset Password',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: isDark ? Colors.white : const Color(0xFF111827),
                letterSpacing: -0.5,
              ),
              textAlign: TextAlign.center,
            ).animate().fadeIn(),
            
            const SizedBox(height: 8),
            
            Text(
              'Enter your new password below',
              style: TextStyle(
                fontSize: 14,
                color: isDark ? Colors.grey[400] : const Color(0xFF6B7280),
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ).animate().fadeIn(delay: 100.ms),

            const SizedBox(height: 24),

            // Error Message
            if (_errorMessage != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: AppColors.error.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.error.withValues(alpha: 0.2)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.error_outline_rounded, color: AppColors.error, size: 18),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        _errorMessage!,
                        style: TextStyle(color: AppColors.error, fontSize: 13, fontWeight: FontWeight.w500),
                      ),
                    ),
                  ],
                ),
              ).animate().fadeIn().shake(),

            // New Password Field - MATCHES LOGIN INPUT STYLE
            _buildPasswordField(isDark, theme, 'New Password', _passwordController, _passwordFocus, _obscurePassword, (val) => setState(() => _obscurePassword = val), _passwordFocused),
            const SizedBox(height: 16),
            
            // Confirm Password Field
            _buildPasswordField(isDark, theme, 'Confirm Password', _confirmPasswordController, _confirmPasswordFocus, _obscureConfirmPassword, (val) => setState(() => _obscureConfirmPassword = val), _confirmPasswordFocused),
            
            const SizedBox(height: 20),
            
            // Button - DARK COLOR MATCHING LOGIN
            SizedBox(
              height: 52,
              child: ElevatedButton(
                onPressed: _isLoading ? null : _resetPassword,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF111827), // Professional Dark - MATCHES LOGIN
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: EdgeInsets.zero,
                ),
                child: _isLoading
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation<Color>(Colors.white)))
                    : const Text('Reset Password', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, letterSpacing: 0.2)),
              ),
            ),
            
            const SizedBox(height: 20),
            
            // Back to Login link - MATCHES LOGIN STYLE
            Center(
              child: Wrap(
                alignment: WrapAlignment.center,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text("Remember your password? ", style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600], fontSize: 13)),
                  GestureDetector(
                    onTap: () => Navigator.pushReplacementNamed(context, AppRoutes.login),
                    child: Text(
                      "Back to Login",
                      style: TextStyle(
                        color: theme.colorScheme.primary,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ).animate().fadeIn(delay: 200.ms),

            const SizedBox(height: 16),

            // End-to-End Encrypted - MATCHES LOGIN
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
        ],
      ),
    ).animate().fadeIn().slideY(begin: 0.1);
  }

  Widget _buildPasswordField(
    bool isDark, 
    ThemeData theme, 
    String label, 
    TextEditingController controller,
    FocusNode focusNode,
    bool obscure,
    Function(bool) onVisibilityChanged,
    bool isFocused
  ) {
    // Password Field - MATCHES LOGIN INPUT STYLE EXACTLY
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
          // Prefix Icon
          TweenAnimationBuilder<Color?>(
            duration: const Duration(milliseconds: 200),
            tween: ColorTween(
              begin: Colors.grey[400],
              end: isFocused ? theme.colorScheme.primary : Colors.grey[400],
            ),
            builder: (context, color, _) {
              return Icon(
                Icons.lock_outline_rounded,
                color: color,
                size: 20,
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
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    fontFamily: 'Inter',
                  ),
                  child: Text(label),
                ),
                const SizedBox(height: 4),
                TextField(
                  controller: controller,
                  focusNode: focusNode,
                  obscureText: obscure,
                  style: TextStyle(
                    color: isDark ? Colors.white : Colors.grey[900],
                    fontSize: 15,
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
                    hintText: '••••••••',
                    hintStyle: TextStyle(
                      color: isDark ? Colors.grey[600] : Colors.grey[400],
                      fontWeight: FontWeight.w400,
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          // Visibility Toggle
          GestureDetector(
            onTap: () => onVisibilityChanged(!obscure),
            child: Icon(
              obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined,
              color: Colors.grey[400],
              size: 20,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSuccessState(ThemeData theme, bool isDark, AppLocalizations? l10n) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: AppColors.success.withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Container(
              width: 50,
              height: 50,
              decoration: const BoxDecoration(
                color: AppColors.success,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_rounded, color: Colors.white, size: 30),
            ).animate().scale(delay: 200.ms, curve: Curves.elasticOut),
          ),
        ).animate().fadeIn(),
        
        const SizedBox(height: 24),
        
        Text(
          'Password Reset',
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w800,
            color: isDark ? Colors.white : Colors.grey[900],
          ),
        ).animate().fadeIn(delay: 300.ms).slideY(begin: 0.2),
        
        const SizedBox(height: 12),
        
        Text(
          'Your password has been successfully reset.\nYou can now login with your new password.',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 15,
            color: isDark ? Colors.grey[400] : Colors.grey[600],
            height: 1.5,
          ),
        ).animate().fadeIn(delay: 400.ms),
        
        const SizedBox(height: 32),
        
        SizedBox(
          width: double.infinity,
          height: 56,
          child: ElevatedButton(
            onPressed: () => Navigator.pushReplacementNamed(context, AppRoutes.login),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              elevation: 8,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              padding: EdgeInsets.zero,
            ),
            child: const Text('Back to Login', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          ),
        ),
      ],
    );
  }
  // ═══════════════════════════════════════════════════════════════
  // BACKGROUND ANIMATIONS - MATCHES LOGIN EXACTLY
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
// GRID PATTERN PAINTER - MATCHES LOGIN EXACTLY
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
