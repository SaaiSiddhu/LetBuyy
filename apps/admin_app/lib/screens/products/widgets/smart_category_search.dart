// lib/screens/products/widgets/smart_category_search.dart
// Smart Search Bar with Autocomplete and Quick Filter Chips for Categories

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:async';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

/// Quick filter chip types for categories
enum QuickCategoryFilter {
  rootOnly('Root Only', Icons.account_tree_rounded, Color(0xFF673AB7)),
  active('Active', Icons.check_circle_rounded, Color(0xFF4CAF50)),
  inactive('Inactive', Icons.cancel_rounded, Color(0xFF9E9E9E)),
  hasProducts('Has Products', Icons.inventory_2_rounded, Color(0xFF009688)),
  empty('Empty', Icons.folder_off_rounded, Color(0xFFFF9800)),
  level1('Level 1', Icons.looks_one_rounded, Color(0xFF2196F3)),
  level2('Level 2', Icons.looks_two_rounded, Color(0xFF03A9F4)),
  level3('Level 3+', Icons.looks_3_rounded, Color(0xFF00BCD4));

  final String label;
  final IconData icon;
  final Color color;
  const QuickCategoryFilter(this.label, this.icon, this.color);
}

/// Category sort options
enum CategorySortOption {
  nameAsc('Name A-Z', 'name', false),
  nameDesc('Name Z-A', 'name', true),
  productCount('Products ↓', 'productCount', true),
  level('Level', 'level', false),
  displayOrder('Display Order', 'displayOrder', false),
  newest('Newest', 'createdAt', true);

  final String label;
  final String field;
  final bool descending;
  const CategorySortOption(this.label, this.field, this.descending);
}

/// Category search suggestion
class CategorySearchSuggestion {
  final String id;
  final String name;
  final int level;
  final String? parentName;
  final int productCount;

  const CategorySearchSuggestion({
    required this.id,
    required this.name,
    required this.level,
    this.parentName,
    required this.productCount,
  });
}

/// Smart Category Search Widget
class SmartCategorySearch extends StatefulWidget {
  final bool isDark;
  final List<CategoryModel> categories;
  final Set<QuickCategoryFilter> activeFilters;
  final Function(String) onSearchChanged;
  final Function(String) onSearchSubmitted;
  final Function(QuickCategoryFilter) onFilterToggled;
  final VoidCallback? onAdvancedFilterTap;
  final CategorySortOption currentSort;
  final Function(CategorySortOption) onSortChanged;

  const SmartCategorySearch({
    super.key,
    required this.isDark,
    required this.categories,
    required this.activeFilters,
    required this.onSearchChanged,
    required this.onSearchSubmitted,
    required this.onFilterToggled,
    this.onAdvancedFilterTap,
    required this.currentSort,
    required this.onSortChanged,
  });

  @override
  State<SmartCategorySearch> createState() => _SmartCategorySearchState();
}

class _SmartCategorySearchState extends State<SmartCategorySearch> {
  final _searchController = TextEditingController();
  final _focusNode = FocusNode();
  final _layerLink = LayerLink();
  
  List<CategorySearchSuggestion> _suggestions = [];
  Timer? _debounce;
  OverlayEntry? _overlayEntry;

