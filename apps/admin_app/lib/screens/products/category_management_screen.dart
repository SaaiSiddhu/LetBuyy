// lib/screens/admin/products/category_management_screen.dart
// Premium responsive category management screen with professional features

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:shimmer/shimmer.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_core/letbuyy_marketplace_core.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import '../../../providers/admin_provider.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'category_attribute_management_screen.dart';
import 'widgets/category_tree_widget.dart';
import 'widgets/category_detail_panel.dart';
import 'widgets/professional_category_header.dart';
import 'widgets/smart_category_search.dart';
import 'widgets/category_table_view.dart';
import 'widgets/bulk_category_action_bar.dart';

class CategoryManagementScreen extends StatefulWidget {
  const CategoryManagementScreen({super.key});

  @override
  State<CategoryManagementScreen> createState() => _CategoryManagementScreenState();
}

class _CategoryManagementScreenState extends State<CategoryManagementScreen> {
  // Selection & View State
  CategoryNode? _selectedNode;
  bool _isTableView = false;
  bool _isSelectionMode = false;
  final Set<String> _selectedCategoryIds = {};
  
  // Search & Filter State
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  final Set<QuickCategoryFilter> _activeQuickFilters = {};
  CategorySortOption _sortOption = CategorySortOption.displayOrder;
  
  // Live Refresh State
  bool _isLiveRefreshEnabled = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<CategoryProvider>(context, listen: false).loadCategories();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  void _navigateToAddEdit({CategoryModel? category, String? parentId, required int level}) {
    // Use go_router for URL-based navigation
    // NOTE: context.go() is required (not context.push()) for routes with parentNavigatorKey
    // that navigate outside the shell to properly update the URL
    if (category != null) {
      // Edit mode - use category ID in URL
      final path = '/categories/${category.id}/edit?parentId=${parentId ?? ''}&level=$level';
      debugPrint('🔗 CATEGORY NAV: context.go to EDIT: $path');
      context.go(path, extra: category);
    } else {
      // Add mode
      final path = '/categories/new?parentId=${parentId ?? ''}&level=$level';
      debugPrint('🔗 CATEGORY NAV: context.go to NEW: $path');
      context.go(path);
    }
  }

  void _onCategoryAction(CategoryNode node, CategoryAction action) {
    switch (action) {
      case CategoryAction.edit:
        _navigateToAddEdit(
          category: node.category,
          parentId: node.category.parentId,
          level: node.level,
        );
        break;
      case CategoryAction.delete:
        _deleteCategory(node);
        break;
      case CategoryAction.addChild:
        _navigateToAddEdit(
          parentId: node.category.id,
          level: node.level + 1,
        );
        break;
      case CategoryAction.toggleStatus:
        _toggleStatus(node);
        break;
    }
  }

