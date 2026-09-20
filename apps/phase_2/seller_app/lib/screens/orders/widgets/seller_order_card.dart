// lib/screens/seller/orders/widgets/seller_order_card.dart
// Enhanced Seller Order Card with Professional Design - V2.0
// All components consolidated + Expandable Settlement Preview

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'shipping_label_generator.dart';
import 'rto_section_widget.dart';

// ═══════════════════════════════════════════════════════════════════════════
// SELLER ORDER CARD - Professional Consolidated Design
// ═══════════════════════════════════════════════════════════════════════════

class SellerOrderCard extends StatefulWidget {
  final OrderModel order;
  final VoidCallback onTap;
  final bool isCompact;
  final bool showActions;
  final Function(String action)? onAction;

  const SellerOrderCard({
    super.key,
    required this.order,
    required this.onTap,
    this.isCompact = false,
    this.showActions = true,
    this.onAction,
  });

  @override
  State<SellerOrderCard> createState() => _SellerOrderCardState();
}

class _SellerOrderCardState extends State<SellerOrderCard> {
  bool _isSettlementExpanded = false;

  OrderModel get order => widget.order;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final currencyFormat = NumberFormat.currency(symbol: '₹', decimalDigits: 0);
    final dateFormat = DateFormat('MMM dd, yyyy • hh:mm a');

