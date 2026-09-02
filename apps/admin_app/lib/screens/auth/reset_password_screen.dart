// lib/screens/auth/reset_password_screen.dart
// 🔐 PREMIUM RESET PASSWORD SCREEN
// Matches login/forgot password screen UI

import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:go_router/go_router.dart';

import '../../app/app_router.dart';
import '../../app/themes/app_colors.dart';

class ResetPasswordScreen extends StatefulWidget {
  final String? token;
  final String? uid;

  const ResetPasswordScreen({super.key, this.token, this.uid});

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen>
    with TickerProviderStateMixin {
  
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _passwordFocus = FocusNode();
  final _confirmPasswordFocus = FocusNode();

  bool _isLoading = false;
  bool _verifyingToken = true;
  bool _tokenValid = false;
  bool _resetSuccess = false;
  bool _passwordFocused = false;
  bool _confirmPasswordFocused = false;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  String? _errorMessage;
  String? _email;

  late AnimationController _cardAnimController;
  late AnimationController _orbController;
  late Animation<double> _cardSlide;
  late Animation<double> _cardFade;

  static const String _functionsBaseUrl = 'https://us-central1-letbuy-y.cloudfunctions.net';

  @override
  void initState() {
    super.initState();
    _passwordFocus.addListener(() => setState(() => _passwordFocused = _passwordFocus.hasFocus));
    _confirmPasswordFocus.addListener(() => setState(() => _confirmPasswordFocused = _confirmPasswordFocus.hasFocus));
    _initAnimations();
    _verifyToken();
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
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _passwordFocus.dispose();
    _confirmPasswordFocus.dispose();
    _cardAnimController.dispose();
    _orbController.dispose();
    super.dispose();
  }

  Future<void> _verifyToken() async {
    if (widget.token == null || widget.uid == null) {
      setState(() {
        _verifyingToken = false;
        _tokenValid = false;
        _errorMessage = "Invalid password reset link.";
      });
      return;
    }

    try {
      final response = await http.post(
        Uri.parse('$_functionsBaseUrl/verifyAdminResetToken'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'token': widget.token,
          'uid': widget.uid,
        }),
      );

      final data = json.decode(response.body);

      if (mounted) {
        setState(() {
          _verifyingToken = false;
          if (response.statusCode == 200 && data['success'] == true) {
            _tokenValid = true;
            _email = data['email'];
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
          _errorMessage = "Network error. Please try again.";
        });
      }
    }
  }

  Future<void> _resetPassword() async {
    final password = _passwordController.text;
    final confirmPassword = _confirmPasswordController.text;

    if (password.isEmpty) {
      setState(() => _errorMessage = 'Please enter a password');
      return;
    }

    if (password.length < 8) {
      setState(() => _errorMessage = 'Password must be at least 8 characters');
      return;
    }

    if (password != confirmPassword) {
      setState(() => _errorMessage = 'Passwords do not match');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await http.post(
        Uri.parse('$_functionsBaseUrl/resetAdminPassword'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'token': widget.token,
          'uid': widget.uid,
          'newPassword': password,
        }),
      );

      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        setState(() => _resetSuccess = true);
      } else {
        setState(() => _errorMessage = data['error'] ?? 'Failed to reset password');
      }
    } catch (e) {
      setState(() => _errorMessage = 'Network error. Please try again.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final isMobile = size.width < 600;
    final cardWidth = isMobile ? size.width - 32 : 440.0;
    final cardPadding = isMobile ? 24.0 : 36.0;

    Widget content;
    if (_verifyingToken) {
      content = _buildLoadingState();
    } else if (!_tokenValid) {
      content = _buildErrorState();
    } else if (_resetSuccess) {
      content = _buildSuccessState();
    } else {
      content = _buildFormContent();
    }

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
            painter: _GridPatternPainter(),
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
                            ],
                          ),
                          child: content,
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

