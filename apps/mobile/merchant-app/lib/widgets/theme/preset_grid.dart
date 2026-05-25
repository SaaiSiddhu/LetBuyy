import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Grid of theme presets
class PresetGrid extends StatelessWidget {
  final String selectedPresetId;
  final ValueChanged<String> onSelect;

  const PresetGrid({
    super.key,
    required this.selectedPresetId,
    required this.onSelect,
  });

  static const _presets = [
    _PresetData('minimal', 'Minimal', ['#000000', '#333333', '#E5E5E5']),
    _PresetData('modern', 'Modern', ['#00B3B3', '#008080', '#A4E500']),
    _PresetData('vibrant', 'Vibrant', ['#FF6B6B', '#4ECDC4', '#FFE66D']),
    _PresetData('elegant', 'Elegant', ['#2C3E50', '#8E44AD', '#F39C12']),
    _PresetData('tech', 'Tech', ['#6366F1', '#8B5CF6', '#06B6D4']),
    _PresetData('nature', 'Nature', ['#22C55E', '#84CC16', '#EAB308']),
  ];

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 3,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 0.9,
      children: _presets.map((preset) {
        final isSelected = selectedPresetId == preset.id;
        return _PresetCard(
          preset: preset,
          isSelected: isSelected,
          onTap: () {
            HapticFeedback.lightImpact();
            onSelect(preset.id);
          },
        );
      }).toList(),
    );
  }
}

class _PresetCard extends StatelessWidget {
  final _PresetData preset;
  final bool isSelected;
  final VoidCallback onTap;

  const _PresetCard({
    required this.preset,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? AppColors.primary : Colors.transparent,
            width: 2,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isSelected ? 0.08 : 0.04),
              blurRadius: isSelected ? 12 : 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Color dots
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: preset.colors.map((hex) {
                return Container(
                  width: 20,
                  height: 20,
                  margin: const EdgeInsets.symmetric(horizontal: 2),
                  decoration: BoxDecoration(
                    color: _hexToColor(hex),
                    shape: BoxShape.circle,
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 12),
            Text(
              preset.name,
              style: TextStyle(
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                color: isSelected ? AppColors.primary : null,
              ),
            ),
            if (isSelected) ...[
              const SizedBox(height: 4),
              Icon(
                Icons.check_circle_rounded,
                size: 16,
                color: AppColors.primary,
              ),
            ],
          ],
        ),
      ),
    );
  }

  Color _hexToColor(String hex) {
    hex = hex.replaceAll('#', '');
    if (hex.length == 6) {
      hex = 'FF$hex';
    }
    return Color(int.parse(hex, radix: 16));
  }
}

class _PresetData {
  final String id;
  final String name;
  final List<String> colors;

  const _PresetData(this.id, this.name, this.colors);
}
