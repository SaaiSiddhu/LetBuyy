import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:flutter_animate/flutter_animate.dart';

import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace/app/routes.dart';

import '../../config/app_config.dart';
import '../../providers/auth_provider.dart' as app_auth;
import '../../widgets/auth_gate.dart';
import '../../widgets/letbuyy_account_card.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
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

  bool _notificationsEnabled = true;
  int _ordersCount = 0;
  int _wishlistCount = 0;
  int _addressesCount = 0;
  bool _isLoadingStats = true;
  bool _isCheckingAuth = true;
  bool _isSellerAccount = false;

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

    _checkAuthenticationAndLoadData();
    _loadNotificationSetting();
    
    // Initialize loyalty provider to show points
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<LoyaltyProvider>(context, listen: false).init();
    });
  }

  @override
  void dispose() {
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

  Future<void> _checkAuthenticationAndLoadData() async {
    final user = FirebaseAuth.instance.currentUser;
    final authProvider =
        Provider.of<app_auth.AuthProvider>(context, listen: false);

    if (user == null || authProvider.currentUser == null) {
      if (mounted) {
        setState(() => _isCheckingAuth = false);
      }
      return;
    }

    await _checkIfSeller(user.uid);

    setState(() => _isCheckingAuth = false);
    _animationController.forward();
    _loadUserStats();
  }

  Future<void> _checkIfSeller(String uid) async {
    try {
      final sellerDoc = await FirebaseFirestore.instance
          .collection('sellers')
          .doc(uid)
          .get();
      
      if (mounted) {
        setState(() {
          _isSellerAccount = sellerDoc.exists;
        });
      }
    } catch (e) {
      debugPrint('❌ Error checking seller account: $e');
    }
  }

  Future<void> _loadUserStats() async {
    try {
      final userId = FirebaseAuth.instance.currentUser?.uid;
      if (userId == null) {
        if (mounted) setState(() => _isLoadingStats = false);
        return;
      }

      final ordersFuture = FirebaseFirestore.instance
          .collection('orders')
          .where('userId', isEqualTo: userId)
          .get();

      final wishlistFuture = FirebaseFirestore.instance
          .collection('wishlists')
          .doc(userId)
          .get();

      final addressesFuture = FirebaseFirestore.instance
          .collection('addresses')
          .where('userId', isEqualTo: userId)
          .get();

      final results = await Future.wait([
        ordersFuture,
        wishlistFuture,
        addressesFuture,
      ]);

      final ordersSnapshot = results[0] as QuerySnapshot;
      final wishlistDoc = results[1] as DocumentSnapshot;
      final addressesSnapshot = results[2] as QuerySnapshot;

      int wishlistCount = 0;
      if (wishlistDoc.exists) {
        final data = wishlistDoc.data() as Map<String, dynamic>?;
        if (data != null && data.containsKey('productIds')) {
          wishlistCount = (data['productIds'] as List?)?.length ?? 0;
        }
      } else {
        final itemsSnapshot = await FirebaseFirestore.instance
            .collection('wishlists')
            .doc(userId)
            .collection('items')
            .get();
        wishlistCount = itemsSnapshot.docs.length;
      }

      if (mounted) {
        setState(() {
          _ordersCount = ordersSnapshot.docs.length;
          _wishlistCount = wishlistCount;
          _addressesCount = addressesSnapshot.docs.length;
          _isLoadingStats = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoadingStats = false);
    }
  }

  Future<void> _loadNotificationSetting() async {
    try {
      final userId = FirebaseAuth.instance.currentUser?.uid;
      if (userId == null) return;

      final userDoc = await FirebaseFirestore.instance
          .collection('users')
          .doc(userId)
          .get();

      if (userDoc.exists && mounted) {
        final data = userDoc.data() as Map<String, dynamic>;
        setState(() {
          _notificationsEnabled = data['notificationsEnabled'] ?? true;
        });
      }
    } catch (e) {
      debugPrint('❌ Error loading notification: $e');
    }
  }

  Future<void> _toggleNotifications(bool value) async {
    try {
      final userId = FirebaseAuth.instance.currentUser?.uid;
      if (userId == null) return;

      if (value && !kIsWeb) {
        final permission = await Permission.notification.request();
        if (!permission.isGranted) {
          _showToastMessage('⚠️ Notification permission denied', isSuccess: false);
          return;
        }
      }

      setState(() => _notificationsEnabled = value);

      await FirebaseFirestore.instance.collection('users').doc(userId).update({
        'notificationsEnabled': value,
        'updatedAt': FieldValue.serverTimestamp(),
      });

      if (mounted) {
        _showToastMessage(
          value ? '✅ Notifications enabled' : '🔕 Notifications disabled',
          isSuccess: true,
        );
      }
    } catch (e) {
      _showToastMessage('Failed to update', isSuccess: false);
      setState(() => _notificationsEnabled = !value);
    }
  }

  void _navigateToRoute(String routeName) {
    HapticFeedback.lightImpact();
    Navigator.pushNamed(context, routeName);
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
      try {
        await FirebaseAuth.instance.signOut();
        if (mounted) {
          Navigator.of(context).pushReplacementNamed(AppRoutes.auth);
        }
      } catch (e) {
        _showToastMessage('Logout failed', isSuccess: false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context); // 🚀 Required for AutomaticKeepAlive
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;

    // Use Consumer to reactively listen to auth changes
    return Consumer<app_auth.AuthProvider>(
      builder: (context, authProvider, _) {
        final user = authProvider.currentUser;
        final firebaseUser = FirebaseAuth.instance.currentUser;

        if (_isCheckingAuth) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        if (user == null || firebaseUser == null) {
          return AuthGatedWidget(
            actionDescription: 'Please login to view your profile',
            child: const SizedBox.shrink(),
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
                      ? _buildCompactHeader(firebaseUser, isDark)
                      : _buildCompactHeader(firebaseUser, isDark).animate().fadeIn(duration: 400.ms).slideY(begin: 0.1, end: 0),
                  
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
                        subtitle: '$_ordersCount orders',
                        iconColor: const Color(0xFF3B82F6),
                        onTap: () => _navigateToRoute(AppRoutes.orders),
                        isDark: isDark,
                      ),
                      _buildDivider(isDark),
                      _buildPremiumMenuTile(
                        icon: Icons.favorite_rounded,
                        title: 'Wishlist',
                        subtitle: '$_wishlistCount items',
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
                        subtitle: '$_addressesCount saved',
                        iconColor: const Color(0xFF10B981),
                        onTap: () => _navigateToRoute(AppRoutes.addresses),
                        isDark: isDark,
                      ),
                      _buildDivider(isDark),
                      _buildPremiumMenuTile(
                        icon: Icons.notifications_active_rounded,
                        title: 'Notifications',
                        subtitle: _notificationsEnabled ? 'On' : 'Off',
                        iconColor: const Color(0xFFF43F5E),
                        onTap: () => _toggleNotifications(!_notificationsEnabled),
                        isDark: isDark,
                        trailing: Transform.scale(
                          scale: 0.7,
                          child: Switch.adaptive(
                            value: _notificationsEnabled,
                            onChanged: _toggleNotifications,
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

                  // APPID-P4d: the buyer's one LetBuyy account, only with LETBUYY_BUYER_SIGN_IN on.
                  if (AppConfig.buyerSignInEnabled) ...[
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

  Widget _buildCompactHeader(User? user, bool isDark) {
    return Consumer<LoyaltyProvider>(
      builder: (context, loyaltyProvider, _) {
        final tier = loyaltyProvider.currentTier;
        final tierColor = Color(tier.colorValue);
        final showCrown = tier.index >= LoyaltyTier.gold.index; // Gold and above
        
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 10),
          child: Row(
            children: [
              // Avatar with Dynamic Tier Ring + Crown
              Stack(
                clipBehavior: Clip.none,
                children: [
                  // Ring Container
                  Container(
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        colors: _getTierGradient(tier),
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
                        backgroundImage: user?.photoURL != null ? NetworkImage(user!.photoURL!) : null,
                        child: user?.photoURL == null
                            ? Icon(Icons.person, size: 24, color: tierColor)
                            : null,
                      ),
                    ),
                  ),
                  
                  // Crown for Gold+ tiers
                  if (showCrown)
                    Positioned(
                      top: -8,
                      left: 0,
                      right: 0,
                      child: Center(
                        child: Container(
                          padding: const EdgeInsets.all(3),
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF1E293B) : Colors.white,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: tierColor.withValues(alpha: 0.3),
                                blurRadius: 6,
                                spreadRadius: 1,
                              ),
                            ],
                          ),
                          child: Icon(
                            Icons.auto_awesome_rounded,
                            size: tier == LoyaltyTier.diamond ? 14 : 12,
                            color: tierColor,
                          ),
                        ),
                      ),
                    ),
                ],
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
                      child: Text(
                        user?.displayName ?? 'Welcome',
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
                    const SizedBox(width: 6),
                    // Verified Badge
                    if (user?.emailVerified == true)
                      Icon(Icons.verified_rounded, color: AppColors.primary, size: 16),
                  ],
                ),
                const SizedBox(height: 4),
                // User Email
                Text(
                  user?.email ?? '',
                  style: TextStyle(
                    fontSize: 12,
                    color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.5),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 6),
                // Dynamic Tier Badge from LoyaltyProvider
                Consumer<LoyaltyProvider>(
                  builder: (context, loyaltyProvider, _) {
                    final tier = loyaltyProvider.currentTier;
                    final tierColor = Color(tier.colorValue);
                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [tierColor.withValues(alpha: 0.2), tierColor.withValues(alpha: 0.1)],
                        ),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: tierColor.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(_getTierIcon(tier), size: 12, color: tierColor),
                          const SizedBox(width: 4),
                          Text(
                            '${tier.displayName.toUpperCase()} MEMBER',
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                              color: tierColor,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ],
            ),
          ),

              // Edit Button (Icon only)
              _buildEditButton(isDark),
            ],
          ),
        );
      },
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

  Widget _buildPremiumQuickActions(bool isDark) {
    return Consumer<LoyaltyProvider>(
      builder: (context, loyaltyProvider, _) {
        final points = loyaltyProvider.points;
        final tier = loyaltyProvider.currentTier;
        final tierColor = Color(tier.colorValue);
        
        return Container(
          height: 90,
          padding: const EdgeInsets.symmetric(horizontal: 2),
          child: Row(
            children: [
              Expanded(child: _buildGradientActionCard(
                'Loyalty\nPoints', 
                points > 999 ? '${(points/1000).toStringAsFixed(1)}k' : '$points', 
                Icons.stars_rounded, 
                [tierColor, tierColor.withValues(alpha: 0.8)], 
                () => _navigateToRoute(AppRoutes.loyalty),
              )),
              const SizedBox(width: 10),
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
      },
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
            count: _ordersCount,
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
            count: _wishlistCount,
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
            onTap: () => _navigateToRoute(AppRoutes.addresses),
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

  IconData _getTierIcon(LoyaltyTier tier) {
    switch (tier) {
      case LoyaltyTier.bronze:
        return Icons.shield_rounded;
      case LoyaltyTier.silver:
        return Icons.shield_moon_rounded;
      case LoyaltyTier.gold:
        return Icons.workspace_premium_rounded;
      case LoyaltyTier.platinum:
        return Icons.diamond_rounded;
      case LoyaltyTier.diamond:
        return Icons.stars_rounded;
    }
  }

  List<Color> _getTierGradient(LoyaltyTier tier) {
    switch (tier) {
      case LoyaltyTier.bronze:
        return [const Color(0xFFCD7F32), const Color(0xFF8B4513)];
      case LoyaltyTier.silver:
        return [const Color(0xFFC0C0C0), const Color(0xFF808080)];
      case LoyaltyTier.gold:
        return [const Color(0xFFFFD700), const Color(0xFFDAA520)];
      case LoyaltyTier.platinum:
        return [const Color(0xFFE5E4E2), const Color(0xFF9E9E9E)];
      case LoyaltyTier.diamond:
        return [AppColors.infoLight.withValues(alpha: 0.3), AppColors.primaryLight];
    }
  }
}