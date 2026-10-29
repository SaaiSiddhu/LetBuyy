import 'dart:async';
import '../../services/api_client.dart';
import '../../widgets/shared/merchant_export_share.dart';
import 'package:flutter/material.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';
import '../../app/routes.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' hide LoadingOverlay;
import '../../services/store_service.dart';

import '../../services/product_service.dart';
import '../../models/store_model.dart';
import '../../theme/app_theme_colors.dart';
import 'product_form_screen.dart';
import 'import_products_screen.dart';
import '../../widgets/shared/cached_merchant_image.dart';
import '../../widgets/shared/accessible_tap_region.dart';
import '../../widgets/shared/loading_overlay.dart';

/// Enhanced Products Screen v2
/// Modern product management with toolbar, filters, sort, and bulk actions
class ProductsScreen extends StatefulWidget {
  const ProductsScreen({super.key});

  @override
  State<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends State<ProductsScreen> {
  // Core State
  StoreModel? _store;
  List<Map<String, dynamic>> _storeProducts = [];
  int _totalSellerProducts = 0;
  bool _isLoading = true;
  bool _isSeedingSample = false;
  String? _loadError;

  Object? _viewContext;
  ({Object? key, String? store})? _menuView;
  int _loadGeneration = 0, _page = 1;
  bool _hasMore = false, _offline = false;
  Timer? _searchDebounce;

  // Search & Filter State
  String _searchQuery = '';
  String _statusFilter =
      'all'; // all, active, inactive, out_of_stock, low_stock
  String _sortBy =
      'newest'; // newest, oldest, name_asc, name_desc, price_asc, price_desc

  // Selection State
  bool _isSelectionMode = false;
  Set<String> _selectedProductIds = {};

  // Controllers
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _viewContext = context.read<StoreContext>().requestContextKey;
    _loadData();
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  bool _scopeCurrent(Object? captured, String? storeId) =>
      mounted &&
      context.read<StoreContext>().requestContextKey == captured &&
      context.read<StoreContext>().selectedStoreId == storeId;

  Future<void> _loadData() async {
    if (!mounted) return;
    final generation = ++_loadGeneration;
    setState(() {
      _isLoading = true;
      _loadError = null;
      _hasMore = false;
      _storeProducts = [];
      _selectedProductIds.clear();
    });
    try {
      final stores = context.read<StoreContext>();
      final store = await stores.ensureSelectedStore();
      if (!mounted || generation != _loadGeneration) return;
      final captured = stores.requestContextKey;
      _viewContext = captured;
      _store = store;
      if (store == null) {
        setState(() {
          _isLoading = false;
          _loadError = 'Select a store to view products.';
        });
        return;
      }
      final service = context.read<ProductService>();
      final sort = switch (_sortBy) {
        'name_asc' || 'name_desc' => 'name',
        'price_asc' || 'price_desc' => 'price',
        _ => 'created_at',
      };
      final rows = await service.fetchProducts(
        store.id,
        page: _page,
        search: _searchQuery,
        sort: sort,
        order: _sortBy == 'newest' || _sortBy.endsWith('_desc')
            ? 'desc'
            : 'asc',
        status: ['out_of_stock', 'low_stock'].contains(_statusFilter)
            ? 'all'
            : _statusFilter,
        stockFilter: switch (_statusFilter) {
          'out_of_stock' => 'out_of_stock',
          'low_stock' => 'low_stock',
          _ => null,
        },
      );
      if (!_scopeCurrent(captured, store.id) || generation != _loadGeneration)
        return;
      setState(() {
        _storeProducts = rows;
        _totalSellerProducts = rows.length;
        _hasMore = service.productsHasMore;
        _offline = service.productsOffline;
        _isLoading = false;
      });
    } catch (error) {
      if (mounted &&
          generation == _loadGeneration &&
          _viewContext == context.read<StoreContext>().requestContextKey) {
        setState(() {
          _storeProducts = [];
          _hasMore = false;
          _isLoading = false;
          _loadError =
              error is ApiException &&
                  error.code == 'PRODUCT_FILTER_UNSUPPORTED'
              ? 'Stock filters are unavailable on this server. Select All products.'
              : 'Products could not load. Check your connection and store access, then retry.';
        });
      }
    }
  }

  void _queryChanged({String? search, String? status, String? sort}) {
    _searchDebounce?.cancel();
    setState(() {
      if (search != null) _searchQuery = search;
      if (status != null) _statusFilter = status;
      if (sort != null) _sortBy = sort;
      _page = 1;
      _hasMore = false;
      _storeProducts = [];
      _selectedProductIds.clear();
      _isLoading = true;
      ++_loadGeneration;
    });
    if (search != null) {
      _searchDebounce = Timer(const Duration(milliseconds: 300), () {
        if (mounted) _loadData();
      });
    } else {
      _loadData();
    }
  }

  void _changePage(int delta) {
    if (_isLoading || (delta < 0 && _page == 1) || (delta > 0 && !_hasMore))
      return;
    setState(() {
      _page += delta;
      _selectedProductIds.clear();
    });
    _loadData();
  }

  // Rows are already filtered and ordered by the server across the whole catalog.
  List<Map<String, dynamic>> get _filteredProducts => _storeProducts;

  int get _activeCount => _storeProducts.where(_productIsActive).length;

  int get _outOfStockCount =>
      _storeProducts.where((p) => _productStock(p) <= 0).length;

  int get _inactiveCount =>
      _storeProducts.where((p) => !_productIsActive(p)).length;

  bool _productIsActive(Map<String, dynamic> product) {
    return (product['is_active'] ?? product['isActive'] ?? true) == true;
  }

  int _productStock(Map<String, dynamic> product) {
    return ((product['stock'] ?? product['stock_quantity']) as num?)?.toInt() ??
        0;
  }

  double _productPrice(Map<String, dynamic> product) {
    return ((product['price'] ?? product['salePrice']) as num?)?.toDouble() ??
        0;
  }

  double? _productComparePrice(Map<String, dynamic> product) {
    return ((product['compare_price'] ??
                product['comparePrice'] ??
                product['originalPrice'])
            as num?)
        ?.toDouble();
  }

  // ============================================
  // ACTIONS
  // ============================================

  void _toggleSelectionMode() {
    HapticFeedback.mediumImpact();
    setState(() {
      _isSelectionMode = !_isSelectionMode;
      if (!_isSelectionMode) _selectedProductIds.clear();
    });
  }

  void _toggleProductSelection(String productId) {
    HapticFeedback.selectionClick();
    setState(() {
      if (_selectedProductIds.contains(productId)) {
        _selectedProductIds.remove(productId);
      } else {
        _selectedProductIds.add(productId);
      }
    });
  }

  void _selectAll() {
    setState(() {
      _selectedProductIds = _filteredProducts
          .map((p) => p['id'] as String)
          .toSet();
    });
  }

  void _clearSelection() {
    setState(() => _selectedProductIds.clear());
  }

  Future<void> _removeSelectedProducts() async {
    final store = _store, captured = _viewContext;
    if (store == null ||
        _selectedProductIds.isEmpty ||
        _offline ||
        !_scopeCurrent(captured, store.id))
      return;
    final selected = Set<String>.from(_selectedProductIds);
    final confirm = await _showConfirmDialog(
      title: 'Remove ${selected.length} Products?',
      message:
          'These products will be removed from your store selection but remain in your catalog.',
      confirmText: 'Remove',
      confirmColor: Colors.redAccent,
    );
    if (confirm != true || !_scopeCurrent(captured, store.id)) return;
    try {
      await context.read<StoreService>().updateSelectedProducts(
        store.id,
        store.selectedProductIds.where((id) => !selected.contains(id)).toList(),
      );
      if (!_scopeCurrent(captured, store.id)) return;
      setState(() {
        _selectedProductIds.clear();
        _isSelectionMode = false;
      });
      await _loadData();
      if (_scopeCurrent(captured, store.id))
        _showSnackBar(
          '${selected.length} products removed from store selection',
        );
    } catch (_) {
      if (_scopeCurrent(captured, store.id))
        _showSnackBar('Unable to update selected products.', isError: true);
    }
  }

  Future<void> _hideSelectedProducts() async {
    final store = _store, captured = _viewContext;
    if (store == null ||
        _selectedProductIds.isEmpty ||
        _offline ||
        !_scopeCurrent(captured, store.id))
      return;
    final selected = _selectedProductIds.toList(growable: false);
    final confirm = await _showConfirmDialog(
      title: 'Hide ${selected.length} Products?',
      message:
          'Hidden products stay in your catalog but are not active in your store.',
      confirmText: 'Hide',
      confirmColor: AppColors.lavender,
    );
    if (confirm != true || !_scopeCurrent(captured, store.id)) return;
    try {
      final affected = await context.read<ProductService>().bulkAction(
        action: 'deactivate',
        productIds: selected,
        storeId: store.id,
      );
      if (!_scopeCurrent(captured, store.id)) return;
      setState(() {
        _selectedProductIds.clear();
        _isSelectionMode = false;
      });
      await _loadData();
      if (_scopeCurrent(captured, store.id))
        _showSnackBar('$affected products updated. Catalog refreshed.');
    } catch (_) {
      if (_scopeCurrent(captured, store.id))
        _showSnackBar(
          'The update could not be confirmed. Refresh the catalog before retrying.',
          isError: true,
        );
    }
  }

  void _navigateToAddProduct() async {
    final result = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => const ProductFormScreen()),
    );
    if (result == true) _loadData();
  }

  Future<void> _openProductEditor(Map<String, dynamic> product) async {
    final result = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) =>
            ProductFormScreen(product: ProductContract.fromJson(product)),
      ),
    );
    if (result == true) _loadData();
  }

  void _navigateToImport() async {
    if (_store == null) return;

    final result = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => ImportProductsScreen(
          store: _store!,
          alreadySelectedIds: Set.from(_store!.selectedProductIds),
        ),
      ),
    );
    if (result == true) _loadData();
  }

  Future<void> _seedSampleProduct() async {
    final store = _store;
    if (store == null ||
        _isSeedingSample ||
        _offline ||
        !_scopeCurrent(_viewContext, store.id))
      return;
    final captured = _viewContext;

    setState(() => _isSeedingSample = true);
    try {
      final product = await context.read<ProductService>().seedSampleProduct(
        store.id,
      );
      if (!_scopeCurrent(captured, store.id)) return;
      setState(() {
        _storeProducts = [
          product,
          ..._storeProducts.where((item) => item['id'] != product['id']),
        ];
        _totalSellerProducts = _storeProducts.length;
      });
      _showSnackBar('Sample product added as an inactive draft.');
    } catch (_) {
      if (mounted) {
        _showSnackBar(
          'Unable to add a sample product right now.',
          isError: true,
        );
      }
    } finally {
      if (mounted) setState(() => _isSeedingSample = false);
    }
  }

  void _exportProducts() async {
    final store = _store, captured = _viewContext;
    if (store == null || !_scopeCurrent(captured, store.id)) return;

    // Show export options
    final format = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: colors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Export Products',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: colors.textPrimary,
              ),
            ),
            const SizedBox(height: 16),
            _buildExportOption(
              icon: Icons.table_chart_rounded,
              title: 'Export as CSV',
              subtitle: 'Spreadsheet format from your catalog',
              onTap: () => Navigator.pop(context, 'csv'),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );

    if (format == 'csv' && _scopeCurrent(captured, store.id)) {
      try {
        final service = context.read<ProductService>();
        final result = await service.exportProducts(store.id);
        if (!_scopeCurrent(captured, store.id)) return;
        final job = result['job'] is Map ? result['job'] as Map : const {};
        var latest = Map<String, dynamic>.from(job);
        for (var attempt = 0; attempt < 5; attempt += 1) {
          if (latest['status'] == 'completed' || latest['status'] == 'failed') {
            break;
          }
          await Future<void>.delayed(const Duration(milliseconds: 350));
          final jobId = latest['id']?.toString();
          if (jobId == null || jobId.isEmpty) break;
          if (!_scopeCurrent(captured, store.id)) return;
          final detail = await service.fetchExportJob(jobId);
          if (!_scopeCurrent(captured, store.id)) return;
          latest = detail['job'] is Map
              ? Map<String, dynamic>.from(detail['job'] as Map)
              : detail;
        }

        if (!_scopeCurrent(captured, store.id)) return;
        final status = latest['status']?.toString() ?? 'queued';
        final downloadUrl = latest['download_url']?.toString();
        if (status == 'completed' &&
            downloadUrl != null &&
            downloadUrl.isNotEmpty) {
          await shareMerchantExport(
            api: context.read<ApiClient>(),
            job: latest,
          );
          _showSnackBar('Product CSV export ready to share.');
        } else {
          _showSnackBar('Product CSV export $status. Try again shortly.');
        }
      } catch (error) {
        if (_scopeCurrent(captured, store.id))
          _showSnackBar(
            'Product export could not be confirmed. Retry from the selected store.',
            isError: true,
          );
      }
    }
  }

  Widget _buildExportOption({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return AccessibleTapRegion(
      label: title,
      hint: subtitle,
      onTap: onTap,
      excludeChildSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: colors.surfaceVariant,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: colors.divider),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.lavender.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: AppColors.lavender, size: 22),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      subtitle,
                      style: TextStyle(
                        color: colors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: colors.textTertiary),
            ],
          ),
        ),
      ),
    );
  }

  Future<bool?> _showConfirmDialog({
    required String title,
    required String message,
    required String confirmText,
    Color confirmColor = Colors.redAccent,
  }) {
    final captured = _viewContext, storeId = _store?.id;
    return showDialog<bool>(
      context: context,
      builder: (dialogContext) => Consumer<StoreContext>(
        builder: (_, stores, child) {
          if (stores.requestContextKey != captured ||
              stores.selectedStoreId != storeId) {
            return AlertDialog(
              title: const Text('Store context changed'),
              content: const Text(
                'Close this dialog and reload the selected store.',
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext, false),
                  child: const Text('Close'),
                ),
              ],
            );
          }
          return AlertDialog(
            backgroundColor: colors.card,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            title: Text(title, style: TextStyle(color: colors.textPrimary)),
            content: Text(
              message,
              style: TextStyle(color: colors.textSecondary),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: Text(
                  'Cancel',
                  style: TextStyle(color: colors.textSecondary),
                ),
              ),
              TextButton(
                onPressed: () => Navigator.pop(context, true),
                child: Text(confirmText, style: TextStyle(color: confirmColor)),
              ),
            ],
          );
        },
      ),
    );
  }

  void _showSnackBar(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? colors.error : colors.surfaceVariant,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  // ============================================
  // BUILD
  // ============================================

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    final stores = context.watch<StoreContext>();
    if (_viewContext != stores.requestContextKey) {
      _viewContext = stores.requestContextKey;
      ++_loadGeneration;
      _store = null;
      _storeProducts = [];
      _selectedProductIds.clear();
      _page = 1;
      _hasMore = false;
      _isLoading = true;
      _loadError = null;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _loadData();
      });
    }
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
                _buildActionToolbar(),
                if (_loadError == null && !_isLoading) _buildStatsRow(),
                _buildFilterSortBar(),
                if (_offline)
                  const Padding(
                    padding: EdgeInsets.all(8),
                    child: Text(
                      'Offline snapshot of this page. Reconnect before making changes.',
                    ),
                  ),
                Expanded(child: _buildProductGrid()),
                if (_page > 1 || _hasMore)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      TextButton(
                        onPressed: _page > 1 && !_isLoading
                            ? () => _changePage(-1)
                            : null,
                        child: const Text('Previous'),
                      ),
                      Text('Page $_page'),
                      TextButton(
                        onPressed: _hasMore && !_isLoading
                            ? () => _changePage(1)
                            : null,
                        child: const Text('Next'),
                      ),
                    ],
                  ),
                if (_isSelectionMode && _selectedProductIds.isNotEmpty)
                  _buildBulkActionsBar(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ============================================
  // HEADER
  // ============================================

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 12, 0),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Products',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: colors.textPrimary,
                  ),
                ),
                if (_store != null)
                  Text(
                    _store!.name,
                    style: TextStyle(fontSize: 12, color: colors.textSecondary),
                  ),
              ],
            ),
          ),
          IconButton(
            icon: Icon(Icons.refresh_rounded, color: colors.textSecondary),
            onPressed: _loadData,
            tooltip: 'Refresh',
          ),
          PopupMenuButton<String>(
            enabled: !_isLoading && _loadError == null && _store != null,
            onOpened: () => _menuView = (key: _viewContext, store: _store?.id),
            icon: Icon(Icons.more_vert, color: colors.textSecondary),
            color: colors.card,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            itemBuilder: (context) => [
              PopupMenuItem(
                value: 'inventory',
                child: Row(
                  children: [
                    Icon(
                      Icons.inventory_2_outlined,
                      size: 20,
                      color: colors.textSecondary,
                    ),
                    const SizedBox(width: 12),
                    Text(
                      'Inventory',
                      style: TextStyle(color: colors.textPrimary),
                    ),
                  ],
                ),
              ),
            ],
            onSelected: (value) {
              final view = _menuView;
              _menuView = null;
              if (view == null || !_scopeCurrent(view.key, view.store)) return;
              if (value == 'inventory')
                Navigator.pushNamed(context, AppRoutes.inventory);
            },
          ),
        ],
      ),
    );
  }

  // ============================================
  // ACTION TOOLBAR
  // ============================================

  Widget _buildActionToolbar() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colors.divider),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _buildToolbarButton(
            icon: Icons.download_rounded,
            label: 'Import',
            onTap: _navigateToImport,
          ),
          _buildToolbarDivider(),
          _buildToolbarButton(
            icon: Icons.upload_rounded,
            label: 'Export',
            onTap: _exportProducts,
          ),
          _buildToolbarDivider(),
          _buildToolbarButton(
            icon: Icons.add_rounded,
            label: 'Add',
            onTap: _navigateToAddProduct,
            isPrimary: true,
          ),
          _buildToolbarDivider(),
          _buildToolbarButton(
            icon: _isSelectionMode
                ? Icons.close_rounded
                : Icons.checklist_rounded,
            label: _isSelectionMode ? 'Cancel' : 'Select',
            onTap: _toggleSelectionMode,
            isActive: _isSelectionMode,
          ),
        ],
      ),
    );
  }

  Widget _buildToolbarButton({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool isPrimary = false,
    bool isActive = false,
  }) {
    final color = isPrimary
        ? AppColors.lavender
        : isActive
        ? AppColors.lavender
        : colors.textSecondary;
    return AccessibleTapRegion(
      label: label,
      hint: isActive ? '$label active' : null,
      onTap: onTap,
      excludeChildSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: color, size: 22),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildToolbarDivider() {
    return Container(height: 30, width: 1, color: colors.divider);
  }

  // ============================================
  // STATS ROW
  // ============================================

  Widget _buildStatsRow() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          _buildStatChip(
            'On this page',
            '${_storeProducts.length}',
            AppColors.lavender,
          ),
          _buildStatChip(
            'Active on page',
            '$_activeCount',
            const Color(0xFF22C55E),
          ),
          _buildStatChip(
            'Out of stock on page',
            '$_outOfStockCount',
            const Color(0xFFEF4444),
          ),
          if (_inactiveCount > 0) ...[
            _buildStatChip(
              'Hidden on page',
              '$_inactiveCount',
              colors.textTertiary,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStatChip(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            '$value $label',
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  // ============================================
  // FILTER & SORT BAR
  // ============================================

  Widget _buildFilterSortBar() {
    return Column(
      children: [
        // Filter chips
        Container(
          height: 52,
          margin: const EdgeInsets.only(top: 12),
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            children: [
              _buildFilterChip('All', 'all'),
              _buildFilterChip('Active', 'active'),
              _buildFilterChip('Inactive', 'inactive'),
              _buildFilterChip('Draft', 'draft'),
              _buildFilterChip('Archived', 'archived'),
              _buildFilterChip('Out of Stock', 'out_of_stock'),
              _buildFilterChip('Stock 1–5', 'low_stock'),
            ],
          ),
        ),
        // Sort + Search row
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
          child: Row(
            children: [
              // Sort dropdown
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: colors.surfaceVariant,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: colors.divider),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _sortBy,
                    isDense: true,
                    dropdownColor: colors.card,
                    style: TextStyle(color: colors.textPrimary, fontSize: 12),
                    icon: Icon(
                      Icons.keyboard_arrow_down,
                      color: colors.textSecondary,
                      size: 18,
                    ),
                    items: const [
                      DropdownMenuItem(value: 'newest', child: Text('Newest')),
                      DropdownMenuItem(value: 'oldest', child: Text('Oldest')),
                      DropdownMenuItem(
                        value: 'name_asc',
                        child: Text('Name A-Z'),
                      ),
                      DropdownMenuItem(
                        value: 'name_desc',
                        child: Text('Name Z-A'),
                      ),
                      DropdownMenuItem(
                        value: 'price_asc',
                        child: Text('Price ↑'),
                      ),
                      DropdownMenuItem(
                        value: 'price_desc',
                        child: Text('Price ↓'),
                      ),
                    ],
                    onChanged: (value) {
                      if (value != null) _queryChanged(sort: value);
                    },
                  ),
                ),
              ),
              const SizedBox(width: 10),
              // Search field
              Expanded(
                child: Container(
                  height: 36,
                  decoration: BoxDecoration(
                    color: colors.surfaceVariant,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: colors.divider),
                  ),
                  child: TextField(
                    controller: _searchController,
                    onChanged: (v) => _queryChanged(search: v),
                    style: TextStyle(color: colors.textPrimary, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Search product names...',
                      hintStyle: TextStyle(
                        color: colors.textTertiary,
                        fontSize: 13,
                      ),
                      prefixIcon: Icon(
                        Icons.search,
                        color: colors.textTertiary,
                        size: 18,
                      ),
                      suffixIcon: _searchQuery.isNotEmpty
                          ? IconButton(
                              icon: Icon(
                                Icons.close,
                                color: colors.textTertiary,
                                size: 16,
                              ),
                              onPressed: () {
                                _searchController.clear();
                                _queryChanged(search: '');
                              },
                            )
                          : null,
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(vertical: 8),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildFilterChip(String label, String value) {
    final isActive = _statusFilter == value;
    void applyFilter() {
      HapticFeedback.selectionClick();
      _queryChanged(status: value);
    }

    return AccessibleTapRegion(
      key: ValueKey('product-filter-$value'),
      label: '$label products filter',
      hint: isActive ? 'Current filter' : 'Show $label products',
      onTap: applyFilter,
      selected: isActive,
      excludeChildSemantics: true,
      child: InkWell(
        excludeFromSemantics: true,
        onTap: applyFilter,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          margin: const EdgeInsets.only(right: 8),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: isActive ? AppColors.lavender : colors.surfaceVariant,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isActive ? AppColors.lavender : colors.divider,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: isActive ? Colors.white : colors.textSecondary,
              fontSize: 12,
              fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }

  // ============================================
  // PRODUCT GRID
  // ============================================

  Widget _buildProductGrid() {
    if (_loadError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_loadError!, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: _loadData,
                child: const Text('Retry products'),
              ),
              if (['out_of_stock', 'low_stock'].contains(_statusFilter))
                TextButton(
                  onPressed: () => _queryChanged(status: 'all'),
                  child: const Text('Clear stock filter'),
                ),
            ],
          ),
        ),
      );
    }

    if (_storeProducts.isEmpty &&
        _searchQuery.trim().isEmpty &&
        _statusFilter == 'all' &&
        _page == 1) {
      return _buildEmptyState();
    }

    if (_filteredProducts.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search_off, size: 64, color: colors.textTertiary),
            const SizedBox(height: 16),
            Text(
              'No products match your filters',
              style: TextStyle(color: colors.textSecondary),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () {
                _searchController.clear();
                _queryChanged(search: '', status: 'all');
              },
              child: Text(
                'Clear Filters',
                style: TextStyle(color: AppColors.lavender),
              ),
            ),
          ],
        ),
      );
    }

    return GridView.builder(
      controller: _scrollController,
      padding: EdgeInsets.fromLTRB(16, 0, 16, _isSelectionMode ? 100 : 24),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisExtent:
            (MediaQuery.sizeOf(context).width - 42) / 2 +
            MediaQuery.textScalerOf(context).scale(112),
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
      ),
      itemCount: _filteredProducts.length,
      itemBuilder: (context, index) {
        final product = _filteredProducts[index];
        return _buildProductCard(product);
      },
    );
  }

  Widget _buildProductCard(Map<String, dynamic> product) {
    final productId = product['id'] as String;
    final name = product['name'] as String? ?? 'Untitled';
    final salePrice = _productPrice(product);
    final originalPrice = _productComparePrice(product);
    final images = product['images'] as List<dynamic>? ?? [];
    final imageUrl = images.isNotEmpty ? images.first as String : null;
    final stock = _productStock(product);
    final isActive = _productIsActive(product);
    final isOutOfStock = stock <= 0;
    final isSelected = _selectedProductIds.contains(productId);

    // Determine status
    String statusText;
    Color statusColor;
    if (isOutOfStock) {
      statusText = 'Out of Stock';
      statusColor = const Color(0xFFEF4444);
    } else if (!isActive) {
      statusText = 'Inactive';
      statusColor = colors.textTertiary;
    } else if (stock <= 5) {
      statusText = 'Low Stock';
      statusColor = const Color(0xFFF59E0B);
    } else {
      statusText = 'Active';
      statusColor = const Color(0xFF22C55E);
    }

    // Discount
    final hasDiscount = originalPrice != null && originalPrice > salePrice;
    final discountPercent = hasDiscount
        ? ((originalPrice - salePrice) / originalPrice * 100).round()
        : 0;

    void handleTap() {
      if (_isSelectionMode) {
        _toggleProductSelection(productId);
      } else {
        _openProductEditor(product);
      }
    }

    final semanticsLabel = [
      'Product $name',
      statusText,
      'Stock $stock',
      'Price INR ${salePrice.toStringAsFixed(2)}',
      if (hasDiscount) 'was INR ${originalPrice!.toStringAsFixed(2)}',
    ].join(', ');

    return Semantics(
      key: ValueKey('product-card-$productId'),
      container: true,
      label: semanticsLabel,
      hint: _isSelectionMode
          ? isSelected
                ? 'Tap to deselect product'
                : 'Tap to select product'
          : 'Opens product editor',
      selected: _isSelectionMode ? isSelected : null,
      button: true,
      enabled: true,
      onTap: handleTap,
      child: InkWell(
        excludeFromSemantics: true,
        onTap: handleTap,
        borderRadius: BorderRadius.circular(14),
        onLongPress: () {
          if (!_isSelectionMode) {
            _toggleSelectionMode();
            _toggleProductSelection(productId);
          }
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          decoration: BoxDecoration(
            color: colors.surfaceVariant,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isSelected ? AppColors.lavender : colors.divider,
              width: isSelected ? 2 : 1,
            ),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: AppColors.lavender.withValues(alpha: 0.2),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: Stack(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Image
                  ClipRRect(
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(13),
                    ),
                    child: AspectRatio(
                      aspectRatio: 1,
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          imageUrl != null
                              ? CachedMerchantImage(
                                  imageUrl: imageUrl,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_) => Container(
                                    color: colors.card,
                                    child: Icon(
                                      Icons.image,
                                      size: 40,
                                      color: colors.textTertiary,
                                    ),
                                  ),
                                )
                              : Container(
                                  color: colors.card,
                                  child: Icon(
                                    Icons.image,
                                    size: 40,
                                    color: colors.textTertiary,
                                  ),
                                ),
                          if (isOutOfStock && !_isSelectionMode)
                            Container(
                              color: Colors.black54,
                              child: const Center(
                                child: Text(
                                  'OUT OF STOCK',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 10,
                                  ),
                                ),
                              ),
                            ),
                          // Discount badge
                          if (hasDiscount && !isOutOfStock)
                            Positioned(
                              top: 6,
                              left: 6,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 5,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFEF4444),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  '$discountPercent% OFF',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 9,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),

                  // Info
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.all(8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: colors.textPrimary,
                              fontWeight: FontWeight.w500,
                              fontSize: 12,
                            ),
                          ),
                          const Spacer(),
                          // Price
                          FittedBox(
                            fit: BoxFit.scaleDown,
                            alignment: Alignment.centerLeft,
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  '₹${salePrice.toStringAsFixed(2)}',
                                  style: const TextStyle(
                                    color: mobile_tokens
                                        .LetbuyyColorTokens
                                        .brandPrimary,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 14,
                                  ),
                                ),
                                if (hasDiscount) ...[
                                  const SizedBox(width: 4),
                                  Text(
                                    '₹${originalPrice!.toStringAsFixed(2)}',
                                    style: TextStyle(
                                      color: colors.textTertiary,
                                      fontSize: 10,
                                      decoration: TextDecoration.lineThrough,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          const SizedBox(height: 4),
                          // Status + Stock
                          Wrap(
                            spacing: 6,
                            runSpacing: 4,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 5,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: statusColor.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  statusText,
                                  style: TextStyle(
                                    color: statusColor,
                                    fontSize: 9,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                              Text(
                                'Stock: $stock',
                                style: TextStyle(
                                  color: colors.textTertiary,
                                  fontSize: 10,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),

              // Selection Checkbox
              if (_isSelectionMode)
                Positioned(
                  top: 6,
                  right: 6,
                  child: AccessibleTapRegion(
                    key: ValueKey('product-select-$productId'),
                    label: isSelected
                        ? 'Deselect product $name'
                        : 'Select product $name',
                    onTap: () => _toggleProductSelection(productId),
                    selected: isSelected,
                    excludeChildSemantics: true,
                    child: InkWell(
                      excludeFromSemantics: true,
                      onTap: () => _toggleProductSelection(productId),
                      borderRadius: BorderRadius.circular(6),
                      child: Container(
                        width: 24,
                        height: 24,
                        decoration: BoxDecoration(
                          color: isSelected ? AppColors.lavender : Colors.white,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: isSelected
                                ? AppColors.lavender
                                : colors.divider,
                            width: 2,
                          ),
                        ),
                        child: isSelected
                            ? const Icon(
                                Icons.check,
                                color: Colors.white,
                                size: 16,
                              )
                            : null,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return LayoutBuilder(
      builder: (context, constraints) {
        final minHeight = constraints.maxHeight.isFinite
            ? constraints.maxHeight
            : 0.0;
        return SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: minHeight),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: AppColors.lavender.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.inventory_2_outlined,
                      size: 48,
                      color: AppColors.lavender,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'No Products Yet',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: colors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Add or import products to display them in your store',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: colors.textSecondary, fontSize: 14),
                  ),
                  const SizedBox(height: 20),
                  Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 12,
                    runSpacing: 12,
                    children: [
                      if (_totalSellerProducts > 0) ...[
                        OutlinedButton.icon(
                          onPressed: _navigateToImport,
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.lavender,
                            side: BorderSide(color: AppColors.lavender),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 12,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                          icon: const Icon(Icons.download_rounded, size: 18),
                          label: const Text('Import'),
                        ),
                      ],
                      OutlinedButton.icon(
                        onPressed: _store == null || _isSeedingSample
                            ? null
                            : _seedSampleProduct,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.lavender,
                          side: BorderSide(color: AppColors.lavender),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 12,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        icon: _isSeedingSample
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.auto_awesome_outlined, size: 18),
                        label: Text(
                          _isSeedingSample
                              ? 'Adding sample'
                              : 'Add sample product',
                        ),
                      ),
                      ElevatedButton.icon(
                        onPressed: _navigateToAddProduct,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.lavender,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 20,
                            vertical: 12,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        icon: const Icon(Icons.add_rounded, size: 18),
                        label: const Text('Add Product'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  // ============================================
  // BULK ACTIONS BAR
  // ============================================

  Widget _buildBulkActionsBar() {
    return Container(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.of(context).padding.bottom + 16,
      ),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Row(
        children: [
          // Selection info
          AccessibleTapRegion(
            key: const ValueKey('products-select-all-visible'),
            label: '${_selectedProductIds.length} products selected',
            hint: 'Select all visible products',
            onTap: _selectAll,
            excludeChildSemantics: true,
            child: InkWell(
              excludeFromSemantics: true,
              onTap: _selectAll,
              borderRadius: BorderRadius.circular(8),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: AppColors.lavender.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '${_selectedProductIds.length} selected',
                  style: TextStyle(
                    color: AppColors.lavender,
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
              ),
            ),
          ),
          const Spacer(),
          // Action buttons
          _buildBulkButton(
            Icons.visibility_off_rounded,
            'Hide',
            _hideSelectedProducts,
          ),
          const SizedBox(width: 8),
          _buildBulkButton(
            Icons.delete_outline_rounded,
            'Remove',
            _removeSelectedProducts,
            color: Colors.redAccent,
          ),
        ],
      ),
    );
  }

  Widget _buildBulkButton(
    IconData icon,
    String label,
    VoidCallback onTap, {
    Color? color,
  }) {
    final buttonColor = color ?? colors.textSecondary;
    return AccessibleTapRegion(
      label: label,
      onTap: onTap,
      excludeChildSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: buttonColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 18, color: buttonColor),
              const SizedBox(width: 4),
              Text(
                label,
                style: TextStyle(
                  color: buttonColor,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
