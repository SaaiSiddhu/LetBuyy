import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' hide LoadingOverlay;
import '../../services/store_service.dart';

import '../../services/product_service.dart';
import '../../models/store_model.dart';
import '../../theme/app_theme_colors.dart';
import '../../widgets/shared/loading_overlay.dart';

/// Import Products Screen
/// Select products from seller catalog to add to store
class ImportProductsScreen extends StatefulWidget {
  final StoreModel store;
  final Set<String> alreadySelectedIds;

  const ImportProductsScreen({
    super.key,
    required this.store,
    required this.alreadySelectedIds,
  });

  @override
  State<ImportProductsScreen> createState() => _ImportProductsScreenState();
}

class _ImportProductsScreenState extends State<ImportProductsScreen> {
  List<Map<String, dynamic>> _allProducts = [];
  Set<String> _selectedIds = {};
  bool _isLoading = true;
  bool _isSaving = false;
  String _filter = 'all'; // all, notListed, listed
  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _loadProducts();
  }

  Future<void> _loadProducts() async {
    setState(() => _isLoading = true);
    try {
      final productService = context.read<ProductService>();
      
      // Fetch all products for this store via API
      final allProducts = await productService.fetchProducts(widget.store.id);
      
      // Filter to only show active/approved products
      final products = allProducts
          .where((p) => 
              (p['is_active'] == true || p['isActive'] == true || p['is_active'] == null) &&
              (p['approval_status'] == 'approved' || p['approvalStatus'] == 'approved' || p['approval_status'] == null))
          .toList();
      
      setState(() => _allProducts = products);
    } catch (e) {
      debugPrint('Error loading products: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  List<Map<String, dynamic>> get _filteredProducts {
    switch (_filter) {
      case 'notListed':
        return _allProducts.where((p) => !widget.alreadySelectedIds.contains(p['id'])).toList();
      case 'listed':
        return _allProducts.where((p) => widget.alreadySelectedIds.contains(p['id'])).toList();
      default:
        return _allProducts;
    }
  }

  int get _notListedCount => _allProducts.where((p) => !widget.alreadySelectedIds.contains(p['id'])).length;
  int get _listedCount => widget.alreadySelectedIds.length;

  void _toggleProduct(String productId) {
    if (widget.alreadySelectedIds.contains(productId)) return; // Already in store
    
    setState(() {
      if (_selectedIds.contains(productId)) {
        _selectedIds.remove(productId);
      } else {
        _selectedIds.add(productId);
      }
    });
    HapticFeedback.selectionClick();
  }

  void _selectAllNotListed() {
    setState(() {
      _selectedIds = _allProducts
          .where((p) => !widget.alreadySelectedIds.contains(p['id']))
          .map((p) => p['id'] as String)
          .toSet();
    });
    HapticFeedback.mediumImpact();
  }

  void _clearSelection() {
    setState(() => _selectedIds.clear());
    HapticFeedback.lightImpact();
  }

  Future<void> _addToStore() async {
    if (_selectedIds.isEmpty || _isSaving) return;
    
    setState(() => _isSaving = true);
    try {
      final storeService = context.read<StoreService>();
      
      // Combine existing + new selections
      final allIds = {...widget.alreadySelectedIds, ..._selectedIds}.toList();
      await storeService.updateSelectedProducts(widget.store.id, allIds);
      
      HapticFeedback.heavyImpact();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${_selectedIds.length} products added to store!'),
            backgroundColor: colors.success,
            behavior: SnackBarBehavior.floating,
            margin: const EdgeInsets.all(16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
        Navigator.pop(context, true); // Return true to indicate changes
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: colors.error),
        );
      }
    } finally {
      setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    return LoadingOverlay(
      isLoading: _isLoading,
      child: Scaffold(
        backgroundColor: colors.bgStart,
        body: Container(
          decoration: colors.backgroundGradient,
          child: SafeArea(
            bottom: false,
            child: Column(
              children: [
                _buildHeader(),
                const SizedBox(height: 12),
                _buildConnectionCard(),
                const SizedBox(height: 16),
                _buildFilterTabs(),
                const SizedBox(height: 12),
                Expanded(child: _buildProductGrid()),
                if (_selectedIds.isNotEmpty) _buildBottomBar(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 16, 0),
      child: Row(
        children: [
          // Back Button
          IconButton(
            icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white70, size: 20),
            onPressed: () => Navigator.pop(context),
            style: IconButton.styleFrom(
              backgroundColor: colors.surfaceVariant,
              padding: const EdgeInsets.all(10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(width: 14),
          
          // Title
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Import Products',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: colors.textPrimary,
                  ),
                ),
                Text(
                  '${_allProducts.length} products in your catalog',
                  style: TextStyle(fontSize: 12, color: colors.textSecondary),
                ),
              ],
            ),
          ),
          
          // Select All / Clear
          TextButton(
            onPressed: _selectedIds.isEmpty ? _selectAllNotListed : _clearSelection,
            child: Text(
              _selectedIds.isEmpty ? 'Select All' : 'Clear',
              style: TextStyle(color: AppColors.lavender, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildConnectionCard() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [const Color(0xFF22C55E).withValues(alpha: 0.2), const Color(0xFF22C55E).withValues(alpha: 0.1)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF22C55E).withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFF22C55E).withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check_circle, color: Color(0xFF22C55E), size: 24),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Connected as Seller',
                  style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600),
                ),
                Text(
                  'Products with variants, specs & descriptions included',
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            icon: Icon(Icons.refresh_rounded, color: colors.textSecondary),
            onPressed: _loadProducts,
            tooltip: 'Refresh',
          ),
        ],
      ),
    );
  }

  Widget _buildFilterTabs() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          _buildTab('All', 'all', _allProducts.length),
          const SizedBox(width: 8),
          _buildTab('Not Listed', 'notListed', _notListedCount),
          const SizedBox(width: 8),
          _buildTab('In Store', 'listed', _listedCount),
        ],
      ),
    );
  }

  Widget _buildTab(String label, String value, int count) {
    final isSelected = _filter == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _filter = value),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.lavender : colors.surfaceVariant,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? AppColors.lavender : colors.divider,
            ),
          ),
          child: Column(
            children: [
              Text(
                '$count',
                style: TextStyle(
                  color: isSelected ? Colors.white : colors.textPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
              Text(
                label,
                style: TextStyle(
                  color: isSelected ? Colors.white70 : colors.textSecondary,
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProductGrid() {
    if (_filteredProducts.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.inventory_2_outlined, size: 64, color: colors.textTertiary),
            const SizedBox(height: 16),
            Text(
              _filter == 'notListed' 
                  ? 'All products are listed'
                  : _filter == 'listed'
                      ? 'No products in store yet'
                      : 'No products found',
              style: TextStyle(color: colors.textSecondary, fontSize: 16),
            ),
          ],
        ),
      );
    }

    return GridView.builder(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 0.72,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemCount: _filteredProducts.length,
      itemBuilder: (context, index) {
        final product = _filteredProducts[index];
        final productId = product['id'] as String;
        final isAlreadyListed = widget.alreadySelectedIds.contains(productId);
        final isSelected = _selectedIds.contains(productId);
        
        return _buildProductCard(product, isAlreadyListed, isSelected);
      },
    );
  }

  Widget _buildProductCard(Map<String, dynamic> product, bool isAlreadyListed, bool isSelected) {
    final productId = product['id'] as String;
    final name = product['name'] as String? ?? 'Untitled';
    final salePrice = (product['salePrice'] as num? ?? 0).toDouble();
    final originalPrice = (product['originalPrice'] as num?)?.toDouble();
    final images = product['images'] as List<dynamic>? ?? [];
    final imageUrl = images.isNotEmpty ? images.first as String : null;
    final variants = product['variants'] as List<dynamic>? ?? [];
    final hasVariants = variants.isNotEmpty;
    
    // Calculate discount
    final hasDiscount = originalPrice != null && originalPrice > salePrice;
    final discountPercent = hasDiscount ? ((originalPrice - salePrice) / originalPrice * 100).round() : 0;

    return GestureDetector(
      onTap: () => _toggleProduct(productId),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          color: colors.surfaceVariant,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? AppColors.lavender : (isAlreadyListed ? const Color(0xFF22C55E) : colors.divider),
            width: isSelected || isAlreadyListed ? 2 : 1,
          ),
          boxShadow: isSelected ? [
            BoxShadow(color: AppColors.lavender.withValues(alpha: 0.3), blurRadius: 12),
          ] : [],
        ),
        child: Stack(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Image
                ClipRRect(
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(15)),
                  child: AspectRatio(
                    aspectRatio: 1,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        imageUrl != null
                            ? Image.network(imageUrl, fit: BoxFit.cover)
                            : Container(
                                color: colors.card,
                                child: Icon(Icons.image, size: 48, color: colors.textTertiary),
                              ),
                        // Discount badge
                        if (hasDiscount)
                          Positioned(
                            top: 8,
                            left: 8,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                              decoration: BoxDecoration(
                                color: const Color(0xFFEF4444),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                '$discountPercent% OFF',
                                style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
                
                // Info
                Padding(
                  padding: const EdgeInsets.all(10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: colors.textPrimary,
                          fontWeight: FontWeight.w500,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 4),
                      // Price row
                      Row(
                        children: [
                          Text(
                            '₹${salePrice.toStringAsFixed(0)}',
                            style: const TextStyle(
                              color: Color(0xFF8B5CF6),
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                          if (hasDiscount) ...[
                            const SizedBox(width: 4),
                            Text(
                              '₹${originalPrice!.toStringAsFixed(0)}',
                              style: TextStyle(
                                color: colors.textTertiary,
                                fontSize: 11,
                                decoration: TextDecoration.lineThrough,
                              ),
                            ),
                          ],
                        ],
                      ),
                      // Variants
                      if (hasVariants) ...[
                        const SizedBox(height: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.lavender.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            '${variants.length} variants',
                            style: TextStyle(color: AppColors.lavender, fontSize: 10),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
            
            // Selection indicator
            Positioned(
              top: 8,
              right: 8,
              child: isAlreadyListed
                  ? _buildListedBadge()
                  : _buildCheckbox(isSelected),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildListedBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFF22C55E),
        borderRadius: BorderRadius.circular(8),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.check, color: Colors.white, size: 12),
          SizedBox(width: 4),
          Text('Listed', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _buildCheckbox(bool isSelected) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        color: isSelected ? AppColors.lavender : Colors.black45,
        shape: BoxShape.circle,
        border: Border.all(color: isSelected ? AppColors.lavender : Colors.white54, width: 2),
      ),
      child: isSelected
          ? const Icon(Icons.check, color: Colors.white, size: 16)
          : null,
    );
  }

  Widget _buildBottomBar() {
    return Container(
      padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(context).padding.bottom + 16),
      decoration: BoxDecoration(
        color: colors.card,
        border: Border(top: BorderSide(color: colors.divider)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '${_selectedIds.length} products selected',
                  style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600),
                ),
                Text(
                  'Will be added to your store',
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          ElevatedButton(
            onPressed: _isSaving ? null : _addToStore,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.lavender,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: _isSaving
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Add to Store', style: TextStyle(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}
