// lib/screens/dashboard/widgets/earnings_card.dart
// 💰 ADVANCED EARNINGS CARD
// ✨ Correct Logic with Wallet Integration

import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';

class EarningsCard extends StatefulWidget {
  // Revenue data (gross - before fee deductions)
  final double todayRevenue;
  final double weekRevenue;
  final double monthRevenue;
  
  // Wallet data
  final double walletBalance; // Available to withdraw
  final double pendingAmount; // From unsettled orders
  final double lifetimeEarnings; // Total net earnings
  
  // Callbacks
  final VoidCallback onViewDetails;
  final VoidCallback? onWithdraw;

  const EarningsCard({
    super.key,
    required this.todayRevenue,
    required this.weekRevenue,
    required this.monthRevenue,
    this.walletBalance = 0,
    this.pendingAmount = 0,
    this.lifetimeEarnings = 0,
    required this.onViewDetails,
    this.onWithdraw,
  });

  @override
  State<EarningsCard> createState() => _EarningsCardState();
}

class _EarningsCardState extends State<EarningsCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _animation;
  int _selectedView = 0; // 0: Payout, 1: Earnings

  static final _currencyFormat = NumberFormat('#,##,##0', 'en_IN');

  // Fee rates as per wallet_service.dart
  static const double _gatewayRate = 0.03;  // 3%
  static const double _platformRate = 0.01; // 1%
  static const double _gstRate = 0.18;      // 18%

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 1200),
      vsync: this,
    );
    _animation = CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeOutCubic,
    );
    _animationController.forward();
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  // Calculate net earnings after all fees
  double _calculateNetAmount(double grossAmount) {
    final gatewayFee = grossAmount * _gatewayRate;
    final platformFee = grossAmount * _platformRate;
    final gstOnFees = (gatewayFee + platformFee) * _gstRate;
    final totalFees = gatewayFee + platformFee + gstOnFees;
    return grossAmount - totalFees;
  }

  // Net earnings (what you actually receive)
  double get _todayEarnings => _calculateNetAmount(widget.todayRevenue);
  double get _weekEarnings => _calculateNetAmount(widget.weekRevenue);
  double get _monthEarnings => _calculateNetAmount(widget.monthRevenue);

  // Get next payout date (Mon 6AM)
  DateTime get _nextPayoutDate {
    final now = DateTime.now();
    int daysUntilMonday = (DateTime.monday - now.weekday) % 7;
    
    if (daysUntilMonday == 0) {
      if (now.hour < 6) {
        return DateTime(now.year, now.month, now.day, 6);
      }
      daysUntilMonday = 7;
    }
    
    final nextMonday = now.add(Duration(days: daysUntilMonday));
    return DateTime(nextMonday.year, nextMonday.month, nextMonday.day, 6);
  }

  // Get payout processing window end (Wednesday)
  DateTime get _payoutWindowEnd {
    final monday = _nextPayoutDate;
    return monday.add(const Duration(days: 2)); // Wednesday
  }

  String get _payoutWindowLabel {
    final mondayFormat = DateFormat('d MMM').format(_nextPayoutDate);
    final wedFormat = DateFormat('d MMM').format(_payoutWindowEnd);
    return '$mondayFormat - $wedFormat';
  }

  String get _timeUntilPayout {
    final duration = _nextPayoutDate.difference(DateTime.now());
    if (duration.inDays > 0) {
      return '${duration.inDays}d ${duration.inHours % 24}h';
    } else if (duration.inHours > 0) {
      return '${duration.inHours}h';
    } else {
      return '${duration.inMinutes}m';
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 15, sigmaY: 15),
        child: Container(
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF059669), Color(0xFF047857)],
            ),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.15),
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF059669).withValues(alpha: 0.35),
                blurRadius: 24,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              _buildHeader(),

              // View Toggle
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: _buildViewToggle(),
              ),
              const SizedBox(height: 16),

              // Content
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 300),
                  child: _selectedView == 0
                      ? _buildPayoutView()
                      : _buildEarningsView(),
                ),
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    ).animate().fadeIn(duration: 400.ms).slideY(begin: 0.03, end: 0);
  }

  Widget _buildHeader() {
    return GestureDetector(
      onTap: widget.onViewDetails,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                Icons.account_balance_wallet_rounded,
                color: Colors.white,
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Earnings & Payout',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 17,
                      fontWeight: FontWeight.bold,
                      letterSpacing: -0.3,
                    ),
                  ),
                  Text(
                    'Tap to view wallet',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.6),
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.arrow_forward_rounded,
                color: Colors.white,
                size: 16,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildViewToggle() {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          _buildToggleButton('Next Payout', 0, Icons.schedule_rounded),
          _buildToggleButton('Earnings', 1, Icons.trending_up_rounded),
        ],
      ),
    );
  }

  Widget _buildToggleButton(String label, int index, IconData icon) {
    final isSelected = _selectedView == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedView = index),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected
                ? Colors.white.withValues(alpha: 0.2)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 14,
                color: Colors.white.withValues(alpha: isSelected ? 1.0 : 0.6),
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: isSelected ? 1.0 : 0.6),
                  fontSize: 12,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPayoutView() {
    return Column(
      key: const ValueKey('payout'),
      children: [
        // Main Payout Amount (Wallet Balance = Withdrawable)
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              '₹',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.8),
                fontSize: 24,
                fontWeight: FontWeight.w300,
              ),
            ),
            const SizedBox(width: 4),
            AnimatedBuilder(
              animation: _animation,
              builder: (context, child) {
                final displayValue = widget.walletBalance * _animation.value;
                return Text(
                  _compactFormat(displayValue),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 34,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -1,
                    height: 1,
                  ),
                );
              },
            ),
          ],
        ),
        const SizedBox(height: 8),

        // Payout Window Badge
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.event_rounded,
                size: 14,
                color: Colors.white.withValues(alpha: 0.9),
              ),
              const SizedBox(width: 6),
              Text(
                'Processed: $_payoutWindowLabel',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.9),
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Info Cards
        _buildGlassInfoRow([
          _InfoItem(
            'Pending',
            widget.pendingAmount,
            Icons.hourglass_top_rounded,
            'From orders',
          ),
          _InfoItem(
            'In $_timeUntilPayout',
            widget.walletBalance,
            Icons.access_time_rounded,
            'Next cycle',
          ),
        ]),
        const SizedBox(height: 12),

        // Info text
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              Icon(
                Icons.info_outline_rounded,
                size: 14,
                color: Colors.white.withValues(alpha: 0.6),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Payouts are processed every Monday - Wednesday',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.6),
                    fontSize: 10,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildEarningsView() {
    return Column(
      key: const ValueKey('earnings'),
      children: [
        // Lifetime Total at top
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.account_balance_rounded,
                  color: Colors.white,
                  size: 18,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Lifetime Net Earnings',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.7),
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    Text(
                      '₹${_compactFormat(widget.lifetimeEarnings)}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // Period breakdown
        _buildEarningsRow('Today', _todayEarnings, widget.todayRevenue),
        const SizedBox(height: 8),
        _buildEarningsRow('This Week', _weekEarnings, widget.weekRevenue),
        const SizedBox(height: 8),
        _buildEarningsRow('This Month', _monthEarnings, widget.monthRevenue),
        const SizedBox(height: 10),

        // Fee explanation
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            children: [
              Icon(
                Icons.receipt_long_rounded,
                size: 12,
                color: Colors.white.withValues(alpha: 0.5),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Net = Gross - 4.72% (3% gateway + 1% platform + GST)',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.5),
                    fontSize: 9,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildGlassInfoRow(List<_InfoItem> items) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 5, sigmaY: 5),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
          ),
          child: Row(
            children: items.asMap().entries.map((entry) {
              final index = entry.key;
              final item = entry.value;
              return Expanded(
                child: Row(
                  children: [
                    if (index > 0)
                      Container(
                        width: 1,
                        height: 36,
                        color: Colors.white.withValues(alpha: 0.15),
                      ),
                    Expanded(
                      child: Column(
                        children: [
                          Icon(
                            item.icon,
                            color: Colors.white.withValues(alpha: 0.6),
                            size: 14,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '₹${_compactFormat(item.value)}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          Text(
                            item.label,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.6),
                              fontSize: 9,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ),
      ),
    );
  }

  Widget _buildEarningsRow(String period, double netAmount, double grossAmount) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Expanded(
            flex: 2,
            child: Text(
              period,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.8),
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          // Gross (smaller)
          Text(
            '₹${_compactFormat(grossAmount)}',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.4),
              fontSize: 10,
              fontWeight: FontWeight.w500,
              decoration: TextDecoration.lineThrough,
            ),
          ),
          const SizedBox(width: 8),
          // Net (prominent)
          Text(
            '₹${_compactFormat(netAmount)}',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }

  String _compactFormat(double value) {
    if (value >= 10000000) return '${(value / 10000000).toStringAsFixed(1)}Cr';
    if (value >= 100000) return '${(value / 100000).toStringAsFixed(1)}L';
    if (value >= 1000) return '${(value / 1000).toStringAsFixed(1)}k';
    return _currencyFormat.format(value);
  }
}

class _InfoItem {
  final String label;
  final double value;
  final IconData icon;
  final String subtitle;

  _InfoItem(this.label, this.value, this.icon, this.subtitle);
}
