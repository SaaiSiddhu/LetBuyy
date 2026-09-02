// lib/screens/auth/auth_screen.dart
// Marketplace Customer Authentication Screen

import 'dart:async';
import 'dart:convert';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;

// App Imports
import 'package:letbuyy_marketplace/widgets/premium_scaffold.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_core/letbuyy_marketplace_core.dart';
import 'package:letbuyy_marketplace/app/routes.dart';
import '../../providers/auth_provider.dart';

// --- Enums & Helpers ---

enum AuthStep { email, login, register, verifyOTP }

class _Debouncer {
  _Debouncer(this.duration);
  final Duration duration;
  Timer? _timer;
  
  void run(void Function() action) {
    _timer?.cancel();
    _timer = Timer(duration, action);
  }
  
  void dispose() => _timer?.cancel();
}

// --- Main Screen ---

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});
  
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> 
    with SingleTickerProviderStateMixin {
  
  // ---------------------------------------------------------------------------
  // 1. STATE & CONTROLLERS
  // ---------------------------------------------------------------------------
  
  // Text Controllers
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  final _scrollController = ScrollController();

  // Focus Nodes
  final _emailFocus = FocusNode();
  final _passwordFocus = FocusNode();
  final _nameFocus = FocusNode();
  final _phoneFocus = FocusNode();
  final _otpFocus = FocusNode();

  // Simple Animation Controller
  late final AnimationController _fadeController;
  late final Animation<double> _fadeAnimation;

  // Logic State
  AuthStep _currentStep = AuthStep.email;
  bool _isPasswordVisible = false;
  bool _acceptTerms = false;
  bool _rememberMe = false;
  bool _isCheckingEmail = false;
  // ✅ Removed _isKeyboardVisible - using viewInsets.bottom padding instead
  bool _showEmailSuggestions = false;
  bool _phoneNumberValid = false;
  bool _isSuggestionTap = false;
  
  // OTP State
  bool _isSendingOTP = false;
  bool _isVerifyingOTP = false;
  bool _canResendOTP = false;
  int _resendCountdown = 60;
  Timer? _resendTimer;
  
  // Data State
  SharedPreferences? _preferences;
  bool _preferencesReady = false;
  List<String> _emailSuggestions = [];
  double _passwordStrength = 0.0;
  double _formCompletionProgress = 0.0;
  final String _phoneCountryCode = '+91';
  
  final _emailDebouncer = _Debouncer(const Duration(milliseconds: 300));
  
  static const List<String> _commonEmailDomains = [
    'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
    'icloud.com', 'protonmail.com', 'zoho.com', 'aol.com',
  ];

  // ---------------------------------------------------------------------------
  // 2. LIFECYCLE
  // ---------------------------------------------------------------------------

  @override
  void initState() {
    super.initState();
    // ✅ Removed WidgetsBinding.instance.addObserver - no longer needed
    _initializeAnimations();
    _loadPreferences();
    _setupListeners();
  }

  // ✅ Removed didChangeMetrics - keyboard is handled via viewInsets.bottom padding in build()

  @override
  void dispose() {
    // ✅ Removed WidgetsBinding.instance.removeObserver - no longer needed
    _fadeController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _nameController.dispose();
    _phoneController.dispose();
    _otpController.dispose();
    _emailFocus.dispose();
    _passwordFocus.dispose();
    _nameFocus.dispose();
    _phoneFocus.dispose();
    _otpFocus.dispose();
    _scrollController.dispose();
    _emailDebouncer.dispose();
    _resendTimer?.cancel();
    super.dispose();
  }

  void _setupListeners() {
    _emailController.addListener(_handleEmailChange);
    _passwordController.addListener(_handlePasswordChange);
    _phoneController.addListener(_handlePhoneChange);
    _nameController.addListener(_updateFormProgress);
    
    _emailFocus.addListener(() {
      if (!_emailFocus.hasFocus && !_isSuggestionTap) {
        Future.delayed(const Duration(milliseconds: 200), () {
          if (mounted && !_isSuggestionTap) {
            setState(() => _showEmailSuggestions = false);
          }
        });
      } else if (_emailFocus.hasFocus) {
        _handleEmailChange();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 3. ANIMATION SETUP
  // ---------------------------------------------------------------------------

  void _initializeAnimations() {
    _fadeController = AnimationController(
      vsync: this, 
      duration: const Duration(milliseconds: 400)
    );
    
    _fadeAnimation = CurvedAnimation(
      parent: _fadeController, 
      curve: Curves.easeIn
    );

    _fadeController.forward();
  }

  void _restartAnimation() {
    if (mounted) {
      _fadeController.reset();
      _fadeController.forward();
    }
  }

  void _scrollToFocusedField() {
    Future.delayed(const Duration(milliseconds: 300), () {
      if (_scrollController.hasClients && mounted) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 4. BUSINESS LOGIC & VALIDATION
  // ---------------------------------------------------------------------------

  Future<void> _loadPreferences() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (!mounted) return;
      
      setState(() {
        _preferences = prefs;
        _preferencesReady = true;
        _rememberMe = prefs.getBool(StorageConstants.keyRememberMe) ?? false;
        
        final savedEmail = prefs.getString(StorageConstants.keyRememberEmail);
        if (savedEmail != null && savedEmail.isNotEmpty) {
          _emailController.text = savedEmail;
        }
      });
    } catch (e) {
      debugPrint('Auth: Error loading preferences: $e');
    }
  }

  void _handleEmailChange() {
    final email = _emailController.text;
    
    if (email.contains('@') && !email.endsWith('@')) {
      final parts = email.split('@');
      if (parts.length == 2) {
        final localPart = parts[0];
        final domainPart = parts[1].toLowerCase();
        
        if (domainPart.isNotEmpty && domainPart.length < 15) {
          final suggestions = _commonEmailDomains
              .where((d) => d.startsWith(domainPart) && d != domainPart)
              .map((d) => '$localPart@$d')
              .take(5)
              .toList();
          
          if (mounted) {
            setState(() {
              _emailSuggestions = suggestions;
              _showEmailSuggestions = suggestions.isNotEmpty && _emailFocus.hasFocus;
            });
          }
        } else {
          _clearSuggestions();
        }
      }
    } else {
      _clearSuggestions();
    }
    _updateFormProgress();
  }

  void _clearSuggestions() {
    if (mounted) {
      setState(() {
        _emailSuggestions = [];
        _showEmailSuggestions = false;
      });
    }
  }

  void _handlePasswordChange() {
    final password = _passwordController.text;
    if (password.isEmpty) {
      if (mounted) setState(() => _passwordStrength = 0.0);
      _updateFormProgress();
      return;
    }

    double strength = 0.0;
    if (password.length >= 8) strength += 0.15;
    if (password.length >= 12) strength += 0.10;
    if (password.length >= 16) strength += 0.05;
    if (password.contains(RegExp(r'[A-Z]'))) strength += 0.20;
    if (password.contains(RegExp(r'[a-z]'))) strength += 0.20;
    if (password.contains(RegExp(r'\d'))) strength += 0.15;
    if (password.contains(RegExp(r'[!@#$%^&*(),.?":{}|<>]'))) strength += 0.15;
    
    if (mounted) setState(() => _passwordStrength = strength.clamp(0.0, 1.0));
    _updateFormProgress();
  }

  void _handlePhoneChange() {
    final phone = _phoneController.text.trim();
    final isValid = phone.isEmpty ? false : RegExp(r'^[6-9]\d{9}$').hasMatch(phone);
    if (mounted) setState(() => _phoneNumberValid = isValid);
    _updateFormProgress();
  }

  void _updateFormProgress() {
    if (_currentStep != AuthStep.register || !mounted) return;
    
    int completedFields = 0;
    if (_emailController.text.isNotEmpty && Validators.validateEmail(_emailController.text) == null) completedFields++;
    if (_passwordController.text.isNotEmpty && _validatePassword(_passwordController.text) == null) completedFields++;
    if (_nameController.text.isNotEmpty && Validators.validateName(_nameController.text) == null) completedFields++;
    if (_phoneController.text.isNotEmpty && _phoneNumberValid) completedFields++;
    
    setState(() => _formCompletionProgress = completedFields / 4);
  }

  String? _validatePassword(String? value) {
    if (value == null || value.isEmpty) return 'Password is required';
    if (value.length < 8) return 'Password must be at least 8 characters';
    return null;
  }

  void _startResendTimer() {
    if (!mounted) return;
    
    setState(() {
      _canResendOTP = false;
      _resendCountdown = 60;
    });

    _resendTimer?.cancel();
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      
      if (_resendCountdown > 0) {
        setState(() => _resendCountdown--);
      } else {
        timer.cancel();
        if (mounted) setState(() => _canResendOTP = true);
      }
    });
  }

  // --- Actions ---

  Future<void> _handleEmailContinue() async {
    HapticFeedback.mediumImpact();
    final email = _emailController.text.trim();
    
    if (email.isEmpty || Validators.validateEmail(email) != null) {
      _showSnackBar('Please enter a valid email address', isError: true);
      return;
    }

    if (!mounted) return;
    setState(() => _isCheckingEmail = true);

    try {
      final authProvider = context.read<AuthProvider>();
      final existsAsUser = await authProvider.checkUserExists(email);

      if (!mounted) return;
      setState(() => _isCheckingEmail = false);

      setState(() {
        _currentStep = existsAsUser ? AuthStep.login : AuthStep.register;
        _showEmailSuggestions = false;
      });

      _restartAnimation();
      
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          FocusScope.of(context).requestFocus(_passwordFocus);
        }
      });
      
    } catch (e) {
      if (mounted) {
        setState(() => _isCheckingEmail = false);
        _showSnackBar('Connection error. Please try again.', isError: true);
      }
    }
  }

  Future<void> _handleSubmit() async {
    if (!mounted) return;
    
    HapticFeedback.mediumImpact();
    
    if (!_formKey.currentState!.validate()) {
      HapticFeedback.vibrate();
      return;
    }

    if (_currentStep == AuthStep.register && !_acceptTerms) {
      _showSnackBar('Please accept the Terms & Conditions', isError: true);
      return;
    }

    final email = _emailController.text.trim();
    final password = _passwordController.text;

    // HANDLE LOGIN
    if (_currentStep == AuthStep.login) {
      if (!mounted) return;
      
      final authProvider = context.read<AuthProvider>();
      
      try {
        final success = await authProvider.signInWithEmail(email: email, password: password);

        if (!mounted) return;

        if (success) {
          await _saveUserSession(email);
          HapticFeedback.heavyImpact();
          if (mounted) _navigateToMain();
        } else {
          HapticFeedback.vibrate();
          _showSnackBar(authProvider.error ?? 'Authentication failed', isError: true);
        }
      } catch (e) {
        if (mounted) {
          HapticFeedback.vibrate();
          _showSnackBar(e.toString(), isError: true);
        }
      }
      return;
    }

    // HANDLE REGISTRATION (Send OTP)
    if (_currentStep == AuthStep.register) {
      await _sendOTPEmail();
    }
  }

  Future<void> _sendOTPEmail() async {
    if (!mounted) return;
    
    setState(() => _isSendingOTP = true);

    try {
      final email = _emailController.text.trim();
      final name = _nameController.text.trim();

      const functionUrl = 'https://us-central1-letbuy-y.cloudfunctions.net/sendEmailVerificationOTP';
      final response = await http.post(
        Uri.parse(functionUrl),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'data': {
            'email': email,
            'userName': name,
          }
        }),
      );

      if (!mounted) return;

      final result = jsonDecode(response.body);
      final data = result['result'] ?? result;

      if (data['success'] == true) {
        setState(() {
          _isSendingOTP = false;
          _currentStep = AuthStep.verifyOTP;
        });
        _startResendTimer();
        _restartAnimation();
        
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) {
            FocusScope.of(context).requestFocus(_otpFocus);
          }
        });
        
        _showSnackBar('Verification code sent to your email', isError: false);
      } else {
        throw Exception(data['message'] ?? 'Failed to send OTP');
      }
    } catch (e) {
      if (!mounted) return;
      
      setState(() => _isSendingOTP = false);
      _showSnackBar('Failed to send code: ${e.toString()}', isError: true);
    }
  }

  Future<void> _verifyOTP() async {
    final otp = _otpController.text.trim();

    if (otp.isEmpty || otp.length != 6) {
      _showSnackBar('Please enter a valid 6-digit code', isError: true);
      return;
    }

    if (!mounted) return;
    
    setState(() => _isVerifyingOTP = true);
    HapticFeedback.mediumImpact();

    try {
      final email = _emailController.text.trim();

      const functionUrl = 'https://us-central1-letbuy-y.cloudfunctions.net/verifyEmailOTP';
      final response = await http.post(
        Uri.parse(functionUrl),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'data': {
            'email': email,
            'otp': otp,
          }
        }),
      );

      if (!mounted) return;

      final result = jsonDecode(response.body);
      final data = result['result'] ?? result;

      if (data['success'] != true) {
        throw Exception(data['message'] ?? 'Verification failed');
      }

      // Create Firebase Auth Account
      final authProvider = context.read<AuthProvider>();
      final password = _passwordController.text;
      final name = _nameController.text.trim();
      final phone = '$_phoneCountryCode${_phoneController.text.trim()}';

      final success = await authProvider.registerWithEmail(
        email: email,
        password: password,
        name: name,
        phone: phone,
      );

      if (!mounted) return;

      if (success) {
        HapticFeedback.heavyImpact();
        _showSnackBar('Account created successfully!', isError: false);
        
        await _saveUserSession(email);
        await Future.delayed(const Duration(milliseconds: 800));
        
        if (mounted) _navigateToMain();
      } else {
        throw Exception(authProvider.error ?? 'Registration failed');
      }
    } catch (e) {
      if (!mounted) return;
      
      setState(() => _isVerifyingOTP = false);
      HapticFeedback.vibrate();
      _showSnackBar(e.toString(), isError: true);
    }
  }

  Future<void> _resendOTP() async {
    if (!_canResendOTP || !mounted) return;

    setState(() => _isSendingOTP = true);
    HapticFeedback.lightImpact();

    try {
      final email = _emailController.text.trim();

      const functionUrl = 'https://us-central1-letbuy-y.cloudfunctions.net/resendEmailVerificationOTP';
      final response = await http.post(
        Uri.parse(functionUrl),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'data': {'email': email}
        }),
      );

      if (!mounted) return;

      final result = jsonDecode(response.body);
      final data = result['result'] ?? result;

      if (data['success'] == true) {
        _showSnackBar('Verification code resent!', isError: false);
        _startResendTimer();
      } else {
        throw Exception(data['message'] ?? 'Failed to resend OTP');
      }
    } catch (e) {
      if (!mounted) return;
      _showSnackBar('Failed to resend: ${e.toString()}', isError: true);
    } finally {
      if (mounted) {
        setState(() => _isSendingOTP = false);
      }
    }
  }

  Future<void> _saveUserSession(String email) async {
    if (!_preferencesReady || _preferences == null) return;
    try {
      await _preferences!.setString(StorageConstants.keyUserType, 'buyer');
      await _preferences!.setBool(StorageConstants.keyRememberMe, _rememberMe);
      await _preferences!.setString(StorageConstants.keyRememberEmail, email);
      await _preferences!.setInt(StorageConstants.keyLastLoginTime, 
        DateTime.now().millisecondsSinceEpoch);
      await _preferences!.setString(StorageConstants.keyUserRole, 'user');
      await _preferences!.setBool(StorageConstants.keyIsLoggedIn, true);
    } catch (e) {
      debugPrint('Auth: Session save error: $e');
    }
  }

  void _navigateToMain() {
    if (!mounted) return;
    Navigator.of(context).pushNamedAndRemoveUntil(AppRoutes.main, (route) => false);
  }

  void _resetToEmailStep() {
    if (!mounted) return;
    
    HapticFeedback.lightImpact();
    setState(() {
      _currentStep = AuthStep.email;
      _isPasswordVisible = false;
      _acceptTerms = false;
      _showEmailSuggestions = false;
      _passwordStrength = 0.0;
      _phoneNumberValid = false;
      _formCompletionProgress = 0.0;
    });

    if (!_rememberMe) _emailController.clear();
    _passwordController.clear();
    _nameController.clear();
    _phoneController.clear();
    _otpController.clear();

    _resendTimer?.cancel();

    _restartAnimation();
    
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        FocusScope.of(context).requestFocus(_emailFocus);
      }
    });
  }

  void _showSnackBar(String message, {required bool isError}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? AppColors.error : AppColors.success,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // 5. BUILD METHOD
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    // ✅ FIX: Use sizeOf (not .size) for width only - doesn't rebuild on keyboard
    final screenWidth = MediaQuery.sizeOf(context).width;
    // ✅ FIX: Get keyboard inset separately - this IS allowed to trigger rebuild
    final keyboardInset = MediaQuery.of(context).viewInsets.bottom;
    
    // 🚀 WEB OPTIMIZATION: Wrap with GestureDetector for tap-to-dismiss keyboard
    return GestureDetector(
      onTap: () => FocusScope.of(context).unfocus(),
      child: PremiumScaffold(
        // resizeToAvoidBottomInset is handled internally
        // backgroundColor is handled internally
        body: SingleChildScrollView(
          controller: _scrollController,
          physics: const ClampingScrollPhysics(),
          // ✅ KEY FIX: Add keyboard padding ONLY to bottom - this moves form with keyboard
          padding: EdgeInsets.only(
            left: 24, 
            right: 24, 
            top: MediaQuery.of(context).padding.top + 24, // Status bar + spacing
            // ✅ This is the KEY fix - only form content shifts up with keyboard
            bottom: keyboardInset + 24,
          ),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 16),
                
                // Logo & Branding
                _buildHeader(isDark),
                
                const SizedBox(height: 40),
                
                // Current Step Content
                _buildCurrentStep(isDark),
                
                const SizedBox(height: 40),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(bool isDark) {
    String title;
    String subtitle;
    
    switch (_currentStep) {
      case AuthStep.email:
        title = 'Welcome to LetBuyy';
        subtitle = 'Shop from thousands of verified sellers';
        break;
      case AuthStep.login:
        title = 'Welcome Back!';
        subtitle = 'Sign in to continue shopping';
        break;
      case AuthStep.register:
        title = 'Create Account';
        subtitle = 'Join millions of happy shoppers';
        break;
      case AuthStep.verifyOTP:
        title = 'Verify Email';
        subtitle = 'Enter the code sent to your email';
        break;
    }
    
    return Column(
      children: [
        // Logo
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                AppColors.primary,
                AppColors.primary.withValues(alpha: 0.7),
              ],
            ),
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.3),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: const Icon(Icons.shopping_bag_rounded, color: Colors.white, size: 40),
        ),
        const SizedBox(height: 24),
        
        Text(
          title,
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.bold,
            color: isDark ? Colors.white : Colors.black87,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          subtitle,
          style: TextStyle(
            fontSize: 16,
            color: isDark ? Colors.grey[400] : Colors.grey[600],
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildCurrentStep(bool isDark) {
    switch (_currentStep) {
      case AuthStep.email:
        return _buildEmailStep(isDark);
      case AuthStep.login:
        return _buildLoginStep(isDark);
      case AuthStep.register:
        return _buildRegisterStep(isDark);
      case AuthStep.verifyOTP:
        return _buildOTPStep(isDark);
    }
  }

  Widget _buildEmailStep(bool isDark) {
    return Column(
      children: [
        // Email Field
        _buildTextField(
          controller: _emailController,
          focusNode: _emailFocus,
          label: 'Email Address',
          hint: 'Enter your email',
          icon: Icons.email_outlined,
          keyboardType: TextInputType.emailAddress,
          isDark: isDark,
          validator: Validators.validateEmail,
        ),
        
        // Email Suggestions
        if (_showEmailSuggestions && _emailSuggestions.isNotEmpty)
          Container(
            margin: const EdgeInsets.only(top: 8),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1E1E2E) : Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.1),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              children: _emailSuggestions.map((email) => ListTile(
                dense: true,
                leading: Icon(Icons.email_outlined, 
                  color: AppColors.primary, size: 20),
                title: Text(email),
                onTap: () {
                  _isSuggestionTap = true;
                  _emailController.text = email;
                  setState(() {
                    _showEmailSuggestions = false;
                    _isSuggestionTap = false;
                  });
                },
              )).toList(),
            ),
          ),
        
        const SizedBox(height: 24),
        
        // Continue Button
        _buildPrimaryButton(
          label: 'Continue',
          onPressed: _handleEmailContinue,
          isLoading: _isCheckingEmail,
          isDark: isDark,
        ),
        
        const SizedBox(height: 24),
        
        // Divider
        Row(
          children: [
            Expanded(child: Divider(color: isDark ? Colors.grey[700] : Colors.grey[300])),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text('or', style: TextStyle(color: Colors.grey[500])),
            ),
            Expanded(child: Divider(color: isDark ? Colors.grey[700] : Colors.grey[300])),
          ],
        ),
        
        const SizedBox(height: 24),
        
        // Google Sign In
        _buildSocialButton(
          label: 'Continue with Google',
          icon: 'G',
          onPressed: _handleGoogleSignIn,
          isDark: isDark,
        ),
      ],
    );
  }

  Widget _buildLoginStep(bool isDark) {
    return Column(
      children: [
        // Email (read-only)
        _buildTextField(
          controller: _emailController,
          label: 'Email',
          hint: '',
          icon: Icons.email_outlined,
          isDark: isDark,
          readOnly: true,
          onTap: _resetToEmailStep,
        ),
        
        const SizedBox(height: 20),
        
        // Password
        _buildTextField(
          controller: _passwordController,
          focusNode: _passwordFocus,
          label: 'Password',
          hint: 'Enter your password',
          icon: Icons.lock_outline,
          isDark: isDark,
          obscureText: !_isPasswordVisible,
          suffixIcon: IconButton(
            icon: Icon(
              _isPasswordVisible ? Icons.visibility_off : Icons.visibility,
              color: Colors.grey,
            ),
            onPressed: () => setState(() => _isPasswordVisible = !_isPasswordVisible),
          ),
          validator: _validatePassword,
        ),
        
        const SizedBox(height: 12),
        
        // Remember Me & Forgot Password
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                SizedBox(
                  width: 24,
                  height: 24,
                  child: Checkbox(
                    value: _rememberMe,
                    onChanged: (v) => setState(() => _rememberMe = v ?? false),
                    activeColor: AppColors.primary,
                  ),
                ),
                const SizedBox(width: 8),
                Text('Remember me', 
                  style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600])),
              ],
            ),
            TextButton(
              onPressed: () {
                // TODO: Implement forgot password
              },
              child: Text('Forgot Password?', 
                style: TextStyle(color: AppColors.primary)),
            ),
          ],
        ),
        
        const SizedBox(height: 24),
        
        // Sign In Button
        _buildPrimaryButton(
          label: 'Sign In',
          onPressed: _handleSubmit,
          isLoading: context.watch<AuthProvider>().isLoading,
          isDark: isDark,
        ),
        
        const SizedBox(height: 16),
        
        // Back Button
        TextButton(
          onPressed: _resetToEmailStep,
          child: Text('Use a different email', 
            style: TextStyle(color: AppColors.primary)),
        ),
      ],
    );
  }

  Widget _buildRegisterStep(bool isDark) {
    return Column(
      children: [
        // Progress Indicator
        if (_formCompletionProgress > 0)
          Padding(
            padding: const EdgeInsets.only(bottom: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Form Progress', 
                      style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                    Text('${(_formCompletionProgress * 100).toInt()}%', 
                      style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
                  ],
                ),
                const SizedBox(height: 8),
                LinearProgressIndicator(
                  value: _formCompletionProgress,
                  backgroundColor: isDark ? Colors.grey[800] : Colors.grey[200],
                  valueColor: AlwaysStoppedAnimation(AppColors.primary),
                  borderRadius: BorderRadius.circular(4),
                ),
              ],
            ),
          ),
        
        // Name
        _buildTextField(
          controller: _nameController,
          focusNode: _nameFocus,
          label: 'Full Name',
          hint: 'Enter your full name',
          icon: Icons.person_outline,
          isDark: isDark,
          validator: Validators.validateName,
        ),
        
        const SizedBox(height: 20),
        
        // Email (read-only)
        _buildTextField(
          controller: _emailController,
          label: 'Email',
          hint: '',
          icon: Icons.email_outlined,
          isDark: isDark,
          readOnly: true,
          onTap: _resetToEmailStep,
        ),
        
        const SizedBox(height: 20),
        
        // Phone
        _buildTextField(
          controller: _phoneController,
          focusNode: _phoneFocus,
          label: 'Phone Number',
          hint: '9876543210',
          icon: Icons.phone_outlined,
          isDark: isDark,
          keyboardType: TextInputType.phone,
          prefix: Text('$_phoneCountryCode ', 
            style: TextStyle(color: isDark ? Colors.white : Colors.black87)),
          suffixIcon: _phoneNumberValid 
            ? Icon(Icons.check_circle, color: AppColors.success) : null,
        ),
        
        const SizedBox(height: 20),
        
        // Password
        _buildTextField(
          controller: _passwordController,
          focusNode: _passwordFocus,
          label: 'Password',
          hint: 'Create a strong password',
          icon: Icons.lock_outline,
          isDark: isDark,
          obscureText: !_isPasswordVisible,
          suffixIcon: IconButton(
            icon: Icon(
              _isPasswordVisible ? Icons.visibility_off : Icons.visibility,
              color: Colors.grey,
            ),
            onPressed: () => setState(() => _isPasswordVisible = !_isPasswordVisible),
          ),
          validator: _validatePassword,
        ),
        
        // Password Strength
        if (_passwordController.text.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(
              children: [
                Expanded(
                  child: LinearProgressIndicator(
                    value: _passwordStrength,
                    backgroundColor: isDark ? Colors.grey[800] : Colors.grey[200],
                    valueColor: AlwaysStoppedAnimation(
                      _passwordStrength < 0.4 ? AppColors.error :
                      _passwordStrength < 0.7 ? AppColors.warning : AppColors.success
                    ),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  _passwordStrength < 0.4 ? 'Weak' :
                  _passwordStrength < 0.7 ? 'Medium' : 'Strong',
                  style: TextStyle(
                    color: _passwordStrength < 0.4 ? AppColors.error :
                           _passwordStrength < 0.7 ? AppColors.warning : AppColors.success,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        
        const SizedBox(height: 20),
        
        // Terms & Conditions
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 24,
              height: 24,
              child: Checkbox(
                value: _acceptTerms,
                onChanged: (v) => setState(() => _acceptTerms = v ?? false),
                activeColor: AppColors.primary,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: RichText(
                text: TextSpan(
                  style: TextStyle(
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                    fontSize: 13,
                  ),
                  children: [
                    const TextSpan(text: 'I agree to the '),
                    TextSpan(
                      text: 'Terms & Conditions',
                      style: TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                      recognizer: TapGestureRecognizer()..onTap = () {
                        // TODO: Show terms
                      },
                    ),
                    const TextSpan(text: ' and '),
                    TextSpan(
                      text: 'Privacy Policy',
                      style: TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                      recognizer: TapGestureRecognizer()..onTap = () {
                        // TODO: Show privacy policy
                      },
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        
        const SizedBox(height: 24),
        
        // Create Account Button
        _buildPrimaryButton(
          label: 'Create Account',
          onPressed: _handleSubmit,
          isLoading: _isSendingOTP,
          isDark: isDark,
        ),
        
        const SizedBox(height: 16),
        
        // Back Button
        TextButton(
          onPressed: _resetToEmailStep,
          child: Text('Use a different email', 
            style: TextStyle(color: AppColors.primary)),
        ),
      ],
    );
  }

  Widget _buildOTPStep(bool isDark) {
    return Column(
      children: [
        // OTP Info
        Container(
          padding: const EdgeInsets.all(16),
          margin: const EdgeInsets.only(bottom: 24),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Icon(Icons.email_outlined, color: AppColors.primary),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Verification code sent to:', 
                      style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                    Text(_emailController.text, 
                      style: TextStyle(fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            ],
          ),
        ),
        
        // OTP Input
        _buildTextField(
          controller: _otpController,
          focusNode: _otpFocus,
          label: '6-Digit Code',
          hint: 'Enter code',
          icon: Icons.pin_outlined,
          isDark: isDark,
          keyboardType: TextInputType.number,
          maxLength: 6,
        ),
        
        const SizedBox(height: 16),
        
        // Resend Timer
        if (!_canResendOTP)
          Text(
            'Resend code in $_resendCountdown seconds',
            style: TextStyle(color: Colors.grey[600]),
          )
        else
          TextButton(
            onPressed: _resendOTP,
            child: Text('Resend Code', 
              style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
          ),
        
        const SizedBox(height: 24),
        
        // Verify Button
        _buildPrimaryButton(
          label: 'Verify & Create Account',
          onPressed: _verifyOTP,
          isLoading: _isVerifyingOTP,
          isDark: isDark,
        ),
        
        const SizedBox(height: 16),
        
        // Back Button
        TextButton(
          onPressed: () {
            _resendTimer?.cancel();
            setState(() => _currentStep = AuthStep.register);
            _restartAnimation();
          },
          child: Text('Change email', 
            style: TextStyle(color: AppColors.primary)),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // 6. REUSABLE WIDGETS
  // ---------------------------------------------------------------------------

  Widget _buildTextField({
    required TextEditingController controller,
    FocusNode? focusNode,
    required String label,
    required String hint,
    required IconData icon,
    required bool isDark,
    bool obscureText = false,
    bool readOnly = false,
    TextInputType? keyboardType,
    Widget? suffixIcon,
    Widget? prefix,
    int? maxLength,
    String? Function(String?)? validator,
    VoidCallback? onTap,
  }) {
    return TextFormField(
      controller: controller,
      focusNode: focusNode,
      obscureText: obscureText,
      readOnly: readOnly,
      keyboardType: keyboardType,
      maxLength: maxLength,
      onTap: onTap,
      validator: validator,
      style: TextStyle(
        color: isDark ? Colors.white : Colors.black87,
        fontSize: 16,
      ),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        prefixIcon: Icon(icon, color: AppColors.primary),
        prefix: prefix,
        suffixIcon: suffixIcon,
        counterText: '',
        filled: true,
        fillColor: isDark ? const Color(0xFF1E1E2E) : Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(
            color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: AppColors.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.error),
        ),
      ),
    );
  }

  Widget _buildPrimaryButton({
    required String label,
    required VoidCallback onPressed,
    required bool isDark,
    bool isLoading = false,
  }) {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          elevation: 0,
        ),
        child: isLoading
            ? const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation(Colors.white),
                ),
              )
            : Text(
                label,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
      ),
    );
  }

  Widget _buildSocialButton({
    required String label,
    required String icon,
    required VoidCallback onPressed,
    required bool isDark,
  }) {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          side: BorderSide(color: isDark ? Colors.grey[700]! : Colors.grey[300]!),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                color: AppColors.error,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Center(
                child: Text(
                  icon,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Text(
              label,
              style: TextStyle(
                color: isDark ? Colors.white : Colors.black87,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _handleGoogleSignIn() async {
    HapticFeedback.mediumImpact();
    
    try {
      final authProvider = context.read<AuthProvider>();
      final success = await authProvider.signInWithGoogle();
      
      if (!mounted) return;
      
      if (success) {
        final email = authProvider.currentUser?.email ?? '';
        await _saveUserSession(email);
        HapticFeedback.heavyImpact();
        _navigateToMain();
      } else {
        _showSnackBar(authProvider.error ?? 'Google sign in failed', isError: true);
      }
    } catch (e) {
      if (mounted) {
        _showSnackBar(e.toString(), isError: true);
      }
    }
  }
}
