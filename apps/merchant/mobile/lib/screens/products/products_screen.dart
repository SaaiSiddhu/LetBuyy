import 'dart:async';
import 'package:letbuyy_core/letbuyy_core.dart';
import '../../services/api_client.dart';
import '../../widgets/shared/merchant_export_share.dart';
import 'package:flutter/material.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';
import '../../app/routes.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' hide LoadingOverlay;

import '../../services/product_service.dart';
import '../../services/security_command_store.dart';
import '../../models/store_model.dart';
import '../../theme/app_theme_colors.dart';
import 'product_form_screen.dart';
import 'csv_import_screen.dart';
import '../../widgets/shared/cached_merchant_image.dart';
import '../../widgets/shared/accessible_tap_region.dart';
import '../../widgets/shared/loading_overlay.dart' show LoadingOverlay;
import '../../widgets/dashboard/skeleton_loader.dart' show SkeletonCard;

/// Enhanced Products Screen v2
/// Modern product management with toolbar, filters, sort, and bulk actions
class ProductsScreen extends StatefulWidget {
  const ProductsScreen({
    super.key,
    this.onSelectionActionsChanged,
    this.isSurfaceActive,
  });

  /// The existing root shell owns global FABs. A page-owned primary action bar
  /// temporarily takes that space; direct product routes need no root callback.
  final void Function(Object owner, bool visible)? onSelectionActionsChanged;
  final bool Function()? isSurfaceActive;

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
  bool _exportOpening = false, _isExporting = false;
  Map<String, dynamic>? _exportJob;
  String? _exportError;
  bool get _exportHasReference =>
      _exportJob?['id']?.toString().isNotEmpty == true;
  bool get _exportPending =>
      _exportHasReference &&
      !['completed', 'failed'].contains(_exportJob!['status']);
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
  PendingSecurityCommand? _pendingStatus;
  bool _statusWorking = false;
  String? _statusError;
  bool _isSelectionMode = false;
  Set<String> _selectedProductIds = {};

