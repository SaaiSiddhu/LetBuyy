import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';

import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace/app/routes.dart';

import '../../auth/buyer_sign_in_controller.dart';
import '../../widgets/letbuyy_account_card.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import '../../widgets/premium_scaffold.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen>
    with TickerProviderStateMixin, AutomaticKeepAliveClientMixin {
  
  // 🚀 WEB OPTIMIZATION: Keep state alive when switching tabs
  @override
  bool get wantKeepAlive => true;
  
  late AnimationController _animationController;
  
  // Toast Animations
  late AnimationController _toastAnimationController;
  late Animation<Offset> _toastSlideAnimation;

  // Phase 1R: orders were Firestore-native (a per-user collection keyed by the Firebase uid) with
  // no canonical successor yet. Null means "not available" -- shown honestly, never as 0.
  // Wishlist has since become a real, local, canonical-buyer-scoped provider (D-BUYER-SCOPE) --
  // its own live count is read directly from WishlistProvider where it's actually displayed
  // (this field is dead: unassigned, kept only because two other, currently-unreachable widgets
  // in this file still reference it).
  int? _ordersCount;
  int? _wishlistCount;
  int _addressesCount = 0;
  bool _addressesKnown = false;
  bool _isLoadingStats = true;
  bool _isCheckingAuth = true;
  BuyerSignInController? _signIn;
  String? _statsToken;
  int _statsGeneration = 0;

  bool _showToast = false;
  String _toastMessage = '';
  IconData _toastIcon = Icons.check_circle;
  Color _toastColor = AppColors.success;
  Timer? _toastTimer;

  @override
  void initState() {
    super.initState();

    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );

    _toastAnimationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );

    _toastSlideAnimation = Tween<Offset>(
      begin: const Offset(0, -1.5),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(
        parent: _toastAnimationController,
        curve: Curves.easeOutCubic,
      ),
    );

    // BuyerSignInController.start() (main.dart) resolves asynchronously, so `status` may still be
    // `restoring` here. A listener — not a one-shot check — is what lets a returning signed-in
    // buyer's stats actually load once restoration finishes.
    _signIn = context.read<BuyerSignInController>()..addListener(_onSignInChanged);
    _onSignInChanged();
  }

  @override
  void dispose() {
    _signIn?.removeListener(_onSignInChanged);
    _animationController.dispose();
    _toastAnimationController.dispose();
    _toastTimer?.cancel();
    super.dispose();
  }

  void _showToastMessage(String message, {bool isSuccess = true}) {
    if (!mounted) return;
    _toastTimer?.cancel();

    setState(() {
      _toastMessage = message;
      _toastIcon = isSuccess ? Icons.check_circle_rounded : Icons.error_rounded;
      _toastColor = isSuccess ? AppColors.success : AppColors.error;
      _showToast = true;
    });

    _toastAnimationController.forward();

    _toastTimer = Timer(const Duration(milliseconds: 2800), () {
      if (mounted) {
        _toastAnimationController.reverse().then((_) {
          if (mounted) setState(() => _showToast = false);
        });
      }
    });
  }

  void _onSignInChanged() {
    if (!mounted) return;
    final status = _signIn!.status;
    final token = _signIn!.token;
    final changed = token != _statsToken;
    setState(() {
      _isCheckingAuth = status == BuyerSignInStatus.restoring;
      if (changed) {
        _statsToken = token;
        _statsGeneration++;
        _addressesCount = 0;
        _addressesKnown = false;
        _isLoadingStats = token != null;
      }
    });
    if (changed && token != null) {
      _animationController.forward();
      _loadUserStats();
    }
  }

  // Phase 1R: orders were a Firestore collection keyed by the Firebase uid, with no canonical
  // successor yet (R1.1). Addresses has one — BuyerAddressApi, already built by SUSTAINED-K/L —
  // so this method populates that count for real; orders stays null (shown as "—", never a false
  // 0) until a later phase gives it a canonical backend. Wishlist is no longer this method's
  // concern: it's read live from WishlistProvider at its one reachable display site instead (see
  // the C3 corrective comment on that menu tile), so it never needed a slot here.
  Future<void> _loadUserStats() async {
    final token = _signIn?.token;
    if (token == null) return;
    final generation = ++_statsGeneration;
    setState(() { _isLoadingStats = true; _addressesKnown = false; });
    try {
      final addresses = await context.read<BuyerAddressApi>().list(token);
      if (mounted && _signIn?.token == token && generation == _statsGeneration) {
        setState(() {
          _addressesCount = addresses.length;
          _addressesKnown = true;
          _isLoadingStats = false;
        });
      }
    } catch (_) {
      if (mounted && _signIn?.token == token && generation == _statsGeneration) {
        setState(() { _isLoadingStats = false; _addressesKnown = false; });
      }
    }
  }

  Future<void> _navigateToRoute(String routeName) async {
    HapticFeedback.lightImpact();
    final token = _signIn?.token;
    await Navigator.pushNamed(context, routeName);
    if (mounted && token != null && _signIn?.token == token &&
        (routeName == AppRoutes.letbuyyAccount || routeName == AppRoutes.addresses)) {
      _loadUserStats();
    }
  }

  Future<void> _logout(bool isDark) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
            child: Container(
              margin: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: (isDark ? Colors.black : Colors.white).withValues(alpha: 0.8),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1),
                ),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      children: [
                        Container(
                          width: 60,
                          height: 60,
                          decoration: BoxDecoration(
                            color: AppColors.error.withValues(alpha: 0.1),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.logout_rounded,
                            size: 30,
                            color: AppColors.error,
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Logout',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: isDark ? Colors.white : AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Are you sure you want to logout?',
                          style: TextStyle(
                            color: isDark ? Colors.white70 : AppColors.textSecondary,
                            fontSize: 14,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                    child: Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => Navigator.pop(context, false),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              side: BorderSide(color: isDark ? Colors.white24 : AppColors.border),
                            ),
                            child: Text('Cancel', style: TextStyle(color: isDark ? Colors.white : AppColors.textPrimary)),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: () => Navigator.pop(context, true),
                            style: ElevatedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              backgroundColor: AppColors.error,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            child: const Text('Logout', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );

    if (confirmed == true && mounted) {
      // The canonical controller's own signOut() clears its state and notifies listeners; this
      // screen watches it below, so the rebuild alone takes the buyer back to the sign-in prompt —
      // no separate navigation to a Firebase-era auth route.
      await context.read<BuyerSignInController>().signOut();
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context); // 🚀 Required for AutomaticKeepAlive
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;

    // Phase 1R: canonical "Sign in with LetBuyy" (identity-platform PKCE) is this app's sole sign-in.
    return Consumer<BuyerSignInController>(
      builder: (context, controller, _) {
        final status = controller.status;

        if (_isCheckingAuth || status == BuyerSignInStatus.restoring) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        if (status != BuyerSignInStatus.signedIn) {
          return Scaffold(
            body: SafeArea(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: LetBuyyAccountCard(isDark: isDark),
                ),
              ),
            ),
          );
        }

    return PremiumScaffold(
      body: Stack(
        children: [
          // 1. Background handled by PremiumScaffold
          
          // 2. Main Content with Padding
          Padding(
            padding: EdgeInsets.only(top: MediaQuery.of(context).padding.top),
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
              physics: const BouncingScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // 🚀 WEB OPTIMIZATION: Skip animations on web
                  kIsWeb
                      ? _buildCompactHeader(controller.email, isDark)
                      : _buildCompactHeader(controller.email, isDark).animate().fadeIn(duration: 400.ms).slideY(begin: 0.1, end: 0),
                  
                  const SizedBox(height: 12), // Tighter spacing

                  // Premium Quick Actions (Grid)
                  kIsWeb
                      ? _buildPremiumQuickActions(isDark)
                      : _buildPremiumQuickActions(isDark).animate().fadeIn(duration: 400.ms, delay: 50.ms).slideY(begin: 0.1, end: 0),

                  const SizedBox(height: 20),

                  // Section: My Activity
                  _buildSectionTitle('My Activity', isDark),
                  const SizedBox(height: 8),
                  _buildGlassSection(
                    isDark: isDark, 
                    children: [
                      _buildPremiumMenuTile(
                        icon: Icons.shopping_bag_rounded,
                        title: 'My Orders',
                        subtitle: _ordersCount == null ? 'View your purchases' : '$_ordersCount orders',
                        iconColor: const Color(0xFF3B82F6),
                        onTap: () => _navigateToRoute(AppRoutes.orders),
                        isDark: isDark,
                      ),
                      _buildDivider(isDark),
                      _buildPremiumMenuTile(
                        icon: Icons.favorite_rounded,
                        title: 'Wishlist',
                        // C3 corrective (guest-transfer UI wiring pass, "Complete ALL remaining
                        // Phase 1R work" task, found via this session's own device testing):
                        // _wishlistCount was never assigned (dead field, left over from when
                        // wishlist really did have no canonical successor -- see this class's own
                        // now-stale doc comment on _loadUserStats), so this always showed "Not
                        // available" even after WishlistProvider became a real, working local
                        // wishlist. Reads the live provider directly instead.
                        subtitle: '${context.watch<WishlistProvider>().itemCount} items',
                        iconColor: const Color(0xFFEF4444),
                        onTap: () => _navigateToRoute(AppRoutes.wishlist),
                        isDark: isDark,
                      ),
                      _buildDivider(isDark),
                      _buildPremiumMenuTile(
                        icon: Icons.assignment_return_rounded,
                        title: 'Returns',
                        subtitle: 'Track status',
                        iconColor: const Color(0xFFF59E0B),
                        onTap: () => _navigateToRoute(AppRoutes.myReturns),
                        isDark: isDark,
                      ),
                    ],
                  ),

                  const SizedBox(height: 20),

                  // Section: Account
                  _buildSectionTitle('Account Settings', isDark),
                  const SizedBox(height: 8),
                  _buildGlassSection(
                    isDark: isDark, 
                    children: [
                      _buildPremiumMenuTile(
                        icon: Icons.person_rounded,
                        title: 'Edit Profile',
                        subtitle: 'Details & Security',
                        iconColor: const Color(0xFF8B5CF6),
                        onTap: () => _navigateToRoute(AppRoutes.editProfile),
                        isDark: isDark,
                      ),
                      _buildDivider(isDark),
                      _buildPremiumMenuTile(
                        icon: Icons.location_on_rounded,
                        title: 'Addresses',
                        subtitle: _isLoadingStats ? 'Loading addresses…' : _addressesKnown ? '$_addressesCount saved' : 'Manage addresses',
                        iconColor: const Color(0xFF10B981),
                        // Phase 1R corrective (C3): was AppRoutes.addresses (SavedAddressesScreen),
                        // which C2 already disconnected to an unconditional "No Saved Addresses"
                        // empty state -- it has no canonical successor wired in and cannot actually
                        // manage an address. The real, canonical address book is
                        // letbuyy_account_screen.dart (see address_selection_sheet.dart's own
                        // identical redirection for "Add"/"Edit").
                        onTap: () => _navigateToRoute(AppRoutes.letbuyyAccount),
                        isDark: isDark,
                      ),
                      _buildDivider(isDark),
                      // Phase 1R: the notification-preference toggle was a Firestore write with no
                      // canonical successor yet (R1.1) — shown honestly disabled, not a toggle that
                      // silently does nothing.
                      _buildPremiumMenuTile(
                        icon: Icons.notifications_active_rounded,
                        title: 'Notifications',
                        subtitle: 'Not available yet',
                        iconColor: const Color(0xFFF43F5E),
                        onTap: () => _showToastMessage('Notifications aren’t available yet', isSuccess: false),
                        isDark: isDark,
                        trailing: Transform.scale(
                          scale: 0.7,
                          child: Switch.adaptive(
                            value: false,
                            onChanged: null,
                            activeColor: AppColors.primary,
                          ),
                        ),
                      ),
                      _buildDivider(isDark),
                      _buildPremiumMenuTile(
                        icon: isDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
                        title: 'Appearance',
                        subtitle: isDark ? 'Dark Mode' : 'Light Mode',
                        iconColor: const Color(0xFFF59E0B),
                        onTap: () => themeProvider.toggleTheme(),
                        isDark: isDark,
                      ),
                    ],
                  ),

                  // APPID-P4d: the buyer's one LetBuyy account. Reachable here only once already
                  // signed in (the outer gate above), so this card's own sign-in button never shows —
                  // it surfaces "Manage profile & addresses" and sign-out instead.
                  ...[
                    const SizedBox(height: 20),
                    _buildSectionTitle('LetBuyy account', isDark),
                    const SizedBox(height: 8),
                    LetBuyyAccountCard(isDark: isDark),
                  ],

                  const SizedBox(height: 20),

                  // Section: Support & Legal
                  _buildSectionTitle('Support', isDark),
                  const SizedBox(height: 8),
                  _buildGlassSection(
                    isDark: isDark,
                    children: [
                      _buildPremiumMenuTile(
                        icon: Icons.headset_mic_rounded,
                        title: 'Help Center',
                        subtitle: '24/7 Support',
                        iconColor: const Color(0xFF0EA5E9),
                        onTap: () => _navigateToRoute(AppRoutes.supportConversations),
                        isDark: isDark,
                      ),
                      _buildDivider(isDark),
                      _buildPremiumMenuTile(
                        icon: Icons.smart_toy_rounded,
                        title: 'AI Assistant',
                        subtitle: 'Ask anything',
                        iconColor: const Color(0xFFEC4899),
                        onTap: () => _navigateToRoute(AppRoutes.aiChat),
                        isDark: isDark,
                      ),
                    ],
                  ),

                  const SizedBox(height: 24),
                  
                  // Logout
                  _buildLogoutButton(isDark),
                  
                  const SizedBox(height: 30),
                  
                  // Version
                  Center(
                    child: Text(
                      'v1.0.0 • LetBuyy',
                      style: TextStyle(
                        fontFamily: 'GoogleSans',
                        color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.3),
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          
          // Toast Overlay remains same
          if (_showToast)
            AnimatedBuilder(
              animation: _toastAnimationController,
              builder: (context, child) {
                return SlideTransition(
                  position: _toastSlideAnimation,
                  child: FadeTransition(
                    opacity: _toastAnimationController,
                    child: Align(
                      alignment: Alignment.topCenter,
                      child: Container(
                        margin: EdgeInsets.only(top: MediaQuery.of(context).padding.top + 20),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        decoration: BoxDecoration(
                          color: _toastColor,
                          borderRadius: BorderRadius.circular(30),
                          boxShadow: [
                            BoxShadow(
                              color: _toastColor.withValues(alpha: 0.3),
                              blurRadius: 8,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(_toastIcon, color: Colors.white, size: 18),
                            const SizedBox(width: 8),
                            Text(
                              _toastMessage,
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
        ],
      ),
    );
      },
    );
  }


  // ---------------------------------------------------------------------------
  // NEW PREMIUM WIDGETS
  // ---------------------------------------------------------------------------

  // C3 (Firebase SDK removal, 27 September 2026 review continuation): was Consumer<LoyaltyProvider>,
  // reading currentTier/colorValue/a per-tier gradient, plus a crown overlay for gold-and-above
  // tiers. LoyaltyProvider and the whole Firestore-backed loyalty subsystem behind it are retired
  // this same pass (see main.dart's own doc comment; LoyaltyScreen and its home_app_bar.dart badge
  // -- the reachable, real-looking-but-permanently-fake surfaces -- are deleted outright).
  // currentTier could never legitimately be anything but its default, LoyaltyTier.bronze
  // (LoyaltyProvider.init() required safeFirebaseUserId(), always null under canonical auth, and
  // the only code that ever advanced a tier, OrderService.awardPointsForOrder, had zero live
  // callers anywhere in the app), so this avatar ring was already permanently, unfalsifiably bronze
  // -- and showCrown (gold-and-above only) was already permanently false -- for every buyer.
  // Inlining that one reachable appearance changes nothing observable. The tier BADGE/card already
  // removed elsewhere in this file made a textual claim and was deleted outright; this ring is
  // purely decorative and was deliberately kept as-is then -- unaffected now, just no longer routed
  // through a provider that could only ever answer with this one constant.
  Widget _buildCompactHeader(String? email, bool isDark) {
    const tierColor = Color(0xFFCD7F32);
    const tierGradient = [Color(0xFFCD7F32), Color(0xFF8B4513)];

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 10),
      child: Row(
        children: [
          // Avatar with tier ring (bronze; see this method's own doc comment)
          Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                colors: tierGradient,
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              boxShadow: [
                BoxShadow(
                  color: tierColor.withValues(alpha: 0.4),
                  blurRadius: 12,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: CircleAvatar(
              radius: 26,
              backgroundColor: isDark ? Colors.black : Colors.white,
              child: CircleAvatar(
                radius: 24,
                backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.grey[100],
                // Phase 1R: the canonical buyer session has no photo (R1.1) — always the
                // placeholder icon, never a broken/missing-image state.
                child: const Icon(Icons.person, size: 24, color: tierColor),
              ),
            ),
          ),
          const SizedBox(width: 14),

          // User Info & Badge
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      // Phase 1R: the canonical buyer session carries an email, not a separate
                      // display name (R1.1) — the email itself is shown on the line below, so this
                      // headline is just a greeting rather than repeating it.
                      child: Text(
                        'Welcome back',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: isDark ? Colors.white : Colors.black87,
                          letterSpacing: -0.5,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                // User Email
                Text(
                  email ?? '',
                  style: TextStyle(
                    fontSize: 12,
                    color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.5),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),

          // Edit Button (Icon only)
          _buildEditButton(isDark),
        ],
      ),
    );
  }

  Widget _buildEditButton(bool isDark) {
    return GestureDetector(
      onTap: () => _navigateToRoute(AppRoutes.editProfile),
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
          ),
        ),
        child: Icon(
          Icons.edit_rounded,
          size: 18,
          color: isDark ? Colors.white70 : Colors.black54,
        ),
      ),
    );
  }

  // C3 (Firebase SDK removal, LoyaltyProvider audit): the "Loyalty Points" quick-action card that
  // was here is deleted -- it always read LoyaltyProvider.points (always 0, same reasoning as the
  // tier badge removed from _buildCompactHeader above) and tapped through to a full "rewards"
  // screen (LoyaltyScreen) that can never show real, changing data for any user. Not just a wrong
  // number: a real-looking, tappable feature with no live backend behind it anywhere in the app.
  Widget _buildPremiumQuickActions(bool isDark) {
    return Container(
      height: 90,
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: Row(
        children: [
          Expanded(child: _buildGradientActionCard(
            'Messages\n& Chat',
             'Chat',
            Icons.chat_bubble_rounded,
            [const Color(0xFF3B82F6), const Color(0xFF2563EB)],
            () => _navigateToRoute(AppRoutes.supportConversations),
          )),
          const SizedBox(width: 10),
          Expanded(child: _buildGradientActionCard(
            'AI\nAssistant',
            'Ask',
            Icons.auto_awesome_rounded,
            [const Color(0xFF8B5CF6), const Color(0xFF7C3AED)],
            () => _navigateToRoute(AppRoutes.aiChat),
          )),
        ],
      ),
    );
  }

  Widget _buildGradientActionCard(String title, String subtitle, IconData icon, List<Color> colors, VoidCallback onTap) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: colors.map((c) => c.withValues(alpha: 0.15)).toList(),
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: colors.first.withValues(alpha: 0.3), width: 1),
        ),
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Icon(icon, color: colors.last, size: 20),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  subtitle,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                    color: colors.last,
                  ),
                ),
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w500,
                    color: colors.last.withValues(alpha: 0.8),
                    height: 1.1,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPremiumMenuTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color iconColor,
    required VoidCallback onTap,
    required bool isDark,
    Widget? trailing,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.lightImpact();
          onTap();
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              // Colorful Icon Container
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: iconColor, size: 18),
              ),
              const SizedBox(width: 14),
              
              // Text Content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 11,
                        color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.5),
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                  ],
                ),
              ),
              
              // Trailing
              trailing ?? Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.2),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatsRow(bool isDark) {
    return Row(
      children: [
        Expanded(child: _buildStatCard('Orders', '$_ordersCount', Icons.shopping_bag_outlined, AppColors.info, isDark)),
        const SizedBox(width: 12),
        Expanded(child: _buildStatCard('Wishlist', '$_wishlistCount', Icons.favorite_border, Colors.pink, isDark)),
      ],
    ); // Addresses accessible via menu
  }

  Widget _buildStatCard(String label, String count, IconData icon, Color color, bool isDark) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 20),
          decoration: BoxDecoration(
            color: (isDark ? Colors.white : Colors.white).withValues(alpha: isDark ? 0.05 : 0.6),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: (isDark ? Colors.white : Colors.black).withValues(alpha: isDark ? 0.05 : 0.03),
            ),
          ),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: color, size: 22),
              ),
              const SizedBox(height: 12),
              Text(
                count,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.5),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildGlassSection({required bool isDark, required List<Widget> children}) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          decoration: BoxDecoration(
            color: (isDark ? Colors.white : Colors.white).withValues(alpha: isDark ? 0.05 : 0.7),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: (isDark ? Colors.white : Colors.black).withValues(alpha: isDark ? 0.05 : 0.03),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(children: children),
        ),
      ),
    );
  }

  Widget _buildMenuTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
    required bool isDark,
    required Color color,
    Widget? trailing,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: color, size: 22),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 12,
                        color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.5),
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                  ],
                ),
              ),
              trailing ??
                  Icon(
                    Icons.chevron_right_rounded,
                    size: 20,
                    color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.3),
                  ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDivider(bool isDark) {
    return Divider(
      height: 1,
      thickness: 1,
      indent: 20,
      endIndent: 20,
      color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
    );
  }

  Widget _buildCountBadge(int count, bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.4),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Text(
        '$count',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 11,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  // --- NEW HELPER METHODS ---

  Widget _buildQuickActionsRow(bool isDark) {
    return Row(
      children: [
        Expanded(
          child: _buildQuickActionCard(
            icon: Icons.shopping_bag_rounded,
            label: 'Orders',
            count: _ordersCount ?? 0,
            color: const Color(0xFF3B82F6),
            onTap: () => _navigateToRoute(AppRoutes.orders),
            isDark: isDark,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _buildQuickActionCard(
            icon: Icons.favorite_rounded,
            label: 'Wishlist',
            count: _wishlistCount ?? 0,
            color: const Color(0xFFEF4444),
            onTap: () => _navigateToRoute(AppRoutes.wishlist),
            isDark: isDark,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _buildQuickActionCard(
            icon: Icons.location_on_rounded,
            label: 'Addresses',
            count: _addressesCount,
            color: const Color(0xFF10B981),
            onTap: () => _navigateToRoute(AppRoutes.letbuyyAccount),
            isDark: isDark,
          ),
        ),
      ],
    );
  }

  Widget _buildQuickActionCard({
    required IconData icon,
    required String label,
    required int count,
    required Color color,
    required VoidCallback onTap,
    required bool isDark,
  }) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 14),
            decoration: BoxDecoration(
              color: (isDark ? Colors.white : Colors.white).withValues(alpha: isDark ? 0.06 : 0.7),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.04),
              ),
            ),
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, color: color, size: 20),
                ),
                const SizedBox(height: 8),
                Text(
                  '$count',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.5),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title, bool isDark) {
    return Text(
      title,
      style: TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w700,
        color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.5),
        letterSpacing: 0.5,
      ),
    );
  }

  Widget _buildLogoutButton(bool isDark) {
    return GestureDetector(
      onTap: () => _logout(isDark),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.error.withValues(alpha: isDark ? 0.15 : 0.08),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: AppColors.error.withValues(alpha: 0.2),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.logout_rounded, color: AppColors.error, size: 20),
            const SizedBox(width: 10),
            Text(
              'Sign Out',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: AppColors.error,
              ),
            ),
          ],
        ),
      ),
    );
  }

}
