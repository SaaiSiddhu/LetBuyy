import 'package:letbuyy_models/letbuyy_models.dart'
    show warehouseTransferStatuses;
import '../../widgets/shared/warehouse_list_filters.dart';
import '../../services/api_client.dart' show ApiException;
import '../../widgets/shared/merchant_store_view.dart';
import '../../widgets/shared/warehouse_command_recovery.dart';
import '../../widgets/shared/warehouse_receipt_review.dart';
import '../../app/routes.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';

import '../../services/inventory_service.dart';
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;
import '../../widgets/shared/warehouse_create_form.dart';

class InventoryTransfersScreen extends StatefulWidget {
  const InventoryTransfersScreen({super.key});

  @override
  State<InventoryTransfersScreen> createState() =>
      _InventoryTransfersScreenState();
}

class _InventoryTransfersScreenState extends State<InventoryTransfersScreen> {
  List<InventoryTransferContract> _transfers = const [];
  bool _isLoading = true;
  bool _warehouseReady = false, _warehouseBusy = false;
  String? _storeId;
  String? _error;
  Object? _viewKey;
  int _readGeneration = 0;
  int _page = 1;
  String _search = '', _status = '', _sort = 'newest';
  bool get _filtered => _search.isNotEmpty || _status.isNotEmpty;
  int? _total;
  bool _more = false;
  MerchantStoreView? get _view =>
      _storeId == null ? null : (key: _viewKey, storeId: _storeId!);
  bool _matches(MerchantStoreView? view) =>
      merchantStoreViewCurrent(context, view);

  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _viewKey = context.read<StoreContext>().requestContextKey;
    _load();
  }

  Future<void> _load() async {
    if (!mounted) return;
    final generation = ++_readGeneration;
    setState(() {
      _isLoading = true;
      _error = null;
      _total = null;
      _more = false;
      _transfers = [];
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
          _error = 'Select a store to continue.';
        });
        return;
      }
      final service = context.read<InventoryService>();
      final rows = await service.fetchTransfers(
        view.storeId,
        page: _page,
        search: _search.isEmpty ? null : _search,
        status: _status.isEmpty ? null : _status,
        sort: _sort,
      );
      if (!_matches(view) || generation != _readGeneration) return;
      setState(() {
        _transfers = rows;
        _total = service.transfersTotal;
        _more = service.transfersHasMore;
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
        _transfers = [];
        _error =
            'Check your connection and current store permissions, then refresh.';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    final stores = context.watch<StoreContext>();
    if (_viewKey != stores.requestContextKey) {
      _viewKey = stores.requestContextKey;
      ++_readGeneration;
      _storeId = null;
      _page = 1;
      _search = '';
      _status = '';
      _sort = 'newest';
      _total = null;
      _more = false;
      _warehouseReady = false;
      _warehouseBusy = false;
      _transfers = [];
      _error = null;
      _isLoading = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _load();
      });
    }
    return Scaffold(
      backgroundColor: colors.bgStart,
      floatingActionButton: FloatingActionButton.extended(
        onPressed:
            !_warehouseReady ||
                _warehouseBusy ||
                _storeId == null ||
                _isLoading ||
                _error != null
            ? null
            : _createTransfer,
        backgroundColor: mobile_tokens.LetbuyyColorTokens.brandPrimary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.swap_horiz_outlined),
        label: const Text('New transfer'),
      ),
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: Column(
            children: [
              _header(),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: _storeId == null ? null : _filter,
                    icon: const Icon(Icons.filter_list),
                    label: Text(
                      _search.isEmpty && _status.isEmpty && _sort == 'newest'
                          ? 'Filter and sort'
                          : 'Filters applied · Edit',
                    ),
                  ),
                ),
              ),
              if (_view != null)
                WarehouseCommandRecovery(
                  view: _view!,
                  onReady: (ready) {
                    if (mounted && _warehouseReady != ready)
                      setState(() => _warehouseReady = ready);
                  },
                  onResolved: _load,
                ),
              SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    children: [
                      IconButton(
                        tooltip: 'Previous page',
                        onPressed: _isLoading || _page == 1
                            ? null
                            : () {
                                setState(() => _page--);
                                _load();
                              },
                        icon: const Icon(Icons.chevron_left),
                      ),
                      Expanded(
                        child: Text(
                          _total == null
                              ? 'Page $_page · Count unavailable'
                              : '$_total matching records · Page $_page',
                          textAlign: TextAlign.center,
                        ),
                      ),
                      IconButton(
                        tooltip: 'Next page',
                        onPressed: _isLoading || !_more
                            ? null
                            : () {
                                setState(() => _page++);
                                _load();
                              },
                        icon: const Icon(Icons.chevron_right),
                      ),
                    ],
                  ),
                ),
              ),
              Expanded(child: _isLoading ? _loading() : _body()),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _filter() async {
    final view = _view;
    if (!_matches(view)) return;
    final result = await showWarehouseListFilters(
      context,
      view: view!,
      initial: (search: _search, status: _status, sort: _sort),
      statuses: warehouseTransferStatuses,
      documents: true,
    );
    if (!_matches(view) || result == null) return;
    setState(() {
      _search = result.search;
      _status = result.status;
      _sort = result.sort;
      _page = 1;
    });
    _load();
  }

  Widget _header() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Back',
            icon: Icon(Icons.arrow_back_rounded, color: colors.textPrimary),
            onPressed: () => Navigator.maybePop(context),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Transfers',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  'Move stock between locations and receive shipments',
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Refresh transfers',
            icon: Icon(Icons.refresh_rounded, color: colors.textSecondary),
            onPressed: _load,
          ),
        ],
      ),
    );
  }

  Widget _body() {
    if (_error != null) {
      return _centerState(
        Icons.error_outline_rounded,
        'Could not load transfers',
        _error!,
      );
    }
    if (_transfers.isEmpty) {
      return _centerState(
        Icons.swap_horiz_outlined,
        _filtered
            ? 'No matching transfers'
            : _page == 1
            ? 'No transfers'
            : 'No records on this page',
        _filtered
            ? 'Clear or change the filters to find other records.'
            : 'Move stock between locations when inventory needs balancing.',
      );
    }
    return RefreshIndicator(
      color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
        itemCount: _transfers.length,
        itemBuilder: (context, index) => _transferCard(_transfers[index]),
      ),
    );
  }

  Widget _transferCard(InventoryTransferContract transfer) {
    final view = _view;
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
              Icon(
                Icons.swap_horiz_outlined,
                color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  transfer.transferNumber.isEmpty
                      ? 'Stock transfer'
                      : transfer.transferNumber,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              IconButton(
                tooltip: 'View receipts',
                icon: const Icon(Icons.receipt_long_outlined),
                onPressed: () {
                  if (!_matches(view) || transfer.storeId != view!.storeId)
                    return;
                  Navigator.pushNamed(
                    context,
                    AppRoutes.inventoryReceipts,
                    arguments: {'transfer_id': transfer.id},
                  );
                },
              ),
            ],
          ),
          const SizedBox(height: 8),
          _statusChip(transfer.status),
          const SizedBox(height: 8),
          Text(
            '${transfer.sourceLocationId} -> ${transfer.destinationLocationId}',
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 8),
          Text(
            '${transfer.totalQuantity} units • ${transfer.remainingQuantity} pending',
            style: TextStyle(color: colors.textSecondary, fontSize: 12),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final line in transfer.lines.take(3))
                _lineChip(line.productName, line.quantity),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              OutlinedButton.icon(
                onPressed:
                    !_warehouseReady ||
                        _warehouseBusy ||
                        transfer.status != 'reserved'
                    ? null
                    : () => _ship(transfer),
                icon: const Icon(Icons.local_shipping_outlined, size: 18),
                label: const Text('Ship'),
                style: OutlinedButton.styleFrom(
                  foregroundColor:
                      mobile_tokens.LetbuyyColorTokens.brandPrimary,
                ),
              ),
              const SizedBox(width: 8),
              FilledButton.icon(
                onPressed:
                    !_warehouseReady ||
                        _warehouseBusy ||
                        ![
                          'shipped',
                          'partially_received',
                        ].contains(transfer.status) ||
                        !transfer.lines.any(
                          (line) =>
                              line.shippedQuantity > line.receivedQuantity,
                        )
                    ? null
                    : () => _receive(transfer),
                icon: const Icon(Icons.move_to_inbox_outlined, size: 18),
                label: const Text('Receive'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _lineChip(String label, int quantity) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        '$label x $quantity',
        style: TextStyle(color: colors.textSecondary, fontSize: 12),
      ),
    );
  }

  Widget _statusChip(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: colors.warning.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        const {
              'draft': 'Draft',
              'ordered': 'Ordered',
              'reserved': 'Reserved',
              'shipped': 'Shipped',
              'partially_received': 'Partially received',
              'received': 'Received',
              'cancelled': 'Cancelled',
              'closed': 'Closed',
            }[label] ??
            label,
        style: TextStyle(
          color: colors.warning,
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Future<void> _createTransfer() async {
    final view = _view;
    if (!_matches(view) || !_warehouseReady || _warehouseBusy) return;
    final service = context.read<InventoryService>();
    final input = await showModalBottomSheet<InventoryTransferInput>(
      context: context,
      isScrollControlled: true,
      backgroundColor: colors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (_) => guardMerchantStoreView(
        view,
        WarehouseCreateForm(view: view!, service: service, transfer: true),
      ),
    );
    if (input == null || !_matches(view) || input.storeId != view!.storeId)
      return;

    if (!_warehouseReady || _warehouseBusy) return;
    setState(() => _warehouseBusy = true);
    try {
      await service.createTransfer(input);
      if (_matches(view)) {
        _showSnackBar('Transfer created');
        _load();
      }
    } catch (error) {
      if (_matches(view))
        _showSnackBar(
          'The outcome could not be confirmed. Check the saved warehouse request before trying again.',
          isError: true,
        );
    } finally {
      if (_matches(view)) setState(() => _warehouseBusy = false);
    }
  }

  Future<void> _ship(InventoryTransferContract transfer) async {
    final view = _view;
    if (!_matches(view) ||
        transfer.storeId != view!.storeId ||
        !_warehouseReady ||
        _warehouseBusy)
      return;
    setState(() => _warehouseBusy = true);
    var dispatched = false;
    try {
      final service = context.read<InventoryService>();
      final fresh = await service.fetchTransfer(view.storeId, transfer.id);
      if (!_matches(view)) return;
      if (fresh.status != 'reserved') {
        _showSnackBar(
          'This transfer is no longer reserved. Refresh the workspace.',
        );
        return;
      }
      if (!await reviewTransferShipment(context, view, fresh) ||
          !_matches(view))
        return;
      dispatched = true;
      await service.shipTransfer(
        fresh,
        idempotencyKey: service.makeIdempotencyKey('transfer-ship'),
      );
      if (_matches(view)) {
        _showSnackBar('Shipment confirmed');
        _load();
      }
    } catch (error) {
      if (_matches(view))
        _showSnackBar(
          dispatched
              ? 'The outcome could not be confirmed. Check the saved warehouse request before trying again.'
              : 'The current transfer could not be loaded. Refresh and check your access before shipping.',
          isError: true,
        );
    } finally {
      if (_matches(view)) setState(() => _warehouseBusy = false);
    }
  }

  Future<void> _receive(InventoryTransferContract transfer) async {
    final view = _view;
    if (!_matches(view) ||
        transfer.storeId != view!.storeId ||
        !_warehouseReady ||
        _warehouseBusy)
      return;
    setState(() => _warehouseBusy = true);
    var dispatched = false;
    try {
      final service = context.read<InventoryService>();
      final fresh = await service.fetchTransfer(view.storeId, transfer.id);
      if (!_matches(view)) return;
      if (!['shipped', 'partially_received'].contains(fresh.status) ||
          !fresh.lines.any(
            (line) => line.shippedQuantity > line.receivedQuantity,
          )) {
        _showSnackBar(
          'No stock is available to receive on this record. Refresh the workspace.',
        );
        return;
      }
      final quantities = await reviewTransferReceipt(context, view, fresh);
      if (quantities == null || !_matches(view)) return;
      dispatched = true;
      await service.receiveTransfer(
        fresh,
        quantities: quantities,
        idempotencyKey: service.makeIdempotencyKey('warehouse-receive'),
      );
      if (_matches(view)) {
        _showSnackBar('Stock receipt confirmed');
        _load();
      }
    } catch (error) {
      if (_matches(view))
        _showSnackBar(
          dispatched
              ? 'The outcome could not be confirmed. Check the saved warehouse request before trying again.'
              : 'The current warehouse record could not be loaded. Refresh and check your access before receiving.',
          isError: true,
        );
    } finally {
      if (_matches(view)) setState(() => _warehouseBusy = false);
    }
  }

  Widget _loading() {
    return Center(
      child: CircularProgressIndicator(
        color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      ),
    );
  }

  Widget _centerState(IconData icon, String title, String subtitle) {
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
              style: TextStyle(
                color: colors.textPrimary,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(color: colors.textSecondary),
            ),
          ],
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
      ),
    );
  }
}
