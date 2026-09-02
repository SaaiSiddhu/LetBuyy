// ============================================================
// Smart Auth Bottom Sheet - Premium Email-First Flow
// ============================================================

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../providers/auth_provider.dart';

/// Authentication steps
enum AuthStep { email, signup, otp }

/// Saved auth session state (persists across bottom sheet closes)
class _AuthSession {
  static AuthStep? savedStep;
  static String? savedEmail;
  static String? savedName;
  static String? savedPhone;
  static bool? savedIsExistingUser;
  static int? savedResendTimer;
  static DateTime? savedOtpSentAt;
  
  static void save({
    required AuthStep step,
    required String email,
    String? name,
    String? phone,
    required bool isExistingUser,
    int? resendTimer,
  }) {
    savedStep = step;
    savedEmail = email;
    savedName = name;
    savedPhone = phone;
    savedIsExistingUser = isExistingUser;
    savedResendTimer = resendTimer;
    savedOtpSentAt = DateTime.now();
  }
  
  static void clear() {
    savedStep = null;
    savedEmail = null;
    savedName = null;
    savedPhone = null;
    savedIsExistingUser = null;
    savedResendTimer = null;
    savedOtpSentAt = null;
  }
  
  static bool get hasSession => savedStep != null && savedEmail != null;
  
  /// Calculate remaining resend time based on when OTP was sent
  static int get remainingResendTime {
    if (savedOtpSentAt == null || savedResendTimer == null) return 0;
    final elapsed = DateTime.now().difference(savedOtpSentAt!).inSeconds;
    final remaining = savedResendTimer! - elapsed;
    return remaining > 0 ? remaining : 0;
  }
}

class AuthBottomSheet extends StatefulWidget {
  final String? actionDescription;

  const AuthBottomSheet({
    super.key,
    this.actionDescription,
  });

  /// Show the auth bottom sheet
  static Future<bool?> show(BuildContext context, {String? actionDescription}) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      isDismissible: true,
      enableDrag: true,
      builder: (_) => AuthBottomSheet(actionDescription: actionDescription),
    );
  }

  @override
  State<AuthBottomSheet> createState() => _AuthBottomSheetState();
}

