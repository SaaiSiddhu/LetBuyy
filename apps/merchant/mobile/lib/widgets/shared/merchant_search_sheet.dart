import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import '../../app/store_context.dart';
import '../../services/api_client.dart' hide JsonMap;
import '../../screens/products/product_form_screen.dart';
import '../../screens/orders/order_detail_screen.dart';
import '../../theme/app_theme_colors.dart';

/// Bounded search of the selected store through the existing commerce APIs.
class MerchantSearchSheet extends StatefulWidget {
  const MerchantSearchSheet({super.key});
  @override
  State<MerchantSearchSheet> createState() => _MerchantSearchSheetState();
}

class _MerchantSearchSheetState extends State<MerchantSearchSheet> {
  final _input = TextEditingController();
  Timer? _debounce;
  int _version = 0;
  Object? _scope;
  bool _busy = false;
  String? _error;
  List<ProductContract> _products = [];
  List<OrderContract> _orders = [];
  @override
  void dispose() {
    _debounce?.cancel();
    _input.dispose();
    super.dispose();
  }

  void _changed(String value) {
    _debounce?.cancel();
    ++_version;
    setState(() {
      _products = [];
      _orders = [];
      _error = null;
      _busy = false;
    });
    if (value.trim().length >= 2) {
      _debounce = Timer(
        const Duration(milliseconds: 350),
        () => _search(value),
      );
    }
  }

  Future<void> _search(String value) async {
    final query = value.trim();
    if (query.length < 2) return;
    final version = ++_version;
    final store = context.read<StoreContext>();
    final scope = store.requestContextKey;
    final id = store.selectedStoreId;
    if (id == null) return;
    final api = context.read<ApiClient>();
    setState(() {
      _scope = scope;
      _busy = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        api.products.list(
          query: {'store_id': id, 'search': query, 'limit': 10},
        ),
        api.orders.list(query: {'store_id': id, 'search': query, 'limit': 10}),
      ]);
      if (!mounted || version != _version || scope != store.requestContextKey)
        return;
      setState(() {
        _products = results[0].data.map(ProductContract.fromJson).toList();
        _orders = results[1].data.map(OrderContract.fromJson).toList();
      });
    } catch (_) {
      if (mounted && version == _version && scope == store.requestContextKey) {
        setState(() => _error = 'Search could not load. Please retry.');
      }
    } finally {
      if (mounted && version == _version) setState(() => _busy = false);
    }
  }

  void _open(Widget screen) {
    final navigator = Navigator.of(context);
    navigator.pop();
    navigator.push(MaterialPageRoute<void>(builder: (_) => screen));
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final current = context.watch<StoreContext>().requestContextKey;
    final stale = _scope != null && _scope != current;
    return DraggableScrollableSheet(
      initialChildSize: .92,
      minChildSize: .5,
      maxChildSize: .96,
      builder: (_, scroll) => Material(
        color: colors.bgStart,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        clipBehavior: Clip.antiAlias,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
            child: Column(
              children: [
                TextField(
                  controller: _input,
                  autofocus: true,
                  maxLength: 200,
                  onChanged: _changed,
                  onSubmitted: _search,
                  decoration: InputDecoration(
                    labelText: 'Search orders and products',
                    hintText: 'Type at least 2 characters',
                    prefixIcon: const Icon(Icons.search),
                    suffixIcon: IconButton(
                      tooltip: 'Clear search',
                      icon: const Icon(Icons.clear),
                      onPressed: () {
                        _input.clear();
                        _changed('');
                      },
                    ),
                  ),
                ),
                if (_busy) const LinearProgressIndicator(),
                if (stale) ...[
                  const Text(
                    'The selected store changed. Search again for this store.',
                  ),
                  TextButton(
                    onPressed: () => _search(_input.text),
                    child: const Text('Search selected store'),
                  ),
                ] else if (_error != null) ...[
                  Text(_error!),
                  TextButton(
                    onPressed: () => _search(_input.text),
                    child: const Text('Retry search'),
                  ),
                ],
                Expanded(
                  child: ListView(
                    controller: scroll,
                    children: [
                      if (!stale &&
                          _error == null &&
                          !_busy &&
                          _input.text.trim().length >= 2 &&
                          _products.isEmpty &&
                          _orders.isEmpty)
                        const ListTile(
                          title: Text('No matching orders or products'),
                        ),
                      if (!stale) ...[
                        for (final product in _products)
                          ListTile(
                            leading: const Icon(Icons.inventory_2_outlined),
                            title: Text(product.name),
                            subtitle: const Text('Product'),
                            onTap: () =>
                                _open(ProductFormScreen(product: product)),
                          ),
                        for (final order in _orders)
                          ListTile(
                            leading: const Icon(Icons.receipt_long_outlined),
                            title: Text(order.orderNumber),
                            subtitle: Text(order.customerName ?? 'Order'),
                            onTap: () => _open(
                              OrderDetailScreen(
                                orderId: order.id,
                                initialOrder: order,
                              ),
                            ),
                          ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
