// lib/screens/wallet/seller_wallet_screen.dart
// 💰 ULTRA-PREMIUM SELLER WALLET SCREEN
// ✨ Responsive, Animated, Glassmorphic Design matching Login/KYC Theme
// 📱 Mobile < 768, Desktop > 768

import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../providers/seller_provider.dart';
import '../../services/wallet_service.dart';
import '../../models/wallet_transaction_model.dart';
import '../../models/payout_request_model.dart';
import 'widgets/earnings_chart_widget.dart';
import 'widgets/bank_accounts_sheet.dart';
import 'widgets/transaction_detail_sheet.dart';

class SellerWalletScreen extends StatefulWidget {
  const SellerWalletScreen({super.key});

  @override
  State<SellerWalletScreen> createState() => _SellerWalletScreenState();
}

class _SellerWalletScreenState extends State<SellerWalletScreen> with TickerProviderStateMixin {
  final WalletService _walletService = WalletService();
  final _amountController = TextEditingController();
  final _currencyFormat = NumberFormat('#,##,###', 'en_IN');
  
  // Animation Controllers
  late AnimationController _bgAnimController;
  late AnimationController _floatController;
  late TabController _tabController;
  
  bool _isLoading = true;
  final bool _isWithdrawing = false;
  Map<String, dynamic> _walletStats = {};
  String? _error;
  
  int _selectedFilter = 0; // 0=All, 1=Credits, 2=Outputs, 3=InTransit

