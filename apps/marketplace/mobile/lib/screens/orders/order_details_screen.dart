import 'package:flutter/material.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:provider/provider.dart';

import '../../auth/buyer_sign_in_controller.dart';
import 'order_display.dart';

/// A canonical read, never an email match or an order object passed by a caller.
/// Fulfillment, cancellation and return actions are completed by the N6 lifecycle.
class OrderDetailsScreen extends StatefulWidget {
  const OrderDetailsScreen({super.key, required this.orderId});
  final String orderId;
  @override
  State<OrderDetailsScreen> createState() => _OrderDetailsScreenState();
}

class _OrderDetailsScreenState extends State<OrderDetailsScreen> {
  String? _requestedToken;
  String? _requestedId;
  String? _loadedFor;
  String? _loadedId;
  int _generation = 0;
  bool _loading = false;
  JsonMap? _order;
  String? _error;

  bool _current(String token, String id, int generation) => mounted && generation == _generation
      && context.read<BuyerSignInController>().token == token && widget.orderId == id;

  Future<void> _load() async {
    final token = context.read<BuyerSignInController>().token;
    final id = widget.orderId;
    if (token == null || (_loading && token == _requestedToken && id == _requestedId)) return;
    final generation = ++_generation;
    setState(() {
      _requestedToken = token;
      _requestedId = id;
      _order = null;
      _error = null;
      _loading = true;
    });
    try {
      final order = await context.read<BuyerOrdersApi>().get(token, id);
      if (!_current(token, id, generation)) return;
      setState(() {
        _order = order;
        _loadedFor = token;
        _loadedId = id;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!_current(token, id, generation)) return;
      setState(() {
        _loadedFor = token;
        _loadedId = id;
        _loading = false;
        _error = error.statusCode == 404 || error.statusCode == 400
            ? 'We couldn’t find this order.'
            : error.statusCode == 401 || error.statusCode == 403
              ? 'Your LetBuyy sign-in has ended. Sign in again from Profile.'
              : error.code == 'NETWORK_ERROR' || error.code == 'TIMEOUT'
                ? 'You seem to be offline. Check your connection and try again.'
                : 'We couldn’t load this order. Please try again.';
      });
    } catch (_) {
      if (!_current(token, id, generation)) return;
      setState(() {
        _loadedFor = token;
        _loadedId = id;
        _loading = false;
        _error = 'We couldn’t load this order. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) => Consumer<BuyerSignInController>(
    builder: (context, auth, _) {
      final token = auth.token;
      if (token != null && (token != _requestedToken || widget.orderId != _requestedId)) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted && context.read<BuyerSignInController>().token == token
              && (token != _requestedToken || widget.orderId != _requestedId)) _load();
        });
      }
      return Scaffold(
        appBar: const CustomAppBar(title: 'Order details', isGlass: false),
        body: token == null
          ? const EmptyState(icon: Icons.lock_outline, title: 'Sign in to view this order', message: 'Use Sign in with LetBuyy on the Profile tab.')
          : _loading || _loadedFor != token || _loadedId != widget.orderId
            ? const Center(child: CircularProgressIndicator())
            : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : RefreshIndicator(onRefresh: _load, child: _contents(_order!)),
      );
    },
  );

  Widget _section(String title, List<Widget> children) => Card(
    child: Padding(padding: const EdgeInsets.all(16), child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [Text(title, style: Theme.of(context).textTheme.titleMedium), const SizedBox(height: 12), ...children],
    )),
  );

  Widget _contents(JsonMap order) {
    final currency = order['currency'];
    final address = orderShippingAddress(order['shipping_address']);
    final items = (order['items'] as List).map(asJsonMap).toList(growable: false);
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      children: [
        _section(orderTitle(order), [
          Text('Status: ${orderText(order['status'])}'),
          Text('Placed: ${orderDate(order['created_at'])}'),
          Text('Payment: ${orderText(order['payment_status'])}'),
          Text('Payment method: ${orderText(order['payment_method'])}'),
        ]),
        _section('Items', [
          if (items.isEmpty) const Text('Item details are unavailable.'),
          for (final item in items)
            Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(orderText(item['name'] ?? item['title'], fallback: 'Item')),
                Text('Quantity: ${item['quantity'] is num ? item['quantity'] : 'Unavailable'}${item['variant_title'] is String ? '\n${item['variant_title']}' : ''}'),
                Text(orderAmount(item['total'], currency)),
              ],
            )),
        ]),
        _section('Payment summary', [
          for (final entry in const {'subtotal':'Subtotal','discount':'Discount','shipping_cost':'Shipping','tax':'Tax','total':'Total'}.entries)
            Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(children: [
              Expanded(child: Text(entry.value)), Text(orderAmount(order[entry.key], currency)),
            ])),
        ]),
        _section('Delivery address', [Text(address.isEmpty ? 'Address details are unavailable.' : address)]),
        if (order['tracking_number'] is String && (order['tracking_number'] as String).isNotEmpty)
          _section('Shipment', [
            Text('Carrier: ${orderText(order['carrier'])}'),
            SelectableText('Tracking number: ${order['tracking_number']}'),
          ]),
      ],
    );
  }
}
