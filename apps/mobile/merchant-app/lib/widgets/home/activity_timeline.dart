import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:intl/intl.dart';

/// Activity timeline showing recent store actions
class ActivityTimeline extends StatelessWidget {
  final List<ActivityItem> activities;
  final int maxItems;

  const ActivityTimeline({
    super.key,
    required this.activities,
    this.maxItems = 5,
  });

  @override
  Widget build(BuildContext context) {
    final displayItems = activities.take(maxItems).toList();
    
    if (displayItems.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Center(
          child: Column(
            children: [
              Icon(Icons.history_rounded, size: 40, color: Colors.grey[400]),
              const SizedBox(height: 8),
              Text(
                'No recent activity',
                style: TextStyle(color: Colors.grey[600]),
              ),
            ],
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.history_rounded, size: 20, color: Colors.grey[600]),
              const SizedBox(width: 8),
              const Text(
                'Recent Activity',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ...displayItems.asMap().entries.map((entry) {
            final index = entry.key;
            final item = entry.value;
            final isLast = index == displayItems.length - 1;
            
            return _ActivityRow(
              item: item,
              showLine: !isLast,
            );
          }),
        ],
      ),
    );
  }
}

class _ActivityRow extends StatelessWidget {
  final ActivityItem item;
  final bool showLine;

  const _ActivityRow({
    required this.item,
    this.showLine = true,
  });

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Timeline dot and line
          SizedBox(
            width: 24,
            child: Column(
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: item.color ?? AppColors.primary,
                    shape: BoxShape.circle,
                  ),
                ),
                if (showLine)
                  Expanded(
                    child: Container(
                      width: 2,
                      color: Colors.grey[200],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          // Content
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  if (item.subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      item.subtitle!,
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey[600],
                      ),
                    ),
                  ],
                  const SizedBox(height: 4),
                  Text(
                    _formatTime(item.timestamp),
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.grey[500],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatTime(DateTime time) {
    final now = DateTime.now();
    final diff = now.difference(time);

    if (diff.inMinutes < 1) {
      return 'Just now';
    } else if (diff.inMinutes < 60) {
      return '${diff.inMinutes}m ago';
    } else if (diff.inHours < 24) {
      return '${diff.inHours}h ago';
    } else if (diff.inDays < 7) {
      return '${diff.inDays}d ago';
    } else {
      return DateFormat('MMM d').format(time);
    }
  }
}

/// Activity item model
class ActivityItem {
  final String title;
  final String? subtitle;
  final DateTime timestamp;
  final Color? color;
  final IconData? icon;

  const ActivityItem({
    required this.title,
    this.subtitle,
    required this.timestamp,
    this.color,
    this.icon,
  });

  factory ActivityItem.published() => ActivityItem(
    title: 'Store published',
    subtitle: 'Your store is now live',
    timestamp: DateTime.now(),
    color: Colors.green,
  );

  factory ActivityItem.unpublished() => ActivityItem(
    title: 'Store unpublished',
    subtitle: 'Store is now in draft mode',
    timestamp: DateTime.now(),
    color: Colors.orange,
  );

  factory ActivityItem.productsAdded(int count) => ActivityItem(
    title: 'Products added',
    subtitle: '$count products added to store',
    timestamp: DateTime.now(),
    color: Colors.blue,
  );

  factory ActivityItem.themeChanged(String themeName) => ActivityItem(
    title: 'Theme changed',
    subtitle: 'Applied $themeName theme',
    timestamp: DateTime.now(),
    color: Colors.purple,
  );
}
