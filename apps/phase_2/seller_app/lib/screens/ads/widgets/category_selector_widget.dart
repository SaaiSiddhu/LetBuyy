import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Category tree selector widget for ad campaign targeting
/// Displays hierarchical categories with breadcrumb path
class CategorySelectorWidget extends StatefulWidget {
  final String? selectedCategoryId;
  final Function(String categoryId, String categoryPath) onSelected;
  final bool showCompetition;

  const CategorySelectorWidget({
    super.key,
    this.selectedCategoryId,
    required this.onSelected,
    this.showCompetition = true,
  });

  @override
  State<CategorySelectorWidget> createState() => _CategorySelectorWidgetState();
}

class _CategorySelectorWidgetState extends State<CategorySelectorWidget> {
  // Changed to Set for multi-level expansion
  final Set<String> _expandedCategoryIds = {};
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    // Load categories when widget mounts
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CategoryProvider>().loadCategories();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Consumer<CategoryProvider>(
      builder: (context, categoryProvider, _) {
        if (categoryProvider.isLoading) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(40),
              child: CircularProgressIndicator(),
            ),
          );
        }

        final categories = categoryProvider.mainCategories;
        if (categories.isEmpty) {
          return Center(
            child: Text(
              'No categories available',
              style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600]),
            ),
          );
        }

        // Filter by search
        final filteredCategories = _searchQuery.isEmpty
            ? categories
            : categories.where((cat) => 
                cat.name.toLowerCase().contains(_searchQuery.toLowerCase())
              ).toList();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Search bar
            _buildSearchBar(isDark),
            const SizedBox(height: 16),
            
            // Selected category path
            if (widget.selectedCategoryId != null)
              _buildSelectedPath(categoryProvider, isDark),
            
            // Category tree
            ...filteredCategories.map((category) => 
              _buildCategoryTile(category, categoryProvider, isDark, 0)
            ),
          ],
        );
      },
    );
  }

  Widget _buildSearchBar(bool isDark) {
    return Container(
      decoration: BoxDecoration(
        color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1),
        ),
      ),
      child: TextField(
        controller: _searchController,
        onChanged: (value) => setState(() => _searchQuery = value),
        style: TextStyle(
          color: isDark ? Colors.white : Colors.black,
          fontSize: 14,
        ),
        decoration: InputDecoration(
          hintText: 'Search categories...',
          hintStyle: TextStyle(
            color: isDark ? Colors.grey[500] : Colors.grey[600],
            fontSize: 14,
          ),
          prefixIcon: Icon(
            Icons.search_rounded,
            color: isDark ? Colors.grey[500] : Colors.grey[600],
            size: 20,
          ),
          suffixIcon: _searchQuery.isNotEmpty
              ? IconButton(
                  icon: Icon(
                    Icons.clear_rounded,
                    color: isDark ? Colors.grey[500] : Colors.grey[600],
                    size: 18,
                  ),
                  onPressed: () {
                    _searchController.clear();
                    setState(() => _searchQuery = '');
                  },
                )
              : null,
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        ),
      ),
    );
  }

  Widget _buildSelectedPath(CategoryProvider provider, bool isDark) {
    final path = _getCategoryPath(widget.selectedCategoryId!, provider);
    
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(Icons.folder_open_rounded, size: 18, color: AppColors.primary),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              path,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.primary,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          GestureDetector(
            onTap: () => widget.onSelected('', ''),
            child: Icon(Icons.close_rounded, size: 18, color: AppColors.primary),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryTile(
    CategoryModel category,
    CategoryProvider provider,
    bool isDark,
    int depth,
  ) {
    final isSelected = widget.selectedCategoryId == category.id;
    final isExpanded = _expandedCategoryIds.contains(category.id);
    final subCategories = provider.getSubCategories(category.id);
    final hasChildren = subCategories.isNotEmpty;

    return Column(
      children: [
        GestureDetector(
          onTap: () {
            if (hasChildren) {
              setState(() {
                if (isExpanded) {
                  _expandedCategoryIds.remove(category.id);
                } else {
                  _expandedCategoryIds.add(category.id);
                }
              });
            }
            // Select this category
            final path = _getCategoryPath(category.id, provider);
            widget.onSelected(category.id, path);
          },
          child: Container(
            margin: EdgeInsets.only(left: depth * 16.0, bottom: 8),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isSelected
                  ? AppColors.primary.withValues(alpha: 0.12)
                  : (isDark ? Colors.white : Colors.black).withValues(alpha: 0.03),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isSelected ? AppColors.primary : Colors.transparent,
                width: 2,
              ),
            ),
            child: Row(
              children: [
                // Expand icon
                if (hasChildren)
                  Icon(
                    isExpanded 
                        ? Icons.keyboard_arrow_down_rounded
                        : Icons.keyboard_arrow_right_rounded,
                    size: 20,
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                  )
                else
                  const SizedBox(width: 20),
                const SizedBox(width: 8),
                
                // Category icon
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? AppColors.primary.withValues(alpha: 0.2)
                        : (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    Icons.category_rounded,
                    size: 18,
                    color: isSelected 
                        ? AppColors.primary 
                        : (isDark ? Colors.grey[400] : Colors.grey[600]),
                  ),
                ),
                const SizedBox(width: 12),
                
                // Category name
                Expanded(
                  child: Text(
                    category.name,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                      color: isDark ? Colors.white : const Color(0xFF111827),
                    ),
                  ),
                ),
                
                // Competition badge
                if (widget.showCompetition)
                  _buildCompetitionBadge(category.id, isDark),
                
                // Selected check
                if (isSelected)
                  Icon(Icons.check_circle, size: 20, color: AppColors.primary),
              ],
            ),
          ),
        ),
        
        // Subcategories
        if (isExpanded && hasChildren)
          ...subCategories.map((sub) => 
            _buildCategoryTile(sub, provider, isDark, depth + 1)
          ),
      ],
    );
  }

  Widget _buildCompetitionBadge(String categoryId, bool isDark) {
    // Mock competition level - in production, fetch from backend
    final competition = _getCompetitionLevel(categoryId);
    
    Color badgeColor;
    String label;
    
    switch (competition) {
      case 'high':
        badgeColor = Colors.red;
        label = 'High';
        break;
      case 'medium':
        badgeColor = Colors.orange;
        label = 'Med';
        break;
      default:
        badgeColor = Colors.green;
        label = 'Low';
    }
    
    return Container(
      margin: const EdgeInsets.only(right: 8),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: badgeColor.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: badgeColor,
        ),
      ),
    );
  }

  String _getCompetitionLevel(String categoryId) {
    // Mock - replace with actual backend call
    final hash = categoryId.hashCode % 3;
    if (hash == 0) return 'high';
    if (hash == 1) return 'medium';
    return 'low';
  }

  String _getCategoryPath(String categoryId, CategoryProvider provider) {
    final category = provider.getCategoryById(categoryId);
    if (category == null) return '';
    
    List<String> path = [category.name];
    String? parentId = category.parentId;
    
    while (parentId != null && parentId.isNotEmpty) {
      final parent = provider.getCategoryById(parentId);
      if (parent != null) {
        path.insert(0, parent.name);
        parentId = parent.parentId;
      } else {
        break;
      }
    }
    
    return path.join(' > ');
  }
}
