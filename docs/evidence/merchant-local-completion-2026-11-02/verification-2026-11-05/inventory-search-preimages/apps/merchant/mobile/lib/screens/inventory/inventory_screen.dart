import '../../widgets/shared/warehouse_list_scaffold.dart';
import '../../widgets/shared/merchant_option_picker.dart';
import '../../services/api_client.dart' show ApiException;
import '../../widgets/shared/merchant_store_view.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';

import '../../app/routes.dart';
import '../../services/inventory_service.dart';
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;
import '../../widgets/shared/barcode_scanner_sheet.dart';

class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key});

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  final TextEditingController _searchController = TextEditingController();

  List<InventoryLevel> _levels = [];
  bool _isLoading = true;
  bool _lowStockOnly = false;
  String _query = '';
  String? _storeId;
  String? _error;
  Object? _viewKey, _loadedQuery;
  Object get _readQuery => (_viewKey, _storeId, _page, _lowStockOnly);
  bool _checkingPending = false;
  int _readGeneration = 0, _page = 1;
  bool _hasMore = false, _isAdjusting = false;
  bool _hasPendingAdjustment = false, _pendingUnavailable = true;
  bool get _commandsBlocked =>
      _isAdjusting ||
      _hasPendingAdjustment ||
      _pendingUnavailable ||
      _isLoading ||
      _error != null;
  MerchantStoreView? get _view =>
      _storeId == null ? null : (key: _viewKey, storeId: _storeId!);
  bool _matches(MerchantStoreView? view) =>
      mounted && merchantStoreViewCurrent(context, view);

  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _viewKey = context.read<StoreContext>().requestContextKey;
    _loadInventory();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadInventory({bool retain = false}) async {
    if (!mounted) return;
    final keep = retain && _loadedQuery == _readQuery && _matches(_view);
    final generation = ++_readGeneration;
    setState(() {
      _isLoading = true;
      _error = null;
      if (!keep) {
        _levels = [];
        _hasMore = false;
        _loadedQuery = null;
      }
      _pendingUnavailable = true;
      _checkingPending = true;
    });
    final stores = context.read<StoreContext>();
    try {
      await stores.ensureSelectedStore();
      if (!mounted || generation != _readGeneration) return;
      _viewKey = stores.requestContextKey;
      _storeId = stores.selectedStoreId;
      final view = _view;
      if (view == null) {
        setState(() {
          _isLoading = false;
          _error = 'Select a store to view inventory.';
        });
        return;
      }
      final query = _readQuery;
      final service = context.read<InventoryService>();
      final levels = await service.fetchLevels(
        view.storeId,
        lowStockOnly: _lowStockOnly,
        page: _page,
      );
      if (!_matches(view) || generation != _readGeneration) return;
      setState(() {
        _levels = levels;
        _hasMore = service.levelsHasMore;
        _loadedQuery = query;
        _isLoading = false;
      });
      var pending = false, pendingUnavailable = false;
      try {
        pending = await service.pendingAdjustment(view.storeId) != null;
      } catch (_) {
        pendingUnavailable = true;
      }
      if (!_matches(view) || generation != _readGeneration) return;
      setState(() {
        _levels = levels;
        _hasMore = service.levelsHasMore;
        _hasPendingAdjustment = pending;
        _pendingUnavailable = pendingUnavailable;
        _checkingPending = false;
        _isLoading = false;
      });
    } catch (error) {
      if (!mounted || generation != _readGeneration) return;
      if (_viewKey != stores.requestContextKey &&
          stores.selectedStoreId != null)
        return;
      if (_viewKey != stores.requestContextKey &&
          error is ApiException &&
          error.code == 'SESSION_CONTEXT_CHANGED')
        return;
      setState(() {
        _viewKey = stores.requestContextKey;
        _storeId = stores.selectedStoreId;
        if (!keep ||
            error is ApiException && [401, 403].contains(error.statusCode)) {
          _levels = [];
          _hasMore = false;
          _loadedQuery = null;
        }
        _checkingPending = false;
        _error = 'Check your connection and current store access, then retry.';
        _isLoading = false;
      });
    }
  }

  void _changePage(int delta) {
    if (_isLoading || (delta < 0 && _page == 1) || (delta > 0 && !_hasMore))
      return;
    setState(() => _page += delta);
    _loadInventory();
  }

  List<InventoryLevel> get _filteredLevels {
    final query = _query.trim().toLowerCase();
    final levels = _lowStockOnly
        ? _levels.where((level) => level.isLowStock || level.isOutOfStock)
        : _levels;
    if (query.isEmpty) return levels.toList(growable: false);
    return levels
        .where(
          (level) =>
              level.productName.toLowerCase().contains(query) ||
              level.variantTitle.toLowerCase().contains(query) ||
              level.locationName.toLowerCase().contains(query) ||
              level.sku.toLowerCase().contains(query) ||
              level.locationId.toLowerCase().contains(query),
        )
        .toList(growable: false);
  }

  int get _availableUnits =>
      _filteredLevels.fold(0, (sum, level) => sum + level.available);
  int get _lowStockCount =>
      _filteredLevels.where((level) => level.isLowStock).length;
  int get _outOfStockCount =>
      _filteredLevels.where((level) => level.isOutOfStock).length;

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    final stores = context.watch<StoreContext>();
    if (_viewKey != stores.requestContextKey) {
      _viewKey = stores.requestContextKey;
      ++_readGeneration;
      _loadedQuery = null;
      _checkingPending = false;
      _storeId = null;
      _levels = [];
      _hasMore = false;
      _query = '';
      _searchController.clear();
      _page = 1;
      _error = null;
      _isLoading = true;
      _isAdjusting = false;
      _hasPendingAdjustment = false;
      _pendingUnavailable = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _loadInventory();
      });
    }

    final view = _view, generation = _readGeneration;
    bool current() =>
        _matches(view) &&
        generation == _readGeneration &&
        mobile_tokens.isLetbuyySurfaceCurrent(context);
    final readKey = stores.requestContextKey;
    bool currentRead() =>
        mounted &&
        generation == _readGeneration &&
        context.read<StoreContext>().requestContextKey == readKey &&
        mobile_tokens.isLetbuyySurfaceCurrent(context);
    return WarehouseListScaffold(
      scrollIdentity: (_readQuery, _query),
      title: 'Inventory',
      description:
          'Adjust stock and monitor low inventory. Search and the shown metrics apply only to this loaded page.',
      refreshLabel: 'Refresh inventory',
      loading: _isLoading,
      onRefresh: _isLoading
          ? null
          : () async {
              if (currentRead() && !_isLoading)
                await _loadInventory(retain: true);
            },
      headerActions: [
        IconButton(
          tooltip: 'Scan barcode',
          icon: const Icon(Icons.qr_code_scanner_rounded),
          onPressed: _commandsBlocked
              ? null
              : () {
                  if (current()) _scanAndAdjust();
                },
        ),
      ],
      header: [
        _searchAndFilter(),
        _wmsShortcuts(),
        if (_loadedQuery != null) _stats(),
        if (_isLoading && _loadedQuery != null)
          const Text(
            'Refreshing the same page. Previously loaded quantities are shown below.',
          ),
        if (_error != null && _loadedQuery != null)
          Text(
            'Refresh unavailable. Previously loaded quantities are shown below. $_error',
          ),
        if (!_isLoading && _hasPendingAdjustment)
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('A stock change needs confirmation'),
              const Text(
                'Retry the original saved change before starting another adjustment.',
              ),
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: TextButton(
                  onPressed: _isAdjusting
                      ? null
                      : () {
                          if (current()) _retryPendingAdjustment();
                        },
                  child: const Text('Retry original'),
                ),
              ),
            ],
          ),
        if (_checkingPending) const Text('Checking saved stock changes…'),
        if (!_checkingPending &&
            !_isLoading &&
            _pendingUnavailable &&
            _error == null)
          const Text(
            'Saved stock changes could not be checked. Refresh before adjusting inventory.',
          ),
        if (_page > 1 || _hasMore)
          Wrap(
            alignment: WrapAlignment.center,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              TextButton(
                onPressed: _page > 1 && !_isLoading
                    ? () {
                        if (current()) _changePage(-1);
                      }
                    : null,
                child: const Text('Previous'),
              ),
              Text('Page $_page'),
              TextButton(
                onPressed: _hasMore && !_isLoading
                    ? () {
                        if (current()) _changePage(1);
                      }
                    : null,
                child: const Text('Next'),
              ),
            ],
          ),
      ],
      slivers: [
        _isLoading && _loadedQuery == null
            ? _loading()
            : _body(
                onRetry: () {
                  if (currentRead() && !_isLoading) _loadInventory();
                },
              ),
      ],
    );
  }

  Widget _searchAndFilter() {
    final view = _view, generation = _readGeneration;
    bool current() =>
        _matches(view) &&
        generation == _readGeneration &&
        mobile_tokens.isLetbuyySurfaceCurrent(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        mobile_tokens.CustomTextField(
          controller: _searchController,
          label: 'Filter this page',
          helperText: 'Filter this page by product, SKU or location',
          prefixIcon: Icons.search_rounded,
          onChanged: (value) {
            if (current()) setState(() => _query = value);
          },
        ),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: Tooltip(
            message: 'Low stock only',
            child: FilterChip(
              selected: _lowStockOnly,
              label: const Text('Low'),
              avatar: const Icon(Icons.warning_amber_rounded, size: 18),
              onSelected: (selected) {
                if (!current()) return;
                setState(() {
                  _lowStockOnly = selected;
                  _page = 1;
                });
                _loadInventory();
              },
            ),
          ),
        ),
      ],
    );
  }

  Widget _wmsShortcuts() {
    final items = [
      _WmsShortcut(
        label: 'Stock history',
        icon: Icons.history,
        route: AppRoutes.inventoryHistory,
      ),
      _WmsShortcut(
        label: 'Reservations',
        icon: Icons.lock_clock_outlined,
        route: AppRoutes.inventoryReservations,
      ),
      _WmsShortcut(
        label: 'Receipts',
        icon: Icons.receipt_long_outlined,
        route: AppRoutes.inventoryReceipts,
      ),
      _WmsShortcut(
        label: 'Locations',
        icon: Icons.warehouse_outlined,
        route: AppRoutes.inventoryLocations,
      ),
      _WmsShortcut(
        label: 'Suppliers',
        icon: Icons.handshake_outlined,
        route: AppRoutes.inventorySuppliers,
      ),
      _WmsShortcut(
        label: 'Purchase orders',
        icon: Icons.add_box_outlined,
        route: AppRoutes.purchaseOrders,
      ),
      _WmsShortcut(
        label: 'Transfers',
        icon: Icons.swap_horiz_outlined,
        route: AppRoutes.inventoryTransfers,
      ),
      _WmsShortcut(
        label: 'Operations dashboard',
        icon: Icons.analytics_outlined,
        route: AppRoutes.inventoryOperations,
      ),
    ];

    return SizedBox(
      height: (MediaQuery.textScalerOf(context).scale(18) + 24).clamp(
        48.0,
        double.infinity,
      ),
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
        scrollDirection: Axis.horizontal,
        itemBuilder: (context, index) {
          final item = items[index];
          return ActionChip(
            avatar: Icon(item.icon, size: 18),
            label: Text(item.label),
            onPressed: () => Navigator.pushNamed(context, item.route),
            backgroundColor: colors.card,
            side: BorderSide(color: colors.cardBorder),
            labelStyle: TextStyle(
              color: colors.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          );
        },
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemCount: items.length,
      ),
    );
  }

  OutlineInputBorder _inputBorder(Color color) {
    return OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: color),
    );
  }

  Widget _stats() => Padding(
    padding: const EdgeInsets.symmetric(vertical: 12),
    child: mobile_tokens.StatGrid(
      minimumTileWidth: 110,
      children: [
        _metric(
          'Available shown',
          _availableUnits.toString(),
          Icons.inventory_2_outlined,
        ),
        _metric(
          'Low shown',
          _lowStockCount.toString(),
          Icons.warning_amber_rounded,
        ),
        _metric(
          'Out shown',
          _outOfStockCount.toString(),
          Icons.remove_shopping_cart_outlined,
        ),
      ],
    ),
  );
  Widget _metric(String label, String value, IconData icon) =>
      mobile_tokens.StatTile(icon: icon, label: label, value: value);

  Widget _loading() {
    return SliverFillRemaining(
      hasScrollBody: false,
      child: Center(
        child: CircularProgressIndicator(
          color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
        ),
      ),
    );
  }

  Widget _body({VoidCallback? onRetry}) {
    if (_error != null && _loadedQuery == null) {
      return _centerState(
        icon: Icons.error_outline_rounded,
        title: 'Could not load inventory',
        subtitle: _error!,
        action: TextButton.icon(
          onPressed: onRetry,
          icon: const Icon(Icons.refresh_rounded),
          label: const Text('Retry'),
        ),
      );
    }

    if (_levels.isEmpty) {
      return _centerState(
        icon: Icons.inventory_2_outlined,
        title: 'No inventory levels',
        subtitle: 'Stock levels appear after products or variants are created.',
      );
    }

    final levels = _filteredLevels;
    if (levels.isEmpty) {
      return _centerState(
        icon: Icons.search_off_rounded,
        title: 'No matching stock',
        subtitle: 'Try another product, SKU, or clear low-stock filtering.',
      );
    }

    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      sliver: SliverList.builder(
        itemCount: levels.length,
        itemBuilder: (context, index) => _levelCard(levels[index]),
      ),
    );
  }

  Widget _levelCard(InventoryLevel level) {
    final view = _view;
    final tone = level.isOutOfStock
        ? mobile_tokens.LetbuyyStatusTone.danger
        : level.isLowStock
        ? mobile_tokens.LetbuyyStatusTone.warning
        : mobile_tokens.LetbuyyStatusTone.success;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  level.label,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          _stockChip(level, tone),
          const SizedBox(height: 8),
          Wrap(
            spacing: 10,
            runSpacing: 6,
            children: [
              _miniMetric(
                Icons.qr_code_2_rounded,
                level.sku.ifEmpty ?? 'No SKU',
              ),
              _miniMetric(
                Icons.place_outlined,
                level.locationName.isNotEmpty
                    ? level.locationName
                    : level.locationId.isNotEmpty
                    ? level.locationId
                    : 'Choose a location',
              ),
              _miniMetric(
                Icons.lock_outline_rounded,
                '${level.reserved} reserved',
              ),
              _miniMetric(
                Icons.inventory_2_outlined,
                '${level.onHand} on hand',
              ),
              if (level.incoming != null)
                _miniMetric(
                  Icons.local_shipping_outlined,
                  '${level.incoming} incoming',
                ),
              if (level.trackInventory == false)
                _miniMetric(Icons.visibility_off_outlined, 'Tracking off'),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            alignment: WrapAlignment.end,
            spacing: 8,
            runSpacing: 8,
            children: [
              IconButton(
                tooltip: 'View stock history',
                icon: const Icon(Icons.history),
                onPressed: () {
                  if (!_matches(view) || level.storeId != view!.storeId) return;
                  Navigator.pushNamed(
                    context,
                    AppRoutes.inventoryHistory,
                    arguments: {
                      'product_id': level.productId,
                      'product_name': level.productName,
                    },
                  );
                },
              ),
              IconButton(
                tooltip: 'View reservations',
                icon: const Icon(Icons.lock_clock_outlined),
                onPressed: () {
                  if (!_matches(view) || level.storeId != view!.storeId) return;
                  Navigator.pushNamed(
                    context,
                    AppRoutes.inventoryReservations,
                    arguments: {
                      'product_id': level.productId,
                      'product_name': level.productName,
                    },
                  );
                },
              ),
              OutlinedButton.icon(
                onPressed: _commandsBlocked ? null : () => _adjust(level),
                icon: const Icon(Icons.add_task_rounded, size: 18),
                label: const Text('Adjust'),
                style: OutlinedButton.styleFrom(
                  foregroundColor:
                      mobile_tokens.LetbuyyColorTokens.brandPrimary,
                  side: BorderSide(
                    color: mobile_tokens.LetbuyyColorTokens.brandPrimary
                        .withValues(alpha: 0.4),
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _stockChip(
    InventoryLevel level,
    mobile_tokens.LetbuyyStatusTone tone,
  ) {
    final label = level.isOutOfStock
        ? 'Out'
        : level.isLowStock
        ? 'Low'
        : 'In stock';
    return mobile_tokens.LetbuyyStatusBadge(
      label: '${level.available} $label',
      tone: tone,
      compact: true,
    );
  }

  Widget _miniMetric(IconData icon, String value) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: colors.textTertiary),
        const SizedBox(width: 4),
        Flexible(
          child: Text(
            value,
            style: TextStyle(color: colors.textSecondary, fontSize: 12),
          ),
        ),
      ],
    );
  }

  Widget _centerState({
    required IconData icon,
    required String title,
    required String subtitle,
    Widget? action,
  }) {
    return SliverFillRemaining(
      hasScrollBody: false,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: colors.textTertiary, size: 48),
              const SizedBox(height: 12),
              Text(
                title,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: colors.textPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                subtitle,
                textAlign: TextAlign.center,
                style: TextStyle(color: colors.textSecondary),
              ),
              if (action != null) ...[const SizedBox(height: 14), action],
            ],
          ),
        ),
      ),
    );
  }

  Future<String?> _chooseLocation(MerchantStoreView view) async {
    if (!_matches(view) || !mobile_tokens.isLetbuyySurfaceCurrent(context))
      return null;
    final service = context.read<InventoryService>();
    final location = await chooseMerchantOption<InventoryLocationContract>(
      context,
      view,
      'Choose stock location',
      (page, query) => service.readLocationsPage(
        view.storeId,
        page: page,
        search: query,
        status: 'all',
      ),
      (row) => row.name,
    );
    if (!_matches(view) || !mobile_tokens.isLetbuyySurfaceCurrent(context))
      return null;
    return location?.id;
  }

  Future<void> _retryPendingAdjustment() async {
    if (!mounted || !mobile_tokens.isLetbuyySurfaceCurrent(context)) return;
    final view = _view;
    if (!_matches(view) || _isAdjusting || !_hasPendingAdjustment) return;
    setState(() => _isAdjusting = true);
    var confirmed = false;
    try {
      await context.read<InventoryService>().retryPendingAdjustment(
        view!.storeId,
      );
      confirmed = true;
    } catch (_) {
      // A missing acknowledgement keeps the original encrypted request.
    }
    if (!_matches(view)) return;
    await _loadInventory();
    if (!_matches(view)) return;
    setState(() => _isAdjusting = false);
    _showSnackBar(
      confirmed
          ? (_error == null
                ? 'Original stock change confirmed and inventory refreshed.'
                : 'Original stock change confirmed. Refresh inventory to read the latest quantities.')
          : 'The original stock change is still unconfirmed. Retry after checking your connection and permissions.',
      isError: !confirmed,
    );
  }

  Future<void> _adjust(InventoryLevel level) async {
    if (!mounted || !mobile_tokens.isLetbuyySurfaceCurrent(context)) return;
    final view = _view;
    if (!_matches(view) || level.storeId != view!.storeId || _commandsBlocked)
      return;
    setState(() => _isAdjusting = true);
    try {
      final location = level.locationId.isNotEmpty
          ? level.locationId
          : await _chooseLocation(view);
      if (!_matches(view) || location == null) return;
      final request = await _adjustmentDialog(level, view);
      if (request == null || !_matches(view)) return;
      await context.read<InventoryService>().submitAdjustment(
        storeId: view.storeId,
        productId: level.productId,
        variantId: level.variantId,
        locationId: location,
        delta: request.delta,
        reason: request.reason,
        note: request.note,
      );
      if (!_matches(view)) return;
      await _loadInventory();
      if (_matches(view))
        _showSnackBar(
          _error == null
              ? 'Stock change confirmed and inventory refreshed.'
              : 'Stock change confirmed. Refreshed quantities are unavailable; retry refresh.',
        );
    } catch (_) {
      if (_matches(view)) await _loadInventory();
      if (_matches(view))
        _showSnackBar(
          'The stock change could not be confirmed. Use Retry original if a change is saved.',
          isError: true,
        );
    } finally {
      if (_matches(view)) setState(() => _isAdjusting = false);
    }
  }

  Future<void> _scanAndAdjust() async {
    if (!mounted || !mobile_tokens.isLetbuyySurfaceCurrent(context)) return;
    final view = _view;
    if (!_matches(view) || _commandsBlocked) return;
    setState(() => _isAdjusting = true);
    try {
      final barcode = await showBarcodeScannerSheet(
        context,
        title: 'Scan inventory barcode',
      );
      if (!_matches(view) || barcode == null || barcode.trim().isEmpty) return;
      final service = context.read<InventoryService>();
      final lookup = await service.lookupBarcode(
        storeId: view!.storeId,
        barcode: barcode,
      );
      if (!_matches(view)) return;
      if (lookup == null) {
        _showSnackBar('No product found for that barcode.', isError: true);
        return;
      }
      if (lookup.storeId != view.storeId) return;
      final location = await _chooseLocation(view);
      if (!_matches(view) || location == null) return;
      final request = await _scanAdjustmentDialog(lookup, view, location);
      if (!_matches(view) || request == null) return;
      await service.submitAdjustment(
        storeId: view.storeId,
        productId: lookup.productId,
        variantId: lookup.variantId,
        delta: request.delta,
        reason: request.reason,
        locationId: request.locationId,
        note: request.note,
      );
      if (!_matches(view)) return;
      await _loadInventory();
      if (_matches(view))
        _showSnackBar(
          _error == null
              ? 'Stock change confirmed and inventory refreshed.'
              : 'Stock change confirmed. Refreshed quantities are unavailable; retry refresh.',
        );
    } catch (_) {
      if (_matches(view)) await _loadInventory();
      if (_matches(view))
        _showSnackBar(
          'The barcode stock change could not be confirmed. Use Retry original if a change is saved.',
          isError: true,
        );
    } finally {
      if (_matches(view)) setState(() => _isAdjusting = false);
    }
  }

  Future<_InventoryAdjustment?> _adjustmentDialog(
    InventoryLevel level,
    MerchantStoreView view,
  ) async {
    final deltaController = TextEditingController();
    final noteController = TextEditingController();
    var reason = 'adjustment';
    String? error;
    ModalRoute<_InventoryAdjustment>? sheetRoute;
    try {
      return await mobile_tokens.showLetbuyyFormSheet<_InventoryAdjustment>(
        context: context,
        builder: (context) {
          sheetRoute = ModalRoute.of<_InventoryAdjustment>(context);
          return guardMerchantStoreView(
            view,
            StatefulBuilder(
              builder: (context, setDialogState) =>
                  mobile_tokens.LetbuyyFormSheet(
                    title: 'Adjust ${level.label}',
                    actions: [
                      TextButton(
                        onPressed: () =>
                            mobile_tokens.completeLetbuyySurface(context),
                        child: const Text('Cancel'),
                      ),
                      FilledButton(
                        onPressed: () {
                          if (!mobile_tokens.isLetbuyySurfaceCurrent(context) ||
                              !_matches(view))
                            return;
                          final delta = int.tryParse(
                            deltaController.text.trim().replaceFirst('+', ''),
                          );
                          if (delta == null || delta == 0) {
                            setDialogState(
                              () => error = 'Enter a non-zero adjustment',
                            );
                            return;
                          }
                          mobile_tokens.completeLetbuyySurface(
                            context,
                            _InventoryAdjustment(
                              delta: delta,
                              reason: reason,
                              note: noteController.text.trim(),
                            ),
                          );
                        },
                        child: const Text('Apply'),
                      ),
                    ],
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        mobile_tokens.CustomTextField(
                          controller: deltaController,
                          keyboardType: const TextInputType.numberWithOptions(
                            signed: true,
                          ),
                          label: 'Change quantity',
                          hint: '+5 or -2',
                        ),
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          initialValue: reason,
                          isExpanded: true,
                          decoration: const InputDecoration(
                            labelText: 'Reason',
                          ),
                          items: const [
                            DropdownMenuItem(
                              value: 'adjustment',
                              child: Text('Adjustment'),
                            ),
                            DropdownMenuItem(
                              value: 'recount',
                              child: Text('Recount'),
                            ),
                            DropdownMenuItem(
                              value: 'received',
                              child: Text('Received'),
                            ),
                            DropdownMenuItem(
                              value: 'damaged',
                              child: Text('Damaged'),
                            ),
                            DropdownMenuItem(
                              value: 'return',
                              child: Text('Return'),
                            ),
                            DropdownMenuItem(
                              value: 'correction',
                              child: Text('Correction'),
                            ),
                          ],
                          onChanged: (value) {
                            if (value != null)
                              setDialogState(() => reason = value);
                          },
                        ),
                        const SizedBox(height: 12),
                        mobile_tokens.CustomTextField(
                          controller: noteController,
                          minLines: 2,
                          maxLines: 3,
                          label: 'Note',
                        ),
                        if (error != null)
                          Semantics(
                            liveRegion: true,
                            child: Text(
                              error!,
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.error,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
            ),
            sheet: true,
          );
        },
      );
    } finally {
      if (sheetRoute != null) await sheetRoute!.completed;
      deltaController.dispose();
      noteController.dispose();
    }
  }

  Future<_ScannedInventoryAdjustment?> _scanAdjustmentDialog(
    InventoryBarcodeLookup lookup,
    MerchantStoreView view,
    String location,
  ) async {
    final deltaController = TextEditingController();
    final noteController = TextEditingController();
    var reason = 'recount';
    String? error;
    ModalRoute<_ScannedInventoryAdjustment>? sheetRoute;
    try {
      return await mobile_tokens.showLetbuyyFormSheet<
        _ScannedInventoryAdjustment
      >(
        context: context,
        builder: (context) {
          sheetRoute = ModalRoute.of<_ScannedInventoryAdjustment>(context);
          return guardMerchantStoreView(
            view,
            StatefulBuilder(
              builder: (context, setDialogState) =>
                  mobile_tokens.LetbuyyFormSheet(
                    title: 'Adjust ${lookup.label}',
                    actions: [
                      TextButton(
                        onPressed: () =>
                            mobile_tokens.completeLetbuyySurface(context),
                        child: const Text('Cancel'),
                      ),
                      FilledButton(
                        onPressed: () {
                          if (!mobile_tokens.isLetbuyySurfaceCurrent(context) ||
                              !_matches(view))
                            return;
                          final delta = int.tryParse(
                            deltaController.text.trim().replaceFirst('+', ''),
                          );
                          if (delta == null || delta == 0) {
                            setDialogState(
                              () => error = 'Enter a non-zero adjustment',
                            );
                            return;
                          }
                          mobile_tokens.completeLetbuyySurface(
                            context,
                            _ScannedInventoryAdjustment(
                              delta: delta,
                              reason: reason,
                              note: noteController.text.trim(),
                              locationId: location,
                            ),
                          );
                        },
                        child: const Text('Apply'),
                      ),
                    ],
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text('Scanned ${lookup.barcode}'),
                        const SizedBox(height: 12),
                        mobile_tokens.CustomTextField(
                          controller: deltaController,
                          keyboardType: const TextInputType.numberWithOptions(
                            signed: true,
                          ),
                          label: 'Change quantity',
                          hint: '+5 or -2',
                        ),
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          initialValue: reason,
                          isExpanded: true,
                          decoration: const InputDecoration(
                            labelText: 'Reason',
                          ),
                          items: const [
                            DropdownMenuItem(
                              value: 'recount',
                              child: Text('Recount'),
                            ),
                            DropdownMenuItem(
                              value: 'received',
                              child: Text('Received'),
                            ),
                            DropdownMenuItem(
                              value: 'damaged',
                              child: Text('Damaged'),
                            ),
                            DropdownMenuItem(
                              value: 'correction',
                              child: Text('Correction'),
                            ),
                          ],
                          onChanged: (value) {
                            if (value != null)
                              setDialogState(() => reason = value);
                          },
                        ),
                        const SizedBox(height: 12),
                        mobile_tokens.CustomTextField(
                          controller: noteController,
                          minLines: 2,
                          maxLines: 3,
                          label: 'Note',
                        ),
                        if (error != null)
                          Semantics(
                            liveRegion: true,
                            child: Text(
                              error!,
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.error,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
            ),
            sheet: true,
          );
        },
      );
    } finally {
      if (sheetRoute != null) await sheetRoute!.completed;
      deltaController.dispose();
      noteController.dispose();
    }
  }

  void _showSnackBar(String message, {bool isError = false}) {
    mobile_tokens.showLetbuyyOperationFeedback(
      context,
      message: message,
      isError: isError,
    );
  }
}

class _InventoryAdjustment {
  const _InventoryAdjustment({
    required this.delta,
    required this.reason,
    required this.note,
  });

  final int delta;
  final String reason;
  final String note;
}

class _ScannedInventoryAdjustment extends _InventoryAdjustment {
  const _ScannedInventoryAdjustment({
    required super.delta,
    required super.reason,
    required super.note,
    required this.locationId,
  });

  final String locationId;
}

class _WmsShortcut {
  const _WmsShortcut({
    required this.label,
    required this.icon,
    required this.route,
  });

  final String label;
  final IconData icon;
  final String route;
}

extension on String {
  String? get ifEmpty => isEmpty ? null : this;
}
