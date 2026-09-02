// lib/screens/products/widgets/admin_category_card.dart
// Compact Admin Category Card with Glassmorphic Design
// Professional, compact styling for category management

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

/// Admin Category Card Widget - Compact Professional Design
class AdminCategoryCard extends StatefulWidget {
  final CategoryModel category;
  final int level;
  final bool isDark;
  final bool isSelected;
  final bool showSelectionCheckbox;
  final VoidCallback? onTap;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;
  final VoidCallback? onAddChild;
  final Function(bool)? onToggleStatus;
  final VoidCallback? onSelectionToggle;
  final bool hasChildren;
  final bool isExpanded;
  final VoidCallback? onToggleExpand;

  const AdminCategoryCard({
    super.key,
    required this.category,
    required this.level,
    required this.isDark,
    this.isSelected = false,
    this.showSelectionCheckbox = false,
    this.onTap,
    this.onEdit,
    this.onDelete,
    this.onAddChild,
    this.onToggleStatus,
    this.onSelectionToggle,
    this.hasChildren = false,
    this.isExpanded = false,
    this.onToggleExpand,
  });

  @override
  State<AdminCategoryCard> createState() => _AdminCategoryCardState();
}

class _AdminCategoryCardState extends State<AdminCategoryCard> {
  CategoryModel get category => widget.category;

  @override
  Widget build(BuildContext context) {
    final levelColor = _getLevelColor();
    
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        boxShadow: [
          BoxShadow(
            color: widget.isDark 
                ? Colors.black.withValues(alpha: 0.2) 
                : Colors.black.withValues(alpha: 0.05),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 4, sigmaY: 4),
          child: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: widget.isDark
                    ? [Colors.white.withValues(alpha: 0.06), Colors.white.withValues(alpha: 0.03)]
                    : [Colors.white.withValues(alpha: 0.95), Colors.white.withValues(alpha: 0.88)],
              ),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: widget.isSelected
                    ? AppColors.primary
                    : (widget.isDark ? Colors.white.withValues(alpha: 0.06) : Colors.grey.shade200),
                width: widget.isSelected ? 1.5 : 0.5,
              ),
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: widget.onTap,
                onLongPress: () {
                  HapticFeedback.mediumImpact();
                  _showQuickActionsMenu(context);
                },
                borderRadius: BorderRadius.circular(10),
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: Row(
                    children: [
                      // Expand/Collapse
                      if (widget.hasChildren)
                        GestureDetector(
                          onTap: () {
                            HapticFeedback.lightImpact();
                            widget.onToggleExpand?.call();
                          },
                          child: AnimatedRotation(
                            turns: widget.isExpanded ? 0.25 : 0,
                            duration: const Duration(milliseconds: 150),
                            child: Icon(
                              Icons.chevron_right_rounded,
                              size: 18,
                              color: widget.isDark ? Colors.white54 : Colors.grey[600],
                            ),
                          ),
                        )
                      else
                        const SizedBox(width: 18),
                      const SizedBox(width: 8),
                      
                      // Category Icon
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: levelColor.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: category.iconImageUrl != null && category.iconImageUrl!.isNotEmpty
                              ? CachedNetworkImage(
                                  imageUrl: category.iconImageUrl!,
                                  fit: BoxFit.cover,
                                  placeholder: (_, __) => _buildIconPlaceholder(levelColor),
                                  errorWidget: (_, __, ___) => _buildIconPlaceholder(levelColor),
                                )
                              : _buildIconPlaceholder(levelColor),
                        ),
                      ),
                      const SizedBox(width: 10),
                      