  @override
  void initState() {
    super.initState();
    _initAnimations();
    _tabController = TabController(length: 4, vsync: this);
    _tabController.addListener(() {
      if (!_tabController.indexIsChanging) {
        setState(() => _selectedFilter = _tabController.index);
      }
    });
    _loadWalletStats();
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
    _tabController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _loadWalletStats() async {
    final sellerProvider = Provider.of<SellerProvider>(context, listen: false);
    final seller = sellerProvider.currentSeller;
    if (seller == null) return;
    
    setState(() {
      _isLoading = true;
      _error = null;
    });
    
    try {
      // Refresh seller data from Firestore first
      await sellerProvider.refreshSellerData();
      
      // Then fetch wallet stats from Cloud Function
      final stats = await _walletService.getWalletStats(seller.sellerId);
      if (mounted) {
        setState(() {
          _walletStats = stats;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final sellerProvider = Provider.of<SellerProvider>(context);
    final seller = sellerProvider.currentSeller;
    final theme = Theme.of(context);
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final size = MediaQuery.of(context).size;
    final isDesktop = size.width > 900;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF080B12) : const Color(0xFFF0F4F8),
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        flexibleSpace: ClipRRect(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
            child: Container(color: (isDark ? Colors.black : Colors.white).withValues(alpha: 0.5)),
          ),
        ),
        title: Text(
          'Wallet & Payouts',
          style: TextStyle(
            color: isDark ? Colors.white : Colors.black,
            fontWeight: FontWeight.w800,
          ),
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh_rounded, color: isDark ? Colors.white : Colors.black),
            onPressed: _loadWalletStats,
            tooltip: 'Refresh Balance',
          ),
          IconButton(
            icon: Icon(Icons.help_outline_rounded, color: isDark ? Colors.white : Colors.black),
            onPressed: _showHelpSheet,
          ),
        ],
      ),
      body: Stack(
        children: [
          // 1. Animated Background
          _buildAnimatedBackground(isDark),
          
          // 2. Floating Orbs (Desktop decoration)
          if (isDesktop) ..._buildFloatingOrbs(isDark, size),

          // 3. Main Content
          SafeArea(
            child: RefreshIndicator(
              onRefresh: _loadWalletStats,
              color: AppColors.primary,
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null
                      ? _buildErrorState(isDark)
                      : isDesktop
                          ? _buildDesktopLayout(seller, isDark, size)
                          : _buildMobileLayout(seller, isDark),
            ),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ANIMATED BACKGROUND
  // ═══════════════════════════════════════════════════════════════════════
  
  Widget _buildAnimatedBackground(bool isDark) {
    return AnimatedBuilder(
      animation: _bgAnimController,
      builder: (context, child) {
        return Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: isDark 
                  ? [AppColors.backgroundDark, AppColors.surfaceDark, AppColors.surfaceDarkVariant]
                  : [AppColors.background, AppColors.surface, AppColors.surfaceVariant],
              stops: const [0.0, 0.5, 1.0],
              transform: GradientRotation(_bgAnimController.value * 2 * math.pi),
            ),
          ),
          child: CustomPaint(
            size: Size.infinite,
            painter: _GridPatternPainter(isDark: isDark, opacity: 0.03),
          ),
        );
      },
    );
  }

  List<Widget> _buildFloatingOrbs(bool isDark, Size size) {
    return [
      Positioned(
        top: size.height * 0.1,
        right: size.width * 0.1,
        child: AnimatedBuilder(
          animation: _floatController,
          builder: (context, _) => Transform.translate(
            offset: Offset(0, _floatController.value * 20),
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppColors.primary.withValues(alpha: 0.15),
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

  // ═══════════════════════════════════════════════════════════════════════
  // LAYOUTS
  // ═══════════════════════════════════════════════════════════════════════

  Widget _buildMobileLayout(seller, bool isDark) {
    return CustomScrollView(
      physics: const BouncingScrollPhysics(),
      slivers: [
        SliverToBoxAdapter(child: _buildBalanceCard(seller, isDark, isMobile: true)),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: _buildQuickActions(seller, isDark),
          ),
        ),
        SliverToBoxAdapter(child: _buildStatsGrid(isDark, isMobile: true)),
        // NEW: Earnings Chart
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: EarningsChartWidget(sellerId: seller?.sellerId ?? '', isDark: isDark),
          ),
        ),
        SliverToBoxAdapter(child: _buildWeeklyLimitLinear(isDark)),
        SliverToBoxAdapter(child: _buildTransactionHeader(isDark)),
        SliverToBoxAdapter(child: _buildTransactionTabs(isDark)),
        _buildTransactionList(seller?.sellerId, isDark),
        const SliverToBoxAdapter(child: SizedBox(height: 80)),
      ],
    );
  }
  
  Widget _buildDesktopLayout(seller, bool isDark, Size size) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Left Column: Stats & Balance
        Expanded(
          flex: 4,
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                _buildBalanceCard(seller, isDark, isMobile: false),
                const SizedBox(height: 24),
                _buildQuickActions(seller, isDark),
                const SizedBox(height: 24),
                _buildStatsGrid(isDark, isMobile: false),
                const SizedBox(height: 24),
                _buildWeeklyLimitLinear(isDark),
              ],
            ),
          ),
        ),
        
        // Right Column: Transactions
        Expanded(
          flex: 6,
          child: Container(
            margin: const EdgeInsets.fromLTRB(0, 24, 24, 24),
            decoration: BoxDecoration(
              color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.withValues(alpha: 0.1)),
            ),
            child: Column(
              children: [
                _buildTransactionHeader(isDark),
                _buildTransactionTabs(isDark),
                Expanded(
                  child: CustomScrollView(
                    slivers: [
                      _buildTransactionList(seller?.sellerId, isDark),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BALANCE CARD (Glassmorphic)
  // ═══════════════════════════════════════════════════════════════════════

  Widget _buildBalanceCard(seller, bool isDark, {required bool isMobile}) {
    final walletBalance = _walletStats['walletBalance'] ?? seller?.walletBalance ?? 0.0;
    final pendingAmount = _walletStats['pendingAmount'] ?? 0.0;
    final processingAmount = _walletStats['processingAmount'] ?? 0.0;
    final totalEarnings = _walletStats['netLifetimeEarnings'] ?? 0.0;
    
    final bankAcct = seller?.bankAccountNumber;
    final last4 = bankAcct != null && bankAcct.length >= 4 
        ? bankAcct.substring(bankAcct.length - 4) 
        : 'XXXX';
    
    // Theme-aware colors
    final textColor = isDark ? AppColors.textLight : AppColors.textPrimary;
    
    return GestureDetector(
      onTap: () => _showDetailedReport(seller, walletBalance, pendingAmount, processingAmount, totalEarnings),
      child: Container(
        margin: EdgeInsets.all(isMobile ? 16 : 0),
        height: 200,
        width: double.infinity,
        child: Stack(
          children: [
            // Premium Gradient Background using AppColors - theme aware
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: isDark 
                      ? [AppColors.backgroundDark, AppColors.surfaceDark, AppColors.surfaceDarkVariant]
                      : [AppColors.background, AppColors.surface, AppColors.surfaceVariant],
                ),
                borderRadius: BorderRadius.circular(20),
                border: isDark ? null : Border.all(color: AppColors.border.withValues(alpha: 0.2)),
              ),
            ),
            
            // Content
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Top Row
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Icon(Icons.account_balance_wallet, color: AppColors.primary, size: 20),
                          ),
                          const SizedBox(width: 12),
                          Text(
                            'Wallet Balance',
                            style: TextStyle(
                              color: textColor.withValues(alpha: 0.7),
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                      // Tap hint
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: textColor.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text('Details', style: TextStyle(color: textColor.withValues(alpha: 0.6), fontSize: 11)),
                            const SizedBox(width: 4),
                            Icon(Icons.arrow_forward_ios, color: textColor.withValues(alpha: 0.6), size: 10),
                          ],
                        ),
                      ),
                    ],
                  ),
                  
                  // Balance Display
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '₹',
                            style: TextStyle(
                              color: textColor.withValues(alpha: 0.8),
                              fontSize: 24,
                              fontWeight: FontWeight.w300,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            _currencyFormat.format(walletBalance),
                            style: TextStyle(
                              color: textColor,
                              fontSize: 36,
                              fontWeight: FontWeight.bold,
                              letterSpacing: -1,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Available for withdrawal',
                        style: TextStyle(color: AppColors.primary, fontSize: 12),
                      ),
                    ],
                  ),
                  
                  // Bottom Row - Bank & Store
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.credit_card, color: textColor.withValues(alpha: 0.4), size: 16),
                          const SizedBox(width: 8),
                          Text(
                            last4 != 'XXXX' ? '•••• $last4' : 'No bank linked',
                            style: TextStyle(
                              color: textColor.withValues(alpha: 0.5),
                              fontSize: 13,
                              letterSpacing: 1,
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.success.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.verified, color: AppColors.success, size: 12),
                            const SizedBox(width: 4),
                            Text(
                              'Verified',
                              style: TextStyle(color: AppColors.success, fontSize: 11, fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ).animate().fadeIn().slideY(begin: 0.1);
  }

  void _showDetailedReport(seller, double available, double pending, double processing, double total) {
    final isDark = Provider.of<ThemeProvider>(context, listen: false).isDarkMode;
    
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.7,
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          children: [
            // Handle
            Container(
              margin: const EdgeInsets.only(top: 12),
              width: 40,
              height: 4,
              decoration: BoxDecoration(color: Colors.grey[400], borderRadius: BorderRadius.circular(2)),
            ),
            
            // Header
            Padding(
              padding: const EdgeInsets.all(20),
              child: Row(
                children: [
                  Icon(Icons.account_balance_wallet, color: Colors.teal, size: 28),
                  const SizedBox(width: 12),
                  Text('Credit Report', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                ],
              ),
            ),
            
            const Divider(height: 1),
            
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  // Balance Breakdown
                  _buildReportSection('Balance Breakdown', [
                    _buildReportRow('Available Balance', available, Colors.green, isDark),
                    _buildReportRow('Pending Balance', pending, Colors.orange, isDark),
                    _buildReportRow('Processing', processing, Colors.blue, isDark),
                    const Divider(),
                    _buildReportRow('Total Earnings', total, Colors.teal, isDark, isBold: true),
                  ], isDark),
                  
                  const SizedBox(height: 20),
                  
                  // Settlement Info
                  _buildReportSection('Settlement Cycle', [
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.blue.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.info_outline, color: Colors.blue, size: 20),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'T + 7 days after delivery\n(After return window closes)',
                              style: TextStyle(color: Colors.blue, fontSize: 13),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ], isDark),
                  
                  const SizedBox(height: 20),
                  
                  // Fee Structure
                  _buildReportSection('Fee Structure', [
                    _buildFeeRow('Platform Commission', '10-12%', isDark),
                    _buildFeeRow('Payment Gateway', '2-3%', isDark),
                    _buildFeeRow('GST on Fees', '18%', isDark),
                  ], isDark),
                  
                  const SizedBox(height: 20),
                  
                  // Next Payout
                  _buildReportSection('Next Payout', [
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.green.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Expected Date', style: TextStyle(color: Colors.grey, fontSize: 12)),
                              Text(_walletService.getNextPayoutLabel(), style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                            ],
                          ),
                          Icon(Icons.calendar_today, color: Colors.green),
                        ],
                      ),
                    ),
                  ], isDark),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildReportSection(String title, List<Widget> children, bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: isDark ? Colors.white : Colors.black87)),
        const SizedBox(height: 12),
        ...children,
      ],
    );
  }

  Widget _buildReportRow(String label, double amount, Color color, bool isDark, {bool isBold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
              const SizedBox(width: 12),
              Text(label, style: TextStyle(color: isDark ? Colors.white70 : Colors.grey[700])),
            ],
          ),
          Text(
            '₹${_currencyFormat.format(amount)}',
            style: TextStyle(fontWeight: isBold ? FontWeight.bold : FontWeight.w600, fontSize: isBold ? 18 : 14, color: isDark ? Colors.white : Colors.black87),
          ),
        ],
      ),
    );
  }

  Widget _buildFeeRow(String label, String value, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: isDark ? Colors.white70 : Colors.grey[700])),
          Text(value, style: TextStyle(fontWeight: FontWeight.w600, color: isDark ? Colors.white : Colors.black87)),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // QUICK ACTIONS
  // ═══════════════════════════════════════════════════════════════════════

  Widget _buildQuickActions(seller, bool isDark) {
    final bgColors = isDark 
        ? [AppColors.surfaceDarkVariant, AppColors.surfaceDark]
        : [AppColors.surfaceVariant, AppColors.surface];
    return Row(
      children: [
        Expanded(
          child: _buildPremiumActionCard(
            icon: Icons.arrow_upward_rounded,
            label: 'Withdraw',
            subtitle: 'To Bank',
            gradient: bgColors,
            accentColor: AppColors.primary,
            isDark: isDark,
            onTap: () => _showWithdrawSheet(context, seller),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _buildPremiumActionCard(
            icon: Icons.history_rounded,
            label: 'Payouts',
            subtitle: 'History',
            gradient: bgColors,
            accentColor: AppColors.secondary,
            isDark: isDark,
            onTap: _showPayoutHistory,
          ),
        ),
      ],
    ).animate().fadeIn(delay: 100.ms);
  }

  Widget _buildPremiumActionCard({
    required IconData icon,
    required String label,
    required String subtitle,
    required List<Color> gradient,
    required Color accentColor,
    required bool isDark,
    required VoidCallback onTap,
  }) {
    final textColor = isDark ? AppColors.textLight : AppColors.textPrimary;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 80,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: gradient,
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: accentColor.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: accentColor, size: 22),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    color: textColor,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: TextStyle(
                    color: textColor.withValues(alpha: 0.5),
                    fontSize: 11,
                  ),
                ),
              ],
            ),
            const Spacer(),
            Icon(Icons.chevron_right, color: textColor.withValues(alpha: 0.3), size: 20),
          ],
        ),
      ),
    );
  }

  void _showBankAccounts(seller) {
    if (seller == null) return;
    final isDark = Provider.of<ThemeProvider>(context, listen: false).isDarkMode;
    
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => BankAccountsSheet(
        sellerId: seller.sellerId,
        isDark: isDark,
      ),
    );
  }

  Widget _buildActionButton({
    required bool isDark,
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        height: 60,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: isDark 
              ? [Colors.white.withValues(alpha: 0.08), Colors.white.withValues(alpha: 0.03)]
              : [Colors.white, Colors.grey.shade50],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.withValues(alpha: 0.1)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 12),
            Text(
              label,
              style: TextStyle(
                color: isDark ? Colors.white : Colors.black87,
                fontWeight: FontWeight.w600,
                fontSize: 15,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STATS GRID
  // ═══════════════════════════════════════════════════════════════════════

  Widget _buildStatsGrid(bool isDark, {required bool isMobile}) {
    final pending = _walletStats['pendingAmount'] ?? 0.0;
    final totalEarnings = _walletStats['netLifetimeEarnings'] ?? 0.0;
    final bgColors = isDark 
        ? [AppColors.backgroundDark, AppColors.surfaceDark]
        : [AppColors.background, AppColors.surface];
    
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: isMobile ? 16 : 0, vertical: 16),
      child: Row(
        children: [
          Expanded(
            child: _buildPremiumStatCard(
              label: 'Total Earnings',
              amount: totalEarnings,
              icon: Icons.trending_up_rounded,
              accentColor: AppColors.success,
              gradient: bgColors,
              isDark: isDark,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _buildPremiumStatCard(
              label: 'Pending',
              amount: pending,
              icon: Icons.schedule_rounded,
              accentColor: AppColors.warning,
              gradient: bgColors,
              isDark: isDark,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPremiumStatCard({
    required String label,
    required double amount,
    required IconData icon,
    required Color accentColor,
    required List<Color> gradient,
    required bool isDark,
  }) {
    final textColor = isDark ? AppColors.textLight : AppColors.textPrimary;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: gradient,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: isDark ? null : Border.all(color: AppColors.border.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: accentColor.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 16, color: accentColor),
              ),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  color: textColor.withValues(alpha: 0.6),
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            '₹${_currencyFormat.format(amount)}',
            style: TextStyle(
              color: textColor,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // WEEKLY LIMIT
  // ═══════════════════════════════════════════════════════════════════════

  Widget _buildWeeklyLimitLinear(bool isDark) {
    final weeklyWithdrawn = (_walletStats['weeklyWithdrawn'] ?? 0.0).toDouble();
    final remaining = math.max(0.0, 2000.0 - weeklyWithdrawn);
    final progress = (weeklyWithdrawn / 2000.0).clamp(0.0, 1.0);
    final textColor = isDark ? AppColors.textLight : AppColors.textPrimary;
    
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isDark 
              ? [AppColors.backgroundDark, AppColors.surfaceDark]
              : [AppColors.background, AppColors.surface],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: isDark ? null : Border.all(color: AppColors.border.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Weekly Limit',
                style: TextStyle(
                  color: textColor,
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                ),
              ),
              Text(
                '₹${weeklyWithdrawn.toInt()} / ₹2,000',
                style: TextStyle(
                  color: textColor.withValues(alpha: 0.6),
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: progress,
              backgroundColor: isDark ? AppColors.surfaceDarkVariant : AppColors.surfaceVariant,
              color: progress > 0.9 ? AppColors.error : AppColors.primary,
              minHeight: 8,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            remaining > 0 
                ? 'You can withdraw ₹${remaining.toInt()} more this week'
                : 'Limit reached. Resets next Monday.',
            style: TextStyle(
              color: remaining == 0 ? AppColors.error : textColor.withValues(alpha: 0.5),
              fontSize: 12,
            ),
          ),
        ],
      ),
    ).animate().fadeIn(delay: 200.ms);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TRANSACTION HISTORY
  // ═══════════════════════════════════════════════════════════════════════

  Widget _buildTransactionHeader(bool isDark) {
    final textColor = isDark ? AppColors.textLight : AppColors.textPrimary;
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
      child: Text(
        'Transaction History',
        style: TextStyle(
          color: textColor,
          fontSize: 18,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _buildTransactionTabs(bool isDark) {
    final textColor = isDark ? AppColors.textLight : AppColors.textPrimary;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(12),
      ),
      child: TabBar(
        controller: _tabController,
        dividerColor: Colors.transparent,
        indicator: BoxDecoration(
          color: AppColors.primary,
          borderRadius: BorderRadius.circular(10),
        ),
        indicatorSize: TabBarIndicatorSize.tab,
        labelColor: isDark ? AppColors.textLight : AppColors.surface,
        unselectedLabelColor: textColor.withValues(alpha: 0.5),
        indicatorPadding: const EdgeInsets.all(4),
        overlayColor: WidgetStateProperty.all(Colors.transparent),
        tabs: const [
          Tab(text: 'All'),
          Tab(text: 'Credits'),
          Tab(text: 'Payouts'),
          Tab(text: 'In Transit'),
        ],
      ),
    );
  }

  Widget _buildTransactionList(String? sellerId, bool isDark) {
    if (sellerId == null) return const SliverToBoxAdapter(child: SizedBox());

    return StreamBuilder<List<WalletTransactionModel>>(
      stream: _walletService.getTransactionHistory(sellerId: sellerId), // Fixed: Use named arg
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const SliverToBoxAdapter(child: LinearProgressIndicator());
        }

        if (!snapshot.hasData || snapshot.data!.isEmpty) {
          return SliverToBoxAdapter(child: _buildEmptyState(isDark));
        }

        var transactions = snapshot.data!;
        
        // Filter logic
        if (_selectedFilter == 1) {
          transactions = transactions.where((t) => t.type == TransactionType.orderCredit || t.type == TransactionType.refund).toList();
        } else if (_selectedFilter == 2) { // Payouts
          transactions = transactions.where((t) => t.type == TransactionType.withdrawal || t.type == TransactionType.autoPayout).toList();
        } else if (_selectedFilter == 3) { // In Transit
             // Assuming validation check or checking pending status
             // For now just filtering "pending" withdrawals
             transactions = transactions.where((t) => t.status == TransactionStatus.pending).toList();
        }

        return SliverPadding(
          padding: const EdgeInsets.all(16),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                return _buildTransactionItem(transactions[index], isDark)
                    .animate().fadeIn(delay: (index * 50).ms).slideX();
              },
              childCount: transactions.length,
            ),
          ),
        );
      },
    );
  }

  Widget _buildTransactionItem(WalletTransactionModel tx, bool isDark) {
    // Use the amount that has a value
    final rawAmount = tx.netAmount != 0 ? tx.netAmount : tx.grossAmount;
    // Determine credit/debit from amount sign OR transaction type
    final isCredit = rawAmount > 0 || (rawAmount == 0 && tx.isCredit);
    final color = isCredit ? AppColors.success : AppColors.error;
    // Always display absolute value
    final displayAmount = rawAmount.abs();
    final textColor = isDark ? AppColors.textLight : AppColors.textPrimary;
    
    return GestureDetector(
      onTap: () => _showTransactionDetail(tx, isDark),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: isDark 
                ? [AppColors.backgroundDark, AppColors.surfaceDark]
                : [AppColors.background, AppColors.surface],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
          border: isDark ? null : Border.all(color: AppColors.border.withValues(alpha: 0.2)),
        ),
        child: Row(
          children: [
            // Icon
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                isCredit ? Icons.arrow_downward_rounded : Icons.arrow_upward_rounded,
                color: color,
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            // Details
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _getSmartLabel(tx, isCredit),
                    style: TextStyle(
                      color: textColor,
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text(
                        DateFormat('MMM dd, hh:mm a').format(tx.createdAt),
                        style: TextStyle(
                          color: textColor.withValues(alpha: 0.5),
                          fontSize: 11,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Icon(Icons.touch_app, size: 10, color: textColor.withValues(alpha: 0.3)),
                      Text(' Tap', style: TextStyle(fontSize: 9, color: textColor.withValues(alpha: 0.3))),
                    ],
                  ),
                ],
              ),
            ),
            // Amount & Status
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${isCredit ? '+' : '-'} ₹${_currencyFormat.format(displayAmount)}',
                  style: TextStyle(
                    color: color,
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                ),
                if (tx.status != TransactionStatus.completed) ...[
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: _getStatusColor(tx.status.toString()).withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      tx.statusLabel,
                      style: TextStyle(
                        color: _getStatusColor(tx.status.toString()),
                        fontSize: 9,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showTransactionDetail(WalletTransactionModel tx, bool isDark) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => TransactionDetailSheet(
        transaction: tx,
        isDark: isDark,
      ),
    );
  }

  Color _getStatusColor(String status) {
    // Basic status color mapping helper
    if (status.contains('completed')) return Colors.green;
    if (status.contains('pending')) return Colors.orange;
    if (status.contains('processing')) return Colors.blue;
    if (status.contains('failed')) return Colors.red;
    return Colors.grey;
  }

  String _getSmartLabel(WalletTransactionModel tx, bool isCredit) {
    final desc = tx.description.toLowerCase();
    
    // Check description for ad transfer patterns
    if (desc.contains('ad wallet') || desc.contains('ad transfer') || 
        desc.contains('transfer to ad') || desc.contains('advertising')) {
      return 'Ad Wallet Transfer';
    }
    
    // If it's an orderCredit type but shows as debit (negative), it's likely an ad transfer
    if (tx.type == TransactionType.orderCredit && !isCredit) {
      return 'Ad Wallet Transfer';
    }
    
    // Use the type label
    return tx.typeLabel;
  }

  Widget _buildEmptyState(bool isDark) {
    final textColor = isDark ? AppColors.textLight : AppColors.textPrimary;
    return Padding(
      padding: const EdgeInsets.all(40),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.receipt_long_rounded, size: 64, color: textColor.withValues(alpha: 0.2)),
          const SizedBox(height: 16),
          Text(
            'No transactions yet',
            style: TextStyle(
              color: textColor.withValues(alpha: 0.5),
              fontSize: 16,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState(bool isDark) {
    final textColor = isDark ? AppColors.textLight : AppColors.textPrimary;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.error_outline_rounded, size: 48, color: AppColors.error),
          const SizedBox(height: 16),
          Text(
            _error ?? 'An unknown error occurred',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: textColor.withValues(alpha: 0.7),
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: _loadWalletStats,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Try Again'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: isDark ? AppColors.textLight : AppColors.surface,
            ),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // WITHDRAWAL SHEET
  // ═══════════════════════════════════════════════════════════════════════

  void _showWithdrawSheet(BuildContext context, seller) {
    if (seller == null) return;
    
    final weeklyWithdrawn = (_walletStats['weeklyWithdrawn'] ?? 0.0).toDouble();
    final remainingLimit = 2000.0 - weeklyWithdrawn;
    final double availableBalance = (seller.walletBalance ?? 0.0).toDouble();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _WithdrawalSheet(
        sellerId: seller.sellerId,
        available: availableBalance,
        weeklyLimitRemaining: remainingLimit,
        bankAccountNumber: seller.bankAccountNumber,
        bankName: seller.bankName,
        accountHolderName: seller.bankAccountHolderName,
        ifscCode: seller.bankIfscCode,
        onSuccess: () {
          _loadWalletStats();
          Navigator.pop(context);
        },
      ),
    );
  }

  void _showPayoutHistory() {
     showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => const PayoutHistorySheet(),
    );
  }

  void _showHelpSheet() {
    showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: const EdgeInsets.all(24),
        child: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Wallet Help', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            SizedBox(height: 16),
            Text('• Withdrawals are processed within 24-48 hours.'),
            Text('• Minimum withdrawal amount is ₹500.'),
            Text('• Weekly withdrawal limit is ₹2,000.'),
            Text('• Platform fee + GST is deducted from orders.'),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SEPARATE SHEETS
// ═══════════════════════════════════════════════════════════════════════

class _WithdrawalSheet extends StatefulWidget {
  final String sellerId;
  final double available;
  final double weeklyLimitRemaining;
  final String? bankAccountNumber;
  final String? bankName;
  final String? accountHolderName;
  final String? ifscCode;
  final VoidCallback onSuccess;

  const _WithdrawalSheet({
    required this.sellerId,
    required this.available,
    required this.weeklyLimitRemaining,
    this.bankAccountNumber,
    this.bankName,
    this.accountHolderName,
    this.ifscCode,
    required this.onSuccess,
  });

  @override
  State<_WithdrawalSheet> createState() => _WithdrawalSheetState();
}

class _WithdrawalSheetState extends State<_WithdrawalSheet> {
  final _amountController = TextEditingController();
  final WalletService _walletService = WalletService();
  bool _isLoading = false;
  String? _error;

  bool get _hasBankDetails => widget.bankAccountNumber != null && widget.bankAccountNumber!.isNotEmpty;
  
  String get _maskedAccount {
    if (!_hasBankDetails) return '••••••••';
    final acc = widget.bankAccountNumber!;
    if (acc.length <= 4) return acc;
    return '••••••••${acc.substring(acc.length - 4)}';
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final maxAmount = math.min(widget.available, widget.weeklyLimitRemaining);
    final currencyFormat = NumberFormat('#,##,###', 'en_IN');

    return Container(
      padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.viewInsetsOf(context).bottom + 20),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF151A24) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Handle
            Center(
              child: Container(
                width: 40, height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(color: Colors.grey[400], borderRadius: BorderRadius.circular(2)),
              ),
            ),
            
            // Header
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(colors: [Colors.teal, Colors.teal.shade300]),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.account_balance_wallet_rounded, color: Colors.white, size: 24),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Withdraw Funds', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                      Text('Transfer to your bank account', style: TextStyle(fontSize: 12, color: Colors.grey)),
                    ],
                  ),
                ),
                IconButton(onPressed: () => Navigator.pop(context), icon: Icon(Icons.close, color: Colors.grey)),
              ],
            ),
            
            const SizedBox(height: 20),
            
            // Bank Account Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: _hasBankDetails 
                      ? [const Color(0xFF1E3A5F), const Color(0xFF2E5077)]
                      : [Colors.grey.shade700, Colors.grey.shade600],
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(widget.bankName ?? 'Bank Account', style: TextStyle(color: Colors.white70, fontSize: 12)),
                      Icon(Icons.account_balance, color: Colors.white54, size: 20),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(_maskedAccount, style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600, letterSpacing: 2)),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(widget.accountHolderName ?? 'Account Holder', style: TextStyle(color: Colors.white70, fontSize: 12)),
                      if (widget.ifscCode != null)
                        Text(widget.ifscCode!, style: TextStyle(color: Colors.white54, fontSize: 11)),
                    ],
                  ),
                ],
              ),
            ),
            
            if (!_hasBankDetails) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.orange.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 20),
                    const SizedBox(width: 8),
                    Expanded(child: Text('Add bank details in Settings to withdraw', style: TextStyle(color: Colors.orange, fontSize: 12))),
                  ],
                ),
              ),
            ],
            
            const SizedBox(height: 20),
            
            // Balance Row
            Row(
              children: [
                Expanded(
                  child: _buildInfoTile('Available', '₹${currencyFormat.format(widget.available)}', Colors.green, isDark),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildInfoTile('Weekly Limit', '₹${currencyFormat.format(widget.weeklyLimitRemaining)}', Colors.blue, isDark),
                ),
              ],
            ),
            
            const SizedBox(height: 20),
            
            // Amount Input
            Text('Enter Amount', style: TextStyle(fontWeight: FontWeight.w600, color: isDark ? Colors.white : Colors.black87)),
            const SizedBox(height: 8),
            TextField(
              controller: _amountController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87),
              decoration: InputDecoration(
                prefixText: '₹ ',
                prefixStyle: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: isDark ? Colors.white70 : Colors.black54),
                hintText: '500',
                hintStyle: TextStyle(color: Colors.grey[400]),
                filled: true,
                fillColor: isDark ? Colors.black26 : Colors.grey[100],
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
            ),
            
            const SizedBox(height: 12),
            
            // Quick Amount Chips
            Wrap(
              spacing: 8,
              children: [500, 1000, 1500, 2000].map((amt) {
                final enabled = amt <= maxAmount;
                return ActionChip(
                  label: Text('₹$amt'),
                  onPressed: enabled ? () => _amountController.text = amt.toString() : null,
                  backgroundColor: enabled ? (isDark ? Colors.teal.withValues(alpha: 0.2) : Colors.teal.withValues(alpha: 0.1)) : Colors.grey[300],
                  labelStyle: TextStyle(color: enabled ? Colors.teal : Colors.grey),
                );
              }).toList(),
            ),
            
            const SizedBox(height: 16),
            
            // Timeline Info
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[50],
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(Icons.schedule, color: Colors.blue, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text('Processed within 24-48 hours', style: TextStyle(fontSize: 13, color: isDark ? Colors.white70 : Colors.grey[700])),
                  ),
                ],
              ),
            ),
            
            if (_error != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: Colors.red.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
                child: Row(
                  children: [
                    Icon(Icons.error_outline, color: Colors.red, size: 18),
                    const SizedBox(width: 8),
                    Expanded(child: Text(_error!, style: TextStyle(color: Colors.red, fontSize: 13))),
                  ],
                ),
              ),
            ],
            
            const SizedBox(height: 20),
            
            // Submit Button
            ElevatedButton(
              onPressed: !_hasBankDetails || maxAmount < 500 || _isLoading ? null : _submit,
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                backgroundColor: Colors.teal,
                disabledBackgroundColor: Colors.grey[400],
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _isLoading 
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.send_rounded, color: Colors.white),
                        const SizedBox(width: 8),
                        Text('Request Withdrawal', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                      ],
                    ),
            ),
            
            const SizedBox(height: 8),
            Center(child: Text('Min ₹500 • Max ₹2000/week', style: TextStyle(color: Colors.grey, fontSize: 11))),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoTile(String label, String value, Color color, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 11, color: isDark ? Colors.white60 : Colors.grey[600])),
          const SizedBox(height: 4),
          Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }

  Future<void> _submit() async {
    final amount = double.tryParse(_amountController.text);
    if (amount == null || amount < 500) {
      setState(() => _error = 'Minimum withdrawal is ₹500');
      return;
    }
    if (amount > widget.weeklyLimitRemaining) {
      setState(() => _error = 'Exceeds weekly limit');
      return;
    }
    if (amount > widget.available) {
      setState(() => _error = 'Insufficient balance');
      return;
    }
    
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      await _walletService.requestWithdrawal(sellerId: widget.sellerId, amount: amount);
      widget.onSuccess();
    } catch (e) {
      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
        _isLoading = false;
      });
    }
  }
}


