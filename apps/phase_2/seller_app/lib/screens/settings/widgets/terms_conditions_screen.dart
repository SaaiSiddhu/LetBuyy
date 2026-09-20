// lib/screens/settings/widgets/terms_conditions_screen.dart
// 📜 PREMIUM TERMS & CONDITIONS SCREEN
// ✨ Glassmorphic, Animated, Professional Design

import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';

class TermsConditionsScreen extends StatefulWidget {
  const TermsConditionsScreen({super.key});

  @override
  State<TermsConditionsScreen> createState() => _TermsConditionsScreenState();
}

class _TermsConditionsScreenState extends State<TermsConditionsScreen>
    with TickerProviderStateMixin {
  late AnimationController _bgAnimController;
  late AnimationController _floatController;

  @override
  void initState() {
    super.initState();
    _initAnimations();
  }

  void _initAnimations() {
    _bgAnimController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 25),
    )..repeat();

    _floatController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4000),
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
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;
    final size = MediaQuery.of(context).size;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF080B12) : const Color(0xFFF0F4F8),
      extendBodyBehindAppBar: true,
      appBar: _buildGlassmorphicAppBar(isDark),
      body: Stack(
        children: [
          _buildAnimatedBackground(isDark),
          ..._buildFloatingOrbs(isDark, size),
          Positioned.fill(
            child: CustomPaint(painter: _GridPatternPainter(isDark: isDark)),
          ),
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              physics: const BouncingScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 10),
                  
                  // Header
                  _buildHeader(isDark).animate().fadeIn(delay: 100.ms).slideY(begin: 0.1),
                  
                  const SizedBox(height: 24),
                  
                  // Last Updated
                  _buildLastUpdated(isDark).animate().fadeIn(delay: 150.ms),
                  
                  const SizedBox(height: 24),
                  
                  // Sections
                  ..._buildTermsSections(isDark),
                  
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildGlassmorphicAppBar(bool isDark) {
    return PreferredSize(
      preferredSize: const Size.fromHeight(70),
      child: ClipRRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: AppBar(
            backgroundColor: (isDark ? Colors.black : Colors.white).withValues(alpha: 0.1),
            elevation: 0,
            centerTitle: true,
            leading: IconButton(
              icon: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  Icons.arrow_back_ios_rounded,
                  size: 18,
                  color: isDark ? Colors.white : Colors.black,
                ),
              ),
              onPressed: () => Navigator.pop(context),
            ),
            title: Text(
              'Terms & Conditions',
              style: TextStyle(
                fontFamily: 'Inter',
                fontWeight: FontWeight.bold,
                fontSize: 18,
                color: isDark ? Colors.white : Colors.black,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAnimatedBackground(bool isDark) {
    return AnimatedBuilder(
      animation: _bgAnimController,
      builder: (context, child) {
        return LayoutBuilder(
          builder: (context, constraints) {
            return Container(
              width: constraints.maxWidth,
              height: constraints.maxHeight,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: isDark
                      ? [const Color(0xFF0F2027), const Color(0xFF203A43), const Color(0xFF2C5364)]
                      : [const Color(0xFFF0F4F8), const Color(0xFFFFFFFF), const Color(0xFFE6E9F0)],
                  stops: const [0.0, 0.5, 1.0],
                  transform: GradientRotation(_bgAnimController.value * 2 * math.pi),
                ),
              ),
            );
          },
        );
      },
    );
  }

  List<Widget> _buildFloatingOrbs(bool isDark, Size size) {
    return [
      Positioned(
        top: -50,
        right: -50,
        child: AnimatedBuilder(
          animation: _floatController,
          builder: (context, _) => Transform.translate(
            offset: Offset(0, _floatController.value * 20),
            child: Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppColors.primary.withValues(alpha: 0.3),
                    AppColors.primary.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    ];
  }

  Widget _buildHeader(bool isDark) {
    return _buildGlassCard(
      isDark,
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.primary, AppColors.primary.withValues(alpha: 0.7)],
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(Icons.gavel_rounded, color: Colors.white, size: 32),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Seller Terms of Service',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Please read these terms carefully before using the LetBuyy seller platform.',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? Colors.white70 : Colors.black54,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLastUpdated(bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.info.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.info.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.update_rounded, size: 14, color: AppColors.info),
          const SizedBox(width: 6),
          Text(
            'Last Updated: December 2024',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: AppColors.info,
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildTermsSections(bool isDark) {
    final sections = [
      {
        'title': '1. Acceptance of Terms',
        'icon': Icons.check_circle_outline_rounded,
        'content': 'By creating a seller account on LetBuyy, you agree to be bound by these Terms & Conditions. If you do not agree to all of these terms, you may not use our seller platform.',
      },
      {
        'title': '2. Seller Account',
        'icon': Icons.person_outline_rounded,
        'content': 'You must provide accurate business information during registration. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.',
      },
      {
        'title': '3. Product Listings',
        'icon': Icons.inventory_2_outlined,
        'content': 'All product listings must be accurate and comply with applicable laws. Prohibited items include counterfeit goods, illegal products, and items that violate intellectual property rights.',
      },
      {
        'title': '4. Pricing & Payments',
        'icon': Icons.payments_outlined,
        'content': 'You set your own prices. LetBuyy charges a commission on each sale. Payouts are processed according to the payout schedule after deducting applicable fees.',
      },
      {
        'title': '5. Order Fulfillment',
        'icon': Icons.local_shipping_outlined,
        'content': 'You must fulfill orders within the specified timeframe. Late shipments or cancellations may affect your seller rating and account standing.',
      },
      {
        'title': '6. Returns & Refunds',
        'icon': Icons.assignment_return_outlined,
        'content': 'You must accept returns as per our return policy. Refunds should be processed within the specified timeline upon receiving returned items.',
      },
      {
        'title': '7. Account Termination',
        'icon': Icons.block_outlined,
        'content': 'LetBuyy reserves the right to suspend or terminate seller accounts that violate these terms, engage in fraudulent activities, or receive excessive negative feedback.',
      },
    ];

    return sections.asMap().entries.map((entry) {
      final index = entry.key;
      final section = entry.value;
      return Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: _buildSection(
          section['title'] as String,
          section['content'] as String,
          section['icon'] as IconData,
          isDark,
        ).animate().fadeIn(delay: Duration(milliseconds: 200 + index * 100)).slideY(begin: 0.1),
      );
    }).toList();
  }

  Widget _buildSection(String title, String content, IconData icon, bool isDark) {
    return _buildGlassCard(
      isDark,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: AppColors.primary, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            content,
            style: TextStyle(
              fontSize: 14,
              color: isDark ? Colors.white70 : Colors.black54,
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGlassCard(bool isDark, {required Widget child}) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1),
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}

class _GridPatternPainter extends CustomPainter {
  final bool isDark;
  _GridPatternPainter({required this.isDark});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = (isDark ? Colors.white : Colors.grey).withValues(alpha: 0.03)
      ..strokeWidth = 1;
    
    const spacing = 40.0;
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
