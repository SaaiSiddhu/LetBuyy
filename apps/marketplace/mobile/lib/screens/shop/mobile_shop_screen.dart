// lib/screens/user/shop/mobile_shop_screen.dart
// 💎 PREMIUM: Ultra-Professional Shop Experience

import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:shimmer/shimmer.dart';
import 'package:flutter_animate/flutter_animate.dart';

import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';

import 'widgets/filter_drawer.dart';
import 'widgets/product_card.dart';
import '../search/mobile_search_screen.dart';
import '../../widgets/premium_scaffold.dart';
import '../../widgets/unified_search_header.dart';

class MobileShopScreen extends StatefulWidget {
  final String? categoryId;
  final String? searchQuery; // NEW: Initial search query from search screen
  final bool showRecentlyViewed;
  final bool showDeals;

  const MobileShopScreen({
    super.key,
    this.categoryId,
    this.searchQuery,
    this.showRecentlyViewed = false,
    this.showDeals = false,
  });

  @override
  State<MobileShopScreen> createState() => _MobileShopScreenState();
}

class _MobileShopScreenState extends State<MobileShopScreen>
    with TickerProviderStateMixin, WidgetsBindingObserver, AutomaticKeepAliveClientMixin {
  
  // 🚀 WEB OPTIMIZATION: Keep state alive when switching tabs
  @override
  bool get wantKeepAlive => true;
  
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  final ScrollController _scrollController = ScrollController();
  final TextEditingController _searchController = TextEditingController();

  // State
  String _sortBy = 'newest';
  bool _isGridView = true;
  Map<String, dynamic> _appliedFilters = {};
  int _activeFiltersCount = 0;
  bool _isSearching = false;
  String _searchQuery = '';
  Timer? _debounceTimer;
  CategoryModel? _currentCategory;
  bool _isLoadingCategory = true;

  // Animation Controllers
  late AnimationController _headerAnimController;
  late AnimationController _fabAnimController;

  // Real-time
  StreamSubscription? _productUpdateSubscription;
  final Map<String, bool> _productAvailability = {};
  bool _isRefreshing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    // Anim Controllers
    _headerAnimController = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 300));
        
    _fabAnimController = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 300));

    // Listeners
    _scrollController.addListener(_onScroll);

    // Initial Load
    _appliedFilters = {};
    if (widget.categoryId != null) {
      _appliedFilters['categories'] = [widget.categoryId!];
      _loadCategoryInfo(widget.categoryId!);
    } else {
      _isLoadingCategory = false;
    }
    
    // NEW: Initialize search query from parameter
    if (widget.searchQuery != null && widget.searchQuery!.isNotEmpty) {
      _searchController.text = widget.searchQuery!;
      _searchQuery = widget.searchQuery!.toLowerCase().trim();
    }

    _loadData();
    _setupRealTimeUpdates();
    _updateActiveFiltersCount();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _headerAnimController.dispose();
    _fabAnimController.dispose();
    _scrollController.dispose();
    _searchController.dispose();
    _debounceTimer?.cancel();
    _productUpdateSubscription?.cancel();
    super.dispose();
  }

  void _onScroll() {
    final offset = _scrollController.offset;
    // Show FAB
    if (offset > 500 && _fabAnimController.status != AnimationStatus.completed) {
      _fabAnimController.forward();
    } else if (offset <= 500 && _fabAnimController.status == AnimationStatus.completed) {
      _fabAnimController.reverse();
    }
    setState(() {}); // For scroll progress update
  }

  void _loadCategoryInfo(String categoryId) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final categoryProvider = Provider.of<CategoryProvider>(context, listen: false);
      setState(() {
         _currentCategory = categoryProvider.getCategoryById(categoryId);
         _isLoadingCategory = false;
      });
    });
  }

  void _loadData() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final productProvider = Provider.of<ProductProvider>(context, listen: false);
      final categoryProvider = Provider.of<CategoryProvider>(context, listen: false);
      
      productProvider.loadProducts();
      categoryProvider.loadCategories();
    });
  }

  void _setupRealTimeUpdates() {
    Timer.periodic(const Duration(seconds: 45), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      _checkInventoryUpdates();
    });
  }

  void _checkInventoryUpdates() {
    // Inventory simulation logic...
    if (!mounted) return;
    try {
      final random = math.Random();
      final productProvider = Provider.of<ProductProvider>(context, listen: false);
      for (var product in productProvider.products.take(5)) {
        if (random.nextBool()) {
          _productAvailability[product.id] = product.inStock;
        }
      }
    } catch (_) {}
  }

  // --- Search & Filter Logic ---

  void _updateActiveFiltersCount() {
    int count = 0;
    if (_appliedFilters.isNotEmpty) {
      // Price range
      final range = _appliedFilters['priceRange'] as RangeValues?;
      if (range != null && (range.start > 0 || range.end < 50000)) count++;
      
      // Rating (can be int or double)
      final minRating = _appliedFilters['minRating'];
      if (minRating != null && (minRating is num) && minRating > 0) count++;
      
      // Discount (can be int or double)
      final minDiscount = _appliedFilters['minDiscount'];
      if (minDiscount != null && (minDiscount is num) && minDiscount > 0) count++;
      
      // Deals toggle
      if (_appliedFilters['dealsOnly'] == true) count++;
      
      // Dynamic attribute filters
      final attrFilters = _appliedFilters['attributeFilters'] as Map<String, dynamic>?;
      if (attrFilters != null) {
        for (final entry in attrFilters.entries) {
          final values = entry.value as List?;
          if (values != null && values.isNotEmpty) count += values.length;
        }
      }
    }
    setState(() => _activeFiltersCount = count);
  }

  void _onSearchChanged(String query) {
    _debounceTimer?.cancel();
    if (query.isEmpty) {
      setState(() {
        _searchQuery = '';
        _isSearching = false;
      });
      return;
    }
    setState(() => _isSearching = true);
    _debounceTimer = Timer(const Duration(milliseconds: 400), () {
      if (mounted) {
          setState(() {
            _searchQuery = query.toLowerCase().trim();
            _isSearching = false;
          });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // BUILD
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    super.build(context); // 🚀 Required for AutomaticKeepAlive
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;

    final productProvider = Provider.of<ProductProvider>(context); // listen: true for FilterDrawer to update
    
    return PremiumScaffold(
      scaffoldKey: _scaffoldKey,
      extendBody: true,
      extendBodyBehindAppBar: true,
      // backgroundColor handled by PremiumScaffold
      endDrawer: FilterDrawer(
        initialFilters: _appliedFilters,
        preSelectedCategoryId: widget.categoryId,
        products: productProvider.products, // ✅ Pass products for dynamic attribute filters
        onApply: (filters) {
          setState(() => _appliedFilters = filters);
          _updateActiveFiltersCount();
          HapticFeedback.heavyImpact();
        },
      ),
      body: Stack(
        children: [
          // 1. Background handled by PremiumScaffold

          // 2. Main Content
          Column(
            children: [
              // Custom Glass Header (includes status bar padding)
              _buildGlassHeader(isDark),

              // Product List
              Expanded(
                child: Consumer<ProductProvider>(
                  builder: (context, productProvider, _) {
                    // Pass scroll controller for hide/show header effect if needed
                    return _buildProductContent(productProvider, isDark);
                  },
                ),
              ),
            ],
          ),

          // 3. Floating Action Button (Scroll to top)
          Positioned(
            right: 16,
            bottom: 100, // Above nav bar
            child: ScaleTransition(
              scale: _fabAnimController,
              child: FloatingActionButton(
                mini: true,
                onPressed: () {
                   _scrollController.animateTo(0, duration: 600.ms, curve: Curves.easeOutCubic);
                },
                backgroundColor: isDark ? AppColors.primaryLight : AppColors.primary,
                child: const Icon(Icons.arrow_upward_rounded, color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // WIDGETS
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // WIDGETS
  // ---------------------------------------------------------------------------

  Widget _buildGlassHeader(bool isDark) {
    // Title Logic
    String title = "Shop";
    if (widget.showRecentlyViewed) {
      title = "Recently Viewed";
    } else if (widget.showDeals) title = "Special Deals";
    else if (_currentCategory != null) title = _currentCategory!.name;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // 1. Unified Search Header (Amazon-style)
        UnifiedSearchHeader(
          showBackButton: true,
          searchHint: 'Search in $title...',
          currentQuery: _searchQuery.isNotEmpty ? _searchQuery : null,
          onSearchTap: () {
            HapticFeedback.lightImpact();
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const MobileSearchScreen()),
            );
          },
        ),
        
        // 2. Filter Chips Row
        Container(
          color: isDark ? AppColors.surfaceDark : Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                // Sort Chip
                _buildFilterChip(
                  label: 'Sort',
                  icon: Icons.sort,
                  isDark: isDark,
                  onTap: () => _showSortBottomSheet(),
                ),
                const SizedBox(width: 8),
                
                // Express Delivery Chip (Toggle)
                _buildFilterChip(
                  label: 'Express',
                  icon: Icons.flash_on_rounded,
                  isDark: isDark,
                  isSelected: _appliedFilters['expressDelivery'] == true,
                  onTap: () {
                    setState(() {
                      _appliedFilters['expressDelivery'] = !(_appliedFilters['expressDelivery'] ?? false);
                      _updateActiveFiltersCount();
                    });
                  },
                ),
                const SizedBox(width: 8),
                
                // Price Chip
                _buildFilterChip(
                  label: 'Price',
                  icon: Icons.attach_money,
                  isDark: isDark,
                  hasDropdown: true,
                  onTap: () => _showPriceFilter(),
                ),
                const SizedBox(width: 8),
                
                // Grid/List Toggle
                _buildFilterChip(
                  label: _isGridView ? 'Grid' : 'List',
                  icon: _isGridView ? Icons.grid_view_rounded : Icons.view_list_rounded,
                  isDark: isDark,
                  onTap: () => setState(() => _isGridView = !_isGridView),
                ),
                const SizedBox(width: 8),
                
                // More Filters
                _buildFilterChip(
                  label: 'Filters',
                  icon: Icons.tune_rounded,
                  isDark: isDark,
                  badge: _activeFiltersCount > 0 ? _activeFiltersCount : null,
                  onTap: () => _scaffoldKey.currentState?.openEndDrawer(),
                ),
              ],
            ),
          ),
        ),
        
        // 3. Sub-Category Buttons (if category selected)
        if (_currentCategory != null || widget.categoryId != null)
          _buildSubCategoryRow(isDark),
        
        // Divider
        Container(
          height: 1,
          color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.black.withValues(alpha: 0.05),
        ),
      ],
    );
  }
  
  // Filter Chip Widget
  Widget _buildFilterChip({
    required String label,
    required IconData icon,
    required bool isDark,
    bool isSelected = false,
    bool hasDropdown = false,
    int? badge,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected
              ? (isDark ? AppColors.primaryLight : AppColors.primary)
              : (isDark ? Colors.grey[800] : Colors.grey[100]),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected
                ? Colors.transparent
                : (isDark ? Colors.grey[700]! : Colors.grey[300]!),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 16,
              color: isSelected
                  ? Colors.white
                  : (isDark ? Colors.white70 : Colors.grey[700]),
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: isSelected
                    ? Colors.white
                    : (isDark ? Colors.white70 : Colors.grey[700]),
              ),
            ),
            if (hasDropdown) ...[
              const SizedBox(width: 4),
              Icon(
                Icons.keyboard_arrow_down,
                size: 16,
                color: isSelected
                    ? Colors.white
                    : (isDark ? Colors.white70 : Colors.grey[700]),
              ),
            ],
            if (badge != null) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.error,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '$badge',
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
  
  // Sub-Category Row
  Widget _buildSubCategoryRow(bool isDark) {
    return Consumer<CategoryProvider>(
      builder: (context, categoryProvider, _) {
        final categoryId = widget.categoryId ?? _currentCategory?.id;
        if (categoryId == null) return const SizedBox.shrink();
        
        final subcategories = categoryProvider.getSubCategories(categoryId);
        if (subcategories.isEmpty) return const SizedBox.shrink();
        
        return Container(
          color: isDark ? AppColors.surfaceDark : Colors.white,
          padding: const EdgeInsets.only(bottom: 8),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                // "All" button
                _buildSubCategoryChip(
                  label: 'All',
                  isSelected: !_appliedFilters.containsKey('subCategory'),
                  isDark: isDark,
                  onTap: () {
                    setState(() {
                      _appliedFilters.remove('subCategory');
                      _updateActiveFiltersCount();
                    });
                  },
                ),
                const SizedBox(width: 8),
                
                // Subcategory chips
                ...subcategories.map((subcat) => Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: _buildSubCategoryChip(
                    label: subcat.name,
                    isSelected: _appliedFilters['subCategory'] == subcat.id,
                    isDark: isDark,
                    onTap: () {
                      setState(() {
                        _appliedFilters['subCategory'] = subcat.id;
                        _updateActiveFiltersCount();
                      });
                    },
                  ),
                )),
              ],
            ),
          ),
        );
      },
    );
  }
  
  Widget _buildSubCategoryChip({
    required String label,
    required bool isSelected,
    required bool isDark,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected
              ? (isDark ? AppColors.primary : AppColors.primaryDark)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected
                ? Colors.transparent
                : (isDark ? Colors.grey[600]! : Colors.grey[400]!),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
            color: isSelected
                ? Colors.white
                : (isDark ? Colors.white70 : Colors.grey[700]),
          ),
        ),
      ),
    );
  }
  
  void _showSortBottomSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => _buildSortSheet(),
    );
  }
  
  Widget _buildSortSheet() {
    final isDark = Provider.of<ThemeProvider>(context, listen: false).isDarkMode;
    final sortOptions = [
      {'value': 'newest', 'label': 'Newest First'},
      {'value': 'price_low', 'label': 'Price: Low to High'},
      {'value': 'price_high', 'label': 'Price: High to Low'},
      {'value': 'popular', 'label': 'Popularity'},
    ];
    
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Sort By',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 16),
          ...sortOptions.map((option) => ListTile(
            leading: Radio<String>(
              value: option['value']!,
              groupValue: _sortBy,
              onChanged: (value) {
                setState(() => _sortBy = value!);
                Navigator.pop(context);
              },
              activeColor: AppColors.primary,
            ),
            title: Text(
              option['label']!,
              style: TextStyle(color: isDark ? Colors.white : Colors.black87),
            ),
            onTap: () {
              setState(() => _sortBy = option['value']!);
              Navigator.pop(context);
            },
          )),
          const SizedBox(height: 20),
        ],
      ),
    );
  }
  
  void _showPriceFilter() {
    final isDark = Provider.of<ThemeProvider>(context, listen: false).isDarkMode;
    RangeValues currentRange = _appliedFilters['priceRange'] ?? const RangeValues(0, 10000);
    
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDark : Colors.white,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey[300],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Price Range',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              const SizedBox(height: 24),
              RangeSlider(
                values: currentRange,
                min: 0,
                max: 10000,
                divisions: 100,
                activeColor: AppColors.primary,
                labels: RangeLabels(
                  '₹${currentRange.start.round()}',
                  '₹${currentRange.end.round()}',
                ),
                onChanged: (values) {
                  setModalState(() => currentRange = values);
                },
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('₹${currentRange.start.round()}', style: TextStyle(color: isDark ? Colors.white70 : Colors.grey[700])),
                  Text('₹${currentRange.end.round()}', style: TextStyle(color: isDark ? Colors.white70 : Colors.grey[700])),
                ],
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    setState(() {
                      _appliedFilters['priceRange'] = currentRange;
                      _updateActiveFiltersCount();
                    });
                    Navigator.pop(context);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Apply', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMiniControlBtn(IconData icon, bool isDark, {required VoidCallback onTap}) {
    return GestureDetector(
       onTap: () {
         HapticFeedback.lightImpact();
         onTap();
       },
       child: Container(
          width: 36, height: 36,
          decoration: BoxDecoration(
             color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.black.withValues(alpha: 0.05),
             borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, size: 18, color: isDark ? AppColors.textLightHint : AppColors.textPrimary),
       ),
    );
  }

  Widget _buildSortDropdown(bool isDark) {
    return Container(
       height: 36,
       padding: const EdgeInsets.symmetric(horizontal: 10),
       decoration: BoxDecoration(
          color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.black.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(10),
       ),
       child: DropdownButtonHideUnderline(
          child: DropdownButton<String>(
             value: _sortBy,
             icon: Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: isDark ? AppColors.textLightHint : AppColors.textPrimary),
             dropdownColor: isDark ? AppColors.surfaceDark : AppColors.surface,
             style: TextStyle(
                fontFamily: 'Poppins',
                fontSize: 12,
                color: isDark ? AppColors.textLight : AppColors.textPrimary,
                fontWeight: FontWeight.w600
             ),
             items: const [
                DropdownMenuItem(value: 'newest', child: Text('Newest')),
                DropdownMenuItem(value: 'price_low', child: Text('Price: Low to High')),
                DropdownMenuItem(value: 'price_high', child: Text('Price: High to Low')),
                DropdownMenuItem(value: 'popular', child: Text('Popular')),
             ],
             onChanged: (v) {
                if (v != null) setState(() => _sortBy = v);
             },
          ),
       ),
    );
  }

  Widget _buildHeaderIconBtn(IconData icon, bool isDark, {required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 42,
        height: 42,
        decoration: BoxDecoration(
          color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.black.withValues(alpha: 0.05),
          shape: BoxShape.circle,
          border: Border.all(
            color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.black.withValues(alpha: 0.1),
          ),
        ),
        child: Icon(icon, color: isDark ? AppColors.textLight : AppColors.textPrimary, size: 20),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // CONTENT
  // ---------------------------------------------------------------------------

  Widget _buildProductContent(ProductProvider provider, bool isDark) {
    if ((provider.isLoading && !_isRefreshing) || _isSearching || _isLoadingCategory) {
       return _buildShimmerLoading(isDark);
    }

    final products = _getFilteredProducts(provider);

    if (products.isEmpty) {
       return _buildEmptyState(isDark);
    }

    return RefreshIndicator(
       onRefresh: () async {
          setState(() => _isRefreshing = true);
          await provider.loadProducts();
          setState(() => _isRefreshing = false);
       },
       displacement: 20,
       edgeOffset: 120, // Push down refresh indicator
       child: CustomScrollView(
          controller: _scrollController,
          physics: const BouncingScrollPhysics(),
          slivers: [
             // No padding - edge to edge
             _isGridView
                ? _buildMetricsGrid(products, isDark)
                : _buildMetricsList(products, isDark),
             
             // Bottom padding for nav bar
             const SliverToBoxAdapter(child: SizedBox(height: 16)),
          ],
       ),
    );
  }

  // Phase 1R corrective (C2): both grid/list builders used to merge in _targetedAds (sponsored
  // products) ahead of the regular grid, via an unconditional Provider.of<MarketplaceAdProvider>
  // lookup at the top of each method — a lookup that would throw ProviderNotFoundException on
  // every single shop-screen render, not just when ads exist, once the provider is deregistered.
  // MarketplaceAdProvider was entirely Firestore-backed with no canonical successor, so this drops
  // the ad-merge path and renders products directly (matching what _targetedAds staying empty
  // already reduced this to in practice).
  Widget _buildMetricsGrid(List<ProductModel> products, bool isDark) {
    return SliverGrid(
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 0.62,
        crossAxisSpacing: 0,
        mainAxisSpacing: 0,
      ),
      delegate: SliverChildBuilderDelegate(
        (context, idx) {
          final product = products[idx];
          return ProductCard(
            product: product,
            isGridView: true,
            source: _searchQuery.isNotEmpty ? 'search' : (widget.categoryId != null ? 'category' : 'organic'), // Analytics: source attribution
          ).animate(key: ValueKey(product.id), delay: (idx % 6 * 50).ms).fadeIn().slideY(begin: 0.1, end: 0);
        },
        childCount: products.length,
      ),
    );
  }

  Widget _buildMetricsList(List<ProductModel> products, bool isDark) {
    return SliverList(
      delegate: SliverChildBuilderDelegate(
        (context, idx) {
          final product = products[idx];
          return ProductCard(
            product: product,
            isGridView: false,
            source: _searchQuery.isNotEmpty ? 'search' : (widget.categoryId != null ? 'category' : 'organic'), // Analytics: source attribution
          ).animate(key: ValueKey(product.id), delay: (idx % 6 * 50).ms).fadeIn().slideX(begin: 0.1, end: 0);
        },
        childCount: products.length,
      ),
    );
  }

  Widget _buildShimmerLoading(bool isDark) {
     return GridView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 6,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
           crossAxisCount: 2,
           childAspectRatio: 0.65,
           crossAxisSpacing: 12,
           mainAxisSpacing: 12,
        ),
        itemBuilder: (_, __) => Shimmer.fromColors(
           baseColor: isDark ? Colors.white10 : Colors.grey[300]!,
           highlightColor: isDark ? Colors.white24 : Colors.grey[100]!,
           child: Container(
              decoration: BoxDecoration(
                 color: Colors.white,
                 borderRadius: BorderRadius.circular(20),
              ),
           ),
        ),
     );
  }

  Widget _buildEmptyState(bool isDark) {
     return Center(
        child: Column(
           mainAxisAlignment: MainAxisAlignment.center,
           children: [
              Icon(Icons.search_off_rounded, size: 60, color: isDark ? Colors.white24 : Colors.black12),
              const SizedBox(height: 16),
              Text(
                 "No products found",
                 style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: isDark ? AppColors.textLightHint : AppColors.textHint
                 ),
              ),
              if (_activeFiltersCount > 0)
                 Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: TextButton.icon(
                       onPressed: () {
                          setState(() {
                             _appliedFilters.clear();
                             _updateActiveFiltersCount();
                          });
                       },
                       icon: const Icon(Icons.refresh_rounded),
                       label: const Text("Clear Filters"),
                    ),
                 ),
           ],
        ),
     );
  }

  // --- Filtering Logic (Reused) ---

  List<ProductModel> _getFilteredProducts(ProductProvider provider) {
    if (provider.products.isEmpty) return [];

    List<ProductModel> filtered = List.from(provider.products);

    // 1. Category Filter - includes all subcategories recursively
    // Get CategoryProvider to look up subcategories
    final categoryProvider = Provider.of<CategoryProvider>(context, listen: false);
    
    // Build a set of all matching category IDs (including subcategories)
    Set<String> matchingCategoryIds = {};
    
    // Check local filters first (which are init with widget.categoryId)
    final categoryFilters = _appliedFilters['categories'] as List<dynamic>?;
    if (categoryFilters != null && categoryFilters.isNotEmpty) {
      // For each category in the filter, add it and all its descendants
      for (final catId in categoryFilters) {
        if (catId is String) {
          matchingCategoryIds.add(catId);
          _addDescendantCategories(catId, categoryProvider, matchingCategoryIds);
        }
      }
    } else if (widget.categoryId != null) {
      // Fallback - add widget.categoryId and all its descendants
      matchingCategoryIds.add(widget.categoryId!);
      _addDescendantCategories(widget.categoryId!, categoryProvider, matchingCategoryIds);
    }
    
    // Apply category filter if we have matching categories
    if (matchingCategoryIds.isNotEmpty) {
      debugPrint('🔍 Category Filter: widget.categoryId=${widget.categoryId}');
      debugPrint('🔍 Matching category IDs: $matchingCategoryIds');
      debugPrint('🔍 Total products before filter: ${filtered.length}');
      debugPrint('🔍 Product categoryIds: ${filtered.take(5).map((p) => '${p.name}: cat=${p.categoryId}, sub=${p.subCategoryId}').join(', ')}');
      
      // Match products by EITHER categoryId OR subCategoryId
      filtered = filtered.where((p) => 
        matchingCategoryIds.contains(p.categoryId) || 
        (p.subCategoryId != null && matchingCategoryIds.contains(p.subCategoryId))
      ).toList();
      debugPrint('🔍 Products after filter: ${filtered.length}');
    }
    
    // 2. Search
    if (_searchQuery.isNotEmpty) {
      filtered = filtered.where((p) {
        final q = _searchQuery.toLowerCase();
        return p.name.toLowerCase().contains(q) || 
               p.description.toLowerCase().contains(q);
      }).toList();
    }
    
    // 3. Special Modes
    if (widget.showDeals) {
       filtered = filtered.where((p) => p.discount > 0).toList();
    }

    // 4. Other Filters
    if (_appliedFilters.isNotEmpty) {
      // Price Range
      final priceRange = _appliedFilters['priceRange'] as RangeValues?;
      if (priceRange != null) {
        filtered = filtered.where((p) => p.price >= priceRange.start && p.price <= priceRange.end).toList();
      }
      
      // Min Rating (can be int or double)
      final minRating = _appliedFilters['minRating'];
      if (minRating != null && minRating is num && minRating > 0) {
        filtered = filtered.where((p) => p.rating >= minRating).toList();
      }
      
      // Min Discount (int from new filter drawer)
      final minDiscount = _appliedFilters['minDiscount'];
      if (minDiscount != null && minDiscount is num && minDiscount > 0) {
        filtered = filtered.where((p) => p.discount >= minDiscount).toList();
      }
      
      // Deals only (toggle from new filter drawer)
      if (_appliedFilters['dealsOnly'] == true) {
        filtered = filtered.where((p) => p.discount > 0).toList();
      }
      
      // Dynamic attribute filters
      final attrFilters = _appliedFilters['attributeFilters'] as Map<String, dynamic>?;
      if (attrFilters != null && attrFilters.isNotEmpty) {
        for (final entry in attrFilters.entries) {
          final key = entry.key;
          final values = entry.value as List?;
          if (values != null && values.isNotEmpty) {
            filtered = filtered.where((p) {
              final productValue = p.attributes[key] ?? p.specifications?[key];
              if (productValue == null) return false;
              if (productValue is String) {
                return values.contains(productValue);
              } else if (productValue is List) {
                return productValue.any((v) => values.contains(v));
              }
              return false;
            }).toList();
          }
        }
      }
    }

    // 5. Sorting
    switch (_sortBy) {
      case 'price_low':
        filtered.sort((a, b) => a.price.compareTo(b.price));
        break;
      case 'price_high':
        filtered.sort((a, b) => b.price.compareTo(a.price));
        break;
      case 'popular':
        filtered.sort((a, b) => b.reviewCount.compareTo(a.reviewCount));
        break;
      case 'newest':
      default:
        // Assuming products are already sorted by newest or no timestamp field
        break;
    }

    return filtered;
  }

  /// Recursively adds all descendant category IDs to the set
  void _addDescendantCategories(String parentId, CategoryProvider provider, Set<String> categoryIds) {
    final children = provider.getSubCategories(parentId);
    debugPrint('🔍 _addDescendantCategories: parentId=$parentId, found ${children.length} children');
    if (children.isNotEmpty) {
      debugPrint('🔍 Children: ${children.map((c) => '${c.name}(${c.id})').join(', ')}');
    }
    for (final child in children) {
      categoryIds.add(child.id);
      _addDescendantCategories(child.id, provider, categoryIds);
    }
  }
}