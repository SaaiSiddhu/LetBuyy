// lib/screens/payouts/admin_seller_wallet_view.dart
// 💰 ADMIN VIEW OF SELLER WALLET
// View seller's wallet details, transactions, and take admin actions

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';
import '../../app/themes/app_colors.dart';

class AdminSellerWalletView extends StatefulWidget {
  final String sellerId;
  final String? sellerName;
  final String? storeName;

  const AdminSellerWalletView({
    super.key,
    required this.sellerId,
    this.sellerName,
    this.storeName,
  });

  @override
  State<AdminSellerWalletView> createState() => _AdminSellerWalletViewState();
}

class _AdminSellerWalletViewState extends State<AdminSellerWalletView> with SingleTickerProviderStateMixin {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final _currencyFormat = NumberFormat('#,##,###', 'en_IN');
  
  late TabController _tabController;
  String _transactionFilter = 'all';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Seller Wallet',
              style: TextStyle(
                color: isDark ? AppColors.textLight : AppColors.textPrimary,
                fontWeight: FontWeight.w700,
                fontSize: 18,
              ),
            ),
            Text(
              widget.storeName ?? widget.sellerName ?? widget.sellerId,
              style: TextStyle(
                color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                fontSize: 12,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => setState(() {}),
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: StreamBuilder<DocumentSnapshot>(
        stream: _firestore.collection('sellers').doc(widget.sellerId).snapshots(),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }

          final sellerData = snapshot.data?.data() as Map<String, dynamic>? ?? {};
          
          return CustomScrollView(
            slivers: [
              // Wallet Stats
              SliverToBoxAdapter(
                child: _buildWalletStats(sellerData, isDark),
              ),
              
              // Bank Details
              SliverToBoxAdapter(
                child: _buildBankDetails(sellerData, isDark),
              ),
              
              // Quick Stats
              SliverToBoxAdapter(
                child: _buildQuickStats(sellerData, isDark),
              ),
              
              // Transaction History Header
              SliverToBoxAdapter(
                child: _buildTransactionHeader(isDark),
              ),
              
              // Transaction Tabs
              SliverPersistentHeader(
                pinned: true,
                delegate: _SliverTabBarDelegate(
                  tabBar: _buildTabBar(isDark),
                  isDark: isDark,
                ),
              ),
              
              // Transaction List
              _buildTransactionList(isDark),
              
              const SliverToBoxAdapter(
                child: SizedBox(height: 100),
              ),
            ],
          );
        },
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // WALLET STATS
  // ═══════════════════════════════════════════════════════════════════════
  
  Widget _buildWalletStats(Map<String, dynamic> data, bool isDark) {
    final walletBalance = (data['walletBalance'] ?? 0).toDouble();
    final pendingAmount = (data['pendingAmount'] ?? 0).toDouble();
    final inTransitAmount = (data['inTransitAmount'] ?? 0).toDouble();
    final payoutEnabled = data['payoutEnabled'] ?? true;

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF667EEA), Color(0xFF764BA2)],
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF667EEA).withValues(alpha: 0.3),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Available Balance',
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 13,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: payoutEnabled 
                      ? Colors.green.withValues(alpha: 0.2) 
                      : Colors.red.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: payoutEnabled ? Colors.green : Colors.red,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      payoutEnabled ? 'Payout Enabled' : 'Payout Disabled',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '₹${_currencyFormat.format(walletBalance)}',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 36,
              fontWeight: FontWeight.w800,
              letterSpacing: -1,
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: _buildMiniStat('Pending', pendingAmount, Icons.schedule_rounded),
              ),
              Expanded(
                child: _buildMiniStat('In Transit', inTransitAmount, Icons.local_shipping_rounded),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMiniStat(String label, double amount, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: Colors.white60, size: 16),
        const SizedBox(width: 6),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(
                color: Colors.white60,
                fontSize: 11,
              ),
            ),
            Text(
              '₹${_currencyFormat.format(amount)}',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BANK DETAILS
  // ═══════════════════════════════════════════════════════════════════════
  
  Widget _buildBankDetails(Map<String, dynamic> data, bool isDark) {
    final bankName = data['bankName'] ?? 'Not Added';
    final accountNumber = data['bankAccountNumber'];
    final ifscCode = data['bankIfscCode'] ?? 'N/A';
    final holderName = data['bankAccountHolderName'] ?? 'N/A';

    final hasBank = accountNumber != null && accountNumber.isNotEmpty;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.account_balance_rounded,
                color: hasBank ? AppColors.success : AppColors.warning,
                size: 20,
              ),
              const SizedBox(width: 10),
              Text(
                'Bank Details',
                style: TextStyle(
                  color: isDark ? AppColors.textLight : AppColors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: (hasBank ? AppColors.success : AppColors.warning).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  hasBank ? 'Verified' : 'Not Added',
                  style: TextStyle(
                    color: hasBank ? AppColors.success : AppColors.warning,
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          if (hasBank) ...[
            const SizedBox(height: 12),
            _buildBankRow('Bank', bankName, isDark),
            _buildBankRow('Account', 'XXXX${accountNumber.substring(accountNumber.length - 4)}', isDark),
            _buildBankRow('IFSC', ifscCode, isDark),
            _buildBankRow('Holder', holderName, isDark),
          ] else ...[
            const SizedBox(height: 8),
            Text(
              'Bank details not added',
              style: TextStyle(
                color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                fontSize: 13,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildBankRow(String label, String value, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
              fontSize: 12,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              color: isDark ? AppColors.textLight : AppColors.textPrimary,
              fontWeight: FontWeight.w500,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // QUICK STATS
  // ═══════════════════════════════════════════════════════════════════════
  
  Widget _buildQuickStats(Map<String, dynamic> data, bool isDark) {
    final lifetimeEarnings = (data['lifetimeEarnings'] ?? 0).toDouble();
    final lifetimeFees = (data['lifetimeFees'] ?? 0).toDouble();
    final totalWithdrawn = (data['totalWithdrawn'] ?? 0).toDouble();
    final weeklyWithdrawn = (data['weeklyWithdrawn'] ?? 0).toDouble();

    return Container(
      margin: const EdgeInsets.all(16),
      child: Row(
        children: [
          Expanded(
            child: _buildStatCard(
              'Lifetime Earnings',
              lifetimeEarnings,
              Icons.trending_up_rounded,
              AppColors.success,
              isDark,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _buildStatCard(
              'Fees Paid',
              lifetimeFees,
              Icons.receipt_long_rounded,
              AppColors.warning,
              isDark,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard(String label, double amount, IconData icon, Color color, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 8),
          Text(
            '₹${_currencyFormat.format(amount)}',
            style: TextStyle(
              color: isDark ? AppColors.textLight : AppColors.textPrimary,
              fontWeight: FontWeight.w700,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TRANSACTION HISTORY
  // ═══════════════════════════════════════════════════════════════════════
  
  Widget _buildTransactionHeader(bool isDark) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            'Transaction History',
            style: TextStyle(
              color: isDark ? AppColors.textLight : AppColors.textPrimary,
              fontWeight: FontWeight.w700,
              fontSize: 16,
            ),
          ),
          IconButton(
            icon: const Icon(Icons.download_rounded, size: 20),
            onPressed: () {
              // Export transactions
            },
            tooltip: 'Export',
          ),
        ],
      ),
    );
  }

  TabBar _buildTabBar(bool isDark) {
    return TabBar(
      controller: _tabController,
      onTap: (index) {
        setState(() {
          switch (index) {
            case 0:
              _transactionFilter = 'all';
              break;
            case 1:
              _transactionFilter = 'order_credit';
              break;
            case 2:
              _transactionFilter = 'withdrawal';
              break;
            case 3:
              _transactionFilter = 'auto_payout';
              break;
          }
        });
      },
      indicatorColor: AppColors.primary,
      labelColor: AppColors.primary,
      unselectedLabelColor: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
      labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
      tabs: const [
        Tab(text: 'All'),
        Tab(text: 'Credits'),
        Tab(text: 'Withdrawals'),
        Tab(text: 'Payouts'),
      ],
    );
  }

  Widget _buildTransactionList(bool isDark) {
    Query<Map<String, dynamic>> query = _firestore
        .collection('wallet_transactions')
        .where('sellerId', isEqualTo: widget.sellerId)
        .orderBy('createdAt', descending: true)
        .limit(50);

    if (_transactionFilter != 'all') {
      query = query.where('type', isEqualTo: _transactionFilter);
    }

    return SliverFillRemaining(
      child: StreamBuilder<QuerySnapshot>(
        stream: query.snapshots(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.receipt_long_outlined,
                    size: 48,
                    color: isDark ? AppColors.textLightHint : AppColors.textHint,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'No transactions found',
                    style: TextStyle(
                      color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: snapshot.data!.docs.length,
            itemBuilder: (context, index) {
              final doc = snapshot.data!.docs[index];
              final data = doc.data() as Map<String, dynamic>;
              return _buildTransactionCard(data, isDark);
            },
          );
        },
      ),
    );
  }

  Widget _buildTransactionCard(Map<String, dynamic> data, bool isDark) {
    final type = data['type'] ?? '';
    final status = data['status'] ?? 'pending';
    final netAmount = (data['netAmount'] ?? 0).toDouble();
    final totalFees = (data['totalFees'] ?? 0).toDouble();
    final description = data['description'] ?? '';
    final createdAt = (data['createdAt'] as Timestamp?)?.toDate();
    
    final isCredit = type == 'order_credit';
    final color = isCredit ? AppColors.success : AppColors.error;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.border,
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              isCredit ? Icons.arrow_downward_rounded : Icons.arrow_upward_rounded,
              color: color,
              size: 16,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  description,
                  style: TextStyle(
                    color: isDark ? AppColors.textLight : AppColors.textPrimary,
                    fontWeight: FontWeight.w500,
                    fontSize: 13,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Row(
                  children: [
                    Text(
                      createdAt != null 
                          ? DateFormat('dd MMM, hh:mm a').format(createdAt)
                          : 'Unknown',
                      style: TextStyle(
                        color: isDark ? AppColors.textLightHint : AppColors.textHint,
                        fontSize: 11,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: _getStatusColor(status).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        status,
                        style: TextStyle(
                          color: _getStatusColor(status),
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${isCredit ? '+' : '-'}₹${_currencyFormat.format(netAmount)}',
                style: TextStyle(
                  color: color,
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
              ),
              if (totalFees > 0)
                Text(
                  'Fee: ₹${totalFees.toStringAsFixed(0)}',
                  style: TextStyle(
                    color: isDark ? AppColors.textLightHint : AppColors.textHint,
                    fontSize: 10,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'completed':
        return AppColors.success;
      case 'pending':
        return AppColors.warning;
      case 'processing':
        return AppColors.info;
      case 'failed':
        return AppColors.error;
      default:
        return AppColors.textHint;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SLIVER TAB BAR DELEGATE
// ═══════════════════════════════════════════════════════════════════════

class _SliverTabBarDelegate extends SliverPersistentHeaderDelegate {
  final TabBar tabBar;
  final bool isDark;

  _SliverTabBarDelegate({required this.tabBar, required this.isDark});

  @override
  double get minExtent => tabBar.preferredSize.height;

  @override
  double get maxExtent => tabBar.preferredSize.height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      color: isDark ? AppColors.surfaceDark : AppColors.surface,
      child: tabBar,
    );
  }

  @override
  bool shouldRebuild(_SliverTabBarDelegate oldDelegate) => false;
}
