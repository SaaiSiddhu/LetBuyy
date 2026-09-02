import 'package:flutter/material.dart';
import '../../letbuyy_ui_kit.dart';

class CustomBottomNav extends StatelessWidget {
  final int currentIndex;
  final Function(int) onTap;
  final List<CustomBottomNavItem> items;
  final bool isGlass;

  const CustomBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
    required this.items,
    this.isGlass = true,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    Widget navContent = Row(
      mainAxisAlignment: MainAxisAlignment.spaceAround,
      children: items.asMap().entries.map((entry) {
        final index = entry.key;
        final item = entry.value;
        final isSelected = index == currentIndex;

        return InkWell(
          onTap: () => onTap(index),
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: isSelected 
                  ? (isGlass ? Colors.white.withValues(alpha: 0.2) : AppColors.primary.withValues(alpha: 0.1)) 
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  isSelected ? item.activeIcon : item.icon,
                  color: isSelected 
                      ? (isGlass ? Colors.white : AppColors.primary)
                      : (isDark ? AppColors.textLightSecondary : AppColors.textSecondary),
                  size: 24,
                ),
                if (isSelected) ...[
                  const SizedBox(width: 8),
                  Text(
                    item.label,
                    style: AppTextStyles.labelMedium.copyWith(
                      color: isGlass ? Colors.white : AppColors.primary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      }).toList(),
    );

    if (isGlass) {
      return GlassContainer(
        margin: const EdgeInsets.all(16),
        padding: const EdgeInsets.symmetric(vertical: 12),
        borderRadius: BorderRadius.circular(24),
        blur: 15,
        opacity: 0.15,
        child: navContent,
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            offset: const Offset(0, -2),
            blurRadius: 10,
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
      child: SafeArea(child: navContent),
    );
  }
}

class CustomBottomNavItem {
  final IconData icon;
  final IconData activeIcon;
  final String label;

  CustomBottomNavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
  });
}
