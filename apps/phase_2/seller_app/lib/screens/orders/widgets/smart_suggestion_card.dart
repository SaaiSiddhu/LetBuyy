// lib/screens/orders/widgets/smart_suggestion_card.dart
// AI-lite Smart Suggestions for Order Actions

import 'package:flutter/material.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

/// Displays contextual smart suggestions based on order data
class SmartSuggestionCard extends StatelessWidget {
  final OrderModel order;
  final int? customerOrderCount;
  final VoidCallback? onDismiss;

  const SmartSuggestionCard({
    super.key,
    required this.order,
    this.customerOrderCount,
    this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    final suggestion = _getSuggestion();
    if (suggestion == null) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            suggestion.color.withValues(alpha: 0.08),
            suggestion.secondaryColor.withValues(alpha: 0.08),
          ],
        ),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: suggestion.color.withValues(alpha: 0.2),
          width: 1,
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: suggestion.color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              suggestion.icon,
              size: 16,
              color: suggestion.color,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  suggestion.title,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: suggestion.color,
                  ),
                ),
                if (suggestion.subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    suggestion.subtitle!,
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (onDismiss != null)
            GestureDetector(
              onTap: onDismiss,
              child: Icon(
                Icons.close_rounded,
                size: 16,
                color: Colors.grey[400],
              ),
            ),
        ],
      ),
    );
  }

  _SuggestionInfo? _getSuggestion() {
    final status = order.orderStatus.toLowerCase();
    final hoursSinceCreated = DateTime.now().difference(order.createdAt).inHours;
    final paymentMethod = order.paymentMethod.toLowerCase() ?? '';
    final isCOD = paymentMethod == 'cod' || paymentMethod == 'cash on delivery';

    // Priority 1: SLA Breach Warning
    if (status == 'pending' && hoursSinceCreated >= 18) {
      return _SuggestionInfo(
        icon: Icons.flash_on_rounded,
        title: '⚡ Ship now to avoid SLA breach',
        subtitle: 'Only ${24 - hoursSinceCreated}h remaining',
        color: Colors.red,
        secondaryColor: Colors.orange,
        priority: 0,
      );
    }

    // Priority 2: High-value COD risk
    if (isCOD && order.total > 3000 && status == 'pending') {
      return _SuggestionInfo(
        icon: Icons.phone_in_talk_rounded,
        title: '💡 Confirm order via call',
        subtitle: 'High-value COD (₹${order.total.toInt()}) - reduce RTO risk',
        color: Colors.purple,
        secondaryColor: Colors.blue,
        priority: 1,
      );
    }

    // Priority 3: COD Risk Warning
    if (isCOD && status == 'pending') {
      return _SuggestionInfo(
        icon: Icons.warning_amber_rounded,
        title: '⚠️ COD orders have higher RTO risk',
        subtitle: 'Consider verifying customer phone',
        color: Colors.amber,
        secondaryColor: Colors.orange,
        priority: 2,
      );
    }

    // Priority 4: Loyal Customer
    if (customerOrderCount != null && customerOrderCount! >= 3) {
      return _SuggestionInfo(
        icon: Icons.stars_rounded,
        title: '🌟 Loyal customer - $customerOrderCount successful orders',
        subtitle: 'Priority handling recommended',
        color: Colors.green,
        secondaryColor: Colors.teal,
        priority: 3,
      );
    }

    // Priority 5: First-time buyer
    if (customerOrderCount == 1) {
      return _SuggestionInfo(
        icon: Icons.celebration_rounded,
        title: '🆕 First-time buyer',
        subtitle: 'Great experience = repeat customer',
        color: Colors.blue,
        secondaryColor: Colors.indigo,
        priority: 4,
      );
    }

    // Priority 6: Express Delivery (check for shipping method or item flags)
    // Since OrderModel doesn't have expressDelivery field, use fallback
    const isExpress = false; // TODO: Add express delivery field when implemented
    if (isExpress && status != 'delivered') {
      return _SuggestionInfo(
        icon: Icons.speed_rounded,
        title: '⚡ Express order - prioritize packing',
        subtitle: 'Customer expects 1-2 day delivery',
        color: Colors.cyan,
        secondaryColor: Colors.blue,
        priority: 5,
      );
    }

    return null;
  }
}

class _SuggestionInfo {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Color color;
  final Color secondaryColor;
  final int priority;

  const _SuggestionInfo({
    required this.icon,
    required this.title,
    this.subtitle,
    required this.color,
    required this.secondaryColor,
    required this.priority,
  });
}

/// Get all suggestions for an order (for detailed view)
class OrderSuggestions {
  static List<String> getAll(OrderModel order, {int? customerOrderCount}) {
    final suggestions = <String>[];
    final status = order.orderStatus.toLowerCase();
    final hoursSinceCreated = DateTime.now().difference(order.createdAt).inHours;
    final paymentMethod = order.paymentMethod.toLowerCase() ?? '';
    final isCOD = paymentMethod == 'cod' || paymentMethod == 'cash on delivery';

    if (status == 'pending' && hoursSinceCreated >= 18) {
      suggestions.add('⚡ Ship now to avoid SLA breach');
    }
    if (isCOD) {
      suggestions.add('⚠️ COD order - ${order.total > 3000 ? 'High' : 'Moderate'} RTO risk');
    }
    if (customerOrderCount != null && customerOrderCount >= 3) {
      suggestions.add('🌟 Loyal customer ($customerOrderCount orders)');
    }
    if (customerOrderCount == 1) {
      suggestions.add('🆕 First-time buyer');
    }
    // Express check - disabled until field is added
    const isExpress = false;
    if (isExpress) {
      suggestions.add('⚡ Express delivery requested');
    }

    return suggestions;
  }
}
