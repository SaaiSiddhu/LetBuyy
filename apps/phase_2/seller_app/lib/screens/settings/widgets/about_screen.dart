// lib/screens/settings/widgets/about_screen.dart
// ℹ️ PREMIUM ABOUT SCREEN
// ✨ Glassmorphic, Animated, Professional Design

import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:package_info_plus/package_info_plus.dart';

class AboutScreen extends StatefulWidget {
  const AboutScreen({super.key});

  @override
  State<AboutScreen> createState() => _AboutScreenState();
}

class _AboutScreenState extends State<AboutScreen>
    with TickerProviderStateMixin {
  late AnimationController _bgAnimController;
  late AnimationController _floatController;
  late AnimationController _logoAnimController;
  String _appVersion = '';
  String _buildNumber = '';

  @override
  void initState() {
    super.initState();
    _initAnimations();
    _loadAppInfo();
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

    _logoAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3000),
    )..repeat(reverse: true);
  }

  Future<void> _loadAppInfo() async {
    final info = await PackageInfo.fromPlatform();
    setState(() {
      _appVersion = info.version;
      _buildNumber = info.buildNumber;
    });
  }

  @override
  void dispose() {
    _bgAnimController.dispose();
    _floatController.dispose();
    _logoAnimController.dispose();
    super.dispose();
  }

  Future<void> _launchUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
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
          Positioned.fill(child: CustomPaint(painter: _GridPatternPainter(isDark: isDark))),
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              physics: const BouncingScrollPhysics(),
              child: Column(
                children: [
                  const SizedBox(height: 20),
                  _buildLogoSection(isDark).animate().fadeIn(delay: 100.ms).scale(begin: const Offset(0.9, 0.9)),
                  const SizedBox(height: 32),
                  _buildAppInfoCard(isDark).animate().fadeIn(delay: 200.ms).slideY(begin: 0.1),
                  const SizedBox(height: 20),
                  _buildFeaturesList(isDark).animate().fadeIn(delay: 300.ms).slideY(begin: 0.1),
                  const SizedBox(height: 20),
                  _buildSocialLinks(isDark).animate().fadeIn(delay: 400.ms).slideY(begin: 0.1),
                  const SizedBox(height: 20),
                  _buildLegalSection(isDark).animate().fadeIn(delay: 500.ms).slideY(begin: 0.1),
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
            title: Text('About', style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.bold, fontSize: 18, color: isDark ? Colors.white : Colors.black)),
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
                gradient: RadialGradient(colors: [AppColors.primary.withValues(alpha: 0.3), AppColors.primary.withValues(alpha: 0.0)]),
              ),
            ),
          ),
        ),
      ),
      Positioned(
        bottom: 100, left: -80,
        child: AnimatedBuilder(
          animation: _floatController,
          builder: (context, _) => Transform.translate(
            offset: Offset(0, -_floatController.value * 15),
            child: Container(
              width: 150, height: 150,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(colors: [Colors.purple.withValues(alpha: 0.2), Colors.purple.withValues(alpha: 0.0)]),
              ),
            ),
          ),
        ),
      ),
    ];
  }

  Widget _buildLogoSection(bool isDark) {
    return Column(
      children: [
        AnimatedBuilder(
          animation: _logoAnimController,
          builder: (context, child) {
            return Container(
              padding: EdgeInsets.all(4 + _logoAnimController.value * 3),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  colors: [AppColors.primary, Colors.purple, AppColors.primary],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.3 + _logoAnimController.value * 0.2),
                    blurRadius: 20 + _logoAnimController.value * 10,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: child,
            );
          },
          child: Container(
            width: 100,
            height: 100,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isDark ? const Color(0xFF1A1A2E) : Colors.white,
            ),
            child: ClipOval(
              child: Image.asset(
                'assets/images/letbuyy_logo.png',
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => Icon(Icons.shopping_bag_rounded, size: 50, color: AppColors.primary),
              ),
            ),
          ),
        ),
        const SizedBox(height: 20),
        ShaderMask(
          shaderCallback: (bounds) => LinearGradient(
            colors: [AppColors.primary, Colors.purple],
          ).createShader(bounds),
          child: const Text(
            'LetBuyy',
            style: TextStyle(fontSize: 36, fontWeight: FontWeight.bold, color: Colors.white),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Seller Platform',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: isDark ? Colors.white70 : Colors.black54),
        ),
      ],
    );
  }

  Widget _buildAppInfoCard(bool isDark) {
    return _buildGlassCard(
      isDark,
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildInfoItem('Version', _appVersion.isNotEmpty ? _appVersion : '1.0.0', Icons.info_outline_rounded, isDark),
              Container(width: 1, height: 40, color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1)),
              _buildInfoItem('Build', _buildNumber.isNotEmpty ? _buildNumber : '1', Icons.build_rounded, isDark),
              Container(width: 1, height: 40, color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1)),
              _buildInfoItem('Platform', 'Flutter', Icons.flutter_dash, isDark),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInfoItem(String label, String value, IconData icon, bool isDark) {
    return Column(
      children: [
        Icon(icon, size: 24, color: AppColors.primary),
        const SizedBox(height: 8),
        Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(fontSize: 11, color: isDark ? Colors.white54 : Colors.black45)),
      ],
    );
  }

  Widget _buildFeaturesList(bool isDark) {
    final features = [
      {'icon': Icons.trending_up_rounded, 'title': 'Grow Your Business', 'desc': 'Reach millions of customers'},
      {'icon': Icons.payments_rounded, 'title': 'Secure Payments', 'desc': 'Fast & reliable payouts'},
      {'icon': Icons.analytics_rounded, 'title': 'Analytics', 'desc': 'Insights to optimize sales'},
      {'icon': Icons.support_agent_rounded, 'title': '24/7 Support', 'desc': 'Always here to help'},
    ];

    return _buildGlassCard(
      isDark,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Why LetBuyy?', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
          const SizedBox(height: 16),
          ...features.map((f) => Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                  child: Icon(f['icon'] as IconData, color: AppColors.primary, size: 22),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(f['title'] as String, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: isDark ? Colors.white : Colors.black87)),
                      Text(f['desc'] as String, style: TextStyle(fontSize: 12, color: isDark ? Colors.white54 : Colors.black45)),
                    ],
                  ),
                ),
              ],
            ),
          )),
        ],
      ),
    );
  }

  Widget _buildSocialLinks(bool isDark) {
    final socials = [
      {'icon': Icons.language_rounded, 'label': 'Website', 'url': 'https://letbuyy.com'},
      {'icon': Icons.phone_rounded, 'label': 'Contact', 'url': 'tel:+919876543210'},
      {'icon': Icons.email_rounded, 'label': 'Email', 'url': 'mailto:support@letbuyy.com'},
    ];

    return _buildGlassCard(
      isDark,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: socials.map((s) {
          return InkWell(
            onTap: () => _launchUrl(s['url'] as String),
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: [AppColors.primary, AppColors.primary.withValues(alpha: 0.7)]),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(s['icon'] as IconData, color: Colors.white, size: 22),
                  ),
                  const SizedBox(height: 8),
                  Text(s['label'] as String, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: isDark ? Colors.white70 : Colors.black54)),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildLegalSection(bool isDark) {
    return Column(
      children: [
        Text('Made with ❤️ in India', style: TextStyle(fontSize: 13, color: isDark ? Colors.white54 : Colors.black45)),
        const SizedBox(height: 8),
        Text('© 2024 LetBuyy. All rights reserved.', style: TextStyle(fontSize: 11, color: isDark ? Colors.white38 : Colors.black26)),
      ],
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
