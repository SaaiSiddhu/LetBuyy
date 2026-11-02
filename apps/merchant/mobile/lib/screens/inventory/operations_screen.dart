import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';
import '../../services/api_client.dart' show ApiException;
import '../../services/inventory_service.dart';
import '../../theme/app_theme_colors.dart';
import '../../widgets/shared/merchant_store_view.dart';

class InventoryOperationsScreen extends StatefulWidget {
  const InventoryOperationsScreen({super.key});
  @override
  State<InventoryOperationsScreen> createState() =>
      _InventoryOperationsScreenState();
}

class _InventoryOperationsScreenState extends State<InventoryOperationsScreen> {
  bool _preparing = true;
  String? _error;
  @override
  void initState() {
    super.initState();
    _prepare();
  }

  Future<void> _prepare() async {
    setState(() {
      _preparing = true;
      _error = null;
    });
    try {
      await context.read<StoreContext>().ensureSelectedStore();
    } catch (_) {
      if (mounted)
        _error =
            'The current store could not be loaded. Check your access and retry.';
    }
    if (mounted) setState(() => _preparing = false);
  }

  @override
  Widget build(BuildContext context) {
    final stores = context.watch<StoreContext>(),
        site = stores.selectedStoreId,
        colors = AppThemeColors.of(context);
    final view = site == null
        ? null
        : (key: stores.requestContextKey, storeId: site);
    final service = context.read<InventoryService>();
    return Scaffold(
      backgroundColor: colors.bgStart,
      appBar: AppBar(title: const Text('Operations dashboard')),
      body: SafeArea(
        child: _preparing
            ? const Center(child: CircularProgressIndicator())
            : _error != null || view == null
            ? Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(20),
                      child: Text(
                        _error ?? 'Select a store to view its operations.',
                      ),
                    ),
                    TextButton(
                      onPressed: _prepare,
                      child: const Text('Retry store'),
                    ),
                  ],
                ),
              )
            : SingleChildScrollView(
                padding: const EdgeInsets.all(12),
                child: Column(
                  children: [
                    const Padding(
                      padding: EdgeInsets.all(12),
                      child: Text(
                        'Current metrics for the selected store. Each panel loads and refreshes independently.',
                      ),
                    ),
                    _MetricPanel<OperationsSnapshot>(
                      key: ValueKey((view.key, site, 'summary')),
                      view: view,
                      title: 'Operations summary',
                      load: (_) => service.fetchOperationsSummary(site!),
                      render: (data) => Column(
                        children: [
                          if (!data.isComplete)
                            const Padding(
                              padding: EdgeInsets.all(12),
                              child: Text(
                                'Some counts are unavailable. Missing values are shown as —.',
                              ),
                            ),
                          for (final entry in const {
                            'order_count': 'Orders',
                            'open_order_count': 'Open orders',
                            'po_count': 'Purchase orders',
                            'open_po_count': 'Open purchase orders',
                            'transfer_count': 'Transfers',
                            'in_transit_transfer_count': 'In-transit transfers',
                            'low_stock_sku_count': 'Low-stock entries',
                            'total_sku_count': 'Catalog products',
                          }.entries)
                            _value(
                              entry.value,
                              data.values[entry.key]?.toString() ?? '—',
                            ),
                          const Padding(
                            padding: EdgeInsets.all(12),
                            child: Text(
                              'Low-stock entries include location and variant records with available quantity at or below 10.',
                            ),
                          ),
                        ],
                      ),
                    ),
                    _MetricPanel<SupplierMetricPage>(
                      key: ValueKey((view.key, site, 'suppliers')),
                      view: view,
                      title: 'Supplier performance',
                      pageLabel: 'suppliers',
                      load: (page) =>
                          service.fetchSupplierMetrics(site!, page: page),
                      metadata: (data) => data.meta,
                      render: (data) => data.rows.isEmpty
                          ? const Padding(
                              padding: EdgeInsets.all(16),
                              child: Text('No supplier metrics on this page.'),
                            )
                          : Column(
                              children: [
                                for (final row in data.rows)
                                  Padding(
                                    padding: const EdgeInsets.all(12),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          row.name,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                        _value(
                                          'Purchase orders',
                                          '${row.purchaseOrders}',
                                        ),
                                        _value(
                                          'On-time rate',
                                          row.onTimeRate == null
                                              ? 'Unavailable'
                                              : '${(row.onTimeRate! * 100).round()}%',
                                        ),
                                        _value(
                                          'Average lead time',
                                          row.leadTimeDays == null
                                              ? 'Unavailable'
                                              : '${row.leadTimeDays} days',
                                        ),
                                      ],
                                    ),
                                  ),
                              ],
                            ),
                    ),
                    _MetricPanel<WarehouseMetricPage>(
                      key: ValueKey((view.key, site, 'warehouses')),
                      view: view,
                      title: 'Warehouse inventory',
                      pageLabel: 'locations',
                      load: (page) =>
                          service.fetchWarehouseMetrics(site!, page: page),
                      metadata: (data) => data.meta,
                      render: (data) => data.rows.isEmpty
                          ? const Padding(
                              padding: EdgeInsets.all(16),
                              child: Text('No warehouse metrics on this page.'),
                            )
                          : Column(
                              children: [
                                for (final row in data.rows)
                                  Padding(
                                    padding: const EdgeInsets.all(12),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          row.name,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                        if (row.isDefault)
                                          const Text('Default location'),
                                        _value(
                                          'Stock entries',
                                          '${row.stockEntries}',
                                        ),
                                        _value(
                                          'Total units',
                                          '${row.totalUnits}',
                                        ),
                                      ],
                                    ),
                                  ),
                                const Padding(
                                  padding: EdgeInsets.all(12),
                                  child: Text(
                                    'Total units include available, reserved and incoming quantities.',
                                  ),
                                ),
                              ],
                            ),
                    ),
                    _MetricPanel<TransferMetrics>(
                      key: ValueKey((view.key, site, 'transfers')),
                      view: view,
                      title: 'Transfer pipeline',
                      load: (_) => service.fetchTransferMetrics(site!),
                      render: (data) => Column(
                        children: [
                          _value('Total transfers', '${data.total}'),
                          _value('In transit', '${data.inTransit}'),
                          for (final entry in data.byStatus.entries)
                            _value(_status(entry.key), '${entry.value}'),
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

Widget _value(String label, String value) => ListTile(
  dense: true,
  title: Text(label),
  trailing: SizedBox(
    width: 110,
    child: Align(
      alignment: Alignment.centerRight,
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
      ),
    ),
  ),
);
String _status(String value) =>
    const {
      'draft': 'Draft',
      'reserved': 'Reserved',
      'shipped': 'Shipped',
      'partially_received': 'Partially received',
      'received': 'Received',
      'cancelled': 'Cancelled',
    }[value] ??
    value;

class _MetricPanel<T> extends StatefulWidget {
  const _MetricPanel({
    super.key,
    required this.view,
    required this.title,
    required this.load,
    required this.render,
    this.metadata,
    this.pageLabel,
  });
  final MerchantStoreView view;
  final String title;
  final String? pageLabel;
  final Future<T> Function(int page) load;
  final Widget Function(T) render;
  final InventoryMetricPage Function(T)? metadata;
  @override
  State<_MetricPanel<T>> createState() => _MetricPanelState<T>();
}

class _MetricPanelState<T> extends State<_MetricPanel<T>> {
  int _generation = 0, _page = 1;
  T? _data;
  bool _loading = true;
  String? _error;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  Future<void> _load() async {
    final generation = ++_generation;
    setState(() {
      _loading = true;
      _data = null;
      _error = null;
    });
    try {
      final data = await widget.load(_page);
      if (!merchantStoreViewCurrent(context, widget.view) ||
          generation != _generation)
        return;
      setState(() {
        _data = data;
        _loading = false;
      });
    } catch (error) {
      if (!merchantStoreViewCurrent(context, widget.view) ||
          generation != _generation)
        return;
      setState(() {
        _loading = false;
        _error = error is ApiException && error.statusCode == 403
            ? 'You do not have access to these operations metrics.'
            : error is ApiException && error.statusCode == 401
            ? 'Sign in again to view operations metrics.'
            : error is ApiException &&
                  error.code == 'OPERATIONS_METRICS_SCOPE_UNSUPPORTED'
            ? 'These operations metrics are not available for this store yet. Try again later.'
            : 'These metrics could not be loaded. Check your connection and current store access, then retry.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = _data,
        meta = data == null ? null : widget.metadata?.call(data),
        label = widget.pageLabel;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    widget.title,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Refresh ${widget.title.toLowerCase()}',
                  onPressed: _load,
                  icon: const Icon(Icons.refresh),
                ),
              ],
            ),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null)
              Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  children: [
                    Text(_error!),
                    TextButton(
                      onPressed: _load,
                      child: Text('Retry ${widget.title.toLowerCase()}'),
                    ),
                  ],
                ),
              )
            else if (data != null)
              widget.render(data),
            if (meta != null) Text('${meta.total} matching $label'),
            if (label != null && (_page > 1 || meta?.hasNext == true))
              Column(
                children: [
                  Text('Page $_page'),
                  Wrap(
                    alignment: WrapAlignment.center,
                    children: [
                      TextButton(
                        onPressed: _loading || _page <= 1
                            ? null
                            : () {
                                setState(() => _page--);
                                _load();
                              },
                        child: Text('Previous $label'),
                      ),
                      TextButton(
                        onPressed: _loading || meta?.hasNext != true
                            ? null
                            : () {
                                setState(() => _page++);
                                _load();
                              },
                        child: Text('Next $label'),
                      ),
                    ],
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
