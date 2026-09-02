// lib/screens/admin/analytics/widgets/sales_funnel.dart

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:flutter_animate/flutter_animate.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'analytics_card.dart';

class SalesFunnel extends StatefulWidget {
  final Map<String, int> funnelData;
  final bool isDark;

  const SalesFunnel({
    super.key,
    required this.funnelData,
    required this.isDark,
  });

  @override
  State<SalesFunnel> createState() => _SalesFunnelState();
}

class _SalesFunnelState extends State<SalesFunnel>
    with AutomaticKeepAliveClientMixin, SingleTickerProviderStateMixin {
  @override
  bool get wantKeepAlive => true;

  late AnimationController _animController;
  int? selectedStage;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      duration: const Duration(milliseconds: 1200),
      vsync: this,
    )..forward();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);

    final accentColor =
        widget.isDark ? AppColors.primaryLight : AppColors.primary;
    final stages = _generateFunnelStages();

    if (stages.isEmpty) {
      return _buildEmptyState(accentColor);
    }

    return AnalyticsCard(
      title: 'Sales Funnel',
      icon: Icons.filter_list_rounded,
      color: accentColor,
      isDark: widget.isDark,
      child: Column(
        children: [
          // Summary
          _buildSummary(stages, accentColor),
          const SizedBox(height: 32),

          // Funnel Visualization
          ...stages.asMap().entries.map((entry) {
            final index = entry.key;
            final stage = entry.value;
            return _buildFunnelStage(stage, index, stages.length, accentColor)
                .animate()
                .fadeIn(duration: 400.ms, delay: (index * 100).ms)
                .slideX(begin: -0.2, duration: 500.ms);
          }),

          const SizedBox(height: 24),

          // Conversion Rates
          _buildConversionRates(stages, accentColor),
        ],
      ),
    );
  }

  Widget _buildSummary(List<FunnelStage> stages, Color accentColor) {
    final visitors = stages.first.count;
    final conversions = stages.last.count;
    final conversionRate = visitors > 0 ? (conversions / visitors) * 100 : 0.0;

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            accentColor.withValues(alpha: 0.2),
            accentColor.withValues(alpha: 0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: accentColor.withValues(alpha: 0.4),
          width: 2,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: _buildSummaryItem(
              'Total Visitors',
              NumberFormat.compact().format(visitors),
              Icons.visibility_rounded,
              AppColors.info,
            ),
          ),
          Container(
            width: 1,
            height: 60,
            color: (widget.isDark ? AppColors.borderDark : AppColors.border)
                .withValues(alpha: 0.5),
          ),
          Expanded(
            child: _buildSummaryItem(
              'Conversions',
              NumberFormat.compact().format(conversions),
              Icons.check_circle_rounded,
              AppColors.success,
            ),
          ),
          Container(
            width: 1,
            height: 60,
            color: (widget.isDark ? AppColors.borderDark : AppColors.border)
                .withValues(alpha: 0.5),
          ),
          Expanded(
            child: _buildSummaryItem(
              'Conversion Rate',
              '${conversionRate.toStringAsFixed(2)}%',
              Icons.trending_up_rounded,
              conversionRate >= 3 ? AppColors.success : AppColors.warning,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryItem(
    String label,
    String value,
    IconData icon,
    Color color,
  ) {
    return Column(
      children: [
        Icon(icon, color: color, size: 32),
        const SizedBox(height: 12),
        Text(
          value,
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w900,
            color: color,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color:
                widget.isDark ? AppColors.textLightHint : AppColors.textHint,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildFunnelStage(
    FunnelStage stage,
    int index,
    int totalStages,
    Color accentColor,
  ) {
    final isSelected = selectedStage == index;
    final maxCount = _generateFunnelStages().first.count;
    final widthFactor = maxCount > 0 ? stage.count / maxCount : 0.0;
    final dropoffPercentage = index > 0
        ? ((_generateFunnelStages()[index - 1].count - stage.count) /
                _generateFunnelStages()[index - 1].count *
                100)
        : 0.0;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            if (mounted) {
              setState(() {
                selectedStage = isSelected ? null : index;
              });
            }
          },
          borderRadius: BorderRadius.circular(16),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            width: double.infinity,
            child: Column(
              children: [
                Row(
                  children: [
                    // Stage Number
                    Container(
                      width: 50,
                      height: 50,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            stage.color,
                            stage.color.withValues(alpha: 0.7),
                          ],
                        ),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: stage.color.withValues(alpha: 0.4),
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        '${index + 1}',
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),

                    // Funnel Bar
                    Expanded(
                      child: AnimatedBuilder(
                        animation: _animController,
                        builder: (context, child) {
                          return Stack(
                            children: [
                              // Background
                              Container(
                                height: 70,
                                decoration: BoxDecoration(
                                  color: (widget.isDark
                                          ? AppColors.surfaceDarkVariant
                                          : AppColors.surface)
                                      .withValues(alpha: 0.5),
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(
                                    color: widget.isDark
                                        ? AppColors.borderDark
                                        : AppColors.border,
                                  ),
                                ),
                              ),
                              // Progress Bar
                              AnimatedContainer(
                                duration: const Duration(milliseconds: 800),
                                curve: Curves.easeOutCubic,
                                width: MediaQuery.of(context).size.width *
                                    0.7 *
                                    widthFactor *
                                    _animController.value,
                                height: 70,
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: [
                                      stage.color.withValues(alpha: 0.8),
                                      stage.color.withValues(alpha: 0.6),
                                    ],
                                  ),
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(
                                    color: stage.color.withValues(alpha: 0.8),
                                    width: 2,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: stage.color.withValues(alpha: 0.3),
                                      blurRadius: 12,
                                      offset: const Offset(0, 4),
                                    ),
                                  ],
                                ),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 16),
                                  child: Row(
                                    children: [
                                      Icon(
                                        stage.icon,
                                        color: Colors.white,
                                        size: 24,
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          mainAxisAlignment:
                                              MainAxisAlignment.center,
                                          children: [
                                            Text(
                                              stage.name,
                                              style: const TextStyle(
                                                fontSize: 14,
                                                fontWeight: FontWeight.w700,
                                                color: Colors.white,
                                              ),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              '${NumberFormat.compact().format(stage.count)} users',
                                              style: TextStyle(
                                                fontSize: 12,
                                                color: Colors.white
                                                    .withValues(alpha: 0.9),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      Text(
                                        '${(widthFactor * 100).toStringAsFixed(1)}%',
                                        style: const TextStyle(
                                          fontSize: 18,
                                          fontWeight: FontWeight.w900,
                                          color: Colors.white,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          );
                        },
                      ),
                    ),
                  ],
                ),
                if (index < totalStages - 1 && dropoffPercentage > 0) ...[
                  const SizedBox(height: 8),
                  Padding(
                    padding: const EdgeInsets.only(left: 66),
                    child: Row(
                      children: [
                        Icon(
                          Icons.arrow_downward_rounded,
                          size: 16,
                          color: AppColors.error,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '${dropoffPercentage.toStringAsFixed(1)}% drop-off',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.error,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildConversionRates(List<FunnelStage> stages, Color accentColor) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: (widget.isDark
                ? AppColors.surfaceDarkVariant
                : AppColors.surface)
            .withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: widget.isDark ? AppColors.borderDark : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.insights_rounded,
                size: 20,
                color: accentColor,
              ),
              const SizedBox(width: 8),
              Text(
                'Stage-by-Stage Conversion',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: widget.isDark
                      ? AppColors.textLight
                      : AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 16,
            runSpacing: 12,
            children: List.generate(stages.length - 1, (index) {
              final currentStage = stages[index];
              final nextStage = stages[index + 1];
              final conversionRate = currentStage.count > 0
                  ? (nextStage.count / currentStage.count) * 100
                  : 0.0;

              return Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      (conversionRate >= 70
                              ? AppColors.success
                              : conversionRate >= 50
                                  ? AppColors.warning
                                  : AppColors.error)
                          .withValues(alpha: 0.2),
                      (conversionRate >= 70
                              ? AppColors.success
                              : conversionRate >= 50
                                  ? AppColors.warning
                                  : AppColors.error)
                          .withValues(alpha: 0.05),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: (conversionRate >= 70
                            ? AppColors.success
                            : conversionRate >= 50
                                ? AppColors.warning
                                : AppColors.error)
                        .withValues(alpha: 0.5),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${currentStage.name} → ${nextStage.name}',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: widget.isDark
                            ? AppColors.textLightSecondary
                            : AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${conversionRate.toStringAsFixed(1)}%',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: conversionRate >= 70
                            ? AppColors.success
                            : conversionRate >= 50
                                ? AppColors.warning
                                : AppColors.error,
                      ),
                    ),
                  ],
                ),
              );
            }),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(Color accentColor) {
    return AnalyticsCard(
      title: 'Sales Funnel',
      icon: Icons.filter_list_rounded,
      color: accentColor,
      isDark: widget.isDark,
      child: Container(
        height: 200,
        alignment: Alignment.center,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.filter_list_off_rounded,
              size: 64,
              color: widget.isDark
                  ? AppColors.textLightHint
                  : AppColors.textHint,
            ),
            const SizedBox(height: 16),
            Text(
              'No funnel data available',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: widget.isDark
                    ? AppColors.textLightSecondary
                    : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<FunnelStage> _generateFunnelStages() {
    final visitors = widget.funnelData['visitors'] ?? 10000;
    final productViews = (visitors * 0.7).toInt();
    final addToCarts = (visitors * 0.4).toInt();
    final checkouts = (visitors * 0.15).toInt();
    final purchases = (visitors * 0.08).toInt();

    return [
      FunnelStage(
        name: 'Visitors',
        count: visitors,
        icon: Icons.visibility_rounded,
        color: const Color(0xFF6C63FF),
      ),
      FunnelStage(
        name: 'Product Views',
        count: productViews,
        icon: Icons.remove_red_eye_rounded,
        color: const Color(0xFF4ECDC4),
      ),
      FunnelStage(
        name: 'Add to Cart',
        count: addToCarts,
        icon: Icons.shopping_cart_rounded,
        color: AppColors.info,
      ),
      FunnelStage(
        name: 'Checkout',
        count: checkouts,
        icon: Icons.payment_rounded,
        color: AppColors.warning,
      ),
      FunnelStage(
        name: 'Purchase',
        count: purchases,
        icon: Icons.check_circle_rounded,
        color: AppColors.success,
      ),
    ];
  }
}

class FunnelStage {
  final String name;
  final int count;
  final IconData icon;
  final Color color;

  FunnelStage({
    required this.name,
    required this.count,
    required this.icon,
    required this.color,
  });
}
