// lib/screens/dashboard/widgets/summary_cards.dart
// 📊 ADVANCED PREMIUM SUMMARY CARDS
// ✨ Professional Glassmorphic Design with Analytics

import 'dart:ui' as ui;
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class DashboardSummaryCards extends StatelessWidget {
  // Revenue & Sales
  final double todayRevenue;
  final double yesterdayRevenue;
  final int todayOrders;
  final int yesterdayOrders;
  final int todayUnits;
  final double growthPercent;
  
  // Inventory
  final int lowStockCount;
  final int outOfStockCount;
  final int totalActiveSkus;
  
  // Store Health
  final double orderDefectRate;
  final double lateShipmentRate;
  final double cancellationRate;
  
  // Wallet
  final double walletBalance;
  final double pendingAmount;
  final DateTime? nextPayoutDate;

  const DashboardSummaryCards({
    super.key,
    required this.todayRevenue,
    this.yesterdayRevenue = 0,
    required this.todayOrders,
    this.yesterdayOrders = 0,
    required this.todayUnits,
    required this.growthPercent,
    required this.lowStockCount,
    required this.outOfStockCount,
    required this.totalActiveSkus,
    required this.orderDefectRate,
    required this.lateShipmentRate,
    required this.cancellationRate,
    required this.walletBalance,
    required this.pendingAmount,
    this.nextPayoutDate,
  });

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    final isMobile = width < 600;

    if (isMobile) {
      return GridView.count(
        crossAxisCount: 2,
        shrinkWrap: true,
        padding: EdgeInsets.zero,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 1.0,
        children: _buildCards(context, isMobile),
      );
    }

    return Row(
      children: _buildCards(context, isMobile).map((card) => Expanded(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: card,
        ),
      )).toList(),
    );
  }

  List<Widget> _buildCards(BuildContext context, bool isMobile) {
    return [
      _RevenueCard(
        todayRevenue: todayRevenue,
        yesterdayRevenue: yesterdayRevenue,
        todayOrders: todayOrders,
        yesterdayOrders: yesterdayOrders,
        todayUnits: todayUnits,
        growthPercent: growthPercent,
        delay: 0,
      ),
      _InventoryCard(
        totalSkus: totalActiveSkus,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
        delay: 80,
      ),
      _StoreHealthCard(
        odr: orderDefectRate,
        lsr: lateShipmentRate,
        cr: cancellationRate,
        delay: 160,
      ),
      _WalletCard(
        balance: walletBalance,
        pending: pendingAmount,
        nextPayout: nextPayoutDate,
        delay: 240,
      ),
    ];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BASE CARD
// ═══════════════════════════════════════════════════════════════════════════

class _BaseCard extends StatelessWidget {
  final Color color;
  final Widget child;
  final int delay;

  const _BaseCard({
    required this.color,
    required this.child,
    this.delay = 0,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? AppColors.textLight : AppColors.textPrimary;

    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: isDark 
                  ? [AppColors.surfaceDark.withValues(alpha: 0.9), AppColors.surfaceDarkVariant.withValues(alpha: 0.7)]
                  : [AppColors.surface.withValues(alpha: 0.95), AppColors.surfaceVariant.withValues(alpha: 0.8)],
            ),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isDark ? color.withValues(alpha: 0.25) : AppColors.border.withValues(alpha: 0.2),
              width: 1,
            ),
          ),
          child: child,
        ),
      ),
    ).animate().fadeIn(delay: delay.ms, duration: 300.ms).scale(
      begin: const Offset(0.96, 0.96),
      end: const Offset(1, 1),
      duration: 300.ms,
      curve: Curves.easeOut,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REVENUE CARD
// ═══════════════════════════════════════════════════════════════════════════

class _RevenueCard extends StatelessWidget {
  final double todayRevenue;
  final double yesterdayRevenue;
  final int todayOrders;
  final int yesterdayOrders;
  final int todayUnits;
  final double growthPercent;
  final int delay;

  const _RevenueCard({
    required this.todayRevenue,
    required this.yesterdayRevenue,
    required this.todayOrders,
    required this.yesterdayOrders,
    required this.todayUnits,
    required this.growthPercent,
    required this.delay,
  });

  static final _currencyFormat = NumberFormat('#,##,##0', 'en_IN');

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isPositive = growthPercent >= 0;
    final textColor = isDark ? AppColors.textLight : AppColors.textPrimary;

    return _BaseCard(
      color: AppColors.primary,
      delay: delay,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  Icons.trending_up_rounded,
                  color: AppColors.primary,
                  size: 14,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                'Revenue',
                style: TextStyle(
                  color: textColor.withValues(alpha: 0.7),
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              _GrowthBadge(percent: growthPercent),
            ],
          ),
          const SizedBox(height: 8),

          // Main Value with animated counter effect
          _AnimatedValue(
            value: todayRevenue,
            prefix: '₹',
            style: TextStyle(
              color: textColor,
              fontSize: 20,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 2),

          // Comparison text
          if (yesterdayRevenue > 0)
            Text(
              'vs ₹${_compactFormat(yesterdayRevenue)} yesterday',
              style: TextStyle(
                color: textColor.withValues(alpha: 0.4),
                fontSize: 9,
                fontWeight: FontWeight.w500,
              ),
            ),
          const Spacer(),

          // Mini stats row
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            decoration: BoxDecoration(
              color: textColor.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _MiniStat(
                  label: 'Orders',
                  value: '$todayOrders',
                  icon: Icons.shopping_bag_outlined,
                  isDark: isDark,
                ),
                Container(
                  width: 1,
                  height: 16,
                  color: textColor.withValues(alpha: 0.1),
                ),
                _MiniStat(
                  label: 'Units',
                  value: '$todayUnits',
                  icon: Icons.inventory_2_outlined,
                  isDark: isDark,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _compactFormat(double value) {
    if (value >= 100000) return '${(value / 100000).toStringAsFixed(1)}L';
    if (value >= 1000) return '${(value / 1000).toStringAsFixed(1)}k';
    return _currencyFormat.format(value);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INVENTORY CARD
// ═══════════════════════════════════════════════════════════════════════════

class _InventoryCard extends StatelessWidget {
  final int totalSkus;
  final int lowStock;
  final int outOfStock;
  final int delay;

  const _InventoryCard({
    required this.totalSkus,
    required this.lowStock,
    required this.outOfStock,
    required this.delay,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? AppColors.textLight : AppColors.textPrimary;
    final hasIssues = lowStock > 0 || outOfStock > 0;
    final healthyStock = totalSkus - lowStock - outOfStock;
    final healthPercent = totalSkus > 0 ? (healthyStock / totalSkus) : 1.0;
    
    final cardColor = hasIssues
        ? (outOfStock > 0 ? AppColors.error : AppColors.warning)
        : AppColors.success;

    return _BaseCard(
      color: cardColor,
      delay: delay,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: cardColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  Icons.inventory_2_rounded,
                  color: cardColor,
                  size: 14,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                'Inventory',
                style: TextStyle(
                  color: textColor.withValues(alpha: 0.7),
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              if (hasIssues)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                  decoration: BoxDecoration(
                    color: cardColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.warning_rounded, size: 8, color: cardColor),
                      const SizedBox(width: 3),
                      Text(
                        'Alert',
                        style: TextStyle(
                          color: cardColor,
                          fontSize: 8,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),

          // Total SKUs
          Text(
            '$totalSkus',
            style: TextStyle(
              color: textColor,
              fontSize: 20,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
            ),
          ),
          Text(
            'Active SKUs',
            style: TextStyle(
              color: textColor.withValues(alpha: 0.4),
              fontSize: 9,
              fontWeight: FontWeight.w500,
            ),
          ),
          const Spacer(),

          // Health Progress Bar
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Stock Health',
                    style: TextStyle(
                      color: textColor.withValues(alpha: 0.5),
                      fontSize: 8,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    '${(healthPercent * 100).toInt()}%',
                    style: TextStyle(
                      color: cardColor,
                      fontSize: 9,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: LinearProgressIndicator(
                  value: healthPercent,
                  backgroundColor: textColor.withValues(alpha: 0.1),
                  valueColor: AlwaysStoppedAnimation(cardColor),
                  minHeight: 4,
                ),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  _StockIndicator(
                    color: AppColors.error,
                    label: '$outOfStock OOS',
                    isDark: isDark,
                  ),
                  const SizedBox(width: 8),
                  _StockIndicator(
                    color: AppColors.warning,
                    label: '$lowStock Low',
                    isDark: isDark,
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE HEALTH CARD
// ═══════════════════════════════════════════════════════════════════════════

class _StoreHealthCard extends StatelessWidget {
  final double odr; // Order Defect Rate
  final double lsr; // Late Shipment Rate
  final double cr;  // Cancellation Rate
  final int delay;

  const _StoreHealthCard({
    required this.odr,
    required this.lsr,
    required this.cr,
    required this.delay,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? AppColors.textLight : AppColors.textPrimary;
    
    // Calculate overall health score (inverse of rates)
    final avgRate = (odr + lsr + cr) / 3;
    final healthScore = math.max(0.0, 100 - avgRate * 10);
    final isHealthy = healthScore >= 80;
    
    final cardColor = isHealthy 
        ? AppColors.secondary 
        : (healthScore >= 50 ? AppColors.warning : AppColors.error);

    String healthLabel;
    if (healthScore >= 90) {
      healthLabel = 'Excellent';
    } else if (healthScore >= 80) {
      healthLabel = 'Good';
    } else if (healthScore >= 50) {
      healthLabel = 'Fair';
    } else {
      healthLabel = 'At Risk';
    }

    return _BaseCard(
      color: cardColor,
      delay: delay,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: cardColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  isHealthy ? Icons.verified_rounded : Icons.warning_rounded,
                  color: cardColor,
                  size: 16,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'Store Health',
                style: TextStyle(
                  color: isDark ? Colors.white70 : Colors.black54,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: cardColor.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '${healthScore.toInt()}%',
                  style: TextStyle(
                    color: cardColor,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Health Label
          Text(
            healthLabel,
            style: TextStyle(
              color: isDark ? Colors.white : const Color(0xFF111827),
              fontSize: 24,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
            ),
          ),
          Text(
            'Performance Rating',
            style: TextStyle(
              color: isDark ? Colors.white38 : Colors.black38,
              fontSize: 10,
              fontWeight: FontWeight.w500,
            ),
          ),
          const Spacer(),

          // Metrics Row
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                _MetricItem(
                  label: 'ODR',
                  value: '${odr.toStringAsFixed(1)}%',
                  isGood: odr < 1,
                  isDark: isDark,
                ),
                Container(
                  width: 1,
                  height: 24,
                  color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1),
                ),
                _MetricItem(
                  label: 'LSR',
                  value: '${lsr.toStringAsFixed(1)}%',
                  isGood: lsr < 4,
                  isDark: isDark,
                ),
                Container(
                  width: 1,
                  height: 24,
                  color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1),
                ),
                _MetricItem(
                  label: 'CR',
                  value: '${cr.toStringAsFixed(1)}%',
                  isGood: cr < 2.5,
                  isDark: isDark,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WALLET CARD
// ═══════════════════════════════════════════════════════════════════════════

class _WalletCard extends StatelessWidget {
  final double balance;
  final double pending;
  final DateTime? nextPayout;
  final int delay;

  const _WalletCard({
    required this.balance,
    required this.pending,
    this.nextPayout,
    required this.delay,
  });

  static final _currencyFormat = NumberFormat('#,##,##0', 'en_IN');

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final total = balance + pending;

    return _BaseCard(
      color: const Color(0xFF06B6D4),
      delay: delay,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFF06B6D4).withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.account_balance_wallet_rounded,
                  color: Color(0xFF06B6D4),
                  size: 16,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'Wallet',
                style: TextStyle(
                  color: isDark ? Colors.white70 : Colors.black54,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              if (nextPayout != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF06B6D4).withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _getPayoutCountdown(),
                    style: const TextStyle(
                      color: Color(0xFF06B6D4),
                      fontSize: 9,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),

          // Balance
          _AnimatedValue(
            value: balance,
            prefix: '₹',
            style: TextStyle(
              color: isDark ? Colors.white : const Color(0xFF111827),
              fontSize: 24,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
            ),
          ),
          Text(
            'Available Balance',
            style: TextStyle(
              color: isDark ? Colors.white38 : Colors.black38,
              fontSize: 10,
              fontWeight: FontWeight.w500,
            ),
          ),
          const Spacer(),

          // Pending & Total
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '₹${_compactFormat(pending)}',
                        style: TextStyle(
                          color: isDark ? Colors.white : Colors.black87,
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        'Pending',
                        style: TextStyle(
                          color: isDark ? Colors.white38 : Colors.black38,
                          fontSize: 9,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  width: 1,
                  height: 28,
                  color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '₹${_compactFormat(total)}',
                        style: TextStyle(
                          color: isDark ? Colors.white : Colors.black87,
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        'Total',
                        style: TextStyle(
                          color: isDark ? Colors.white38 : Colors.black38,
                          fontSize: 9,
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

  String _getPayoutCountdown() {
    if (nextPayout == null) return '';
    final duration = nextPayout!.difference(DateTime.now());
    if (duration.inDays > 0) return '${duration.inDays}d';
    if (duration.inHours > 0) return '${duration.inHours}h';
    return 'Soon';
  }

  String _compactFormat(double value) {
    if (value >= 100000) return '${(value / 100000).toStringAsFixed(1)}L';
    if (value >= 1000) return '${(value / 1000).toStringAsFixed(1)}k';
    return _currencyFormat.format(value);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER WIDGETS
// ═══════════════════════════════════════════════════════════════════════════

class _GrowthBadge extends StatelessWidget {
  final double percent;

  const _GrowthBadge({required this.percent});

  @override
  Widget build(BuildContext context) {
    final isPositive = percent >= 0;
    final color = isPositive ? const Color(0xFF10B981) : const Color(0xFFEF4444);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isPositive ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded,
            color: color,
            size: 10,
          ),
          const SizedBox(width: 3),
          Text(
            '${percent.abs().toStringAsFixed(0)}%',
            style: TextStyle(
              color: color,
              fontSize: 10,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final bool isDark;

  const _MiniStat({
    required this.label,
    required this.value,
    required this.icon,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            icon,
            size: 12,
            color: isDark ? Colors.white38 : Colors.black38,
          ),
          const SizedBox(width: 4),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: TextStyle(
                  color: isDark ? Colors.white : Colors.black87,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                label,
                style: TextStyle(
                  color: isDark ? Colors.white38 : Colors.black38,
                  fontSize: 8,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StockIndicator extends StatelessWidget {
  final Color color;
  final String label;
  final bool isDark;

  const _StockIndicator({
    required this.color,
    required this.label,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: TextStyle(
            color: isDark ? Colors.white54 : Colors.black45,
            fontSize: 9,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _MetricItem extends StatelessWidget {
  final String label;
  final String value;
  final bool isGood;
  final bool isDark;

  const _MetricItem({
    required this.label,
    required this.value,
    required this.isGood,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              color: isGood
                  ? const Color(0xFF10B981)
                  : const Color(0xFFEF4444),
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(
            label,
            style: TextStyle(
              color: isDark ? Colors.white38 : Colors.black38,
              fontSize: 9,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _AnimatedValue extends StatefulWidget {
  final double value;
  final String prefix;
  final TextStyle style;

  const _AnimatedValue({
    required this.value,
    this.prefix = '',
    required this.style,
  });

  @override
  State<_AnimatedValue> createState() => _AnimatedValueState();
}

class _AnimatedValueState extends State<_AnimatedValue>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  static final _currencyFormat = NumberFormat('#,##,##0', 'en_IN');

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1000),
      vsync: this,
    );
    _animation = Tween<double>(begin: 0, end: widget.value).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );
    _controller.forward();
  }

  @override
  void didUpdateWidget(_AnimatedValue oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value) {
      _animation = Tween<double>(
        begin: oldWidget.value,
        end: widget.value,
      ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic));
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Text(
          '${widget.prefix}${_compactFormat(_animation.value)}',
          style: widget.style,
        );
      },
    );
  }

  String _compactFormat(double value) {
    if (value >= 10000000) return '${(value / 10000000).toStringAsFixed(1)}Cr';
    if (value >= 100000) return '${(value / 100000).toStringAsFixed(1)}L';
    if (value >= 1000) return '${(value / 1000).toStringAsFixed(1)}k';
    return _currencyFormat.format(value);
  }
}
