// lib/screens/auth/seller_welcome_screen.dart
// Premium onboarding screen for new sellers - matches Login/Auth screens theme

import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../app/routes.dart';

class SellerWelcomeScreen extends StatefulWidget {
  const SellerWelcomeScreen({super.key});

  @override
  State<SellerWelcomeScreen> createState() => _SellerWelcomeScreenState();
}

class _SellerWelcomeScreenState extends State<SellerWelcomeScreen>
    with TickerProviderStateMixin {
  // Animation controllers
  late AnimationController _bgAnimController;
  late AnimationController _floatController;

  @override
  void initState() {
    super.initState();
    // Background gradient animation
    _bgAnimController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 10),
    )..repeat();

    // Floating orbs animation
    _floatController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _bgAnimController.dispose();
    _floatController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final size = MediaQuery.of(context).size;
    final isMobile = size.width < 600;
    
    // Get status bar and navigation bar heights
    final topPadding = MediaQuery.of(context).padding.top;
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    // Set system UI overlay style to match background
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: isDark ? Brightness.light : Brightness.dark,
        statusBarBrightness: isDark ? Brightness.dark : Brightness.light,
        systemNavigationBarColor: isDark ? const Color(0xFF080B12) : const Color(0xFFF0F4F8),
        systemNavigationBarIconBrightness: isDark ? Brightness.light : Brightness.dark,
      ),
      child: Scaffold(
        // Remove default background - we handle it in Stack
        backgroundColor: Colors.transparent,
        body: Container(
          // Full screen container with background color
          width: double.infinity,
          height: double.infinity,
          color: isDark ? const Color(0xFF080B12) : const Color(0xFFF0F4F8),
          child: Stack(
            fit: StackFit.expand,
            children: [
              // Animated background - full screen
              Positioned.fill(
                child: _buildAnimatedBackground(isDark),
              ),
              // Floating orbs - full screen
              ..._buildFloatingOrbs(size, isDark),
              // Grid pattern overlay - full screen
              Positioned.fill(
                child: CustomPaint(
                  painter: _GridPatternPainter(isDark: isDark),
                ),
              ),
              // Main content with manual padding instead of SafeArea
              Positioned.fill(
                child: SingleChildScrollView(
                  padding: EdgeInsets.only(
                    left: isMobile ? 24 : 48,
                    right: isMobile ? 24 : 48,
                    top: topPadding + 32,  // Status bar + extra padding
                    bottom: bottomPadding + 32,  // Navigation bar + extra padding
                  ),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 480),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          // Branding Header
                          _buildBrandingHeader(isDark),
                          
                          const SizedBox(height: 40),
                          
                          // Main Welcome Card
                          _buildWelcomeCard(isDark, isMobile),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBrandingHeader(bool isDark) {
    return Column(
      children: [
        // App Logo - using actual app icon
        Container(
          width: 88,
          height: 88,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.4),
                blurRadius: 30,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: Image.asset(
              'assets/icons/app_icon.png',
              width: 88,
              height: 88,
              fit: BoxFit.cover,
            ),
          ),
        )
            .animate()
            .scale(duration: 600.ms, curve: Curves.easeOutBack)
            .fadeIn(),
        
        const SizedBox(height: 24),
        
        // Title
        Text(
          'LetBuyy Seller Portal',
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.w900,
            color: isDark ? Colors.white : const Color(0xFF111827),
            letterSpacing: -0.5,
          ),
        ).animate(delay: 200.ms).fadeIn().slideY(begin: 0.2),
        
        const SizedBox(height: 8),
        
        // Subtitle
        Text(
          'Business Management System',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: isDark ? Colors.grey[500] : Colors.grey[600],
            letterSpacing: 1.5,
          ),
        ).animate(delay: 300.ms).fadeIn(),
      ],
    );
  }

  Widget _buildWelcomeCard(bool isDark, bool isMobile) {
    return Container(
      decoration: BoxDecoration(
        color: isDark 
            ? Colors.black.withValues(alpha: 0.4) 
            : Colors.white.withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.shade200,
        ),
        boxShadow: [
          BoxShadow(
            color: isDark 
                ? Colors.black.withValues(alpha: 0.3) 
                : Colors.black.withValues(alpha: 0.08),
            blurRadius: 40,
            offset: const Offset(0, 20),
          ),
        ],
      ),
      child: Padding(
        padding: EdgeInsets.all(isMobile ? 24 : 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Welcome Header
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF10B981).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(
                    Icons.celebration_rounded,
                    color: Color(0xFF10B981),
                    size: 24,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Welcome to LetBuyy! 🎉',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: isDark ? Colors.white : const Color(0xFF111827),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Complete setup to start selling',
                        style: TextStyle(
                          fontSize: 13,
                          color: isDark ? Colors.grey[500] : Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ).animate(delay: 400.ms).fadeIn().slideX(begin: -0.1),
            
            const SizedBox(height: 28),
            
            // Progress indicator
            _buildProgressIndicator(isDark),
            
            const SizedBox(height: 28),
            
            // Steps list
            _buildStepsList(isDark),
            
            const SizedBox(height: 32),
            
            // CTA Button
            _buildCtaButton(isDark),
            
            const SizedBox(height: 20),
            
            // Footer text
            Center(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.lock_rounded,
                    size: 14,
                    color: isDark ? Colors.grey[600] : Colors.grey[500],
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'Secure & Encrypted Process',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? Colors.grey[600] : Colors.grey[500],
                    ),
                  ),
                ],
              ),
            ).animate(delay: 900.ms).fadeIn(),
          ],
        ),
      ),
    ).animate(delay: 400.ms).fadeIn().scale(begin: const Offset(0.95, 0.95));
  }

  Widget _buildProgressIndicator(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Setup Progress',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.grey[400] : Colors.grey[600],
              ),
            ),
            Text(
              '0% Complete',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppColors.primary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        // Progress bar
        Container(
          height: 6,
          decoration: BoxDecoration(
            color: isDark ? Colors.grey[800] : Colors.grey[200],
            borderRadius: BorderRadius.circular(10),
          ),
          child: FractionallySizedBox(
            widthFactor: 0.0, // 0% progress
            alignment: Alignment.centerLeft,
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppColors.primary, AppColors.primaryLight],
                ),
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),
        ),
      ],
    ).animate(delay: 500.ms).fadeIn();
  }

  Widget _buildStepsList(bool isDark) {
    final steps = [
      _StepData(
        icon: Icons.person_outline_rounded,
        title: 'Business Details',
        subtitle: 'Store name & contact info',
        isCompleted: false,
        isActive: true,
      ),
      _StepData(
        icon: Icons.verified_user_outlined,
        title: 'KYC Verification',
        subtitle: 'PAN, Aadhaar & Selfie',
        isCompleted: false,
        isActive: false,
      ),
      _StepData(
        icon: Icons.account_balance_outlined,
        title: 'Bank Account',
        subtitle: 'For receiving payments',
        isCompleted: false,
        isActive: false,
      ),
    ];

    return Column(
      children: steps.asMap().entries.map((entry) {
        final index = entry.key;
        final step = entry.value;
        final isLast = index == steps.length - 1;
        
        return _buildStepItem(step, isDark, isLast, index);
      }).toList(),
    );
  }

  Widget _buildStepItem(_StepData step, bool isDark, bool isLast, int index) {
    final delay = Duration(milliseconds: 500 + (index * 100));
    
    return Padding(
      padding: EdgeInsets.only(bottom: isLast ? 0 : 16),
      child: Row(
        children: [
          // Step indicator
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: step.isActive
                  ? AppColors.primary.withValues(alpha: 0.15)
                  : (step.isCompleted
                      ? const Color(0xFF10B981).withValues(alpha: 0.15)
                      : (isDark ? Colors.grey[850] : Colors.grey[100])),
              borderRadius: BorderRadius.circular(14),
              border: step.isActive
                  ? Border.all(color: AppColors.primary.withValues(alpha: 0.3), width: 2)
                  : null,
            ),
            child: Icon(
              step.isCompleted ? Icons.check_rounded : step.icon,
              size: 22,
              color: step.isActive
                  ? AppColors.primary
                  : (step.isCompleted
                      ? const Color(0xFF10B981)
                      : (isDark ? Colors.grey[600] : Colors.grey[500])),
            ),
          ),
          
          const SizedBox(width: 16),
          
          // Step content
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  step.title,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: step.isActive
                        ? (isDark ? Colors.white : const Color(0xFF111827))
                        : (isDark ? Colors.grey[400] : Colors.grey[600]),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  step.subtitle,
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? Colors.grey[600] : Colors.grey[500],
                  ),
                ),
              ],
            ),
          ),
          
          // Arrow indicator for active step
          if (step.isActive)
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.arrow_forward_rounded,
                size: 16,
                color: AppColors.primary,
              ),
            ),
        ],
      ),
    ).animate(delay: delay).fadeIn().slideX(begin: 0.1);
  }

  Widget _buildCtaButton(bool isDark) {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton(
        onPressed: () {
          HapticFeedback.mediumImpact();
          Navigator.pushReplacementNamed(context, AppRoutes.kycBusiness);
        },
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF111827),
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          elevation: 0,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text(
              "Let's Get Started",
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.3,
              ),
            ),
            const SizedBox(width: 10),
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.arrow_forward_rounded,
                size: 18,
              ),
            ),
          ],
        ),
      ),
    ).animate(delay: 800.ms).fadeIn().slideY(begin: 0.2);
  }

  // ═══════════════════════════════════════════════════════════
  // BACKGROUND EFFECTS (matching Login screen)
  // ═══════════════════════════════════════════════════════════
  
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
                  ? [
                      AppColors.primary.withValues(alpha: 0.15),
                      const Color(0xFF080B12),
                      const Color(0xFF080B12),
                    ]
                  : [
                      AppColors.primary.withValues(alpha: 0.1),
                      const Color(0xFFF0F4F8),
                      const Color(0xFFF0F4F8),
                    ],
            ),
          ),
        );
      },
    );
  }

  List<Widget> _buildFloatingOrbs(Size size, bool isDark) {
    return [
      // Top-right orb
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
                    colors: [
                      AppColors.primary.withValues(alpha: 0.3),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
      // Bottom-left orb
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
                    colors: [
                      Colors.cyan.withValues(alpha: 0.2),
                      Colors.transparent,
                    ],
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

// Step data model
class _StepData {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool isCompleted;
  final bool isActive;

  _StepData({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.isCompleted,
    required this.isActive,
  });
}

// Grid pattern painter (matching Login screen)
class _GridPatternPainter extends CustomPainter {
  final bool isDark;
  final double opacity;

  _GridPatternPainter({this.isDark = false, this.opacity = 0.03});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.grey.withValues(alpha: opacity)
      ..strokeWidth = 0.5;

    const spacing = 50.0;

    // Vertical lines
    for (double x = 0; x < size.width; x += spacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }

    // Horizontal lines
    for (double y = 0; y < size.height; y += spacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