  Future<void> _deleteCategory(CategoryNode node) async {
    if (node.hasChildren) {
      SnackbarHelper.showError(context, 'Cannot delete category with subcategories');
      return;
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final confirm = await _showConfirmDialog(
      'Delete Category?',
      'Are you sure you want to delete "${node.category.name}"?',
      isDark,
      isDangerous: true,
    );

    if (confirm == true) {
      try {
        final adminProvider = Provider.of<AdminProvider>(context, listen: false);
        final categoryProvider = Provider.of<CategoryProvider>(context, listen: false);
        await adminProvider.deleteCategory(node.category.id);
        await categoryProvider.loadCategories();
        if (_selectedNode?.category.id == node.category.id) {
          setState(() => _selectedNode = null);
        }
        if (mounted) SnackbarHelper.showSuccess(context, 'Category deleted');
      } catch (e) {
        if (mounted) SnackbarHelper.showError(context, 'Failed to delete: $e');
      }
    }
  }

  Future<void> _toggleStatus(CategoryNode node) async {
    try {
      final adminProvider = Provider.of<AdminProvider>(context, listen: false);
      final categoryProvider = Provider.of<CategoryProvider>(context, listen: false);
      final category = node.category;
      
      await adminProvider.updateCategory(
        categoryId: category.id,
        name: category.name,
        description: category.description,
        parentId: category.parentId,
        level: category.level,
        iconName: category.iconName,
        iconImageUrl: category.iconImageUrl,
        bannerImageUrl: category.bannerImageUrl,
        displayOrder: category.displayOrder,
        isActive: !category.isActive,
      );
      await categoryProvider.loadCategories();
      if (mounted) SnackbarHelper.showSuccess(context, 'Status updated');
    } catch (e) {
      if (mounted) SnackbarHelper.showError(context, 'Failed to update: $e');
    }
  }

  Future<bool> _showConfirmDialog(String title, String message, bool isDark, {bool isDangerous = false}) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(title,
            style: TextStyle(
              color: isDangerous ? AppColors.error : (isDark ? AppColors.textLight : AppColors.textPrimary),
              fontWeight: FontWeight.bold,
            )),
        content: Text(message,
            style: TextStyle(color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: isDangerous ? AppColors.error : AppColors.primary,
              foregroundColor: Colors.white,
            ),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
    return result ?? false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FILTERING & SORTING
  // ═══════════════════════════════════════════════════════════════════════════

  List<CategoryModel> _getFilteredCategories(List<CategoryModel> categories) {
    var filtered = categories;

    // Search filter
    if (_searchQuery.isNotEmpty) {
      filtered = filtered.where((c) => 
        c.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
        c.description.toLowerCase().contains(_searchQuery.toLowerCase())
      ).toList();
    }

    // Quick filters
    for (final filter in _activeQuickFilters) {
      filtered = filtered.where((c) {
        switch (filter) {
          case QuickCategoryFilter.rootOnly:
            return c.parentId == null || c.parentId!.isEmpty;
          case QuickCategoryFilter.active:
            return c.isActive;
          case QuickCategoryFilter.inactive:
            return !c.isActive;
          case QuickCategoryFilter.hasProducts:
            return c.productCount > 0;
          case QuickCategoryFilter.empty:
            return c.productCount == 0;
          case QuickCategoryFilter.level1:
            return c.level == 1;
          case QuickCategoryFilter.level2:
            return c.level == 2;
          case QuickCategoryFilter.level3:
            return c.level >= 3;
        }
      }).toList();
    }

    // Sort
    filtered.sort((a, b) {
      switch (_sortOption) {
        case CategorySortOption.nameAsc:
          return a.name.compareTo(b.name);
        case CategorySortOption.nameDesc:
          return b.name.compareTo(a.name);
        case CategorySortOption.productCount:
          return b.productCount.compareTo(a.productCount);
        case CategorySortOption.level:
          return a.level.compareTo(b.level);
        case CategorySortOption.displayOrder:
          return a.displayOrder.compareTo(b.displayOrder);
        case CategorySortOption.newest:
          return b.createdAt.compareTo(a.createdAt);
      }
    });

    return filtered;
  }

  void _toggleQuickFilter(QuickCategoryFilter filter) {
    setState(() {
      if (_activeQuickFilters.contains(filter)) {
        _activeQuickFilters.remove(filter);
      } else {
        _activeQuickFilters.add(filter);
      }
    });
  }

  /// Returns true when filters are active that break tree hierarchy display
  bool get _hasLevelFiltersActive {
    // If ANY filter or search is active, show flat to avoid hierarchy issues
    if (_searchQuery.isNotEmpty) return true;
    if (_activeQuickFilters.isEmpty) return false;
    
    // Level filters definitely need flat display
    const levelFilters = {
      QuickCategoryFilter.level1,
      QuickCategoryFilter.level2,
      QuickCategoryFilter.level3,
    };
    
    // Any filter can potentially cause orphaned categories
    return _activeQuickFilters.isNotEmpty;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BULK ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  void _clearSelection() {
    setState(() {
      _selectedCategoryIds.clear();
      _isSelectionMode = false;
    });
  }

  void _selectAll(List<CategoryModel> categories) {
    setState(() {
      _selectedCategoryIds.addAll(categories.map((c) => c.id));
      _isSelectionMode = true;
    });
  }

  Future<void> _bulkActivate() async {
    await _bulkUpdateStatus(true);
  }

  Future<void> _bulkDeactivate() async {
    await _bulkUpdateStatus(false);
  }

  Future<void> _bulkUpdateStatus(bool isActive) async {
    final adminProvider = Provider.of<AdminProvider>(context, listen: false);
    final categoryProvider = Provider.of<CategoryProvider>(context, listen: false);
    
    try {
      for (final id in _selectedCategoryIds) {
        final category = categoryProvider.allCategories.firstWhere((c) => c.id == id);
        await adminProvider.updateCategory(
          categoryId: id,
          name: category.name,
          description: category.description,
          parentId: category.parentId,
          level: category.level,
          iconName: category.iconName,
          iconImageUrl: category.iconImageUrl,
          bannerImageUrl: category.bannerImageUrl,
          displayOrder: category.displayOrder,
          isActive: isActive,
        );
      }
      await categoryProvider.loadCategories();
      if (mounted) {
        SnackbarHelper.showSuccess(context, '${_selectedCategoryIds.length} categories ${isActive ? 'activated' : 'deactivated'}');
      }
      _clearSelection();
    } catch (e) {
      if (mounted) SnackbarHelper.showError(context, 'Failed to update: $e');
    }
  }

  Future<void> _bulkDelete() async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final confirm = await _showConfirmDialog(
      'Delete Categories?',
      'Are you sure you want to delete ${_selectedCategoryIds.length} categories?',
      isDark,
      isDangerous: true,
    );

    if (!confirm) return;

    final adminProvider = Provider.of<AdminProvider>(context, listen: false);
    final categoryProvider = Provider.of<CategoryProvider>(context, listen: false);
    
    try {
      for (final id in _selectedCategoryIds) {
        await adminProvider.deleteCategory(id);
      }
      await categoryProvider.loadCategories();
      if (mounted) {
        SnackbarHelper.showSuccess(context, '${_selectedCategoryIds.length} categories deleted');
      }
      _clearSelection();
    } catch (e) {
      if (mounted) SnackbarHelper.showError(context, 'Failed to delete: $e');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATS CALCULATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  Map<String, int> _calculateStats(List<CategoryModel> categories) {
    int total = categories.length;
    int root = categories.where((c) => c.parentId == null || c.parentId!.isEmpty).length;
    int active = categories.where((c) => c.isActive).length;
    int inactive = categories.where((c) => !c.isActive).length;
    int withProducts = categories.where((c) => c.productCount > 0).length;
    int empty = categories.where((c) => c.productCount == 0).length;
    int alerts = inactive + empty; // Categories needing attention

    return {
      'total': total,
      'root': root,
      'active': active,
      'inactive': inactive,
      'withProducts': withProducts,
      'empty': empty,
      'alerts': alerts,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILD UI
  // ═══════════════════════════════════════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;
    final width = MediaQuery.of(context).size.width;
    
    // Responsive breakpoints
    final isMobile = width < 650;
    final isDesktop = width >= 1100;

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      body: Consumer<CategoryProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading && provider.allCategories.isEmpty) {
            return _buildShimmerLoading(isDark);
          }

          final allCategories = provider.allCategories;
          final filteredCategories = _getFilteredCategories(allCategories);
          final stats = _calculateStats(allCategories);

          return Stack(
            children: [
              Column(
                children: [
                  // Professional Header
                  ProfessionalCategoryHeader(
                    isDark: isDark,
                    isLiveRefreshEnabled: _isLiveRefreshEnabled,
                    isTableView: _isTableView,
                    alertCount: stats['alerts'] ?? 0,
                    totalCount: stats['total'] ?? 0,
                    rootCount: stats['root'] ?? 0,
                    activeCount: stats['active'] ?? 0,
                    inactiveCount: stats['inactive'] ?? 0,
                    withProductsCount: stats['withProducts'] ?? 0,
                    emptyCount: stats['empty'] ?? 0,
                    onRefresh: () => provider.loadCategories(),
                    onToggleLiveRefresh: () => setState(() => _isLiveRefreshEnabled = !_isLiveRefreshEnabled),
                    onViewToggle: () => setState(() => _isTableView = !_isTableView),
                    onAlertsTapped: () => _showAlertsSheet(isDark, allCategories),
                    onAddCategory: () => _navigateToAddEdit(level: 0),
                    onManageAttributes: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const CategoryAttributeManagementScreen()),
                    ),
                  ),

                  // Smart Search Bar
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                    child: SmartCategorySearch(
                      isDark: isDark,
                      categories: allCategories,
                      activeFilters: _activeQuickFilters,
                      onSearchChanged: (val) => setState(() => _searchQuery = val),
                      onSearchSubmitted: (val) => setState(() => _searchQuery = val),
                      onFilterToggled: _toggleQuickFilter,
                      currentSort: _sortOption,
                      onSortChanged: (sort) => setState(() => _sortOption = sort),
                    ),
                  ),

                  // Content Area
                  Expanded(
                    child: _isTableView
                        ? CategoryTableView(
                            categories: filteredCategories,
                            isDark: isDark,
                            selectedIds: _selectedCategoryIds,
                            onSelect: (id) {
                              setState(() {
                                if (_selectedCategoryIds.contains(id)) {
                                  _selectedCategoryIds.remove(id);
                                  if (_selectedCategoryIds.isEmpty) _isSelectionMode = false;
                                } else {
                                  _selectedCategoryIds.add(id);
                                  _isSelectionMode = true;
                                }
                              });
                            },
                            onSelectAll: (ids) {
                              setState(() {
                                _selectedCategoryIds.addAll(ids);
                                _isSelectionMode = true;
                              });
                            },
                            onEdit: (cat) => _navigateToAddEdit(category: cat, parentId: cat.parentId, level: cat.level),
                            onDelete: (cat) {
                              final node = CategoryNode(category: cat, level: cat.level);
                              _deleteCategory(node);
                            },
                            onAddChild: (cat) => _navigateToAddEdit(parentId: cat.id, level: cat.level + 1),
                            onToggleStatus: (cat, isActive) async {
                              final adminProvider = Provider.of<AdminProvider>(context, listen: false);
                              await adminProvider.updateCategory(
                                categoryId: cat.id,
                                name: cat.name,
                                description: cat.description,
                                parentId: cat.parentId,
                                level: cat.level,
                                iconName: cat.iconName,
                                iconImageUrl: cat.iconImageUrl,
                                bannerImageUrl: cat.bannerImageUrl,
                                displayOrder: cat.displayOrder,
                                isActive: isActive,
                              );
                              provider.loadCategories();
                            },
                          )
                        : isDesktop
                            ? _buildDesktopTreeLayout(filteredCategories, provider, isDark)
                            : _buildMobileTreeLayout(filteredCategories, provider, isDark, isMobile),
                  ),
                ],
              ),

              // Bulk Action Bar
              if (_isSelectionMode)
                BulkCategoryActionBarWrapper(
                  isVisible: _isSelectionMode,
                  selectedCount: _selectedCategoryIds.length,
                  isDark: isDark,
                  onClearSelection: _clearSelection,
                  onSelectAll: () => _selectAll(filteredCategories),
                  onActivate: _bulkActivate,
                  onDeactivate: _bulkDeactivate,
                  onDelete: _bulkDelete,
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildDesktopTreeLayout(
    List<CategoryModel> categories,
    CategoryProvider provider,
    bool isDark,
  ) {
    return Row(
      children: [
        // Left Panel - Professional Category Cards
        Container(
          width: 420,
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF0A0A0A) : Colors.grey[50],
            border: Border(
              right: BorderSide(
                color: isDark ? Colors.white10 : Colors.grey.shade200,
              ),
            ),
          ),
          child: CategoryTreeWidget(
            categories: categories,
            selectedNode: _selectedNode,
            isDark: isDark,
            isCompact: false,
            showActions: true,
            showFlat: _hasLevelFiltersActive,
            useCardStyle: true, // Use professional AdminCategoryCard style
            onNodeSelected: (node) => setState(() => _selectedNode = node),
            onAction: _onCategoryAction,
          ),
        ),
        // Right Panel - Enhanced Detail
        Expanded(
          child: _selectedNode != null
              ? CategoryDetailPanel(
                  node: _selectedNode!,
                  isDark: isDark,
                  onEdit: () => _onCategoryAction(_selectedNode!, CategoryAction.edit),
                  onDelete: () => _onCategoryAction(_selectedNode!, CategoryAction.delete),
                  onAddChild: () => _onCategoryAction(_selectedNode!, CategoryAction.addChild),
                  onToggleStatus: (_) => _onCategoryAction(_selectedNode!, CategoryAction.toggleStatus),
                )
              : _buildSelectPrompt(isDark),
        ),
      ],
    );
  }

  Widget _buildMobileTreeLayout(
    List<CategoryModel> categories,
    CategoryProvider provider,
    bool isDark,
    bool isMobile,
  ) {
    return CategoryTreeWidget(
      categories: categories,
      isDark: isDark,
      showActions: true,
      showFlat: _hasLevelFiltersActive,
      useCardStyle: true, // Use professional AdminCategoryCard style
      onNodeSelected: (node) {
        if (isMobile) {
          _showMobileDetailSheet(node, isDark);
        } else {
          setState(() => _selectedNode = node);
        }
      },
      onAction: _onCategoryAction,
    );
  }

  Widget _buildSelectPrompt(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.touch_app_rounded,
              size: 48,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Select a category',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Click on a category to view details',
            style: TextStyle(
              fontSize: 14,
              color: isDark ? Colors.grey[500] : Colors.grey[600],
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 300.ms);
  }

  void _showMobileDetailSheet(CategoryNode node, bool isDark) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (_, scrollController) => Container(
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDark : AppColors.surface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: SingleChildScrollView(
            controller: scrollController,
            child: CategoryDetailPanel(
              node: node,
              isDark: isDark,
              onEdit: () {
                Navigator.pop(ctx);
                _onCategoryAction(node, CategoryAction.edit);
              },
              onDelete: () {
                Navigator.pop(ctx);
                _onCategoryAction(node, CategoryAction.delete);
              },
              onAddChild: () {
                Navigator.pop(ctx);
                _onCategoryAction(node, CategoryAction.addChild);
              },
              onToggleStatus: (_) {
                Navigator.pop(ctx);
                _onCategoryAction(node, CategoryAction.toggleStatus);
              },
            ),
          ),
        ),
      ),
    );
  }

