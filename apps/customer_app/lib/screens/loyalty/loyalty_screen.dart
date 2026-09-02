// loyalty_screen.dart
// 💎 PREMIUM: Ultra-Professional Glassmorphic Redesign

import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import '../../widgets/premium_scaffold.dart';
import '../../widgets/loyalty/loyalty_card.dart';

class LoyaltyScreen extends StatefulWidget {
  const LoyaltyScreen({super.key});

  @override
  State<LoyaltyScreen> createState() => _LoyaltyScreenState();
}

class _LoyaltyScreenState extends State<LoyaltyScreen> with TickerProviderStateMixin {
  late TabController _tabController;
  late AnimationController _bgAnimController;
  late AnimationController _floatController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    
    // Background Animations
    _bgAnimController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 30),
    )..repeat();

    _floatController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 5000),
    )..repeat(reverse: true);

    // Initialize loyalty data
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<LoyaltyProvider>(context, listen: false).init();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _bgAnimController.dispose();
    _floatController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;

    return PremiumScaffold(
      // resizeToAvoidBottomInset handled internally
      // backgroundColor handled internally
      extendBodyBehindAppBar: true,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(60),
        child: _buildGlassHeader(isDark),
      ),
      body: Stack(
        children: [
          // 1. Animated Background
          _buildAnimatedBackground(isDark),
          
          // 2. Floating Orbs
          ..._buildFloatingOrbs(isDark),

          // 3. Main Content
          Padding(
            padding: EdgeInsets.only(top: MediaQuery.of(context).padding.top),
            child: NestedScrollView(
              headerSliverBuilder: (context, innerBoxIsScrolled) => [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: const LoyaltyCard(compact: false)
                        .animate().scale(duration: 600.ms, curve: Curves.elasticOut),
                  ),
                ),
                SliverPersistentHeader(
                  delegate: _GlassTabBarDelegate(
                    tabController: _tabController,
                    isDark: isDark,
                    accentColor: accentColor,
                  ),
                  pinned: true,
                ),
              ],
              body: TabBarView(
                controller: _tabController,
                physics: const BouncingScrollPhysics(),
                children: [
                  _buildBenefitsTab(isDark, accentColor),
                  _buildTransactionsTab(isDark, accentColor),
                  _buildTiersTab(isDark, accentColor),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // --- BACKGROUND ANIMATIONS ---

  Widget _buildAnimatedBackground(bool isDark) {
    return AnimatedBuilder(
      animation: _bgAnimController,
      builder: (context, _) {
        return Container(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: Alignment(
                math.sin(_bgAnimController.value * 2 * math.pi) * 0.3,
                math.cos(_bgAnimController.value * 2 * math.pi) * 0.3,
              ),
              radius: 1.5,
              colors: isDark
                  ? [const Color(0xFF1E293B), const Color(0xFF0F172A), const Color(0xFF020617)]
                  : [const Color(0xFFF0F9FF), const Color(0xFFE0F2FE), const Color(0xFFF3F4F6)],
            ),
          ),
        );
      },
    );
  }

  List<Widget> _buildFloatingOrbs(bool isDark) {
    return [
      Positioned(
        top: -100,
        right: -100,
        child: AnimatedBuilder(
          animation: _floatController,
          builder: (context, _) {
            return Transform.translate(
              offset: Offset(0, _floatController.value * 30),
              child: Container(
                width: 300,
                height: 300,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      AppColors.primary.withValues(alpha: 0.15),
                      Colors.transparent,
                    ],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.05),
                      blurRadius: 60,
                      spreadRadius: 20,
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
      Positioned(
        bottom: 50,
        left: -50,
        child: AnimatedBuilder(
          animation: _floatController,
          builder: (context, _) {
            return Transform.translate(
              offset: Offset(0, -_floatController.value * 30),
              child: Container(
                width: 250,
                height: 250,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      Colors.amber.withValues(alpha: 0.15),
                      Colors.transparent,
                    ],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.amber.withValues(alpha: 0.05),
                      blurRadius: 60,
                      spreadRadius: 20,
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    ];
  }

  // --- WIDGETS ---

  Widget _buildGlassHeader(bool isDark) {
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: AppBar(
          backgroundColor: (isDark ? Colors.black : Colors.white).withValues(alpha: 0.5),
          elevation: 0,
          centerTitle: true,
          leading: IconButton(
            icon: Icon(Icons.arrow_back_ios_new_rounded, 
               color: isDark ? Colors.white : Colors.black87, size: 20),
            onPressed: () => Navigator.pop(context),
          ),
          title: Text(
            'Loyalty Rewards',
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : Colors.black87,
              letterSpacing: 0.5,
            ),
          ),
          actions: [
             IconButton(
               icon: Icon(Icons.info_outline_rounded, 
                 color: isDark ? Colors.white70 : Colors.black54),
               onPressed: () {}, // TODO: Show help
             )
          ],
        ),
      ),
    );
  }

  Widget _buildBenefitsTab(bool isDark, Color accentColor) {
    return Consumer<LoyaltyProvider>(
      builder: (context, loyaltyProvider, _) {
        final benefits = loyaltyProvider.currentTierBenefits;
        final nextTier = LoyaltyTier.values.length > loyaltyProvider.currentTier.index + 1
            ? LoyaltyTier.values[loyaltyProvider.currentTier.index + 1]
            : null;

        return ListView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          children: [
            _buildSectionTitle('Current Benefits', isDark),
            const SizedBox(height: 12),
            ...benefits.map((benefit) => _buildBenefitItem(benefit, isDark, accentColor))
                .toList()
                .animate(interval: 50.ms).fadeIn().slideX(begin: 0.1, end: 0),
            
            if (nextTier != null && loyaltyProvider.nextTierBenefits != null) ...[
              const SizedBox(height: 30),
               _buildSectionTitle('Unlock with ${nextTier.displayName}', isDark, isLocked: true),
              const SizedBox(height: 12),
              ...loyaltyProvider.nextTierBenefits!.map(
                (benefit) => _buildBenefitItem(benefit, isDark, accentColor, locked: true),
              ).toList().animate(interval: 50.ms, delay: 200.ms).fadeIn().slideX(begin: 0.1, end: 0),
            ],
            const SizedBox(height: 100),
          ],
        );
      },
    );
  }

  Widget _buildSectionTitle(String title, bool isDark, {bool isLocked = false}) {
    return Row(
      children: [
        if (isLocked) 
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: Icon(Icons.lock_outline_rounded, 
              size: 16, color: isDark ? Colors.white54 : Colors.black54),
          ),
        Text(
          title,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w800,
            color: (isDark ? Colors.white : Colors.black).withValues(alpha: isLocked ? 0.6 : 0.9),
            letterSpacing: 0.5,
            
          ),
        ),
      ],
    );
  }

  Widget _buildBenefitItem(String benefit, bool isDark, Color accentColor, {bool locked = false}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: (isDark ? Colors.white : Colors.white).withOpacity(
                isDark ? (locked ? 0.03 : 0.08) : (locked ? 0.5 : 0.7)
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: (isDark ? Colors.white : Colors.white).withValues(alpha: locked ? 0.05 : 0.15),
                width: 1,
              ),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: locked 
                        ? (isDark ? Colors.white10 : Colors.black.withValues(alpha: 0.05))
                        : accentColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    locked ? Icons.lock_rounded : Icons.check_circle_rounded,
                    color: locked 
                        ? (isDark ? Colors.white30 : Colors.black26)
                        : accentColor,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Text(
                    benefit,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: locked
                          ? (isDark ? Colors.white38 : Colors.black38)
                          : (isDark ? Colors.white.withValues(alpha: 0.9) : Colors.black87),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTransactionsTab(bool isDark, Color accentColor) {
    return Consumer<LoyaltyProvider>(
      builder: (context, loyaltyProvider, _) {
        final transactions = loyaltyProvider.transactions;

        if (transactions.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                   padding: const EdgeInsets.all(24),
                   decoration: BoxDecoration(
                     color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.03),
                     shape: BoxShape.circle,
                   ),
                   child: Icon(Icons.receipt_long_rounded, size: 48, color: isDark ? Colors.white24 : Colors.black26),
                ),
                const SizedBox(height: 24),
                Text(
                  'No transactions yet',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: isDark ? Colors.white70 : Colors.black54,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Your point history will appear here',
                  style: TextStyle(
                    fontSize: 14,
                    color: isDark ? Colors.white38 : Colors.black38,
                  ),
                ),
              ],
            ),
          ).animate().fadeIn(duration: 600.ms);
        }

        return ListView.separated(
          padding: const EdgeInsets.all(20),
          itemCount: transactions.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            return _buildTransactionItem(transactions[index], isDark, accentColor)
                .animate(delay: (index * 50).ms).fadeIn().slideY(begin: 0.1, end: 0);
          },
        );
      },
    );
  }

  Widget _buildTransactionItem(LoyaltyTransaction tx, bool isDark, Color accentColor) {
    final isPositive = tx.points > 0;
    final typeColor = isPositive ? const Color(0xFF10B981) : const Color(0xFFF59E0B);
    final dateFormat = DateFormat('MMM d, h:mm a');

    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 5, sigmaY: 5),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: (isDark ? Colors.white : Colors.white).withValues(alpha: isDark ? 0.05 : 0.7),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
            ),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: typeColor.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  isPositive ? Icons.arrow_downward_rounded : Icons.arrow_upward_rounded,
                  color: typeColor,
                  size: 20,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tx.description,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      dateFormat.format(tx.createdAt),
                      style: TextStyle(
                        fontSize: 12,
                        color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.5),
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                '${isPositive ? '+' : ''}${tx.points}',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: typeColor,
                  letterSpacing: -0.5,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTiersTab(bool isDark, Color accentColor) {
    return Consumer<LoyaltyProvider>(
      builder: (context, loyaltyProvider, _) {
        final currentTier = loyaltyProvider.currentTier;

        return ListView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          children: [
            ...LoyaltyTier.values.map((tier) => 
               _buildTierCard(tier, currentTier, isDark)
                 .animate(delay: (tier.index * 100).ms).fadeIn().slideX(begin: 0.1, end: 0)
            ),
            const SizedBox(height: 100),
          ],
        );
      },
    );
  }

  Widget _buildTierCard(LoyaltyTier tier, LoyaltyTier currentTier, bool isDark) {
    final isCurrentTier = tier == currentTier;
    final tierColor = Color(tier.colorValue);
    final isLocked = tier.index > currentTier.index;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Container(
             decoration: BoxDecoration(
               gradient: LinearGradient(
                 colors: [
                   (isDark ? Colors.white : Colors.white).withValues(alpha: isCurrentTier ? (isDark ? 0.1 : 0.9) : (isDark ? 0.05 : 0.6)),
                   (isDark ? Colors.white : Colors.white).withValues(alpha: isCurrentTier ? (isDark ? 0.05 : 0.8) : (isDark ? 0.02 : 0.5)),
                 ],
                 begin: Alignment.topLeft,
                 end: Alignment.bottomRight,
               ),
               borderRadius: BorderRadius.circular(20),
               border: Border.all(
                 color: isCurrentTier ? tierColor.withValues(alpha: 0.5) : (isDark ? Colors.white12 : Colors.black.withValues(alpha: 0.05)),
                 width: isCurrentTier ? 1.5 : 1,
               ),
               boxShadow: isCurrentTier ? [
                 BoxShadow(color: tierColor.withValues(alpha: 0.15), blurRadius: 20, offset: const Offset(0, 8))
               ] : null,
             ),
             child: Stack(
               children: [
                  // Glow Effect for current tier
                  if (isCurrentTier)
                    Positioned(
                      top: -50,
                      right: -50,
                      child: Container(
                        width: 150,
                        height: 150,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: tierColor.withValues(alpha: 0.2),
                          boxShadow: [BoxShadow(color: tierColor, blurRadius: 80, spreadRadius: 10)],
                        ),
                      ),
                    ),

                  Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: tierColor.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: tierColor.withValues(alpha: 0.2)),
                              ),
                              child: Icon(
                                _getTierIcon(tier),
                                color: tierColor,
                                size: 24,
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    tier.displayName,
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w800,
                                      color: isLocked && isDark 
                                          ? Colors.white38 
                                          : (isDark ? Colors.white : Colors.black87),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${tier.cashbackPercentage}% Cashback',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      color: tierColor,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (isCurrentTier)
                               Container(
                                 padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                 decoration: BoxDecoration(
                                   color: tierColor,
                                   borderRadius: BorderRadius.circular(20),
                                   boxShadow: [
                                     BoxShadow(color: tierColor.withValues(alpha: 0.4), blurRadius: 8, offset: const Offset(0, 2))
                                   ]
                                 ),
                                 child: const Text(
                                   'CURRENT',
                                   style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                                 ),
                               )
                            else if (isLocked)
                               Icon(Icons.lock_rounded, color: isDark ? Colors.white12 : Colors.black12, size: 24),
                          ],
                        ),
                        const SizedBox(height: 16),
                        _buildTierRequirement(tier, isDark, tierColor),
                      ],
                    ),
                  ),
               ],
             ),
          ),
        ),
      ),
    );
  }

  Widget _buildTierRequirement(LoyaltyTier tier, bool isDark, Color color) {
    if (tier.minSpend == 0) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: (isDark ? Colors.black : Colors.white).withValues(alpha: isDark ? 0.2 : 0.5),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(Icons.monetization_on_outlined, size: 16, color: color),
          const SizedBox(width: 8),
          Text(
            'Spend over ₹${tier.minSpend.toStringAsFixed(0)}',
            style: TextStyle(
              fontSize: 13,
              color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.7),
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
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
}

class _GlassTabBarDelegate extends SliverPersistentHeaderDelegate {
  final TabController tabController;
  final bool isDark;
  final Color accentColor;

  _GlassTabBarDelegate({
    required this.tabController,
    required this.isDark,
    required this.accentColor,
  });

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          color: (isDark ? Colors.black : Colors.white).withValues(alpha: 0.6),
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Center(
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 20),
              height: 40,
              decoration: BoxDecoration(
                color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.black.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(25),
              ),
              child: TabBar(
                controller: tabController,
                padding: const EdgeInsets.all(4),
                
                // Active State
                labelColor: isDark ? Colors.black : Colors.white,
                labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                
                // Inactive State
                unselectedLabelColor: isDark ? Colors.white70 : Colors.black54,
                unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                
                // Indicators
                dividerColor: Colors.transparent,
                indicator: BoxDecoration(
                  color: accentColor,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(color: accentColor.withValues(alpha: 0.3), blurRadius: 8, offset: const Offset(0, 2))
                  ]
                ),
                indicatorSize: TabBarIndicatorSize.tab,
                
                tabs: const [
                  Tab(text: 'Benefits'),
                  Tab(text: 'History'),
                  Tab(text: 'Tiers'),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  double get maxExtent => 64;

  @override
  double get minExtent => 64;

  @override
  bool shouldRebuild(covariant _GlassTabBarDelegate oldDelegate) => false;
}
