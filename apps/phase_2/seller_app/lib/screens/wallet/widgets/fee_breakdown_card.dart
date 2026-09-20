// lib/screens/wallet/widgets/fee_breakdown_card.dart
// 💰 FEE BREAKDOWN - Platform fees, commission, deductions
// ✨ Transparent fintech design

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class FeeBreakdownCard extends StatelessWidget {
  final double totalSales;
  final double platformFee;
  final double paymentGatewayFee;
  final double shippingDeduction;
  final double tdsDeduction;
  final double netEarnings;
  final VoidCallback? onViewDetails;

  const FeeBreakdownCard({
    super.key,
    required this.totalSales,
    required this.platformFee,
    required this.paymentGatewayFee,
    required this.shippingDeduction,
    required this.tdsDeduction,
    required this.netEarnings,
    this.onViewDetails,
  });

  static final _currencyFormat = NumberFormat('#,##,##0.00', 'en_IN');

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B).withValues(alpha: 0.8) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.withValues(alpha: 0.1)),
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
                  Icon(Icons.receipt_long_rounded, color: AppColors.primary, size: 20),
                  const SizedBox(width: 10),
                  Text(
                    'Fee Breakdown',
                    style: TextStyle(
                      color: isDark ? Colors.white : const Color(0xFF111827),
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
              if (onViewDetails != null)
                GestureDetector(
                  onTap: onViewDetails,
                  child: Text(
                    'Details',
                    style: TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.w700),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          
          // Total Sales
          _buildRow('Total Sales', totalSales, isDark, isPositive: true, isBold: true),
          const SizedBox(height: 10),
          
          // Deductions
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isDark ? Colors.black.withValues(alpha: 0.2) : Colors.grey[50],
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              children: [
                _buildRow('Platform Fee', -platformFee, isDark),
                const SizedBox(height: 8),
                _buildRow('Payment Gateway', -paymentGatewayFee, isDark),
                const SizedBox(height: 8),
                _buildRow('Shipping Charges', -shippingDeduction, isDark),
                if (tdsDeduction > 0) ...[
                  const SizedBox(height: 8),
                  _buildRow('TDS Deduction', -tdsDeduction, isDark),
                ],
              ],
            ),
          ),
          const SizedBox(height: 12),
          
          // Net Earnings
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF10B981).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.3)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.account_balance_wallet_rounded, color: Color(0xFF10B981), size: 18),
                    const SizedBox(width: 10),
                    Text(
                      'Net Earnings',
                      style: TextStyle(
                        color: isDark ? Colors.white : const Color(0xFF111827),
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                Text(
                  '₹${_currencyFormat.format(netEarnings)}',
                  style: const TextStyle(
                    color: Color(0xFF10B981),
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ).animate().fadeIn(delay: 200.ms);
  }

  Widget _buildRow(String label, double amount, bool isDark, {bool isPositive = false, bool isBold = false}) {
    final isNegative = amount < 0;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            color: isDark ? Colors.grey[400] : Colors.grey[600],
            fontSize: 13,
            fontWeight: isBold ? FontWeight.w600 : FontWeight.w500,
          ),
        ),
        Text(
          '${isNegative ? '-' : (isPositive ? '+' : '')}₹${_currencyFormat.format(amount.abs())}',
          style: TextStyle(
            color: isNegative 
                ? const Color(0xFFEF4444) 
                : (isPositive ? const Color(0xFF10B981) : (isDark ? Colors.white : const Color(0xFF111827))),
            fontSize: 13,
            fontWeight: isBold ? FontWeight.w700 : FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