class _AuthBottomSheetState extends State<AuthBottomSheet>
    with TickerProviderStateMixin {
  // Controllers
  final _emailController = TextEditingController();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final List<TextEditingController> _otpControllers = 
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _otpFocusNodes = 
      List.generate(6, (_) => FocusNode());

  // State
  AuthStep _step = AuthStep.email;
  bool _isLoading = false;
  bool _isExistingUser = false;
  String? _error;
  int _resendTimer = 0;

  // Animations
  late AnimationController _slideController;

  @override
  void initState() {
    super.initState();
    _slideController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    
    // Restore previous session if exists
    _restoreSession();
  }
  
  void _restoreSession() {
    if (_AuthSession.hasSession) {
      setState(() {
        _step = _AuthSession.savedStep!;
        _emailController.text = _AuthSession.savedEmail ?? '';
        _nameController.text = _AuthSession.savedName ?? '';
        _phoneController.text = _AuthSession.savedPhone ?? '';
        _isExistingUser = _AuthSession.savedIsExistingUser ?? false;
        _resendTimer = _AuthSession.remainingResendTime;
      });
      
      // Continue resend timer if OTP step
      if (_step == AuthStep.otp && _resendTimer > 0) {
        _startResendTimer();
      }
      
      debugPrint('📋 Restored auth session: step=${_step.name}, email=${_emailController.text}');
    }
  }
  
  void _saveSession() {
    _AuthSession.save(
      step: _step,
      email: _emailController.text.trim(),
      name: _nameController.text.trim(),
      phone: _phoneController.text.trim(),
      isExistingUser: _isExistingUser,
      resendTimer: _resendTimer,
    );
  }

  @override
  void dispose() {
    // Save session before closing (only if we're past email step)
    if (_step != AuthStep.email) {
      _saveSession();
    }
    
    _emailController.dispose();
    _nameController.dispose();
    _phoneController.dispose();
    for (var c in _otpControllers) {
      c.dispose();
    }
    for (var f in _otpFocusNodes) {
      f.dispose();
    }
    _slideController.dispose();
    super.dispose();
  }

  // =============================================
  // STEP 1: Check Email
  // =============================================
  
  Future<void> _checkEmail() async {
    final email = _emailController.text.trim();
    
    if (email.isEmpty || !email.contains('@') || !email.contains('.')) {
      setState(() => _error = 'Please enter a valid email');
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    HapticFeedback.lightImpact();

    try {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final exists = await authProvider.checkUserExists(email);
      
      if (mounted) {
        setState(() {
          _isExistingUser = exists;
          _isLoading = false;
        });

        if (exists) {
          // Existing user → Send OTP directly
          await _sendOTP();
        } else {
          // New user → Show signup form
          setState(() => _step = AuthStep.signup);
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Could not verify email. Please try again.';
          _isLoading = false;
        });
      }
    }
  }

  // =============================================
  // STEP 2: Send OTP
  // =============================================
  
  Future<void> _sendOTP() async {
    final email = _emailController.text.trim();

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      await authProvider.sendEmailOTP(email);

      if (mounted) {
        setState(() {
          _step = AuthStep.otp;
          _isLoading = false;
          _resendTimer = 60;
        });
        _startResendTimer();
        
        // Focus first OTP field
        Future.delayed(const Duration(milliseconds: 300), () {
          if (mounted) _otpFocusNodes[0].requestFocus();
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceAll('Exception: ', '');
          _isLoading = false;
        });
      }
    }
  }

  void _startResendTimer() {
    Future.doWhile(() async {
      await Future.delayed(const Duration(seconds: 1));
      if (!mounted) return false;
      setState(() => _resendTimer--);
      return _resendTimer > 0;
    });
  }

  // =============================================
  // STEP 3: Verify OTP
  // =============================================
  
  Future<void> _verifyOTP() async {
    final otp = _otpControllers.map((c) => c.text).join();
    
    if (otp.length < 6) {
      setState(() => _error = 'Please enter the complete OTP');
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    HapticFeedback.mediumImpact();

    try {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final email = _emailController.text.trim();

      if (_isExistingUser) {
        // Login
        await authProvider.verifyEmailOTPAndLogin(email: email, otp: otp);
      } else {
        // Signup
        await authProvider.verifyEmailOTPAndSignup(
          email: email,
          otp: otp,
          name: _nameController.text.trim(),
        );
      }

      if (mounted) {
        HapticFeedback.heavyImpact();
        // Clear session on success
        _AuthSession.clear();
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceAll('Exception: ', '');
          _isLoading = false;
        });
        // Clear OTP fields on error
        for (var c in _otpControllers) {
          c.clear();
        }
        _otpFocusNodes[0].requestFocus();
      }
    }
  }



  void _goBack() {
    HapticFeedback.lightImpact();
    setState(() {
      _error = null;
      if (_step == AuthStep.otp) {
        _step = _isExistingUser ? AuthStep.email : AuthStep.signup;
        for (var c in _otpControllers) {
          c.clear();
        }
      } else if (_step == AuthStep.signup) {
        _step = AuthStep.email;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final bottomPadding = 24.0; // Static padding - modal handles keyboard
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1F2E) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle bar
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Content
          Padding(
            padding: EdgeInsets.only(
              left: 24,
              right: 24,
              top: 20,
              bottom: bottomPadding + 24,
            ),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 300),
              transitionBuilder: (child, animation) {
                return FadeTransition(
                  opacity: animation,
                  child: SlideTransition(
                    position: Tween<Offset>(
                      begin: const Offset(0.05, 0),
                      end: Offset.zero,
                    ).animate(animation),
                    child: child,
                  ),
                );
              },
              child: _buildCurrentStep(isDark),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCurrentStep(bool isDark) {
    switch (_step) {
      case AuthStep.email:
        return _buildEmailStep(isDark);
      case AuthStep.signup:
        return _buildSignupStep(isDark);
      case AuthStep.otp:
        return _buildOtpStep(isDark);
    }
  }

  // =============================================
  // EMAIL STEP
  // =============================================
  
  Widget _buildEmailStep(bool isDark) {
    return Column(
      key: const ValueKey('email'),
      mainAxisSize: MainAxisSize.min,
      children: [
        // Header
        _buildHeader(
          icon: Icons.mail_outline_rounded,
          title: 'Welcome to LetBuyy',
          subtitle: widget.actionDescription ?? 'Enter your email to continue',
          isDark: isDark,
        ),
        const SizedBox(height: 28),

        // Email field
        _buildTextField(
          controller: _emailController,
          hint: 'Email address',
          icon: Icons.email_outlined,
          keyboardType: TextInputType.emailAddress,
          isDark: isDark,
          autofocus: true,
        ),

        // Error
        if (_error != null) ...[
          const SizedBox(height: 16),
          _buildError(_error!, isDark),
        ],

        const SizedBox(height: 24),

        // Continue button
        _buildPrimaryButton(
          label: 'Continue',
          onPressed: _checkEmail,
          isLoading: _isLoading,
        ),

        const SizedBox(height: 20),

        // Terms
        _buildTerms(isDark),
      ],
    );
  }

  // =============================================
  // SIGNUP STEP
  // =============================================
  
  Widget _buildSignupStep(bool isDark) {
    return Column(
      key: const ValueKey('signup'),
      mainAxisSize: MainAxisSize.min,
      children: [
        // Back button row
        _buildBackRow(isDark),
        const SizedBox(height: 8),

        // Header
        _buildHeader(
          icon: Icons.person_add_outlined,
          title: 'Create Account',
          subtitle: 'Enter your details to get started',
          isDark: isDark,
        ),
        const SizedBox(height: 24),

        // Name field
        _buildTextField(
          controller: _nameController,
          hint: 'Full name',
          icon: Icons.person_outline,
          textCapitalization: TextCapitalization.words,
          isDark: isDark,
          autofocus: true,
        ),
        const SizedBox(height: 16),

        // Phone field
        _buildTextField(
          controller: _phoneController,
          hint: 'Phone number (optional)',
          icon: Icons.phone_outlined,
          keyboardType: TextInputType.phone,
          isDark: isDark,
        ),

        // Error
        if (_error != null) ...[
          const SizedBox(height: 16),
          _buildError(_error!, isDark),
        ],

        const SizedBox(height: 24),

        // Create account button
        _buildPrimaryButton(
          label: 'Create Account',
          onPressed: () {
            final name = _nameController.text.trim();
            if (name.isEmpty) {
              setState(() => _error = 'Please enter your name');
              return;
            }
            _sendOTP();
          },
          isLoading: _isLoading,
        ),
      ],
    );
  }

  // =============================================
  // OTP STEP
  // =============================================
  
  Widget _buildOtpStep(bool isDark) {
    return Column(
      key: const ValueKey('otp'),
      mainAxisSize: MainAxisSize.min,
      children: [
        // Back button row
        _buildBackRow(isDark),
        const SizedBox(height: 8),

        // Header
        _buildHeader(
          icon: Icons.verified_outlined,
          title: 'Verify Access',
          subtitle: 'Enter the code sent to\n${_emailController.text}',
          isDark: isDark,
        ),
        const SizedBox(height: 28),

        // Advanced OTP Fields
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: List.generate(6, (index) {
            return Focus(
              canRequestFocus: false, // Don't steal focus from TextField
              onKeyEvent: (node, event) {
                if (event is KeyDownEvent && 
                    event.logicalKey == LogicalKeyboardKey.backspace) {
                  // If current field is empty and we're not at the start, move back
                  if (_otpControllers[index].text.isEmpty && index > 0) {
                     _otpControllers[index - 1].clear();
                    _otpFocusNodes[index - 1].requestFocus();
                    return KeyEventResult.handled;
                  }
                }
                return KeyEventResult.ignored;
              },
              child: SizedBox(
                width: 50, // Matches seller app
                height: 60,
                child: TextField(
                  controller: _otpControllers[index],
                  focusNode: _otpFocusNodes[index],
                  keyboardType: TextInputType.number,
                  textAlign: TextAlign.center,
                  maxLength: 1,
                  style: TextStyle(
                    fontSize: 24, // Matches seller app
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                  decoration: InputDecoration(
                    counterText: '',
                    filled: true,
                    // Exact seller app colors
                    fillColor: isDark 
                        ? const Color(0xFF262626) 
                        : const Color(0xFFF9FAFB),
                    contentPadding: EdgeInsets.zero,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: isDark ? Colors.grey[800]! : Colors.grey[300]!,
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: isDark ? Colors.grey[800]! : Colors.grey[300]!,
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: AppColors.primary,
                        width: 2,
                      ),
                    ),
                  ),
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  onChanged: (value) {
                    // Forward navigation
                    if (value.isNotEmpty && index < 5) {
                      _otpFocusNodes[index + 1].requestFocus();
                    }
                    // Backward navigation (if current cleared manually)
                    if (value.isEmpty && index > 0) {
                      _otpFocusNodes[index - 1].requestFocus();
                    }
                    // Auto-verify on last digit
                    if (index == 5 && value.isNotEmpty) {
                      final otp = _otpControllers.map((c) => c.text).join();
                      if (otp.length == 6) _verifyOTP();
                    }
                  },
                  onTap: () {
                    // Optional: clear on tap if desired, or just select
                    _otpControllers[index].selection = TextSelection.fromPosition(
                      TextPosition(offset: _otpControllers[index].text.length),
                    );
                  },
                ),
              ),
            ).animate(delay: Duration(milliseconds: 50 * index))
                .fadeIn(duration: 200.ms)
                .slideY(begin: 0.3, curve: Curves.easeOut);
          }),
        ),

        // Error
        if (_error != null) ...[
          const SizedBox(height: 20),
          _buildError(_error!, isDark),
        ],

        const SizedBox(height: 24),

        // Verify button
        _buildPrimaryButton(
          label: 'Verify & Continue',
          onPressed: _verifyOTP,
          isLoading: _isLoading,
        ),

        const SizedBox(height: 20),

        // Resend / Change email
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
             TextButton(
              onPressed: _resendTimer > 0 ? null : _sendOTP,
              child: Text(
                _resendTimer > 0 
                    ? 'Resend in ${_resendTimer}s'
                    : 'Resend Code',
                style: TextStyle(
                  color: _resendTimer > 0 
                      ? Colors.grey 
                      : AppColors.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            Container(
              width: 1,
              height: 16,
              color: Colors.grey.withValues(alpha: 0.3),
              margin: const EdgeInsets.symmetric(horizontal: 16),
            ),
            TextButton(
              onPressed: () {
                setState(() {
                  _step = AuthStep.email;
                  _error = null;
                  for (var c in _otpControllers) {
                    c.clear();
                  }
                });
              },
              child: Text(
                'Change Email',
                style: TextStyle(
                  color: isDark ? Colors.white70 : Colors.black54,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  // =============================================
  // SHARED WIDGETS
  // =============================================

  Widget _buildHeader({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool isDark,
  }) {
    return Column(
      children: [
        // Icon
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            gradient: AppColors.primaryGradient,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.3),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Icon(icon, color: Colors.white, size: 30),
        ).animate().scale(duration: 300.ms, curve: Curves.easeOutBack),
        const SizedBox(height: 20),

        // Title
        Text(
          title,
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w800,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
        const SizedBox(height: 8),

        // Subtitle
        Text(
          subtitle,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 14,
            color: isDark ? Colors.white60 : Colors.black54,
            height: 1.4,
          ),
        ),
      ],
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    required bool isDark,
    TextInputType? keyboardType,
    TextCapitalization textCapitalization = TextCapitalization.none,
    bool autofocus = false,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      textCapitalization: textCapitalization,
      autofocus: autofocus,
      style: TextStyle(
        fontSize: 16,
        color: isDark ? Colors.white : Colors.black87,
      ),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(
          color: isDark ? Colors.white38 : Colors.black38,
        ),
        prefixIcon: Icon(icon, color: AppColors.primary),
        filled: true,
        fillColor: isDark 
            ? Colors.white.withValues(alpha: 0.08)
            : Colors.grey.withValues(alpha: 0.08),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: AppColors.primary, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      ),
      onSubmitted: (_) {
        if (_step == AuthStep.email) _checkEmail();
      },
    );
  }

  Widget _buildPrimaryButton({
    required String label,
    required VoidCallback onPressed,
    bool isLoading = false,
  }) {
    return SizedBox(
      width: double.infinity,
      height: 54,
      child: ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          elevation: 0,
        ),
        child: isLoading
            ? const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  color: Colors.white,
                  strokeWidth: 2.5,
                ),
              )
            : Text(
                label,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
      ),
    );
  }

  Widget _buildError(String message, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.red.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: Colors.red, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: Colors.red, fontSize: 13),
            ),
          ),
        ],
      ),
    ).animate().shake(duration: 300.ms);
  }

  Widget _buildBackRow(bool isDark) {
    return Align(
      alignment: Alignment.centerLeft,
      child: GestureDetector(
        onTap: _goBack,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.arrow_back_ios_rounded,
              size: 18,
              color: isDark ? Colors.white60 : Colors.black54,
            ),
            const SizedBox(width: 4),
            Text(
              'Back',
              style: TextStyle(
                fontSize: 14,
                color: isDark ? Colors.white60 : Colors.black54,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTerms(bool isDark) {
    return Text(
      'By continuing, you agree to our Terms of Service and Privacy Policy',
      textAlign: TextAlign.center,
      style: TextStyle(
        fontSize: 12,
        color: isDark ? Colors.white38 : Colors.black38,
      ),
    );
  }
}