  // Controllers
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final _selectAllFocus = FocusNode(debugLabel: 'Select products on this page');
  final _selectionOwner = Object();
  bool? _reportedSelectionActions;

  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _viewContext = context.read<StoreContext>().requestContextKey;
    _loadData();
  }

  @override
  void dispose() {
    final callback = widget.onSelectionActionsChanged;
    if (callback != null) {
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => callback(_selectionOwner, false),
      );
    }
    _searchDebounce?.cancel();
    _searchController.dispose();
    _scrollController.dispose();
    _selectAllFocus.dispose();
    super.dispose();
  }

  bool _scopeCurrent(Object? captured, String? storeId) =>
      mounted &&
      context.read<StoreContext>().requestContextKey == captured &&
      context.read<StoreContext>().selectedStoreId == storeId;

  bool get _canPresent =>
      mounted &&
      (widget.isSurfaceActive?.call() ??
          (ModalRoute.of(context)?.isCurrent ?? true));

  Future<void> _loadData() async {
    if (!mounted) return;
    final generation = ++_loadGeneration;
    setState(() {
      _isLoading = true;
      _loadError = null;
      _hasMore = false;
      _storeProducts = [];
      _pendingStatus = null;
      _selectedProductIds.clear();
    });
    try {
      final stores = context.read<StoreContext>();
      final startingView = stores.requestContextKey;
      final startingStore = stores.selectedStoreId;
      final epoch = stores.requestContextVersion;
      final store = await stores.ensureSelectedStore();
      if (!mounted || generation != _loadGeneration) return;
      if (epoch != stores.requestContextVersion ||
          (startingStore != null && stores.requestContextKey != startingView) ||
          stores.selectedStoreId != store?.id)
        return;
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
      final pending = await service.pendingProductStatus(store.id);
      if (!_scopeCurrent(captured, store.id) || generation != _loadGeneration)
        return;
      setState(() {
        _pendingStatus = pending;
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
    final captured = _viewContext, storeId = _store?.id;
    if (storeId == null || !_scopeCurrent(captured, storeId)) return;
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
        if (_scopeCurrent(captured, storeId)) _loadData();
      });
    } else {
      _loadData();
    }
  }

  void _changePage(int delta) {
    if (_store == null || !_scopeCurrent(_viewContext, _store!.id)) return;
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
      _storeProducts.where((p) => _productStock(p) == 0).length;

  int get _inactiveCount =>
      _storeProducts.where((p) => !_productIsActive(p)).length;

  bool _productIsActive(Map<String, dynamic> product) {
    return (product['is_active'] ?? product['isActive'] ?? true) == true;
  }

  int? _productStock(Map<String, dynamic> product) =>
      ProductContract.fromJson(product).catalogAvailableQuantity;

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

  bool _hasStock(Map<String, dynamic> product) =>
      _productStock(product) != null;

  bool _hasActiveFlag(Map<String, dynamic> product) =>
      (product['is_active'] ?? product['isActive']) is bool;

  // ============================================
  // ACTIONS
  // ============================================

  void _toggleSelectionMode() {
    if (_store == null || !_scopeCurrent(_viewContext, _store!.id)) return;
    HapticFeedback.mediumImpact();
    setState(() {
      _isSelectionMode = !_isSelectionMode;
      if (!_isSelectionMode) _selectedProductIds.clear();
    });
  }

  void _toggleProductSelection(String productId) {
    if (_store == null || !_scopeCurrent(_viewContext, _store!.id)) return;
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
    if (_store == null || !_scopeCurrent(_viewContext, _store!.id)) return;
    setState(() {
      _selectedProductIds = _filteredProducts
          .map((p) => p['id'] as String)
          .toSet();
    });
  }

  void _clearSelection() {
    if (_store == null || !_scopeCurrent(_viewContext, _store!.id)) return;
    setState(() => _selectedProductIds.clear());
  }

  Future<void> _hideSelectedProducts() async {
    final store = _store, captured = _viewContext;
    if (store == null ||
        _selectedProductIds.isEmpty ||
        _offline ||
        _statusWorking ||
        !_scopeCurrent(captured, store.id))
      return;
    final rows = _storeProducts
        .where((p) => _selectedProductIds.contains(p['id']))
        .map(ProductContract.fromJson)
        .toList();
    if (rows.length != _selectedProductIds.length) return;
    final confirm = await _showConfirmDialog(
      title: 'Set ${rows.length} products as draft?',
      message:
          'These products stay in your catalog and stop appearing in your store. '
          'Concurrent changes require review.',
      confirmText: 'Set as draft',
      confirmColor: AppColors.lavender,
    );
    if (confirm != true || !_scopeCurrent(captured, store.id)) return;
    await _runStatusAction(
      () => context.read<ProductService>().changeProductStatuses(
        store.id,
        rows,
        'draft',
      ),
    );
  }

  Future<void> _runStatusAction(
    Future<PendingSecurityCommand?> Function() action,
  ) async {
    final store = _store, captured = _viewContext;
    if (store == null || _statusWorking || !_scopeCurrent(captured, store.id))
      return;
    setState(() {
      _statusWorking = true;
      _statusError = null;
    });
    try {
      final pending = await action();
      if (!_scopeCurrent(captured, store.id)) return;
      setState(() {
        _pendingStatus = pending;
        _selectedProductIds.clear();
      });
      await _loadData();
      if (_scopeCurrent(captured, store.id) && pending == null) {
        _showSnackBar('Product changes confirmed. Catalog refreshed.');
      }
    } catch (error) {
      if (!_scopeCurrent(captured, store.id)) return;
      // Retain the original encrypted request even if its acknowledgement or
      // current authority is lost. A fresh list read retires private rows on denial.
      await _loadData();
      if (_scopeCurrent(captured, store.id))
        setState(() {
          _statusError = error is ApiException
              ? error.message
              : 'Product changes could not be confirmed. Recover the saved request.';
        });
    } finally {
      if (_scopeCurrent(captured, store.id))
        setState(() => _statusWorking = false);
    }
  }

  Future<void> _reviewStatusConflicts() async {
    final store = _store, captured = _viewContext, original = _pendingStatus;
    if (store == null ||
        original == null ||
        _statusWorking ||
        _offline ||
        !_scopeCurrent(captured, store.id))
      return;
    setState(() => _statusWorking = true);
    try {
      final reviewed = await context
          .read<ProductService>()
          .reviewProductStatuses(store.id);
      if (!_scopeCurrent(captured, store.id)) return;
      final confirmed = await _showConfirmDialog(
        title: 'Review current product versions',
        message:
            '${reviewed.map((p) => '${p.name}: ${p.status}, version ${p.version}').join('\n')}\n\n'
            'Apply the saved status "${original.intent['target']}" to these current versions?',
        confirmText: 'Apply saved status',
        confirmColor: AppColors.lavender,
      );
      if (!_scopeCurrent(captured, store.id)) return;
      setState(() => _statusWorking = false);
      if (confirmed == true)
        await _runStatusAction(
          () => context.read<ProductService>().applyReviewedProductStatuses(
            store.id,
            original,
            reviewed,
          ),
        );
    } catch (_) {
      if (_scopeCurrent(captured, store.id))
        setState(() {
          _statusError =
              'Current product versions could not be read. Your saved changes are kept.';
        });
    } finally {
      if (_scopeCurrent(captured, store.id))
        setState(() => _statusWorking = false);
    }
  }

  Widget _buildStatusRecovery() {
    final items = (_pendingStatus?.intent['items'] as List?) ?? const [];
    final conflicts = items.where((row) => row['outcome'] == 'conflict').length;
    final pending = items.where((row) => row['outcome'] == 'pending').length;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_pendingStatus != null) ...[
            Text(
              'Saved product changes: $pending awaiting confirmation, $conflicts needing review.',
            ),
            Wrap(
              spacing: 8,
              children: [
                if (pending > 0 || conflicts == 0)
                  TextButton(
                    onPressed: _statusWorking || _offline
                        ? null
                        : () => _runStatusAction(
                            () => context
                                .read<ProductService>()
                                .retryProductStatuses(_store!.id),
                          ),
                    child: const Text('Retry saved product changes'),
                  ),
                if (conflicts > 0)
                  TextButton(
                    onPressed: _statusWorking || _offline
                        ? null
                        : _reviewStatusConflicts,
                    child: const Text('Review conflicting products'),
                  ),
              ],
            ),
          ],
          if (_statusError != null) Text(_statusError!),
        ],
      ),
    );
  }

  void _navigateToAddProduct() async {
    final captured = _viewContext, storeId = _store?.id;
    if (!_canPresent || storeId == null || !_scopeCurrent(captured, storeId))
      return;
    final result = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => const ProductFormScreen()),
    );
    if (result == true && _scopeCurrent(captured, storeId)) _loadData();
  }

  Future<void> _openProductEditor(Map<String, dynamic> product) async {
    final captured = _viewContext, storeId = _store?.id;
    if (!_canPresent || storeId == null || !_scopeCurrent(captured, storeId))
      return;
    final result = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) =>
            ProductFormScreen(product: ProductContract.fromJson(product)),
      ),
    );
    if (result == true && _scopeCurrent(captured, storeId)) _loadData();
  }

  Future<void> _navigateToImport() async {
    final store = _store, captured = _viewContext;
    if (!_canPresent || store == null || !_scopeCurrent(captured, store.id))
      return;
    await Navigator.push<void>(
      context,
      MaterialPageRoute(builder: (_) => CsvImportScreen(storeId: store.id)),
    );
    // Imports continue durably after leaving their page. Returning always reads
    // the current catalog; a popped route's return value is not a job receipt.
    if (_scopeCurrent(captured, store.id)) await _loadData();
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
      if (_scopeCurrent(captured, store.id)) {
        _showSnackBar(
          'Unable to add a sample product right now.',
          isError: true,
        );
      }
    } finally {
      if (_scopeCurrent(captured, store.id))
        setState(() => _isSeedingSample = false);
    }
  }

  void _exportProducts() async {
    final store = _store, captured = _viewContext;
    if (!_canPresent || store == null || !_scopeCurrent(captured, store.id))
      return;

    if (_exportOpening || _isExporting || _exportPending) return;
    setState(() => _exportOpening = true);
    String? format;
    try {
      format = await showLetbuyyFormSheet<String>(
        context: context,
        builder: (sheet) => Consumer<StoreContext>(
          builder: (_, stores, __) {
            final current =
                stores.requestContextKey == captured &&
                stores.selectedStoreId == store.id;
            return LetbuyyFormSheet(
              title: current ? 'Export Products' : 'Store context changed',
              description: current
                  ? 'Export this store’s catalog as CSV. List filters and selected rows do not narrow this file.'
                  : 'Close this choice and reopen it from the selected store.',
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(sheet),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: current ? () => Navigator.pop(sheet, 'csv') : null,
                  child: const Text('Prepare CSV'),
                ),
              ],
              child: current
                  ? const Text('Export as CSV · spreadsheet format')
                  : const SizedBox.shrink(),
            );
          },
        ),
      );
    } finally {
      if (_scopeCurrent(captured, store.id))
        setState(() => _exportOpening = false);
    }

    if (format == 'csv' && _scopeCurrent(captured, store.id) && _canPresent) {
      setState(() => _isExporting = true);
      try {
        final service = context.read<ProductService>();
        final result = await service.exportProducts(store.id);
        if (!_scopeCurrent(captured, store.id)) return;
        final job = result['job'] is Map ? result['job'] as Map : const {};
        var latest = Map<String, dynamic>.from(job);
        setState(() {
          _exportJob = Map<String, dynamic>.from(latest);
          _exportError = null;
        });
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
        setState(() => _exportJob = Map<String, dynamic>.from(latest));
        final status = latest['status']?.toString() ?? 'unconfirmed';
        final downloadUrl = latest['download_url']?.toString();
        if (status == 'completed' &&
            downloadUrl != null &&
            downloadUrl.isNotEmpty) {
          await shareMerchantExport(
            api: context.read<ApiClient>(),
            job: latest,
            isCurrent: () => _scopeCurrent(captured, store.id) && _canPresent,
          );
          if (!_scopeCurrent(captured, store.id)) return;
          _showSnackBar(
            'Product CSV export ready to share.',
            kind: LetbuyyFeedbackKind.information,
          );
        } else {
          _showSnackBar(
            'Product CSV export $status. Check this export for an update.',
            kind: status == 'failed'
                ? LetbuyyFeedbackKind.error
                : LetbuyyFeedbackKind.information,
          );
        }
      } catch (error) {
        if (_scopeCurrent(captured, store.id)) {
          setState(
            () => _exportError = _exportJob == null
                ? 'The export request was not confirmed and no job reference was received. A file may still be preparing.'
                : 'This export is not confirmed. Check its original status before preparing another file.',
          );
          _showSnackBar(
            'Product export could not be confirmed. Review the export status.',
            isError: true,
          );
        }
      } finally {
        if (_scopeCurrent(captured, store.id))
          setState(() => _isExporting = false);
      }
    }
  }

  Future<void> _checkExportStatus() async {
    final captured = _viewContext, storeId = _store?.id;
    final id = _exportJob?['id']?.toString();
    if (!_canPresent ||
        storeId == null ||
        id == null ||
        id.isEmpty ||
        _isExporting ||
        !_scopeCurrent(captured, storeId))
      return;
    setState(() {
      _isExporting = true;
      _exportError = null;
    });
    try {
      final detail = await context.read<ProductService>().fetchExportJob(id);
      if (!_scopeCurrent(captured, storeId)) return;
      final job = detail['job'] is Map
          ? Map<String, dynamic>.from(detail['job'] as Map)
          : detail;
      if (job['id']?.toString() != id) {
        setState(
          () => _exportError =
              'The original export status could not be matched. Keep this screen open and retry the status check.',
        );
        return;
      }
      setState(() => _exportJob = Map<String, dynamic>.from(job));
    } catch (_) {
      if (_scopeCurrent(captured, storeId))
        setState(
          () => _exportError =
              'The original export status is unavailable. Its reference is kept in this screen.',
        );
    } finally {
      if (_scopeCurrent(captured, storeId))
        setState(() => _isExporting = false);
    }
  }

  Future<void> _shareReadyExport() async {
    final captured = _viewContext, storeId = _store?.id, job = _exportJob;
    if (!_canPresent ||
        storeId == null ||
        job == null ||
        job['status'] != 'completed' ||
        _isExporting ||
        !_scopeCurrent(captured, storeId))
      return;
    setState(() => _isExporting = true);
    try {
      await shareMerchantExport(
        api: context.read<ApiClient>(),
        job: Map<String, dynamic>.from(job),
        isCurrent: () => _scopeCurrent(captured, storeId) && _canPresent,
      );
    } catch (_) {
      if (_scopeCurrent(captured, storeId))
        setState(
          () => _exportError =
              'The CSV could not be shared. Check the original export status and try again.',
        );
    } finally {
      if (_scopeCurrent(captured, storeId))
        setState(() => _isExporting = false);
    }
  }

  Widget _buildExportStatus() => Card(
    child: Padding(
      padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'CSV export: ${_exportJob?['status'] ?? 'unconfirmed'}',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          Text(
            _exportHasReference
                ? 'This screen keeps the known job reference while it remains open. Closing or changing store loses that local reference; it does not cancel the export.'
                : 'No job reference was received. A file may still be preparing. Preparing another CSV may start another export.',
          ),
          if (_exportError != null)
            Semantics(liveRegion: true, child: Text(_exportError!)),
          Wrap(
            spacing: 12,
            runSpacing: 8,
            children: [
              if (_exportJob?['id']?.toString().isNotEmpty == true)
                TextButton(
                  onPressed: _isExporting ? null : _checkExportStatus,
                  child: const Text('Check export status'),
                ),
              if (_exportJob?['status'] == 'completed')
                TextButton(
                  onPressed: _isExporting ? null : _shareReadyExport,
                  child: const Text('Share CSV'),
                ),
            ],
          ),
        ],
      ),
    ),
  );

  Future<bool?> _showConfirmDialog({
    required String title,
    required String message,
    required String confirmText,
    Color confirmColor = Colors.redAccent,
  }) {
    if (!_canPresent) return Future<bool?>.value(false);
    final captured = _viewContext, storeId = _store?.id;
    return showLetbuyyConfirmation(
      context: context,
      title: title,
      message: message,
      confirmLabel: confirmText,
      guard: (dialog, confirmation) => Consumer<StoreContext>(
        builder: (_, stores, __) =>
            stores.requestContextKey == captured &&
                stores.selectedStoreId == storeId
            ? confirmation
            : AlertDialog(
                title: const Text('Store context changed'),
                content: const Text(
                  'Close this dialog and reload the selected store.',
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(dialog, false),
                    child: const Text('Close'),
                  ),
                ],
              ),
      ),
    );
  }

  void _showSnackBar(
    String message, {
    bool isError = false,
    LetbuyyFeedbackKind? kind,
  }) {
    if (!_canPresent) return;
    showLetbuyyOperationFeedback(
      context,
      message: message,
      isError: isError,
      kind: kind,
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
      _searchDebounce?.cancel();
      _searchQuery = '';
      _searchController.clear();
      _viewContext = stores.requestContextKey;
      ++_loadGeneration;
      _store = null;
      _storeProducts = [];
      _pendingStatus = null;
      _statusWorking = false;
      _statusError = null;
      _selectedProductIds.clear();
      _isSelectionMode = false;
      _isSeedingSample = false;
      _exportOpening = false;
      _isExporting = false;
      _exportJob = null;
      _exportError = null;
      _offline = false;
      _page = 1;
      _hasMore = false;
      _isLoading = stores.selectedStoreId != null;
      _loadError = stores.selectedStoreId == null
          ? 'Store access changed. Reload access to continue.'
          : null;
      if (stores.selectedStoreId != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _loadData();
        });
      }
    }
    final actionsVisible = _isSelectionMode && _selectedProductIds.isNotEmpty;
    final ownsActionSpace = actionsVisible || _statusWorking || _isExporting;
    if (_reportedSelectionActions != ownsActionSpace) {
      _reportedSelectionActions = ownsActionSpace;
      final callback = widget.onSelectionActionsChanged;
      final captured = _viewContext, storeId = _store?.id;
      if (callback != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted &&
              (!ownsActionSpace || _scopeCurrent(captured, storeId))) {
            callback(_selectionOwner, ownsActionSpace);
          }
        });
      }
    }
    return LoadingOverlay(
      isLoading: _statusWorking,
      child: Scaffold(
        appBar: _buildHeader(),
        bottomNavigationBar: actionsVisible
            ? SafeArea(top: false, child: _buildBulkActionsBar())
            : null,
        body: RefreshIndicator(
          onRefresh: _loadData,
          child: CustomScrollView(
            key: ValueKey(_viewContext),
            controller: _scrollController,
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_isLoading)
                        Semantics(
                          liveRegion: true,
                          label: 'Loading products',
                          excludeSemantics: true,
                          child: Padding(
                            padding: const EdgeInsets.only(
                              bottom: LetbuyySpacingTokens.space12,
                            ),
                            child: Row(
                              children: [
                                const LoadingIndicator(),
                                const SizedBox(
                                  width: LetbuyySpacingTokens.space12,
                                ),
                                Expanded(
                                  child: Text(
                                    'Loading products',
                                    style: Theme.of(
                                      context,
                                    ).textTheme.bodyLarge,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      if (_isExporting)
                        Semantics(
                          liveRegion: true,
                          child: Text('Preparing product CSV…'),
                        ),
                      if (_store != null)
                        Text(
                          stores.selectedStore?.name ?? _store!.name,
                          style: Theme.of(context).textTheme.bodyLarge,
                        ),
                      const SizedBox(height: LetbuyySpacingTokens.space12),
                      _buildActionToolbar(),
                      if (_exportJob != null || _exportError != null)
                        _buildExportStatus(),
                      if (_loadError == null && !_isLoading) _buildStatsRow(),
                      _buildFilterSortBar(),
                      if (_offline)
                        const Card(
                          child: Padding(
                            padding: EdgeInsets.all(
                              LetbuyySpacingTokens.space16,
                            ),
                            child: Text(
                              'Offline snapshot of this page. Reconnect before making changes.',
                            ),
                          ),
                        ),
                      if (_pendingStatus != null || _statusError != null)
                        _buildStatusRecovery(),
                    ],
                  ),
                ),
              ),
              _buildProductGrid(),
              if (_page > 1 || _hasMore)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
                    child: Wrap(
                      alignment: WrapAlignment.center,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: LetbuyySpacingTokens.space12,
                      runSpacing: LetbuyySpacingTokens.space8,
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
                  ),
                ),
              const SliverToBoxAdapter(child: SizedBox(height: 100)),
            ],
          ),
        ),
      ),
    );
  }

  // ============================================
  // HEADER
  // ============================================

  PreferredSizeWidget _buildHeader() => CustomAppBar.responsive(
    context: context,
    title: 'Products',
    actions: [
      IconButton(
        onPressed: _isLoading ? null : _loadData,
        tooltip: 'Refresh',
        icon: const Icon(Icons.refresh_rounded),
      ),
      PopupMenuButton<String>(
        // Each destination performs its own fresh authorized read. A
        // product-list outage must not hide independent store workspaces.
        enabled:
            !_isLoading &&
            _store != null &&
            _scopeCurrent(_viewContext, _store?.id),
        onOpened: () => _menuView = (key: _viewContext, store: _store?.id),
        icon: Icon(Icons.more_vert, color: colors.textSecondary),
        color: colors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        itemBuilder: (context) => [
          const PopupMenuItem(
            value: 'categories',
            child: Row(
              children: [
                Icon(Icons.category_outlined, size: 20),
                SizedBox(width: 12),
                Expanded(child: Text('Categories')),
              ],
            ),
          ),
          const PopupMenuItem(
            value: 'collections',
            child: Row(
              children: [
                Icon(Icons.collections_bookmark_outlined, size: 20),
                SizedBox(width: 12),
                Expanded(child: Text('Collections')),
              ],
            ),
          ),
          const PopupMenuItem(
            value: 'media',
            child: Row(
              children: [
                Icon(Icons.perm_media_outlined, size: 20),
                SizedBox(width: 12),
                Expanded(child: Text('Media library')),
              ],
            ),
          ),
          const PopupMenuItem(
            value: 'csv',
            child: Row(
              children: [
                Icon(Icons.upload_file_outlined, size: 20),
                SizedBox(width: 12),
                Expanded(child: Text('CSV imports')),
              ],
            ),
          ),
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
                Text('Inventory', style: TextStyle(color: colors.textPrimary)),
              ],
            ),
          ),
        ],
        onSelected: (value) async {
          final view = _menuView;
          _menuView = null;
          if (view == null || !_scopeCurrent(view.key, view.store)) return;
          if (value == 'categories') {
            await Navigator.pushNamed(context, AppRoutes.categories);
            if (_scopeCurrent(view.key, view.store)) await _loadData();
          }
          if (value == 'collections') {
            await Navigator.pushNamed(context, AppRoutes.collections);
            if (_scopeCurrent(view.key, view.store)) await _loadData();
          }
          if (value == 'media') {
            await Navigator.pushNamed(context, AppRoutes.media);
          }
          if (value == 'csv') {
            await _navigateToImport();
          }
          if (value == 'inventory')
            Navigator.pushNamed(context, AppRoutes.inventory);
        },
      ),
    ],
  );

  Widget _buildActionToolbar() => Wrap(
    spacing: LetbuyySpacingTokens.space8,
    runSpacing: LetbuyySpacingTokens.space8,
    children: [
      OutlinedButton.icon(
        onPressed: _store == null || _isLoading ? null : _navigateToImport,
        icon: const Icon(Icons.download_rounded),
        label: const Text('Import'),
      ),
      OutlinedButton.icon(
        onPressed:
            _store == null ||
                _isLoading ||
                _exportOpening ||
                _isExporting ||
                _exportPending
            ? null
            : _exportProducts,
        icon: const Icon(Icons.upload_rounded),
        label: const Text('Export'),
      ),
      FilledButton.icon(
        onPressed: _store == null || _isLoading ? null : _navigateToAddProduct,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add'),
      ),
      OutlinedButton.icon(
        onPressed: _store == null || _isLoading ? null : _toggleSelectionMode,
        icon: Icon(
          _isSelectionMode ? Icons.close_rounded : Icons.checklist_rounded,
        ),
        label: Text(_isSelectionMode ? 'Cancel' : 'Select'),
      ),
    ],
  );

  Widget _buildStatsRow() {
    final activeKnown = _storeProducts.every(_hasActiveFlag);
    final stockKnown = _storeProducts.every(_hasStock);
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
            activeKnown ? '$_activeCount' : '—',
            const Color(0xFF22C55E),
          ),
          _buildStatChip(
            'Out of stock on page',
            stockKnown ? '$_outOfStockCount' : '—',
            const Color(0xFFEF4444),
          ),
          if (!activeKnown || _inactiveCount > 0) ...[
            _buildStatChip(
              'Hidden on page',
              activeKnown ? '$_inactiveCount' : '—',
              colors.textTertiary,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStatChip(String label, String value, Color color) => Card(
    margin: EdgeInsets.zero,
    child: Padding(
      padding: const EdgeInsets.all(LetbuyySpacingTokens.space8),
      child: Text(
        '$value $label',
        style: Theme.of(context).textTheme.bodyMedium,
      ),
    ),
  );

  Widget _buildFilterSortBar() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const SizedBox(height: LetbuyySpacingTokens.space16),
      CustomTextField(
        enabled: _store != null && _scopeCurrent(_viewContext, _store?.id),
        controller: _searchController,
        label: 'Search product names',
        hint: 'Search product names...',
        prefixIcon: Icons.search,
        suffixIcon: _searchQuery.isEmpty
            ? null
            : IconButton(
                tooltip: 'Clear product search',
                onPressed: () {
                  _searchController.clear();
                  _queryChanged(search: '');
                },
                icon: const Icon(Icons.close),
              ),
        onChanged: (value) => _queryChanged(search: value),
      ),
      Wrap(
        spacing: LetbuyySpacingTokens.space12,
        runSpacing: LetbuyySpacingTokens.space8,
        children: [
          LetbuyyChoiceField<String>(
            compact: true,
            label: 'Product status',
            value: _statusFilter,
            choices: const [
              LetbuyyChoice(value: 'all', label: 'All'),
              LetbuyyChoice(value: 'active', label: 'Active'),
              LetbuyyChoice(value: 'inactive', label: 'Inactive'),
              LetbuyyChoice(value: 'draft', label: 'Draft'),
              LetbuyyChoice(value: 'archived', label: 'Archived'),
              LetbuyyChoice(value: 'out_of_stock', label: 'Out of Stock'),
              LetbuyyChoice(value: 'low_stock', label: 'Stock 1–5'),
            ],
            onChanged: _store == null
                ? null
                : (value) => _queryChanged(status: value),
          ),
          LetbuyyChoiceField<String>(
            compact: true,
            label: 'Sort products',
            value: _sortBy,
            choices: const [
              LetbuyyChoice(value: 'newest', label: 'Newest'),
              LetbuyyChoice(value: 'oldest', label: 'Oldest'),
              LetbuyyChoice(value: 'name_asc', label: 'Name A-Z'),
              LetbuyyChoice(value: 'name_desc', label: 'Name Z-A'),
              LetbuyyChoice(value: 'price_asc', label: 'Price ↑'),
              LetbuyyChoice(value: 'price_desc', label: 'Price ↓'),
            ],
            onChanged: _store == null
                ? null
                : (value) => _queryChanged(sort: value),
          ),
        ],
      ),
    ],
  );

  Widget _buildProductGrid() {
    if (_isLoading)
      return const SliverToBoxAdapter(
        child: Padding(
          padding: EdgeInsets.all(LetbuyySpacingTokens.space16),
          child: ExcludeSemantics(child: SkeletonCard(height: 160)),
        ),
      );
    if (_loadError != null)
      return SliverToBoxAdapter(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ErrorView(
              title: 'Products unavailable',
              message: _loadError!,
              onRetry: _loadData,
              retryLabel: 'Retry products',
            ),
            if (['out_of_stock', 'low_stock'].contains(_statusFilter))
              TextButton(
                onPressed: () => _queryChanged(status: 'all'),
                child: const Text('Clear stock filter'),
              ),
          ],
        ),
      );
    if (_storeProducts.isEmpty &&
        _searchQuery.trim().isEmpty &&
        _statusFilter == 'all' &&
        _page == 1) {
      return SliverToBoxAdapter(child: _buildEmptyState());
    }
    if (_filteredProducts.isEmpty)
      return SliverToBoxAdapter(
        child: EmptyState(
          icon: Icons.search_off,
          title: 'No products match your filters',
          actionLabel: 'Clear Filters',
          onAction: () {
            _searchController.clear();
            _queryChanged(search: '', status: 'all');
          },
        ),
      );
    return SliverPadding(
      padding: const EdgeInsets.symmetric(
        horizontal: LetbuyySpacingTokens.space16,
      ),
      sliver: SliverToBoxAdapter(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final scale = MediaQuery.textScalerOf(context).scale(16) / 16;
            final columns = scale > 1.4 || constraints.maxWidth < 360 ? 1 : 2;
            const gap = LetbuyySpacingTokens.space12;
            final width =
                (constraints.maxWidth - gap * (columns - 1)) / columns;
            // The unchanged server page is bounded to20 by ProductService.
            // Natural card height keeps names and exact amounts readable.
            return Wrap(
              spacing: gap,
              runSpacing: gap,
              children: [
                for (final product in _filteredProducts)
                  SizedBox(width: width, child: _buildProductCard(product)),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildProductCard(Map<String, dynamic> product) {
    final productId = product['id'] as String;
    final name = product['name'] as String? ?? 'Untitled';
    final rawPrice = product['price'] ?? product['salePrice'];
    final priceKnown = rawPrice is num && rawPrice.isFinite;
    final rawCompare =
        product['compare_price'] ??
        product['comparePrice'] ??
        product['originalPrice'];
    final salePrice = priceKnown ? _productPrice(product) : 0.0;
    final originalPrice = rawCompare is num && rawCompare.isFinite
        ? _productComparePrice(product)
        : null;
    final images = product['images'] as List<dynamic>? ?? [];
    final imageUrl = images.isNotEmpty ? images.first as String : null;
    final stockKnown = _hasStock(product),
        activeKnown = _hasActiveFlag(product);
    final stock = _productStock(product) ?? 0;
    final isActive = _productIsActive(product);
    final isOutOfStock = stock <= 0;
    final isSelected = _selectedProductIds.contains(productId);
    final catalogStatus =
        const {
          'active': 'Active',
          'inactive': 'Inactive',
          'draft': 'Draft',
          'archived': 'Archived',
        }[product['status']] ??
        'Unavailable';

    // Determine status
    String statusText;
    if (!stockKnown) {
      statusText = 'Inventory unavailable';
    } else if (isOutOfStock) {
      statusText = 'Out of Stock';
    } else if (!activeKnown) {
      statusText = 'Availability unavailable';
    } else if (!isActive) {
      statusText = 'Inactive';
    } else if (stock <= 5) {
      statusText = 'Low Stock';
    } else {
      statusText = 'Active';
    }

    // Discount
    final hasDiscount =
        priceKnown && originalPrice != null && originalPrice > salePrice;
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
      'Catalog status $catalogStatus',
      statusText,
      stockKnown ? 'Stock $stock' : 'Stock unavailable',
      priceKnown
          ? 'Price INR ${salePrice.toStringAsFixed(2)}'
          : 'Price unavailable',
      if (hasDiscount) 'was INR ${originalPrice!.toStringAsFixed(2)}',
    ].join(', ');

    return _CatalogProductCard(
      key: ValueKey('product-card-$productId'),
      productId: productId,
      name: name,
      semanticsLabel: semanticsLabel,
      price: priceKnown
          ? PriceFormatter.formatPrice(salePrice)
          : 'Price unavailable',
      comparePrice: hasDiscount
          ? PriceFormatter.formatPrice(originalPrice!)
          : null,
      discount: hasDiscount && stockKnown && !isOutOfStock
          ? '$discountPercent% OFF'
          : null,
      imageUrl: imageUrl,
      stock: stockKnown ? stock : null,
      status: statusText,
      catalogStatus: catalogStatus,
      selectionMode: _isSelectionMode,
      selected: isSelected,
      onTap: handleTap,
      onSelect: () => _toggleProductSelection(productId),
      onLongPress: () {
        if (!_isSelectionMode) {
          _toggleSelectionMode();
          _toggleProductSelection(productId);
        }
      },
    );
  }

  Widget _buildEmptyState() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const EmptyState(
        icon: Icons.inventory_2_outlined,
        title: 'No Products Yet',
        message: 'Add or import products to display them in your store',
      ),
      Padding(
        padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
        child: Wrap(
          alignment: WrapAlignment.center,
          spacing: LetbuyySpacingTokens.space12,
          runSpacing: LetbuyySpacingTokens.space12,
          children: [
            if (_store != null)
              OutlinedButton.icon(
                onPressed: _navigateToImport,
                icon: const Icon(Icons.download_rounded),
                label: const Text('Import CSV'),
              ),
            OutlinedButton.icon(
              onPressed: _store == null || _isSeedingSample || _offline
                  ? null
                  : _seedSampleProduct,
              icon: _isSeedingSample
                  ? const LoadingIndicator(size: 18)
                  : const Icon(Icons.auto_awesome_outlined),
              label: Text(
                _isSeedingSample ? 'Adding sample' : 'Add sample product',
              ),
            ),
            FilledButton.icon(
              onPressed: _navigateToAddProduct,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Add Product'),
            ),
          ],
        ),
      ),
    ],
  );

  Widget _buildBulkActionsBar() => Padding(
    padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
    child: Wrap(
      spacing: LetbuyySpacingTokens.space12,
      runSpacing: LetbuyySpacingTokens.space12,
      children: [
        AccessibleTapRegion(
          key: const ValueKey('products-select-all-visible'),
          focusNode: _selectAllFocus,
          label: '${_selectedProductIds.length} products selected',
          hint: 'Select all visible products',
          onTap: _selectAll,
          excludeChildSemantics: true,
          child: OutlinedButton(
            focusNode: _selectAllFocus,
            onPressed: _selectAll,
            child: Text('${_selectedProductIds.length} selected'),
          ),
        ),
        OutlinedButton.icon(
          onPressed: _statusWorking || _pendingStatus != null || _offline
              ? null
              : _hideSelectedProducts,
          icon: const Icon(Icons.visibility_off_rounded),
          label: const Text('Set as draft'),
        ),
      ],
    ),
  );
}

