// lib/screens/category/category_screen.dart
// 💎 PREMIUM: Compact & Professional Category Browser

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';

import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import '../shop/mobile_shop_screen.dart';
import '../../widgets/unified_search_header.dart';
import '../../widgets/premium_scaffold.dart';
import '../../app/routes.dart';

class CategoryScreen extends StatefulWidget {
  final String? preselectedCategoryId;
  /// Parent category ID for hierarchical navigation
  /// If null, shows root-level main categories
  /// If set, shows subcategories of this parent
  final String? parentCategoryId;

  const CategoryScreen({
    super.key,
    this.preselectedCategoryId,
    this.parentCategoryId,
  });

  @override
  State<CategoryScreen> createState() => _CategoryScreenState();
}

class _CategoryScreenState extends State<CategoryScreen> {
  final ScrollController _sidebarScrollController = ScrollController();
  
  CategoryModel? _selectedCategory;
  int _selectedIndex = 0;
  bool _isLoading = true;

  // Icon mapping
  static const Map<String, IconData> _iconMap = {
    'electronics': Icons.devices_outlined,
    'phone': Icons.phone_android_outlined,
    'laptop': Icons.laptop_outlined,
    'tv': Icons.tv_outlined,
    'headphones': Icons.headphones_outlined,
    'watch': Icons.watch_outlined,
    'camera': Icons.camera_alt_outlined,
    'fashion': Icons.checkroom_outlined,
    'clothing': Icons.checkroom_outlined,
    'beauty': Icons.face_outlined,
    'home': Icons.home_outlined,
    'furniture': Icons.chair_outlined,
    'kitchen': Icons.kitchen_outlined,
    'sports': Icons.sports_soccer_outlined,
    'fitness': Icons.fitness_center_outlined,
    'book': Icons.menu_book_outlined,
    'toy': Icons.toys_outlined,
    'games': Icons.sports_esports_outlined,
    'food': Icons.restaurant_outlined,
    'grocery': Icons.local_grocery_store_outlined,
    'health': Icons.health_and_safety_outlined,
    'pet': Icons.pets_outlined,
    'baby': Icons.child_friendly_outlined,
    'car': Icons.directions_car_outlined,
    'tools': Icons.build_outlined,
    'garden': Icons.grass_outlined,
    'jewelry': Icons.diamond_outlined,
    'gift': Icons.card_giftcard_outlined,
    'office': Icons.business_center_outlined,
  };

