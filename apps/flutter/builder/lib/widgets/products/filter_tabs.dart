import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Filter tab types
enum ProductFilter { all, selected, notSelected }

/// Filter tabs for products
class FilterTabs extends StatelessWidget {
  final ProductFilter selected;
  final ValueChanged<ProductFilter> onChanged;
  final int allCount;
  final int selectedCount;
  final int notSelectedCount;

  const FilterTabs({
    super.key,
    required this.selected,
    required this.onChanged,
    required this.allCount,
    required this.selectedCount,
    required this.notSelectedCount,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Expanded(
            child: _FilterTab(
              label: 'All',
              count: allCount,
              isSelected: selected == ProductFilter.all,
              onTap: () {
                HapticFeedback.lightImpact();
                onChanged(ProductFilter.all);
              },
            ),
          ),
          Expanded(
            child: _FilterTab(
              label: 'Selected',
              count: selectedCount,
              isSelected: selected == ProductFilter.selected,
              showDot: true,
              dotColor: Colors.green,
              onTap: () {
                HapticFeedback.lightImpact();
                onChanged(ProductFilter.selected);
              },
            ),
          ),
          Expanded(
            child: _FilterTab(
              label: 'Not Selected',
              count: notSelectedCount,
              isSelected: selected == ProductFilter.notSelected,
              onTap: () {
                HapticFeedback.lightImpact();
                onChanged(ProductFilter.notSelected);
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterTab extends StatelessWidget {
  final String label;
  final int count;
  final bool isSelected;
  final bool showDot;
  final Color? dotColor;
  final VoidCallback onTap;

  const _FilterTab({
    required this.label,
    required this.count,
    required this.isSelected,
    this.showDot = false,
    this.dotColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (showDot) ...[
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: dotColor ?? AppColors.primary,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 4),
            ],
            Text(
              label,
              style: TextStyle(
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                fontSize: 12,
                color: isSelected ? AppColors.primary : Colors.grey[600],
              ),
            ),
            const SizedBox(width: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: isSelected
                    ? AppColors.primary.withValues(alpha: 0.1)
                    : Colors.grey[200],
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                count.toString(),
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: isSelected ? AppColors.primary : Colors.grey[600],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
