// lib/screens/orders/widgets/settlement_preview.dart
// Inline Settlement Preview for Order Cards

import 'package:flutter/material.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

/// Compact settlement preview for order cards
class SettlementPreview extends StatelessWidget {
  final OrderModel order;
  final double? commissionPercent;
  final double? platformFee;
  final bool expanded;
  final VoidCallback? onToggle;

  const SettlementPreview({
    super.key,
    required this.order,
    this.commissionPercent,
    this.platformFee,
    this.expanded = false,
    this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    // Calculate settlement preview
    final orderTotal = order.total;
    final commission = orderTotal * ((commissionPercent ?? 10) / 100);
    final platform = platformFee ?? 20;
    final delivery = order.deliveryCharge ?? 0;
    final paymentMethod = order.paymentMethod.toLowerCase() ?? '';
    final isCOD = paymentMethod == 'cod' || paymentMethod == 'cash on delivery';
    final codFee = isCOD ? 40.0 : 0.0;
    final pgFee = !isCOD ? (orderTotal * 0.02) : 0.0;
    
    final totalDeductions = commission + platform + delivery + codFee + pgFee;
    final netPayout = orderTotal - totalDeductions;

    if (!expanded) {
      // Compact view - just show net earnings
      return GestureDetector(
        onTap: onToggle,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.green.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.green.withValues(alpha: 0.2)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.account_balance_wallet_rounded,
                size: 16,
                color: Colors.green[700],
              ),
              const SizedBox(width: 8),
              Text(
                'Earnings: ₹${netPayout.toStringAsFixed(0)}',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Colors.green[700],
                ),
              ),
              const SizedBox(width: 4),
              Icon(
                Icons.keyboard_arrow_down_rounded,
                size: 18,
                color: Colors.green[700],
              ),
            ],
          ),
        ),
      );
    }

    // Expanded view - full breakdown
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.withValues(alpha: 0.2),
        ),
      ),
      child: Column(
        children: [
          // Header with collapse button
          GestureDetector(
            onTap: onToggle,
            child: Row(
              children: [
                Icon(
                  Icons.account_balance_wallet_rounded,
                  size: 18,
                  color: Colors.green[600],
                ),
                const SizedBox(width: 8),
                Text(
                  'Settlement Preview',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
                const Spacer(),
                Icon(
                  Icons.keyboard_arrow_up_rounded,
                  size: 20,
                  color: Colors.grey[500],
                ),
              ],
            ),
          ),
          
          const SizedBox(height: 12),
          
          // Breakdown rows
          _buildRow('Order Value', orderTotal, isDark, isPositive: true),
          _buildRow('Commission (${commissionPercent?.toInt() ?? 10}%)', -commission, isDark),
          _buildRow('Platform Fee', -platform, isDark),
          if (delivery > 0) _buildRow('Delivery', -delivery, isDark),
          if (codFee > 0) _buildRow('COD Handling', -codFee, isDark),
          if (pgFee > 0) _buildRow('Payment Gateway', -pgFee, isDark),
          
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Divider(
              color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.withValues(alpha: 0.3),
            ),
          ),
          
          // Net Payout
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Your Earnings',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.green.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '₹${netPayout.toStringAsFixed(0)}',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.green[700],
                  ),
                ),
              ),
            ],
          ),
          
          // Settlement date info
          const SizedBox(height: 10),
          Row(
            children: [
              Icon(Icons.schedule_rounded, size: 14, color: Colors.grey[500]),
              const SizedBox(width: 6),
              Text(
                'Settlement after 7 days of delivery',
                style: TextStyle(
                  fontSize: 11,
                  color: Colors.grey[500],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRow(String label, double amount, bool isDark, {bool isPositive = false}) {
    final isDeduction = amount < 0;
    final displayAmount = amount.abs();
    
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              color: Colors.grey[600],
            ),
          ),
          Text(
            '${isDeduction ? '-' : ''}₹${displayAmount.toStringAsFixed(0)}',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: isPositive 
                  ? (isDark ? Colors.white : Colors.black87)
                  : Colors.red[400],
            ),
          ),
        ],
      ),
    );
  }
}

/// Mini earnings badge for compact view
class EarningsBadge extends StatelessWidget {
  final double netPayout;
  final bool compact;

  const EarningsBadge({
    super.key,
    required this.netPayout,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 6 : 8,
        vertical: compact ? 3 : 4,
      ),
      decoration: BoxDecoration(
        color: Colors.green.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.wallet_rounded,
            size: compact ? 12 : 14,
            color: Colors.green[600],
          ),
          SizedBox(width: compact ? 3 : 4),
          Text(
            '₹${netPayout.toStringAsFixed(0)}',
            style: TextStyle(
              fontSize: compact ? 11 : 12,
              fontWeight: FontWeight.w600,
              color: Colors.green[600],
            ),
          ),
        ],
      ),
    );
  }
}
