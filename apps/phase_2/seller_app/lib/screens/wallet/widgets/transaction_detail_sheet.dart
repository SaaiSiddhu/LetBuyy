// lib/screens/wallet/widgets/transaction_detail_sheet.dart
// 📜 Transaction Detail Bottom Sheet

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../models/wallet_transaction_model.dart';

class TransactionDetailSheet extends StatelessWidget {
  final WalletTransactionModel transaction;
  final bool isDark;

  const TransactionDetailSheet({
    super.key,
    required this.transaction,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    // Use the amount that has a value
    final rawAmount = transaction.netAmount != 0 ? transaction.netAmount : transaction.grossAmount;
    // Determine credit/debit from amount sign
    final isCredit = rawAmount > 0 || (rawAmount == 0 && transaction.isCredit);
    final color = isCredit ? Colors.green : Colors.red;
    final displayAmount = rawAmount.abs();
    final currencyFormat = NumberFormat('#,##,###', 'en_IN');

    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey[400],
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    _getIcon(),
                    color: color,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _getTitle(),
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: isDark ? Colors.white : Colors.black87,
                        ),
                      ),
                      Text(
                        DateFormat('dd MMM yyyy, hh:mm a').format(transaction.createdAt),
                        style: TextStyle(color: Colors.grey, fontSize: 13),
                      ),
                    ],
                  ),
                ),
                _buildStatusBadge(),
              ],
            ),
          ),

          const Divider(height: 1),

          // Content based on type
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                // Amount Display
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: isCredit
                          ? [Colors.green.withValues(alpha: 0.1), Colors.green.withValues(alpha: 0.05)]
                          : [Colors.red.withValues(alpha: 0.1), Colors.red.withValues(alpha: 0.05)],
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    children: [
                      Text(
                        isCredit ? 'Amount Credited' : 'Amount Debited',
                        style: TextStyle(color: Colors.grey, fontSize: 13),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '${isCredit ? '+' : '-'} ₹${currencyFormat.format(displayAmount)}',
                        style: TextStyle(
                          fontSize: 32,
                          fontWeight: FontWeight.bold,
                          color: color,
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 20),

                // Fee Breakdown (for order credits)
                if (transaction.type == TransactionType.orderCredit) ...[
                  _buildBreakdownSection(currencyFormat),
                ],

                // Order/Reference Info
                if (transaction.orderId != null || transaction.orderNumber != null) ...[
                  _buildInfoRow('Order ID', transaction.orderNumber ?? transaction.orderId ?? '-', isDark),
                ],

                if (transaction.productName != null) ...[
                  _buildInfoRow('Product', transaction.productName!, isDark),
                ],

                if (transaction.bankReference != null) ...[
                  _buildInfoRow('UTR / Reference', transaction.bankReference!, isDark),
                ],

                if (transaction.failureReason != null) ...[
                  Container(
                    margin: const EdgeInsets.only(top: 12),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.error_outline, color: Colors.red, size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            transaction.failureReason!,
                            style: TextStyle(color: Colors.red, fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                _buildInfoRow('Transaction ID', transaction.transactionId, isDark),

                const SizedBox(height: 20),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBreakdownSection(NumberFormat currencyFormat) {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Fee Breakdown',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 12),
          _buildFeeRow('Gross Amount', transaction.grossAmount, currencyFormat, false),
          if (transaction.gatewayFee > 0)
            _buildFeeRow('Gateway Fee (3%)', -transaction.gatewayFee, currencyFormat, true),
          if (transaction.platformFee > 0)
            _buildFeeRow('Platform Fee (1%)', -transaction.platformFee, currencyFormat, true),
          if (transaction.gstOnFees > 0)
            _buildFeeRow('GST on Fees (18%)', -transaction.gstOnFees, currencyFormat, true),
          const Divider(),
          _buildFeeRow('Net Amount', transaction.netAmount, currencyFormat, false, isBold: true),
        ],
      ),
    );
  }

  Widget _buildFeeRow(String label, double amount, NumberFormat format, bool isDeduction, {bool isBold = false}) {
    final color = isDeduction ? Colors.red : (isBold ? Colors.green : (isDark ? Colors.white : Colors.black87));
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: isDark ? Colors.white70 : Colors.grey[700])),
          Text(
            '${isDeduction ? '-' : ''}₹${format.format(amount.abs())}',
            style: TextStyle(fontWeight: isBold ? FontWeight.bold : FontWeight.w500, color: color),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: isDark ? Colors.white70 : Colors.grey[600])),
          Text(
            value,
            style: TextStyle(fontWeight: FontWeight.w600, color: isDark ? Colors.white : Colors.black87),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge() {
    Color color;
    String label;

    switch (transaction.status) {
      case TransactionStatus.completed:
        color = Colors.green;
        label = 'Completed';
        break;
      case TransactionStatus.pending:
        color = Colors.orange;
        label = 'Pending';
        break;
      case TransactionStatus.processing:
        color = Colors.blue;
        label = 'Processing';
        break;
      case TransactionStatus.failed:
        color = Colors.red;
        label = 'Failed';
        break;
      case TransactionStatus.cancelled:
        color = Colors.grey;
        label = 'Cancelled';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 12)),
    );
  }

  IconData _getIcon() {
    switch (transaction.type) {
      case TransactionType.orderCredit:
        return Icons.shopping_bag_rounded;
      case TransactionType.withdrawal:
        return Icons.account_balance_rounded;
      case TransactionType.autoPayout:
        return Icons.schedule_rounded;
      case TransactionType.refund:
        return Icons.refresh_rounded;
      case TransactionType.adjustment:
        return Icons.tune_rounded;
      case TransactionType.adTransfer:
        return Icons.campaign_rounded;
    }
  }

  String _getTitle() {
    switch (transaction.type) {
      case TransactionType.orderCredit:
        return 'Order Payment';
      case TransactionType.withdrawal:
        return 'Withdrawal';
      case TransactionType.autoPayout:
        return 'Auto Payout';
      case TransactionType.refund:
        return 'Refund';
      case TransactionType.adjustment:
        return 'Adjustment';
      case TransactionType.adTransfer:
        return 'Ad Wallet Transfer';
    }
  }
}
