// lib/screens/kyc/kyc_rejected_screen.dart
// ❌ KYC REJECTED SCREEN - Professional Redesign
// ✨ Matches Admin/Seller Login Aesthetics

import 'dart:ui';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../app/routes.dart';
import '../../providers/seller_provider.dart';

class KycRejectedScreen extends StatefulWidget {
  const KycRejectedScreen({super.key});

  @override
  State<KycRejectedScreen> createState() => _KycRejectedScreenState();
}

class _KycRejectedScreenState extends State<KycRejectedScreen> with TickerProviderStateMixin {
  late AnimationController _bgAnimController;
  late AnimationController _floatController;

  // Support email
  static const String _supportEmail = 'saaisiddharth2004@gmail.com';

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
      statusBarBrightness: Brightness.dark, // iOS
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
  }

  @override
  void dispose() {
    _bgAnimController.dispose();
    _floatController.dispose();
    super.dispose();
  }

  /// Open email client with support template
  Future<void> _contactSupport() async {
    final sellerProvider = context.read<SellerProvider>();
    final seller = sellerProvider.currentSeller;
    
    final subject = Uri.encodeComponent('KYC Rejection Appeal - ${seller?.storeName ?? 'Seller'}');
    final body = Uri.encodeComponent('''
Dear LetBuyy Support Team,

I am writing to appeal my KYC rejection.

Seller Details:
- Store Name: ${seller?.storeName ?? 'N/A'}
- Email: ${seller?.email ?? 'N/A'}
- Phone: ${seller?.phone ?? 'N/A'}

Rejection Reason: ${seller?.rejectionReason ?? 'Not specified'}

I have addressed the issues mentioned and would like to request a review of my application.

Please let me know if you need any additional information.

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
              content: Text('Unable to open email. Please contact $_supportEmail'),
              backgroundColor: AppColors.error,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Email: $_supportEmail'),
            action: SnackBarAction(
              label: 'Copy',
              onPressed: () {
                // Copy email to clipboard
              },
            ),
          ),
        );
      }
    }
  }

  /// Show logout confirmation dialog
  Future<void> _showLogoutDialog() async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(Icons.logout_rounded, color: isDark ? Colors.white : Colors.grey[800], size: 24),
            const SizedBox(width: 12),
            Text('Switch Account', style: TextStyle(color: isDark ? Colors.white : Colors.grey[800], fontWeight: FontWeight.w600)),
          ],
        ),
        content: Text(
          'Sign out to switch to a different seller account?',
          style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600]),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel', style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600])),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              await FirebaseAuth.instance.signOut();
              if (mounted) {
                Navigator.pushNamedAndRemoveUntil(context, AppRoutes.login, (route) => false);
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF111827),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final sellerProvider = context.watch<SellerProvider>();
    final seller = sellerProvider.currentSeller;
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final size = MediaQuery.of(context).size;
    
    final rejectionReason = seller?.rejectionReason ?? 'Document verification could not be completed at this time.';

    // Prevent back navigation
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: isDark ? const Color(0xFF080B12) : const Color(0xFFF0F4F8),
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
                automaticallyImplyLeading: false, // Remove back button
                title: Text(
                  'Verification Failed',
                  style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black),
                ),
                actions: [
                  IconButton(
                    icon: Icon(Icons.email_outlined, color: isDark ? Colors.white : Colors.black, size: 22),
                    onPressed: _contactSupport,
                    tooltip: 'Contact Support',
                  ),
                  const SizedBox(width: 4),
                  IconButton(
                    icon: Icon(Icons.logout_rounded, color: isDark ? Colors.white70 : Colors.black54, size: 22),
                    onPressed: _showLogoutDialog,
                    tooltip: 'Switch Account',
                  ),
                  const SizedBox(width: 8),
                ],
              ),
            ),
          ),
        ),
        body: Stack(
          children: [
            _buildAnimatedBackground(isDark),
            _buildFloatingOrbs(isDark, size),
            Positioned.fill(child: CustomPaint(painter: _GridPatternPainter(isDark: isDark))),

            SafeArea(
              child: Center( // Centers content completely
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  physics: const BouncingScrollPhysics(),
                  child: Center(
                    child: Container(
                      constraints: const BoxConstraints(maxWidth: 500),
                      padding: const EdgeInsets.all(40),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.black.withValues(alpha: 0.05)),
                        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 40, offset: const Offset(0, 10))],
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 120, height: 120,
                            decoration: BoxDecoration(
                              color: const Color(0xFFDC2626).withValues(alpha: 0.1),
                              shape: BoxShape.circle,
                              boxShadow: [BoxShadow(color: const Color(0xFFDC2626).withValues(alpha: 0.2), blurRadius: 30, spreadRadius: 5)],
                            ),
                            child: const Icon(Icons.gpp_bad_rounded, size: 50, color: Color(0xFFDC2626)),
                          ).animate().scale(duration: 600.ms, curve: Curves.elasticOut),

                          const SizedBox(height: 32),

                          Text(
                            'KYC Rejected',
                            style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: isDark ? Colors.white : Colors.black, letterSpacing: -0.5),
                            textAlign: TextAlign.center,
                          ).animate().fadeIn(delay: 200.ms).slideY(begin: 0.1),

                          const SizedBox(height: 16),

                          Text(
                            'We encountered issues while verifying your documents. Please address the reason below and submit again.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600], fontSize: 15, height: 1.6),
                          ).animate().fadeIn(delay: 300.ms),

                          const SizedBox(height: 32),

                          Container(
                            padding: const EdgeInsets.all(20),
                            width: double.infinity,
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEF2F2),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: const Color(0xFFFECACA), width: 1),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    const Icon(Icons.warning_amber_rounded, color: Color(0xFFB91C1C), size: 20),
                                    const SizedBox(width: 8),
                                    const Text('Reason for Rejection', style: TextStyle(color: Color(0xFF991B1B), fontWeight: FontWeight.bold, fontSize: 14)),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  rejectionReason,
                                  style: const TextStyle(color: Color(0xFF7F1D1D), fontSize: 15, height: 1.5, fontWeight: FontWeight.w500),
                                ),
                              ],
                            ),
                          ).animate().shake(delay: 400.ms),

                          const SizedBox(height: 32),

                          _buildGuidelines(isDark),

                          const SizedBox(height: 40),

                          SizedBox(
                            width: double.infinity,
                            height: 56,
                            child: ElevatedButton(
                              onPressed: () => Navigator.pushReplacementNamed(context, AppRoutes.kycBusiness),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF111827),
                                foregroundColor: Colors.white,
                                elevation: 0,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                              ),
                              child: const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.refresh_rounded, size: 20),
                                  SizedBox(width: 8),
                                  Text('Resubmit Documents', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, letterSpacing: 0.3)),
                                ],
                              ),
                            ),
                          ).animate().fadeIn(delay: 600.ms).slideY(begin: 0.2),
                          
                          const SizedBox(height: 16),
                          
                          TextButton.icon(
                            onPressed: _contactSupport,
                            icon: Icon(Icons.email_outlined, size: 18, color: theme.colorScheme.primary),
                            label: Text('Contact Support', style: TextStyle(color: theme.colorScheme.primary, fontWeight: FontWeight.w600)),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGuidelines(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Before resubmitting:',
          style: TextStyle(color: isDark ? Colors.white : Colors.black, fontWeight: FontWeight.w700, fontSize: 14),
        ),
        const SizedBox(height: 12),
        _buildGuidelineItem(Icons.photo_camera_outlined, 'Ensure all photos are clear and not blurry.', isDark),
        _buildGuidelineItem(Icons.light_mode_outlined, 'Avoid glare on documents.', isDark),
        _buildGuidelineItem(Icons.assignment_turned_in_outlined, 'Check that details match your ID exactly.', isDark),
      ],
    );
  }

  Widget _buildGuidelineItem(IconData icon, String text, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, size: 18, color: isDark ? Colors.grey[400] : Colors.grey[600]),
          const SizedBox(width: 12),
          Expanded(child: Text(text, style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600], fontSize: 13))),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // ANIMATION HELPERS (Copied to be self-contained)
  // ═══════════════════════════════════════════════════════════════
  Widget _buildAnimatedBackground(bool isDark) {
    return AnimatedBuilder(
      animation: _bgAnimController,
      builder: (context, _) => Container(
        decoration: BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(math.sin(_bgAnimController.value * 2 * math.pi) * 0.5, math.cos(_bgAnimController.value * 2 * math.pi) * 0.5),
            radius: 1.5,
            colors: isDark ? [const Color(0xFFDC2626).withValues(alpha: 0.1), const Color(0xFF080B12), const Color(0xFF080B12)] : [const Color(0xFFDC2626).withValues(alpha: 0.05), const Color(0xFFF0F4F8), const Color(0xFFF0F4F8)],
          ),
        ),
      ),
    );
  }

  Widget _buildFloatingOrbs(bool isDark, Size size) {
    return Positioned(
      top: -size.height * 0.1, right: -size.width * 0.1,
      child: AnimatedBuilder(
        animation: _floatController,
        builder: (context, _) => Transform.translate(
          offset: Offset(0, _floatController.value * 30),
          child: Container(width: size.width * 0.3, height: size.width * 0.3, decoration: BoxDecoration(shape: BoxShape.circle, gradient: RadialGradient(colors: [const Color(0xFFDC2626).withValues(alpha: 0.2), Colors.transparent]))),
        ),
      ),
    );
  }
}

class _GridPatternPainter extends CustomPainter {
  final bool isDark;
  _GridPatternPainter({this.isDark = false});
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = (isDark ? Colors.white : Colors.grey).withValues(alpha: 0.05)..strokeWidth = 1;
    for (double x = 0; x < size.width; x += 50) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += 50) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }
  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
