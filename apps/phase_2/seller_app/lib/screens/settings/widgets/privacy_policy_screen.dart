// lib/screens/settings/widgets/privacy_policy_screen.dart
// 🔒 PREMIUM PRIVACY POLICY SCREEN
// ✨ Glassmorphic, Animated, Professional Design

import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';

class PrivacyPolicyScreen extends StatefulWidget {
  const PrivacyPolicyScreen({super.key});

  @override
  State<PrivacyPolicyScreen> createState() => _PrivacyPolicyScreenState();
}

class _PrivacyPolicyScreenState extends State<PrivacyPolicyScreen>
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
                  
                  _buildHeader(isDark).animate().fadeIn(delay: 100.ms).slideY(begin: 0.1),
                  const SizedBox(height: 24),
                  _buildLastUpdated(isDark).animate().fadeIn(delay: 150.ms),
                  const SizedBox(height: 24),
                  ..._buildPrivacySections(isDark),
                  const SizedBox(height: 24),
                  _buildContactCard(isDark).animate().fadeIn(delay: 800.ms).slideY(begin: 0.1),
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
                child: Icon(Icons.arrow_back_ios_rounded, size: 18, color: isDark ? Colors.white : Colors.black),
              ),
              onPressed: () => Navigator.pop(context),
            ),
            title: Text(
              'Privacy Policy',
              style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.bold, fontSize: 18, color: isDark ? Colors.white : Colors.black),
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
        top: -50, right: -50,
        child: AnimatedBuilder(
          animation: _floatController,
          builder: (context, _) => Transform.translate(
            offset: Offset(0, _floatController.value * 20),
            child: Container(
              width: 200, height: 200,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(colors: [Colors.green.withValues(alpha: 0.3), Colors.green.withValues(alpha: 0.0)]),
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
              gradient: LinearGradient(colors: [Colors.green.shade500, Colors.green.shade700]),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(Icons.security_rounded, color: Colors.white, size: 32),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Your Privacy Matters', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                const SizedBox(height: 4),
                Text('We are committed to protecting your personal and business information.', style: TextStyle(fontSize: 12, color: isDark ? Colors.white70 : Colors.black54)),
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
        color: Colors.green.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.green.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.verified_user_rounded, size: 14, color: Colors.green.shade600),
          const SizedBox(width: 6),
          Text('GDPR Compliant • Last Updated: December 2024', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: Colors.green.shade600)),
        ],
      ),
    );
  }

  List<Widget> _buildPrivacySections(bool isDark) {
    final sections = [
      {'title': 'Information We Collect', 'icon': Icons.folder_outlined, 'items': [
        'Business registration details (PAN, GST, Aadhar)',
        'Contact information (email, phone, address)',
        'Banking details for payouts',
        'Product and inventory information',
        'Order and transaction history',
      ]},
      {'title': 'How We Use Your Data', 'icon': Icons.analytics_outlined, 'items': [
        'Process orders and payments',
        'Verify your identity (KYC)',
        'Provide customer support',
        'Improve our platform and services',
        'Send important updates and notifications',
      ]},
      {'title': 'Data Protection', 'icon': Icons.shield_outlined, 'items': [
        'End-to-end encryption for sensitive data',
        'Secure payment processing (PCI-DSS)',
        'Regular security audits',
        'Access controls and authentication',
        'Data backup and recovery',
      ]},
      {'title': 'Your Rights', 'icon': Icons.policy_outlined, 'items': [
        'Access your personal data',
        'Request data correction',
        'Delete your account and data',
        'Export your data',
        'Opt-out of marketing communications',
      ]},
    ];

    return sections.asMap().entries.map((entry) {
      final index = entry.key;
      final section = entry.value;
      return Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: _buildListSection(section['title'] as String, section['items'] as List<String>, section['icon'] as IconData, isDark)
            .animate().fadeIn(delay: Duration(milliseconds: 200 + index * 100)).slideY(begin: 0.1),
      );
    }).toList();
  }

  Widget _buildListSection(String title, List<String> items, IconData icon, bool isDark) {
    return _buildGlassCard(
      isDark,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: Colors.green.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
                child: Icon(icon, color: Colors.green.shade600, size: 20),
              ),
              const SizedBox(width: 12),
              Text(title, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
            ],
          ),
          const SizedBox(height: 16),
          ...items.map((item) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  margin: const EdgeInsets.only(top: 6),
                  width: 6, height: 6,
                  decoration: BoxDecoration(color: Colors.green.shade400, shape: BoxShape.circle),
                ),
                const SizedBox(width: 12),
                Expanded(child: Text(item, style: TextStyle(fontSize: 13, color: isDark ? Colors.white70 : Colors.black54, height: 1.4))),
              ],
            ),
          )),
        ],
      ),
    );
  }

  Widget _buildContactCard(bool isDark) {
    return _buildGlassCard(
      isDark,
      child: Column(
        children: [
          Icon(Icons.email_outlined, size: 40, color: AppColors.primary),
          const SizedBox(height: 12),
          Text('Questions About Privacy?', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
          const SizedBox(height: 6),
          Text('Contact our Data Protection Officer', style: TextStyle(fontSize: 13, color: isDark ? Colors.white70 : Colors.black54)),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
            child: Text('privacy@letbuyy.com', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.primary)),
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
            border: Border.all(color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1)),
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
    final paint = Paint()..color = (isDark ? Colors.white : Colors.grey).withValues(alpha: 0.03)..strokeWidth = 1;
    for (double x = 0; x < size.width; x += 40) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += 40) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
