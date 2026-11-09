import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../widgets/shared/warehouse_list_scaffold.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_core/letbuyy_core.dart' show DateFormatter;
import '../../app/store_context.dart';
import '../../services/api_client.dart' show ApiException;
import '../../services/inventory_service.dart';
import '../../widgets/shared/merchant_store_view.dart';

enum InventoryRecordKind { history, reservations, receipts }

/// One presentation lifetime for the three read-only inventory registers.
/// The Gateway and shared contracts retain all authority over their records.
class InventoryRecordsScreen extends StatefulWidget {
  const InventoryRecordsScreen({
    super.key,
    required this.kind,
    this.productId,
    this.productName,
    this.purchaseOrderId,
    this.transferId,
  });
  final InventoryRecordKind kind;
  final String? productId, productName, purchaseOrderId, transferId;
  @override
  State<InventoryRecordsScreen> createState() => _InventoryRecordsScreenState();
}

class _InventoryRecordsScreenState extends State<InventoryRecordsScreen> {
  List<Object> _rows = [];
  Object? _key, _loadedQuery;
  Object get _query => (_key, _site, _page, _product, _po, _transfer, _status);
  String? _site, _product, _productName, _po, _transfer, _error;
  String _status = '';
  int _generation = 0, _page = 1;
  int? _total;
  bool _loading = true, _more = false;
  String get _title => switch (widget.kind) {
    InventoryRecordKind.history => 'Stock history',
    InventoryRecordKind.reservations => 'Reservations',
    InventoryRecordKind.receipts => 'Receipts',
  };
  String get _countLabel => switch (widget.kind) {
    InventoryRecordKind.history => 'stock changes',
    InventoryRecordKind.reservations => 'reservations',
    InventoryRecordKind.receipts => 'receipts',
  };
  MerchantStoreView? get _view =>
      _site == null ? null : (key: _key, storeId: _site!);
  @override
  void initState() {
    super.initState();
    _key = context.read<StoreContext>().requestContextKey;
    _product = widget.productId;
    _productName = widget.productName;
    _po = widget.purchaseOrderId;
    _transfer = widget.transferId;
    _load();
  }

  Future<void> _load({bool retain = false}) async {
    if (!mounted) return;
    final keep =
        retain &&
        _loadedQuery == _query &&
        merchantStoreViewCurrent(context, _view);
    final generation = ++_generation, stores = context.read<StoreContext>();
    setState(() {
      _loading = true;
      _error = null;
      if (!keep) {
        _rows = [];
        _total = null;
        _more = false;
        _loadedQuery = null;
      }
    });
    try {
      await stores.ensureSelectedStore();
      if (!mounted || generation != _generation) return;
      _key = stores.requestContextKey;
      _site = stores.selectedStoreId;
      final view = _view;
      if (view == null)
        throw const FormatException('Select a store to continue.');
      final query = _query;
      final service = context.read<InventoryService>();
      final List<Object> rows;
      final int? total;
      final bool more;
      switch (widget.kind) {
        case InventoryRecordKind.history:
          rows = await service.fetchHistory(
            view.storeId,
            page: _page,
            productId: _product,
          );
          total = service.historyTotal;
          more = service.historyHasMore;
        case InventoryRecordKind.reservations:
          rows = await service.fetchReservations(
            view.storeId,
            page: _page,
            productId: _product,
            status: _status.isEmpty ? null : _status,
          );
          total = service.reservationTotal;
          more = service.reservationsHasMore;
        case InventoryRecordKind.receipts:
          rows = await service.fetchReceipts(
            view.storeId,
            page: _page,
            purchaseOrderId: _po,
            transferId: _transfer,
          );
          total = service.receiptTotal;
          more = service.receiptsHasMore;
      }
      if (!mounted ||
          !merchantStoreViewCurrent(context, view) ||
          generation != _generation)
        return;
      setState(() {
        _rows = rows;
        _loadedQuery = query;
        _total = total;
        _more = more;
        _loading = false;
      });
    } catch (error) {
      if (!mounted ||
          generation != _generation ||
          _key != stores.requestContextKey)
        return;
      setState(() {
        if (!keep ||
            error is ApiException && [401, 403].contains(error.statusCode)) {
          _rows = [];
          _total = null;
          _more = false;
          _loadedQuery = null;
        }
        _loading = false;
        _error =
            error is ApiException && error.code.endsWith('_SCOPE_UNSUPPORTED')
            ? (widget.kind == InventoryRecordKind.history
                  ? 'History is not available for this store yet. Try again later.'
                  : 'These inventory records are not available for this store yet. Try again later.')
            : error is ApiException && error.statusCode == 403
            ? 'You do not have access to these inventory records for this store.'
            : error is ApiException && error.statusCode == 401
            ? 'Sign in again to view these inventory records.'
            : '$_title could not be loaded. Check your connection and current store access, then retry.';
      });
    }
  }

