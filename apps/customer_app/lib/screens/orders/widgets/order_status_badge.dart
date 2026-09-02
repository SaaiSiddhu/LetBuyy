import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:flutter/material.dart';

class OrderStatusBadge extends StatelessWidget {
  final String status;
  final bool compact;

  const OrderStatusBadge({
    super.key,
    required this.status,
    this.compact = false,
  });

  Color _getStatusColor() {
    switch (status.toLowerCase()) {
      case 'pending':
        return AppColors.warning; // Orange
      case 'confirmed':
        return AppColors.info; // Blue
      case 'processing':
        return AppColors.processing; // Purple
      case 'shipped':
        return AppColors.info; // Cyan
      case 'delivered':
        return AppColors.success; // Green
      case 'cancelled':
        return AppColors.error; // Red
      case 'refunded':
        return AppColors.warning; // Deep Orange
      default:
        return AppColors.textSecondary;
    }
  }

  IconData _getStatusIcon() {
    switch (status.toLowerCase()) {
      case 'pending':
        return Icons.schedule_rounded;
      case 'confirmed':
        return Icons.check_circle_rounded;
      case 'processing':
        return Icons.hourglass_bottom_rounded;
      case 'shipped':
        return Icons.local_shipping_rounded;
      case 'delivered':
        return Icons.done_all_rounded;
      case 'cancelled':
        return Icons.cancel_rounded;
      case 'refunded':
        return Icons.money_rounded;
      default:
        return Icons.info_rounded;
    }
  }

  String _getStatusLabel() {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'Pending';
      case 'confirmed':
        return 'Confirmed';
      case 'processing':
        return 'Processing';
      case 'shipped':
        return 'Shipped';
      case 'delivered':
        return 'Delivered';
      case 'cancelled':
        return 'Cancelled';
      case 'refunded':
        return 'Refunded';
      default:
        return status;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _getStatusColor();
    final icon = _getStatusIcon();
    final label = _getStatusLabel();

    if (compact) {
      return Container(
        padding: const EdgeInsets.symmetric(
          horizontal: 10,
          vertical: 4,
        ),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: color.withValues(alpha: 0.3),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 12,
              color: color,
            ),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: 16,
        vertical: 8,
      ),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [color, color.withValues(alpha: 0.8)],
        ),
        borderRadius: BorderRadius.circular(8),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.3),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 16,
            color: AppColors.white,
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: AppColors.white,
            ),
          ),
        ],
      ),
    );
  }
}
