// lib/screens/products/widgets/category_detail_panel.dart
// Compact Desktop Detail Panel for Selected Category
// Professional compact styling with glassmorphic design

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'icon_picker_helper.dart';
import 'category_tree_widget.dart';

class CategoryDetailPanel extends StatelessWidget {
  final CategoryNode node;
  final bool isDark;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onAddChild;
  final void Function(bool) onToggleStatus;

  const CategoryDetailPanel({
    super.key,
    required this.node,
    required this.isDark,
    required this.onEdit,
    required this.onDelete,
    required this.onAddChild,
    required this.onToggleStatus,
  });

  @override
  Widget build(BuildContext context) {
    final category = node.category;
    final levelColor = _getLevelColor(node.level);

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isDark
              ? [const Color(0xFF0D0D0D), const Color(0xFF151515)]
              : [Colors.grey.shade50, Colors.white],
        ),
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // HEADER ROW
            _buildHeader(category, levelColor),
            const SizedBox(height: 14),

            // STATS ROW (horizontal)
            _buildStatsRow(category),
            const SizedBox(height: 14),

            // INFO CARD
            _buildInfoCard(category),
            const SizedBox(height: 14),

            // STATUS TOGGLE
            _buildStatusRow(category),
            const SizedBox(height: 14),

            // SUBCATEGORIES
            if (node.hasChildren) ...[
              _buildSubcategoriesRow(),
              const SizedBox(height: 14),
            ],

