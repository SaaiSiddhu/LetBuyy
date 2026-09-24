// lib/screens/kyc/suspended_screen.dart
// 🚫 ACCOUNT SUSPENDED SCREEN - Professional Design
// ✨ Matches KYC Status Screen Aesthetics
// 📱 Fully responsive with premium animations

import 'dart:ui';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../app/routes.dart';
import '../../providers/seller_provider.dart';

class SuspendedScreen extends StatefulWidget {
  const SuspendedScreen({super.key});

  @override
  State<SuspendedScreen> createState() => _SuspendedScreenState();
}

class _SuspendedScreenState extends State<SuspendedScreen> with TickerProviderStateMixin {
  late AnimationController _bgAnimController;
  late AnimationController _floatController;
  late AnimationController _pulseController;
  late AnimationController _shakeController;

  // Support email and phone
  static const String _supportEmail = 'support@letbuyy.com';
  static const String _supportPhone = '+91 9876543210';

  @override
  void initState() {
    super.initState();
    _initAnimations();
    _setSystemUI();
  }

  void _setSystemUI() {
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ));
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

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);

    _shakeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
  }

  @override
  void dispose() {
    _bgAnimController.dispose();
    _floatController.dispose();
    _pulseController.dispose();
    _shakeController.dispose();
    super.dispose();
  }

  /// Open email client with support template
  Future<void> _contactSupport() async {
    final sellerProvider = context.read<SellerProvider>();
    final seller = sellerProvider.currentSeller;
    
    final subject = Uri.encodeComponent('Account Suspension Appeal - ${seller?.storeName ?? 'Seller'}');
    final body = Uri.encodeComponent('''
Dear LetBuyy Support Team,

I am writing to appeal my account suspension.

Seller Details:
- Store Name: ${seller?.storeName ?? 'N/A'}
- Seller ID: ${seller?.sellerId ?? 'N/A'}
- Email: ${seller?.email ?? 'N/A'}
- Phone: ${seller?.phone ?? 'N/A'}

I would like to understand the reason for this suspension and request a review of my account.

Thank you,
${seller?.storeName ?? 'Seller'}
''');
    
    final emailUri = Uri.parse('mailto:$_supportEmail?subject=$subject&body=$body');
    
    try {
      if (await canLaunchUrl(emailUri)) {
        await launchUrl(emailUri);
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Unable to open email. Contact $_supportEmail'),
              backgroundColor: AppColors.error,
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          );
        }
      }
    } catch (e) {
      debugPrint('Email launch error: $e');
    }
  }

  /// Call support
  Future<void> _callSupport() async {
    final phoneUri = Uri.parse('tel:$_supportPhone');
    try {
      if (await canLaunchUrl(phoneUri)) {
        await launchUrl(phoneUri);
      }
    } catch (e) {
      debugPrint('Phone launch error: $e');
    }
  }

  /// Sign out and go to login
  Future<void> _signOut() async {
    try {
      await FirebaseAuth.instance.signOut();
      if (mounted) {
        Navigator.pushNamedAndRemoveUntil(context, AppRoutes.login, (route) => false);
      }
    } catch (e) {
      debugPrint('Sign out error: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final sellerProvider = context.watch<SellerProvider>();
    final seller = sellerProvider.currentSeller;
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final size = MediaQuery.of(context).size;

    return PopScope(
      canPop: false, // Prevent back navigation
      child: Scaffold(
        backgroundColor: isDark ? const Color(0xFF0D0D10) : const Color(0xFFF5F5F7),
        extendBodyBehindAppBar: true,
        appBar: PreferredSize(
          preferredSize: const Size.fromHeight(70),
          child: ClipRRect(
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
              child: AppBar(
                backgroundColor: Colors.transparent,
                elevation: 0,
                centerTitle: true,
                automaticallyImplyLeading: false,
                title: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.gpp_bad_rounded,
                      color: Colors.red[400],
                      size: 24,
                    ),
                    const SizedBox(width: 10),
                    Text(
                      'Account Suspended',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontWeight: FontWeight.bold,
                        color: isDark ? Colors.white : Colors.black,
                        fontSize: 18,
                      ),
                    ),
                  ],
                ),
                actions: [
                  IconButton(
                    icon: Icon(Icons.logout_rounded, color: isDark ? Colors.white70 : Colors.black54, size: 22),
                    onPressed: _signOut,
                    tooltip: 'Sign Out',
                  ),
                  const SizedBox(width: 8),
                ],
              ),
            ),
          ),
        ),
        body: Stack(
          children: [
            // Animated Background
            _buildAnimatedBackground(isDark),
            _buildFloatingOrbs(isDark, size),
            Positioned.fill(child: CustomPaint(painter: _GridPatternPainter(isDark: isDark))),
            
            SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                physics: const BouncingScrollPhysics(),
                child: Center(
                  child: Column(
                    children: [
                      const SizedBox(height: 20),
                      _buildMainCard(context, seller, isDark, theme, size),
                      const SizedBox(height: 24),
                      _buildReasonCard(seller, isDark),
                      const SizedBox(height: 24),
                      _buildSupportOptions(isDark, theme),
                      const SizedBox(height: 24),
                      _buildFAQSection(isDark),
                      const SizedBox(height: 40),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMainCard(BuildContext context, SellerModel? seller, bool isDark, ThemeData theme, Size size) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 500),
      padding: const EdgeInsets.all(40),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1E) : Colors.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(
          color: Colors.red.withValues(alpha: 0.2),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.red.withValues(alpha: 0.1),
            blurRadius: 40,
            offset: const Offset(0, 10),
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 60,
            offset: const Offset(0, 20),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Pulsing Shield Icon
          AnimatedBuilder(
            animation: _pulseController,
            builder: (context, _) => Transform.scale(
              scale: 1.0 + (_pulseController.value * 0.05),
              child: Container(
                width: 130,
                height: 130,
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    colors: [
                      Colors.red.withValues(alpha: 0.15),
                      Colors.red.withValues(alpha: 0.05),
                      Colors.transparent,
                    ],
                  ),
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Container(
                    width: 100,
                    height: 100,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          Colors.red.shade600,
                          Colors.red.shade800,
                        ],
                      ),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.red.withValues(alpha: 0.4),
                          blurRadius: 20 + (_pulseController.value * 10),
                          spreadRadius: _pulseController.value * 5,
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.shield_rounded,
                      size: 50,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ),
          ).animate().scale(duration: 600.ms, curve: Curves.elasticOut),
          
          const SizedBox(height: 32),
          
          // Title
          Text(
            'Your Account is Suspended',
            style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              color: isDark ? Colors.white : const Color(0xFF111827),
              letterSpacing: -0.5,
              height: 1.2,
            ),
            textAlign: TextAlign.center,
          ).animate().fadeIn(delay: 200.ms).slideY(begin: 0.1),
          
          const SizedBox(height: 16),
          
          // Status Badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Colors.red.shade700.withValues(alpha: 0.15),
                  Colors.red.shade900.withValues(alpha: 0.15),
                ],
              ),
              borderRadius: BorderRadius.circular(30),
              border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.block_rounded, size: 16, color: Colors.red.shade400),
                const SizedBox(width: 8),
                Text(
                  'SUSPENDED',
                  style: TextStyle(
                    color: Colors.red.shade400,
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                    letterSpacing: 1.5,
                  ),
                ),
              ],
            ),
          ).animate().fadeIn(delay: 300.ms),
          
          const SizedBox(height: 24),
          
          // Description
          Text(
            'Access to your seller account has been temporarily suspended. You cannot list products, receive orders, or access payouts at this time.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: isDark ? Colors.grey[400] : Colors.grey[600],
              fontSize: 15,
              height: 1.7,
            ),
          ).animate().fadeIn(delay: 400.ms),
          
          const SizedBox(height: 28),
          
          // Alert Box
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark ? Colors.orange.withValues(alpha: 0.1) : const Color(0xFFFEF3C7),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isDark ? Colors.orange.withValues(alpha: 0.3) : const Color(0xFFFCD34D),
              ),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.orange.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    Icons.info_outline_rounded,
                    color: isDark ? Colors.orange.shade300 : Colors.orange.shade700,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Review the reason below and contact support if you believe this is an error.',
                    style: TextStyle(
                      color: isDark ? Colors.orange.shade200 : const Color(0xFF92400E),
                      fontSize: 13,
                      height: 1.4,
                    ),
                  ),
                ),
              ],
            ),
          ).animate().fadeIn(delay: 500.ms),
        ],
      ),
    ).animate().fadeIn().slideY(begin: 0.05);
  }

  Widget _buildReasonCard(SellerModel? seller, bool isDark) {
    final reason = seller?.rejectionReason ?? 'Policy violation detected. Please contact support for details.';
    
    return Container(
      constraints: const BoxConstraints(maxWidth: 500),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: isDark ? Colors.red.shade900.withValues(alpha: 0.2) : const Color(0xFFFEE2E2),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark ? Colors.red.withValues(alpha: 0.3) : const Color(0xFFFCA5A5),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  Icons.report_problem_rounded,
                  color: isDark ? Colors.red.shade300 : Colors.red.shade600,
                  size: 22,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Suspension Reason',
                      style: TextStyle(
                        color: isDark ? Colors.red.shade200 : const Color(0xFF991B1B),
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Review the details below',
                      style: TextStyle(
                        color: isDark ? Colors.red.shade400 : Colors.red.shade400,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark ? Colors.black.withValues(alpha: 0.2) : Colors.white,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              reason,
              style: TextStyle(
                color: isDark ? Colors.grey[300] : const Color(0xFF7F1D1D),
                fontSize: 14,
                height: 1.6,
              ),
            ),
          ),
        ],
      ),
    ).animate().fadeIn(delay: 600.ms).slideY(begin: 0.05);
  }

  Widget _buildSupportOptions(bool isDark, ThemeData theme) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 500),
      child: Column(
        children: [
          Text(
            'Need Help?',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : Colors.grey[800],
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildSupportButton(
                  icon: Icons.email_outlined,
                  label: 'Email Support',
                  subtitle: 'Get help via email',
                  color: const Color(0xFF3B82F6),
                  onTap: _contactSupport,
                  isDark: isDark,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildSupportButton(
                  icon: Icons.phone_outlined,
                  label: 'Call Us',
                  subtitle: 'Speak to agent',
                  color: const Color(0xFF10B981),
                  onTap: _callSupport,
                  isDark: isDark,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 56,
            child: OutlinedButton.icon(
              onPressed: _signOut,
              icon: const Icon(Icons.logout_rounded, size: 20),
              label: const Text('Sign Out & Switch Account'),
              style: OutlinedButton.styleFrom(
                foregroundColor: isDark ? Colors.grey[400] : Colors.grey[700],
                side: BorderSide(
                  color: isDark ? Colors.grey.withValues(alpha: 0.3) : Colors.grey.withValues(alpha: 0.3),
                ),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
            ),
          ).animate().fadeIn(delay: 750.ms),
        ],
      ),
    ).animate().fadeIn(delay: 700.ms);
  }

  Widget _buildSupportButton({
    required IconData icon,
    required String label,
    required String subtitle,
    required Color color,
    required VoidCallback onTap,
    required bool isDark,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? color.withValues(alpha: 0.1) : color.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: color.withValues(alpha: 0.2)),
          ),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: color, size: 24),
              ),
              const SizedBox(height: 12),
              Text(
                label,
                style: TextStyle(
                  color: isDark ? Colors.white : Colors.grey[800],
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: TextStyle(
                  color: isDark ? Colors.grey[500] : Colors.grey[500],
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFAQSection(bool isDark) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 500),
      child: Column(
        children: [
          Text(
            'Frequently Asked Questions',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.grey[400] : Colors.grey[700],
            ),
          ),
          const SizedBox(height: 16),
          _buildFAQItem(
            'How long does a suspension last?',
            'Suspensions are reviewed within 7-14 business days. You will be notified via email once a decision is made.',
            isDark,
          ),
          _buildFAQItem(
            'Can I appeal this suspension?',
            'Yes. Contact our support team with any evidence or clarification. We review all appeals fairly.',
            isDark,
          ),
          _buildFAQItem(
            'What happens to my pending orders?',
            'Existing orders will be handled by our team. Customers will be notified and assisted accordingly.',
            isDark,
          ),
        ],
      ),
    ).animate().fadeIn(delay: 800.ms);
  }

  Widget _buildFAQItem(String question, String answer, bool isDark) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.03) : Colors.grey.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.withValues(alpha: 0.1),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            question,
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.white : Colors.grey[800],
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            answer,
            style: TextStyle(
              color: isDark ? Colors.grey[500] : Colors.grey[600],
              fontSize: 13,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // ANIMATION HELPERS
  // ═══════════════════════════════════════════════════════════════
  Widget _buildAnimatedBackground(bool isDark) {
    return AnimatedBuilder(
      animation: _bgAnimController,
      builder: (context, _) => Container(
        decoration: BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(
              math.sin(_bgAnimController.value * 2 * math.pi) * 0.5,
              math.cos(_bgAnimController.value * 2 * math.pi) * 0.5,
            ),
            radius: 1.5,
            colors: isDark
                ? [Colors.red.shade900.withValues(alpha: 0.15), const Color(0xFF0D0D10), const Color(0xFF0D0D10)]
                : [Colors.red.withValues(alpha: 0.08), const Color(0xFFF5F5F7), const Color(0xFFF5F5F7)],
          ),
        ),
      ),
    );
  }

  Widget _buildFloatingOrbs(bool isDark, Size size) {
    return Stack(
      children: [
        Positioned(
          top: -size.height * 0.1,
          right: -size.width * 0.1,
          child: AnimatedBuilder(
            animation: _floatController,
            builder: (context, _) => Transform.translate(
              offset: Offset(0, _floatController.value * 30),
              child: Container(
                width: size.width * 0.35,
                height: size.width * 0.35,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [Colors.red.withValues(alpha: 0.2), Colors.transparent],
                  ),
                ),
              ),
            ),
          ),
        ),
        Positioned(
          bottom: size.height * 0.1,
          left: -size.width * 0.15,
          child: AnimatedBuilder(
            animation: _floatController,
            builder: (context, _) => Transform.translate(
              offset: Offset(_floatController.value * 20, 0),
              child: Container(
                width: size.width * 0.4,
                height: size.width * 0.4,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [Colors.orange.withValues(alpha: 0.1), Colors.transparent],
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _GridPatternPainter extends CustomPainter {
  final bool isDark;
  _GridPatternPainter({this.isDark = false});
  
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = (isDark ? Colors.white : Colors.grey).withValues(alpha: 0.03)
      ..strokeWidth = 1;
    
    const spacing = 50.0;
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
