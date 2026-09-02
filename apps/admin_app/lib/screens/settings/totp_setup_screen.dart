import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

class TOTPSetupScreen extends StatefulWidget {
  const TOTPSetupScreen({super.key});

  @override
  State<TOTPSetupScreen> createState() => _TOTPSetupScreenState();
}

class _TOTPSetupScreenState extends State<TOTPSetupScreen>
    with SingleTickerProviderStateMixin {
  int _currentStep = 0; // 0: loading, 1: scan QR, 2: verify code
  bool _isLoading = true;
  bool _isVerifying = false;
  String? _secret;
  String? _qrCodeUrl;
  String? _errorMessage;
  final List<TextEditingController> _codeControllers = List.generate(
    6,
    (_) => TextEditingController(),
  );
  final List<FocusNode> _focusNodes = List.generate(6, (_) => FocusNode());
  
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 600),
      vsync: this,
    );
    _fadeAnimation = CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeOut,
    );
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.1),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeOut,
    ));
    _initTOTPSetup();
  }

  @override
  void dispose() {
    _animationController.dispose();
    for (var controller in _codeControllers) {
      controller.dispose();
    }
    for (var node in _focusNodes) {
      node.dispose();
    }
    super.dispose();
  }

  Future<void> _initTOTPSetup() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) throw Exception('Not authenticated');

      final idToken = await user.getIdToken();
      final response = await http.post(
        Uri.parse('https://us-central1-letbuy-y.cloudfunctions.net/initAdminTOTP'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $idToken',
        },
        body: jsonEncode({'userId': user.uid}),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['success'] == true) {
        setState(() {
          _secret = data['secret'];
          _qrCodeUrl = data['qrCodeUri'];
          _currentStep = 1;
          _isLoading = false;
        });
        _animationController.forward();
      } else {
        throw Exception(data['error'] ?? 'Failed to initialize 2FA setup');
      }
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _verifyAndEnable() async {
    final code = _codeControllers.map((c) => c.text).join();
    if (code.length != 6) {
      _showError('Please enter the complete 6-digit code');
      return;
    }

    setState(() {
      _isVerifying = true;
      _errorMessage = null;
    });

    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) throw Exception('Not authenticated');

      final idToken = await user.getIdToken();
      final response = await http.post(
        Uri.parse('https://us-central1-letbuy-y.cloudfunctions.net/enableAdminTOTP'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $idToken',
        },
        body: jsonEncode({
          'userId': user.uid,
          'totpCode': code,
        }),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['success'] == true) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Two-factor authentication enabled successfully!'),
              backgroundColor: Colors.green.shade600,
              behavior: SnackBarBehavior.floating,
            ),
          );
          context.go('/settings');
        }
      } else {
        throw Exception(data['error'] ?? 'Invalid verification code');
      }
    } catch (e) {
      _showError(e.toString());
      setState(() => _isVerifying = false);
    }
  }

  void _showError(String message) {
    setState(() => _errorMessage = message);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red.shade600,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _copySecret() {
    if (_secret != null) {
      Clipboard.setData(ClipboardData(text: _secret!));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Secret key copied to clipboard'),
          backgroundColor: Colors.green.shade600,
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  void _onCodeChanged(int index, String value) {
    setState(() {
      if (value.length == 1 && index < 5) {
        _focusNodes[index + 1].requestFocus();
      } else if (value.isEmpty && index > 0) {
        _focusNodes[index - 1].requestFocus();
      }
    });
    
    // Auto-verify when all 6 digits are entered
    final code = _codeControllers.map((c) => c.text).join();
    if (code.length == 6) {
      _verifyAndEnable();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final size = MediaQuery.of(context).size;
    final isCompact = size.width < 600;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0A0A0F) : const Color(0xFFF8F9FC),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: Icon(
            Icons.arrow_back_ios_rounded,
            color: isDark ? Colors.white : Colors.black87,
          ),
          onPressed: () => context.pop(),
        ),
        title: Text(
          'Set Up Authenticator',
          style: TextStyle(
            color: isDark ? Colors.white : Colors.black87,
            fontWeight: FontWeight.w600,
          ),
        ),
        centerTitle: true,
      ),
      body: _isLoading
          ? _buildLoadingState(isDark)
          : _errorMessage != null && _currentStep == 0
              ? _buildErrorState(isDark)
              : FadeTransition(
                  opacity: _fadeAnimation,
                  child: SlideTransition(
                    position: _slideAnimation,
                    child: SingleChildScrollView(
                      padding: EdgeInsets.symmetric(
                        horizontal: isCompact ? 20 : 40,
                        vertical: 24,
                      ),
                      child: Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 500),
                          child: _currentStep == 1
                              ? _buildQRCodeStep(isDark, isCompact)
                              : _buildVerifyStep(isDark, isCompact),
                        ),
                      ),
                    ),
                  ),
                ),
    );
  }

  Widget _buildLoadingState(bool isDark) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 56,
            height: 56,
            child: CircularProgressIndicator(
              strokeWidth: 3,
              valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'Preparing authenticator setup...',
            style: TextStyle(
              fontSize: 16,
              color: isDark ? Colors.white70 : Colors.black54,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState(bool isDark) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.error_outline_rounded,
              size: 64,
              color: Colors.red.shade400,
            ),
            const SizedBox(height: 16),
            Text(
              'Setup Failed',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _errorMessage ?? 'An error occurred',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: isDark ? Colors.white60 : Colors.black54,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _initTOTPSetup,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Try Again'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQRCodeStep(bool isDark, bool isCompact) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        // Step indicator
        _buildStepIndicator(1, isDark),
        const SizedBox(height: 32),
        
        // Title
        Text(
          'Scan QR Code',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'Open Google Authenticator and scan this QR code to add your account',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 14,
            color: isDark ? Colors.white60 : Colors.black54,
          ),
        ),
        const SizedBox(height: 32),

        // QR Code Card
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.1),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            children: [
              if (_qrCodeUrl != null)
                QrImageView(
                  data: _qrCodeUrl!,
                  version: QrVersions.auto,
                  size: isCompact ? 180 : 220,
                  backgroundColor: Colors.white,
                  eyeStyle: const QrEyeStyle(
                    eyeShape: QrEyeShape.square,
                    color: Colors.black,
                  ),
                  dataModuleStyle: const QrDataModuleStyle(
                    dataModuleShape: QrDataModuleShape.square,
                    color: Colors.black,
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Manual entry section
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark
                ? Colors.white.withValues(alpha: 0.05)
                : Colors.grey.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.1)
                  : Colors.grey.withValues(alpha: 0.2),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "Can't scan? Enter this key manually:",
                style: TextStyle(
                  fontSize: 13,
                  color: isDark ? Colors.white60 : Colors.black54,
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        color: isDark
                            ? Colors.black.withValues(alpha: 0.3)
                            : Colors.grey.shade200,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        _secret ?? '',
                        style: TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: isDark ? Colors.white : Colors.black87,
                          letterSpacing: 1.5,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    onPressed: _copySecret,
                    icon: Icon(
                      Icons.copy_rounded,
                      color: AppColors.primary,
                    ),
                    tooltip: 'Copy to clipboard',
                    style: IconButton.styleFrom(
                      backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 32),

        // Continue button
        SizedBox(
          width: double.infinity,
          height: 52,
          child: ElevatedButton(
            onPressed: () {
              setState(() => _currentStep = 2);
              _focusNodes[0].requestFocus();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: const Text(
              'I\'ve Scanned the Code',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildVerifyStep(bool isDark, bool isCompact) {
    final otpBoxSize = isCompact ? 44.0 : 52.0;
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        // Premium Back Button
        Align(
          alignment: Alignment.centerLeft,
          child: InkWell(
            onTap: () => setState(() => _currentStep = 1),
            borderRadius: BorderRadius.circular(10),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[100],
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.arrow_back_rounded, size: 16, color: isDark ? Colors.grey[400] : Colors.grey[600]),
                  const SizedBox(width: 6),
                  Text(
                    'Back to QR', 
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        
        const SizedBox(height: 24),
        
        // Step indicator
        _buildStepIndicator(2, isDark),
        const SizedBox(height: 32),
        
        // Icon and Title
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                AppColors.primary.withValues(alpha: 0.2),
                const Color(0xFF7C4DFF).withValues(alpha: 0.1),
              ],
            ),
            shape: BoxShape.circle,
          ),
          child: Icon(
            Icons.security_rounded,
            size: 32,
            color: AppColors.primary,
          ),
        ),
        const SizedBox(height: 20),
        
        Text(
          'Verify Setup',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Enter the 6-digit code from\nGoogle Authenticator',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 14,
            color: isDark ? Colors.white60 : Colors.black54,
            height: 1.5,
          ),
        ),
        const SizedBox(height: 40),

        // Premium OTP Input Fields
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(6, (index) {
            return Focus(
              canRequestFocus: false,
              onKeyEvent: (node, event) {
                if (event is KeyDownEvent && 
                    event.logicalKey == LogicalKeyboardKey.backspace) {
                  if (_codeControllers[index].text.isEmpty && index > 0) {
                    _codeControllers[index - 1].clear();
                    _focusNodes[index - 1].requestFocus();
                    setState(() {}); // Refresh UI
                    return KeyEventResult.handled;
                  }
                }
                return KeyEventResult.ignored;
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: otpBoxSize,
                height: otpBoxSize * 1.2,
                margin: EdgeInsets.symmetric(horizontal: isCompact ? 4 : 6),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  gradient: _focusNodes[index].hasFocus 
                      ? LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            AppColors.primary.withValues(alpha: 0.2),
                            const Color(0xFF7C4DFF).withValues(alpha: 0.2),
                          ],
                        )
                      : null,
                  boxShadow: _focusNodes[index].hasFocus 
                      ? [
                          BoxShadow(
                            color: AppColors.primary.withValues(alpha: 0.2),
                            blurRadius: 12,
                            spreadRadius: 1,
                          ),
                        ]
                      : null,
                ),
                child: TextField(
                  controller: _codeControllers[index],
                  focusNode: _focusNodes[index],
                  keyboardType: TextInputType.number,
                  textAlign: TextAlign.center,
                  maxLength: 1,
                  style: TextStyle(
                    fontSize: isCompact ? 22 : 26,
                    fontWeight: FontWeight.w700,
                    color: isDark ? Colors.white : Colors.grey[900],
                  ),
                  decoration: InputDecoration(
                    counterText: '',
                    filled: true,
                    fillColor: isDark 
                        ? (_codeControllers[index].text.isNotEmpty 
                            ? Colors.white.withValues(alpha: 0.08) 
                            : const Color(0xFF1A1A1A))
                        : (_codeControllers[index].text.isNotEmpty 
                            ? AppColors.primary.withValues(alpha: 0.05) 
                            : Colors.grey[50]),
                    contentPadding: EdgeInsets.zero,
                    border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide(
                      color: isDark ? Colors.grey[800]! : Colors.grey[300]!,
                    ),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide(
                      color: _codeControllers[index].text.isNotEmpty 
                          ? AppColors.primary.withValues(alpha: 0.5)
                          : (isDark ? Colors.grey[800]! : Colors.grey[300]!),
                      width: _codeControllers[index].text.isNotEmpty ? 1.5 : 1,
                    ),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide(
                      color: AppColors.primary, 
                      width: 2,
                    ),
                  ),
                ),
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                ],
                onChanged: (value) => _onCodeChanged(index, value),
              ), // TextField
            ), // AnimatedContainer
          ); // Focus
          }),
        ),
        
        if (_errorMessage != null) ...[
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.red.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.error_outline, size: 18, color: Colors.red[400]),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    _errorMessage!,
                    style: TextStyle(
                      color: Colors.red[400],
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 32),

        // Verify button with loading state
        SizedBox(
          width: double.infinity,
          height: 52,
          child: ElevatedButton(
            onPressed: _isVerifying ? null : _verifyAndEnable,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              elevation: 0,
              disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.5),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            child: _isVerifying
                ? Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      ),
                      const SizedBox(width: 12),
                      const Text(
                        'Verifying...',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.verified_user_rounded, size: 20),
                      const SizedBox(width: 8),
                      const Text(
                        'Verify & Enable 2FA',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
          ),
        ),
        
        const SizedBox(height: 24),
        
        // Security note
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: isDark ? Colors.white.withValues(alpha: 0.03) : Colors.grey.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              Icon(
                Icons.info_outline_rounded,
                size: 18,
                color: isDark ? Colors.grey[500] : Colors.grey[600],
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Make sure to save your backup codes after enabling 2FA',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? Colors.grey[500] : Colors.grey[600],
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStepIndicator(int step, bool isDark) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _buildStepDot(1, step, isDark),
        Container(
          width: 40,
          height: 2,
          color: step >= 2
              ? AppColors.primary
              : (isDark ? Colors.white24 : Colors.grey.shade300),
        ),
        _buildStepDot(2, step, isDark),
      ],
    );
  }

  Widget _buildStepDot(int dotStep, int currentStep, bool isDark) {
    final isActive = dotStep <= currentStep;
    final isCurrent = dotStep == currentStep;

    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: isActive
            ? AppColors.primary
            : (isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.shade200),
        border: isCurrent
            ? Border.all(color: AppColors.primary.withValues(alpha: 0.3), width: 4)
            : null,
      ),
      child: Center(
        child: Text(
          '$dotStep',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: isActive
                ? Colors.white
                : (isDark ? Colors.white60 : Colors.black54),
          ),
        ),
      ),
    );
  }
}
