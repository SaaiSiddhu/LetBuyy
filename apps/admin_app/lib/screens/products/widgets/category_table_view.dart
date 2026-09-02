// lib/screens/products/widgets/category_table_view.dart
// Professional Category DataTable View with Selection and Actions

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

/// Category Table View Widget
class CategoryTableView extends StatelessWidget {
  final List<CategoryModel> categories;
  final bool isDark;
  final Set<String> selectedIds;
  final Function(String) onSelect;
  final Function(Set<String>) onSelectAll;
  final Function(CategoryModel) onEdit;
  final Function(CategoryModel) onDelete;
  final Function(CategoryModel) onAddChild;
  final Function(CategoryModel, bool) onToggleStatus;

  const CategoryTableView({
    super.key,
    required this.categories,
    required this.isDark,
    required this.selectedIds,
    required this.onSelect,
    required this.onSelectAll,
    required this.onEdit,
    required this.onDelete,
    required this.onAddChild,
    required this.onToggleStatus,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: SingleChildScrollView(
        child: Container(
          margin: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF0D0D12) : Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.shade200,
            ),
            boxShadow: [
              if (!isDark)
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 10,
                  offset: const Offset(0, 2),
                ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: DataTable(
              headingRowColor: WidgetStateProperty.all(
                isDark ? const Color(0xFF1A1A24) : Colors.grey.shade50,
              ),
              dataRowColor: WidgetStateProperty.resolveWith((states) {
                if (states.contains(WidgetState.selected)) {
                  return AppColors.primary.withValues(alpha: 0.1);
                }
                if (states.contains(WidgetState.hovered)) {
                  return isDark 
                      ? Colors.white.withValues(alpha: 0.05) 
                      : Colors.grey.withValues(alpha: 0.05);
                }
                return null;
              }),
              columnSpacing: 24,
              horizontalMargin: 20,
              headingRowHeight: 56,
              dataRowMinHeight: 60,
              dataRowMaxHeight: 72,
              showCheckboxColumn: true,
              columns: [
                DataColumn(
                  label: Text(
                    'Category',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                ),
                DataColumn(
                  label: Text(
                    'Level',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                ),
                DataColumn(
                  label: Text(
                    'Parent',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                ),
                DataColumn(
                  label: Text(
                    'Products',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  numeric: true,
                ),
                DataColumn(
                  label: Text(
                    'Status',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                ),
                DataColumn(
                  label: Text(
                    'Actions',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                ),
              ],
              rows: categories.map((category) {
                final isSelected = selectedIds.contains(category.id);
                final parentName = _getParentName(category.parentId);
                
                return DataRow(
                  selected: isSelected,
                  onSelectChanged: (selected) {
                    HapticFeedback.selectionClick();
                    onSelect(category.id);
                  },
                  cells: [
                    // Category Name with Icon
                    DataCell(
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // Icon/Image
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: category.iconImageUrl?.isNotEmpty == true
                                ? ClipRRect(
                                    borderRadius: BorderRadius.circular(8),
                                    child: Image.network(
                                      category.iconImageUrl!,
                                      fit: BoxFit.cover,
                                      errorBuilder: (_, __, ___) => Icon(
                                        Icons.category_rounded,
                                        color: AppColors.primary,
                                        size: 20,
                                      ),
                                    ),
                                  )
                                : Icon(
                                    Icons.category_rounded,
                                    color: AppColors.primary,
                                    size: 20,
                                  ),
                          ),
                          const SizedBox(width: 12),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                category.name,
                                style: TextStyle(
                                  color: isDark ? Colors.white : Colors.black87,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              if (category.description.isNotEmpty)
                                Text(
                                  category.description.length > 30
                                      ? '${category.description.substring(0, 30)}...'
                                      : category.description,
                                  style: TextStyle(
                                    color: isDark ? Colors.grey[500] : Colors.grey[600],
                                    fontSize: 11,
                                  ),
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    // Level
                    DataCell(
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: _getLevelColor(category.level).withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          'Level ${category.level}',
                          style: TextStyle(
                            color: _getLevelColor(category.level),
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                    // Parent
                    DataCell(
                      Text(
                        parentName ?? '—',
                        style: TextStyle(
                          color: isDark ? Colors.grey[400] : Colors.grey[600],
                          fontStyle: parentName == null ? FontStyle.italic : FontStyle.normal,
                        ),
                      ),
                    ),
                    // Products Count
                    DataCell(
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: category.productCount > 0 
                              ? Colors.teal.withValues(alpha: 0.1) 
                              : Colors.orange.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          '${category.productCount}',
                          style: TextStyle(
                            color: category.productCount > 0 ? Colors.teal : Colors.orange,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                    // Status
                    DataCell(
                      GestureDetector(
                        onTap: () => onToggleStatus(category, !category.isActive),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: category.isActive 
                                ? Colors.green.withValues(alpha: 0.1) 
                                : Colors.red.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                category.isActive 
                                    ? Icons.check_circle_rounded 
                                    : Icons.cancel_rounded,
                                size: 14,
                                color: category.isActive ? Colors.green : Colors.red,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                category.isActive ? 'Active' : 'Inactive',
                                style: TextStyle(
                                  color: category.isActive ? Colors.green : Colors.red,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    // Actions
                    DataCell(
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: Icon(
                              Icons.edit_rounded,
                              size: 18,
                              color: isDark ? Colors.grey[400] : Colors.grey[600],
                            ),
                            tooltip: 'Edit',
                            onPressed: () => onEdit(category),
                          ),
                          IconButton(
                            icon: Icon(
                              Icons.add_circle_outline_rounded,
                              size: 18,
                              color: AppColors.primary,
                            ),
                            tooltip: 'Add Child',
                            onPressed: () => onAddChild(category),
                          ),
                          IconButton(
                            icon: Icon(
                              Icons.delete_rounded,
                              size: 18,
                              color: Colors.red.withValues(alpha: 0.7),
                            ),
                            tooltip: 'Delete',
                            onPressed: () => onDelete(category),
                          ),
                        ],
                      ),
                    ),
                  ],
                );
              }).toList(),
            ),
          ),
        ),
      ),
    );
  }

  String? _getParentName(String? parentId) {
    if (parentId == null) return null;
    final parent = categories.firstWhere(
      (c) => c.id == parentId,
      orElse: () => categories.first,
    );
    return parent.id == parentId ? parent.name : null;
  }

  Color _getLevelColor(int level) {
    switch (level) {
      case 0:
        return Colors.purple;
      case 1:
        return Colors.blue;
      case 2:
        return Colors.cyan;
      default:
        return Colors.teal;
    }
  }
}
