import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_core/letbuyy_core.dart' show DateFormatter;
import '../../app/store_context.dart';
import '../../services/api_client.dart' show ApiException;
import '../../services/inventory_service.dart';
import '../../theme/app_theme_colors.dart';
import '../../widgets/shared/merchant_store_view.dart';

class InventoryHistoryScreen extends StatefulWidget {
  const InventoryHistoryScreen({super.key, this.productId, this.productName});
  final String? productId, productName;
  @override
  State<InventoryHistoryScreen> createState() => _InventoryHistoryScreenState();
}

class _InventoryHistoryScreenState extends State<InventoryHistoryScreen> {
  List<InventoryHistoryEntry> _rows = [];
  Object? _key;
  String? _site, _product, _productName, _error;
  int _generation = 0, _page = 1;
  int? _total;
  bool _loading = true, _more = false;
  MerchantStoreView? get _view =>
      _site == null ? null : (key: _key, storeId: _site!);
  @override
  void initState() {
    super.initState();
    _key = context.read<StoreContext>().requestContextKey;
    _product = widget.productId;
    _productName = widget.productName;
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
      final rows = await service.fetchHistory(
        view.storeId,
        page: _page,
        productId: _product,
      );
      if (!merchantStoreViewCurrent(context, view) || generation != _generation)
        return;
      setState(() {
        _rows = rows;
        _total = service.historyTotal;
        _more = service.historyHasMore;
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
            error is ApiException &&
                error.code == 'INVENTORY_HISTORY_SCOPE_UNSUPPORTED'
            ? 'History is not available for this store yet. Try again later.'
            : 'History could not be loaded. Check your connection and current store access, then retry.';
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
        title: const Text('Stock history'),
        actions: [
          IconButton(
            tooltip: 'Refresh stock history',
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
            if (!_loading && _error == null && _total != null)
              Padding(
                padding: const EdgeInsets.all(12),
                child: Text('$_total matching stock changes'),
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
                              child: const Text('Retry history'),
                            ),
                          ],
                        ),
                      ),
                    )
                  : _rows.isEmpty
                  ? const Center(child: Text('No stock changes on this page.'))
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: _rows.length,
                        itemBuilder: (context, index) {
                          final row = _rows[index];
                          final delta = row.quantityChange > 0
                              ? '+${row.quantityChange}'
                              : '${row.quantityChange}';
                          final at = DateFormatter.formatDateTime(
                            row.createdAt.toUtc().add(
                              const Duration(minutes: 330),
                            ),
                          );
                          return Card(
                            child: ExpansionTile(
                              title: Text(
                                row.productName,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              subtitle: Text(
                                '${_reason(row.reason)} • $at IST',
                              ),
                              trailing: Semantics(
                                label: 'Quantity change $delta',
                                child: Text(
                                  delta,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              children: [
                                Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Align(
                                    alignment: Alignment.centerLeft,
                                    child: SelectableText(
                                      row.note.isEmpty
                                          ? 'No note recorded.'
                                          : row.note,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
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
