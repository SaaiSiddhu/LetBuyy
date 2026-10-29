import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_core/letbuyy_core.dart' show DateFormatter;
import '../../app/store_context.dart';
import '../../services/api_client.dart' show ApiException;
import '../../services/inventory_service.dart';
import '../../theme/app_theme_colors.dart';
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
  Object? _key;
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

  Future<void> _load() async {
    if (!mounted) return;
    final generation = ++_generation, stores = context.read<StoreContext>();
    setState(() {
      _loading = true;
      _error = null;
      _rows = [];
      _total = null;
      _more = false;
    });
    try {
      await stores.ensureSelectedStore();
      if (!mounted || generation != _generation) return;
      _key = stores.requestContextKey;
      _site = stores.selectedStoreId;
      final view = _view;
      if (view == null)
        throw const FormatException('Select a store to continue.');
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
      if (!merchantStoreViewCurrent(context, view) || generation != _generation)
        return;
      setState(() {
        _rows = rows;
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
        _rows = [];
        _total = null;
        _more = false;
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
    final colors = AppThemeColors.of(context),
        stores = context.watch<StoreContext>();
    if (_key != stores.requestContextKey) {
      _key = stores.requestContextKey;
      ++_generation;
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
    return Scaffold(
      backgroundColor: colors.bgStart,
      appBar: AppBar(
        title: Text(_title),
        actions: [
          IconButton(
            tooltip: 'Refresh ${_title.toLowerCase()}',
            onPressed: _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (_product != null)
              Padding(
                padding: const EdgeInsets.all(12),
                child: InputChip(
                  deleteButtonTooltipMessage: 'Show all products',
                  label: Text(
                    '${_productName ?? 'Selected product'} • all variants',
                    overflow: TextOverflow.ellipsis,
                  ),
                  onDeleted: () {
                    setState(() {
                      _product = null;
                      _productName = null;
                      _page = 1;
                    });
                    _load();
                  },
                ),
              ),
            if (_po != null || _transfer != null)
              Padding(
                padding: const EdgeInsets.all(12),
                child: InputChip(
                  deleteButtonTooltipMessage: 'Show all receipts',
                  label: Text(
                    _po != null
                        ? 'Purchase order receipts'
                        : 'Transfer receipts',
                  ),
                  onDeleted: () {
                    setState(() {
                      _po = null;
                      _transfer = null;
                      _page = 1;
                    });
                    _load();
                  },
                ),
              ),
            if (widget.kind == InventoryRecordKind.reservations)
              Padding(
                padding: const EdgeInsets.all(12),
                child: DropdownButtonFormField<String>(
                  value: _status,
                  decoration: const InputDecoration(
                    labelText: 'Reservation status',
                  ),
                  items: [
                    const DropdownMenuItem(
                      value: '',
                      child: Text('All statuses'),
                    ),
                    for (final status in inventoryReservationStatuses)
                      DropdownMenuItem(
                        value: status,
                        child: Text(_capitalize(status)),
                      ),
                  ],
                  onChanged: _loading
                      ? null
                      : (value) {
                          setState(() {
                            _status = value ?? '';
                            _page = 1;
                          });
                          _load();
                        },
                ),
              ),
            if (!_loading && _error == null && _total != null)
              Padding(
                padding: const EdgeInsets.all(12),
                child: Text('$_total matching $_countLabel'),
              ),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(_error!, textAlign: TextAlign.center),
                            TextButton(
                              onPressed: _load,
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
                  : _rows.isEmpty
                  ? Center(child: Text('No $_countLabel on this page.'))
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: _rows.length,
                        itemBuilder: (context, index) => _record(_rows[index]),
                      ),
                    ),
            ),
            if (_page > 1 || _more)
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  TextButton(
                    onPressed: !_loading && _page > 1
                        ? () => _changePage(-1)
                        : null,
                    child: const Text('Previous'),
                  ),
                  Text('Page $_page'),
                  TextButton(
                    onPressed: !_loading && _more ? () => _changePage(1) : null,
                    child: const Text('Next'),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _record(Object row) => switch (row) {
    InventoryHistoryEntry() => _history(row),
    InventoryReservationRecord() => Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              row.productName,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            Text('${row.quantity} reserved • ${_capitalize(row.status)}'),
            Text('Expires ${_at(row.expiresAt)}'),
            if (row.orderId.isNotEmpty)
              SelectableText('Order reference: ${row.orderId}'),
          ],
        ),
      ),
    ),
    InventoryReceiptRecord() => Card(
      child: ExpansionTile(
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
                SelectableText('Reference: ${row.parentId}'),
                SelectableText(
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
        title: Text(
          row.productName,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Text('${_reason(row.reason)} • ${_at(row.createdAt)}'),
        trailing: Semantics(
          label: 'Quantity change $delta',
          child: Text(
            delta,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Align(
              alignment: Alignment.centerLeft,
              child: SelectableText(
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
