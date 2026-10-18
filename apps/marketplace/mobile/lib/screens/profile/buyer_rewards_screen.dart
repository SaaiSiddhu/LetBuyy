import 'package:flutter/material.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:provider/provider.dart';

import '../../auth/buyer_sign_in_controller.dart';

/// Seller-specific account reads. Earning/redemption and programme configuration
/// remain owned by the existing Gateway/ledger; this screen never writes points.
class BuyerRewardsScreen extends StatefulWidget {
  const BuyerRewardsScreen({
    super.key,
    required this.siteId,
    required this.storeName,
  });
  final String siteId;
  final String storeName;
  @override
  State<BuyerRewardsScreen> createState() => _BuyerRewardsScreenState();
}

class _BuyerRewardsScreenState extends State<BuyerRewardsScreen> {
  String? _requestedToken;
  String? _loadedFor;
  int _generation = 0;
  bool _loading = false;
  String? _error;
  JsonMap? _summary;
  List<JsonMap> _entries = const [];

  bool _current(String token, int generation) =>
      mounted &&
      generation == _generation &&
      context.read<BuyerSignInController>().token == token;

  @override
  void didUpdateWidget(covariant BuyerRewardsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.siteId != widget.siteId) {
      _generation++;
      _requestedToken = null;
      _loadedFor = null;
      _summary = null;
      _entries = const [];
      _loading = false;
    }
  }

  Future<void> _load() async {
    final token = context.read<BuyerSignInController>().token;
    if (token == null || (_loading && token == _requestedToken)) return;
    final generation = ++_generation;
    final siteId = widget.siteId;
    final api = context.read<BuyerLoyaltyApi>();
    setState(() {
      _requestedToken = token;
      _loadedFor = null;
      _loading = true;
      _error = null;
      _summary = null;
      _entries = const [];
    });
    try {
      // Await together so either failed read is handled and cannot leave an
      // unobserved error or display half of a different account's result.
      final results = await Future.wait<Object>([
        api.summary(token, siteId),
        api.history(token, siteId),
      ]);
      if (!_current(token, generation)) return;
      setState(() {
        _summary = results[0] as JsonMap;
        _entries = results[1] as List<JsonMap>;
        _loadedFor = token;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!_current(token, generation)) return;
      setState(() {
        _loadedFor = token;
        _loading = false;
        _error = error.statusCode == 401 || error.statusCode == 403
            ? 'Your LetBuyy sign-in has ended. Sign in again from Profile.'
            : 'We couldn’t load your rewards. Please try again.';
      });
    } catch (_) {
      if (!_current(token, generation)) return;
      setState(() {
        _loadedFor = token;
        _loading = false;
        _error = 'We couldn’t load your rewards. Please try again.';
      });
    }
  }

  static const _labels = {
    'earned': 'Points earned',
    'redeemed': 'Points used',
    'refund_credit': 'Points returned',
    'expired': 'Points expired',
    'adjustment_credit': 'Points added',
    'adjustment_debit': 'Points adjusted',
  };

  @override
  Widget build(BuildContext context) => Consumer<BuyerSignInController>(
    builder: (context, auth, _) {
      final token = auth.token;
      if (token != null && token != _requestedToken) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted &&
              context.read<BuyerSignInController>().token == token &&
              _requestedToken != token)
            _load();
        });
      }
      return Scaffold(
        appBar: const CustomAppBar(title: 'Seller rewards', isGlass: false),
        body: token == null
            ? const EmptyState(
                icon: Icons.lock_outline,
                title: 'Sign in to view your rewards',
                message: 'Use Sign in with LetBuyy on the Profile tab.',
              )
            : _loading || _loadedFor != token
            ? const Center(child: CircularProgressIndicator())
            : _error != null
            ? ErrorView(message: _error!, onRetry: _load)
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  children: [
                    Text(
                      widget.storeName,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 16),
                    if (_summary?['enrolled'] != true)
                      const EmptyState(
                        icon: Icons.stars_outlined,
                        title: 'No rewards programme',
                        message: 'This seller has not enabled loyalty points.',
                      )
                    else ...[
                      Text(
                        '${_summary!['balance']} points',
                        key: const ValueKey('buyer-rewards-balance'),
                        style: Theme.of(context).textTheme.headlineMedium,
                      ),
                      if (_summary!['is_active'] != true)
                        const Text(
                          'This seller’s rewards programme is paused. Your recorded points are shown above.',
                        ),
                      const SizedBox(height: 24),
                      Text(
                        'Recent activity (up to 25)',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      if (_entries.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 16),
                          child: Text('No rewards activity yet.'),
                        ),
                      for (final entry in _entries)
                        ListTile(
                          key: ValueKey('buyer-reward-${entry['id']}'),
                          title: Text(
                            _labels[entry['entry_type']] ?? 'Points activity',
                          ),
                          subtitle: Text(
                            'Balance: ${entry['balance_after']} points',
                          ),
                          trailing: Text('${entry['points']} points'),
                        ),
                    ],
                  ],
                ),
              ),
      );
    },
  );
}
