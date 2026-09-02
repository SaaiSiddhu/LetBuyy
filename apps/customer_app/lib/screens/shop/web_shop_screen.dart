// lib/screens/user/shop/web_shop_screen.dart

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace/app/routes.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
// ✅ FIXED: Added missing import
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'widgets/product_card.dart';

class WebShopScreen extends StatefulWidget {
  final String? categoryId;
  final bool showRecentlyViewed;
  final bool showDeals;

  const WebShopScreen({
    super.key,
    this.categoryId,
    this.showRecentlyViewed = false,
    this.showDeals = false,
  });

  @override
  State<WebShopScreen> createState() => _WebShopScreenState();
}

class _WebShopScreenState extends State<WebShopScreen> {
  String _selectedCategory = 'All';
  final String _sortBy = 'newest';
  RangeValues _priceRange = const RangeValues(0, 10000);

  @override
  void initState() {
    super.initState();
    
    if (widget.categoryId != null) {
      _selectedCategory = widget.categoryId!;
    }
    
    _loadData();
  }

  void _loadData() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      Provider.of<ProductProvider>(context, listen: false).loadProducts();
      Provider.of<CategoryProvider>(context, listen: false).loadCategories();
    });
  }

  @override
  Widget build(BuildContext context) {
    String title = 'Shop';
    if (widget.showRecentlyViewed) {
      title = 'Recently Viewed';
    } else if (widget.showDeals) {
      title = 'Deals For You';
    } else if (widget.categoryId != null && widget.categoryId != 'All') {
      final catName = Provider.of<CategoryProvider>(context, listen: false)
          .getCategoryById(widget.categoryId!)
          ?.name;
      title = catName ?? 'Shop';
    }

    return Scaffold(
      resizeToAvoidBottomInset: false, // 🔥 KEYBOARD FIX
      backgroundColor: AppColors.background,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        backgroundColor: Colors.white,
        elevation: 0,
        title: Text(
          title,
          style: AppTextStyles.headlineMedium.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: ElevatedButton.icon(
              onPressed: () {
                AppRoutes.navigateTo(context, AppRoutes.search);
              },
              icon: const Icon(Icons.search),
              label: const Text('Search Products'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                elevation: 0,
              ),
            ),
          ),
        ],
      ),
      body: Row(
        children: [
          if (!widget.showRecentlyViewed && !widget.showDeals)
            Container(
              width: 280,
              color: Colors.white,
              child: _buildSidebar(),
            ),
          Expanded(
            child: Consumer<ProductProvider>(
              builder: (context, productProvider, child) {
                if (productProvider.isLoading) {
                  return const Center(child: CircularProgressIndicator());
                }

                final products = _getFilteredProducts(productProvider);

                if (products.isEmpty) {
                  return _buildEmptyState();
                }

                return GridView.builder(
                  padding: const EdgeInsets.all(40),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 4,
                    childAspectRatio: 0.6,
                    crossAxisSpacing: 20,
                    mainAxisSpacing: 20,
                  ),
                  itemCount: products.length,
                  itemBuilder: (context, index) {
                    return ProductCard(
                      product: products[index],
                      isGridView: true,
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSidebar() {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          'Filters',
          style: AppTextStyles.titleLarge.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 24),
        Text(
          'Categories',
          style: AppTextStyles.titleMedium.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 12),
        Consumer<CategoryProvider>(
          builder: (context, categoryProvider, child) {
            final categories = [
              // ✅ FIXED: Instantiated the 'All' category correctly
              CategoryModel(
                  id: 'All',
                  name: 'All',
                  description: '',
                  createdAt: DateTime.now()),
              ...categoryProvider.mainCategories
            ];
            return Column(
              children: categories.map((category) {
                final isSelected = _selectedCategory == category.id;
                return RadioListTile<String>(
                  title: Text(category.name),
                  value: category.id,
                  groupValue: _selectedCategory,
                  onChanged: (value) {
                    setState(() {
                      _selectedCategory = value!;
                    });
                  },
                  activeColor: AppColors.primary,
                  contentPadding: EdgeInsets.zero,
                );
              }).toList(),
            );
          },
        ),
        const SizedBox(height: 24),
        Text(
          'Price Range',
          style: AppTextStyles.titleMedium.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 12),
        RangeSlider(
          values: _priceRange,
          min: 0,
          max: 10000,
          divisions: 100,
          activeColor: AppColors.primary,
          labels: RangeLabels(
            '₹${_priceRange.start.round()}',
            '₹${_priceRange.end.round()}',
          ),
          onChanged: (values) {
            setState(() {
              _priceRange = values;
            });
          },
        ),
      ],
    );
  }

  List<ProductModel> _getFilteredProducts(ProductProvider provider) {
    var products = provider.products;
    
    if (widget.showRecentlyViewed) {
      products.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      return products.take(20).toList();
    }
    
    if (widget.showDeals) {
      products = products.where((p) => p.discount > 0).toList();
      products.sort((a, b) => b.discount.compareTo(a.discount));
      return products;
    }
    
    if (_selectedCategory != 'All') {
      products = products.where((p) => p.categoryId == _selectedCategory).toList();
    }
    
    products = products.where((p) =>
      p.price >= _priceRange.start && p.price <= _priceRange.end
    ).toList();
    
    switch (_sortBy) {
      case 'price_low':
        products.sort((a, b) => a.price.compareTo(b.price));
        break;
      case 'price_high':
        products.sort((a, b) => b.price.compareTo(a.price));
        break;
      case 'rating':
        products.sort((a, b) => b.rating.compareTo(a.rating));
        break;
    }
    
    return products;
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.shopping_bag_outlined,
            size: 120,
            color: Colors.grey[300],
          ),
          const SizedBox(height: 24),
          Text(
            'No products found',
            style: AppTextStyles.headlineSmall.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}