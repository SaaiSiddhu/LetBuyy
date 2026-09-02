// lib/screens/auth/forgot_password_screen.dart
// 🔐 PREMIUM FORGOT PASSWORD SCREEN
// Matches login screen UI with gradient background, floating orbs, responsive card

import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:go_router/go_router.dart';

import '../../app/app_router.dart';
import '../../app/themes/app_colors.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen>
    with TickerProviderStateMixin, WidgetsBindingObserver {
  
  final _emailController = TextEditingController();
  final _emailFocus = FocusNode();
  
  bool _isLoading = false;
  bool _emailSent = false;
  bool _emailFocused = false;
  String? _errorMessage;
  
  // Animations
  late AnimationController _cardAnimController;
  late AnimationController _orbController;
  late Animation<double> _cardSlide;
  late Animation<double> _cardFade;
  
  static const String _functionsBaseUrl = 'https://us-central1-letbuy-y.cloudfunctions.net';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _emailFocus.addListener(() => setState(() => _emailFocused = _emailFocus.hasFocus));
    _initAnimations();
  }
  
  void _initAnimations() {
    _cardAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    
    _orbController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 20),
    )..repeat();
    
    _cardSlide = Tween<double>(begin: 40, end: 0).animate(
      CurvedAnimation(parent: _cardAnimController, curve: Curves.easeOutCubic),
    );
    
    _cardFade = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _cardAnimController, curve: const Interval(0, 0.6)),
    );
    
    _cardAnimController.forward();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _emailController.dispose();
    _emailFocus.dispose();
    _cardAnimController.dispose();
    _orbController.dispose();
    super.dispose();
  }

  Future<void> _handleResetPassword() async {
    final email = _emailController.text.trim();
    
    if (email.isEmpty) {
      setState(() => _errorMessage = 'Please enter your email');
      return;
    }
    
    if (!email.contains('@')) {
      setState(() => _errorMessage = 'Please enter a valid email');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await http.post(
        Uri.parse('$_functionsBaseUrl/requestAdminPasswordReset'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'email': email}),
      );

      final data = json.decode(response.body);

      if (!mounted) return;

      if (response.statusCode == 200 && data['success'] == true) {
        setState(() {
          _emailSent = true;
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage = data['error'] ?? 'Failed to send reset email';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Network error. Please try again.';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final isMobile = size.width < 600;
    final cardWidth = isMobile ? size.width - 32 : 440.0;
    final cardPadding = isMobile ? 24.0 : 40.0;

    return Scaffold(
      body: Stack(
        children: [
          // Gradient Background
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  AppColors.surface,
                  AppColors.surfaceVariant.withValues(alpha: 0.5),
                  AppColors.primary.withValues(alpha: 0.03),
                ],
              ),
            ),
          ),
          
          // Grid Pattern
          CustomPaint(
            size: Size(size.width, size.height),
            painter: _GridPatternPainter(isDark: false, opacity: 0.03),
          ),
          
          // Floating Orbs
          _buildFloatingOrbs(size.width, size.height),
          
          // Main Content
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                padding: EdgeInsets.symmetric(
                  horizontal: isMobile ? 16 : 40,
                  vertical: 32,
                ),
                child: AnimatedBuilder(
                  animation: _cardAnimController,
                  builder: (context, child) {
                    return Transform.translate(
                      offset: Offset(0, _cardSlide.value),
                      child: Opacity(
                        opacity: _cardFade.value,
                        child: Container(
                          width: cardWidth,
                          padding: EdgeInsets.all(cardPadding),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(24),
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.primary.withValues(alpha: 0.08),
                                blurRadius: 40,
                                offset: const Offset(0, 20),
                              ),
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.03),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: _emailSent 
                              ? _buildSuccessContent() 
                              : _buildFormContent(isMobile),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildFormContent(bool isMobile) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Header
        _buildHeader(),
        
        const SizedBox(height: 32),
        
        // Info Box
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.1)),
          ),
          child: Row(
            children: [
              Icon(Icons.info_outline_rounded, color: AppColors.primary, size: 22),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'We\'ll send a password reset link to your admin email.',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 13,
                    height: 1.4,
                  ),
                ),
              ),
            ],
          ),
        ),
        
        const SizedBox(height: 28),
        
        // Email Input
        _buildLightInput(
          controller: _emailController,
          focusNode: _emailFocus,
          label: 'Email Address',
          hint: 'Enter your admin email',
          icon: Icons.email_outlined,
          isFocused: _emailFocused,
          keyboardType: TextInputType.emailAddress,
          onSubmitted: (_) => _handleResetPassword(),
        ),
        
        // Error Message
        if (_errorMessage != null) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.error.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.error.withValues(alpha: 0.2)),
            ),
            child: Row(
              children: [
                Icon(Icons.error_outline, color: AppColors.error, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _errorMessage!,
                    style: TextStyle(color: AppColors.error, fontSize: 13, fontWeight: FontWeight.w500),
                  ),
                ),
              ],
            ),
          ),
        ],
        
        const SizedBox(height: 28),
        
        // Submit Button
        _buildPrimaryButton(
          onPressed: _isLoading ? null : _handleResetPassword,
          isLoading: _isLoading,
          label: 'Send Reset Link',
        ),
        
        const SizedBox(height: 24),
        
        // Back to Sign In - small text like 'Forgot password?' on login
        GestureDetector(
          onTap: () => context.go(AppRouter.login),
          child: Text(
            '← Back to Sign In',
            style: TextStyle(
              fontSize: 11,
              color: AppColors.primary,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }
  
  Widget _buildSuccessContent() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Success Icon
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [AppColors.success, AppColors.success.withValues(alpha: 0.7)],
            ),
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: AppColors.success.withValues(alpha: 0.25),
                blurRadius: 16,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: const Icon(Icons.mark_email_read_rounded, size: 32, color: Colors.white),
        ),
        
        const SizedBox(height: 20),
        
        Text(
          'Email Sent!',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 22,
            fontWeight: FontWeight.w800,
          ),
        ),
        
        const SizedBox(height: 8),
        
        Text(
          'Check your inbox for password reset link.\nExpires in 1 hour.',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: AppColors.textSecondary,
            fontSize: 13,
            height: 1.4,
          ),
        ),
        
        const SizedBox(height: 12),
        
        // Plain email text - no background
        Text(
          _emailController.text,
          style: TextStyle(
            color: AppColors.primary,
            fontWeight: FontWeight.w600,
            fontSize: 14,
          ),
        ),
        
        const SizedBox(height: 24),
        
        // Back to Sign In Button
        _buildPrimaryButton(
          onPressed: () => context.go(AppRouter.login),
          isLoading: false,
          label: 'Back to Sign In',
        ),
        
        const SizedBox(height: 16),
        
        // Resend Link - small text like 'Forgot password?' on login
        GestureDetector(
          onTap: () => setState(() => _emailSent = false),
          child: Text(
            'Didn\'t receive? Send again',
            style: TextStyle(
              color: AppColors.primary,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }
  
  Widget _buildHeader() {
    return Column(
      children: [
        // Icon
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [AppColors.primary, AppColors.primaryDark],
            ),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.3),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: const Icon(Icons.lock_reset_rounded, size: 32, color: Colors.white),
        ),
        
        const SizedBox(height: 20),
        
        Text(
          'Reset Password',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 26,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.5,
          ),
        ),
        
        const SizedBox(height: 8),
        
        Text(
          'Enter your email to receive reset instructions',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: AppColors.textSecondary,
            fontSize: 14,
          ),
        ),
      ],
    );
  }
  
  Widget _buildLightInput({
    required TextEditingController controller,
    required FocusNode focusNode,
    required String label,
    required String hint,
    required IconData icon,
    required bool isFocused,
    TextInputType? keyboardType,
    ValueChanged<String>? onSubmitted,
  }) {
    // Exact same style as login screen
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeInOut,
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: const Color(0xFFF9FAFB),
        border: Border.all(
          color: isFocused ? AppColors.primary : Colors.grey[300]!,
          width: isFocused ? 1.5 : 1,
        ),
        boxShadow: isFocused
            ? [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.06),
                  blurRadius: 6,
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
                return Icon(icon, color: color, size: 20);
              },
            ),
            const SizedBox(width: 12),
            
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
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                    child: Text(label),
                  ),
                  const SizedBox(height: 1),
                  // TextField
                  TextField(
                    controller: controller,
                    focusNode: focusNode,
                    keyboardType: keyboardType,
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                    cursorColor: AppColors.primary,
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
                        fontSize: 14,
                      ),
                    ),
                    onSubmitted: onSubmitted,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildPrimaryButton({
    required VoidCallback? onPressed,
    required bool isLoading,
    required String label,
  }) {
    return GestureDetector(
      onTap: onPressed,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: double.infinity,
        height: 56,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: onPressed == null
                ? [AppColors.textHint, AppColors.textHint]
                : [AppColors.primary, AppColors.primaryDark],
          ),
          borderRadius: BorderRadius.circular(14),
          boxShadow: onPressed == null
              ? []
              : [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.35),
                    blurRadius: 16,
                    offset: const Offset(0, 8),
                  ),
                ],
        ),
        child: Center(
          child: isLoading
              ? const SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                  ),
                )
              : Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      label,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (label == 'Send Reset Link') ...[
                      const SizedBox(width: 10),
                      Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Icon(Icons.send_rounded, color: Colors.white, size: 16),
                      ),
                    ],
                  ],
                ),
        ),
      ),
    );
  }
  
  Widget _buildFloatingOrbs(double width, double height) {
    return AnimatedBuilder(
      animation: _orbController,
      builder: (context, child) {
        return Stack(
          children: [
            // Top left orb
            Positioned(
              left: -80 + math.sin(_orbController.value * math.pi * 2) * 30,
              top: height * 0.1 + math.cos(_orbController.value * math.pi * 2) * 20,
              child: _buildOrb(160, AppColors.primary.withValues(alpha: 0.08)),
            ),
            // Top right orb
            Positioned(
              right: -60 + math.cos(_orbController.value * math.pi * 2) * 25,
              top: -40 + math.sin(_orbController.value * math.pi * 2) * 15,
              child: _buildOrb(200, AppColors.secondary.withValues(alpha: 0.06)),
            ),
            // Bottom orb
            Positioned(
              left: width * 0.3 + math.sin(_orbController.value * math.pi * 2 + 1) * 20,
              bottom: -80 + math.cos(_orbController.value * math.pi * 2 + 1) * 25,
              child: _buildOrb(180, AppColors.primary.withValues(alpha: 0.05)),
            ),
          ],
        );
      },
    );
  }
  
  Widget _buildOrb(double size, Color color) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          colors: [color, color.withValues(alpha: 0)],
        ),
      ),
    );
  }
}

// Grid Pattern Painter
class _GridPatternPainter extends CustomPainter {
  final bool isDark;
  final double opacity;
  _GridPatternPainter({required this.isDark, this.opacity = 0.05});

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
  bool shouldRepaint(covariant _GridPatternPainter oldDelegate) =>
      isDark != oldDelegate.isDark || opacity != oldDelegate.opacity;
}