class PayoutHistorySheet extends StatelessWidget {
  const PayoutHistorySheet({super.key});

  @override
  Widget build(BuildContext context) {
    final seller = Provider.of<SellerProvider>(context, listen: false).currentSeller;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? AppColors.textLight : AppColors.textPrimary;
    final bgColors = isDark 
        ? [AppColors.backgroundDark, AppColors.surfaceDark]
        : [AppColors.background, AppColors.surface];

    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: bgColors,
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Drag Handle
          Center(
            child: Container(
              width: 40, height: 4,
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              decoration: BoxDecoration(
                color: textColor.withValues(alpha: 0.2), 
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          
          // Premium Header
          Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(colors: [AppColors.secondary, AppColors.secondaryLight]),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.history_rounded, color: Colors.white, size: 24),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Payout History', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: textColor)),
                      Text('View all your withdrawal requests', style: TextStyle(fontSize: 12, color: textColor.withValues(alpha: 0.6))),
                    ],
                  ),
                ),
                Container(
                  decoration: BoxDecoration(
                    color: textColor.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: IconButton(
                    onPressed: () => Navigator.pop(context), 
                    icon: Icon(Icons.close, color: textColor.withValues(alpha: 0.6)),
                  ),
                ),
              ],
            ),
          ),
          
          // Payout List
          Expanded(
            child: StreamBuilder<List<PayoutRequestModel>>(
              stream: WalletService().getPayoutRequests(sellerId: seller!.sellerId),
              builder: (context, snapshot) {
                if (!snapshot.hasData) {
                  return Center(child: CircularProgressIndicator(color: AppColors.primary));
                }
                if (snapshot.data!.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.receipt_long_rounded, size: 64, color: textColor.withValues(alpha: 0.2)),
                        const SizedBox(height: 16),
                        Text('No payout requests yet', style: TextStyle(color: textColor.withValues(alpha: 0.5), fontSize: 16)),
                        const SizedBox(height: 8),
                        Text('Request a withdrawal to see it here', style: TextStyle(color: textColor.withValues(alpha: 0.4), fontSize: 12)),
                      ],
                    ),
                  );
                }

                return ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: snapshot.data!.length,
                  itemBuilder: (context, index) {
                    final req = snapshot.data![index];
                    return _buildPayoutCard(req, isDark, textColor);
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPayoutCard(PayoutRequestModel req, bool isDark, Color textColor) {
    final statusColor = _getStatusColor(req.status);
    final cardColors = isDark 
        ? [AppColors.surfaceDark, AppColors.surfaceDarkVariant]
        : [AppColors.surface, AppColors.surfaceVariant];
    
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: cardColors,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: isDark ? null : Border.all(color: AppColors.border.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          // Status Icon
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(_getStatusIcon(req.status), color: statusColor, size: 22),
          ),
          const SizedBox(width: 14),
          
          // Details
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '₹${req.amount.toStringAsFixed(0)}',
                      style: TextStyle(
                        color: textColor,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        _getStatusLabel(req.status),
                        style: TextStyle(
                          color: statusColor,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Icon(Icons.calendar_today_rounded, size: 12, color: textColor.withValues(alpha: 0.5)),
                    const SizedBox(width: 6),
                    Text(
                      DateFormat('MMM dd, yyyy • hh:mm a').format(req.createdAt),
                      style: TextStyle(color: textColor.withValues(alpha: 0.5), fontSize: 12),
                    ),
                  ],
                ),
                if (req.processedAt != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(Icons.check_circle_outline_rounded, size: 12, color: AppColors.success.withValues(alpha: 0.7)),
                      const SizedBox(width: 6),
                      Text(
                        'Processed: ${DateFormat('MMM dd').format(req.processedAt!)}',
                        style: TextStyle(color: AppColors.success.withValues(alpha: 0.7), fontSize: 11),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Color _getStatusColor(PayoutStatus status) {
    switch (status) {
      case PayoutStatus.completed: return AppColors.success;
      case PayoutStatus.processing: return Colors.blue;
      case PayoutStatus.pending: return AppColors.warning;
      case PayoutStatus.failed: return AppColors.error;
      default: return Colors.grey;
    }
  }

  String _getStatusLabel(PayoutStatus status) {
    switch (status) {
      case PayoutStatus.completed: return 'Completed';
      case PayoutStatus.processing: return 'Processing';
      case PayoutStatus.pending: return 'Pending';
      case PayoutStatus.failed: return 'Failed';
      default: return 'Unknown';
    }
  }

  IconData _getStatusIcon(PayoutStatus status) {
    switch (status) {
      case PayoutStatus.completed: return Icons.check_circle_rounded;
      case PayoutStatus.processing: return Icons.sync_rounded;
      case PayoutStatus.pending: return Icons.schedule_rounded;
      case PayoutStatus.failed: return Icons.error_rounded;
      default: return Icons.help_rounded;
    }
  }
}

class _GridPatternPainter extends CustomPainter {
  final bool isDark;
  final double opacity;

  _GridPatternPainter({this.isDark = false, this.opacity = 0.05});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = (isDark ? AppColors.textLight : AppColors.textPrimary).withValues(alpha: opacity)
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
