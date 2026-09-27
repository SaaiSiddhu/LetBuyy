// lib/screens/search/mobile_search_screen.dart
// Amazon-style search screen with:
// - Hero animation search bar matching home screen
// - Recent searches (max 5) with delete
// - Trending searches (admin-managed from Firestore)
// - Keyword autocomplete while typing (limited to 10)

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';

import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';

import '../shop/widgets/product_card.dart';
import '../shop/widgets/sort_bottom_sheet.dart';
import '../shop/widgets/filter_drawer.dart';
import '../shop/mobile_shop_screen.dart';
import '../../widgets/premium_scaffold.dart';
import '../../providers/search_provider.dart';

import 'widgets/amazon_search_bar.dart'; // ✅ Added

class MobileSearchScreen extends StatefulWidget {
  const MobileSearchScreen({super.key});

  @override
  State<MobileSearchScreen> createState() => _MobileSearchScreenState();
}

class _MobileSearchScreenState extends State<MobileSearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  List<ProductModel> _searchResults = [];
  List<String> _keywordSuggestions = [];
  List<CategoryModel> _matchingCategories = [];  // NEW: Matching categories
  bool _isSearching = false;
  bool _isLoadingKeywords = false;
  String _searchQuery = '';
  bool _hasSubmittedSearch = false;

  // Sorting and filtering state
  String _sortMethod = 'newest';
  Map<String, dynamic> _filters = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // Check for initial query from voice search
      final args = ModalRoute.of(context)?.settings.arguments;
      if (args is Map<String, dynamic> && args['query'] != null) {
        final initialQuery = args['query'] as String;
        if (initialQuery.isNotEmpty) {
          _searchController.text = initialQuery;
          _submitSearch(initialQuery);
          return;
        }
      }
      
      // Request focus for the search bar
      _searchFocusNode.requestFocus();
      // Pre-load categories for the "Popular Categories" section
      Provider.of<CategoryProvider>(context, listen: false).loadCategories();
    });
    
    // Listen to search text changes for autocomplete
    _searchController.addListener(_onSearchChanged);
  }

  void _onSearchChanged() {
    final query = _searchController.text.trim();
    
    if (query.isEmpty) {
      setState(() {
        _searchQuery = '';
        _keywordSuggestions = [];
        _matchingCategories = [];  // Clear categories too
        _searchResults = [];
        _isSearching = false;
        _hasSubmittedSearch = false;
      });
      return;
    }
    
    // If typing (not submitted), fetch suggestions immediately (1+ character)
    if (!_hasSubmittedSearch && query.isNotEmpty) {
      _fetchKeywordSuggestions(query);
      _searchMatchingCategories(query);  // Search categories
    }
    
    setState(() {
      _searchQuery = query;
    });
  }

  /// Fetch keyword suggestions from CACHED products (instant results)
  void _fetchKeywordSuggestions(String query) {
    if (_isLoadingKeywords) return;
    
    setState(() => _isLoadingKeywords = true);
    
    try {
      final queryLower = query.toLowerCase();
      
      // Use cached products from ProductProvider (INSTANT - no Firestore query)
      final productProvider = Provider.of<ProductProvider>(context, listen: false);
      final products = productProvider.products;
      
      // Extract unique keywords that match the query
      final Set<String> matchingKeywords = {};
      
      for (final product in products) {
        final productName = product.name.toLowerCase();
        
        // Add matching keywords from product
        for (final keyword in product.keywords) {
          if (keyword.toLowerCase().contains(queryLower)) {
            matchingKeywords.add(keyword.toLowerCase());
          }
        }
        
        // Also add product names as suggestions
        if (productName.contains(queryLower)) {
          matchingKeywords.add(productName);
        }
      }
      
      // Sort by relevance (exact match first, then by length)
      final sortedKeywords = matchingKeywords.toList()
        ..sort((a, b) {
          final aExact = a.startsWith(queryLower);
          final bExact = b.startsWith(queryLower);
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;
          return a.length.compareTo(b.length);
        });
      
      if (mounted) {
        setState(() {
          _keywordSuggestions = sortedKeywords.take(10).toList(); // Limit to 10
          _isLoadingKeywords = false;
        });
      }
    } catch (e) {
      debugPrint('Error fetching keyword suggestions: $e');
      if (mounted) {
        setState(() => _isLoadingKeywords = false);
      }
    }
  }

  /// Search matching categories using CategoryProvider
  void _searchMatchingCategories(String query) {
    if (!mounted) return;
    
    final categoryProvider = Provider.of<CategoryProvider>(context, listen: false);
    final matchingCategories = categoryProvider.searchCategories(query);
    
    // Limit to 5 categories, prioritize main categories (level 0)
    final sorted = matchingCategories.toList()
      ..sort((a, b) {
        // Main categories first
        if (a.level != b.level) return a.level.compareTo(b.level);
        // Then by name match relevance
        final aStartsWith = a.name.toLowerCase().startsWith(query.toLowerCase());
        final bStartsWith = b.name.toLowerCase().startsWith(query.toLowerCase());
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        return a.name.compareTo(b.name);
      });
    
    setState(() {
      _matchingCategories = sorted.take(5).toList();
    });
  }

  void _submitSearch(String query) {
    if (query.isEmpty) return;
    
    // Add to search history
    Provider.of<SearchProvider>(context, listen: false).searchProducts(query);
    
    // Navigate to Shop Screen with search query (results show there)
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (_) => MobileShopScreen(searchQuery: query),
      ),
    );
  }

  void _clearSearch() {
    _searchController.clear();
    setState(() {
      _searchQuery = '';
      _searchResults = [];
      _keywordSuggestions = [];
      _isSearching = false;
      _hasSubmittedSearch = false;
    });
    _searchFocusNode.requestFocus();
  }

  void _updateResults() {
    if (!_isSearching) setState(() => _isSearching = true);

    final productProvider = Provider.of<ProductProvider>(context, listen: false);
    List<ProductModel> results = productProvider.products;

    // 1. SEARCH
    if (_searchQuery.isNotEmpty) {
      final searchLower = _searchQuery.toLowerCase();
      results = results.where((product) {
        final nameMatch = product.name.toLowerCase().contains(searchLower);
        final descMatch = product.description.toLowerCase().contains(searchLower);
        final keywordMatch = product.keywords.any((k) => k.toLowerCase().contains(searchLower));
        return nameMatch || descMatch || keywordMatch;
      }).toList();
    }

    // 2. FILTER
    if (_filters.isNotEmpty) {
      final RangeValues? priceRange = _filters['priceRange'];
      if (priceRange != null) {
        results = results.where((p) =>
            p.price >= priceRange.start && p.price <= priceRange.end).toList();
      }
      final double? minRating = _filters['minRating'];
      if (minRating != null && minRating > 0) {
        results = results.where((p) => p.rating >= minRating).toList();
      }
      final List<String>? categories = _filters['categories'];
      if (categories != null && categories.isNotEmpty) {
        results = results.where((p) => categories.contains(p.categoryId)).toList();
      }
      if (_filters['inStock'] == true) {
        // C2 corrective (27 September 2026 review, finding 1): "unknown stock is not proven
        // sold-out" -- an in-stock-only filter must not silently exclude every canonical
        // feed-level result (stockKnown always false there) just because it can't confirm them;
        // it excludes only a real, observed zero.
        results = results.where((p) => !p.stockKnown || p.stock > 0).toList();
      }
    }

    // 3. SORT
    switch (_sortMethod) {
      case 'price_low':
        results.sort((a, b) => a.price.compareTo(b.price));
        break;
      case 'price_high':
        results.sort((a, b) => b.price.compareTo(a.price));
        break;
      case 'rating':
        results.sort((a, b) => b.rating.compareTo(a.rating));
        break;
      case 'popular':
        results.sort((a, b) => b.reviewCount.compareTo(a.reviewCount));
        break;
      case 'newest':
      default:
        results.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    }

    setState(() {
      _searchResults = results;
      _isSearching = false;
    });
  }

  @override
  void dispose() {
    _searchController.removeListener(_onSearchChanged);
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;
    final isMobile = MediaQuery.of(context).size.width < 800;
    // Scaffold handles keyboard insets automatically
    const bottomPadding = 0.0;

    return GestureDetector(
      // 🔥 TAP-TO-DISMISS: Dismiss keyboard when tapping outside search field
      onTap: () {
        FocusScope.of(context).unfocus();
      },
      behavior: HitTestBehavior.opaque,
      child: PremiumScaffold(
        scaffoldKey: _scaffoldKey,
        endDrawer: FilterDrawer(
          initialFilters: _filters,
          onApply: (newFilters) {
            setState(() => _filters = newFilters);
            if (_hasSubmittedSearch) _updateResults();
          },
        ),
        body: Stack(
          children: [
            Column(
              children: [
                // Amazon-style Search Bar (Gradient covers safe area)
                // Usin isolated widget to prevent rebuilds
                AmazonSearchBar(
                  controller: _searchController,
                  focusNode: _searchFocusNode,
                  onClear: _clearSearch,
                  onSubmitted: _submitSearch,
                  searchQuery: _searchQuery,
                  isDark: isDark,
                ),
                
                // Body content
                Expanded(
                  child: _buildBody(isMobile, isDark, bottomPadding),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // _buildAmazonSearchBar method removed - replaced by AmazonSearchBar widget

  Widget _buildBody(bool isMobile, bool isDark, double bottomPadding) {
    // If we have keyword suggestions (user is typing), show them
    if (_keywordSuggestions.isNotEmpty && !_hasSubmittedSearch) {
      return _buildKeywordSuggestions(isDark, bottomPadding);
    }
    
    // If loading
    if (_isSearching) {
      return Center(
        child: CircularProgressIndicator(
          color: isDark ? AppColors.primaryLight : AppColors.primary,
        ),
      );
    }

    // If no search submitted yet, show empty state
    if (!_hasSubmittedSearch) {
      return _buildEmptyState(isMobile, isDark, bottomPadding);
    }

    // If no results
    if (_searchResults.isEmpty) {
      return _buildNoResults(isMobile, isDark);
    }

    // Show search results with filter/sort options
    return Column(
      children: [
        // Filter/Sort bar
        _buildFilterSortBar(isDark),
        // Results grid
        Expanded(
          child: GridView.builder(
            // Add bottom padding for keyboard
            padding: EdgeInsets.fromLTRB(
              isMobile ? 12 : 24, 
              isMobile ? 12 : 24, 
              isMobile ? 12 : 24, 
              (isMobile ? 12 : 24) + bottomPadding // ✅ Keyboard padding
            ),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: isMobile ? 2 : 4,
              childAspectRatio: 0.60,
              crossAxisSpacing: isMobile ? 12 : 20,
              mainAxisSpacing: isMobile ? 12 : 20,
            ),
            itemCount: _searchResults.length,
            itemBuilder: (context, index) {
              return ProductCard(
                product: _searchResults[index],
                isGridView: true,
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildFilterSortBar(bool isDark) {
    final activeFilters = _filters.values.where((v) {
      if (v is bool) return v == true;
      if (v is List) return v.isNotEmpty;
      return false;
    }).length;

    // ... kept same logic ...
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        border: Border(
          bottom: BorderSide(color: isDark ? Colors.grey[800]! : Colors.grey[200]!),
        ),
      ),
      child: Row(
        children: [
          Text(
            '${_searchResults.length} results',
            style: TextStyle(
              color: isDark ? Colors.white70 : Colors.black54,
              fontWeight: FontWeight.w500,
            ),
          ),
          const Spacer(),
          // Sort button
          TextButton.icon(
            onPressed: () {
              HapticFeedback.lightImpact();
              showModalBottomSheet(
                context: context,
                backgroundColor: Colors.transparent,
                isScrollControlled: true,
                builder: (context) => SortBottomSheet(
                  currentSort: _sortMethod,
                  onSort: (newSort) {
                    setState(() => _sortMethod = newSort);
                    _updateResults();
                  },
                ),
              );
            },
            icon: Icon(Icons.sort, size: 18, color: isDark ? AppColors.primaryLight : AppColors.primary),
            label: Text('Sort', style: TextStyle(color: isDark ? AppColors.primaryLight : AppColors.primary)),
          ),
          // Filter button
          TextButton.icon(
            onPressed: () {
              HapticFeedback.lightImpact();
              _scaffoldKey.currentState?.openEndDrawer();
            },
            icon: Badge(
              isLabelVisible: activeFilters > 0,
              label: Text('$activeFilters'),
              child: Icon(Icons.filter_list, size: 18, color: isDark ? AppColors.primaryLight : AppColors.primary),
            ),
            label: Text('Filter', style: TextStyle(color: isDark ? AppColors.primaryLight : AppColors.primary)),
          ),
        ],
      ),
    );
  }

  /// Shows category chips + keyword autocomplete suggestions while typing
  Widget _buildKeywordSuggestions(bool isDark, double bottomPadding) {
    return ListView(
      padding: EdgeInsets.only(top: 8, bottom: 8 + bottomPadding), // ✅ Keyboard padding
      children: [
        // Category chips (if any matching)
        if (_matchingCategories.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Row(
              children: [
                Icon(Icons.category_outlined, size: 16, 
                    color: isDark ? Colors.white54 : Colors.grey[600]),
                const SizedBox(width: 6),
                Text(
                  'Categories',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),
          SizedBox(
            height: 44,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: _matchingCategories.length,
              itemBuilder: (context, index) {
                final category = _matchingCategories[index];
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ActionChip(
                    avatar: Icon(
                      Icons.folder_outlined, 
                      size: 16,
                      color: isDark ? Colors.white70 : Colors.grey[700],
                    ),
                    label: Text(
                      category.name,
                      style: TextStyle(
                        fontSize: 13,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                    ),
                    backgroundColor: isDark 
                        ? Colors.white.withValues(alpha: 0.08) 
                        : Colors.grey[100],
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                      side: BorderSide(
                        color: isDark ? Colors.white12 : Colors.grey[300]!,
                      ),
                    ),
                    onPressed: () {
                      HapticFeedback.lightImpact();
                      // Navigate to shop with category filter
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => MobileShopScreen(categoryId: category.id),
                        ),
                      );
                    },
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 8),
          Divider(
            color: isDark ? Colors.white10 : Colors.grey[200],
            indent: 16,
            endIndent: 16,
          ),
        ],
        
        // Keyword suggestions header
        if (_keywordSuggestions.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Text(
              'Suggestions',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.grey[400] : Colors.grey[600],
              ),
            ),
          ),
        
        // Keyword suggestions list
        ..._keywordSuggestions.map((keyword) => ListTile(
          leading: Icon(
            Icons.search,
            color: isDark ? Colors.white54 : Colors.grey[600],
            size: 20,
          ),
          title: Text(
            keyword,
            style: TextStyle(
              color: isDark ? Colors.white : Colors.black87,
              fontSize: 15,
            ),
          ),
          trailing: Icon(
            Icons.north_west,
            color: isDark ? Colors.white38 : Colors.grey[400],
            size: 16,
          ),
          onTap: () {
            _searchController.text = keyword;
            _submitSearch(keyword);
          },
        )),
      ],
    );
  }

  /// Empty state: Recent searches + Trending searches
  Widget _buildEmptyState(bool isMobile, bool isDark, double bottomPadding) {
    return ListView(
      padding: EdgeInsets.only(bottom: bottomPadding), // ✅ Keyboard padding
      children: [
        _buildRecentSearchesSection(isDark),
        _buildTrendingSearchesSection(isDark),
        _buildPopularCategoriesSection(isDark),
      ],
    );
  }

  /// Recent searches section (max 5)
  Widget _buildRecentSearchesSection(bool isDark) {
    return Consumer<SearchProvider>(
      builder: (context, searchProvider, child) {
        final recentSearches = searchProvider.searchHistory.take(5).toList();
        
        if (recentSearches.isEmpty) return const SizedBox.shrink();
        
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Row(
                children: [
                  Text(
                    'Recent Searches',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  const Spacer(),
                  TextButton(
                    onPressed: () => searchProvider.clearHistory(),
                    child: Text(
                      'Clear all',
                      style: TextStyle(
                        fontSize: 13,
                        color: isDark ? AppColors.primaryLight : AppColors.primary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            ...recentSearches.map((query) => ListTile(
              leading: Icon(
                Icons.history,
                color: isDark ? Colors.white54 : Colors.grey[600],
                size: 20,
              ),
              title: Text(
                query,
                style: TextStyle(
                  color: isDark ? Colors.white : Colors.black87,
                  fontSize: 15,
                ),
              ),
              trailing: GestureDetector(
                onTap: () => searchProvider.removeFromHistory(query),
                child: Icon(
                  Icons.close,
                  color: isDark ? Colors.white38 : Colors.grey[400],
                  size: 18,
                ),
              ),
              onTap: () {
                _searchController.text = query;
                _submitSearch(query);
              },
            )),
          ],
        );
      },
    );
  }

  // C2 (canonical rewire fallout): built a raw, unguarded FirebaseFirestore.instance().snapshots()
  // as a StreamBuilder's `stream:` argument -- evaluated synchronously during build(), unconditionally,
  // since _buildEmptyState (the Search screen's default view, before a user has typed anything)
  // rendered this with no guard at all. FirebaseFirestore.instance throws synchronously with no
  // Firebase app initialized (confirmed empirically elsewhere this phase), so opening the Search
  // screen crashed immediately, on every visit. "Trending searches" is an admin-curated Firestore
  // collection with no canonical successor -- a named later-phase capability, same as Reels --
  // so this now shows nothing rather than a fabricated or crashing "trending" section.
  Widget _buildTrendingSearchesSection(bool isDark) {
    return const SizedBox.shrink();
  }

  Widget _buildPopularCategoriesSection(bool isDark) {
    return Consumer<CategoryProvider>(
      builder: (context, provider, child) {
        if (provider.isLoading && provider.allCategories.isEmpty) {
          return const SizedBox.shrink();
        }
        if (provider.allCategories.isEmpty) {
          return const SizedBox.shrink();
        }

        final categories = provider.allCategories.take(6).toList();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 24, 16, 12),
              child: Text(
                'Popular Categories',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: GridView.builder(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  childAspectRatio: 1.0,
                ),
                itemCount: categories.length,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemBuilder: (context, index) {
                  final category = categories[index];
                  return InkWell(
                    onTap: () {
                      setState(() {
                        _filters = {'categories': [category.id]};
                        _searchQuery = category.name;
                        _searchController.text = category.name;
                      });
                      _submitSearch(category.name);
                    },
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.05),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          if (category.iconImageUrl != null)
                            CircleAvatar(
                              radius: 24,
                              backgroundColor: isDark ? Colors.grey[800] : Colors.grey[100],
                              backgroundImage: NetworkImage(category.iconImageUrl!),
                            )
                          else
                            CircleAvatar(
                              radius: 24,
                              backgroundColor: isDark ? Colors.grey[800] : Colors.grey[100],
                              child: Icon(
                                Icons.category,
                                size: 20,
                                color: isDark ? AppColors.primaryLight : AppColors.primary,
                              ),
                            ),
                          const SizedBox(height: 8),
                          Text(
                            category.name,
                            textAlign: TextAlign.center,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: isDark ? Colors.white : Colors.black87,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 24),
          ],
        );
      },
    );
  }

  Widget _buildNoResults(bool isMobile, bool isDark) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(isMobile ? 40 : 60),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            FaIcon(
              FontAwesomeIcons.magnifyingGlassDollar,
              size: isMobile ? 80 : 100,
              color: (isDark ? Colors.white24 : Colors.grey[300]),
            ),
            SizedBox(height: isMobile ? 24 : 32),
            Text(
              'No products found',
              style: TextStyle(
                fontSize: isMobile ? 20 : 24,
                fontWeight: FontWeight.bold,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Try adjusting your search or filters',
              style: TextStyle(
                fontSize: 14,
                color: isDark ? Colors.white54 : Colors.black54,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}