  IconData _getCategoryIcon(String? iconName) {
    if (iconName == null || iconName.isEmpty) return Icons.grid_view_outlined;
    final lowerName = iconName.toLowerCase();
    for (final entry in _iconMap.entries) {
      if (lowerName.contains(entry.key)) return entry.value;
    }
    return Icons.grid_view_outlined;
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _loadInitialData();
    });
  }

  @override
  void dispose() {
    _sidebarScrollController.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    final categoryProvider = Provider.of<CategoryProvider>(context, listen: false);

    if (categoryProvider.allCategories.isEmpty) {
      await categoryProvider.loadCategories();
    }

    if (!mounted) return;

    // Determine which categories to show in sidebar
    // If parentCategoryId is set, show subcategories of that parent
    // Otherwise, show root-level main categories
    final List<CategoryModel> sidebarCategories;
    if (widget.parentCategoryId != null) {
      sidebarCategories = categoryProvider.getSubCategories(widget.parentCategoryId!);
    } else {
      sidebarCategories = categoryProvider.mainCategories;
    }

    if (sidebarCategories.isNotEmpty) {
      String? targetId = widget.preselectedCategoryId;
      CategoryModel selectedCategory = sidebarCategories.first;
      int selectedIndex = 0;

      if (targetId != null) {
        try {
          selectedCategory = sidebarCategories.firstWhere((cat) => cat.id == targetId);
          selectedIndex = sidebarCategories.indexOf(selectedCategory);
        } catch (_) {}
      }

      setState(() {
        _selectedCategory = selectedCategory;
        _selectedIndex = selectedIndex;
        _isLoading = false;
      });
    } else {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _onCategorySelected(CategoryModel category, int index) {
    if (_selectedCategory?.id == category.id) return;
    HapticFeedback.lightImpact();
    setState(() {
      _selectedCategory = category;
      _selectedIndex = index;
    });
  }

  void _navigateToShop(CategoryModel category) {
    HapticFeedback.mediumImpact();
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => MobileShopScreen(categoryId: category.id),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;

    // Determine if we're at root level or a nested level
    final isRootLevel = widget.parentCategoryId == null;

    return PremiumScaffold(
      // resizeToAvoidBottomInset handled internally
      // backgroundColor handled internally
      body: Column(
        children: [
          // 1️⃣ Sticky Search Header with Back Button
          UnifiedSearchHeader(
            showBackButton: true,
            onBackPressed: () {
              // If at root, go to home; otherwise go back to previous screen
              if (isRootLevel) {
                Navigator.pushReplacementNamed(context, AppRoutes.home);
              } else {
                Navigator.pop(context);
              }
            },
            showCameraButton: false,
            searchHint: 'Search categories...',
          ),
          
          // 2️⃣ Main Content
          Expanded(
            child: Consumer<CategoryProvider>(
              builder: (context, provider, child) {
                if (_isLoading) return _buildLoadingState(isDark);
                
                // Get sidebar categories based on current level
                final sidebarCategories = isRootLevel
                    ? provider.mainCategories
                    : provider.getSubCategories(widget.parentCategoryId!);
                
                if (sidebarCategories.isEmpty) return _buildEmptyState(isDark);

                return Row(
                  children: [
                    // Left Sidebar (Compact)
                    _buildCompactSidebar(sidebarCategories, isDark, accentColor),
                    
                    // Right Content Area
                    Expanded(
                      child: _buildContentArea(provider, isDark, accentColor),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  // ============================================================
  // COMPACT SIDEBAR
  // ============================================================
  Widget _buildCompactSidebar(List<CategoryModel> categories, bool isDark, Color accentColor) {
    return Container(
      width: 80,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        border: Border(
          right: BorderSide(
            color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[200]!,
          ),
        ),
      ),
      child: ListView.builder(
        controller: _sidebarScrollController,
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: categories.length,
        itemBuilder: (context, index) {
          final category = categories[index];
          final isSelected = _selectedIndex == index;
          return _buildSidebarItem(category, isSelected, isDark, accentColor, index);
        },
      ),
    );
  }

  Widget _buildSidebarItem(CategoryModel category, bool isSelected, bool isDark, Color accentColor, int index) {
    return GestureDetector(
      onTap: () => _onCategorySelected(category, index),
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 6),
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: isSelected 
              ? accentColor.withValues(alpha: 0.1)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          border: isSelected
              ? Border.all(color: accentColor.withValues(alpha: 0.3))
              : null,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // 56×56px Icon Image Only
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: category.iconImageUrl?.isNotEmpty == true
                  ? CachedNetworkImage(
                      imageUrl: category.iconImageUrl!,
                      width: 56,
                      height: 56,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => Container(
                        width: 56,
                        height: 56,
                        color: isDark ? Colors.grey[800] : Colors.grey[200],
                      ),
                      errorWidget: (_, __, ___) => Container(
                        width: 56,
                        height: 56,
                        color: isDark ? Colors.grey[800] : Colors.grey[200],
                        child: Icon(
                          _getCategoryIcon(category.iconName),
                          size: 28,
                          color: isSelected ? accentColor : (isDark ? Colors.white54 : Colors.grey[600]),
                        ),
                      ),
                    )
                  : Container(
                      width: 56,
                      height: 56,
                      color: isDark ? Colors.grey[800] : Colors.grey[200],
                      child: Icon(
                        _getCategoryIcon(category.iconName),
                        size: 28,
                        color: isSelected ? accentColor : (isDark ? Colors.white54 : Colors.grey[600]),
                      ),
                    ),
            ),
            const SizedBox(height: 6),
            // Name
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: Text(
                category.name,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                  color: isSelected 
                      ? accentColor 
                      : (isDark ? Colors.white60 : Colors.grey[600]),
                  height: 1.1,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ============================================================
  // CONTENT AREA
  // ============================================================
  Widget _buildContentArea(CategoryProvider provider, bool isDark, Color accentColor) {
    if (_selectedCategory == null) return const SizedBox.shrink();

    final subcategories = provider.getSubCategories(_selectedCategory!.id);
    
    return CustomScrollView(
      physics: const BouncingScrollPhysics(),
      slivers: [
        // Category Header Card
        SliverToBoxAdapter(
          child: _buildCategoryHeader(_selectedCategory!, subcategories.length, isDark, accentColor),
        ),
        
        // "View All" Button
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: GestureDetector(
              onTap: () => _navigateToShop(_selectedCategory!),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [accentColor, accentColor.withValues(alpha: 0.8)],
                  ),
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: [
                    BoxShadow(
                      color: accentColor.withValues(alpha: 0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: const [
                    Icon(Icons.shopping_bag_outlined, color: Colors.white, size: 18),
                    SizedBox(width: 8),
                    Text(
                      'View All Products',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    SizedBox(width: 4),
                    Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 16),
                  ],
                ),
              ),
            ),
          ),
        ),
        
        // Subcategories Header
        if (subcategories.isNotEmpty)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
              child: Row(
                children: [
                  Icon(Icons.category_outlined, size: 16, color: accentColor),
                  const SizedBox(width: 6),
                  Text(
                    'Subcategories',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: accentColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '${subcategories.length}',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: accentColor,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        
        // Subcategories Grid (Compact)
        if (subcategories.isNotEmpty)
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            sliver: SliverGrid(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                childAspectRatio: 0.85,
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
              ),
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final sub = subcategories[index];
                  final hasNested = provider.getSubCategories(sub.id).isNotEmpty;
                  return _buildSubcategoryCard(sub, hasNested, isDark, accentColor, provider);
                },
                childCount: subcategories.length,
              ),
            ),
          ),
        
        // Empty State for Subcategories
        if (subcategories.isEmpty)
          SliverFillRemaining(
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.folder_open_outlined, size: 48, color: Colors.grey[400]),
                  const SizedBox(height: 12),
                  Text(
                    'No subcategories',
                    style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600]),
                  ),
                  const SizedBox(height: 8),
                  TextButton.icon(
                    onPressed: () => _navigateToShop(_selectedCategory!),
                    icon: Icon(Icons.shopping_bag_outlined, size: 16, color: accentColor),
                    label: Text('Browse Products', style: TextStyle(color: accentColor)),
                  ),
                ],
              ),
            ),
          ),
        
        // Bottom Padding
        const SliverToBoxAdapter(child: SizedBox(height: 20)),
      ],
    );
  }

  Widget _buildCategoryHeader(CategoryModel category, int subcatCount, bool isDark, Color accentColor) {
    return Container(
      margin: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        // 160px Banner - Image Only (No Overlay, No Text)
        child: CachedNetworkImage(
          imageUrl: category.bannerImageUrl ?? category.iconImageUrl ?? '',
          height: 160,
          width: double.infinity,
          fit: BoxFit.cover,
          placeholder: (_, __) => Container(
            height: 160,
            color: isDark ? Colors.grey[800] : Colors.grey[200],
          ),
          errorWidget: (_, __, ___) => Container(
            height: 160,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [accentColor, accentColor.withValues(alpha: 0.6)],
              ),
            ),
            child: Center(
              child: Icon(
                _getCategoryIcon(category.iconName),
                size: 48,
                color: Colors.white.withValues(alpha: 0.5),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSubcategoryCard(CategoryModel category, bool hasNested, bool isDark, Color accentColor, CategoryProvider provider) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        if (hasNested) {
          // Navigate to new CategoryScreen with this category as parent
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => CategoryScreen(parentCategoryId: category.id),
            ),
          );
        } else {
          _navigateToShop(category);
        }
      },
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[200]!,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          children: [
            // Image
            Expanded(
              flex: 6,
              child: Stack(
                children: [
                  ClipRRect(
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                    child: CachedNetworkImage(
                      imageUrl: category.iconImageUrl ?? '',
                      width: double.infinity,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => Container(
                        color: isDark ? Colors.grey[800] : Colors.grey[100],
                      ),
                      errorWidget: (_, __, ___) => Container(
                        color: isDark ? Colors.grey[800] : Colors.grey[100],
                        child: Icon(
                          _getCategoryIcon(category.iconName),
                          color: Colors.grey[400],
                          size: 28,
                        ),
                      ),
                    ),
                  ),
                  // Nested indicator
                  if (hasNested)
                    Positioned(
                      top: 4,
                      right: 4,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: accentColor,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.add, color: Colors.white, size: 10),
                      ),
                    ),
                ],
              ),
            ),
            // Name
            Expanded(
              flex: 4,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  child: Text(
                    category.name,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: isDark ? Colors.white : Colors.black87,
                      height: 1.2,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showNestedSubcategories(CategoryModel parent, CategoryProvider provider, bool isDark, Color accentColor) {
    final nested = provider.getSubCategories(parent.id);
    
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.5,
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            // Handle
            Container(
              margin: const EdgeInsets.only(top: 12),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey[400],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            
            // Header
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Icon(Icons.subdirectory_arrow_right, size: 20, color: accentColor),
                  const SizedBox(width: 8),
                  Text(
                    parent.name,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  const Spacer(),
                  GestureDetector(
                    onTap: () {
                      Navigator.pop(context);
                      _navigateToShop(parent);
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: accentColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        children: [
                          Text(
                            'View All',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: accentColor,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Icon(Icons.arrow_forward, size: 14, color: accentColor),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            
            // Grid
            Expanded(
              child: GridView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  childAspectRatio: 0.85,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                ),
                itemCount: nested.length,
                itemBuilder: (context, index) {
                  final sub = nested[index];
                  return GestureDetector(
                    onTap: () {
                      Navigator.pop(context);
                      _navigateToShop(sub);
                    },
                    child: Container(
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF2A2A2A) : Colors.grey[50],
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[200]!,
                        ),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: CachedNetworkImage(
                              imageUrl: sub.iconImageUrl ?? '',
                              width: 40,
                              height: 40,
                              fit: BoxFit.cover,
                              errorWidget: (_, __, ___) => Icon(
                                _getCategoryIcon(sub.iconName),
                                size: 28,
                                color: Colors.grey[400],
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            child: Text(
                              sub.name,
                              textAlign: TextAlign.center,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: isDark ? Colors.white : Colors.black87,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ============================================================
  // LOADING & EMPTY STATES
  // ============================================================
  Widget _buildLoadingState(bool isDark) {
    return Center(
      child: CircularProgressIndicator(
        color: isDark ? AppColors.primaryLight : AppColors.primary,
      ),
    );
  }

  Widget _buildEmptyState(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.category_outlined, size: 64, color: Colors.grey[400]),
          const SizedBox(height: 16),
          Text(
            'No categories available',
            style: TextStyle(
              color: isDark ? Colors.grey[400] : Colors.grey[600],
              fontSize: 16,
            ),
          ),
        ],
      ),
    );
  }
}