/// A view of one already parsed product; it owns input focus only. Commands,
/// prices, selection membership and operation identity remain with the caller.
class _CatalogProductCard extends StatefulWidget {
  const _CatalogProductCard({
    super.key,
    required this.productId,
    required this.name,
    required this.semanticsLabel,
    required this.price,
    required this.stock,
    required this.status,
    required this.catalogStatus,
    required this.selectionMode,
    required this.selected,
    required this.onTap,
    required this.onSelect,
    required this.onLongPress,
    this.comparePrice,
    this.discount,
    this.imageUrl,
  });
  final String productId, name, semanticsLabel, price, status, catalogStatus;
  final String? comparePrice, discount, imageUrl;
  final int? stock;
  final bool selectionMode, selected;
  final VoidCallback onTap, onSelect, onLongPress;
  @override
  State<_CatalogProductCard> createState() => _CatalogProductCardState();
}

class _CatalogProductCardState extends State<_CatalogProductCard> {
  final _focus = FocusNode(debugLabel: 'Product');
  final _selectionFocus = FocusNode(debugLabel: 'Select product');
  @override
  void dispose() {
    _focus.dispose();
    _selectionFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context), scheme = Theme.of(context).colorScheme;
    return AccessibleTapRegion(
      focusNode: _focus,
      label: widget.semanticsLabel,
      hint: widget.selectionMode
          ? (widget.selected
                ? 'Tap to deselect product'
                : 'Tap to select product')
          : 'Opens product editor',
      selected: widget.selectionMode ? widget.selected : null,
      onTap: widget.onTap,
      child: Card(
        margin: EdgeInsets.zero,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(LetbuyyRadiusTokens.lg * 1.0),
          side: BorderSide(
            color: widget.selected ? scheme.primary : scheme.outlineVariant,
            width: widget.selected ? 2 : 1,
          ),
        ),
        child: InkWell(
          focusNode: _focus,
          excludeFromSemantics: true,
          onTap: widget.onTap,
          onLongPress: widget.onLongPress,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ExcludeSemantics(
                child: SizedBox(
                  height: 120,
                  child: widget.imageUrl == null
                      ? Icon(
                          Icons.image_outlined,
                          color: scheme.onSurfaceVariant,
                        )
                      : CachedMerchantImage(
                          imageUrl: widget.imageUrl!,
                          fit: BoxFit.cover,
                          errorBuilder: (_) => Icon(
                            Icons.broken_image_outlined,
                            color: scheme.onSurfaceVariant,
                          ),
                        ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    ExcludeSemantics(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(widget.name, style: theme.textTheme.titleMedium),
                          const SizedBox(height: LetbuyySpacingTokens.space12),
                          Text(widget.price, style: theme.textTheme.titleLarge),
                          if (widget.comparePrice != null)
                            Text(
                              widget.comparePrice!,
                              style: theme.textTheme.bodyMedium?.copyWith(
                                decoration: TextDecoration.lineThrough,
                              ),
                            ),
                          if (widget.discount != null)
                            Text(
                              widget.discount!,
                              style: theme.textTheme.bodySmall,
                            ),
                          const SizedBox(height: LetbuyySpacingTokens.space8),
                          Text(
                            widget.status,
                            style: theme.textTheme.bodyMedium,
                          ),
                          Text(
                            'Catalog status: ${widget.catalogStatus}',
                            style: theme.textTheme.bodyMedium,
                          ),
                          Text(
                            widget.stock == null
                                ? 'Stock unavailable'
                                : 'Stock: ${widget.stock}',
                            style: theme.textTheme.bodyMedium,
                          ),
                        ],
                      ),
                    ),
                    if (widget.selectionMode)
                      AccessibleTapRegion(
                        key: ValueKey('product-select-${widget.productId}'),
                        focusNode: _selectionFocus,
                        label:
                            '${widget.selected ? 'Deselect' : 'Select'} product ${widget.name}',
                        selected: widget.selected,
                        onTap: widget.onSelect,
                        excludeChildSemantics: true,
                        child: CheckboxListTile(
                          focusNode: _selectionFocus,
                          contentPadding: EdgeInsets.zero,
                          controlAffinity: ListTileControlAffinity.leading,
                          title: const Text('Select product'),
                          value: widget.selected,
                          onChanged: (_) => widget.onSelect(),
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
}
