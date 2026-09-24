import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;
import 'dart:ui';
import 'package:flutter_animate/flutter_animate.dart';
import '../../theme/app_theme_colors.dart';

/// Activity Timeline for Dashboard
/// Vertical timeline with animated entries
class ActivityTimeline extends StatelessWidget {
  final List<ActivityItem> activities;
  final bool showEmpty;

  const ActivityTimeline({
    super.key,
    this.activities = const [],
    this.showEmpty = true,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    if (activities.isEmpty && showEmpty) {
      return _buildEmptyState(colors);
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: BackdropFilter(
        filter: ImageFilter.blur(
          sigmaX: colors.glassMediumBlur,
          sigmaY: colors.glassMediumBlur,
        ),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: colors.bentoCard,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Recent Activity',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: colors.textPrimary,
                    ),
                  ),
                  Icon(
                    Icons.history_rounded,
                    size: 16,
                    color: colors.textTertiary,
                  ),
                ],
              ),
              const SizedBox(height: 16),
              ...List.generate(activities.length, (index) {
                return _ActivityTimelineItem(
                  activity: activities[index],
                  isLast: index == activities.length - 1,
                  index: index,
                );
              }),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState(AppThemeColors colors) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: colors.bentoCard,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: colors.warning.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(
              Icons.rocket_launch_rounded,
              color: colors.warning,
              size: 24,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Ready to publish?',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Publish your store to start selling',
            style: TextStyle(fontSize: 12, color: colors.textSecondary),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

/// Individual Activity Timeline Item
class _ActivityTimelineItem extends StatelessWidget {
  final ActivityItem activity;
  final bool isLast;
  final int index;

  const _ActivityTimelineItem({
    required this.activity,
    required this.isLast,
    required this.index,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Timeline indicator
            Column(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: activity.color.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(activity.icon, color: activity.color, size: 16),
                ),
                if (!isLast)
                  Container(
                    width: 2,
                    height: 32,
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    decoration: BoxDecoration(
                      color: colors.borderSubtle,
                      borderRadius: BorderRadius.circular(1),
                    ),
                  ),
              ],
            ),
            const SizedBox(width: 12),
            // Content
            Expanded(
              child: Padding(
                padding: EdgeInsets.only(bottom: isLast ? 0 : 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      activity.title,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: colors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      activity.subtitle,
                      style: TextStyle(
                        fontSize: 11,
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        )
        .animate(delay: Duration(milliseconds: 100 * index))
        .fadeIn(duration: 300.ms)
        .slideX(begin: 0.1, end: 0);
  }
}

/// Activity Item Model
class ActivityItem {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final DateTime? timestamp;

  const ActivityItem({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    this.timestamp,
  });
}

/// Factory for common activity types
/// Uses constant colors since semantic colors (success, warning, etc.) are same across themes
class ActivityItems {
  // Semantic colors that are consistent across light/dark themes
  static const _success = Color(0xFF22C55E);
  static const _warning = Color(0xFFF59E0B);
  static const _accent = mobile_tokens.LetbuyyColorTokens.brandPrimary;
  static const _accentBlue = Color(0xFF3B82F6);

  static ActivityItem storePublished(DateTime? publishedAt) => ActivityItem(
    icon: Icons.check_circle_rounded,
    title: 'Store published',
    subtitle: publishedAt != null
        ? 'Published ${_formatRelativeTime(publishedAt)}'
        : 'Store is online',
    color: _success,
    timestamp: publishedAt,
  );

  static ActivityItem ordersReceived(int count) => ActivityItem(
    icon: Icons.shopping_bag_rounded,
    title: '$count orders received',
    subtitle: 'Total orders all time',
    color: _accentBlue,
  );

  static ActivityItem visitorMilestone(int count) => ActivityItem(
    icon: Icons.visibility_rounded,
    title: '$count store visitors',
    subtitle: 'Total visitors all time',
    color: _accent,
  );

  static ActivityItem productAdded(String productName) => ActivityItem(
    icon: Icons.add_circle_rounded,
    title: 'Product added',
    subtitle: productName,
    color: _success,
  );

  static ActivityItem readyToLaunch() => const ActivityItem(
    icon: Icons.rocket_launch_rounded,
    title: 'Ready to publish?',
    subtitle: 'Publish your store to start selling',
    color: _warning,
  );

  static String _formatRelativeTime(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);

    if (diff.inDays == 0) return 'today';
    if (diff.inDays == 1) return 'yesterday';
    if (diff.inDays < 7) return '${diff.inDays} days ago';
    if (diff.inDays < 30) return '${(diff.inDays / 7).floor()} weeks ago';
    return '${date.day}/${date.month}/${date.year}';
  }
}
