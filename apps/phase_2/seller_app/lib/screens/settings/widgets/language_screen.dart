// lib/screens/settings/widgets/language_screen.dart
// 🌐 PREMIUM LANGUAGE SELECTION SCREEN
// ✨ Glassmorphic, Animated, Professional Design

import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_core/letbuyy_core.dart';
import '../../../../providers/locale_provider.dart';

class LanguageScreen extends StatefulWidget {
  const LanguageScreen({super.key});

  @override
  State<LanguageScreen> createState() => _LanguageScreenState();
}

class _LanguageScreenState extends State<LanguageScreen>
    with TickerProviderStateMixin {
  late AnimationController _bgAnimController;
  late AnimationController _floatController;

  final List<Map<String, dynamic>> _languages = [
    {'code': 'en', 'name': 'English', 'native': 'English', 'flag': '🇺🇸', 'progress': 100},
    {'code': 'hi', 'name': 'Hindi', 'native': 'हिन्दी', 'flag': '🇮🇳', 'progress': 95},
    {'code': 'ta', 'name': 'Tamil', 'native': 'தமிழ்', 'flag': '🇮🇳', 'progress': 90},
  ];

  @override
  void initState() {
    super.initState();
    _initAnimations();
  }

  void _initAnimations() {
    _bgAnimController = AnimationController(vsync: this, duration: const Duration(seconds: 25))..repeat();
    _floatController = AnimationController(vsync: this, duration: const Duration(milliseconds: 4000))..repeat(reverse: true);
  }

  @override
  void dispose() {
    _bgAnimController.dispose();
    _floatController.dispose();
    super.dispose();
  }

  void _selectLanguage(String code) {
    final localeProvider = Provider.of<LocaleProvider>(context, listen: false);
    localeProvider.setLocale(Locale(code));
    SnackbarHelper.showSuccess(context, 'Language changed successfully');
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;
    final size = MediaQuery.of(context).size;
    final localeProvider = Provider.of<LocaleProvider>(context);
    final currentLocale = localeProvider.locale.languageCode;

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
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 10),
                  _buildHeader(isDark).animate().fadeIn(delay: 100.ms).slideY(begin: 0.1),
                  const SizedBox(height: 24),
                  _buildSectionTitle('Available Languages', Icons.translate_rounded, isDark).animate().fadeIn(delay: 200.ms),
                  const SizedBox(height: 16),
                  ..._languages.asMap().entries.map((entry) {
                    final index = entry.key;
                    final lang = entry.value;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _buildLanguageCard(lang, currentLocale, isDark)
                          .animate()
                          .fadeIn(delay: Duration(milliseconds: 300 + index * 100))
                          .slideX(begin: 0.1),
                    );
                  }),
                  const SizedBox(height: 24),
                  _buildInfoCard(isDark).animate().fadeIn(delay: 600.ms).slideY(begin: 0.1),
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
                decoration: BoxDecoration(color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                child: Icon(Icons.arrow_back_ios_rounded, size: 18, color: isDark ? Colors.white : Colors.black),
              ),
              onPressed: () => Navigator.pop(context),
            ),
            title: Text('Language', style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.bold, fontSize: 18, color: isDark ? Colors.white : Colors.black)),
          ),
        ),
      ),
    );
  }

  Widget _buildAnimatedBackground(bool isDark) {
    return AnimatedBuilder(
      animation: _bgAnimController,
      builder: (context, _) => LayoutBuilder(
        builder: (context, constraints) => Container(
          width: constraints.maxWidth, height: constraints.maxHeight,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft, end: Alignment.bottomRight,
              colors: isDark
                  ? [const Color(0xFF0F2027), const Color(0xFF203A43), const Color(0xFF2C5364)]
                  : [const Color(0xFFF0F4F8), const Color(0xFFFFFFFF), const Color(0xFFE6E9F0)],
              stops: const [0.0, 0.5, 1.0],
              transform: GradientRotation(_bgAnimController.value * 2 * math.pi),
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _buildFloatingOrbs(bool isDark, Size size) {
    return [
      Positioned(top: -50, right: -50, child: AnimatedBuilder(
        animation: _floatController,
        builder: (context, _) => Transform.translate(
          offset: Offset(0, _floatController.value * 20),
          child: Container(width: 200, height: 200, decoration: BoxDecoration(shape: BoxShape.circle, gradient: RadialGradient(colors: [Colors.teal.withValues(alpha: 0.3), Colors.teal.withValues(alpha: 0.0)]))),
        ),
      )),
    ];
  }

  Widget _buildHeader(bool isDark) {
    return _buildGlassCard(isDark, child: Row(
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(gradient: LinearGradient(colors: [Colors.teal.shade500, Colors.teal.shade700]), borderRadius: BorderRadius.circular(16)),
          child: const Icon(Icons.language_rounded, color: Colors.white, size: 32),
        ),
        const SizedBox(width: 16),
        Expanded(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Choose Your Language', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
            const SizedBox(height: 4),
            Text('The app will be displayed in your selected language', style: TextStyle(fontSize: 12, color: isDark ? Colors.white70 : Colors.black54)),
          ],
        )),
      ],
    ));
  }

  Widget _buildSectionTitle(String title, IconData icon, bool isDark) {
    return Row(children: [
      Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(gradient: LinearGradient(colors: [AppColors.primary, AppColors.primary.withValues(alpha: 0.7)]), borderRadius: BorderRadius.circular(10)),
        child: Icon(icon, color: Colors.white, size: 18),
      ),
      const SizedBox(width: 12),
      Text(title, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
    ]);
  }

  Widget _buildLanguageCard(Map<String, dynamic> lang, String currentLocale, bool isDark) {
    final isSelected = lang['code'] == currentLocale;

    return GestureDetector(
      onTap: () => _selectLanguage(lang['code']),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: isSelected
                  ? LinearGradient(colors: [AppColors.primary.withValues(alpha: 0.2), AppColors.primary.withValues(alpha: 0.1)])
                  : null,
              color: isSelected ? null : (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: isSelected ? AppColors.primary : (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1),
                width: isSelected ? 2 : 1,
              ),
            ),
            child: Row(
              children: [
                // Flag
                Container(
                  width: 50, height: 50,
                  decoration: BoxDecoration(
                    color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(child: Text(lang['flag'], style: const TextStyle(fontSize: 28))),
                ),
                const SizedBox(width: 16),
                // Language Info
                Expanded(child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(lang['name'], style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                        if (isSelected) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(10)),
                            child: const Text('Active', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white)),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(lang['native'], style: TextStyle(fontSize: 13, color: isDark ? Colors.white70 : Colors.black54)),
                    const SizedBox(height: 8),
                    // Translation Progress
                    Row(
                      children: [
                        Expanded(
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: LinearProgressIndicator(
                              value: lang['progress'] / 100,
                              backgroundColor: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1),
                              valueColor: AlwaysStoppedAnimation(lang['progress'] == 100 ? AppColors.success : AppColors.warning),
                              minHeight: 4,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text('${lang['progress']}%', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: isDark ? Colors.white54 : Colors.black45)),
                      ],
                    ),
                  ],
                )),
                // Check Icon
                Container(
                  width: 32, height: 32,
                  decoration: BoxDecoration(
                    color: isSelected ? AppColors.primary : (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    isSelected ? Icons.check_rounded : Icons.arrow_forward_ios_rounded,
                    size: isSelected ? 18 : 14,
                    color: isSelected ? Colors.white : (isDark ? Colors.white54 : Colors.black45),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInfoCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [AppColors.info.withValues(alpha: 0.15), AppColors.info.withValues(alpha: 0.05)]),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.info.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: AppColors.info.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(12)),
            child: Icon(Icons.info_outline_rounded, color: AppColors.info, size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Help us translate!', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                const SizedBox(height: 2),
                Text('Want to see the app in your language? Contact us to contribute translations.', style: TextStyle(fontSize: 12, color: isDark ? Colors.white70 : Colors.black54)),
              ],
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
