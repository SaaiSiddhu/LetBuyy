import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;
import '../../theme/app_theme_colors.dart';

/// Activity Timeline for Dashboard
/// A saved publication state and explicitly scoped aggregate counts
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
    if (activities.isEmpty && showEmpty) {
      return _buildEmptyState(context);
    }

    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Semantics(
              header: true,
              child: Text(
                'Store overview',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            const SizedBox(height: 16),
            for (var index = 0; index < activities.length; index++)
              _ActivityTimelineItem(
                activity: activities[index],
                isLast: index == activities.length - 1,
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) => const Card(
    margin: EdgeInsets.zero,
    child: mobile_tokens.EmptyState(
      icon: Icons.rocket_launch_rounded,
      title: 'Ready to publish?',
      message: 'Publish your store to start selling',
    ),
  );
}

/// Individual Activity Timeline Item
class _ActivityTimelineItem extends StatelessWidget {
  final ActivityItem activity;
  final bool isLast;

  const _ActivityTimelineItem({required this.activity, required this.isLast});

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
                color: Theme.of(context).colorScheme.secondaryContainer,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                activity.icon,
                color: Theme.of(context).colorScheme.onSecondaryContainer,
                size: 16,
              ),
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
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: 2),
                Text(
                  activity.subtitle,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
        ),
      ],
    );
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
        : 'Publication is enabled',
    color: _success,
    timestamp: publishedAt,
  );

  static ActivityItem ordersReceived(int count, {String scope = 'All time'}) =>
      ActivityItem(
        icon: Icons.shopping_bag_rounded,
        title: '$count orders received',
        subtitle: 'Reporting period: $scope',
        color: _accentBlue,
      );

  static ActivityItem visitorMilestone(
    int count, {
    String scope = 'All time',
  }) => ActivityItem(
    icon: Icons.visibility_rounded,
    title: '$count store visitors',
    subtitle: 'Reporting period: $scope',
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
