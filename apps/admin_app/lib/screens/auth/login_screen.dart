// lib/screens/auth/login_screen.dart
// 🔐 ULTRA-RESPONSIVE ADMIN OTP LOGIN SCREEN
// ✨ Cross-platform: Mobile, Web, macOS, Windows, Linux
// 📱 Responsive breakpoints: Mobile < 600, Tablet 600-1024, Desktop > 1024, Large > 1440

import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:go_router/go_router.dart';
import 'package:google_sign_in/google_sign_in.dart';

import 'package:letbuyy_marketplace_core/letbuyy_marketplace_core.dart';

import '../../app/app_router.dart';
import '../../app/themes/app_colors.dart';

class LoginScreen extends StatefulWidget {
  /// Whether to show OTP verification screen (from URL /login/verify)
  final bool showOtp;
  /// Email from URL query param (for OTP screen)
  final String? email;
  /// Whether 2FA is required (from URL query param)
  final bool is2FA;

  const LoginScreen({
    super.key,
    this.showOtp = false,
    this.email,
    this.is2FA = false,
  });

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with TickerProviderStateMixin {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _totpController = TextEditingController();
  final _emailFocus = FocusNode();
  final _passwordFocus = FocusNode();
  final _totpFocus = FocusNode();
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
  bool _passwordFocused = false;
  bool _is2FAEnabled = false;  // Whether TOTP is required
  String? _errorMessage;
  int _resendCooldown = 0;
  Timer? _resendTimer;
  // ignore: unused_field - reserved for Google sign-in flow
  bool _isGoogleSignIn = false;
  bool _isGoogleLoading = false; // Loading state for Google Sign-In
  bool _rememberMe = false; // Remember me checkbox state
  bool _showPassword = false; // Password visibility toggle

  static const String _functionsBaseUrl = 'https://us-central1-letbuy-y.cloudfunctions.net';
  // Google Sign-In Web Client ID
  static const String _googleClientId = '468123057306-jtpkd5st5e14nrf466n4717rsvorohtb.apps.googleusercontent.com';

  // Responsive breakpoints
  static const double _mobileBreakpoint = 600;
  static const double _tabletBreakpoint = 1024;

  @override
  void initState() {
    super.initState();
    
    // Initialize from URL params if coming from /login/verify route
    if (widget.showOtp && widget.email != null && widget.email!.isNotEmpty) {
      _emailController.text = widget.email!;
      _otpSent = true;
      _is2FAEnabled = widget.is2FA;
      // Focus first OTP field after build
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _otpFocusNodes[0].requestFocus();
      });
    }
    
