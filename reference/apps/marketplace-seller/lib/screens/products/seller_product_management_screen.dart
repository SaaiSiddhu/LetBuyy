// lib/screens/seller/products/seller_product_management_screen.dart
// Advanced Seller Product Management Screen with Professional Features
// Matches order management design with animated backgrounds, tabs, bulk actions

import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_animate/flutter_animate.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../providers/seller_provider.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_core/letbuyy_core.dart';
import 'seller_product_form_screen.dart';
import 'widgets/seller_product_card.dart';
import 'widgets/professional_product_header.dart';
import 'widgets/smart_product_search.dart';
import 'widgets/product_status_tab_bar.dart';
import 'widgets/bulk_product_action_bar.dart';
import 'widgets/smart_product_notification.dart';
import 'widgets/product_data_table.dart';
import 'widgets/bulk_edit_bottom_sheet.dart';
import 'widgets/export_options_sheet.dart';

// ═══════════════════════════════════════════════════════════════════════════
// ENUMS & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

enum ProductSortOption {
  dateNewest('Newest', 'createdAt', true),
  dateOldest('Oldest', 'createdAt', false),
  priceHighest('Price ↓', 'salePrice', true),
  priceLowest('Price ↑', 'salePrice', false),
  nameAsc('Name A-Z', 'name', false),
  stockLow('Stock ↓', 'stock', false);

  final String label;
  final String field;
  final bool descending;
  const ProductSortOption(this.label, this.field, this.descending);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SCREEN WIDGET
// ═══════════════════════════════════════════════════════════════════════════

class SellerProductManagementScreen extends StatefulWidget {
  const SellerProductManagementScreen({super.key});

