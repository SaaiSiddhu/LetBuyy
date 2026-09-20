// lib/screens/orders/widgets/priority_badges.dart
// Order Priority Badges - Visual indicators for order importance

import 'package:flutter/material.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

/// Displays priority badges based on order properties
class PriorityBadges extends StatelessWidget {
  final OrderModel order;
  final int? customerOrderCount;
  final bool compact;

  const PriorityBadges({
    super.key,
    required this.order,
    this.customerOrderCount,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final badges = _getBadges();
    if (badges.isEmpty) return const SizedBox.shrink();

    return Wrap(
      spacing: 6,
      runSpacing: 4,
      children: badges.map((badge) => _buildBadge(badge)).toList(),
    );
  }

  List<_BadgeInfo> _getBadges() {
    final List<_BadgeInfo> badges = [];
    final status = order.orderStatus.toLowerCase();
    final hoursSinceCreated = DateTime.now().difference(order.createdAt).inHours;

    // 🔥 High Value (₹5000+)
    if (order.total >= 5000) {
      badges.add(_BadgeInfo(
        label: compact ? '₹5K+' : 'High Value',
        icon: Icons.local_fire_department_rounded,
        color: Colors.orange,
        priority: 1,
      ));
    }

    // ⚠️ Overdue (24h+ pending)
    if (status == 'pending' && hoursSinceCreated > 24) {
      badges.add(_BadgeInfo(
        label: compact ? 'OD' : 'Overdue',
        icon: Icons.warning_rounded,
        color: Colors.red,
        priority: 0,
      ));
    }
    // ⏰ SLA Risk (18-24h pending)
    else if (status == 'pending' && hoursSinceCreated >= 18) {
      badges.add(_BadgeInfo(
        label: compact ? 'SLA' : 'SLA Risk',
        icon: Icons.schedule_rounded,
        color: Colors.amber,
        priority: 1,
      ));
    }

    // 🆕 First Order
    if (customerOrderCount != null && customerOrderCount == 1) {
      badges.add(_BadgeInfo(
        label: compact ? 'New' : 'First Order',
        icon: Icons.fiber_new_rounded,
        color: Colors.blue,
        priority: 2,
      ));
    }
    // 🔁 Repeat Customer
    else if (customerOrderCount != null && customerOrderCount! > 1) {
      badges.add(_BadgeInfo(
        label: compact ? '${customerOrderCount}x' : 'Repeat (${customerOrderCount}x)',
        icon: Icons.replay_rounded,
        color: Colors.green,
        priority: 3,
      ));
    }

    // 💵 COD
    final paymentMethod = order.paymentMethod.toLowerCase() ?? '';
    if (paymentMethod == 'cod' || paymentMethod == 'cash on delivery') {
      badges.add(_BadgeInfo(
        label: 'COD',
        icon: Icons.payments_rounded,
        color: Colors.purple,
        priority: 4,
      ));
    }

    // ⚡ Express Delivery (check via shipping method or item metadata)
    // Since OrderModel doesn't have expressDelivery field, we check for standard indicators
    final isExpress = false; // TODO: Add express delivery field to OrderModel when needed
    if (isExpress) {
      badges.add(_BadgeInfo(
        label: compact ? '⚡' : 'Express',
        icon: Icons.flash_on_rounded,
        color: Colors.cyan,
        priority: 2,
      ));
    }

    // Sort by priority (lower = more important)
    badges.sort((a, b) => a.priority.compareTo(b.priority));
    return badges.take(compact ? 3 : 5).toList();
  }

  Widget _buildBadge(_BadgeInfo badge) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 6 : 8,
        vertical: compact ? 2 : 4,
      ),
      decoration: BoxDecoration(
        color: badge.color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(
          color: badge.color.withValues(alpha: 0.3),
          width: 1,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            badge.icon,
            size: compact ? 12 : 14,
            color: badge.color,
          ),
          SizedBox(width: compact ? 3 : 4),
          Text(
            badge.label,
            style: TextStyle(
              fontSize: compact ? 10 : 11,
              fontWeight: FontWeight.w600,
              color: badge.color,
            ),
          ),
        ],
      ),
    );
  }
}

class _BadgeInfo {
  final String label;
  final IconData icon;
  final Color color;
  final int priority;

  const _BadgeInfo({
    required this.label,
    required this.icon,
    required this.color,
    required this.priority,
  });
}
