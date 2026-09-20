// lib/screens/wallet/widgets/payout_schedule_card.dart
// 📅 PAYOUT SCHEDULE - Next payout info and schedule
// ✨ Professional fintech design

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';

class PayoutScheduleCard extends StatelessWidget {
  final double nextPayoutAmount;
  final DateTime? nextPayoutDate;
  final double pendingAmount;
  final double inTransitAmount;
  final String payoutCycle; // 'daily', 'weekly', 'monthly'

  const PayoutScheduleCard({
    super.key,
    required this.nextPayoutAmount,
    this.nextPayoutDate,
    required this.pendingAmount,
    required this.inTransitAmount,
    this.payoutCycle = 'weekly',
  });

  static final _currencyFormat = NumberFormat('#,##,##0', 'en_IN');
  static final _dateFormat = DateFormat('EEE, MMM d');

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isDark
              ? [const Color(0xFF1E3A5F), const Color(0xFF1E293B)]
              : [const Color(0xFF3B82F6), const Color(0xFF2563EB)],
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF3B82F6).withValues(alpha: 0.3),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.calendar_month_rounded, color: Colors.white, size: 18),
                  ),
                  const SizedBox(width: 12),
                  const Text(
                    'Next Payout',
                    style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  payoutCycle.toUpperCase(),
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          
          // Amount
          Text(
            '₹${_compactFormat(nextPayoutAmount)}',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 32,
              fontWeight: FontWeight.w800,
              letterSpacing: -1,
            ),
          ),
          if (nextPayoutDate != null)
            Text(
              'Expected on ${_dateFormat.format(nextPayoutDate!)}',
              style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 13),
            ),
          const SizedBox(height: 20),
          
          // Status Row
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                _buildStatusItem('Pending', pendingAmount, Icons.schedule_rounded),
                _buildDivider(),
                _buildStatusItem('In Transit', inTransitAmount, Icons.local_shipping_rounded),
              ],
            ),
          ),
        ],
      ),
    ).animate().fadeIn(delay: 100.ms);
  }

  Widget _buildStatusItem(String label, double amount, IconData icon) {
    return Expanded(
      child: Row(
        children: [
          Icon(icon, color: Colors.white.withValues(alpha: 0.7), size: 18),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 11)),
              Text(
                '₹${_compactFormat(amount)}',
                style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDivider() {
    return Container(width: 1, height: 30, color: Colors.white.withValues(alpha: 0.2));
  }

  String _compactFormat(double value) {
    if (value >= 10000000) return '${(value / 10000000).toStringAsFixed(1)}Cr';
    if (value >= 100000) return '${(value / 100000).toStringAsFixed(1)}L';
    if (value >= 1000) return '${(value / 1000).toStringAsFixed(1)}k';
    return _currencyFormat.format(value);
  }
}
