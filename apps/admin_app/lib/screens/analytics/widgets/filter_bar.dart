import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../analytics_screen.dart';

/// Metric views for analytics
enum MetricView { revenue, orders, customers, conversion }

class FilterBar extends StatelessWidget {
  final RangeKey selectedRange;
  final ComparisonMode comparisonMode;
  final MetricView selectedMetric;
  final Function(RangeKey) onRangeChanged;
  final Function(ComparisonMode) onComparisonChanged;
  final Function(MetricView) onMetricChanged;
  final bool isDark;
  final bool isCompact;

  const FilterBar({
    super.key,
    required this.selectedRange,
    required this.comparisonMode,
    required this.selectedMetric,
    required this.onRangeChanged,
    required this.onComparisonChanged,
    required this.onMetricChanged,
    required this.isDark,
    this.isCompact = false,
  });

  @override
  Widget build(BuildContext context) {
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border),
        boxShadow: [
          BoxShadow(
            color: (isDark ? AppColors.shadowDark : AppColors.shadowLight).withValues(alpha: 0.08),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: isCompact ? _buildCompactLayout(accentColor) : _buildFullLayout(accentColor),
    );
  }

  Widget _buildFullLayout(Color accentColor) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.filter_list_rounded, color: accentColor, size: 20),
            const SizedBox(width: 8),
            Text('Filters', style: AppTextStyles.bodyLarge.copyWith(fontWeight: FontWeight.w700, color: isDark ? AppColors.textLight : AppColors.textPrimary)),
            const Spacer(),
            TextButton.icon(
              onPressed: () {
                onRangeChanged(RangeKey.day30);
                onComparisonChanged(ComparisonMode.none);
                onMetricChanged(MetricView.revenue);
              },
              icon: const Icon(Icons.refresh_rounded, size: 16),
              label: const Text('Reset'),
              style: TextButton.styleFrom(foregroundColor: accentColor),
            ),
          ],
        ),
        const SizedBox(height: 16),
        _buildSection('Time Range', Wrap(spacing: 8, runSpacing: 8, children: RangeKey.values.where((r) => r != RangeKey.custom).map((range) {
          final isSelected = range == selectedRange;
          return ChoiceChip(
            label: Text(range.label),
            selected: isSelected,
            onSelected: (_) => onRangeChanged(range),
            selectedColor: accentColor,
            backgroundColor: isDark ? AppColors.surfaceDarkVariant : AppColors.background,
            labelStyle: TextStyle(color: isSelected ? (isDark ? AppColors.textPrimary : AppColors.white) : (isDark ? AppColors.textLight : AppColors.textPrimary), fontWeight: FontWeight.w700, fontSize: 13),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          );
        }).toList())),
        const SizedBox(height: 16),
        _buildSection('Compare With', Wrap(spacing: 8, runSpacing: 8, children: [
          _buildComparisonChip('None', ComparisonMode.none, Icons.block_rounded, accentColor),
          _buildComparisonChip('Previous Period', ComparisonMode.previous, Icons.compare_arrows_rounded, accentColor),
          _buildComparisonChip('Year Ago', ComparisonMode.yearAgo, Icons.calendar_today_rounded, accentColor),
        ])),
        const SizedBox(height: 16),
        _buildSection('Primary Metric', Wrap(spacing: 8, runSpacing: 8, children: [
          _buildMetricChip('Revenue', MetricView.revenue, Icons.currency_rupee_rounded, accentColor),
          _buildMetricChip('Orders', MetricView.orders, Icons.shopping_cart_rounded, accentColor),
          _buildMetricChip('Customers', MetricView.customers, Icons.people_rounded, accentColor),
          _buildMetricChip('Conversion', MetricView.conversion, Icons.trending_up_rounded, accentColor),
        ])),
      ],
    );
  }

  Widget _buildCompactLayout(Color accentColor) {
    return Row(
      children: [
        Expanded(
          child: DropdownButtonFormField<RangeKey>(
            initialValue: selectedRange,
            decoration: InputDecoration(
              labelText: 'Range',
              prefixIcon: const Icon(Icons.calendar_today_rounded, size: 18),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              isDense: true,
            ),
            items: RangeKey.values.where((r) => r != RangeKey.custom).map((range) => DropdownMenuItem(value: range, child: Text(range.label))).toList(),
            onChanged: (range) { if (range != null) onRangeChanged(range); },
          ),
        ),
        const SizedBox(width: 12),
        IconButton(
          onPressed: () => onComparisonChanged(comparisonMode == ComparisonMode.none ? ComparisonMode.previous : ComparisonMode.none),
          icon: Icon(comparisonMode == ComparisonMode.none ? Icons.compare_arrows_rounded : Icons.check_circle_rounded, color: comparisonMode != ComparisonMode.none ? accentColor : null),
          tooltip: 'Compare periods',
        ),
      ],
    );
  }

  Widget _buildSection(String title, Widget child) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style: AppTextStyles.bodyMedium.copyWith(fontWeight: FontWeight.w600, color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary)),
      const SizedBox(height: 10),
      child,
    ]);
  }

  Widget _buildComparisonChip(String label, ComparisonMode mode, IconData icon, Color accentColor) {
    final isSelected = mode == comparisonMode;
    return FilterChip(
      label: Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 16), const SizedBox(width: 6), Text(label)]),
      selected: isSelected, onSelected: (_) => onComparisonChanged(mode),
      selectedColor: accentColor.withValues(alpha: 0.2), checkmarkColor: accentColor,
      backgroundColor: isDark ? AppColors.surfaceDarkVariant : AppColors.background,
      labelStyle: TextStyle(color: isSelected ? accentColor : (isDark ? AppColors.textLight : AppColors.textPrimary), fontWeight: FontWeight.w600, fontSize: 13),
    );
  }

  Widget _buildMetricChip(String label, MetricView metric, IconData icon, Color accentColor) {
    final isSelected = metric == selectedMetric;
    return FilterChip(
      label: Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 16), const SizedBox(width: 6), Text(label)]),
      selected: isSelected, onSelected: (_) => onMetricChanged(metric),
      selectedColor: accentColor.withValues(alpha: 0.2), checkmarkColor: accentColor,
      backgroundColor: isDark ? AppColors.surfaceDarkVariant : AppColors.background,
      labelStyle: TextStyle(color: isSelected ? accentColor : (isDark ? AppColors.textLight : AppColors.textPrimary), fontWeight: FontWeight.w600, fontSize: 13),
    );
  }
}