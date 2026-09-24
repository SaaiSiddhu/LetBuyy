// lib/screens/settings/seller_settings_screen.dart
// ⚙️ ULTRA-PREMIUM SELLER SETTINGS SCREEN
// ✨ Responsive, Animated, Glassmorphic Design

import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';

import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_core/letbuyy_core.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../providers/seller_provider.dart';

import '../../app/routes.dart';

import 'widgets/store_info_edit_screen.dart';
import 'widgets/business_address_edit_screen.dart';
import 'widgets/tax_information_edit_screen.dart';
import 'widgets/profile_edit_screen.dart';
import 'widgets/bank_details_edit_screen.dart';
import 'widgets/verification_status_widget.dart';
import 'widgets/terms_conditions_screen.dart';
import 'widgets/privacy_policy_screen.dart';
import 'widgets/about_screen.dart';
import 'widgets/help_support_screen.dart';
import 'widgets/language_screen.dart';

class SellerSettingsScreen extends StatefulWidget {
  const SellerSettingsScreen({super.key});

  @override
  State<SellerSettingsScreen> createState() => _SellerSettingsScreenState();
}

class _SellerSettingsScreenState extends State<SellerSettingsScreen> with TickerProviderStateMixin {
  late AnimationController _bgAnimController;
  late AnimationController _floatController;

