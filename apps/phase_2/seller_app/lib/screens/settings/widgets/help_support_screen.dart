// lib/screens/settings/widgets/help_support_screen.dart
// 🆘 PREMIUM HELP & SUPPORT SCREEN
// ✨ Glassmorphic, Animated, Professional Design

import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:url_launcher/url_launcher.dart';

class HelpSupportScreen extends StatefulWidget {
  const HelpSupportScreen({super.key});

  @override
  State<HelpSupportScreen> createState() => _HelpSupportScreenState();
}

class _HelpSupportScreenState extends State<HelpSupportScreen>
    with TickerProviderStateMixin {
  late AnimationController _bgAnimController;
  late AnimationController _floatController;
  int? _expandedFaqIndex;

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

  Future<void> _launchUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
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
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 10),
                  _buildHeader(isDark).animate().fadeIn(delay: 100.ms).slideY(begin: 0.1),
                  const SizedBox(height: 24),
                  _buildQuickActions(isDark).animate().fadeIn(delay: 200.ms).slideY(begin: 0.1),
                  const SizedBox(height: 24),
                  _buildSectionTitle('Frequently Asked Questions', Icons.quiz_rounded, isDark).animate().fadeIn(delay: 300.ms),
                  const SizedBox(height: 16),
                  _buildFAQSection(isDark).animate().fadeIn(delay: 400.ms).slideY(begin: 0.1),
                  const SizedBox(height: 24),
                  _buildSectionTitle('Contact Us', Icons.contact_support_rounded, isDark).animate().fadeIn(delay: 500.ms),
                  const SizedBox(height: 16),
                  _buildContactOptions(isDark).animate().fadeIn(delay: 600.ms).slideY(begin: 0.1),
                  const SizedBox(height: 24),
                  _buildEmergencyCard(isDark).animate().fadeIn(delay: 700.ms).slideY(begin: 0.1),
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
            title: Text('Help & Support', style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.bold, fontSize: 18, color: isDark ? Colors.white : Colors.black)),
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
          child: Container(width: 200, height: 200, decoration: BoxDecoration(shape: BoxShape.circle, gradient: RadialGradient(colors: [Colors.blue.withValues(alpha: 0.3), Colors.blue.withValues(alpha: 0.0)]))),
        ),
      )),
    ];
  }

  Widget _buildHeader(bool isDark) {
    return _buildGlassCard(isDark, child: Row(
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(gradient: LinearGradient(colors: [Colors.blue.shade500, Colors.blue.shade700]), borderRadius: BorderRadius.circular(16)),
          child: const Icon(Icons.support_agent_rounded, color: Colors.white, size: 32),
        ),
        const SizedBox(width: 16),
        Expanded(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('How can we help?', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
            const SizedBox(height: 4),
            Text('We\'re here to assist you 24/7', style: TextStyle(fontSize: 13, color: isDark ? Colors.white70 : Colors.black54)),
          ],
        )),
      ],
    ));
  }

  Widget _buildQuickActions(bool isDark) {
    final actions = [
      {'icon': Icons.chat_bubble_rounded, 'label': 'Live Chat', 'color': Colors.blue},
      {'icon': Icons.phone_rounded, 'label': 'Call Us', 'color': Colors.green},
      {'icon': Icons.email_rounded, 'label': 'Email', 'color': Colors.orange},
      {'icon': Icons.article_rounded, 'label': 'Guides', 'color': Colors.purple},
    ];

    return Row(
      children: actions.map((a) => Expanded(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: InkWell(
            onTap: () {
              if (a['label'] == 'Call Us') {
                _launchUrl('tel:+919876543210');
              } else if (a['label'] == 'Email') _launchUrl('mailto:support@letbuyy.com');
            },
            borderRadius: BorderRadius.circular(16),
            child: _buildGlassCard(isDark, padding: 16, child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: (a['color'] as Color).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                  child: Icon(a['icon'] as IconData, color: a['color'] as Color, size: 24),
                ),
                const SizedBox(height: 8),
                Text(a['label'] as String, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: isDark ? Colors.white : Colors.black87)),
              ],
            )),
          ),
        ),
      )).toList(),
    );
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

  Widget _buildFAQSection(bool isDark) {
    final faqs = [
      {'q': 'How do I add products?', 'a': 'Go to Products → Add Product. Fill in the details, upload images, set pricing and inventory, then publish.'},
      {'q': 'When will I receive payouts?', 'a': 'Payouts are processed every 7 days. You can view pending and completed payouts in the Wallet section.'},
      {'q': 'How to handle returns?', 'a': 'When a return request comes in, review it in Orders → Returns. Approve or reject based on your return policy.'},
      {'q': 'How to update bank details?', 'a': 'Go to Settings → Bank Details. You can update your account information for receiving payouts.'},
      {'q': 'What if my KYC is rejected?', 'a': 'Review the rejection reason in KYC Status. Fix the issues mentioned and resubmit your documents.'},
    ];

    return _buildGlassCard(isDark, child: Column(
      children: faqs.asMap().entries.map((entry) {
        final index = entry.key;
        final faq = entry.value;
        final isExpanded = _expandedFaqIndex == index;

        return Column(
          children: [
            InkWell(
              onTap: () => setState(() => _expandedFaqIndex = isExpanded ? null : index),
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Row(
                  children: [
                    Container(
                      width: 28, height: 28,
                      decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), shape: BoxShape.circle),
                      child: Center(child: Text('${index + 1}', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primary))),
                    ),
                    const SizedBox(width: 12),
                    Expanded(child: Text(faq['q']!, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: isDark ? Colors.white : Colors.black87))),
                    Icon(isExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down, color: isDark ? Colors.white54 : Colors.black45),
                  ],
                ),
              ),
            ),
            AnimatedCrossFade(
              firstChild: const SizedBox.shrink(),
              secondChild: Padding(
                padding: const EdgeInsets.only(left: 40, bottom: 12),
                child: Text(faq['a']!, style: TextStyle(fontSize: 13, color: isDark ? Colors.white70 : Colors.black54, height: 1.5)),
              ),
              crossFadeState: isExpanded ? CrossFadeState.showSecond : CrossFadeState.showFirst,
              duration: const Duration(milliseconds: 200),
            ),
            if (index < faqs.length - 1) Divider(color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1), height: 1),
          ],
        );
      }).toList(),
    ));
  }

  Widget _buildContactOptions(bool isDark) {
    final contacts = [
      {'icon': Icons.phone_rounded, 'title': 'Phone Support', 'subtitle': '+91 98765 43210', 'action': 'tel:+919876543210'},
      {'icon': Icons.email_rounded, 'title': 'Email Support', 'subtitle': 'support@letbuyy.com', 'action': 'mailto:support@letbuyy.com'},
      {'icon': Icons.access_time_rounded, 'title': 'Working Hours', 'subtitle': 'Mon-Sat: 9AM - 9PM', 'action': null},
    ];

    return _buildGlassCard(isDark, child: Column(
      children: contacts.asMap().entries.map((entry) {
        final index = entry.key;
        final c = entry.value;
        return Column(
          children: [
            InkWell(
              onTap: c['action'] != null ? () => _launchUrl(c['action'] as String) : null,
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                      child: Icon(c['icon'] as IconData, color: AppColors.primary, size: 22),
                    ),
                    const SizedBox(width: 14),
                    Expanded(child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(c['title'] as String, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: isDark ? Colors.white : Colors.black87)),
                        Text(c['subtitle'] as String, style: TextStyle(fontSize: 12, color: isDark ? Colors.white54 : Colors.black45)),
                      ],
                    )),
                    if (c['action'] != null) Icon(Icons.arrow_forward_ios_rounded, size: 14, color: isDark ? Colors.white38 : Colors.black26),
                  ],
                ),
              ),
            ),
            if (index < contacts.length - 1) Divider(color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1), height: 1),
          ],
        );
      }).toList(),
    ));
  }

  Widget _buildEmergencyCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [Colors.red.withValues(alpha: 0.15), Colors.red.withValues(alpha: 0.05)]),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: Colors.red.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(12)),
            child: const Icon(Icons.warning_amber_rounded, color: Colors.red, size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Report an Issue', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                const SizedBox(height: 2),
                Text('For urgent issues, contact us immediately', style: TextStyle(fontSize: 12, color: isDark ? Colors.white70 : Colors.black54)),
              ],
            ),
          ),
          OutlinedButton(
            onPressed: () => _launchUrl('tel:+919876543210'),
            style: OutlinedButton.styleFrom(foregroundColor: Colors.red, side: const BorderSide(color: Colors.red), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
            child: const Text('Call Now', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _buildGlassCard(bool isDark, {required Widget child, double padding = 20}) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: EdgeInsets.all(padding),
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
