import 'package:flutter/material.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:provider/provider.dart';

import '../../auth/buyer_sign_in_controller.dart';
import 'order_details_screen.dart';
import 'order_display.dart';

/// Session-owned order history from the canonical gateway. A new session never
/// renders the previous session's records, including while a request is pending.
class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});
  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  String? _requestedToken;
  String? _loadedFor;
  int _generation = 0;
  List<JsonMap> _orders = const [];
  String? _cursor;
  bool _hasMore = false;
  bool _loading = false;
  bool _loadingMore = false;
  String? _error;

  bool _current(String token, int generation) => mounted && generation == _generation
      && context.read<BuyerSignInController>().token == token;

  Future<void> _load({bool more = false}) async {
    final token = context.read<BuyerSignInController>().token;
    if (token == null || ((_loading || _loadingMore) && token == _requestedToken)) return;
    if (more && (!_hasMore || _cursor == null || _loadedFor != token)) return;
    final cursor = more ? _cursor : null;
    final generation = ++_generation;
    setState(() {
      _requestedToken = token;
      _error = null;
      _loading = !more;
      _loadingMore = more;
      if (!more) {
        _orders = const [];
        _loadedFor = null;
        _cursor = null;
        _hasMore = false;
      }
    });
    try {
      final page = await context.read<BuyerOrdersApi>().list(token, cursor: cursor);
      if (!_current(token, generation)) return;
      final seen = <String>{};
      setState(() {
        _orders = [for (final order in [...(more ? _orders : <JsonMap>[]), ...page.orders])
          if (seen.add(order['id'] as String)) order];
        _cursor = page.nextCursor;
        _hasMore = page.hasMore;
        _loadedFor = token;
        _loading = false;
        _loadingMore = false;
      });
    } on ApiException catch (error) {
      if (!_current(token, generation)) return;
      setState(() {
        _loadedFor = token;
        _loading = false;
        _loadingMore = false;
        if (error.statusCode == 401 || error.statusCode == 403) {
          _orders = const [];
          _cursor = null;
          _hasMore = false;
          _error = 'Your LetBuyy sign-in has ended. Sign in again from Profile.';
        } else {
          _error = error.code == 'NETWORK_ERROR' || error.code == 'TIMEOUT'
              ? 'You seem to be offline. Check your connection and try again.'
              : 'We couldn’t load your orders. Please try again.';
        }
      });
    } catch (_) {
      if (!_current(token, generation)) return;
      setState(() {
        _loadedFor = token;
        _loading = false;
        _loadingMore = false;
        _error = 'We couldn’t load your orders. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) => Consumer<BuyerSignInController>(
    builder: (context, auth, _) {
      final token = auth.token;
      if (token != null && token != _requestedToken) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted && context.read<BuyerSignInController>().token == token && _requestedToken != token) _load();
        });
      }
      return Scaffold(
        appBar: const CustomAppBar(title: 'My orders', isGlass: false),
        body: token == null
          ? const EmptyState(icon: Icons.lock_outline, title: 'Sign in to view your orders', message: 'Use Sign in with LetBuyy on the Profile tab.')
          : _loading || _loadedFor != token
            ? const Center(child: CircularProgressIndicator())
            : _error != null && _orders.isEmpty
              ? ErrorView(message: _error!, onRetry: () => _load())
              : RefreshIndicator(
                  onRefresh: () => _load(),
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (_orders.isEmpty)
                        const EmptyState(icon: Icons.shopping_bag_outlined, title: 'No orders yet', message: 'Orders linked to your LetBuyy account will appear here.'),
                      for (final order in _orders)
                        Card(
                          key: ValueKey('buyer-order-${order['id']}'),
                          child: InkWell(
                            onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => OrderDetailsScreen(orderId: order['id'] as String))),
                            child: Padding(padding: const EdgeInsets.all(16), child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Text(orderTitle(order), style: Theme.of(context).textTheme.titleMedium),
                                const SizedBox(height: 8),
                                Text(orderText(order['store_name'], fallback: 'LetBuyy store')),
                                Text('${orderText(order['status'])} · ${orderDate(order['created_at'])}'),
                                Text(orderAmount(order['total'], order['currency'])),
                              ],
                            )),
                          ),
                        ),
                      if (_error != null) ...[
                        Text(_error!),
                        TextButton(onPressed: () => _load(more: true), child: const Text('Try loading more again')),
                      ] else if (_hasMore)
                        CustomButton(text: 'Load more', isLoading: _loadingMore, onPressed: () => _load(more: true)),
                    ],
                  ),
                ),
      );
    },
  );
}