                      // Name + Description
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    category.name,
                                    style: TextStyle(
                                      color: widget.isDark ? Colors.white : Colors.black87,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 13,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                _buildLevelBadge(levelColor),
                              ],
                            ),
                            if (category.description.isNotEmpty) ...[
                              const SizedBox(height: 2),
                              Text(
                                category.description,
                                style: TextStyle(
                                  color: widget.isDark ? Colors.white38 : Colors.grey[500],
                                  fontSize: 10,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      
                      // Stats
                      _buildCompactStats(),
                      const SizedBox(width: 8),
                      
                      // Status Dot
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: category.isActive ? const Color(0xFF10B981) : Colors.grey,
                          shape: BoxShape.circle,
                          boxShadow: category.isActive
                              ? [BoxShadow(color: const Color(0xFF10B981).withValues(alpha: 0.4), blurRadius: 4)]
                              : null,
                        ),
                      ),
                      const SizedBox(width: 6),
                      
                      // Quick Actions
                      _buildQuickActions(),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildIconPlaceholder(Color levelColor) {
    return Center(
      child: Icon(Icons.category_rounded, size: 18, color: levelColor),
    );
  }

  Widget _buildLevelBadge(Color levelColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        color: levelColor.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        'L${widget.level + 1}',
        style: TextStyle(
          color: levelColor,
          fontWeight: FontWeight.w700,
          fontSize: 9,
        ),
      ),
    );
  }

  Widget _buildCompactStats() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Products
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
          decoration: BoxDecoration(
            color: const Color(0xFF10B981).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.inventory_2_outlined, size: 10, color: Color(0xFF10B981)),
              const SizedBox(width: 3),
              Text(
                '${category.productCount}',
                style: const TextStyle(
                  color: Color(0xFF10B981),
                  fontWeight: FontWeight.w600,
                  fontSize: 10,
                ),
              ),
            ],
          ),
        ),
        if (widget.hasChildren) ...[
          const SizedBox(width: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
            decoration: BoxDecoration(
              color: Colors.purple.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Icon(Icons.account_tree_rounded, size: 10, color: Colors.purple[400]),
          ),
        ],
      ],
    );
  }

  Widget _buildQuickActions() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _buildMiniAction(Icons.edit_outlined, const Color(0xFF3B82F6), widget.onEdit),
        const SizedBox(width: 4),
        _buildMiniAction(Icons.add, const Color(0xFF10B981), widget.onAddChild),
        const SizedBox(width: 4),
        _buildMiniAction(Icons.delete_outline, const Color(0xFFEF4444), widget.onDelete),
      ],
    );
  }

  Widget _buildMiniAction(IconData icon, Color color, VoidCallback? onTap) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap?.call();
      },
      child: Container(
        padding: const EdgeInsets.all(5),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(5),
        ),
        child: Icon(icon, size: 12, color: color),
      ),
    );
  }

  void _showQuickActionsMenu(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: widget.isDark ? const Color(0xFF1E1E2E) : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: 32, height: 3, decoration: BoxDecoration(color: Colors.grey.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 16),
            Text('Quick Actions', style: TextStyle(color: widget.isDark ? Colors.white : Colors.black87, fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            _buildMenuAction(Icons.edit_outlined, 'Edit', () { Navigator.pop(context); widget.onEdit?.call(); }),
            _buildMenuAction(Icons.add_rounded, 'Add Subcategory', () { Navigator.pop(context); widget.onAddChild?.call(); }),
            _buildMenuAction(
              category.isActive ? Icons.visibility_off_outlined : Icons.visibility_outlined,
              category.isActive ? 'Deactivate' : 'Activate',
              () { Navigator.pop(context); widget.onToggleStatus?.call(!category.isActive); },
            ),
            _buildMenuAction(Icons.delete_outline, 'Delete', () { Navigator.pop(context); widget.onDelete?.call(); }, color: const Color(0xFFEF4444)),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Widget _buildMenuAction(IconData icon, String label, VoidCallback onTap, {Color? color}) {
    return ListTile(
      dense: true,
      leading: Icon(icon, color: color ?? (widget.isDark ? Colors.white54 : Colors.grey[600]), size: 20),
      title: Text(label, style: TextStyle(color: color ?? (widget.isDark ? Colors.white : Colors.black87), fontWeight: FontWeight.w500, fontSize: 14)),
      onTap: () { HapticFeedback.lightImpact(); onTap(); },
    );
  }

  Color _getLevelColor() {
    switch (widget.level) {
      case 0: return const Color(0xFF2196F3);
      case 1: return const Color(0xFF03A9F4);
      case 2: return const Color(0xFF00BCD4);
      default: return const Color(0xFF009688);
    }
  }
}