  // Placeholder animation
  final List<String> _placeholders = [
    'Search by category name...',
    'Search by parent...',
    'Find subcategories...',
  ];
  int _currentPlaceholder = 0;
  Timer? _placeholderTimer;

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(_onFocusChange);
    _startPlaceholderAnimation();
  }

  void _startPlaceholderAnimation() {
    _placeholderTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (mounted && _searchController.text.isEmpty) {
        setState(() {
          _currentPlaceholder = (_currentPlaceholder + 1) % _placeholders.length;
        });
      }
    });
  }

  void _onFocusChange() {
    if (_focusNode.hasFocus && _suggestions.isNotEmpty) {
      _showOverlay();
    } else {
      _hideOverlay();
    }
  }

  void _onSearchChanged(String query) {
    widget.onSearchChanged(query);
    
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (query.length >= 2) {
        _fetchSuggestions(query);
      } else {
        setState(() => _suggestions = []);
        _hideOverlay();
      }
    });
  }

  void _fetchSuggestions(String query) {
    final lowerQuery = query.toLowerCase();
    final suggestions = <CategorySearchSuggestion>[];

    for (final cat in widget.categories) {
      if (cat.name.toLowerCase().contains(lowerQuery)) {
        // Find parent name if exists
        String? parentName;
        if (cat.parentId != null) {
          final parent = widget.categories.firstWhere(
            (c) => c.id == cat.parentId,
            orElse: () => cat,
          );
          if (parent.id != cat.id) {
            parentName = parent.name;
          }
        }

        suggestions.add(CategorySearchSuggestion(
          id: cat.id,
          name: cat.name,
          level: cat.level,
          parentName: parentName,
          productCount: cat.productCount,
        ));

        if (suggestions.length >= 6) break;
      }
    }

    setState(() => _suggestions = suggestions);
    
    if (_suggestions.isNotEmpty && _focusNode.hasFocus) {
      _showOverlay();
    } else {
      _hideOverlay();
    }
  }

  void _showOverlay() {
    _hideOverlay();
    _overlayEntry = OverlayEntry(
      builder: (context) => _buildSuggestionsOverlay(),
    );
    Overlay.of(context).insert(_overlayEntry!);
  }

  void _hideOverlay() {
    _overlayEntry?.remove();
    _overlayEntry = null;
  }

  Widget _buildSuggestionsOverlay() {
    return Positioned(
      width: MediaQuery.of(context).size.width - 32,
      child: CompositedTransformFollower(
        link: _layerLink,
        showWhenUnlinked: false,
        offset: const Offset(0, 54),
        child: Material(
          elevation: 8,
          borderRadius: BorderRadius.circular(12),
          color: widget.isDark ? const Color(0xFF1E1E2E) : Colors.white,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: _suggestions.map((suggestion) {
                return InkWell(
                  onTap: () {
                    HapticFeedback.selectionClick();
                    _searchController.text = suggestion.name;
                    widget.onSearchSubmitted(suggestion.name);
                    _hideOverlay();
                    _focusNode.unfocus();
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Row(
                      children: [
                        // Level indicator
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            'L${suggestion.level}',
                            style: TextStyle(
                              color: AppColors.primary,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                suggestion.name,
                                style: TextStyle(
                                  color: widget.isDark ? Colors.white : Colors.black87,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              if (suggestion.parentName != null)
                                Text(
                                  'in ${suggestion.parentName}',
                                  style: TextStyle(
                                    color: widget.isDark ? Colors.grey[500] : Colors.grey[600],
                                    fontSize: 12,
                                  ),
                                ),
                            ],
                          ),
                        ),
                        // Product count
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.teal.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            '${suggestion.productCount} products',
                            style: TextStyle(
                              color: Colors.teal[700],
                              fontSize: 10,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _placeholderTimer?.cancel();
    _searchController.dispose();
    _focusNode.dispose();
    _hideOverlay();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Search Bar Row
        Row(
          children: [
            // Main Search Field
            Expanded(
              child: CompositedTransformTarget(
                link: _layerLink,
                child: Container(
                  height: 50,
                  decoration: BoxDecoration(
                    color: widget.isDark ? Colors.white.withValues(alpha: 0.08) : Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: _focusNode.hasFocus
                          ? AppColors.primary
                          : (widget.isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.withValues(alpha: 0.2)),
                      width: _focusNode.hasFocus ? 1.5 : 1,
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
                  child: TextField(
                    controller: _searchController,
                    focusNode: _focusNode,
                    style: TextStyle(
                      color: widget.isDark ? Colors.white : Colors.black,
                      fontSize: 14,
                    ),
                    decoration: InputDecoration(
                      hintText: _placeholders[_currentPlaceholder],
                      hintStyle: TextStyle(
                        color: widget.isDark ? Colors.grey[500] : Colors.grey[400],
                        fontSize: 14,
                      ),
                      prefixIcon: Icon(
                        Icons.search_rounded,
                        color: widget.isDark ? Colors.grey[500] : Colors.grey[400],
                      ),
                      suffixIcon: _searchController.text.isNotEmpty
                          ? IconButton(
                              icon: Icon(
                                Icons.close_rounded,
                                color: widget.isDark ? Colors.grey[500] : Colors.grey[600],
                                size: 20,
                              ),
                              onPressed: () {
                                _searchController.clear();
                                widget.onSearchChanged('');
                                _hideOverlay();
                              },
                            )
                          : null,
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    ),
                    onChanged: _onSearchChanged,
                    onSubmitted: (val) {
                      widget.onSearchSubmitted(val);
                      _hideOverlay();
                    },
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            
            // Sort Dropdown
            _buildSortDropdown(),
          ],
        ),
        
        // Quick Filter Chips
        const SizedBox(height: 12),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: QuickCategoryFilter.values.map((filter) {
              final isActive = widget.activeFilters.contains(filter);
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: _buildFilterChip(filter, isActive),
              );
            }).toList(),
          ),
        ),
        
        // Active Filters Row
        if (widget.activeFilters.isNotEmpty) ...[
          const SizedBox(height: 12),
          _buildActiveFiltersRow(),
        ],
      ],
    );
  }

  Widget _buildSortDropdown() {
    return Container(
      height: 50,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: widget.isDark ? Colors.white.withValues(alpha: 0.08) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: widget.isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.withValues(alpha: 0.2),
        ),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<CategorySortOption>(
          value: widget.currentSort,
          icon: Icon(
            Icons.keyboard_arrow_down_rounded,
            color: widget.isDark ? Colors.grey[400] : Colors.grey[600],
            size: 18,
          ),
          dropdownColor: widget.isDark ? const Color(0xFF1E1E2E) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          items: CategorySortOption.values.map((option) {
            return DropdownMenuItem<CategorySortOption>(
              value: option,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.sort_rounded,
                    size: 14,
                    color: widget.isDark ? Colors.grey[500] : Colors.grey[600],
                  ),
                  const SizedBox(width: 6),
                  Text(
                    option.label,
                    style: TextStyle(
                      fontSize: 12,
                      color: widget.isDark ? Colors.white : Colors.black87,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            );
          }).toList(),
          onChanged: (option) {
            if (option != null) {
              HapticFeedback.selectionClick();
              widget.onSortChanged(option);
            }
          },
        ),
      ),
    );
  }

  Widget _buildFilterChip(QuickCategoryFilter filter, bool isActive) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        widget.onFilterToggled(filter);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isActive
              ? filter.color.withValues(alpha: 0.15)
              : (widget.isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.withValues(alpha: 0.08)),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isActive ? filter.color : Colors.transparent,
            width: 1.5,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              filter.icon,
              size: 16,
              color: isActive ? filter.color : (widget.isDark ? Colors.grey[400] : Colors.grey[600]),
            ),
            const SizedBox(width: 6),
            Text(
              filter.label,
              style: TextStyle(
                color: isActive ? filter.color : (widget.isDark ? Colors.grey[300] : Colors.grey[700]),
                fontSize: 12,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActiveFiltersRow() {
    return Row(
      children: [
        Text(
          'Active: ',
          style: TextStyle(
            color: widget.isDark ? Colors.grey[500] : Colors.grey[600],
            fontSize: 12,
          ),
        ),
        Expanded(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: widget.activeFilters.map((filter) {
                return Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: GestureDetector(
                    onTap: () => widget.onFilterToggled(filter),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: filter.color.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            filter.label,
                            style: TextStyle(
                              color: filter.color,
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Icon(Icons.close, size: 12, color: filter.color),
                        ],
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ),
        GestureDetector(
          onTap: () {
            // Clear all filters
            for (final filter in widget.activeFilters.toList()) {
              widget.onFilterToggled(filter);
            }
          },
          child: Text(
            'Clear All',
            style: TextStyle(
              color: AppColors.primary,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}
