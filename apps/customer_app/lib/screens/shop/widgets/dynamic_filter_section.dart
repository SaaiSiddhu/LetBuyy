// lib/screens/shop/widgets/dynamic_filter_section.dart
// Amazon-style dynamic attribute filter section for marketplace

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

/// A widget that displays dynamically aggregated attribute filters
class DynamicFilterSection extends StatelessWidget {
  final List<ProductModel> products;
  final Map<String, Set<String>> selectedFilters;
  final Function(String key, String value, bool selected) onFilterChanged;
  final bool isDark;
  final Color accentColor;

  const DynamicFilterSection({
    super.key,
    required this.products,
    required this.selectedFilters,
    required this.onFilterChanged,
    required this.isDark,
    required this.accentColor,
  });

  @override
  Widget build(BuildContext context) {
    // Aggregate attributes from all products
    final aggregatedFilters = _aggregateProductAttributes();

    if (aggregatedFilters.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: aggregatedFilters.entries.map((entry) {
        return _buildFilterCategory(
          entry.key,
          entry.value,
          context,
        );
      }).toList(),
    );
  }

  /// Aggregates product attributes into filter options with counts
  Map<String, Map<String, int>> _aggregateProductAttributes() {
    final Map<String, Map<String, int>> aggregated = {};

    for (final product in products) {
      // Process approved attributes
      for (final entry in product.attributes.entries) {
        final key = entry.key;
        final value = entry.value;

        aggregated.putIfAbsent(key, () => {});

        if (value is List) {
          for (final v in value) {
            final strValue = v.toString();
            aggregated[key]![strValue] = (aggregated[key]![strValue] ?? 0) + 1;
          }
        } else if (value != null && value.toString().isNotEmpty) {
          final strValue = value.toString();
          aggregated[key]![strValue] = (aggregated[key]![strValue] ?? 0) + 1;
        }
      }
    }

    // Sort by count (descending) and filter out single-value attributes
    final sorted = <String, Map<String, int>>{};
    for (final entry in aggregated.entries) {
      if (entry.value.length > 1) {
        // Only show attributes with multiple values
        final sortedValues = Map.fromEntries(
          entry.value.entries.toList()
            ..sort((a, b) => b.value.compareTo(a.value)),
        );
        sorted[entry.key] = sortedValues;
      }
    }

    return sorted;
  }

  Widget _buildFilterCategory(
    String key,
    Map<String, int> options,
    BuildContext context,
  ) {
    // Convert key to display label (snake_case to Title Case)
    final label = _keyToLabel(key);
    final selectedValues = selectedFilters[key] ?? {};

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Category header
          Row(
            children: [
              Icon(
                _getIconForAttribute(key),
                size: 16,
                color: accentColor,
              ),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              if (selectedValues.isNotEmpty) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: accentColor,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '${selectedValues.length}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 8),
          
          // Filter chips
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: options.entries.take(10).map((entry) {
              final value = entry.key;
              final count = entry.value;
              final isSelected = selectedValues.contains(value);

              return InkWell(
                onTap: () {
                  HapticFeedback.selectionClick();
                  onFilterChanged(key, value, !isSelected);
                },
                borderRadius: BorderRadius.circular(20),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? accentColor.withValues(alpha: 0.15)
                        : (isDark ? Colors.grey[800] : Colors.grey[100]),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: isSelected ? accentColor : Colors.transparent,
                      width: 1.5,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (isSelected)
                        Padding(
                          padding: const EdgeInsets.only(right: 4),
                          child: Icon(
                            Icons.check,
                            size: 14,
                            color: accentColor,
                          ),
                        ),
                      Text(
                        value,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                          color: isSelected
                              ? accentColor
                              : (isDark ? Colors.white70 : Colors.black87),
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '($count)',
                        style: TextStyle(
                          fontSize: 11,
                          color: isDark ? Colors.grey[500] : Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  String _keyToLabel(String key) {
    // Convert snake_case to Title Case
    return key
        .split('_')
        .map((word) => word.isNotEmpty
            ? '${word[0].toUpperCase()}${word.substring(1)}'
            : '')
        .join(' ');
  }

  IconData _getIconForAttribute(String key) {
    switch (key.toLowerCase()) {
      case 'color':
      case 'colour':
        return Icons.palette;
      case 'size':
        return Icons.straighten;
      case 'ram':
      case 'memory':
        return Icons.memory;
      case 'storage':
        return Icons.storage;
      case 'brand':
        return Icons.local_offer;
      case 'material':
        return Icons.texture;
      case 'power_source':
        return Icons.battery_charging_full;
      case 'age':
      case 'age_range':
        return Icons.cake;
      case 'features':
        return Icons.star;
      case 'processor':
        return Icons.developer_board;
      case 'screen_size':
        return Icons.aspect_ratio;
      case 'fit':
        return Icons.checkroom;
      case 'pattern':
        return Icons.grid_on;
      default:
        return Icons.tune;
    }
  }
}
