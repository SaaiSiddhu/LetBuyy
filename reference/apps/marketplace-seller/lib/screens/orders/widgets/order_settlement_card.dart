import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';

/// Widget to display order settlement/invoice breakdown for sellers
class OrderSettlementCard extends StatefulWidget {
  final String orderId;
  final bool isDark;

  const OrderSettlementCard({
    super.key,
    required this.orderId,
    this.isDark = false,
  });

  @override
  State<OrderSettlementCard> createState() => _OrderSettlementCardState();
}

class _OrderSettlementCardState extends State<OrderSettlementCard> {
  final InvoiceService _invoiceService = InvoiceService();
  OrderInvoiceModel? _invoice;
  bool _isLoading = true;
  bool _showDetails = false;

  @override
  void initState() {
    super.initState();
    _loadInvoice();
  }

  Future<void> _loadInvoice() async {
    final invoice = await _invoiceService.getInvoice(widget.orderId);
    if (mounted) {
      setState(() {
        _invoice = invoice;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return _buildLoadingCard();
    }

    if (_invoice == null) {
      return _buildNoInvoiceCard();
    }

    return _buildInvoiceCard();
  }

  Widget _buildLoadingCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: widget.isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: widget.isDark ? Colors.grey[800]! : Colors.grey[300]!,
        ),
      ),
      child: const Center(
        child: CircularProgressIndicator(strokeWidth: 2),
      ),
    );
  }

  Widget _buildNoInvoiceCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: widget.isDark ? const Color(0xFF1E1E1E) : Colors.grey.shade50,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: widget.isDark ? Colors.grey[800]! : Colors.grey[300]!,
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.receipt_long_rounded,
            color: Colors.grey.shade400,
            size: 24,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'Settlement will be generated after delivery',
              style: TextStyle(
                color: widget.isDark ? Colors.grey[400] : Colors.grey[600],
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInvoiceCard() {
    final invoice = _invoice!;
    final accentColor = AppColors.primary;

    return Container(
      decoration: BoxDecoration(
        color: widget.isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: widget.isDark ? Colors.grey[800]! : Colors.grey[300]!,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: accentColor.withValues(alpha: 0.1),
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(15),
              ),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: accentColor.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(
                    Icons.receipt_long_rounded,
                    color: AppColors.primary,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Order Settlement',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        _getStatusText(invoice),
                        style: TextStyle(
                          fontSize: 12,
                          color: _getStatusColor(invoice),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                // Details toggle
                IconButton(
                  onPressed: () => setState(() => _showDetails = !_showDetails),
                  icon: Icon(
                    _showDetails
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    color: accentColor,
                  ),
                  tooltip: 'View Details',
                ),
              ],
            ),
          ),

          // Main content
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                // Summary Row
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Order Value',
                          style: TextStyle(
                            fontSize: 12,
                            color: widget.isDark
                                ? Colors.grey[400]
                                : Colors.grey[600],
                          ),
                        ),
                        Text(
                          '₹${invoice.orderTotal.toStringAsFixed(2)}',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    Icon(
                      Icons.arrow_right_alt_rounded,
                      color: Colors.grey.shade400,
                      size: 28,
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          'Your Earnings',
                          style: TextStyle(
                            fontSize: 12,
                            color: widget.isDark
                                ? Colors.grey[400]
                                : Colors.grey[600],
                          ),
                        ),
                        Text(
                          '₹${invoice.netPayout.toStringAsFixed(2)}',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: invoice.netPayout >= 0
                                ? const Color(0xFF10B981)
                                : Colors.red,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),

                const SizedBox(height: 12),

                // Total Deductions Bar
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.red.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Total Deductions',
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.red.shade700,
                        ),
                      ),
                      Text(
                        '-₹${invoice.totalDeductions.toStringAsFixed(2)}',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: Colors.red.shade700,
                        ),
                      ),
                    ],
                  ),
                ),

                // RTO Warning if applicable
                if (invoice.hasRTOCharges) ...[
                  const SizedBox(height: 12),
                  _buildRTOWarning(invoice),
                ],

                // Detailed Breakdown
                if (_showDetails) ...[
                  const SizedBox(height: 16),
                  _buildDetailedBreakdown(invoice),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRTOWarning(OrderInvoiceModel invoice) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.orange.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: Colors.orange.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.warning_amber_rounded,
            color: Colors.orange.shade700,
            size: 20,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'RTO Charge Applied',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: Colors.orange.shade700,
                  ),
                ),
                Text(
                  invoice.rtoReason ?? 'Order was returned/refused',
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.orange.shade600,
                  ),
                ),
              ],
            ),
          ),
          Text(
            '-₹${(invoice.rtoFee + invoice.qualityPenalty).toStringAsFixed(0)}',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: Colors.orange.shade700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailedBreakdown(OrderInvoiceModel invoice) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: widget.isDark
            ? Colors.grey[900]!.withValues(alpha: 0.5)
            : Colors.grey.shade50,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Fee Breakdown',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.bold,
              color: widget.isDark ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 12),

          // Platform Fee
          _buildDeductionRow(
            'Platform Fee',
            invoice.platformFee,
            Icons.storefront_rounded,
            const Color(0xFF6366F1),
          ),

          // Commission
          _buildDeductionRow(
            'Commission',
            invoice.totalCommission,
            Icons.percent_rounded,
            const Color(0xFFF59E0B),
            onTap: invoice.itemCommissions.isNotEmpty
                ? () => _showCommissionDetails(invoice)
                : null,
          ),

          // Delivery Fee
          _buildDeductionRow(
            'Delivery Fee',
            invoice.deliveryFee,
            Icons.local_shipping_rounded,
            const Color(0xFF10B981),
          ),

          // COD Fee
          if (invoice.codFee > 0)
            _buildDeductionRow(
              'COD Handling',
              invoice.codFee,
              Icons.money_rounded,
              const Color(0xFF8B5CF6),
            ),

          // PG Fee
          if (invoice.paymentGatewayFee > 0)
            _buildDeductionRow(
              'Payment Gateway (${2}%)',
              invoice.paymentGatewayFee,
              Icons.credit_card_rounded,
              const Color(0xFF06B6D4),
            ),

          // RTO Fee
          if (invoice.rtoFee > 0)
            _buildDeductionRow(
              'RTO Fee',
              invoice.rtoFee,
              Icons.assignment_return_rounded,
              const Color(0xFFEF4444),
            ),

          // Quality Penalty
          if (invoice.qualityPenalty > 0)
            _buildDeductionRow(
              'Quality Penalty',
              invoice.qualityPenalty,
              Icons.warning_rounded,
              const Color(0xFFDC2626),
            ),
        ],
      ),
    );
  }

  Widget _buildDeductionRow(
    String label,
    double amount,
    IconData icon,
    Color color, {
    VoidCallback? onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Icon(icon, color: color, size: 14),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  color: widget.isDark ? Colors.grey[300] : Colors.grey[700],
                ),
              ),
            ),
            if (onTap != null)
              Icon(
                Icons.info_outline_rounded,
                size: 14,
                color: color,
              ),
            const SizedBox(width: 8),
            Text(
              '-₹${amount.toStringAsFixed(2)}',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: widget.isDark ? Colors.grey[300] : Colors.grey[700],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showCommissionDetails(OrderInvoiceModel invoice) {
    showModalBottomSheet(
      context: context,
      backgroundColor: widget.isDark ? const Color(0xFF1E1E1E) : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF59E0B).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(
                    Icons.percent_rounded,
                    color: Color(0xFFF59E0B),
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                const Text(
                  'Commission Breakdown',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            ...invoice.itemCommissions.map((item) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.productName,
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: widget.isDark
                                    ? Colors.white
                                    : Colors.black87,
                              ),
                            ),
                            Text(
                              '${item.finalPercent.toStringAsFixed(1)}% of ₹${item.subtotal.toStringAsFixed(0)}',
                              style: TextStyle(
                                fontSize: 12,
                                color: widget.isDark
                                    ? Colors.grey[400]
                                    : Colors.grey[600],
                              ),
                            ),
                          ],
                        ),
                      ),
                      Text(
                        '₹${item.commissionAmount.toStringAsFixed(2)}',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Color(0xFFF59E0B),
                        ),
                      ),
                    ],
                  ),
                )),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Total Commission',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  Text(
                    '₹${invoice.totalCommission.toStringAsFixed(2)}',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      color: Color(0xFFF59E0B),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _getStatusText(OrderInvoiceModel invoice) {
    switch (invoice.status) {
      case InvoiceStatus.pending:
        if (invoice.releaseDate != null) {
          final daysLeft =
              invoice.releaseDate!.difference(DateTime.now()).inDays;
          if (daysLeft > 0) {
            return '⏳ On hold - releases in $daysLeft days';
          } else {
            return '✅ Ready for payout';
          }
        }
        return '⏳ Processing';
      case InvoiceStatus.processing:
        return '🔄 Payout processing';
      case InvoiceStatus.paid:
        return '✅ Paid';
      case InvoiceStatus.onHold:
        return '⚠️ On hold by admin';
    }
  }

  Color _getStatusColor(OrderInvoiceModel invoice) {
    switch (invoice.status) {
      case InvoiceStatus.pending:
        final daysLeft = invoice.releaseDate != null
            ? invoice.releaseDate!.difference(DateTime.now()).inDays
            : 1;
        return daysLeft > 0 ? Colors.orange : const Color(0xFF10B981);
      case InvoiceStatus.processing:
        return Colors.blue;
      case InvoiceStatus.paid:
        return const Color(0xFF10B981);
      case InvoiceStatus.onHold:
        return Colors.red;
    }
  }
}
