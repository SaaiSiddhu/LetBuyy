// lib/screens/orders/widgets/order_actions_bar.dart
// ⚡ PROFESSIONAL ORDER ACTIONS BAR
// ✨ Context-aware actions based on order status

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'order_pack_flow.dart';
import 'order_ship_flow.dart';

class OrderActionsBar extends StatelessWidget {
  final OrderModel order;
  final VoidCallback? onRefresh;

  const OrderActionsBar({
    super.key,
    required this.order,
    this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final status = order.orderStatus.toLowerCase();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B).withValues(alpha: 0.8) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.withValues(alpha: 0.1)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Icon(Icons.bolt_rounded, color: AppColors.primary, size: 18),
              const SizedBox(width: 8),
              Text(
                'Quick Actions',
                style: TextStyle(
                  color: isDark ? Colors.white : const Color(0xFF111827),
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          
          // Actions based on status
          _buildActionsForStatus(context, status, isDark),
        ],
      ),
    ).animate().fadeIn(delay: 400.ms);
  }

  Widget _buildActionsForStatus(BuildContext context, String status, bool isDark) {
    switch (status) {
      case 'pending':
      case 'confirmed':
        return _buildPendingActions(context, isDark);
      case 'processing':
        return _buildProcessingActions(context, isDark);
      case 'shipped':
        return _buildShippedActions(context, isDark);
      case 'delivered':
        return _buildDeliveredActions(context, isDark);
      case 'cancelled':
        return _buildCancelledActions(context, isDark);
      default:
        return _buildDefaultActions(context, isDark);
    }
  }

  // Pending/Confirmed: Pack & Prepare
  Widget _buildPendingActions(BuildContext context, bool isDark) {
    return Row(
      children: [
        Expanded(
          child: _ActionButton(
            label: 'Pack Order',
            icon: Icons.inventory_2_rounded,
            color: const Color(0xFF3B82F6),
            onTap: () => _showPackFlow(context),
            isPrimary: true,
          ),
        ),
        const SizedBox(width: 12),
        _ActionButton(
          label: 'Print',
          icon: Icons.print_rounded,
          color: Colors.grey,
          onTap: () => _printInvoice(context),
        ),
        const SizedBox(width: 8),
        _ActionButton(
          label: 'Cancel',
          icon: Icons.close_rounded,
          color: const Color(0xFFEF4444),
          onTap: () => _showCancelDialog(context),
        ),
      ],
    );
  }

  // Processing: Ready to Ship
  Widget _buildProcessingActions(BuildContext context, bool isDark) {
    return Row(
      children: [
        Expanded(
          child: _ActionButton(
            label: 'Ship Order',
            icon: Icons.local_shipping_rounded,
            color: const Color(0xFF8B5CF6),
            onTap: () => _showShipFlow(context),
            isPrimary: true,
          ),
        ),
        const SizedBox(width: 12),
        _ActionButton(
          label: 'Print',
          icon: Icons.print_rounded,
          color: Colors.grey,
          onTap: () => _printInvoice(context),
        ),
      ],
    );
  }

  // Shipped: Track & Deliver
  Widget _buildShippedActions(BuildContext context, bool isDark) {
    return Row(
      children: [
        Expanded(
          child: _ActionButton(
            label: 'Mark Delivered',
            icon: Icons.check_circle_rounded,
            color: const Color(0xFF10B981),
            onTap: () => _markDelivered(context),
            isPrimary: true,
          ),
        ),
        const SizedBox(width: 12),
        _ActionButton(
          label: 'Track',
          icon: Icons.location_on_rounded,
          color: const Color(0xFF3B82F6),
          onTap: () => _openTracking(context),
        ),
      ],
    );
  }

  // Delivered: Completed
  Widget _buildDeliveredActions(BuildContext context, bool isDark) {
    return Row(
      children: [
        Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0xFF10B981).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: const [
                Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 20),
                SizedBox(width: 8),
                Text(
                  'Order Completed',
                  style: TextStyle(
                    color: Color(0xFF10B981),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 12),
        _ActionButton(
          label: 'Invoice',
          icon: Icons.receipt_long_rounded,
          color: Colors.grey,
          onTap: () => _printInvoice(context),
        ),
      ],
    );
  }

  // Cancelled
  Widget _buildCancelledActions(BuildContext context, bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFEF4444).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: const [
          Icon(Icons.cancel_rounded, color: Color(0xFFEF4444), size: 20),
          SizedBox(width: 8),
          Text(
            'Order Cancelled',
            style: TextStyle(
              color: Color(0xFFEF4444),
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDefaultActions(BuildContext context, bool isDark) {
    return _ActionButton(
      label: 'View Details',
      icon: Icons.info_outline_rounded,
      color: Colors.grey,
      onTap: () {},
    );
  }

  // Show Pack Flow Bottom Sheet
  void _showPackFlow(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => OrderPackFlow(
        order: order,
        onComplete: onRefresh,
      ),
    );
  }

  // Show Ship Flow Bottom Sheet
  void _showShipFlow(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => OrderShipFlow(
        order: order,
        onComplete: onRefresh,
      ),
    );
  }

  void _printInvoice(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Generating invoice...')),
    );
  }

  void _showCancelDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel Order?'),
        content: const Text('Are you sure you want to cancel this order? This action cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('No, Keep It'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              // TODO: Implement cancel logic
            },
            child: const Text('Yes, Cancel', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  void _markDelivered(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Mark as Delivered?'),
        content: const Text('Confirm that this order has been delivered to the customer.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              // TODO: Update status to delivered
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
            child: const Text('Confirm Delivery'),
          ),
        ],
      ),
    );
  }

  void _openTracking(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Opening tracking...')),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;
  final bool isPrimary;

  const _ActionButton({
    required this.label,
    required this.icon,
    required this.color,
    this.onTap,
    this.isPrimary = false,
  });

  @override
  Widget build(BuildContext context) {
    if (isPrimary) {
      return ElevatedButton.icon(
        onPressed: onTap,
        icon: Icon(icon, size: 18),
        label: Text(label),
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      );
    }

    return IconButton(
      onPressed: onTap,
      icon: Icon(icon, color: color, size: 22),
      style: IconButton.styleFrom(
        backgroundColor: color.withValues(alpha: 0.1),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        padding: const EdgeInsets.all(12),
      ),
      tooltip: label,
    );
  }
}
