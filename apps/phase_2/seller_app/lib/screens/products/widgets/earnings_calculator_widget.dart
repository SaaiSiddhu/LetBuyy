// lib/screens/products/widgets/earnings_calculator_widget.dart
// Earnings Calculator Widget with GST Settlement Breakdown

import 'package:flutter/material.dart';

/// Earnings Calculator Widget
/// Shows commission breakdown with GST settled to seller
class EarningsCalculatorWidget extends StatelessWidget {
  final double sellingPrice; // Price including GST
  final double gstRate; // GST percentage (0, 5, 12, 18, 28)
  final double platformCommission; // Platform commission % (default 10)
  final double paymentGatewayFee; // Payment gateway % (default 2)
  final bool isDark;

  const EarningsCalculatorWidget({
    super.key,
    required this.sellingPrice,
    required this.gstRate,
    this.platformCommission = 10.0,
    this.paymentGatewayFee = 2.0,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    // Calculate breakdown
    final gstAmount = (sellingPrice * gstRate) / (100 + gstRate);
    final basePrice = sellingPrice - gstAmount;
    final commissionAmount = (basePrice * platformCommission) / 100;
    final gatewayAmount = (basePrice * paymentGatewayFee) / 100;
    final netEarning = basePrice - commissionAmount - gatewayAmount;
    final totalPayout = netEarning + gstAmount; // GST settled to seller

    final textColor = isDark ? Colors.white : Colors.black87;
    final subTextColor = isDark ? Colors.grey[400] : Colors.grey[600];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? Colors.blue.withValues(alpha: 0.1) : Colors.blue.shade50,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? Colors.blue.withValues(alpha: 0.3) : Colors.blue.shade200,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Icon(Icons.calculate_rounded, color: Colors.blue, size: 20),
              const SizedBox(width: 8),
              Text(
                'Earnings Breakdown',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 15,
                  color: textColor,
                ),
              ),
            ],
          ),
          
          const SizedBox(height: 16),
          
          // Selling Price
          _buildRow('Selling Price (incl. GST)', '₹${sellingPrice.toStringAsFixed(0)}', textColor, isBold: true),
          
          const Divider(height: 24),
          
          // GST Component
          _buildRow('GST Component (${gstRate.toInt()}%)', '₹${gstAmount.toStringAsFixed(0)}', subTextColor!),
          _buildRow('Base Price', '₹${basePrice.toStringAsFixed(0)}', subTextColor),
          
          const Divider(height: 24),
          
          // Deductions
          _buildRow(
            'Platform Commission (${platformCommission.toInt()}%)', 
            '- ₹${commissionAmount.toStringAsFixed(0)}', 
            Colors.red.shade400,
          ),
          _buildRow(
            'Payment Gateway (${paymentGatewayFee.toInt()}%)', 
            '- ₹${gatewayAmount.toStringAsFixed(0)}', 
            Colors.red.shade400,
          ),
          
          const Divider(height: 24),
          
          // Settlement
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.green.withValues(alpha: isDark ? 0.2 : 0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.green.withValues(alpha: 0.3)),
            ),
            child: Column(
              children: [
                _buildRow('Net Earning', '₹${netEarning.toStringAsFixed(0)}', Colors.green.shade600),
                _buildRow('+ GST Collected', '+ ₹${gstAmount.toStringAsFixed(0)}', Colors.green.shade600),
                const Divider(height: 16, color: Colors.green),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.account_balance_wallet, color: Colors.green, size: 18),
                        const SizedBox(width: 6),
                        Text(
                          'Total Payout',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Colors.green.shade700,
                          ),
                        ),
                      ],
                    ),
                    Text(
                      '₹${totalPayout.toStringAsFixed(0)}',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                        color: Colors.green.shade700,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          
          const SizedBox(height: 12),
          
          // Info note
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.amber.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Icon(Icons.info_rounded, color: Colors.amber.shade700, size: 16),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'GST fully settled to seller. Commission on base price only.',
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.amber.shade800,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRow(String label, String value, Color valueColor, {bool isBold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600], fontSize: 13)),
          Text(
            value,
            style: TextStyle(
              fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
              color: valueColor,
              fontSize: isBold ? 15 : 13,
            ),
          ),
        ],
      ),
    );
  }
}