    _emailFocus.addListener(_onFocusChange);
    _passwordFocus.addListener(() => setState(() => _passwordFocused = _passwordFocus.hasFocus));
    _totpFocus.addListener(_onFocusChange);
    for (final focusNode in _otpFocusNodes) {
      focusNode.addListener(_onFocusChange);
    }
    _loadSavedEmail();
    _initAnimations();
  }

  void _onFocusChange() {
    if (mounted) {
      setState(() => _emailFocused = _emailFocus.hasFocus);
    }
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
    // Remove focus listeners before disposing
    _emailFocus.removeListener(_onFocusChange);
    for (final focusNode in _otpFocusNodes) {
      focusNode.removeListener(_onFocusChange);
    }
    
    _emailController.dispose();
    _passwordController.dispose();
    _totpController.dispose();
    _emailFocus.dispose();
    _passwordFocus.dispose();
    _totpFocus.dispose();
    for (final c in _otpControllers) { c.dispose(); }
    for (final f in _otpFocusNodes) { f.dispose(); }
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
      final savedEmail = prefs.getString('admin_email');
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

  Future<void> _sendOTP() async {
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
        Uri.parse('$_functionsBaseUrl/sendAdminLoginOTP'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'email': email,
          'password': password,  // Now includes password
        }),
      );

      final data = json.decode(response.body);
      
      if (response.statusCode == 200 && data['success'] == true) {
        final is2FA = data['is2FAEnabled'] == true;
        
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('admin_email', email);
        
        _startResendCooldown();
        
        if (mounted) {
          // Show success message
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
                Text(
                  is2FA 
                    ? 'OTP sent! Enter OTP + Authenticator code'
                    : 'OTP sent to your email',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ],
            ),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            margin: const EdgeInsets.all(16),
          ));
          
          // Navigate to verify URL with query params
          final verifyUrl = '${AppRouter.login}/verify?email=${Uri.encodeComponent(email)}&2fa=$is2FA';
          debugPrint('🚀 Navigating to: $verifyUrl');
          context.replace(verifyUrl); // Use replace to avoid browser history issues
        }
      } else {
        // Handle error with more detail
        debugPrint('❌ OTP Send failed: ${response.statusCode} - ${response.body}');
        final errorMsg = data['error'] ?? 'Failed to send OTP (${response.statusCode})';
        _showError(errorMsg);
      }
    } catch (e) {
      debugPrint('❌ OTP Send exception: $e');
      _showError('Network error: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  /// Sign in with Google and send OTP
  /// This bypasses email/password but still requires OTP verification
  Future<void> _signInWithGoogleAndSendOTP() async {
    setState(() {
      _isGoogleLoading = true;
      _errorMessage = null;
    });

    try {
      // Initialize Google Sign-In with client ID for web
      final GoogleSignIn googleSignIn = GoogleSignIn(
        clientId: kIsWeb ? _googleClientId : null,
        scopes: ['email'],
      );

      // Sign in with Google
      final GoogleSignInAccount? googleUser = await googleSignIn.signIn();
      
      if (googleUser == null) {
        // User cancelled the sign-in
        if (mounted) setState(() => _isGoogleLoading = false);
        return;
      }

      // Get Google authentication details
      final GoogleSignInAuthentication googleAuth = await googleUser.authentication;
      
      // Create Firebase credential
      final AuthCredential credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      // Sign in to Firebase with Google credential
      final UserCredential userCredential = await FirebaseAuth.instance.signInWithCredential(credential);
      
      // Get the Firebase ID token (not the Google ID token)
      final String? firebaseIdToken = await userCredential.user?.getIdToken();
      
      if (firebaseIdToken == null) {
        throw Exception('Failed to get Firebase ID token');
      }

      // Update email controller with Google email
      _emailController.text = googleUser.email;

      // Call Cloud Function to verify admin status and send OTP
      final response = await http.post(
        Uri.parse('$_functionsBaseUrl/sendAdminLoginOTPWithGoogle'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'idToken': firebaseIdToken}),
      );

      final data = json.decode(response.body);
      
      if (response.statusCode == 200 && data['success'] == true) {
        final is2FA = data['is2FAEnabled'] == true;
        _isGoogleSignIn = true;  // Track that this was Google Sign-In
        
        _startResendCooldown();
        
        if (mounted) {
          // Show success message
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Row(
              children: [
                const Icon(Icons.check_circle, color: Colors.white, size: 20),
                const SizedBox(width: 12),
                Expanded(child: Text('Verified via Google! OTP sent to ${googleUser.email}')),
              ],
            ),
            backgroundColor: Colors.green.shade600,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            margin: const EdgeInsets.all(16),
          ));
          
          // Navigate to verify URL with query params
          context.replace('${AppRouter.login}/verify?email=${Uri.encodeComponent(googleUser.email)}&2fa=$is2FA'); // Use replace
        }
      } else {
        // If admin verification fails, sign out from Firebase
        await FirebaseAuth.instance.signOut();
        await googleSignIn.signOut();
        _showError(data['error'] ?? 'Admin verification failed');
      }
    } catch (e) {
      debugPrint('Google Sign-In error: $e');
      // Sign out on error to clean up
      try {
        await FirebaseAuth.instance.signOut();
      } catch (_) {}
      _showError('Google Sign-In failed. Please try again.');
    } finally {
      if (mounted) setState(() => _isGoogleLoading = false);
    }
  }

  /// Paste OTP from clipboard
  Future<void> _pasteFromClipboard() async {
    try {
      final data = await Clipboard.getData(Clipboard.kTextPlain);
      if (data?.text != null) {
        final otp = data!.text!.replaceAll(RegExp(r'\D'), ''); // Keep only digits
        if (otp.length >= 6) {
          _pasteOTP(otp.substring(0, 6));
        } else if (otp.isNotEmpty) {
          _showError('Clipboard does not contain a valid 6-digit code');
        }
      }
    } catch (e) {
      debugPrint('Paste error: $e');
    }
  }
  
  /// Distribute OTP digits to individual fields
  void _pasteOTP(String otp) {
    if (otp.length != 6) return;
    
    for (int i = 0; i < 6; i++) {
      _otpControllers[i].text = otp[i];
    }
    
    // Focus last field
    _otpFocusNodes[5].requestFocus();
    setState(() {});
    
    // Auto-verify
    _verifyOTP();
  }

  Future<void> _verifyOTP() async {
    final otp = _otpControllers.map((c) => c.text).join();
    if (otp.length != 6) {
      _showError('Please enter complete 6-digit OTP');
      return;
    }
    
    // Check TOTP if 2FA is enabled
    final totpCode = _totpController.text.trim();
    if (_is2FAEnabled && totpCode.length != 6) {
      _showError('Please enter your 6-digit authenticator code');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final requestBody = {
        'email': _emailController.text.trim(),
        'otp': otp,
      };
      
      // Include TOTP code if 2FA is enabled
      if (_is2FAEnabled && totpCode.isNotEmpty) {
        requestBody['totpCode'] = totpCode;
      }
      
      final response = await http.post(
        Uri.parse('$_functionsBaseUrl/verifyAdminOTP'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(requestBody),
      );

      final data = json.decode(response.body);
      
      if (response.statusCode == 200 && data['success'] == true) {
        final customToken = data['customToken'];
        await FirebaseAuth.instance.signInWithCustomToken(customToken);
        
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(StorageConstants.keyUserType, 'admin');
        await prefs.setString(StorageConstants.keyUserRole, 'admin');
        
        if (!mounted) return;
        
        // Use go_router for proper URL-based navigation
        context.replace(AppRouter.dashboard); // Use replace for final navigation
      } else {
        // Check if 2FA is required but not provided
        if (data['requires2FA'] == true) {
          setState(() => _is2FAEnabled = true);
          _showError('Please enter your authenticator code');
        } else {
          _showError(data['error'] ?? 'Invalid OTP');
          for (final c in _otpControllers) { c.clear(); }
          _totpController.clear();
          _otpFocusNodes[0].requestFocus();
        }
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
        Uri.parse('$_functionsBaseUrl/resendAdminOTP'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'email': _emailController.text.trim()}),
      );

      final data = json.decode(response.body);
      
      if (response.statusCode == 200 && data['success'] == true) {
        _startResendCooldown();
        for (final c in _otpControllers) { c.clear(); }
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
      _is2FAEnabled = false;
    });
    for (final c in _otpControllers) { c.clear(); }
    _totpController.clear();
    _passwordController.clear();
    _emailFocus.requestFocus();
  }
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
      child: Scaffold(
        resizeToAvoidBottomInset: false,
        body: LayoutBuilder(
          builder: (context, constraints) {
            // Use LayoutBuilder constraints instead of MediaQuery
            final screenWidth = constraints.maxWidth;
            final screenHeight = constraints.maxHeight;
            final isMobile = screenWidth < _mobileBreakpoint;
            final isTablet = screenWidth >= _mobileBreakpoint && screenWidth < _tabletBreakpoint;
            
            double cardWidth = isMobile ? screenWidth - 32 : (isTablet ? 380 : 400);
            double cardPadding = isMobile ? 20 : 28;
            
            return Container(
              width: double.infinity,
              height: double.infinity,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    const Color(0xFFF0F7F8),
                    AppColors.background,
                    const Color(0xFFF5F9FA),
                  ],
                  stops: const [0.0, 0.5, 1.0],
                ),
              ),
              child: Column(
                children: [
                  Expanded(
                    child: SafeArea(
                      child: Center(
                        child: SingleChildScrollView(
                          physics: const ClampingScrollPhysics(),
                          child: Padding(
                            padding: EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: isMobile ? 12 : 24,
                            ),
                            child: ConstrainedBox(
                              constraints: BoxConstraints(
                                maxWidth: isMobile ? double.infinity : 400,
                              ),
                              child: _buildLightLoginCard(
                                cardWidth: cardWidth,
                                cardPadding: cardPadding,
                                isMobile: isMobile,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
  
  // Build floating orbs for background
  List<Widget> _buildFloatingOrbs(double screenWidth, double screenHeight) {
    return [
      // Top-right large orb
      AnimatedBuilder(
        animation: _bgAnimController,
        builder: (context, child) {
          return Positioned(
            top: -80 + (20 * math.sin(_bgAnimController.value * 2 * math.pi)),
            right: -60 + (15 * math.cos(_bgAnimController.value * 2 * math.pi)),
            child: child!,
          );
        },
        child: Container(
          width: 280,
          height: 280,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              colors: [
                AppColors.primary.withValues(alpha: 0.12),
                AppColors.primary.withValues(alpha: 0.04),
                Colors.transparent,
              ],
              stops: const [0.0, 0.5, 1.0],
            ),
          ),
        ),
      ),
      
      // Bottom-left large orb
      AnimatedBuilder(
        animation: _bgAnimController,
        builder: (context, child) {
          return Positioned(
            bottom: -100 + (25 * math.cos(_bgAnimController.value * 2 * math.pi)),
            left: -100 + (20 * math.sin(_bgAnimController.value * 2 * math.pi)),
            child: child!,
          );
        },
        child: Container(
          width: 320,
          height: 320,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              colors: [
                AppColors.primaryLight.withValues(alpha: 0.15),
                AppColors.primaryLight.withValues(alpha: 0.05),
                Colors.transparent,
              ],
              stops: const [0.0, 0.4, 1.0],
            ),
          ),
        ),
      ),
      
      // Center-right medium orb
      AnimatedBuilder(
        animation: _bgAnimController,
        builder: (context, child) {
          return Positioned(
            top: screenHeight * 0.4 + (30 * math.sin(_bgAnimController.value * 2 * math.pi + 1)),
            right: -40 + (18 * math.cos(_bgAnimController.value * 2 * math.pi + 1)),
            child: child!,
          );
        },
        child: Container(
          width: 180,
          height: 180,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              colors: [
                AppColors.primary.withValues(alpha: 0.08),
                Colors.transparent,
              ],
            ),
          ),
        ),
      ),
      
      // Top-left small orb
      AnimatedBuilder(
        animation: _bgAnimController,
        builder: (context, child) {
          return Positioned(
            top: screenHeight * 0.15 + (15 * math.cos(_bgAnimController.value * 2 * math.pi + 2)),
            left: screenWidth * 0.1 + (10 * math.sin(_bgAnimController.value * 2 * math.pi + 2)),
            child: child!,
          );
        },
        child: Container(
          width: 100,
          height: 100,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              colors: [
                AppColors.primaryLight.withValues(alpha: 0.1),
                Colors.transparent,
              ],
            ),
          ),
        ),
      ),
      
      // Bottom-right small orb
      AnimatedBuilder(
        animation: _bgAnimController,
        builder: (context, child) {
          return Positioned(
            bottom: screenHeight * 0.2 + (20 * math.sin(_bgAnimController.value * 2 * math.pi + 3)),
            right: screenWidth * 0.15 + (12 * math.cos(_bgAnimController.value * 2 * math.pi + 3)),
            child: child!,
          );
        },
        child: Container(
          width: 120,
          height: 120,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              colors: [
                AppColors.primary.withValues(alpha: 0.06),
                Colors.transparent,
              ],
            ),
          ),
        ),
      ),
    ];
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PROFESSIONAL COMPACT LOGIN CARD
  // ═══════════════════════════════════════════════════════════════
  Widget _buildLightLoginCard({
    required double cardWidth,
    required double cardPadding,
    required bool isMobile,
  }) {
    return Container(
      width: cardWidth,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: Colors.grey.shade200,
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.04),
            blurRadius: 40,
            offset: const Offset(0, 16),
          ),
        ],
      ),
      child: Padding(
        padding: EdgeInsets.all(cardPadding),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Compact Logo & Header (only on email section, not OTP)
            if (!_otpSent) ...[
              _buildLightHeader(isMobile),
              SizedBox(height: isMobile ? 20 : 24),
            ],
            
            // Form Content
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 300),
              child: _otpSent
                  ? _buildLightOTPSection()
                  : _buildLightEmailSection(isMobile),
            ),
            
            // Error Message
            if (_errorMessage != null) ...[
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.error.withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.error.withValues(alpha: 0.15)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.error_outline, color: AppColors.error, size: 18),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        _errorMessage!,
                        style: TextStyle(
                          color: AppColors.error,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
  
  // ═══════════════════════════════════════════════════════════════
  // COMPACT PROFESSIONAL HEADER
  // ═══════════════════════════════════════════════════════════════
  Widget _buildLightHeader(bool isMobile) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Compact horizontal logo + title
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Smaller App Logo
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.15),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.asset(
                  'assets/icons/app_icon.png',
                  fit: BoxFit.cover,
                ),
              ),
            ),
            const SizedBox(width: 12),
            
            // Title + Subtitle Column
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'LetBuyy Admin',
                  style: TextStyle(
                    fontSize: isMobile ? 20 : 22,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                    letterSpacing: -0.3,
                  ),
                ),
                Text(
                  'Commerce Control Panel',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textSecondary,
                    letterSpacing: 0.2,
                  ),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PROFESSIONAL EMAIL/PASSWORD SECTION
  // ═══════════════════════════════════════════════════════════════
  Widget _buildLightEmailSection(bool isMobile) {
    return Column(
      key: const ValueKey('email-section'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Google Sign In Button (Primary method)
        _buildGoogleButton(),
        
        const SizedBox(height: 20),
        
        // OR Divider - more subtle
        Row(
          children: [
            Expanded(child: Divider(color: Colors.grey.shade300, thickness: 0.5)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Text(
                'or continue with email',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textHint,
                ),
              ),
            ),
            Expanded(child: Divider(color: Colors.grey.shade300, thickness: 0.5)),
          ],
        ),
        
        const SizedBox(height: 18),
        
        // Email Input
        _buildLightInput(
          controller: _emailController,
          focusNode: _emailFocus,
          label: 'Email Address',
          hint: 'admin@letbuyy.com',
          icon: Icons.mail_outline_rounded,
          isFocused: _emailFocused,
          keyboardType: TextInputType.emailAddress,
          onSubmitted: (_) => _passwordFocus.requestFocus(),
        ),
        
        const SizedBox(height: 10),
        
        // Password Input
        _buildLightInput(
          controller: _passwordController,
          focusNode: _passwordFocus,
          label: 'Password',
          hint: 'Enter your password',
          icon: Icons.lock_outline_rounded,
          isFocused: _passwordFocused,
          obscureText: !_showPassword,
          suffix: IconButton(
            icon: Icon(
              _showPassword ? Icons.visibility_rounded : Icons.visibility_off_rounded,
              color: Colors.grey[400],
              size: 18,
            ),
            onPressed: () => setState(() => _showPassword = !_showPassword),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),
          onSubmitted: (_) => _sendOTP(),
        ),
        
        const SizedBox(height: 14),
        
        // Keep me signed in & Forgot Password Row
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // Keep me signed in with compact Switch
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  width: 36,
                  height: 20,
                  child: Transform.scale(
                    scale: 0.65,
                    child: Switch(
                      value: _rememberMe,
                      onChanged: (value) => setState(() => _rememberMe = value),
                      activeThumbColor: AppColors.primary,
                      activeTrackColor: AppColors.primaryLight,
                      inactiveThumbColor: Colors.white,
                      inactiveTrackColor: AppColors.border,
                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                  ),
                ),
                const SizedBox(width: 4),
                Text(
                  'Remember me',
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.textTertiary,
                  ),
                ),
              ],
            ),
            
            // Forgot Password - Enhanced visibility
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () => context.go(AppRouter.forgotPassword),
                borderRadius: BorderRadius.circular(6),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                  child: Text(
                    'Forgot password?',
                    style: TextStyle(
                      fontSize: 11,
                      color: AppColors.primary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
        
        const SizedBox(height: 18),
        
        // Sign In Button
        _buildPrimaryButton(
          onPressed: _isLoading ? null : _sendOTP,
          isLoading: _isLoading,
          label: 'Sign In',
        ),
        
        // Footer security note
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.verified_user_outlined,
              size: 14,
              color: AppColors.textHint,
            ),
            const SizedBox(width: 6),
            Text(
              'Secured by 2FA verification',
              style: TextStyle(
                fontSize: 10,
                color: AppColors.textHint,
                letterSpacing: 0.2,
              ),
            ),
          ],
        ),
      ],
    );
  }
  
  // ═══════════════════════════════════════════════════════════════
  // COMPACT PROFESSIONAL INPUT FIELD
  // ═══════════════════════════════════════════════════════════════
  Widget _buildLightInput({
    required TextEditingController controller,
    required FocusNode focusNode,
    required String label,
    required String hint,
    required IconData icon,
    required bool isFocused,
    bool obscureText = false,
    Widget? suffix,
    TextInputType? keyboardType,
    ValueChanged<String>? onSubmitted,
  }) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeInOut,
      height: 58, // Slightly more compact
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: isFocused ? Colors.white : const Color(0xFFF8FAFB),
        border: Border.all(
          color: isFocused ? AppColors.primary : Colors.grey.shade300,
          width: isFocused ? 1.5 : 1,
        ),
        boxShadow: isFocused
            ? [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.08),
                  blurRadius: 8,
                  spreadRadius: 0,
                  offset: const Offset(0, 2),
                ),
              ]
            : null,
      ),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => focusNode.requestFocus(),
        child: Row(
          children: [
          // Prefix Icon with animation
          TweenAnimationBuilder<Color?>(
            duration: const Duration(milliseconds: 200),
            tween: ColorTween(
              begin: Colors.grey[400],
              end: isFocused ? AppColors.primary : Colors.grey[400],
            ),
            builder: (context, color, _) {
              return Icon(icon, color: color, size: 18);
            },
          ),
          const SizedBox(width: 10),
          
          // Label + Input Column
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Animated Label
                AnimatedDefaultTextStyle(
                  duration: const Duration(milliseconds: 200),
                  style: TextStyle(
                    color: isFocused ? AppColors.primary : Colors.grey[600],
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                  ),
                  child: Text(label),
                ),
                // TextField
                TextField(
                  controller: controller,
                  focusNode: focusNode,
                  obscureText: obscureText,
                  keyboardType: keyboardType,
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                  cursorColor: AppColors.primary,
                  cursorHeight: 18,
                  decoration: InputDecoration(
                    isDense: true,
                    filled: false,
                    contentPadding: EdgeInsets.zero,
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    hintText: hint,
                    hintStyle: TextStyle(
                      color: Colors.grey[400],
                      fontWeight: FontWeight.w400,
                      fontSize: 13,
                    ),
                  ),
                  onSubmitted: onSubmitted,
                ),
              ],
            ),
          ),
          
          // Suffix (visibility toggle)
          if (suffix != null) suffix,
        ],
        ),
      ),
    );
  }
  
  // ═══════════════════════════════════════════════════════════════
  // COMPACT PRIMARY BUTTON
  // ═══════════════════════════════════════════════════════════════
  Widget _buildPrimaryButton({
    required VoidCallback? onPressed,
    required bool isLoading,
    required String label,
  }) {
    return Container(
      height: 48,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.primary, AppColors.primaryDark],
        ),
        borderRadius: BorderRadius.circular(10),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.25),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: onPressed,
          child: Center(
            child: isLoading
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  )
                : Text(
                    label,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.3,
                    ),
                  ),
          ),
        ),
      ),
    );
  }
  
  // ═══════════════════════════════════════════════════════════════
  // COMPACT GOOGLE BUTTON
  // ═══════════════════════════════════════════════════════════════
  Widget _buildGoogleButton() {
    return Container(
      height: 46,
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(10),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: _isGoogleLoading ? null : _signInWithGoogleAndSendOTP,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (_isGoogleLoading)
                  const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  )
                else ...[
                  // Google Logo
                  Image.asset(
                    'assets/icons/google.png',
                    width: 18,
                    height: 18,
                  ),
                  const SizedBox(width: 10),
                  const Text(
                    'Continue with Google',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
  
  // Light OTP Section
  Widget _buildLightOTPSection() {
    return Column(
      key: const ValueKey('otp-section'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // OTP Header
        Icon(
          Icons.mark_email_read_outlined,
          size: 48,
          color: AppColors.primary,
        ),
        const SizedBox(height: 16),
        
        Text(
          'Verify Your Email',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 8),
        
        // Email with highlighted styling
        RichText(
          textAlign: TextAlign.center,
          text: TextSpan(
            style: TextStyle(
              fontSize: 14,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
            children: [
              const TextSpan(text: 'We sent a 6-digit code to\n'),
              TextSpan(
                text: _emailController.text,
                style: TextStyle(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
        
        const SizedBox(height: 24),
        
        // OTP Input Boxes with paste support
        Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(6, (index) {
                final hasValue = _otpControllers[index].text.isNotEmpty;
                final hasFocus = _otpFocusNodes[index].hasFocus;
                return Container(
                  width: 48,
                  height: 56,
                  margin: EdgeInsets.only(right: index < 5 ? 8 : 0),
                  child: KeyboardListener(
                    focusNode: FocusNode(),
                    onKeyEvent: (event) {
                      // Handle backspace when field is empty
                      if (event is KeyDownEvent &&
                          event.logicalKey == LogicalKeyboardKey.backspace &&
                          _otpControllers[index].text.isEmpty &&
                          index > 0) {
                        _otpFocusNodes[index - 1].requestFocus();
                      }
                    },
                    child: TextField(
                      controller: _otpControllers[index],
                      focusNode: _otpFocusNodes[index],
                      keyboardType: TextInputType.number,
                      textAlign: TextAlign.center,
                      maxLength: 6, // Allow paste of full OTP
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                      decoration: InputDecoration(
                        counterText: '',
                        filled: true,
                        fillColor: hasFocus ? Colors.white : AppColors.surfaceVariant,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(
                            color: hasValue ? AppColors.primary : AppColors.border,
                          ),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(
                            color: hasValue ? AppColors.primary : AppColors.border,
                          ),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: AppColors.primary, width: 2),
                        ),
                        contentPadding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                      onChanged: (value) {
                        // Handle paste: if value is 6 digits, distribute to all fields
                        if (value.length == 6) {
                          _pasteOTP(value);
                          return;
                        }
                        
                        // Keep only last character if more than 1
                        if (value.length > 1) {
                          _otpControllers[index].text = value[value.length - 1];
                          _otpControllers[index].selection = TextSelection.fromPosition(
                            TextPosition(offset: 1),
                          );
                        }
                        
                        // Move to next field
                        if (_otpControllers[index].text.isNotEmpty && index < 5) {
                          _otpFocusNodes[index + 1].requestFocus();
                        }
                        
                        setState(() {});
                        
                        // Auto-verify when complete
                        final fullOtp = _otpControllers.map((c) => c.text).join();
                        if (fullOtp.length == 6) {
                          _verifyOTP();
                        }
                      },
                    ),
                  ),
                );
              }),
            ),
            
            // Paste button
            const SizedBox(height: 12),
            GestureDetector(
              onTap: _pasteFromClipboard,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.content_paste_rounded, size: 16, color: AppColors.primary),
                  const SizedBox(width: 6),
                  Text(
                    'Paste code',
                    style: TextStyle(
                      color: AppColors.primary,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            
            // Change email & Resend options
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                GestureDetector(
                  onTap: () {
                    for (var c in _otpControllers) { c.clear(); }
                    context.go(AppRouter.login);
                  },
                  child: Text(
                    'Change email',
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
                Text(
                  '  •  ',
                  style: TextStyle(color: AppColors.textHint, fontSize: 13),
                ),
                GestureDetector(
                  onTap: _resendCooldown > 0 ? null : _resendOTP,
                  child: Text(
                    _resendCooldown > 0 ? 'Resend in ${_resendCooldown}s' : 'Resend code',
                    style: TextStyle(
                      fontSize: 13,
                      color: _resendCooldown > 0 ? AppColors.textHint : AppColors.primary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
        
        const SizedBox(height: 16),
        
        // 2FA Section - Compact Card with Icon, Title & Input
        if (_is2FAEnabled && _otpSent) ...[
          GestureDetector(
            onTap: () => _totpFocus.requestFocus(),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.04),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: AppColors.primary.withValues(alpha: 0.12),
                ),
              ),
              child: Column(
                children: [
                  // Shield Icon
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [AppColors.primary, AppColors.primaryDark],
                      ),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.shield_outlined,
                      color: Colors.white,
                      size: 20,
                    ),
                  ),
                  const SizedBox(height: 10),
                  // Title
                  Text(
                    '2FA Verification',
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  // Description
                  Text(
                    'Enter 6-digit code from authenticator',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 11,
                    ),
                  ),
                  const SizedBox(height: 12),
                  // Input Field with 6 digit limit
                  TextField(
                    controller: _totpController,
                    focusNode: _totpFocus,
                    keyboardType: TextInputType.number,
                    textAlign: TextAlign.center,
                    maxLength: 6,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(6),
                    ],
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 8,
                      color: AppColors.textPrimary,
                    ),
                    decoration: InputDecoration(
                      counterText: '',
                      hintText: '000000',
                      hintStyle: TextStyle(
                        color: AppColors.textHint.withValues(alpha: 0.5),
                        letterSpacing: 8,
                      ),
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: AppColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: AppColors.border),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: AppColors.primary, width: 2),
                      ),
                      contentPadding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                    ),
                    onChanged: (value) {
                      if (value.length == 6) {
                        FocusScope.of(context).unfocus();
                      }
                      setState(() {});
                    },
                    onSubmitted: (_) => _verifyOTP(),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
        ],
        
        // Verify Button
        _buildPrimaryButton(
          onPressed: _isLoading ? null : _verifyOTP,
          isLoading: _isLoading,
          label: 'Verify Code',
        ),
      ],
    );
  }
  
}

// ═══════════════════════════════════════════════════════════════
// HELPER PAINTERS
// ═══════════════════════════════════════════════════════════════

/// Subtle Grid Pattern for backgrounds
class _GridPatternPainter extends CustomPainter {
  final bool isDark;
  final double opacity;
  _GridPatternPainter({required this.isDark, this.opacity = 0.1});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = (isDark ? Colors.white : Colors.black).withValues(alpha: opacity)
      ..strokeWidth = 1;

    const spacing = 40.0;
    for (double i = 0; i < size.width; i += spacing) {
      canvas.drawLine(Offset(i, 0), Offset(i, size.height), paint);
    }
    for (double i = 0; i < size.height; i += spacing) {
      canvas.drawLine(Offset(0, i), Offset(size.width, i), paint);
    }
  }

  @override
  bool shouldRepaint(covariant _GridPatternPainter oldDelegate) => false;
}
