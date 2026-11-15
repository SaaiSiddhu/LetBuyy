import '../../widgets/shared/warehouse_list_scaffold.dart';
import '../../widgets/shared/warehouse_document_detail.dart';
import '../../widgets/shared/warehouse_status_chip.dart';
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
  Object? _viewKey, _loadedQuery;
  Object get _query => (_viewKey, _storeId, _page, _search, _status, _sort);
  int _readGeneration = 0;
  int _page = 1;
  String _search = '', _status = '', _sort = 'newest';
  bool get _filtered => _search.isNotEmpty || _status.isNotEmpty;
  int? _total;
  bool _more = false;
  MerchantStoreView? get _view =>
      _storeId == null ? null : (key: _viewKey, storeId: _storeId!);
  bool _matches(MerchantStoreView? view) =>
      mounted && merchantStoreViewCurrent(context, view);

  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _viewKey = context.read<StoreContext>().requestContextKey;
    _load();
  }

  Future<void> _load({bool retain = false}) async {
    if (!mounted) return;
    final keep = retain && _loadedQuery == _query && _matches(_view);
    final generation = ++_readGeneration;
    setState(() {
      _isLoading = true;
      _error = null;
      if (!keep) {
        _total = null;
        _more = false;
        _transfers = [];
        _loadedQuery = null;
      }
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
      final query = _query;
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
        _loadedQuery = query;
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
        if (!keep ||
            error is ApiException && [401, 403].contains(error.statusCode)) {
          _transfers = [];
          _total = null;
          _more = false;
          _loadedQuery = null;
        }
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
      _loadedQuery = null;
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
    final view = _view, generation = _readGeneration;
    bool current() =>
        mounted &&
        _matches(view) &&
        generation == _readGeneration &&
        mobile_tokens.isLetbuyySurfaceCurrent(context);
    final canRefresh = !_isLoading;
    final readKey = stores.requestContextKey;
    bool currentRead() =>
        mounted &&
        generation == _readGeneration &&
        context.read<StoreContext>().requestContextKey == readKey &&
        mobile_tokens.isLetbuyySurfaceCurrent(context);
    return WarehouseListScaffold(
      scrollIdentity: _query,
      title: 'Inventory transfers',
      description: 'Move stock between warehouses and locations',
      refreshLabel: 'Refresh transfers',
      loading: _isLoading,
      onRefresh: canRefresh
          ? () async {
              if (currentRead() && !_isLoading) await _load(retain: true);
            }
          : null,
      action: FilledButton.icon(
        onPressed:
            !_warehouseReady ||
                _warehouseBusy ||
                _storeId == null ||
                _isLoading ||
                _error != null
            ? null
            : () {
                if (current()) _createTransfer();
              },
        icon: const Icon(Icons.swap_horiz_outlined),
        label: const Text('New transfer'),
      ),
      header: [
        if (view != null)
          WarehouseCommandRecovery(
            view: view,
            onReady: (ready) {
              if (_matches(view) && _warehouseReady != ready)
                setState(() => _warehouseReady = ready);
            },
            onResolved: _load,
          ),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: TextButton.icon(
            onPressed: _storeId == null || _isLoading
                ? null
                : () {
                    if (current()) _filter();
                  },
            icon: const Icon(Icons.filter_list),
            label: Text(
              _search.isEmpty && _status.isEmpty && _sort == 'newest'
                  ? 'Filter and sort'
                  : 'Filters applied · Edit',
            ),
          ),
        ),
        Row(
          children: [
            IconButton(
              tooltip: 'Previous page',
              onPressed: _isLoading || _page == 1
                  ? null
                  : () {
                      if (!current() || _isLoading) return;
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
                      if (!current() || _isLoading || !_more) return;
                      setState(() => _page++);
                      _load();
                    },
              icon: const Icon(Icons.chevron_right),
            ),
          ],
        ),
        if (_isLoading && _loadedQuery != null)
          const Text(
            'Refreshing the same page. Previously loaded records are shown below.',
          ),
        if (_error != null && _loadedQuery != null)
          Semantics(
            liveRegion: true,
            child: Text(
              'Refresh unavailable. Previously loaded records are shown below. $_error',
            ),
          ),
      ],
      slivers: [_isLoading && _loadedQuery == null ? _loading() : _body()],
    );
  }

  Future<void> _filter() async {
    if (!mounted || !mobile_tokens.isLetbuyySurfaceCurrent(context)) return;
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

  Widget _body() {
    if (_error != null && _loadedQuery == null) {
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
    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      sliver: SliverList.builder(
        itemCount: _transfers.length,
        itemBuilder: (context, index) => _transferCard(_transfers[index]),
      ),
    );
  }

  Widget _transferCard(InventoryTransferContract transfer) {
    final view = _view;
    final generation = _readGeneration;
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
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              IconButton(
                tooltip: 'View transfer',
                icon: const Icon(Icons.article_outlined),
                onPressed: () {
                  if (mounted &&
                      generation == _readGeneration &&
                      mobile_tokens.isLetbuyySurfaceCurrent(context)) {
                    _openDocument(transfer);
                  }
                },
              ),
              IconButton(
                tooltip: 'View receipts',
                icon: const Icon(Icons.receipt_long_outlined),
                onPressed: () {
                  if (!_matches(view) ||
                      generation != _readGeneration ||
                      !mobile_tokens.isLetbuyySurfaceCurrent(context) ||
                      transfer.storeId != view!.storeId)
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
            '${transfer.sourceLocationLabel} → ${transfer.destinationLocationLabel}',
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
                _lineChip(line.displayName, line.quantity),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            alignment: WrapAlignment.end,
            spacing: 8,
            runSpacing: 8,
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

  Future<void> _openDocument(InventoryTransferContract transfer) async {
    final view = _view, generation = _readGeneration;
    if (!_matches(view) ||
        !mobile_tokens.isLetbuyySurfaceCurrent(context) ||
        transfer.storeId != view!.storeId)
      return;
    await Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        settings: RouteSettings(
          name: '/inventory/transfer-detail',
          arguments: {'id': transfer.id, 'storeId': view.storeId},
        ),
        builder: (_) => WarehouseDocumentDetail(
          view: view,
          documentId: transfer.id,
          transfer: true,
        ),
      ),
    );
    if (_matches(view) &&
        generation == _readGeneration &&
        mobile_tokens.isLetbuyySurfaceCurrent(context)) {
      await _load(retain: true);
    }
  }

  Widget _statusChip(String label) => WarehouseStatusChip(status: label);

  Future<void> _createTransfer() async {
    if (!mounted || !mobile_tokens.isLetbuyySurfaceCurrent(context)) return;
    final view = _view;
    if (!_matches(view) || !_warehouseReady || _warehouseBusy) return;
    final service = context.read<InventoryService>();
    final input = await Navigator.of(context).push<InventoryTransferInput>(
      MaterialPageRoute<InventoryTransferInput>(
        settings: RouteSettings(
          name: '/inventory/transfer-create',
          arguments: {'storeId': view!.storeId},
        ),
        builder: (_) => guardMerchantStoreView(
          view,
          WarehouseCreateForm(view: view!, service: service, transfer: true),
          fullPage: true,
        ),
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
    if (!mounted || !mobile_tokens.isLetbuyySurfaceCurrent(context)) return;
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
    if (!mounted || !mobile_tokens.isLetbuyySurfaceCurrent(context)) return;
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
    return SliverFillRemaining(
      hasScrollBody: false,
      child: Center(
        child: CircularProgressIndicator(
          color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
        ),
      ),
    );
  }

  Widget _centerState(IconData icon, String title, String subtitle) {
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
      ),
    );
  }

  void _showSnackBar(String message, {bool isError = false}) {
    mobile_tokens.showLetbuyyOperationFeedback(
      context,
      message: message,
      isError: isError,
    );
  }
}
