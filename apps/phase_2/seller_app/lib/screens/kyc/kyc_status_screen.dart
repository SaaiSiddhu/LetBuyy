// lib/screens/kyc/kyc_status_screen.dart
// 📋 DYNAMIC KYC STATUS SCREEN - Professional Redesign
// ✨ Matches Admin/Seller Login Aesthetics

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

import '../../l10n/generated/app_localizations.dart';
import '../../app/routes.dart';
import '../../providers/seller_provider.dart';

class KycStatusScreen extends StatefulWidget {
  const KycStatusScreen({super.key});

  @override
  State<KycStatusScreen> createState() => _KycStatusScreenState();
}

class _KycStatusScreenState extends State<KycStatusScreen> with TickerProviderStateMixin {
  VerificationStatus? _previousStatus;
  
  late AnimationController _bgAnimController;
  late AnimationController _floatController;

  // Support email
  static const String _supportEmail = 'saaisiddharth2004@gmail.com';

  @override
  void initState() {
    super.initState();
    _initAnimations();
    _setSystemUI();
    
    // Store initial status to detect changes
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final seller = context.read<SellerProvider>().currentSeller;
      _previousStatus = seller?.verificationStatus;
    });
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
    final status = seller?.verificationStatus ?? VerificationStatus.pending;
    
    final subject = Uri.encodeComponent('KYC Support Request - ${seller?.storeName ?? 'Seller'}');
    final body = Uri.encodeComponent('''
Dear LetBuyy Support Team,

I need assistance with my KYC verification.

Seller Details:
- Store Name: ${seller?.storeName ?? 'N/A'}
- Email: ${seller?.email ?? 'N/A'}
- Phone: ${seller?.phone ?? 'N/A'}
- Current Status: ${status.name}

Please let me know the status of my verification.

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
            ),
          );
        }
      }
    } catch (e) {
      debugPrint('Email launch error: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final sellerProvider = context.watch<SellerProvider>();
    final seller = sellerProvider.currentSeller;
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final size = MediaQuery.of(context).size;
    final status = seller?.verificationStatus ?? VerificationStatus.pending;

    _handleStatusChange(context, status);

    // Allow back navigation only when verified
    final canGoBack = status == VerificationStatus.verified;
    
    return PopScope(
      canPop: canGoBack,
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
                automaticallyImplyLeading: false,
                leading: canGoBack 
                    ? IconButton(
                        icon: Icon(
                          Icons.arrow_back_ios_rounded,
                          color: isDark ? Colors.white : Colors.black,
                        ),
                        onPressed: () {
                          Navigator.pushReplacementNamed(context, AppRoutes.sellerSettings);
                        },
                        tooltip: 'Back to Settings',
                      )
                    : null,
                title: Text(
                  AppLocalizations.of(context)?.kycVerification ?? 'Verification Status',
                  style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black),
                ),
                // Only show mail/logout icons when NOT verified
                actions: canGoBack ? [] : [
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
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              physics: const BouncingScrollPhysics(),
              child: Center(
                child: Column(
                  children: [
                    const SizedBox(height: 20),
                    _buildStatusCard(context, status, seller, isDark, theme),
                    const SizedBox(height: 32),
                    if (status != VerificationStatus.verified) _buildActions(context, status, isDark),
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

  void _handleStatusChange(BuildContext context, VerificationStatus status) {
    if (_previousStatus != null && status != _previousStatus) {
      _previousStatus = status;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        if (status == VerificationStatus.verified) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Row(children: [Icon(Icons.check_circle, color: Colors.white), SizedBox(width: 12), Expanded(child: Text('🎉 KYC Verified!'))]),
              backgroundColor: AppColors.success,
              behavior: SnackBarBehavior.floating,
            ),
          );
          Navigator.of(context).pushNamedAndRemoveUntil(AppRoutes.sellerDashboard, (route) => false);
        }
      });
    } else {
      _previousStatus = status;
    }
  }

  Widget _buildStatusCard(BuildContext context, VerificationStatus status, seller, bool isDark, ThemeData theme) {
    final statusData = _getStatusData(status);

    return Container(
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
              color: statusData['color'].withValues(alpha: 0.1),
              shape: BoxShape.circle,
              boxShadow: [BoxShadow(color: statusData['color'].withValues(alpha: 0.2), blurRadius: 30, spreadRadius: 5)],
            ),
            child: Icon(statusData['icon'], size: 50, color: statusData['color']),
          ).animate().scale(duration: 600.ms, curve: Curves.elasticOut),
          
          const SizedBox(height: 32),
          
          Text(
            statusData['title'],
            style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: isDark ? Colors.white : Colors.black, letterSpacing: -0.5),
            textAlign: TextAlign.center,
          ).animate().fadeIn(delay: 200.ms).slideY(begin: 0.1),
          
          const SizedBox(height: 12),
          
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: statusData['color'].withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: statusData['color'].withValues(alpha: 0.2)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(statusData['badgeIcon'], size: 16, color: statusData['color']),
                const SizedBox(width: 8),
                Text(statusData['badge'], style: TextStyle(color: statusData['color'], fontWeight: FontWeight.w700, fontSize: 13)),
              ],
            ),
          ).animate().fadeIn(delay: 300.ms),
          
          const SizedBox(height: 24),
          
          Text(
            statusData['description'],
            textAlign: TextAlign.center,
            style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600], fontSize: 15, height: 1.6),
          ).animate().fadeIn(delay: 400.ms),

          if (status == VerificationStatus.rejected && seller?.rejectionReason != null) ...[
            const SizedBox(height: 32),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFFECACA)),
              ),
              child: Column(
                children: [
                  Row(children: [
                    const Icon(Icons.info_outline_rounded, color: Color(0xFFDC2626), size: 20),
                    const SizedBox(width: 12),
                    Text('Rejection Reason', style: TextStyle(color: const Color(0xFF991B1B), fontWeight: FontWeight.w700, fontSize: 14)),
                  ]),
                  const SizedBox(height: 8),
                  Text(seller!.rejectionReason!, style: const TextStyle(color: Color(0xFF7F1D1D), fontSize: 14, height: 1.5), textAlign: TextAlign.center),
                ],
              ),
            ).animate().shake(delay: 600.ms),
          ],

          if (status == VerificationStatus.verified) ...[
             const SizedBox(height: 32),
            _buildBenefitsList(isDark),
          ],
        ],
      ),
    ).animate().fadeIn().slideY(begin: 0.05);
  }

  Widget _buildBenefitsList(bool isDark) {
    // ... (Keep existing benefits logic but styled professionally)
    return Column(
      children: [
        _buildBenefitItem(Icons.verified_user_outlined, 'Verified Seller Badge', isDark),
        _buildBenefitItem(Icons.storefront_outlined, 'Unlimited Listings', isDark),
        _buildBenefitItem(Icons.payments_outlined, 'Fast Payouts', isDark),
      ],
    );
  }

  Widget _buildBenefitItem(IconData icon, String text, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: Colors.green, size: 20),
          const SizedBox(width: 12),
          Text(text, style: TextStyle(color: isDark ? Colors.white : Colors.black, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  Widget _buildActions(BuildContext context, VerificationStatus status, bool isDark) {
    return Container( // Changed from SizedBox to Container
      width: double.infinity,
      constraints: const BoxConstraints(maxWidth: 400),
      height: 56,
      child: (status == VerificationStatus.rejected)
          ? ElevatedButton(
              onPressed: () => Navigator.pushReplacementNamed(context, AppRoutes.kycBusiness),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              child: const Text(
                'Resubmit Documents',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, letterSpacing: 0.3),
              ),
            )
          : (status == VerificationStatus.verified)
              ? ElevatedButton(
                  onPressed: () => Navigator.pushReplacementNamed(context, AppRoutes.sellerMain),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.success,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: const Text(
                    'Go to Dashboard',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, letterSpacing: 0.3),
                  ),
                )
              : const SizedBox.shrink(), // No button for pending status
    ).animate().fadeIn(delay: 500.ms).slideY(begin: 0.2);
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

  Map<String, dynamic> _getStatusData(VerificationStatus status) {
    switch (status) {
      case VerificationStatus.verified:
        return {
          'icon': Icons.verified_rounded, 'badgeIcon': Icons.check_circle, 'title': 'Account Verified', 'badge': 'Approved',
          'description': 'Congratulations! Your identity has been verified. You now have full access to all seller features.',
          'color': AppColors.success,
        };
      case VerificationStatus.rejected:
        return {
          'icon': Icons.gpp_bad_rounded, 'badgeIcon': Icons.error_outline, 'title': 'Verification Failed', 'badge': 'Action Required',
          'description': 'We could not verify your documents. Please review the reason below and resubmit correctly.',
          'color': AppColors.error,
        };
      case VerificationStatus.suspended:
        return {
          'icon': Icons.block_rounded, 'badgeIcon': Icons.warning_amber_rounded, 'title': 'Account Suspended', 'badge': 'Suspended',
          'description': 'Your account has been suspended due to policy violations. Please contact support.',
          'color': AppColors.error,
        };
      case VerificationStatus.pending:
      default:
        return {
          'icon': Icons.hourglass_top_rounded, 'badgeIcon': Icons.access_time_rounded, 'title': 'Under Review', 'badge': 'In Progress',
          'description': 'Our team is currently reviewing your documents. This process typically takes 24-48 hours.',
          'color': const Color(0xFFF59E0B), // Warning color
        };
    }
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
            colors: isDark ? [const Color(0xFF3B82F6).withValues(alpha: 0.15), const Color(0xFF080B12), const Color(0xFF080B12)] : [const Color(0xFF3B82F6).withValues(alpha: 0.1), const Color(0xFFF0F4F8), const Color(0xFFF0F4F8)],
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
          child: Container(width: size.width * 0.3, height: size.width * 0.3, decoration: BoxDecoration(shape: BoxShape.circle, gradient: RadialGradient(colors: [const Color(0xFF3B82F6).withValues(alpha: 0.3), Colors.transparent]))),
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
