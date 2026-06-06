import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import '../../theme/app_theme_colors.dart';
import '../../services/subscription_service.dart';
import '../../models/store_model.dart';
import '../../app/routes.dart';

/// Compact subscription status card for dashboard
/// Shows current plan, usage, and upgrade CTA
class SubscriptionCard extends StatelessWidget {
  final StoreModel store;

  const SubscriptionCard({
    super.key,
    required this.store,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final plan = store.subscriptionPlan ?? SubscriptionPlan.trial;
    final planInfo = SubscriptionService.getPlanInfo(plan);
    final color = Color(planInfo['color'] as int);
    
    final productLimit = store.productLimit;
    final currentCount = store.currentProductCount;
    final usagePercent = store.productUsagePercent;
    final isTrial = plan == SubscriptionPlan.trial;
    final daysLeft = store.daysLeftInTrial;

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        Navigator.pushNamed(context, AppRoutes.pricing);
      },
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              color.withValues(alpha: 0.15),
              color.withValues(alpha: 0.05),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: color.withValues(alpha: 0.3),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header row
            Row(
              children: [
                Text(planInfo['badge'] as String, style: const TextStyle(fontSize: 24)),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        planInfo['name'] as String,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: colors.textPrimary,
                        ),
                      ),
                      if (isTrial && daysLeft > 0)
                        Text(
                          '$daysLeft days left',
                          style: TextStyle(
                            fontSize: 12,
                            color: daysLeft <= 5 
                                ? Colors.orange[300] 
                                : colors.textSecondary,
                          ),
                        ),
                    ],
                  ),
                ),
                // Upgrade button
                if (plan != SubscriptionPlan.professional)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: color,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.arrow_upward, size: 12, color: Colors.white),
                        const SizedBox(width: 4),
                        Text(
                          'Upgrade',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
            
            const SizedBox(height: 16),
            
            // Usage bar
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Products Used',
                            style: TextStyle(
                              fontSize: 11,
                              color: colors.textSecondary,
                            ),
                          ),
                          Text(
                            productLimit == -1 
                                ? '$currentCount / ∞' 
                                : '$currentCount / $productLimit',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: colors.textPrimary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: productLimit == -1 ? 0.2 : usagePercent / 100,
                          backgroundColor: Colors.white.withValues(alpha: 0.1),
                          valueColor: AlwaysStoppedAnimation<Color>(
                            usagePercent >= 90 
                                ? Colors.red[400]! 
                                : usagePercent >= 75 
                                    ? Colors.orange[400]! 
                                    : color,
                          ),
                          minHeight: 6,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                // Commission badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    children: [
                      Text(
                        '${(planInfo['commission'] as double).toInt()}%',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: color,
                        ),
                      ),
                      Text(
                        'Fee',
                        style: TextStyle(
                          fontSize: 9,
                          color: colors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            
            // Frozen warning
            if (store.isFrozen)
              Container(
                margin: const EdgeInsets.only(top: 12),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.warning_rounded, color: Colors.red[400], size: 16),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Store is frozen. Upgrade to continue.',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    ).animate().fadeIn(duration: 400.ms).slideY(begin: 0.1);
  }
}

/// Small plan indicator pill for use in headers
class PlanBadge extends StatelessWidget {
  final SubscriptionPlan plan;
  final bool compact;

  const PlanBadge({
    super.key,
    required this.plan,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final planInfo = SubscriptionService.getPlanInfo(plan);
    final color = Color(planInfo['color'] as int);

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 6 : 10,
        vertical: compact ? 2 : 4,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(compact ? 6 : 12),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            planInfo['badge'] as String,
            style: TextStyle(fontSize: compact ? 10 : 14),
          ),
          if (!compact) ...[
            const SizedBox(width: 4),
            Text(
              planInfo['name'] as String,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