  void _showAlertsSheet(bool isDark, List<CategoryModel> categories) {
    final inactiveCategories = categories.where((c) => !c.isActive).toList();
    final emptyCategories = categories.where((c) => c.productCount == 0).toList();

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        minChildSize: 0.4,
        maxChildSize: 0.9,
        builder: (_, scrollController) => Container(
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDark : AppColors.surface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              // Handle
              Container(
                margin: const EdgeInsets.only(top: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: isDark ? Colors.white24 : Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              // Title
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Icon(Icons.warning_amber_rounded, color: Colors.orange),
                    const SizedBox(width: 12),
                    Text(
                      'Category Alerts',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
              // Content
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (inactiveCategories.isNotEmpty) ...[
                      _buildAlertSection('Inactive Categories', inactiveCategories, Colors.grey, isDark),
                      const SizedBox(height: 16),
                    ],
                    if (emptyCategories.isNotEmpty) ...[
                      _buildAlertSection('Empty Categories', emptyCategories, Colors.orange, isDark),
                    ],
                    if (inactiveCategories.isEmpty && emptyCategories.isEmpty)
                      Center(
                        child: Padding(
                          padding: const EdgeInsets.all(32),
                          child: Column(
                            children: [
                              Icon(Icons.check_circle_rounded, size: 48, color: Colors.green),
                              const SizedBox(height: 12),
                              Text(
                                'All categories look good!',
                                style: TextStyle(
                                  fontSize: 16,
                                  color: isDark ? Colors.white : Colors.black87,
                                ),
                              ),
                            ],
                          ),
                        ),
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

  Widget _buildAlertSection(String title, List<CategoryModel> categories, Color color, bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                title,
                style: TextStyle(
                  color: color,
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '(${categories.length})',
              style: TextStyle(
                color: isDark ? Colors.grey[500] : Colors.grey[600],
                fontSize: 12,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ...categories.take(5).map((cat) => ListTile(
          dense: true,
          leading: Icon(Icons.category_rounded, color: color, size: 20),
          title: Text(
            cat.name,
            style: TextStyle(color: isDark ? Colors.white : Colors.black87),
          ),
          subtitle: Text(
            'Level ${cat.level} • ${cat.productCount} products',
            style: TextStyle(color: isDark ? Colors.grey[500] : Colors.grey[600], fontSize: 11),
          ),
          trailing: IconButton(
            icon: Icon(Icons.edit_rounded, size: 18, color: isDark ? Colors.grey[400] : Colors.grey[600]),
            onPressed: () {
              Navigator.pop(context);
              _navigateToAddEdit(category: cat, parentId: cat.parentId, level: cat.level);
            },
          ),
        )),
        if (categories.length > 5)
          TextButton(
            onPressed: () {},
            child: Text('View all ${categories.length} categories'),
          ),
      ],
    );
  }

  Widget _buildShimmerLoading(bool isDark) {
    return Shimmer.fromColors(
      baseColor: isDark ? Colors.grey.shade800 : Colors.grey.shade300,
      highlightColor: isDark ? Colors.grey.shade700 : Colors.grey.shade100,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 8,
        itemBuilder: (_, __) => Container(
          height: 80,
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    );
  }
}