  Widget _buildLoadingState() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Bouncing dots animation
        SizedBox(
          height: 40,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(3, (index) {
              return TweenAnimationBuilder<double>(
                duration: const Duration(milliseconds: 600),
                tween: Tween(begin: 0, end: 1),
                curve: Curves.easeInOut,
                builder: (context, value, child) {
                  return AnimatedBuilder(
                    animation: _orbController,
                    builder: (context, _) {
                      final offset = math.sin((_orbController.value * math.pi * 4) + (index * 0.8)) * 8;
                      return Transform.translate(
                        offset: Offset(0, offset),
                        child: Container(
                          margin: const EdgeInsets.symmetric(horizontal: 4),
                          width: 12,
                          height: 12,
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.8 - (index * 0.15)),
                            shape: BoxShape.circle,
                          ),
                        ),
                      );
                    },
                  );
                },
              );
            }),
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'Verifying link...',
          style: TextStyle(
            fontSize: 14,
            color: AppColors.textSecondary,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildErrorState() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [AppColors.error, AppColors.error.withValues(alpha: 0.7)],
            ),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.error_outline_rounded, size: 32, color: Colors.white),
        ),
        const SizedBox(height: 20),
        Text(
          'Invalid Link',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 22,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          _errorMessage ?? 'This link has expired or is invalid.',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: AppColors.textSecondary,
            fontSize: 13,
          ),
        ),
        const SizedBox(height: 24),
        _buildPrimaryButton(
          onPressed: () => context.go(AppRouter.forgotPassword),
          isLoading: false,
          label: 'Request New Link',
        ),
      ],
    );
  }

  Widget _buildSuccessState() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [AppColors.success, AppColors.success.withValues(alpha: 0.7)],
            ),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.check_circle_outline_rounded, size: 32, color: Colors.white),
        ),
        const SizedBox(height: 20),
        Text(
          'Password Reset!',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 22,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'You can now sign in with your new password.',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: AppColors.textSecondary,
            fontSize: 13,
          ),
        ),
        const SizedBox(height: 24),
        _buildPrimaryButton(
          onPressed: () => context.go(AppRouter.login),
          isLoading: false,
          label: 'Sign In',
        ),
      ],
    );
  }

  Widget _buildFormContent() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Header
        Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [AppColors.primary, AppColors.primaryDark],
            ),
            borderRadius: BorderRadius.circular(14),
          ),
          child: const Icon(Icons.lock_reset_rounded, size: 28, color: Colors.white),
        ),
        const SizedBox(height: 16),
        Text(
          'Create New Password',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 22,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 6),
        if (_email != null)
          Text(
            _email!,
            style: TextStyle(
              color: AppColors.primary,
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
          ),
        
        const SizedBox(height: 24),
        
        // Error Message
        if (_errorMessage != null) ...[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
              color: AppColors.error.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                Icon(Icons.error_outline, color: AppColors.error, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _errorMessage!,
                    style: TextStyle(color: AppColors.error, fontSize: 12, fontWeight: FontWeight.w500),
                  ),
                ),
              ],
            ),
          ),
        ],
        
        // Password Field
        _buildLightInput(
          controller: _passwordController,
          focusNode: _passwordFocus,
          label: 'New Password',
          hint: 'Enter new password',
          icon: Icons.lock_outline_rounded,
          isFocused: _passwordFocused,
          obscureText: _obscurePassword,
          suffix: IconButton(
            icon: Icon(
              _obscurePassword ? Icons.visibility_off_rounded : Icons.visibility_rounded,
              color: Colors.grey[400],
              size: 18,
            ),
            onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),
        ),
        
        const SizedBox(height: 12),
        
        // Confirm Password Field
        _buildLightInput(
          controller: _confirmPasswordController,
          focusNode: _confirmPasswordFocus,
          label: 'Confirm Password',
          hint: 'Re-enter password',
          icon: Icons.lock_outline_rounded,
          isFocused: _confirmPasswordFocused,
          obscureText: _obscureConfirmPassword,
          suffix: IconButton(
            icon: Icon(
              _obscureConfirmPassword ? Icons.visibility_off_rounded : Icons.visibility_rounded,
              color: Colors.grey[400],
              size: 18,
            ),
            onPressed: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),
          onSubmitted: (_) => _resetPassword(),
        ),
        
        const SizedBox(height: 24),
        
        // Submit Button
        _buildPrimaryButton(
          onPressed: _isLoading ? null : _resetPassword,
          isLoading: _isLoading,
          label: 'Reset Password',
        ),
        
        const SizedBox(height: 16),
        
        // Back to Sign In
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

  Widget _buildLightInput({
    required TextEditingController controller,
    required FocusNode focusNode,
    required String label,
    required String hint,
    required IconData icon,
    required bool isFocused,
    bool obscureText = false,
    Widget? suffix,
    ValueChanged<String>? onSubmitted,
  }) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
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
            ? [BoxShadow(color: AppColors.primary.withValues(alpha: 0.06), blurRadius: 6, offset: const Offset(0, 2))]
            : null,
      ),
      child: Row(
        children: [
          TweenAnimationBuilder<Color?>(
            duration: const Duration(milliseconds: 200),
            tween: ColorTween(begin: Colors.grey[400], end: isFocused ? AppColors.primary : Colors.grey[400]),
            builder: (context, color, _) => Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
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
                TextField(
                  controller: controller,
                  focusNode: focusNode,
                  obscureText: obscureText,
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
                    hintStyle: TextStyle(color: Colors.grey[400], fontSize: 14),
                  ),
                  onSubmitted: onSubmitted,
                ),
              ],
            ),
          ),
          if (suffix != null) suffix,
        ],
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
      child: Container(
        width: double.infinity,
        height: 52,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: onPressed == null
                ? [AppColors.textHint, AppColors.textHint]
                : [AppColors.primary, AppColors.primaryDark],
          ),
          borderRadius: BorderRadius.circular(12),
          boxShadow: onPressed == null ? [] : [
            BoxShadow(color: AppColors.primary.withValues(alpha: 0.3), blurRadius: 12, offset: const Offset(0, 6)),
          ],
        ),
        child: Center(
          child: isLoading
              ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, valueColor: AlwaysStoppedAnimation<Color>(Colors.white)))
              : Text(label, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700)),
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
            Positioned(
              left: -80 + math.sin(_orbController.value * math.pi * 2) * 30,
              top: height * 0.1 + math.cos(_orbController.value * math.pi * 2) * 20,
              child: _buildOrb(160, AppColors.primary.withValues(alpha: 0.08)),
            ),
            Positioned(
              right: -60 + math.cos(_orbController.value * math.pi * 2) * 25,
              top: -40 + math.sin(_orbController.value * math.pi * 2) * 15,
              child: _buildOrb(200, AppColors.secondary.withValues(alpha: 0.06)),
            ),
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
        gradient: RadialGradient(colors: [color, color.withValues(alpha: 0)]),
      ),
    );
  }
}

class _GridPatternPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.black.withValues(alpha: 0.03)
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
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
