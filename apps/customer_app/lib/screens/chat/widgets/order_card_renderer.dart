// lib/screens/chat/widgets/order_card_renderer.dart
import 'package:flutter/material.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

class OrderCardRenderer extends StatelessWidget {
  final ChatMessage message;
  final Function(String) onOrderTap;

  const OrderCardRenderer({
    super.key,
    required this.message,
    required this.onOrderTap,
  });

  @override
  Widget build(BuildContext context) {
    if (!message.hasOrders || message.orders == null) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
          child: Text(
            'Your Recent Orders',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.bold,
              color: AppColors.textPrimary,
            ),
          ),
        ),
        ...message.orders!.map((order) => _buildOrderCard(context, order)),
      ],
    );
  }

  Widget _buildOrderCard(BuildContext context, Map<String, dynamic> order) {
    final orderId = order['id']?.toString() ?? '';
    final orderNumber = order['orderNumber']?.toString() ?? orderId;
    final status = (order['status'] ?? order['orderStatus'] ?? 'unknown').toString().toUpperCase();
    final total = _parseDouble(order['total'] ?? order['totalAmount']) ?? 0.0;

    final statusColor = _getStatusColor(status);

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      color: AppColors.white,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.borderLight, width: 0.5),
      ),
      child: InkWell(
        onTap: () => onOrderTap(orderId),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.shopping_bag_outlined,
                  color: AppColors.primary,
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Order #$orderNumber',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        status,
                        style: TextStyle(
                          fontSize: 11,
                          color: statusColor,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                '₹${total.toStringAsFixed(2)}',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'delivered':
        return AppColors.success;
      case 'shipped':
      case 'processing':
        return AppColors.info;
      case 'out_for_delivery':
      case 'outfordelivery':
        return AppColors.warning;
      case 'cancelled':
        return AppColors.error;
      case 'pending':
        return AppColors.warning;
      default:
        return AppColors.textTertiary;
    }
  }

  double? _parseDouble(dynamic value) {
    if (value == null) return null;
    if (value is double) return value;
    if (value is int) return value.toDouble();
    if (value is String) return double.tryParse(value);
    return null;
  }
}