    final statusInfo = _getStatusInfo(order.orderStatus);
    final urgencyInfo = _getUrgencyInfo();
    final settlement = _calculateSettlement();

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: isDark ? Colors.black.withValues(alpha: 0.3) : AppColors.shadowLight.withValues(alpha: 0.4),
            blurRadius: 16,
            offset: const Offset(0, 6),
            spreadRadius: -4,
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
          child: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: isDark
                    ? [Colors.white.withValues(alpha: 0.08), Colors.white.withValues(alpha: 0.04)]
                    : [Colors.white.withValues(alpha: 0.95), Colors.white.withValues(alpha: 0.8)],
              ),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.white.withValues(alpha: 0.6),
              ),
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: widget.onTap,
                onLongPress: () {
                  HapticFeedback.mediumImpact();
                  _showQuickActionsMenu(context, isDark);
                },
                borderRadius: BorderRadius.circular(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // ═══════════════════════════════════════════════════════
                    // 1. HEADER: Status + Order# + Date + COD Badge
                    // ═══════════════════════════════════════════════════════
                    _buildHeader(isDark, statusInfo, dateFormat),

                    // ═══════════════════════════════════════════════════════
                    // 2. CONTENT: Customer, Items, Payment, Total
                    // ═══════════════════════════════════════════════════════
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      child: Column(
                        children: [
                          // Customer Info
                          _buildInfoRow(isDark, Icons.person_outline_rounded, 'Customer',
                              order.deliveryAddress.name ?? 'Unknown',
                              subtitle: order.deliveryAddress.phone),
                          const SizedBox(height: 10),

                          // Items Summary
                          _buildInfoRow(isDark, Icons.shopping_bag_outlined, 'Items',
                              '${order.items.length} item${order.items.length > 1 ? 's' : ''}',
                              trailing: _buildItemsPreview(isDark)),
                          const SizedBox(height: 10),

                          // Payment & Total Row (Expandable)
                          Row(
                            children: [
                              Expanded(child: _buildInfoTile(isDark, Icons.payment_rounded, 'Payment',
                                  _formatPaymentMethod(order.paymentMethod), _getPaymentStatusColor(order.paymentStatus))),
                              const SizedBox(width: 10),
                              Expanded(child: _buildExpandableTotalTile(isDark, currencyFormat, settlement)),
                            ],
                          ),

                          // ═══════════════════════════════════════════════════
                          // 3. SETTLEMENT BREAKDOWN (Expandable)
                          // ═══════════════════════════════════════════════════
                          AnimatedCrossFade(
                            firstChild: const SizedBox(height: 0),
                            secondChild: Padding(
                              padding: const EdgeInsets.only(top: 10),
                              child: _buildSettlementBreakdown(isDark, settlement),
                            ),
                            crossFadeState: _isSettlementExpanded ? CrossFadeState.showSecond : CrossFadeState.showFirst,
                            duration: const Duration(milliseconds: 200),
                          ),
                        ],
                      ),
                    ),

                    // ═══════════════════════════════════════════════════════
                    // 4. ACCEPT/REJECT + QUICK CONTACT (Pending Orders)
                    // ═══════════════════════════════════════════════════════
                    if (order.orderStatus == 'pending')
                      _buildAcceptRejectSection(isDark),

                    // ═══════════════════════════════════════════════════════
                    // 5. COD ALERT BANNER
                    // ═══════════════════════════════════════════════════════
                    if (order.paymentMethod.toUpperCase() == 'COD' && order.orderStatus == 'pending')
                      _buildCODAlertBanner(isDark),

                    // ═══════════════════════════════════════════════════════
                    // 6. RTO SECTION (If applicable)
                    // ═══════════════════════════════════════════════════════
                    if (_isRTOOrder())
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        child: RTOSectionWidget(
                          order: order,
                          isDark: isDark,
                          onApprove: () => _handleRTOAction(context, 'approve'),
                          onReject: () => _handleRTOAction(context, 'reject'),
                          onSchedulePickup: () => _handleRTOAction(context, 'schedule'),
                          onPerformQC: () => _handleRTOAction(context, 'qc'),
                          onProcessRefund: () => _handleRTOAction(context, 'refund'),
                          onViewDetails: widget.onTap,
                        ),
                      ),

                    // ═══════════════════════════════════════════════════════
                    // 7. FOOTER ACTIONS
                    // ═══════════════════════════════════════════════════════
                    if (widget.showActions && _canShowActions())
                      _buildFooterActions(isDark),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HEADER SECTION
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildHeader(bool isDark, _StatusInfo statusInfo, DateFormat dateFormat) {
    final isCod = order.paymentMethod.toUpperCase() == 'COD';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: statusInfo.color.withValues(alpha: 0.06),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              // Status Badge
              _buildStatusBadge(isDark, statusInfo),
              const SizedBox(width: 10),
              // Order ID & Date
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text('#${order.orderNumber}',
                            style: TextStyle(color: isDark ? Colors.white : AppColors.textPrimary,
                                fontWeight: FontWeight.w800, fontSize: 15)),
                        const SizedBox(width: 6),
                        GestureDetector(
                          onTap: () {
                            Clipboard.setData(ClipboardData(text: order.orderNumber));
                            HapticFeedback.lightImpact();
                            ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Order ID copied'), duration: Duration(seconds: 1)));
                          },
                          child: Icon(Icons.copy_rounded, size: 14,
                              color: isDark ? Colors.white38 : Colors.black38),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(dateFormat.format(order.createdAt),
                        style: TextStyle(color: isDark ? Colors.white54 : AppColors.textSecondary, fontSize: 11)),
                  ],
                ),
              ),
              // Urgency indicator
              if (_getUrgencyInfo().isUrgent)
                Container(
                  width: 10, height: 10,
                  decoration: BoxDecoration(color: AppColors.success, shape: BoxShape.circle),
                ),
            ],
          ),
          const SizedBox(height: 8),
          // ═══════════════════════════════════════════════════════════════
          // BADGES ROW: COD + Return + Exchange
          // ═══════════════════════════════════════════════════════════════
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              // COD Badge
              if (isCod)
                _buildHeaderBadge(
                  icon: Icons.money_rounded,
                  label: 'COD',
                  color: AppColors.warning,
                ),
              // Return Badge
              if (order.hasReturnRequest && order.returnType != 'exchange')
                _buildHeaderBadge(
                  icon: Icons.replay_rounded,
                  label: 'Return',
                  color: const Color(0xFFEF4444),
                ),
              // Exchange Badge
              if (order.hasExchangeRequest || order.returnType == 'exchange')
                _buildHeaderBadge(
                  icon: Icons.swap_horiz_rounded,
                  label: 'Exchange',
                  color: const Color(0xFFF59E0B),
                ),
              // Return Status Badge (if in progress)
              if (order.returnStatus != null && order.returnStatus!.isNotEmpty)
                _buildHeaderBadge(
                  icon: Icons.info_outline_rounded,
                  label: _formatReturnStatus(order.returnStatus!),
                  color: _getReturnStatusColor(order.returnStatus!),
                ),
            ],
          ),
        ],
      ),
    );
  }

  /// Build a compact header badge
  Widget _buildHeaderBadge({
    required IconData icon,
    required String label,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 10)),
        ],
      ),
    );
  }

  /// Format return status for display
  String _formatReturnStatus(String status) {
    switch (status.toLowerCase()) {
      case 'requested': return 'Pending';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'pickupscheduled': return 'Pickup Soon';
      case 'pickupcompleted': return 'Picked Up';
      case 'refundinitiated': return 'Refunding';
      case 'refundcompleted': return 'Refunded';
      case 'exchangeshipped': return 'Exchange Shipped';
      case 'exchangedelivered': return 'Exchanged';
      default: return status;
    }
  }

  /// Get return status color
  Color _getReturnStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'requested': return const Color(0xFFF59E0B);
      case 'approved': return const Color(0xFF10B981);
      case 'rejected': return const Color(0xFFEF4444);
      case 'refundcompleted':
      case 'exchangedelivered': return const Color(0xFF10B981);
      default: return const Color(0xFF6B7280);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANDABLE TOTAL TILE
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildExpandableTotalTile(bool isDark, NumberFormat currencyFormat, _SettlementData settlement) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        setState(() => _isSettlementExpanded = !_isSettlementExpanded);
      },
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.success.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.success.withValues(alpha: 0.2),
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.currency_rupee_rounded, size: 16, color: AppColors.success),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Total', style: TextStyle(color: isDark ? AppColors.textLightHint : AppColors.textSecondary,
                      fontSize: 11, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text(currencyFormat.format(order.total),
                      style: TextStyle(color: AppColors.success, fontWeight: FontWeight.bold, fontSize: 14)),
                ],
              ),
            ),
            // Expandable Arrow
            AnimatedRotation(
              turns: _isSettlementExpanded ? 0.5 : 0,
              duration: const Duration(milliseconds: 200),
              child: Icon(Icons.keyboard_arrow_down_rounded, color: AppColors.success, size: 22),
            ),
          ],
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SETTLEMENT BREAKDOWN
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildSettlementBreakdown(bool isDark, _SettlementData settlement) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.05) : AppColors.success.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.success.withValues(alpha: 0.2)),
      ),
      child: Column(
        children: [
          _buildSettlementRow('Order Value', '₹${settlement.orderValue.toInt()}', isDark, isPositive: true),
          _buildSettlementRow('Platform Fee (10%)', '-₹${settlement.platformFee.toInt()}', isDark),
          _buildSettlementRow('Payment Fee (3%)', '-₹${settlement.paymentFee.toInt()}', isDark),
          _buildSettlementRow('Shipping', '-₹${settlement.shipping.toInt()}', isDark),
          const Divider(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Your Earnings', style: TextStyle(color: AppColors.success, fontWeight: FontWeight.w700, fontSize: 13)),
              Row(
                children: [
                  Text('₹${settlement.earnings.toInt()}', style: TextStyle(color: AppColors.success, fontWeight: FontWeight.w800, fontSize: 15)),
                  const SizedBox(width: 4),
                  Icon(Icons.check_circle_rounded, color: AppColors.success, size: 16),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSettlementRow(String label, String value, bool isDark, {bool isPositive = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: isDark ? Colors.white60 : AppColors.textSecondary, fontSize: 11)),
          Text(value, style: TextStyle(
            color: isPositive ? (isDark ? Colors.white : AppColors.textPrimary) : Colors.red.shade400,
            fontSize: 11, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCEPT/REJECT + QUICK CONTACT SECTION
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildAcceptRejectSection(bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.03) : Colors.grey.withValues(alpha: 0.05),
        border: Border(top: BorderSide(color: isDark ? Colors.white10 : Colors.black.withValues(alpha: 0.05))),
      ),
      child: Row(
        children: [
          // Accept Button
          Expanded(
            child: _buildCompactButton(
              icon: Icons.check_circle_outline_rounded,
              label: 'Accept',
              color: AppColors.success,
              isDark: isDark,
              onTap: () => widget.onAction?.call('accept'),
            ),
          ),
          const SizedBox(width: 8),
          // Reject Button
          Expanded(
            child: _buildCompactButton(
              icon: Icons.cancel_outlined,
              label: 'Reject',
              color: AppColors.error,
              isDark: isDark,
              onTap: () => widget.onAction?.call('reject'),
            ),
          ),
          const SizedBox(width: 12),
          // Quick Contact Icons
          _buildQuickContactIcon(Icons.phone_outlined, AppColors.success, () => _launchCall()),
          const SizedBox(width: 8),
          _buildQuickContactIcon(Icons.message_outlined, AppColors.info, () => _launchSMS()),
          const SizedBox(width: 8),
          _buildQuickContactIcon(Icons.note_add_outlined, AppColors.warning, () => _showNotesDialog()),
        ],
      ),
    );
  }

  Widget _buildCompactButton({
    required IconData icon,
    required String label,
    required Color color,
    required bool isDark,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 6),
            Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 12)),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickContactIcon(IconData icon, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, size: 18, color: color),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COD ALERT BANNER
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildCODAlertBanner(bool isDark) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.warning.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.warning.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: AppColors.warning.withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.warning_amber_rounded, size: 16, color: AppColors.warning),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('COD orders have higher RTO risk',
                    style: TextStyle(color: AppColors.warning, fontWeight: FontWeight.w600, fontSize: 11)),
                Text('Consider verifying customer phone',
                    style: TextStyle(color: isDark ? Colors.white54 : AppColors.textSecondary, fontSize: 10)),
              ],
            ),
          ),
          GestureDetector(
            onTap: () {},
            child: Icon(Icons.close, size: 16, color: isDark ? Colors.white38 : Colors.black38),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FOOTER ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildFooterActions(bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: isDark ? AppColors.backgroundDark.withValues(alpha: 0.5) : AppColors.background.withValues(alpha: 0.5),
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(20)),
      ),
      child: Row(
        children: [
          // Shipping Label
          _buildIconActionButton(context, isDark, Icons.local_shipping_outlined, 'Print Label',
              AppColors.info, () => showShippingLabelDialog(context, order)),
          const SizedBox(width: 8),
          // Status Update
          if (_getNextStatus() != null)
            Expanded(
              child: _buildActionButton(isDark, _getNextStatusAction()!.icon, _getNextStatusAction()!.label,
                  _getNextStatusAction()!.color, () => _showStatusUpdateConfirmation(context, isDark)),
            ),
          if (_getNextStatus() != null) const SizedBox(width: 8),
          // View Details
          Expanded(
            child: _buildActionButton(isDark, Icons.arrow_forward_rounded, 'View Details',
                isDark ? AppColors.primaryLight : AppColors.primary, widget.onTap, isPrimary: true),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  _SettlementData _calculateSettlement() {
    final orderValue = order.total;
    final platformFee = orderValue * 0.10;
    final paymentFee = orderValue * 0.03;
    final shipping = 42.0; // Fixed shipping estimate
    final earnings = orderValue - platformFee - paymentFee - shipping;

    return _SettlementData(
      orderValue: orderValue,
      platformFee: platformFee,
      paymentFee: paymentFee,
      shipping: shipping,
      earnings: earnings,
    );
  }

  void _launchCall() async {
    final phone = order.deliveryAddress.phone;
    if (phone.isNotEmpty) {
      final url = Uri.parse('tel:$phone');
      if (await canLaunchUrl(url)) await launchUrl(url);
    }
  }

  void _launchSMS() async {
    final phone = order.deliveryAddress.phone;
    if (phone.isNotEmpty) {
      final url = Uri.parse('sms:$phone');
      if (await canLaunchUrl(url)) await launchUrl(url);
    }
  }

  void _showNotesDialog() {
    // TODO: Implement notes dialog
    ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Notes feature coming soon')));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXISTING METHODS (Preserved from original)
  // ═══════════════════════════════════════════════════════════════════════════

  _StatusInfo _getStatusInfo(String status) {
    switch (status.toLowerCase()) {
      // ═══════════════════════════════════════════════════════════════
      // STANDARD ORDER FLOW
      // ═══════════════════════════════════════════════════════════════
      case 'pending': return _StatusInfo(label: 'Pending', color: AppColors.warning, icon: Icons.hourglass_empty_rounded);
      case 'processing': return _StatusInfo(label: 'Processing', color: AppColors.info, icon: Icons.sync_rounded);
      case 'shipped': return _StatusInfo(label: 'Shipped', color: AppColors.primary, icon: Icons.local_shipping_rounded);
      case 'delivered': return _StatusInfo(label: 'Delivered', color: AppColors.success, icon: Icons.check_circle_rounded);
      case 'cancelled': return _StatusInfo(label: 'Cancelled', color: AppColors.error, icon: Icons.cancel_rounded);
      
      // ═══════════════════════════════════════════════════════════════
      // RETURN FLOW (Refund)
      // ═══════════════════════════════════════════════════════════════
      case 'return_requested': return _StatusInfo(label: 'Return Requested', color: const Color(0xFFEF4444), icon: Icons.replay_rounded);
      case 'return_approved': return _StatusInfo(label: 'Return Approved', color: const Color(0xFFF59E0B), icon: Icons.check_circle_outline_rounded);
      case 'pickup_pending': return _StatusInfo(label: 'Pickup Pending', color: const Color(0xFF8B5CF6), icon: Icons.schedule_rounded);
      case 'pickup_completed': return _StatusInfo(label: 'Picked Up', color: const Color(0xFF6366F1), icon: Icons.inventory_2_rounded);
      case 'refund_initiated': return _StatusInfo(label: 'Refund Processing', color: const Color(0xFF10B981), icon: Icons.currency_exchange_rounded);
      case 'returned': return _StatusInfo(label: 'Returned', color: const Color(0xFFDC2626), icon: Icons.assignment_return_rounded);
      case 'refunded': return _StatusInfo(label: 'Refunded', color: Colors.purple, icon: Icons.currency_exchange_rounded);
      case 'rto_initiated':
      case 'rto': return _StatusInfo(label: 'RTO', color: Colors.orange, icon: Icons.undo_rounded);
      
      // ═══════════════════════════════════════════════════════════════
      // EXCHANGE FLOW
      // ═══════════════════════════════════════════════════════════════
      case 'exchange_requested': return _StatusInfo(label: 'Exchange Requested', color: const Color(0xFFF59E0B), icon: Icons.swap_horiz_rounded);
      case 'exchange_approved': return _StatusInfo(label: 'Exchange Approved', color: const Color(0xFF3B82F6), icon: Icons.check_circle_outline_rounded);
      case 'exchange_shipped': return _StatusInfo(label: 'Exchange Shipped', color: const Color(0xFF0EA5E9), icon: Icons.local_shipping_rounded);
      case 'exchanged': return _StatusInfo(label: 'Exchanged', color: const Color(0xFF10B981), icon: Icons.swap_horizontal_circle_rounded);
      
      default: return _StatusInfo(label: status.toUpperCase(), color: AppColors.textSecondary, icon: Icons.help_outline_rounded);
    }
  }

  _UrgencyInfo _getUrgencyInfo() {
    final hoursSinceOrder = DateTime.now().difference(order.createdAt).inHours;
    if (order.orderStatus == 'pending' && hoursSinceOrder > 2) {
      return _UrgencyInfo(isUrgent: true, message: 'Action needed', color: AppColors.warning);
    }
    return _UrgencyInfo(isUrgent: false, message: '', color: Colors.transparent);
  }

  bool _isRTOOrder() {
    // Check new flags first (from order-return integration)
    if (order.hasReturnRequest || order.hasExchangeRequest) {
      return true;
    }
    // Fallback to status check for backward compatibility
    final status = order.orderStatus.toLowerCase();
    final returnStatuses = {
      'rto', 'return', 'returned', 'refunded',
      'return_requested', 'return_approved',
      'pickup_pending', 'pickup_completed', 'refund_initiated',
      'exchange_requested', 'exchange_approved', 
      'exchange_shipped', 'exchanged',
    };
    return returnStatuses.any((s) => status.contains(s));
  }

  void _handleRTOAction(BuildContext context, String action) {
    widget.onAction?.call('rto_$action');
  }

  String? _getNextStatus() {
    switch (order.orderStatus.toLowerCase()) {
      case 'pending': return 'processing';
      case 'processing': return 'shipped';
      case 'shipped': return 'delivered';
      default: return null;
    }
  }

  _ActionInfo? _getNextStatusAction() {
    switch (order.orderStatus.toLowerCase()) {
      case 'pending': return _ActionInfo(icon: Icons.play_circle_outline_rounded, label: 'Start Processing', color: AppColors.info);
      case 'processing': return _ActionInfo(icon: Icons.local_shipping_outlined, label: 'Mark Shipped', color: AppColors.primary);
      case 'shipped': return _ActionInfo(icon: Icons.check_circle_outline_rounded, label: 'Mark Delivered', color: AppColors.success);
      default: return null;
    }
  }

  bool _canShowActions() => !['cancelled', 'delivered', 'refunded'].contains(order.orderStatus.toLowerCase());

  Color _getPaymentStatusColor(String? paymentStatus) {
    switch (paymentStatus?.toLowerCase()) {
      case 'paid': return AppColors.success;
      case 'pending': return AppColors.warning;
      case 'failed': return AppColors.error;
      case 'refunded': return Colors.purple;
      default: return AppColors.textSecondary;
    }
  }

  String _formatPaymentMethod(String? method) {
    switch (method?.toUpperCase()) {
      case 'COD': return 'COD';
      case 'UPI': return 'UPI';
      case 'CARD': return 'Card';
      case 'NETBANKING': return 'NetBanking';
      case 'WALLET': return 'Wallet';
      default: return method ?? 'Unknown';
    }
  }

  Widget _buildStatusBadge(bool isDark, _StatusInfo statusInfo) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: statusInfo.color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: statusInfo.color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(statusInfo.icon, size: 14, color: statusInfo.color),
          const SizedBox(width: 5),
          Text(statusInfo.label, style: TextStyle(color: statusInfo.color, fontWeight: FontWeight.w700, fontSize: 11)),
        ],
      ),
    );
  }

  Widget _buildInfoRow(bool isDark, IconData icon, String label, String value, {String? subtitle, Widget? trailing}) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, size: 18, color: isDark ? Colors.white54 : AppColors.textSecondary),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: TextStyle(color: isDark ? Colors.white38 : AppColors.textHint, fontSize: 10, fontWeight: FontWeight.w500)),
              Text(value, style: TextStyle(color: isDark ? Colors.white : AppColors.textPrimary, fontWeight: FontWeight.w700, fontSize: 14)),
              if (subtitle != null) Text(subtitle, style: TextStyle(color: isDark ? Colors.white54 : AppColors.textSecondary, fontSize: 12)),
            ],
          ),
        ),
        if (trailing != null) trailing,
      ],
    );
  }

  Widget _buildInfoTile(bool isDark, IconData icon, String label, String value, Color accentColor) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDarkVariant.withValues(alpha: 0.5) : AppColors.surfaceVariant.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.black.withValues(alpha: 0.05)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.white.withValues(alpha: 0.5), shape: BoxShape.circle),
            child: Icon(icon, size: 16, color: isDark ? Colors.white54 : AppColors.textSecondary),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(color: isDark ? AppColors.textLightHint : AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(value, style: TextStyle(color: isDark ? Colors.white : AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildItemsPreview(bool isDark) {
    final displayItems = order.items.take(3).toList();

    return SizedBox(
      height: 32,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: (displayItems.length * 20) + 12,
            child: Stack(
              children: List.generate(displayItems.length, (index) {
                final item = displayItems[index];
                return Positioned(
                  left: index * 20.0,
                  child: Container(
                    width: 32, height: 32,
                    decoration: BoxDecoration(
                      color: isDark ? AppColors.surfaceDarkVariant : AppColors.surfaceVariant,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: isDark ? AppColors.surfaceDark : AppColors.surface, width: 2),
                      image: item.imageUrl.isNotEmpty
                          ? DecorationImage(image: NetworkImage(item.imageUrl), fit: BoxFit.cover)
                          : null,
                    ),
                    child: null,
                  ),
                );
              }),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton(bool isDark, IconData icon, String label, Color color, VoidCallback onPressed, {bool isPrimary = false}) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onPressed();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: isPrimary ? color : color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
          border: isPrimary ? null : Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 16, color: isPrimary ? Colors.white : color),
            const SizedBox(width: 6),
            Text(label, style: TextStyle(color: isPrimary ? Colors.white : color, fontWeight: FontWeight.w600, fontSize: 12)),
          ],
        ),
      ),
    );
  }

  Widget _buildIconActionButton(BuildContext context, bool isDark, IconData icon, String tooltip, Color color, VoidCallback onPressed) {
    return Tooltip(
      message: tooltip,
      child: GestureDetector(
        onTap: () {
          HapticFeedback.lightImpact();
          onPressed();
        },
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
          child: Icon(icon, size: 18, color: color),
        ),
      ),
    );
  }

  void _showQuickActionsMenu(BuildContext context, bool isDark) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isDark ? AppColors.surfaceDark : AppColors.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 20),
            Text('Quick Actions', style: TextStyle(color: isDark ? Colors.white : AppColors.textPrimary, fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            _buildMenuAction(isDark, Icons.local_shipping_outlined, 'Print Shipping Label', () {
              Navigator.pop(context);
              showShippingLabelDialog(context, order);
            }),
            _buildMenuAction(isDark, Icons.phone_outlined, 'Call Customer', () {
              Navigator.pop(context);
              _launchCall();
            }),
            _buildMenuAction(isDark, Icons.message_outlined, 'Send SMS', () {
              Navigator.pop(context);
              _launchSMS();
            }),
            _buildMenuAction(isDark, Icons.copy_rounded, 'Copy Order ID', () {
              Navigator.pop(context);
              Clipboard.setData(ClipboardData(text: order.orderNumber));
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Order ID copied')));
            }),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }

  Widget _buildMenuAction(bool isDark, IconData icon, String label, VoidCallback onTap, {Color? color}) {
    return ListTile(
      leading: Icon(icon, color: color ?? (isDark ? Colors.white54 : AppColors.textSecondary)),
      title: Text(label, style: TextStyle(color: color ?? (isDark ? Colors.white : AppColors.textPrimary), fontWeight: FontWeight.w500)),
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
    );
  }

  void _showStatusUpdateConfirmation(BuildContext context, bool isDark) {
    final nextStatus = _getNextStatus();
    if (nextStatus == null) return;

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Update Status', style: TextStyle(color: isDark ? Colors.white : AppColors.textPrimary)),
        content: Text('Are you sure you want to mark this order as ${nextStatus.toUpperCase()}?',
            style: TextStyle(color: isDark ? Colors.white70 : AppColors.textSecondary)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              widget.onAction?.call('status_$nextStatus');
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            child: const Text('Confirm', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void showShippingLabelDialog(BuildContext context, OrderModel order) {
    showDialog(
      context: context,
      builder: (context) => ShippingLabelPreviewDialog(order: order),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER CLASSES
// ═══════════════════════════════════════════════════════════════════════════

class _StatusInfo {
  final String label;
  final Color color;
  final IconData icon;

  _StatusInfo({required this.label, required this.color, required this.icon});
}

class _UrgencyInfo {
  final bool isUrgent;
  final String message;
  final Color color;

  _UrgencyInfo({required this.isUrgent, required this.message, required this.color});
}

class _ActionInfo {
  final IconData icon;
  final String label;
  final Color color;

  _ActionInfo({required this.icon, required this.label, required this.color});
}

class _SettlementData {
  final double orderValue;
  final double platformFee;
  final double paymentFee;
  final double shipping;
  final double earnings;

  _SettlementData({
    required this.orderValue,
    required this.platformFee,
    required this.paymentFee,
    required this.shipping,
    required this.earnings,
  });
}