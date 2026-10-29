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
  Object? _viewKey;
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
      merchantStoreViewCurrent(context, view);

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

  Future<void> _loadInventory() async {
    if (!mounted) return;
    final generation = ++_readGeneration;
    setState(() {
      _isLoading = true;
      _error = null;
      _levels = [];
      _hasMore = false;
      _pendingUnavailable = true;
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
      final service = context.read<InventoryService>();
      final levels = await service.fetchLevels(
        view.storeId,
        lowStockOnly: _lowStockOnly,
        page: _page,
      );
      if (!_matches(view) || generation != _readGeneration) return;
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
        _levels = [];
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

    return Scaffold(
      backgroundColor: colors.bgStart,
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: Column(
            children: [
              _header(),
              _searchAndFilter(),
              _wmsShortcuts(),
              if (!_isLoading && _error == null) _stats(),
              if (!_isLoading && _hasPendingAdjustment)
                ListTile(
                  title: const Text('A stock change needs confirmation'),
                  subtitle: const Text(
                    'Retry the original saved change before starting another adjustment.',
                  ),
                  trailing: TextButton(
                    onPressed: _isAdjusting ? null : _retryPendingAdjustment,
                    child: const Text('Retry original'),
                  ),
                ),
              if (!_isLoading && _pendingUnavailable && _error == null)
                const Padding(
                  padding: EdgeInsets.all(12),
                  child: Text(
                    'Saved stock changes could not be checked. Refresh before adjusting inventory.',
                  ),
                ),
              Expanded(child: _isLoading ? _loading() : _body()),
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
            ],
          ),
        ),
      ),
    );
  }

  Widget _header() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Inventory',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  'Adjust stock and monitor low inventory',
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Scan barcode',
            icon: Icon(
              Icons.qr_code_scanner_rounded,
              color: colors.textSecondary,
            ),
            onPressed: _scanAndAdjust,
          ),
          IconButton(
            tooltip: 'Refresh inventory',
            icon: Icon(Icons.refresh_rounded, color: colors.textSecondary),
            onPressed: _loadInventory,
          ),
        ],
      ),
    );
  }

  Widget _searchAndFilter() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _searchController,
              onChanged: (value) => setState(() => _query = value),
              style: TextStyle(color: colors.textPrimary),
              decoration: InputDecoration(
                hintText: 'Filter this page by product, SKU or location',
                hintStyle: TextStyle(color: colors.textTertiary),
                prefixIcon: Icon(
                  Icons.search_rounded,
                  color: colors.textTertiary,
                ),
                filled: true,
                fillColor: colors.surfaceVariant,
                border: _inputBorder(colors.divider),
                enabledBorder: _inputBorder(colors.divider),
                focusedBorder: _inputBorder(
                  mobile_tokens.LetbuyyColorTokens.brandPrimary,
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Tooltip(
            message: 'Low stock only',
            child: FilterChip(
              selected: _lowStockOnly,
              label: const Text('Low'),
              avatar: const Icon(Icons.warning_amber_rounded, size: 18),
              selectedColor: colors.warning.withValues(alpha: 0.16),
              checkmarkColor: colors.warning,
              onSelected: (selected) {
                setState(() {
                  _lowStockOnly = selected;
                  _page = 1;
                });
                _loadInventory();
              },
            ),
          ),
        ],
      ),
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
    ];

    return SizedBox(
      height: 48,
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

  Widget _stats() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Row(
        children: [
          Expanded(
            child: _metric(
              'Available shown',
              _availableUnits.toString(),
              Icons.inventory_2_outlined,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _metric(
              'Low shown',
              _lowStockCount.toString(),
              Icons.warning_amber_rounded,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _metric(
              'Out shown',
              _outOfStockCount.toString(),
              Icons.remove_shopping_cart_outlined,
            ),
          ),
        ],
      ),
    );
  }

  Widget _metric(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            icon,
            color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
            size: 18,
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              color: colors.textPrimary,
              fontWeight: FontWeight.w800,
              fontSize: 16,
            ),
          ),
          Text(
            label,
            style: TextStyle(color: colors.textSecondary, fontSize: 11),
          ),
        ],
      ),
    );
  }

  Widget _loading() {
    return Center(
      child: CircularProgressIndicator(
        color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      ),
    );
  }

  Widget _body() {
    if (_error != null) {
      return _centerState(
        icon: Icons.error_outline_rounded,
        title: 'Could not load inventory',
        subtitle: _error!,
        action: TextButton.icon(
          onPressed: _loadInventory,
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

    return RefreshIndicator(
      color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      onRefresh: _loadInventory,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
        itemCount: levels.length,
        itemBuilder: (context, index) => _levelCard(levels[index]),
      ),
    );
  }

  Widget _levelCard(InventoryLevel level) {
    final view = _view;
    final tone = level.isOutOfStock
        ? colors.error
        : level.isLowStock
        ? colors.warning
        : colors.success;

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
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              _stockChip(level, tone),
            ],
          ),
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
          Row(
            children: [
              Expanded(
                child: LinearProgressIndicator(
                  value: (level.available.clamp(0, 20)) / 20,
                  minHeight: 6,
                  borderRadius: BorderRadius.circular(99),
                  color: tone,
                  backgroundColor: colors.surfaceVariant,
                ),
              ),
              const SizedBox(width: 12),
              IconButton(
                tooltip: 'View stock history',
                icon: const Icon(Icons.history),
                onPressed: () {
                  if (!merchantStoreViewCurrent(context, view) ||
                      level.storeId != view!.storeId)
                    return;
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
                  if (!merchantStoreViewCurrent(context, view) ||
                      level.storeId != view!.storeId)
                    return;
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

  Widget _stockChip(InventoryLevel level, Color tone) {
    final label = level.isOutOfStock
        ? 'Out'
        : level.isLowStock
        ? 'Low'
        : 'In stock';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        '${level.available} $label',
        style: TextStyle(
          color: tone,
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _miniMetric(IconData icon, String value) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: colors.textTertiary),
        const SizedBox(width: 4),
        Text(
          value,
          style: TextStyle(color: colors.textSecondary, fontSize: 12),
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
    return Center(
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
    );
  }

  Future<String?> _chooseLocation(MerchantStoreView view) async {
    final locations = await context.read<InventoryService>().fetchLocations(
      view.storeId,
    );
    if (!_matches(view)) return null;
    if (locations.isEmpty) {
      _showSnackBar(
        'Create an inventory location before adjusting stock.',
        isError: true,
      );
      return null;
    }
    return showDialog<String>(
      context: context,
      builder: (context) => guardMerchantStoreView(
        view,
        SimpleDialog(
          title: const Text('Choose stock location'),
          children: [
            for (final location in locations)
              SimpleDialogOption(
                onPressed: () {
                  if (_matches(view)) Navigator.pop(context, location.id);
                },
                child: Text(location.name),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _retryPendingAdjustment() async {
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
  ) {
    final deltaController = TextEditingController();
    final noteController = TextEditingController();
    var reason = 'adjustment';

    return showDialog<_InventoryAdjustment>(
      context: context,
      builder: (context) => guardMerchantStoreView(
        view,
        StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            backgroundColor: colors.card,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            title: Text(
              'Adjust ${level.label}',
              style: TextStyle(color: colors.textPrimary),
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: deltaController,
                  keyboardType: const TextInputType.numberWithOptions(
                    signed: true,
                  ),
                  style: TextStyle(color: colors.textPrimary),
                  decoration: InputDecoration(
                    labelText: 'Change quantity',
                    hintText: '+5 or -2',
                    labelStyle: TextStyle(color: colors.textSecondary),
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: reason,
                  dropdownColor: colors.card,
                  style: TextStyle(color: colors.textPrimary),
                  decoration: InputDecoration(
                    labelText: 'Reason',
                    labelStyle: TextStyle(color: colors.textSecondary),
                  ),
                  items: const [
                    DropdownMenuItem(
                      value: 'adjustment',
                      child: Text('Adjustment'),
                    ),
                    DropdownMenuItem(value: 'recount', child: Text('Recount')),
                    DropdownMenuItem(
                      value: 'received',
                      child: Text('Received'),
                    ),
                    DropdownMenuItem(value: 'damaged', child: Text('Damaged')),
                    DropdownMenuItem(value: 'return', child: Text('Return')),
                    DropdownMenuItem(
                      value: 'correction',
                      child: Text('Correction'),
                    ),
                  ],
                  onChanged: (value) {
                    if (value != null) setDialogState(() => reason = value);
                  },
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: noteController,
                  minLines: 2,
                  maxLines: 3,
                  style: TextStyle(color: colors.textPrimary),
                  decoration: InputDecoration(
                    labelText: 'Note',
                    labelStyle: TextStyle(color: colors.textSecondary),
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(
                  'Cancel',
                  style: TextStyle(color: colors.textSecondary),
                ),
              ),
              TextButton(
                onPressed: () {
                  if (!_matches(view)) return;
                  final delta = int.tryParse(
                    deltaController.text.trim().replaceFirst('+', ''),
                  );
                  if (delta == null || delta == 0) {
                    _showSnackBar('Enter a non-zero adjustment', isError: true);
                    return;
                  }
                  Navigator.pop(
                    context,
                    _InventoryAdjustment(
                      delta: delta,
                      reason: reason,
                      note: noteController.text.trim(),
                    ),
                  );
                },
                child: Text(
                  'Apply',
                  style: TextStyle(
                    color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<_ScannedInventoryAdjustment?> _scanAdjustmentDialog(
    InventoryBarcodeLookup lookup,
    MerchantStoreView view,
    String location,
  ) {
    final deltaController = TextEditingController();
    final noteController = TextEditingController();
    var reason = 'recount';

    return showDialog<_ScannedInventoryAdjustment>(
      context: context,
      builder: (context) => guardMerchantStoreView(
        view,
        StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            backgroundColor: colors.card,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            title: Text(
              'Adjust ${lookup.label}',
              style: TextStyle(color: colors.textPrimary),
            ),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Scanned ${lookup.barcode}',
                      style: TextStyle(color: colors.textSecondary),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: deltaController,
                    keyboardType: const TextInputType.numberWithOptions(
                      signed: true,
                    ),
                    style: TextStyle(color: colors.textPrimary),
                    decoration: InputDecoration(
                      labelText: 'Change quantity',
                      hintText: '+5 or -2',
                      labelStyle: TextStyle(color: colors.textSecondary),
                    ),
                  ),
                  const SizedBox(height: 12),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: reason,
                    dropdownColor: colors.card,
                    style: TextStyle(color: colors.textPrimary),
                    decoration: InputDecoration(
                      labelText: 'Reason',
                      labelStyle: TextStyle(color: colors.textSecondary),
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
                      if (value != null) setDialogState(() => reason = value);
                    },
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: noteController,
                    minLines: 2,
                    maxLines: 3,
                    style: TextStyle(color: colors.textPrimary),
                    decoration: InputDecoration(
                      labelText: 'Note',
                      labelStyle: TextStyle(color: colors.textSecondary),
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(
                  'Cancel',
                  style: TextStyle(color: colors.textSecondary),
                ),
              ),
              TextButton(
                onPressed: () {
                  if (!_matches(view)) return;
                  final delta = int.tryParse(
                    deltaController.text.trim().replaceFirst('+', ''),
                  );
                  if (delta == null || delta == 0) {
                    _showSnackBar('Enter a non-zero adjustment', isError: true);
                    return;
                  }
                  Navigator.pop(
                    context,
                    _ScannedInventoryAdjustment(
                      delta: delta,
                      reason: reason,
                      note: noteController.text.trim(),
                      locationId: location,
                    ),
                  );
                },
                child: Text(
                  'Apply',
                  style: TextStyle(
                    color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? colors.error : colors.success,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
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
