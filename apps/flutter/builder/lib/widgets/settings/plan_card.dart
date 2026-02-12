import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../theme/app_theme_colors.dart';

/// Premium Plan card for settings - Dark Theme
class PlanCard extends StatelessWidget {
  final String planName;
  final bool isPremium;
  final List<String> features;
  final VoidCallback? onUpgrade;

  const PlanCard({
    super.key,
    required this.planName,
    this.isPremium = false,
    this.features = const [],
    this.onUpgrade,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: isPremium
            ? LinearGradient(
                colors: [
                  Colors.amber.shade700.withValues(alpha: 0.3),
                  Colors.amber.shade900.withValues(alpha: 0.2),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              )
            : null,
        color: isPremium ? null : colors.surfaceVariant,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isPremium 
              ? Colors.amber.shade600.withValues(alpha: 0.5) 
              : colors.divider,
        ),
        boxShadow: isPremium ? [
          BoxShadow(
            color: Colors.amber.shade700.withValues(alpha: 0.2),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ] : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              // Plan icon
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  gradient: isPremium
                      ? LinearGradient(
                          colors: [Colors.amber.shade600, Colors.amber.shade700],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        )
                      : LinearGradient(
                          colors: [
                            AppColors.lavender.withValues(alpha: 0.3),
                            AppColors.lavender.withValues(alpha: 0.2),
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                  borderRadius: BorderRadius.circular(14),
                  border: isPremium ? null : Border.all(color: AppColors.lavender.withValues(alpha: 0.3)),
                ),
                child: Icon(
                  isPremium ? Icons.diamond_rounded : Icons.inventory_2_rounded,
                  color: isPremium ? Colors.white : AppColors.lavender,
                  size: 24,
                ),
              ),
              const SizedBox(width: 16),
              // Plan info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          planName,
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: colors.textPrimary,
                          ),
                        ),
                        if (isPremium) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [Colors.amber.shade600, Colors.amber.shade700],
                              ),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              'ACTIVE',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      isPremium ? 'Full access to all features' : 'Limited features',
                      style: TextStyle(
                        fontSize: 13,
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (features.isNotEmpty) ...[
            const SizedBox(height: 16),
            Divider(color: colors.divider),
            const SizedBox(height: 12),
            ...features.map((feature) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      color: isPremium 
                          ? Colors.amber.shade600 
                          : const Color(0xFF22C55E),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.check,
                      size: 12,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      feature,
                      style: TextStyle(
                        fontSize: 13,
                        color: colors.textPrimary,
                      ),
                    ),
                  ),
                ],
              ),
            )),
          ],
          if (!isPremium && onUpgrade != null) ...[
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: onUpgrade,
                icon: const Icon(Icons.diamond_rounded, size: 18),
                label: Text('Upgrade to Premium'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.lavender,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