  @override
  State<SellerProductManagementScreen> createState() =>
      _SellerProductManagementScreenState();
}

class _SellerProductManagementScreenState
    extends State<SellerProductManagementScreen>
    with TickerProviderStateMixin, AutomaticKeepAliveClientMixin {
  // ═══════════════════════════════════════════════════════════════════════
  // CONTROLLERS & STATE
  // ═══════════════════════════════════════════════════════════════════════

  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final TextEditingController _searchController = TextEditingController();
  late TabController _tabController;
  
  // Animation Controllers
  late AnimationController _bgAnimController;
  late AnimationController _floatController;

  // Search & Filter State
  String _searchQuery = '';
  int _statusFilterIndex = 0;
  ProductSortOption _sortOption = ProductSortOption.dateNewest;
  final Set<QuickProductFilter> _activeQuickFilters = {};

  // UI State
  bool _isSelectionMode = false;
  final Set<String> _selectedProductIds = {};
  bool _isRefreshing = false;
  bool _isLiveRefreshEnabled = true;
  bool _isTableView = false;  // Toggle between card and table view

  // Tab Counts
  ProductTabCounts _tabCounts = const ProductTabCounts();
  int _lowStockCount = 0;
  int _alertBadgeCount = 0;  // Total alerts for bell icon badge

  // Cached Stream
  Stream<QuerySnapshot>? _cachedProductsStream;
  String? _currentSellerId;

  // Smart Notifications Queue
  final List<_NotificationData> _notificationQueue = [];
  _NotificationData? _currentNotification;
  bool _showNotification = false;
  int _totalNotifications = 0;
  int _currentNotificationIndex = 0;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _initAnimations();
    _tabController = TabController(length: 6, vsync: this);
    _tabController.addListener(_onTabChanged);
    
    // ✅ Refresh product stats from orders when screen loads
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _refreshProductStats();
      _checkAndShowSmartNotifications();
    });
  }

  /// Check and queue all applicable notifications
  Future<void> _checkAndShowSmartNotifications() async {
    // Check if dismissed for today
    final shouldShow = await SmartProductNotification.shouldShowToday();
    if (!shouldShow) return;

    final sellerId = Provider.of<SellerProvider>(context, listen: false).sellerId;
    if (sellerId == null) return;

    _notificationQueue.clear();

    try {
      // 1. Check for out of stock products
      final outOfStockSnap = await _firestore
          .collection('products')
          .where('sellerId', isEqualTo: sellerId)
          .where('stock', isEqualTo: 0)
          .get();

      if (outOfStockSnap.docs.isNotEmpty) {
        _notificationQueue.add(_NotificationData(
          type: ProductNotificationType.outOfStock,
          count: outOfStockSnap.docs.length,
        ));
      }

      // 2. Check for low stock products (simplified query - filter in memory)
      final allProductsSnap = await _firestore
          .collection('products')
          .where('sellerId', isEqualTo: sellerId)
          .get();

      final lowStockCount = allProductsSnap.docs.where((doc) {
        final stock = (doc.data()['stock'] ?? 0) as int;
        return stock > 0 && stock < 10;
      }).length;

      if (lowStockCount > 0) {
        _notificationQueue.add(_NotificationData(
          type: ProductNotificationType.lowStock,
          count: lowStockCount,
        ));
      }

      // 3. Check for winning product (most orders > 20)
      final winningProducts = allProductsSnap.docs.where((doc) {
        final orders = (doc.data()['totalOrders'] ?? 0) as int;
        return orders > 20;
      }).toList();

      if (winningProducts.isNotEmpty) {
        // Sort by totalOrders descending
        winningProducts.sort((a, b) => 
          ((b.data()['totalOrders'] ?? 0) as int).compareTo((a.data()['totalOrders'] ?? 0) as int)
        );
        final topProduct = winningProducts.first.data();
        _notificationQueue.add(_NotificationData(
          type: ProductNotificationType.winning,
          count: 1,
          productName: topProduct['name'] ?? 'Your Product',
        ));
      }

      // Calculate total badge count for bell icon
      int badgeCount = outOfStockSnap.docs.length + lowStockCount;
      if (winningProducts.isNotEmpty) badgeCount += 1;
      
      setState(() {
        _alertBadgeCount = badgeCount;
      });

      // Show first notification if queue not empty
      if (_notificationQueue.isNotEmpty) {
        _totalNotifications = _notificationQueue.length;
        _currentNotificationIndex = 0;
        _showNextNotification();
      }
    } catch (e) {
      debugPrint('⚠️ Error checking smart notifications: $e');
    }
  }

  /// Show next notification in queue
  void _showNextNotification() {
    if (_notificationQueue.isEmpty) {
      setState(() {
        _showNotification = false;
        _currentNotification = null;
        _currentNotificationIndex = 0;
      });
      return;
    }

    setState(() {
      _currentNotification = _notificationQueue.removeAt(0);
      _showNotification = true;
    });
  }

  /// Handle notification close - show next in queue
  void _onNotificationClosed() {
    // Small delay before showing next notification
    Future.delayed(const Duration(milliseconds: 600), () {
      if (mounted && _notificationQueue.isNotEmpty) {
        _currentNotificationIndex++;
        _showNextNotification();
      } else if (mounted) {
        setState(() {
          _showNotification = false;
          _currentNotification = null;
          _currentNotificationIndex = 0;
          _totalNotifications = 0;
        });
      }
    });
  }

  /// Refresh product stats (orders, revenue) from order history  
  Future<void> _refreshProductStats() async {
    final sellerId = Provider.of<SellerProvider>(context, listen: false).sellerId;
    if (sellerId != null) {
      try {
        await ProductStatsService.updateStatsForSeller(sellerId);
        debugPrint('✅ Product stats refreshed for seller: $sellerId');
      } catch (e) {
        debugPrint('⚠️ Error refreshing product stats: $e');
      }
    }
  }

  void _initAnimations() {
    _bgAnimController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 25),
    )..repeat();

    _floatController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4000),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _bgAnimController.dispose();
    _floatController.dispose();
    _searchController.dispose();
    _tabController.dispose();
    super.dispose();
  }

  void _onTabChanged() {
    if (_tabController.indexIsChanging) {
      setState(() {
        _statusFilterIndex = _tabController.index;
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DATA LAYER
  // ═══════════════════════════════════════════════════════════════════════

  Stream<QuerySnapshot> _getProductsStream(String sellerId) {
    if (_cachedProductsStream == null || _currentSellerId != sellerId) {
      _currentSellerId = sellerId;
      _cachedProductsStream = _firestore
          .collection('products')
          .where('sellerId', isEqualTo: sellerId)
          .orderBy(_sortOption.field, descending: _sortOption.descending)
          .snapshots();
    }
    return _cachedProductsStream!;
  }

  void _refreshProducts() {
    setState(() {
      _isRefreshing = true;
      _cachedProductsStream = null;
    });
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) setState(() => _isRefreshing = false);
    });
  }

  void _updateTabCounts(List<DocumentSnapshot> docs) {
    int all = docs.length;
    int active = 0, inactive = 0, pending = 0, approved = 0, rejected = 0;
    int lowStock = 0;

    for (final doc in docs) {
      final data = doc.data() as Map<String, dynamic>;
      final isActive = data['isActive'] == true;
      final approvalStatus = (data['approvalStatus'] ?? 'pending').toString().toLowerCase();
      final stock = (data['stock'] as num?)?.toInt() ?? 0;

      if (isActive) {
        active++;
      } else {
        inactive++;
      }
      if (approvalStatus == 'pending') pending++;
      if (approvalStatus == 'approved') approved++;
      if (approvalStatus == 'rejected') rejected++;
      if (stock > 0 && stock < 10) lowStock++;
    }

    _tabCounts = ProductTabCounts(
      all: all,
      active: active,
      inactive: inactive,
      pending: pending,
      approved: approved,
      rejected: rejected,
    );
    _lowStockCount = lowStock;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FILTERING LOGIC
  // ═══════════════════════════════════════════════════════════════════════

  List<DocumentSnapshot> _applyFilters(List<DocumentSnapshot> products) {
    var filtered = products;

    // Tab filter
    if (_statusFilterIndex > 0) {
      final tabFilters = ['', 'active', 'inactive', 'pending', 'approved', 'rejected'];
      final targetFilter = tabFilters[_statusFilterIndex];
      
      filtered = filtered.where((doc) {
        final data = doc.data() as Map<String, dynamic>;
        if (targetFilter == 'active') return data['isActive'] == true;
        if (targetFilter == 'inactive') return data['isActive'] != true;
        return (data['approvalStatus'] ?? 'pending').toString().toLowerCase() == targetFilter;
      }).toList();
    }

    // Search filter
    if (_searchQuery.isNotEmpty) {
      final query = _searchQuery.toLowerCase();
      filtered = filtered.where((doc) {
        final data = doc.data() as Map<String, dynamic>;
        final name = (data['name'] ?? '').toString().toLowerCase();
        final sku = (data['sku'] ?? '').toString().toLowerCase();
        final category = (data['categoryId'] ?? '').toString().toLowerCase();
        return name.contains(query) || sku.contains(query) || category.contains(query);
      }).toList();
    }

    // Quick filters
    if (_activeQuickFilters.isNotEmpty) {
      filtered = filtered.where((doc) {
        final data = doc.data() as Map<String, dynamic>;
        for (final filter in _activeQuickFilters) {
          switch (filter) {
            case QuickProductFilter.active:
              if (data['isActive'] != true) return false;
              break;
            case QuickProductFilter.inactive:
              if (data['isActive'] == true) return false;
              break;
            case QuickProductFilter.lowStock:
              final stock = (data['stock'] as num?)?.toInt() ?? 0;
              if (stock >= 10 || stock == 0) return false;
              break;
            case QuickProductFilter.featured:
              if (data['isFeatured'] != true) return false;
              break;
            case QuickProductFilter.pendingApproval:
              if ((data['approvalStatus'] ?? 'pending').toString().toLowerCase() != 'pending') return false;
              break;
          }
        }
        return true;
      }).toList();
    }

    return filtered;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BULK ACTIONS
  // ═══════════════════════════════════════════════════════════════════════

  void _toggleQuickFilter(QuickProductFilter filter) {
    setState(() {
      if (_activeQuickFilters.contains(filter)) {
        _activeQuickFilters.remove(filter);
      } else {
        _activeQuickFilters.add(filter);
      }
    });
  }

  void _clearSelection() {
    setState(() {
      _selectedProductIds.clear();
      _isSelectionMode = false;
    });
  }

  /// Shows professional alerts popup with all product alerts
  void _showAlertsPopup(BuildContext context, bool isDark, String sellerId) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => _ProfessionalAlertsSheet(
        sellerId: sellerId,
        isDark: isDark,
        firestore: _firestore,
        onEditProduct: (String productId) async {
          Navigator.pop(context);
          final productDoc = await _firestore.collection('products').doc(productId).get();
          if (productDoc.exists && mounted) {
            final product = ProductModel.fromMap(
              productDoc.data() as Map<String, dynamic>, 
              productDoc.id,
            );
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => SellerProductFormScreen(product: product),
              ),
            );
          }
        },
      ),
    );
  }

  void _selectAllVisible(List<DocumentSnapshot> products) {
    setState(() {
      _selectedProductIds.clear();
      _selectedProductIds.addAll(products.map((p) => p.id));
    });
  }

  Future<void> _bulkActivate() async {
    await _bulkUpdateStatus(true);
  }

  Future<void> _bulkDeactivate() async {
    await _bulkUpdateStatus(false);
  }

  Future<void> _bulkUpdateStatus(bool isActive) async {
    try {
      final batch = _firestore.batch();
      for (final productId in _selectedProductIds) {
        batch.update(_firestore.collection('products').doc(productId), {
          'isActive': isActive,
          'updatedAt': FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
      _showSnackBar('${_selectedProductIds.length} products ${isActive ? 'activated' : 'deactivated'}');
      _clearSelection();
    } catch (e) {
      _showSnackBar('Failed to update products: $e', isError: true);
    }
  }

  Future<void> _bulkDelete() async {
    final confirmed = await _showConfirmDialog(
      'Delete Products',
      'Are you sure you want to delete ${_selectedProductIds.length} product(s)? This action cannot be undone.',
      isDangerous: true,
    );

    if (!confirmed) return;

    try {
      final batch = _firestore.batch();
      for (final productId in _selectedProductIds) {
        batch.delete(_firestore.collection('products').doc(productId));
      }
      await batch.commit();
      _showSnackBar('${_selectedProductIds.length} products deleted');
      _clearSelection();
    } catch (e) {
      _showSnackBar('Failed to delete products: $e', isError: true);
    }
  }

  void _bulkExport(BuildContext context, bool isDark) {
    ExportOptionsSheet.show(
      context,
      selectedProductIds: _selectedProductIds,
      isDark: isDark,
    );
  }

  void _showBulkEditSheet(BuildContext context, bool isDark) {
    BulkEditBottomSheet.show(
      context,
      selectedProductIds: _selectedProductIds,
      isDark: isDark,
      onComplete: () {
        _clearSelection();
        _refreshProducts();
      },
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? AppColors.error : AppColors.success,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(16),
      ),
    );
  }

  Future<bool> _showConfirmDialog(String title, String message, {bool isDangerous = false}) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) {
        final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
        return AlertDialog(
          backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Text(title, style: TextStyle(color: isDangerous ? AppColors.error : (isDark ? AppColors.textLight : AppColors.textPrimary), fontWeight: FontWeight.bold)),
          content: Text(message, style: TextStyle(color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary)),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: Text('Cancel', style: TextStyle(color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary))),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              style: ElevatedButton.styleFrom(backgroundColor: isDangerous ? AppColors.error : AppColors.primary, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
              child: const Text('Confirm'),
            ),
          ],
        );
      },
    );
    return result ?? false;
  }

  void _navigateToAddProduct() {
    Navigator.push(context, MaterialPageRoute(builder: (context) => const SellerProductFormScreen()));
  }

  void _navigateToEditProduct(ProductModel product) {
    Navigator.push(context, MaterialPageRoute(builder: (context) => SellerProductFormScreen(product: product)));
  }

  Future<void> _toggleProductStatus(String productId, bool isActive) async {
    try {
      await _firestore.collection('products').doc(productId).update({
        'isActive': isActive,
        'updatedAt': FieldValue.serverTimestamp(),
      });
      if (mounted) {
        SnackbarHelper.showSuccess(context, isActive ? 'Product activated' : 'Product deactivated');
      }
    } catch (e) {
      if (mounted) SnackbarHelper.showError(context, 'Failed to update product');
    }
  }

  Future<void> _deleteProduct(String productId) async {
    final confirmed = await _showConfirmDialog('Delete Product', 'Are you sure you want to delete this product?', isDangerous: true);
    if (!confirmed) return;

    try {
      await _firestore.collection('products').doc(productId).delete();
      if (mounted) SnackbarHelper.showSuccess(context, 'Product deleted');
    } catch (e) {
      if (mounted) SnackbarHelper.showError(context, 'Failed to delete product');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BUILD UI
  // ═══════════════════════════════════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final size = MediaQuery.of(context).size;
    final isDesktop = size.width > 900;
    final sellerId = Provider.of<SellerProvider>(context).sellerId;

    if (sellerId == null) {
      return _buildNotSignedInState(isDark);
    }

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF080B12) : const Color(0xFFF0F4F8),
      body: Stack(
        children: [
          // 1. Animated Background
          _buildAnimatedBackground(isDark),
          
          // 2. Floating Orbs (Desktop)
          if (isDesktop) ..._buildFloatingOrbs(isDark, size),

          // 3. Main Content
          Column(
            children: [
              // Professional Header
              ProfessionalProductHeader(
                isDark: isDark,
                isLiveRefreshEnabled: _isLiveRefreshEnabled,
                isTableView: _isTableView,
                alertCount: _alertBadgeCount,  // Shows total: out of stock + low stock + winning
                totalCount: _tabCounts.all,
                activeCount: _tabCounts.active,
                inactiveCount: _tabCounts.inactive,
                lowStockCount: _lowStockCount,
                pendingCount: _tabCounts.pending,
                onRefresh: _refreshProducts,
                onToggleLiveRefresh: () => setState(() => _isLiveRefreshEnabled = !_isLiveRefreshEnabled),
                onViewToggle: () => setState(() => _isTableView = !_isTableView),
                onAlertsTapped: () => _showAlertsPopup(context, isDark, sellerId),
                onAddProduct: _navigateToAddProduct,
              ),

              // ✅ Smart Product Notification Banner (Sequential Queue)
              if (_showNotification && _currentNotification != null)
                SmartProductNotification(
                  key: ValueKey('notification_${_currentNotification!.type.name}_${DateTime.now().millisecondsSinceEpoch}'),
                  type: _currentNotification!.type,
                  count: _currentNotification!.count,
                  productName: _currentNotification!.productName,
                  isDark: isDark,
                  currentIndex: _currentNotificationIndex,
                  totalCount: _totalNotifications,
                  onTap: () {
                    _showAlertsPopup(context, isDark, sellerId);
                    _onNotificationClosed();
                  },
                  onDismissForToday: () {
                    // Dismiss all remaining notifications too
                    _notificationQueue.clear();
                    _onNotificationClosed();
                  },
                  onClose: _onNotificationClosed,
                ),
              
              Expanded(
                child: SafeArea(
                  top: false,
                  child: NestedScrollView(
                    headerSliverBuilder: (context, innerBoxIsScrolled) {
                      return [
                        SliverToBoxAdapter(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Smart Search Bar
                              Padding(
                                padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                                child: SmartProductSearch(
                                  isDark: isDark,
                                  sellerId: sellerId,
                                  activeFilters: _activeQuickFilters,
                                  onSearchChanged: (val) => setState(() => _searchQuery = val),
                                  onSearchSubmitted: (val) {
                                    setState(() => _searchQuery = val);
                                    _refreshProducts();
                                  },
                                  onFilterToggled: _toggleQuickFilter,
                                  onAdvancedFilterTap: () {
                                    // TODO: Advanced filters
                                  },
                                  currentSortLabel: _sortOption.label,
                                  onSortChanged: (index) {
                                    setState(() => _sortOption = ProductSortOption.values[index.clamp(0, ProductSortOption.values.length - 1)]);
                                    _cachedProductsStream = null; // Force refresh
                                  },
                                ),
                              ),
                              
                              // Tab Bar
                              ProductStatusTabBar(
                                tabController: _tabController,
                                isDark: isDark,
                                counts: _tabCounts,
                                lowStockCount: _lowStockCount,
                              ),
                              const SizedBox(height: 8),
                            ],
                          ),
                        ),
                      ];
                    },
                    body: StreamBuilder<QuerySnapshot>(
                      stream: _getProductsStream(sellerId),
                      builder: (context, snapshot) {
                        if (snapshot.connectionState == ConnectionState.waiting) {
                          return _buildLoadingState(isDark);
                        }

                        if (snapshot.hasError) {
                          return _buildErrorState(isDark, snapshot.error.toString());
                        }

                        if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
                          return _buildEmptyState(isDark);
                        }

                        final allDocs = snapshot.data!.docs;
                        
                        // Update counts (only once per rebuild)
                        WidgetsBinding.instance.addPostFrameCallback((_) {
                          if (mounted) _updateTabCounts(allDocs);
                        });

                        final filteredDocs = _applyFilters(allDocs);

                        if (filteredDocs.isEmpty) {
                          return _buildNoResultsState(isDark);
                        }

                        return RefreshIndicator(
                          onRefresh: () async => _refreshProducts(),
                          child: _isTableView
                              // ✅ Table View
                              ? SingleChildScrollView(
                                  physics: const AlwaysScrollableScrollPhysics(),
                                  child: ProductDataTable(
                                    products: filteredDocs,
                                    isDark: isDark,
                                    selectedIds: _selectedProductIds,
                                    onSelect: (id) {
                                      setState(() {
                                        if (_selectedProductIds.contains(id)) {
                                          _selectedProductIds.remove(id);
                                          if (_selectedProductIds.isEmpty) _isSelectionMode = false;
                                        } else {
                                          _selectedProductIds.add(id);
                                          _isSelectionMode = true;
                                        }
                                      });
                                    },
                                    onSelectAll: (ids) {
                                      setState(() {
                                        _selectedProductIds.addAll(ids);
                                        _isSelectionMode = true;
                                      });
                                    },
                                  ),
                                )
                              // ✅ Card View (existing)
                              : ListView.builder(
                                  padding: const EdgeInsets.all(16),
                                  itemCount: filteredDocs.length,
                                  itemBuilder: (context, index) {
                                    final doc = filteredDocs[index];
                                    final product = ProductModel.fromMap(doc.data() as Map<String, dynamic>, doc.id);
                                    
                                    return SellerProductCard(
                                      product: product,
                                      onEdit: () => _navigateToEditProduct(product),
                                      onDelete: () => _deleteProduct(product.id),
                                      onTap: () => _navigateToEditProduct(product),
                                      onToggleActive: (isActive) => _toggleProductStatus(product.id, isActive),
                                      isSelected: _selectedProductIds.contains(product.id),
                                      showSelectionCheckbox: _isSelectionMode,
                                      onSelectionToggle: () {
                                        setState(() {
                                          if (_selectedProductIds.contains(product.id)) {
                                            _selectedProductIds.remove(product.id);
                                            if (_selectedProductIds.isEmpty) _isSelectionMode = false;
                                          } else {
                                            _selectedProductIds.add(product.id);
                                            _isSelectionMode = true;
                                          }
                                        });
                                      },
                                    ).animate().fadeIn(duration: 300.ms).slideY(begin: 0.1, end: 0, duration: 300.ms);
                                  },
                                ),
                        );
                      },
                    ),
                  ),
                ),
              ),
            ],
          ),

          // 4. Bulk Action Bar
          if (_isSelectionMode && _selectedProductIds.isNotEmpty)
            Positioned(
              left: 0,
              right: 0,
              bottom: 80, // Above bottom navigation
              child: BulkProductActionBar(
                selectedCount: _selectedProductIds.length,
                onBulkActivate: _bulkActivate,
                onBulkDeactivate: _bulkDeactivate,
                onBulkEdit: () => _showBulkEditSheet(context, isDark),
                onBulkDelete: _bulkDelete,
                onBulkExport: () => _bulkExport(context, isDark),
                onClearSelection: _clearSelection,
                onSelectAll: () {
                  // Get current filtered docs and select all
                  final sellerId = Provider.of<SellerProvider>(context, listen: false).sellerId;
                  if (sellerId != null) {
                    // This will be handled in the stream builder
                  }
                },
                isDark: isDark,
              ),
            ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // THEME WIDGETS
  // ═══════════════════════════════════════════════════════════════════════

  Widget _buildAnimatedBackground(bool isDark) {
    return AnimatedBuilder(
      animation: _bgAnimController,
      builder: (context, child) {
        return Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: isDark 
                  ? [const Color(0xFF0F2027), const Color(0xFF203A43), const Color(0xFF2C5364)]
                  : [const Color(0xFFF0F4F8), const Color(0xFFFFFFFF), const Color(0xFFE6E9F0)],
              stops: const [0.0, 0.5, 1.0],
              transform: GradientRotation(_bgAnimController.value * 2 * math.pi),
            ),
          ),
          child: CustomPaint(
            size: Size.infinite,
            painter: _GridPatternPainter(isDark: isDark, opacity: isDark ? 0.05 : 0.03),
          ),
        );
      },
    );
  }

  List<Widget> _buildFloatingOrbs(bool isDark, Size size) {
    return [
      Positioned(
        top: size.height * 0.1,
        right: size.width * 0.1,
        child: AnimatedBuilder(
          animation: _floatController,
          builder: (context, _) => Transform.translate(
            offset: Offset(0, _floatController.value * 20),
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [AppColors.primary.withValues(alpha: 0.15), Colors.transparent],
                ),
              ),
            ),
          ),
        ),
      ),
      Positioned(
        bottom: size.height * 0.2,
        left: size.width * 0.05,
        child: AnimatedBuilder(
          animation: _floatController,
          builder: (context, _) => Transform.translate(
            offset: Offset(0, -_floatController.value * 15),
            child: Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [AppColors.success.withValues(alpha: 0.1), Colors.transparent],
                ),
              ),
            ),
          ),
        ),
      ),
    ];
  }

  Widget _buildNotSignedInState(bool isDark) {
    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      appBar: AppBar(backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface, title: const Text('My Products')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: isDark ? AppColors.textLightHint : AppColors.textHint),
            const SizedBox(height: 16),
            Text('Please sign in to manage products', style: AppTextStyles.bodyLarge.copyWith(color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary)),
          ],
        ),
      ),
    );
  }

  Widget _buildLoadingState(bool isDark) {
    return Center(
      child: CircularProgressIndicator(color: AppColors.primary),
    );
  }

  Widget _buildErrorState(bool isDark, String error) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline, size: 64, color: AppColors.error),
          const SizedBox(height: 16),
          Text('Error loading products', style: AppTextStyles.bodyLarge.copyWith(color: AppColors.error)),
          const SizedBox(height: 8),
          Text(error, style: AppTextStyles.bodySmall.copyWith(color: isDark ? AppColors.textLightHint : AppColors.textHint), textAlign: TextAlign.center),
        ],
      ),
    );
  }

  Widget _buildEmptyState(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.inventory_2_outlined, size: 80, color: isDark ? AppColors.textLightHint : AppColors.textHint),
          const SizedBox(height: 16),
          Text('No products yet', style: AppTextStyles.headlineSmall.copyWith(color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text('Add your first product to get started', style: AppTextStyles.bodyMedium.copyWith(color: isDark ? AppColors.textLightHint : AppColors.textHint)),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: _navigateToAddProduct,
            icon: const Icon(Icons.add_rounded),
            label: const Text('Add Your First Product'),
            style: ElevatedButton.styleFrom(backgroundColor: isDark ? AppColors.primaryLight : AppColors.primary, foregroundColor: isDark ? Colors.black : Colors.white, padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 500.ms);
  }

  Widget _buildNoResultsState(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.search_off_rounded, size: 64, color: isDark ? AppColors.textLightHint : AppColors.textHint),
          const SizedBox(height: 16),
          Text('No products match your filters', style: AppTextStyles.bodyLarge.copyWith(color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary)),
          const SizedBox(height: 8),
          TextButton.icon(
            onPressed: () {
              setState(() {
                _searchQuery = '';
                _activeQuickFilters.clear();
                _tabController.animateTo(0);
              });
            },
            icon: const Icon(Icons.clear),
            label: const Text('Clear all filters'),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GRID PATTERN PAINTER
// ═══════════════════════════════════════════════════════════════════════════

class _GridPatternPainter extends CustomPainter {
  final bool isDark;
  final double opacity;

  _GridPatternPainter({required this.isDark, required this.opacity});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = (isDark ? Colors.white : Colors.black).withValues(alpha: opacity)
      ..strokeWidth = 0.5;

    const spacing = 30.0;

    for (double x = 0; x < size.width; x += spacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += spacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Data class for notification queue items
class _NotificationData {
  final ProductNotificationType type;
  final int count;
  final String? productName;

  _NotificationData({
    required this.type,
    required this.count,
    this.productName,
  });
}

/// Professional Alerts Sheet with Tabs
class _ProfessionalAlertsSheet extends StatefulWidget {
  final String sellerId;
  final bool isDark;
  final FirebaseFirestore firestore;
  final Function(String productId) onEditProduct;

  const _ProfessionalAlertsSheet({
    required this.sellerId,
    required this.isDark,
    required this.firestore,
    required this.onEditProduct,
  });

  @override
  State<_ProfessionalAlertsSheet> createState() => _ProfessionalAlertsSheetState();
}

class _ProfessionalAlertsSheetState extends State<_ProfessionalAlertsSheet>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  int _outOfStockCount = 0;
  int _lowStockCount = 0;
  int _topSellersCount = 0;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadCounts();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadCounts() async {
    // Fetch all products once
    final snap = await widget.firestore
        .collection('products')
        .where('sellerId', isEqualTo: widget.sellerId)
        .get();

    int outOfStock = 0;
    int lowStock = 0;
    int topSellers = 0;

    for (final doc in snap.docs) {
      final data = doc.data();
      final stock = (data['stock'] ?? 0) as int;
      final orders = (data['totalOrders'] ?? 0) as int;

      if (stock == 0) {
        outOfStock++;
      } else if (stock < 10) lowStock++;
      if (orders > 20) topSellers++;
    }

    if (mounted) {
      setState(() {
        _outOfStockCount = outOfStock;
        _lowStockCount = lowStock;
        _topSellersCount = topSellers;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (context, scrollController) => Container(
        decoration: BoxDecoration(
          color: widget.isDark ? const Color(0xFF1A1A2E) : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.3),
              blurRadius: 20,
              offset: const Offset(0, -5),
            ),
          ],
        ),
        child: Column(
          children: [
            // Handle
            Container(
              margin: const EdgeInsets.only(top: 12),
              width: 48,
              height: 5,
              decoration: BoxDecoration(
                color: widget.isDark ? Colors.grey[700] : Colors.grey[300],
                borderRadius: BorderRadius.circular(3),
              ),
            ),

            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 16, 0),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [Colors.purple.shade400, Colors.indigo.shade600],
                      ),
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.purple.withValues(alpha: 0.3),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.notifications_active_rounded, color: Colors.white, size: 24),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Product Alerts',
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            color: widget.isDark ? Colors.white : Colors.black87,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${_outOfStockCount + _lowStockCount} items need attention',
                          style: TextStyle(
                            fontSize: 13,
                            color: widget.isDark ? Colors.grey[400] : Colors.grey[600],
                          ),
                        ),
                      ],
                    ),
                  ),
                  Material(
                    color: widget.isDark ? Colors.white12 : Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(12),
                    child: InkWell(
                      onTap: () => Navigator.pop(context),
                      borderRadius: BorderRadius.circular(12),
                      child: Padding(
                        padding: const EdgeInsets.all(8),
                        child: Icon(
                          Icons.close_rounded,
                          color: widget.isDark ? Colors.grey[400] : Colors.grey[600],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Tab Bar
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: widget.isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey.shade100,
                borderRadius: BorderRadius.circular(16),
              ),
              child: TabBar(
                controller: _tabController,
                indicator: BoxDecoration(
                  color: widget.isDark ? Colors.white.withValues(alpha: 0.15) : Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: widget.isDark ? null : [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                indicatorSize: TabBarIndicatorSize.tab,
                dividerColor: Colors.transparent,
                labelColor: widget.isDark ? Colors.white : Colors.black87,
                unselectedLabelColor: widget.isDark ? Colors.grey[500] : Colors.grey[600],
                labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                unselectedLabelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                tabs: [
                  _buildTab('Out of Stock', _outOfStockCount, Colors.red),
                  _buildTab('Low Stock', _lowStockCount, Colors.orange),
                  _buildTab('Top Sellers', _topSellersCount, Colors.green),
                ],
              ),
            ),

            const SizedBox(height: 12),

            // Tab Content
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  _buildProductList(scrollController, 'outOfStock'),
                  _buildProductList(scrollController, 'lowStock'),
                  _buildProductList(scrollController, 'topSellers'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTab(String label, int count, Color color) {
    return Tab(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(label),
          if (count > 0) ...[
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '$count',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: color,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildProductList(ScrollController scrollController, String type) {
    return StreamBuilder<QuerySnapshot>(
      stream: _getStream(type),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        List<DocumentSnapshot> docs = snapshot.data?.docs ?? [];
        
        // Filter for topSellers
        if (type == 'topSellers') {
          docs = docs.where((doc) {
            final data = doc.data() as Map<String, dynamic>;
            return (data['totalOrders'] ?? 0) > 20;
          }).toList();
          docs.sort((a, b) {
            final aOrders = ((a.data() as Map)['totalOrders'] ?? 0) as int;
            final bOrders = ((b.data() as Map)['totalOrders'] ?? 0) as int;
            return bOrders.compareTo(aOrders);
          });
        }

        if (docs.isEmpty) {
          return _buildEmptyState(type);
        }

        return ListView.builder(
          controller: scrollController,
          padding: const EdgeInsets.all(16),
          itemCount: docs.length,
          itemBuilder: (context, index) => _buildProductCard(docs[index], type),
        );
      },
    );
  }

  Stream<QuerySnapshot> _getStream(String type) {
    switch (type) {
      case 'outOfStock':
        return widget.firestore
            .collection('products')
            .where('sellerId', isEqualTo: widget.sellerId)
            .where('stock', isEqualTo: 0)
            .snapshots();
      case 'lowStock':
        return widget.firestore
            .collection('products')
            .where('sellerId', isEqualTo: widget.sellerId)
            .snapshots();
      case 'topSellers':
        return widget.firestore
            .collection('products')
            .where('sellerId', isEqualTo: widget.sellerId)
            .snapshots();
      default:
        return widget.firestore
            .collection('products')
            .where('sellerId', isEqualTo: widget.sellerId)
            .snapshots();
    }
  }

  Widget _buildEmptyState(String type) {
    IconData icon;
    String message;
    Color color;

    switch (type) {
      case 'outOfStock':
        icon = Icons.check_circle_rounded;
        message = 'No products are out of stock!';
        color = Colors.green;
        break;
      case 'lowStock':
        icon = Icons.check_circle_rounded;
        message = 'All products have healthy stock levels!';
        color = Colors.green;
        break;
      case 'topSellers':
        icon = Icons.trending_up_rounded;
        message = 'Keep selling! Top sellers need 20+ orders.';
        color = Colors.blue;
        break;
      default:
        icon = Icons.info_outline;
        message = 'No items found';
        color = Colors.grey;
    }

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 56, color: color.withValues(alpha: 0.7)),
          const SizedBox(height: 16),
          Text(
            message,
            style: TextStyle(
              color: widget.isDark ? Colors.grey[400] : Colors.grey[600],
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProductCard(DocumentSnapshot doc, String type) {
    final data = doc.data() as Map<String, dynamic>;
    final name = data['name'] ?? 'Unnamed';
    final stock = (data['stock'] ?? 0) as int;
    final orders = (data['totalOrders'] ?? 0) as int;
    final revenue = (data['totalRevenue'] ?? 0.0);
    final images = List<String>.from(data['images'] ?? []);
    final imageUrl = images.isNotEmpty ? images.first : null;

    // Skip non-matching items for lowStock
    if (type == 'lowStock' && (stock == 0 || stock >= 10)) {
      return const SizedBox.shrink();
    }

    Color cardColor;
    Color accentColor;
    IconData statusIcon;
    String statusText;

    switch (type) {
      case 'outOfStock':
        cardColor = Colors.red;
        accentColor = Colors.red;
        statusIcon = Icons.error_rounded;
        statusText = 'OUT OF STOCK';
        break;
      case 'lowStock':
        cardColor = Colors.orange;
        accentColor = Colors.orange;
        statusIcon = Icons.warning_rounded;
        statusText = 'LOW: $stock left';
        break;
      case 'topSellers':
        cardColor = Colors.green;
        accentColor = Colors.green;
        statusIcon = Icons.emoji_events_rounded;
        statusText = '$orders orders';
        break;
      default:
        cardColor = Colors.grey;
        accentColor = Colors.grey;
        statusIcon = Icons.info_outline;
        statusText = '';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: widget.isDark 
            ? cardColor.withValues(alpha: 0.1)
            : cardColor.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: cardColor.withValues(alpha: 0.3),
          width: 1.5,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => widget.onEditProduct(doc.id),
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                // Product Image
                Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.1),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: imageUrl != null
                        ? Image.network(
                            imageUrl,
                            width: 56,
                            height: 56,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => _buildPlaceholderImage(),
                          )
                        : _buildPlaceholderImage(),
                  ),
                ),
                const SizedBox(width: 14),

                // Info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 15,
                          color: widget.isDark ? Colors.white : Colors.black87,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: accentColor.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(statusIcon, size: 12, color: accentColor),
                                const SizedBox(width: 4),
                                Text(
                                  statusText,
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: accentColor,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (type == 'topSellers') ...[
                            const SizedBox(width: 8),
                            Text(
                              '₹${(revenue is double ? revenue : revenue.toDouble()).toStringAsFixed(0)}',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: widget.isDark ? Colors.grey[400] : Colors.grey[600],
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),

                // Edit Button
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: accentColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    Icons.edit_rounded,
                    size: 20,
                    color: accentColor,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPlaceholderImage() {
    return Container(
      width: 56,
      height: 56,
      color: widget.isDark ? Colors.grey[800] : Colors.grey[200],
      child: Icon(
        Icons.image_rounded,
        size: 24,
        color: widget.isDark ? Colors.grey[600] : Colors.grey[400],
      ),
    );
  }
}