  @override
  void initState() {
    super.initState();
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
    final sellerProvider = Provider.of<SellerProvider>(context);
    final seller = sellerProvider.currentSeller;
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;
    final size = MediaQuery.of(context).size;
    final isMobile = size.width < 768;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF080B12) : const Color(0xFFF0F4F8),
      extendBodyBehindAppBar: true,
      body: Stack(
        children: [
          // 1. BACKGROUND
          _buildAnimatedBackground(isDark),
          ..._buildFloatingOrbs(isDark, size),

          // 2. CONTENT
          CustomScrollView(
            physics: const BouncingScrollPhysics(),
            slivers: [
              // APP BAR
              SliverAppBar(
                backgroundColor: Colors.transparent,
                elevation: 0,
                pinned: true,
                flexibleSpace: ClipRRect(
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                    child: Container(
                      color: (isDark ? Colors.black : Colors.white).withValues(alpha: 0.5),
                    ),
                  ),
                ),
                title: Text(
                  AppLocalizations.of(context)?.settings ?? 'Settings',
                  style: TextStyle(
                    color: isDark ? Colors.white : Colors.black,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                  ),
                ),
                actions: [
                  IconButton(
                    icon: Icon(Icons.logout_rounded, color: AppColors.error),
                    onPressed: _handleLogout,
                    tooltip: 'Logout',
                  ),
                ],
              ),

              // MAIN CONTENT
              SliverPadding(
                padding: EdgeInsets.all(isMobile ? 16 : 24),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    
                    // PROFILE HEADER (Glassmorphic)
                    _buildProfileHeader(seller, isDark, isMobile)
                        .animate().fadeIn(duration: 600.ms).slideY(begin: 0.1),
                    
                    const SizedBox(height: 24),

                    // VERIFICATION STATUS
                    if (seller != null) ...[
                       VerificationStatusWidget(
                        status: seller.verificationStatus,
                        rejectionReason: seller.rejectionReason,
                        isDark: isDark,
                      ).animate().fadeIn(delay: 100.ms).slideX(),
                      const SizedBox(height: 24),
                    ],

                    // SECTIONS
                    _buildSettingsSection(
                      context,
                      isDark,
                      "Business Settings",
                      [
                        _buildSettingsTile(
                          isDark,
                          Icons.store_rounded,
                          "Store Information",
                          "Update logo, name & description",
                          AppColors.primary,
                          () => _navigateToStoreInfo(),
                        ),
                        _buildSettingsTile(
                          isDark,
                          Icons.location_on_rounded,
                          "Business Address",
                          "Manage pickup & return address",
                          Colors.purple,
                          () => _navigateToAddress(),
                        ),
                        _buildSettingsTile(
                          isDark,
                          Icons.receipt_long_rounded,
                          "Tax Information",
                          "GSTIN, PAN & Tax details",
                          Colors.orange,
                          () => _navigateToTaxInfo(),
                        ),
                        _buildSettingsTile(
                          isDark,
                          Icons.verified_user_rounded,
                          "KYC Verification",
                          "Identity & Business Verification",
                          Colors.blue,
                          () => _navigateToKYC(),
                        ),
                      ],
                    ).animate().fadeIn(delay: 200.ms).slideY(begin: 0.1),

                    const SizedBox(height: 24),

                    _buildSettingsSection(
                      context,
                      isDark,
                      "Account Settings",
                      [
                         _buildSettingsTile(
                          isDark,
                          Icons.person_rounded,
                          "Profile",
                          "Personal details & contact info",
                          Colors.teal,
                          () => _navigateToProfile(),
                        ),
                        _buildSettingsTile(
                          isDark,
                          Icons.account_balance_rounded,
                          "Bank Details",
                          "Manage payouts & settlements",
                          Colors.indigo,
                          () => _navigateToBankDetails(),
                        ),
                      ],
                    ).animate().fadeIn(delay: 300.ms).slideY(begin: 0.1),

                    const SizedBox(height: 24),

                    // ORDER MANAGEMENT SECTION
                    _buildSettingsSection(
                      context,
                      isDark,
                      "Order Management",
                      [
                        _buildSettingsTile(
                          isDark,
                          Icons.assignment_return_rounded,
                          "Returns & Exchanges",
                          "Manage return requests & refunds",
                          Colors.red,
                          () => Navigator.pushNamed(context, AppRoutes.sellerReturns),
                        ),
                      ],
                    ).animate().fadeIn(delay: 350.ms).slideY(begin: 0.1),

                    const SizedBox(height: 24),

                    _buildSettingsSection(
                      context,
                      isDark,
                      "App Preferences",
                      [
                        _buildSwitchTile(
                          isDark,
                          Icons.dark_mode_rounded,
                          "Dark Mode",
                          "Toggle app theme",
                          Colors.deepPurple,
                          isDark,
                          (val) => themeProvider.toggleTheme(),
                        ),
                        _buildSettingsTile(
                          isDark,
                          Icons.notifications_rounded,
                          "Notifications",
                          "Manage alerts & sounds",
                          Colors.amber,
                          () => _navigateToNotifications(),
                        ),
                        _buildSettingsTile(
                          isDark,
                          Icons.language_rounded,
                          "Language",
                          "Change app language",
                          Colors.cyan,
                          () => _showLanguageDialog(),
                        ),
                      ],
                    ).animate().fadeIn(delay: 400.ms).slideY(begin: 0.1),

                    const SizedBox(height: 24),

                    _buildSettingsSection(
                      context,
                      isDark,
                      "Support & Legal",
                      [
                        _buildSettingsTile(
                          isDark,
                          Icons.help_outline_rounded,
                          "Help & Support",
                          "FAQs and Customer Care",
                          Colors.pink,
                          () => _navigateToSupport(),
                        ),
                        _buildSettingsTile(
                          isDark,
                          Icons.description_rounded,
                          "Terms & Conditions",
                          "Read our terms of service",
                          Colors.grey,
                          () => _navigateToTerms(),
                        ),
                        _buildSettingsTile(
                          isDark,
                          Icons.privacy_tip_rounded,
                          "Privacy Policy",
                          "How we handle your data",
                          Colors.green,
                          () => _navigateToPrivacy(),
                        ),
                        _buildSettingsTile(
                          isDark,
                          Icons.info_outline_rounded,
                          "About",
                          "App Version 1.0.0",
                          Colors.blueGrey,
                          () => _showAboutDialog(),
                        ),
                      ],
                    ).animate().fadeIn(delay: 500.ms).slideY(begin: 0.1),

                    const SizedBox(height: 40),
                    Center(
                      child: Text(
                        "LetBuyy Seller App v1.0.0",
                        style: TextStyle(
                          color: isDark ? Colors.white24 : Colors.black26,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                  ]),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎨 UI COMPONENTS
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildProfileHeader(seller, bool isDark, bool isMobile) {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF2E3192), Color(0xFF1BFFFF)],
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF2E3192).withValues(alpha: 0.3),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Stack(
        children: [
          // Glass Pattern - use Positioned.fill for bounded size
          Positioned.fill(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(24),
              child: CustomPaint(
                painter: _GridPatternPainter(isDark: true, opacity: 0.1),
              ),
            ),
          ),
          
          Padding(
            padding: EdgeInsets.all(isMobile ? 20 : 32),
            child: Row(
              children: [
                Container(
                  width: isMobile ? 70 : 90,
                  height: isMobile ? 70 : 90,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white.withValues(alpha: 0.3), width: 2),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withValues(alpha: 0.2), blurRadius: 10),
                    ],
                  ),
                  child: Center(
                    child: Text(
                      seller?.name?.substring(0, 1).toUpperCase() ?? 'S',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: isMobile ? 32 : 40,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ),
                SizedBox(width: isMobile ? 16 : 24),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        seller?.storeName ?? 'Store Name',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: isMobile ? 20 : 28,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        seller?.email ?? 'email@example.com',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.8),
                          fontSize: isMobile ? 14 : 16,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.3),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              seller?.isVerified == true 
                                  ? Icons.verified_rounded 
                                  : Icons.pending_rounded,
                              color: seller?.isVerified == true ? Colors.greenAccent : Colors.orangeAccent,
                              size: 16,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              seller?.isVerified == true ? 'VERIFIED SELLER' : 'VERIFICATION PENDING',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsSection(
    BuildContext context, 
    bool isDark, 
    String title, 
    List<Widget> children,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 12, bottom: 12),
          child: Text(
            title.toUpperCase(),
            style: TextStyle(
              color: isDark ? Colors.white60 : Colors.black54,
              fontSize: 12,
              fontWeight: FontWeight.w800,
              letterSpacing: 2,
            ),
          ),
        ),
        Container(
          decoration: BoxDecoration(
            color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.03),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
            ),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
              child: Column(
                children: children,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSettingsTile(
    bool isDark,
    IconData icon,
    String title,
    String subtitle,
    Color iconColor,
    VoidCallback onTap,
  ) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(icon, color: iconColor, size: 24),
              ),
              const SizedBox(width: 20),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        color: isDark ? Colors.white : Colors.black87,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: TextStyle(
                        color: isDark ? Colors.white38 : Colors.black38,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                color: isDark ? Colors.white24 : Colors.black12,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSwitchTile(
    bool isDark,
    IconData icon,
    String title,
    String subtitle,
    Color iconColor,
    bool value,
    Function(bool) onChanged,
  ) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(icon, color: iconColor, size: 24),
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: isDark ? Colors.white : Colors.black87,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: TextStyle(
                    color: isDark ? Colors.white38 : Colors.black38,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
          Switch.adaptive(
            value: value,
            onChanged: onChanged,
            activeTrackColor: iconColor,
          ),
        ],
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
              child: CustomPaint(
                size: Size(constraints.maxWidth, constraints.maxHeight),
                painter: _GridPatternPainter(isDark: isDark, opacity: isDark ? 0.05 : 0.03),
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
        top: size.height * 0.1,
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
                    AppColors.primary.withValues(alpha: 0.1),
                    Colors.transparent
                  ],
                ),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    blurRadius: 50,
                    spreadRadius: 20,
                  )
                ]
              ),
            ),
          ),
        ),
      ),
      Positioned(
        bottom: size.height * 0.2,
        left: -80,
        child: AnimatedBuilder(
          animation: _floatController,
          builder: (context, _) => Transform.translate(
            offset: Offset(0, -_floatController.value * 30),
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    Colors.purple.withValues(alpha: 0.05),
                    Colors.transparent
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    ];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🧭 NAVIGATION HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  void _navigateToStoreInfo() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const StoreInfoEditScreen()),
    );
  }

  void _navigateToAddress() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const BusinessAddressEditScreen()),
    );
  }

  void _navigateToTaxInfo() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const TaxInformationEditScreen()),
    );
  }

  void _navigateToProfile() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const ProfileEditScreen()),
    );
  }

  void _navigateToBankDetails() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const BankDetailsEditScreen()),
    );
  }

  void _navigateToNotifications() {
    // Implement notification settings
    SnackbarHelper.showSuccess(context, 'Feature Coming Soon');
  }

  void _navigateToSupport() {
    Navigator.push(context, MaterialPageRoute(builder: (_) => const HelpSupportScreen()));
  }

  void _navigateToTerms() {
    Navigator.push(context, MaterialPageRoute(builder: (_) => const TermsConditionsScreen()));
  }

  void _navigateToPrivacy() {
    Navigator.push(context, MaterialPageRoute(builder: (_) => const PrivacyPolicyScreen()));
  }

  void _navigateToKYC() {
    final sellerProvider = Provider.of<SellerProvider>(context, listen: false);
    final seller = sellerProvider.currentSeller;
    
    if (seller?.isVerified == true) {
      // Show the verified status screen
      Navigator.pushNamed(context, AppRoutes.kycStatus);
    } else if (seller?.verificationStatus == VerificationStatus.rejected) {
      // Show rejection screen (which allows resubmission)
      Navigator.pushNamed(context, AppRoutes.kycRejected);
    } else if (seller?.verificationStatus == VerificationStatus.pending) {
      // Show pending status screen
      Navigator.pushNamed(context, AppRoutes.kycStatus);
    } else {
      // Not started - go to wizard
      Navigator.pushNamed(context, AppRoutes.kycWizard);
    }
  }

  void _handleLogout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Logout Confirmation'),
        content: const Text('Are you sure you want to logout?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('Logout', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      // ✅ Use SellerProvider for seller logout (not AuthService which is for buyers)
      final sellerProvider = Provider.of<SellerProvider>(context, listen: false);
      await sellerProvider.signOut();
      if (!mounted) return;
      Navigator.pushNamedAndRemoveUntil(context, AppRoutes.login, (route) => false);
    }
  }




  void _showLanguageDialog() {
    Navigator.push(context, MaterialPageRoute(builder: (_) => const LanguageScreen()));
  }

  void _showAboutDialog() {
    Navigator.push(context, MaterialPageRoute(builder: (_) => const AboutScreen()));
  }
}

class _GridPatternPainter extends CustomPainter {
  final bool isDark;
  final double opacity;

  _GridPatternPainter({this.isDark = false, this.opacity = 0.05});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = (isDark ? Colors.white : Colors.grey).withValues(alpha: opacity)
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
