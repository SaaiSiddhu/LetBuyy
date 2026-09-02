// lib/screens/products/widgets/category_tree_widget.dart
// Reusable tree view component for categories with premium styling

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'icon_picker_helper.dart';
import 'admin_category_card.dart';

/// Node class to manage tree structure
class CategoryNode {
  final CategoryModel category;
  final int level;
  List<CategoryNode> children = [];
  bool isExpanded = false;

  CategoryNode({required this.category, this.level = 0});

  bool get hasChildren => children.isNotEmpty;
}

/// Callback types for tree actions
typedef OnCategorySelected = void Function(CategoryNode node);
typedef OnCategoryAction = void Function(CategoryNode node, CategoryAction action);

enum CategoryAction { edit, delete, addChild, toggleStatus }

class CategoryTreeWidget extends StatefulWidget {
  final List<CategoryModel> categories;
  final CategoryNode? selectedNode;
  final OnCategorySelected? onNodeSelected;
  final OnCategoryAction? onAction;
  final bool isDark;
  final bool showActions;
  final bool isCompact;
  final bool showFlat; // When true, show as flat list with level indentation
  final bool useCardStyle; // When true, use AdminCategoryCard premium design

  const CategoryTreeWidget({
    super.key,
    required this.categories,
    this.selectedNode,
    this.onNodeSelected,
    this.onAction,
    required this.isDark,
    this.showActions = true,
    this.isCompact = false,
    this.showFlat = false,
    this.useCardStyle = false,
  });

  @override
  State<CategoryTreeWidget> createState() => _CategoryTreeWidgetState();
}

class _CategoryTreeWidgetState extends State<CategoryTreeWidget> {
  List<CategoryNode> _rootNodes = [];
  List<CategoryNode> _visibleNodes = [];
  bool _isTreeBuilt = false;

  @override
  void initState() {
    super.initState();
    _buildTree();
  }