            // ACTION BUTTONS
            _buildActionRow(),
          ],
        ).animate().fadeIn(duration: 200.ms),
      ),
    );
  }

  Widget _buildHeader(CategoryModel category, Color levelColor) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 5, sigmaY: 5),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [levelColor.withValues(alpha: 0.15), levelColor.withValues(alpha: 0.05)],
            ),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: levelColor.withValues(alpha: 0.2)),
          ),
          child: Row(
            children: [
              // Icon
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: levelColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: levelColor.withValues(alpha: 0.3)),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: (category.iconImageUrl != null && category.iconImageUrl!.isNotEmpty)
                      ? CachedNetworkImage(
                          imageUrl: category.iconImageUrl!,
                          fit: BoxFit.cover,
                          placeholder: (_, __) => _iconPlaceholder(levelColor),
                          errorWidget: (_, __, ___) => _iconPlaceholder(levelColor),
                        )
                      : _iconPlaceholder(levelColor),
                ),
              ),
              const SizedBox(width: 12),
              // Name + Badges
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      category.name,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        _badge('L${node.level + 1}', levelColor),
                        const SizedBox(width: 6),
                        _statusBadge(category.isActive),
                        if (node.hasChildren) ...[
                          const SizedBox(width: 6),
                          _badge('${node.children.length} sub', Colors.purple),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _iconPlaceholder(Color color) {
    return Center(child: Icon(IconPickerHelper.getIcon(node.category.iconName), size: 22, color: color));
  }

  Widget _badge(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(text, style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 10)),
    );
  }

  Widget _statusBadge(bool isActive) {
    final color = isActive ? const Color(0xFF10B981) : Colors.grey;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 5, height: 5, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 4),
          Text(isActive ? 'Active' : 'Inactive', style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 10)),
        ],
      ),
    );
  }

  Widget _buildStatsRow(CategoryModel category) {
    return Row(
      children: [
        Expanded(child: _statCard(Icons.inventory_2_rounded, '${category.productCount}', 'Products', const Color(0xFF10B981))),
        const SizedBox(width: 8),
        Expanded(child: _statCard(Icons.visibility_rounded, '1.3K', 'Views', const Color(0xFF3B82F6))),
        const SizedBox(width: 8),
        Expanded(child: _statCard(Icons.account_tree_rounded, '${node.children.length}', 'Subcats', const Color(0xFF8B5CF6))),
        const SizedBox(width: 8),
        Expanded(child: _statCard(Icons.swap_vert_rounded, '#${category.displayOrder}', 'Order', const Color(0xFFF59E0B))),
      ],
    );
  }

  Widget _statCard(IconData icon, String value, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.04) : Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.15)),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 16),
          const SizedBox(height: 4),
          Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: isDark ? Colors.white : Colors.black87)),
          Text(label, style: TextStyle(fontSize: 9, color: isDark ? Colors.white54 : Colors.grey[600])),
        ],
      ),
    );
  }

  Widget _buildInfoCard(CategoryModel category) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.04) : Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: isDark ? Colors.white10 : Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle(Icons.info_rounded, 'Details'),
          const SizedBox(height: 10),
          if (category.description.isNotEmpty) ...[
            Text(
              category.description,
              style: TextStyle(fontSize: 12, color: isDark ? Colors.white70 : Colors.grey[700], height: 1.4),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 10),
          ],
          _infoRow('ID', category.id, isMono: true),
          _infoRow('Created', _formatDate(category.createdAt)),
          _infoRow('Parent', category.parentId != null ? 'Has parent' : 'Root'),
        ],
      ),
    );
  }

  Widget _sectionTitle(IconData icon, String title) {
    return Row(
      children: [
        Icon(icon, size: 14, color: AppColors.primary),
        const SizedBox(width: 6),
        Text(title, style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: isDark ? Colors.white : Colors.black87)),
      ],
    );
  }

  Widget _infoRow(String label, String value, {bool isMono = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          SizedBox(width: 60, child: Text(label, style: TextStyle(fontSize: 11, color: isDark ? Colors.white38 : Colors.grey[500]))),
          Expanded(
            child: Text(
              value,
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: isDark ? Colors.white70 : Colors.black87, fontFamily: isMono ? 'monospace' : null),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (isMono)
            GestureDetector(
              onTap: () { Clipboard.setData(ClipboardData(text: value)); HapticFeedback.lightImpact(); },
              child: Icon(Icons.copy_rounded, size: 12, color: isDark ? Colors.white24 : Colors.grey[400]),
            ),
        ],
      ),
    );
  }

  Widget _buildStatusRow(CategoryModel category) {
    final isActive = category.isActive;
    final color = isActive ? const Color(0xFF10B981) : Colors.grey;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.15)),
      ),
      child: Row(
        children: [
          Icon(isActive ? Icons.check_circle_rounded : Icons.pause_circle_rounded, color: color, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              isActive ? 'Category Active' : 'Category Inactive',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: color),
            ),
          ),
          Transform.scale(
            scale: 0.8,
            child: Switch(value: isActive, onChanged: onToggleStatus, activeThumbColor: const Color(0xFF10B981)),
          ),
        ],
      ),
    );
  }

  Widget _buildSubcategoriesRow() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.04) : Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: isDark ? Colors.white10 : Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle(Icons.account_tree_rounded, 'Subcategories (${node.children.length})'),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: node.children.map((child) {
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.grey[100],
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(IconPickerHelper.getIcon(child.category.iconName), size: 11, color: AppColors.primary),
                    const SizedBox(width: 5),
                    Text(child.category.name, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: isDark ? Colors.white70 : Colors.black87)),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildActionRow() {
    return Row(
      children: [
        Expanded(child: _actionBtn(Icons.add_circle_rounded, 'Add Sub', const Color(0xFF10B981), onAddChild, false)),
        const SizedBox(width: 8),
        Expanded(child: _actionBtn(Icons.edit_rounded, 'Edit', AppColors.primary, onEdit, true)),
        const SizedBox(width: 8),
        _actionBtn(Icons.delete_rounded, '', const Color(0xFFEF4444), node.hasChildren ? null : onDelete, false, isSmall: true),
      ],
    );
  }

  Widget _actionBtn(IconData icon, String label, Color color, VoidCallback? onTap, bool isPrimary, {bool isSmall = false}) {
    final isDisabled = onTap == null;
    return GestureDetector(
      onTap: isDisabled ? null : () { HapticFeedback.lightImpact(); onTap(); },
      child: Container(
        padding: EdgeInsets.symmetric(vertical: isSmall ? 10 : 12, horizontal: isSmall ? 12 : 8),
        decoration: BoxDecoration(
          color: isPrimary ? color : (isDisabled ? Colors.grey.withValues(alpha: 0.1) : color.withValues(alpha: 0.1)),
          borderRadius: BorderRadius.circular(8),
          border: isPrimary ? null : Border.all(color: isDisabled ? Colors.grey.withValues(alpha: 0.15) : color.withValues(alpha: 0.2)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 14, color: isPrimary ? Colors.white : (isDisabled ? Colors.grey : color)),
            if (label.isNotEmpty) ...[
              const SizedBox(width: 5),
              Text(label, style: TextStyle(color: isPrimary ? Colors.white : (isDisabled ? Colors.grey : color), fontWeight: FontWeight.w600, fontSize: 11)),
            ],
          ],
        ),
      ),
    );
  }

  Color _getLevelColor(int level) {
    switch (level) {
      case 0: return const Color(0xFF2196F3);
      case 1: return const Color(0xFF03A9F4);
      case 2: return const Color(0xFF00BCD4);
      default: return const Color(0xFF009688);
    }
  }

  String _formatDate(DateTime date) {
    final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${months[date.month - 1]} ${date.day}, ${date.year}';
  }
}
