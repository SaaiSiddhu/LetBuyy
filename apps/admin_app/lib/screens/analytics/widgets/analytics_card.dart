// lib/screens/admin/analytics/widgets/analytics_card.dart

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class AnalyticsCard extends StatelessWidget {
  final String title;
  final String? value;
  final IconData icon;
  final Color color;
  final bool isDark;
  final Widget? child;
  final double? trend;
  final bool compact;
  final VoidCallback? onTap;

  const AnalyticsCard({
    super.key,
    required this.title,
    this.value,
    required this.icon,
    required this.color,
    required this.isDark,
    this.child,
    this.trend,
    this.compact = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cardColor = isDark ? AppColors.surfaceDark : AppColors.surface;
    final borderColor = isDark ? AppColors.borderDark : AppColors.border;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        decoration: BoxDecoration(
          color: cardColor,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: borderColor, width: 1.5),
          boxShadow: [
            BoxShadow(
              color: (isDark ? AppColors.shadowDark : AppColors.shadowLight)
                  .withValues(alpha: 0.1),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: child ?? _buildDefaultContent(),
      )
          .animate()
          .fadeIn(duration: 300.ms)
          .slideY(begin: 0.1, end: 0),
    );
  }

  Widget _buildDefaultContent() {
    return Padding(
      padding: EdgeInsets.all(compact ? 12 : 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: compact
            ? MainAxisAlignment.center
            : MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: (compact
                          ? AppTextStyles.bodySmall
                          : AppTextStyles.bodyMedium)
                      .copyWith(
                    color: isDark
                        ? AppColors.textLightSecondary
                        : AppColors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  icon,
                  color: color,
                  size: compact ? 18 : 24,
                ),
              ),
            ],
          ),
          if (!compact) const SizedBox(height: 16),
          if (compact) const SizedBox(height: 8),
          if (value != null) ...[
            Text(
              value!,
              style: (compact
                      ? AppTextStyles.headlineSmall
                      : AppTextStyles.headlineMedium)
                  .copyWith(
                color: color,
                fontWeight: FontWeight.w800,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            if (trend != null) ...[
              const SizedBox(height: 8),
              _buildTrendIndicator(),
            ],
          ],
        ],
      ),
    );
  }

  Widget _buildTrendIndicator() {
    final isPositive = trend! >= 0;
    final trendColor = isPositive ? AppColors.success : AppColors.error;

    return Row(
      children: [
        Icon(
          isPositive ? Icons.trending_up_rounded : Icons.trending_down_rounded,
          size: 16,
          color: trendColor,
        ),
        const SizedBox(width: 4),
        Text(
          '${isPositive ? '+' : ''}${trend!.toStringAsFixed(1)}%',
          style: AppTextStyles.bodySmall.copyWith(
            color: trendColor,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(width: 4),
        Text(
          'vs last period',
          style: AppTextStyles.bodySmall.copyWith(
            color: isDark ? AppColors.textLightHint : AppColors.textHint,
          ),
        ),
      ],
    );
  }
}
