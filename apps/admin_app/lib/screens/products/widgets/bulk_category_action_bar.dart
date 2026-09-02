// lib/screens/products/widgets/bulk_category_action_bar.dart
// Animated Bulk Action Bar for Category Management

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:ui';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

/// Bulk Category Action Bar Widget
class BulkCategoryActionBar extends StatelessWidget {
  final int selectedCount;
  final bool isDark;
  final VoidCallback onClearSelection;
  final VoidCallback onSelectAll;
  final VoidCallback onActivate;
  final VoidCallback onDeactivate;
  final VoidCallback onDelete;
  final VoidCallback? onExport;

  const BulkCategoryActionBar({
    super.key,
    required this.selectedCount,
    required this.isDark,
    required this.onClearSelection,
    required this.onSelectAll,
    required this.onActivate,
    required this.onDeactivate,
    required this.onDelete,
    this.onExport,
  });

  @override
  Widget build(BuildContext context) {
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: ClipRRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Container(
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 16,
              bottom: MediaQuery.of(context).padding.bottom + 16,
            ),
            decoration: BoxDecoration(
              color: isDark 
                  ? const Color(0xFF0D0D16).withValues(alpha: 0.95) 
                  : Colors.white.withValues(alpha: 0.95),
              border: Border(
                top: BorderSide(
                  color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.shade200,
                ),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.15),
                  blurRadius: 20,
                  offset: const Offset(0, -5),
                ),
              ],
            ),
            child: Row(
              children: [
                // Selection Info
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.check_circle_rounded,
                        size: 16,
                        color: AppColors.primary,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '$selectedCount selected',
                        style: TextStyle(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                
                // Clear Selection
                IconButton(
                  onPressed: () {
                    HapticFeedback.lightImpact();
                    onClearSelection();
                  },
                  icon: Icon(
                    Icons.close_rounded,
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                    size: 20,
                  ),
                  tooltip: 'Clear selection',
                ),
                
                // Select All
                TextButton.icon(
                  onPressed: () {
                    HapticFeedback.lightImpact();
                    onSelectAll();
                  },
                  icon: Icon(
                    Icons.select_all_rounded,
                    size: 18,
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                  ),
                  label: Text(
                    'All',
                    style: TextStyle(
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                      fontSize: 12,
                    ),
                  ),
                ),
                
                const Spacer(),
                
                // Action Buttons
                _buildActionButton(
                  icon: Icons.check_circle_outline_rounded,
                  label: 'Activate',
                  color: Colors.green,
                  onTap: () {
                    HapticFeedback.mediumImpact();
                    onActivate();
                  },
                ),
                const SizedBox(width: 8),
                
                _buildActionButton(
                  icon: Icons.cancel_outlined,
                  label: 'Deactivate',
                  color: Colors.orange,
                  onTap: () {
                    HapticFeedback.mediumImpact();
                    onDeactivate();
                  },
                ),
                const SizedBox(width: 8),
                
                if (onExport != null) ...[
                  _buildActionButton(
                    icon: Icons.download_rounded,
                    label: 'Export',
                    color: Colors.blue,
                    onTap: () {
                      HapticFeedback.mediumImpact();
                      onExport!();
                    },
                  ),
                  const SizedBox(width: 8),
                ],
                
                _buildActionButton(
                  icon: Icons.delete_outline_rounded,
                  label: 'Delete',
                  color: Colors.red,
                  onTap: () {
                    HapticFeedback.heavyImpact();
                    onDelete();
                  },
                  isDangerous: true,
                ),
              ],
            ),
          ),
        ),
      ),
    ).animate().slideY(begin: 1, end: 0, duration: 300.ms, curve: Curves.easeOutCubic);
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
    bool isDangerous = false,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: isDangerous ? 0.15 : 0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: color.withValues(alpha: 0.3),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Shows the bulk action bar with animation
class BulkCategoryActionBarWrapper extends StatelessWidget {
  final bool isVisible;
  final int selectedCount;
  final bool isDark;
  final VoidCallback onClearSelection;
  final VoidCallback onSelectAll;
  final VoidCallback onActivate;
  final VoidCallback onDeactivate;
  final VoidCallback onDelete;
  final VoidCallback? onExport;

  const BulkCategoryActionBarWrapper({
    super.key,
    required this.isVisible,
    required this.selectedCount,
    required this.isDark,
    required this.onClearSelection,
    required this.onSelectAll,
    required this.onActivate,
    required this.onDeactivate,
    required this.onDelete,
    this.onExport,
  });

  @override
  Widget build(BuildContext context) {
    if (!isVisible) return const SizedBox.shrink();
    
    return BulkCategoryActionBar(
      selectedCount: selectedCount,
      isDark: isDark,
      onClearSelection: onClearSelection,
      onSelectAll: onSelectAll,
      onActivate: onActivate,
      onDeactivate: onDeactivate,
      onDelete: onDelete,
      onExport: onExport,
    );
  }
}