  void _changePage(int delta) {
    if (_loading || (delta < 0 && _page == 1) || (delta > 0 && !_more)) return;
    setState(() => _page += delta);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final stores = context.watch<StoreContext>();
    if (_key != stores.requestContextKey) {
      _key = stores.requestContextKey;
      ++_generation;
      _loadedQuery = null;
      _site = null;
      _rows = [];
      _total = null;
      _product = null;
      _productName = null;
      _po = null;
      _transfer = null;
      _status = '';
      _page = 1;
      _more = false;
      _loading = true;
      _error = null;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _load();
      });
    }
    final view = _view, generation = _generation;
    bool current() =>
        mounted &&
        generation == _generation &&
        merchantStoreViewCurrent(context, view) &&
        isLetbuyySurfaceCurrent(context);
    final readKey = stores.requestContextKey;
    bool currentRead() =>
        mounted &&
        generation == _generation &&
        context.read<StoreContext>().requestContextKey == readKey &&
        isLetbuyySurfaceCurrent(context);
    return WarehouseListScaffold(
      scrollIdentity: _query,
      title: _title,
      description:
          'Recorded inventory activity for the selected store. Filters and page counts describe the current query.',
      refreshLabel: 'Refresh ${_title.toLowerCase()}',
      loading: _loading,
      onRefresh: _loading
          ? null
          : () async {
              if (currentRead() && !_loading) await _load(retain: true);
            },
      header: [
        if (_product != null)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      '${_productName ?? 'Selected product'} • all variants',
                    ),
                  ),
                  IconButton(
                    tooltip: 'Show all products',
                    icon: const Icon(Icons.close),
                    onPressed: _loading
                        ? null
                        : () {
                            if (!current()) return;
                            setState(() {
                              _product = null;
                              _productName = null;
                              _page = 1;
                            });
                            _load();
                          },
                  ),
                ],
              ),
            ),
          ),
        if (_po != null || _transfer != null)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      _po != null
                          ? 'Purchase order receipts'
                          : 'Transfer receipts',
                    ),
                  ),
                  IconButton(
                    tooltip: 'Show all receipts',
                    icon: const Icon(Icons.close),
                    onPressed: _loading
                        ? null
                        : () {
                            if (!current()) return;
                            setState(() {
                              _po = null;
                              _transfer = null;
                              _page = 1;
                            });
                            _load();
                          },
                  ),
                ],
              ),
            ),
          ),
        if (widget.kind == InventoryRecordKind.reservations)
          LetbuyyChoiceField<String>(
            label: 'Reservation status',
            value: _status,
            choices: [
              const LetbuyyChoice(value: '', label: 'All statuses'),
              for (final status in inventoryReservationStatuses)
                LetbuyyChoice(value: status, label: _capitalize(status)),
            ],
            onChanged: _loading
                ? null
                : (value) {
                    if (!current()) return;
                    setState(() {
                      _status = value;
                      _page = 1;
                    });
                    _load();
                  },
          ),
        if (_total != null) Text('$_total matching $_countLabel'),
        if (_loading && _loadedQuery != null)
          const Text(
            'Refreshing the same page. Previously loaded records are shown below.',
          ),
        if (_error != null && _loadedQuery != null)
          Text(
            'Refresh unavailable. Previously loaded records are shown below. $_error',
          ),
        if (_page > 1 || _more)
          Wrap(
            alignment: WrapAlignment.center,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              TextButton(
                onPressed: !_loading && _page > 1
                    ? () {
                        if (current()) _changePage(-1);
                      }
                    : null,
                child: const Text('Previous'),
              ),
              Text('Page $_page'),
              TextButton(
                onPressed: !_loading && _more
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
        if (_loading && _loadedQuery == null)
          const SliverFillRemaining(
            hasScrollBody: false,
            child: Center(child: CircularProgressIndicator()),
          )
        else if (_error != null && _loadedQuery == null)
          SliverFillRemaining(
            hasScrollBody: false,
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(_error!, textAlign: TextAlign.center),
                  TextButton(
                    onPressed: () {
                      if (currentRead()) _load();
                    },
                    child: Text(
                      widget.kind == InventoryRecordKind.history
                          ? 'Retry history'
                          : 'Retry records',
                    ),
                  ),
                ],
              ),
            ),
          )
        else if (_rows.isEmpty)
          SliverFillRemaining(
            hasScrollBody: false,
            child: Center(child: Text('No $_countLabel on this page.')),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.all(12),
            sliver: SliverList.builder(
              itemCount: _rows.length,
              itemBuilder: (context, index) => _record(_rows[index]),
            ),
          ),
      ],
    );
  }

  Widget _record(Object row) => switch (row) {
    InventoryHistoryEntry() => _history(row),
    InventoryReservationRecord() => Semantics(
      container: true,
      explicitChildNodes: true,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(
                container: true,
                child: Text(
                  row.productName,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              Semantics(
                container: true,
                child: Text(
                  '${row.quantity} units • ${_capitalize(row.status)}',
                ),
              ),
              if (row.transfer != null) ...[
                Semantics(
                  container: true,
                  child: Text(
                    ['active', 'hold'].contains(row.status)
                        ? 'Held until shipment'
                        : 'Committed at shipment',
                  ),
                ),
                SelectableText(
                  'Transfer reference: ${row.transfer!.number}',
                  key: PageStorageKey((
                    _key,
                    _site,
                    row.id,
                    'transfer-reference',
                  )),
                ),
              ] else
                Semantics(
                  container: true,
                  child: Text('Expires ${_at(row.expiresAt!)}'),
                ),
              if (row.orderId.isNotEmpty)
                SelectableText(
                  'Order reference: ${row.orderId}',
                  key: PageStorageKey((_key, _site, row.id, 'order-reference')),
                ),
            ],
          ),
        ),
      ),
    ),
    InventoryReceiptRecord() => Card(
      child: ExpansionTile(
        key: PageStorageKey((_key, _site, widget.kind, row.id)),
        title: Text(
          row.receiptType == 'purchase_order'
              ? 'Purchase order receipt'
              : 'Transfer receipt',
        ),
        subtitle: Text(
          '${row.quantityReceived} received • ${_at(row.receivedAt)}',
        ),
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SelectableText(
                  'Reference: ${row.parentId}',
                  key: PageStorageKey((
                    _key,
                    _site,
                    row.id,
                    'receipt-reference',
                  )),
                ),
                SelectableText(
                  key: PageStorageKey((_key, _site, row.id, 'receipt-note')),
                  row.notes.isEmpty ? 'No note recorded.' : row.notes,
                ),
              ],
            ),
          ),
        ],
      ),
    ),
    _ => const Card(
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Text(
          'This record could not be displayed. Refresh to try again.',
        ),
      ),
    ),
  };
  Widget _history(InventoryHistoryEntry row) {
    final delta = row.quantityChange > 0
        ? '+${row.quantityChange}'
        : '${row.quantityChange}';
    return Card(
      child: ExpansionTile(
        key: PageStorageKey((_key, _site, widget.kind, row.id)),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(row.productName),
            Semantics(
              label: 'Quantity change $delta',
              child: Text(
                delta,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
        subtitle: Text('${_reason(row.reason)} • ${_at(row.createdAt)}'),
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Align(
              alignment: Alignment.centerLeft,
              child: SelectableText(
                key: PageStorageKey((_key, _site, row.id, 'history-note')),
                row.note.isEmpty ? 'No note recorded.' : row.note,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _at(DateTime date) =>
      '${DateFormatter.formatDateTime(date.toUtc().add(const Duration(minutes: 330)))} IST';
  String _capitalize(String value) =>
      value.isEmpty ? value : '${value[0].toUpperCase()}${value.substring(1)}';
  String _reason(String reason) =>
      const {
        'sale': 'Sale',
        'return': 'Return',
        'adjustment': 'Adjustment',
        'recount': 'Recount',
        'transfer': 'Transfer',
        'damaged': 'Damaged',
        'reserved': 'Reserved',
        'unreserved': 'Reservation released',
      }[reason] ??
      'Stock change';
}