  @override
  void didUpdateWidget(CategoryTreeWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.categories != widget.categories || 
        oldWidget.showFlat != widget.showFlat) {
      _buildTree();
    }
  }

  void _buildTree() {
    // If showFlat mode, display all categories in a flat list preserving their level info
    if (widget.showFlat) {
      _rootNodes = [];
      _visibleNodes = widget.categories
          .map((cat) => CategoryNode(category: cat, level: cat.level))
          .toList();
      setState(() => _isTreeBuilt = true);
      return;
    }

    // Normal hierarchical tree building
    Map<String?, List<CategoryModel>> categoriesByParentId = {};

    for (var cat in widget.categories) {
      categoriesByParentId.putIfAbsent(cat.parentId, () => []).add(cat);
    }

    categoriesByParentId.forEach((key, value) {
      value.sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
    });

    List<CategoryNode> buildNodes(String? parentId, int level) {
      final children = categoriesByParentId[parentId] ?? [];
      return children.map((cat) {
        final node = CategoryNode(category: cat, level: level);
        node.children = buildNodes(cat.id, level + 1);
        return node;
      }).toList();
    }

    _rootNodes = buildNodes(null, 0);
    
    // Also handle orphaned categories (whose parents aren't in the list)
    final includedIds = <String>{};
    void collectIds(List<CategoryNode> nodes) {
      for (var n in nodes) {
        includedIds.add(n.category.id);
        collectIds(n.children);
      }
    }
    collectIds(_rootNodes);
    
    // Add any orphans as root nodes
    for (var cat in widget.categories) {
      if (!includedIds.contains(cat.id)) {
        _rootNodes.add(CategoryNode(category: cat, level: cat.level));
      }
    }
    
    _rebuildVisibleList();
    setState(() => _isTreeBuilt = true);
  }

  void _rebuildVisibleList() {
    _visibleNodes.clear();
    void flatten(List<CategoryNode> nodes) {
      for (var node in nodes) {
        _visibleNodes.add(node);
        if (node.isExpanded) {
          flatten(node.children);
        }
      }
    }
    flatten(_rootNodes);
  }

  void _toggleNode(CategoryNode node) {
    setState(() {
      node.isExpanded = !node.isExpanded;
      _rebuildVisibleList();
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_isTreeBuilt) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_visibleNodes.isEmpty) {
      return _buildEmptyState();
    }

    return ListView.builder(
      padding: EdgeInsets.all(widget.isCompact ? 8 : 12),
      itemCount: _visibleNodes.length,
      itemBuilder: (context, index) {
        final node = _visibleNodes[index];
        return _buildNodeCard(node, index);
      },
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: widget.isDark 
                  ? Colors.white.withValues(alpha: 0.05) 
                  : Colors.grey[100],
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.category_outlined,
              size: 64,
              color: widget.isDark ? Colors.white24 : Colors.grey[400],
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'No Categories',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: widget.isDark ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Add your first category to get started',
            style: TextStyle(color: Colors.grey[600]),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 400.ms);
  }

  Widget _buildNodeCard(CategoryNode node, int index) {
    final category = node.category;
    final isSelected = widget.selectedNode?.category.id == category.id;
    final accentColor = widget.isDark ? AppColors.primaryLight : AppColors.primary;

    // Use new card style if enabled
    if (widget.useCardStyle && !widget.isCompact) {
      return Padding(
        padding: EdgeInsets.only(
          left: node.level * 20.0,
          bottom: 8,
        ),
        child: AdminCategoryCard(
          category: category,
          level: node.level,
          isDark: widget.isDark,
          isSelected: isSelected,
          hasChildren: node.hasChildren,
          isExpanded: node.isExpanded,
          onToggleExpand: () => _toggleNode(node),
          onTap: () => widget.onNodeSelected?.call(node),
          onEdit: () => widget.onAction?.call(node, CategoryAction.edit),
          onDelete: () => widget.onAction?.call(node, CategoryAction.delete),
          onAddChild: () => widget.onAction?.call(node, CategoryAction.addChild),
          onToggleStatus: (isActive) => widget.onAction?.call(node, CategoryAction.toggleStatus),
        ),
      ).animate(key: ValueKey(category.id))
          .fadeIn(duration: 300.ms, delay: (index * 30).ms)
          .slideX(begin: 0.03, end: 0);
    }

    // Original tree node style
    return Padding(
      padding: EdgeInsets.only(
        left: node.level * (widget.isCompact ? 16.0 : 24.0),
        bottom: widget.isCompact ? 6 : 10,
      ),
      child: InkWell(
        onTap: () => widget.onNodeSelected?.call(node),
        onLongPress: widget.showActions && !widget.isCompact
            ? () => _showActionsSheet(node)
            : null,
        borderRadius: BorderRadius.circular(12),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          decoration: BoxDecoration(
            color: isSelected
                ? accentColor.withValues(alpha: 0.1)
                : widget.isDark
                    ? Colors.white.withValues(alpha: 0.05)
                    : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected
                  ? accentColor
                  : widget.isDark
                      ? Colors.white10
                      : Colors.grey.shade200,
              width: isSelected ? 2 : 1,
            ),
            boxShadow: [
              if (!widget.isDark)
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
            ],
          ),
          child: widget.isCompact
              ? _buildCompactContent(node, category, accentColor)
              : _buildFullContent(node, category, accentColor),
        ),
      ),
    ).animate(key: ValueKey(category.id))
        .fadeIn(duration: 300.ms, delay: (index * 30).ms)
        .slideX(begin: 0.05, end: 0);
  }

  Widget _buildCompactContent(CategoryNode node, CategoryModel category, Color accentColor) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          // Expand button
          if (node.hasChildren)
            GestureDetector(
              onTap: () => _toggleNode(node),
              child: Icon(
                node.isExpanded ? Icons.expand_more : Icons.chevron_right,
                size: 20,
                color: widget.isDark ? Colors.white54 : Colors.grey[600],
              ),
            )
          else
            const SizedBox(width: 20),
          const SizedBox(width: 8),
          // Icon
          _buildCategoryIcon(category, 18, accentColor),
          const SizedBox(width: 10),
          // Name
          Expanded(
            child: Text(
              category.name,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: widget.isDark ? Colors.white : Colors.black87,
                fontSize: 14,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          // Status dot
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: category.isActive ? AppColors.success : AppColors.warning,
              shape: BoxShape.circle,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFullContent(CategoryNode node, CategoryModel category, Color accentColor) {
    return Padding(
      padding: const EdgeInsets.all(14),
      child: Column(
        children: [
          Row(
            children: [
              // Expand button
              SizedBox(
                width: 36,
                height: 36,
                child: node.hasChildren
                    ? IconButton(
                        padding: EdgeInsets.zero,
                        icon: Icon(
                          node.isExpanded
                              ? Icons.expand_more_rounded
                              : Icons.chevron_right_rounded,
                          color: widget.isDark
                              ? Colors.white54
                              : Colors.grey[600],
                        ),
                        onPressed: () => _toggleNode(node),
                      )
                    : null,
              ),
              // Icon
              _buildCategoryIcon(category, 24, accentColor),
              const SizedBox(width: 12),
              // Info
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
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: widget.isDark ? Colors.white : Colors.black87,
                            ),
                          ),
                        ),
                        _buildStatusBadge(category.isActive),
                      ],
                    ),
                    if (category.description.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        category.description,
                        style: TextStyle(
                          fontSize: 12,
                          color: widget.isDark ? Colors.white54 : Colors.grey[600],
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          // Actions row
          if (widget.showActions) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.only(left: 36, top: 8),
              decoration: BoxDecoration(
                border: Border(
                  top: BorderSide(
                    color: widget.isDark ? Colors.white10 : Colors.grey.shade200,
                  ),
                ),
              ),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildMetaChip(Icons.inventory_2_outlined, '${category.productCount}'),
                    const SizedBox(width: 8),
                    if (node.hasChildren)
                      _buildMetaChip(Icons.subdirectory_arrow_right, '${node.children.length}'),
                    const SizedBox(width: 16),
                    _buildActionButton(
                      Icons.add_circle_outline,
                      'Add',
                      () => widget.onAction?.call(node, CategoryAction.addChild),
                    ),
                    _buildActionButton(
                      Icons.edit_outlined,
                      'Edit',
                      () => widget.onAction?.call(node, CategoryAction.edit),
                    ),
                    _buildActionButton(
                      Icons.delete_outline,
                      'Delete',
                      () => widget.onAction?.call(node, CategoryAction.delete),
                      color: AppColors.error,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildCategoryIcon(CategoryModel category, double size, Color accentColor) {
    return CircleAvatar(
      radius: size,
      backgroundColor: accentColor.withValues(alpha: 0.1),
      backgroundImage: (category.iconImageUrl != null && category.iconImageUrl!.isNotEmpty)
          ? CachedNetworkImageProvider(category.iconImageUrl!)
          : null,
      child: (category.iconImageUrl == null || category.iconImageUrl!.isEmpty)
          ? Icon(
              IconPickerHelper.getIcon(category.iconName),
              color: accentColor,
              size: size * 0.9,
            )
          : null,
    );
  }

  Widget _buildStatusBadge(bool isActive) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: (isActive ? AppColors.success : AppColors.warning).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        isActive ? 'Active' : 'Inactive',
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: isActive ? AppColors.success : AppColors.warning,
        ),
      ),
    );
  }

  Widget _buildMetaChip(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: widget.isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[100],
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: widget.isDark ? Colors.white54 : Colors.grey[600]),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              color: widget.isDark ? Colors.white54 : Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton(IconData icon, String tooltip, VoidCallback onTap, {Color? color}) {
    final buttonColor = color ?? (widget.isDark ? Colors.white54 : Colors.grey[600]);
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(6),
        child: Padding(
          padding: const EdgeInsets.all(6),
          child: Icon(icon, size: 18, color: buttonColor),
        ),
      ),
    );
  }

  void _showActionsSheet(CategoryNode node) {
    showModalBottomSheet(
      context: context,
      backgroundColor: widget.isDark ? const Color(0xFF1A1A1A) : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: Colors.grey[400],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Text(
                node.category.name,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: widget.isDark ? Colors.white : Colors.black87,
                ),
              ),
              const SizedBox(height: 16),
              _buildSheetAction(
                Icons.add_circle_outline,
                'Add Subcategory',
                () {
                  Navigator.pop(context);
                  widget.onAction?.call(node, CategoryAction.addChild);
                },
              ),
              _buildSheetAction(
                Icons.edit_outlined,
                'Edit Category',
                () {
                  Navigator.pop(context);
                  widget.onAction?.call(node, CategoryAction.edit);
                },
              ),
              _buildSheetAction(
                node.category.isActive ? Icons.pause_circle_outline : Icons.play_circle_outline,
                node.category.isActive ? 'Deactivate' : 'Activate',
                () {
                  Navigator.pop(context);
                  widget.onAction?.call(node, CategoryAction.toggleStatus);
                },
              ),
              _buildSheetAction(
                Icons.delete_outline,
                'Delete Category',
                () {
                  Navigator.pop(context);
                  widget.onAction?.call(node, CategoryAction.delete);
                },
                isDestructive: true,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSheetAction(IconData icon, String label, VoidCallback onTap, {bool isDestructive = false}) {
    final color = isDestructive ? AppColors.error : (widget.isDark ? Colors.white : Colors.black87);
    return ListTile(
      leading: Icon(icon, color: color),
      title: Text(label, style: TextStyle(color: color)),
      onTap: onTap,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    );
  }
}
