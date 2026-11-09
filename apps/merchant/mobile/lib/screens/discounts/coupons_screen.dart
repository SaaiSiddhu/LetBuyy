import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';
import '../../app/routes.dart';
import '../../services/coupon_service.dart';
import '../../services/api_client.dart' show ApiException;
import '../../widgets/shared/merchant_store_view.dart';
import '../../widgets/shared/warehouse_list_scaffold.dart';
import 'coupon_validation_sheet.dart';

class CouponsScreen extends StatefulWidget {
  const CouponsScreen({super.key});
  @override
  State<CouponsScreen> createState() => _CouponsScreenState();
}

class _CouponsScreenState extends State<CouponsScreen> {
  List<CouponContract> _coupons = [];
  bool _isLoading = true,
      _activeOnly = false,
      _busy = false,
      _confirming = false;
  bool _denied = false, _reviewRequired = false;
  String? _storeId, _error, _notice;
  Object? _viewKey, _loadedQuery;
  int _readGeneration = 0, _page = 1;
  int? _total;
  bool? _more;
  Object get _query => (_viewKey, _storeId, _activeOnly, _page);
  MerchantStoreView? get _view =>
      _storeId == null ? null : (key: _viewKey, storeId: _storeId!);
  bool _matches(MerchantStoreView? view, int generation) =>
      mounted &&
      merchantStoreViewCurrent(context, view) &&
      generation == _readGeneration;
  bool _current(MerchantStoreView? view, int generation) =>
      _matches(view, generation) && isLetbuyySurfaceCurrent(context);
  bool get _commandsAllowed =>
      !_isLoading &&
      !_busy &&
      !_confirming &&
      !_denied &&
      !_reviewRequired &&
      _loadedQuery == _query &&
      _error == null;

  @override
  void initState() {
    super.initState();
    _viewKey = context.read<StoreContext>().requestContextKey;
    _loadCoupons();
  }

  Future<void> _loadCoupons({bool retain = false}) async {
    if (!mounted) return;
    final keep =
        retain &&
        _loadedQuery == _query &&
        merchantStoreViewCurrent(context, _view);
    final generation = ++_readGeneration;
    final stores = context.read<StoreContext>();
    setState(() {
      _isLoading = true;
      _error = null;
      if (!keep) {
        _coupons = [];
        _loadedQuery = null;
        _total = null;
        _more = null;
      }
    });
    try {
      await stores.ensureSelectedStore();
      if (!mounted ||
          generation != _readGeneration ||
          _viewKey != stores.requestContextKey)
        return;
      _viewKey = stores.requestContextKey;
      _storeId = stores.selectedStoreId;
      final view = _view;
      if (view == null) {
        setState(() {
          _error = 'Select a store to continue.';
          _isLoading = false;
        });
        return;
      }
      final query = _query;
      final result = await context.read<CouponService>().readCouponsPage(
        view.storeId,
        active: _activeOnly ? true : null,
        page: _page,
      );
      if (!_matches(view, generation)) return;
      setState(() {
        _coupons = result.rows;
        _total = result.total;
        _more = result.hasNext;
        _loadedQuery = query;
        _isLoading = false;
        _denied = false;
        // This refresh is a readback, not a durable recovery protocol.
        _reviewRequired = false;
      });
    } catch (error) {
      if (!mounted ||
          generation != _readGeneration ||
          _viewKey != stores.requestContextKey)
        return;
      setState(() {
        _denied =
            error is ApiException && [401, 403].contains(error.statusCode);
        if (!keep || _denied) {
          _coupons = [];
          _loadedQuery = null;
          _total = null;
          _more = null;
        }
        _error = _denied
            ? 'Current account or store access could not be confirmed.'
            : 'Coupons could not be read. Check your connection and current store access.';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final stores = context.watch<StoreContext>();
    if (_viewKey != stores.requestContextKey) {
      _viewKey = stores.requestContextKey;
      ++_readGeneration;
      _storeId = null;
      _coupons = [];
      _loadedQuery = null;
      _total = null;
      _more = null;
      _page = 1;
      _activeOnly = false;
      _busy = false;
      _confirming = false;
      _denied = false;
      _reviewRequired = false;
      _notice = null;
      _error = null;
      _isLoading = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _loadCoupons();
      });
    }
    final view = _view,
        generation = _readGeneration,
        readKey = stores.requestContextKey;
    bool current() => _current(view, generation);
    bool currentRead() =>
        mounted &&
        generation == _readGeneration &&
        context.read<StoreContext>().requestContextKey == readKey &&
        isLetbuyySurfaceCurrent(context);
    final loaded = _loadedQuery == _query;
    return WarehouseListScaffold(
      title: 'Coupons',
      description: 'Discount codes and redemption limits',
      refreshLabel: 'Refresh coupons',
      scrollIdentity: _query,
      loading: _isLoading || _busy,
      onRefresh: _isLoading || _busy || _confirming
          ? null
          : () async {
              if (currentRead() && !_isLoading && !_busy && !_confirming)
                await _loadCoupons(retain: true);
            },
      action: FilledButton.icon(
        onPressed: !_commandsAllowed
            ? null
            : () {
                if (current() && _commandsAllowed) _openForm();
              },
        icon: const Icon(Icons.add),
        label: const Text('New coupon'),
      ),
      header: [
        Wrap(
          spacing: 12,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            FilterChip(
              selected: _activeOnly,
              label: const Text('Active only'),
              onSelected: _isLoading || _busy || _confirming || view == null
                  ? null
                  : (selected) {
                      if (!current() || _isLoading || _busy || _confirming)
                        return;
                      setState(() {
                        _activeOnly = selected;
                        _page = 1;
                      });
                      _loadCoupons();
                    },
            ),
            TextButton.icon(
              onPressed: !_commandsAllowed
                  ? null
                  : () {
                      if (current() && _commandsAllowed) _validateCoupon();
                    },
              icon: const Icon(Icons.verified_outlined),
              label: const Text('Validate'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          _activeOnly
              ? 'Applied filter: active, not expired'
              : 'Applied filter: all coupons',
        ),
        if (loaded) ...[
          const SizedBox(height: 12),
          StatGrid(
            children: [
              StatTile(
                icon: Icons.local_offer_outlined,
                label: 'Matching coupons',
                value: _total?.toString() ?? 'Unavailable',
              ),
              StatTile(
                icon: Icons.list_alt,
                label: 'On this page',
                value: _coupons.length.toString(),
              ),
              StatTile(
                icon: Icons.toggle_on_outlined,
                label: 'Enabled on this page',
                value: _coupons
                    .where((coupon) => coupon.isActive)
                    .length
                    .toString(),
              ),
              StatTile(
                icon: Icons.redeem_outlined,
                label: 'Uses on this page',
                value: _loadedUses(),
              ),
            ],
          ),
        ] else
          Text(_isLoading ? 'Reading coupons…' : 'Coupon counts unavailable.'),
        const SizedBox(height: 12),
        Row(
          children: [
            IconButton(
              tooltip: 'Previous page',
              onPressed: _isLoading || _busy || _confirming || _page == 1
                  ? null
                  : () {
                      if (!current() ||
                          _isLoading ||
                          _busy ||
                          _confirming ||
                          _page == 1)
                        return;
                      setState(() => _page--);
                      _loadCoupons();
                    },
              icon: const Icon(Icons.chevron_left),
            ),
            Expanded(child: Text('Page $_page', textAlign: TextAlign.center)),
            IconButton(
              tooltip: 'Next page',
              onPressed: _isLoading || _busy || _confirming || _more != true
                  ? null
                  : () {
                      if (!current() ||
                          _isLoading ||
                          _busy ||
                          _confirming ||
                          _more != true)
                        return;
                      setState(() => _page++);
                      _loadCoupons();
                    },
              icon: const Icon(Icons.chevron_right),
            ),
          ],
        ),
        if (loaded && _more == null)
          const Text('Further-page availability was not supplied.'),
        if (_error != null)
          LetbuyyInlineFeedback(
            title: loaded
                ? 'Showing the last confirmed page. Refresh did not complete.'
                : 'Coupons unavailable',
            message: _error!,
            kind: LetbuyyFeedbackKind.error,
          ),
        if (_notice != null)
          LetbuyyInlineFeedback(
            title: _reviewRequired ? 'Change unconfirmed' : 'Coupon update',
            message: _notice!,
          ),
      ],
      slivers: [
        if (loaded && _coupons.isEmpty)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                _activeOnly
                    ? 'No coupons match the applied filter.'
                    : 'No coupons yet. Create a discount code to get started.',
              ),
            ),
          ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          sliver: SliverList.builder(
            itemCount: _coupons.length,
            itemBuilder: (context, index) =>
                _couponCard(_coupons[index], view, generation),
          ),
        ),
      ],
    );
  }

  Widget _couponCard(
    CouponContract coupon,
    MerchantStoreView? view,
    int generation,
  ) => Card(
    margin: const EdgeInsets.only(bottom: 12),
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SelectableText(
            coupon.code,
            key: PageStorageKey((coupon.id, 'coupon-code')),
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 12),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: LetbuyyStatusBadge(
              label: coupon.isActive ? 'Enabled' : 'Inactive',
              tone: coupon.isActive
                  ? LetbuyyStatusTone.success
                  : LetbuyyStatusTone.warning,
            ),
          ),
          const SizedBox(height: 12),
          Text(_description(coupon)),
          Text('Discount: ${_discountLabel(coupon)}'),
          Text(
            coupon['minimum_order_amount'] == null
                ? 'Minimum order amount: not supplied'
                : 'Min ${_money(_doubleValue(coupon['minimum_order_amount']))}',
          ),
          Text(
            '${_observedUsage(coupon)?.toString() ?? 'Unavailable'}/${_limitLabel(coupon)} used',
          ),
          if (_nonEmpty(coupon['starts_at']) != null)
            Text('Starts at: ${coupon['starts_at']}'),
          if (_nonEmpty(coupon['expires_at']) != null)
            Text('Expires at: ${coupon['expires_at']}'),
          OverflowBar(
            spacing: 12,
            overflowSpacing: 8,
            alignment: MainAxisAlignment.start,
            children: [
              TextButton(
                onPressed: !_commandsAllowed
                    ? null
                    : () {
                        if (_current(view, generation) && _commandsAllowed)
                          _openForm(coupon);
                      },
                child: const Text('Edit'),
              ),
              TextButton(
                onPressed: !_commandsAllowed
                    ? null
                    : () {
                        if (_current(view, generation) && _commandsAllowed)
                          _toggle(coupon);
                      },
                child: Text(coupon.isActive ? 'Deactivate' : 'Activate'),
              ),
              TextButton(
                onPressed: !_commandsAllowed
                    ? null
                    : () {
                        if (_current(view, generation) && _commandsAllowed)
                          _delete(coupon);
                      },
                child: const Text('Remove'),
              ),
            ],
          ),
        ],
      ),
    ),
  );

  Future<void> _openForm([CouponContract? coupon]) async {
    final view = _view, generation = _readGeneration;
    if (!_current(view, generation) || !_commandsAllowed) return;
    await Navigator.pushNamed(
      context,
      AppRoutes.couponForm,
      arguments: {'storeId': view!.storeId, 'coupon': coupon},
    );
    if (_current(view, generation)) await _loadCoupons(retain: true);
  }

  Future<void> _toggle(CouponContract coupon) async {
    final service = context.read<CouponService>();
    await _mutate(() async {
      await service.toggleCoupon(coupon);
    }, coupon.isActive ? 'Coupon deactivated' : 'Coupon activated');
  }

  Future<void> _delete(CouponContract coupon) async {
    final view = _view, generation = _readGeneration;
    if (!_current(view, generation) || !_commandsAllowed) return;
    setState(() => _confirming = true);
    final confirmed = await showLetbuyyConfirmation(
      context: context,
      title: 'Remove ${coupon.code}?',
      message:
          'This removes the coupon from use by deactivating it. Its saved record is retained.',
      confirmLabel: 'Remove from use',
      guard: (_, confirmation) => guardMerchantStoreView(
        _matches(view, generation) ? view : null,
        confirmation,
      ),
    );
    if (!_matches(view, generation)) return;
    setState(() => _confirming = false);
    if (!confirmed || !_current(view, generation) || !_commandsAllowed) return;
    final service = context.read<CouponService>();
    await _mutate(
      () => service.deleteCoupon(coupon.id),
      'Coupon removed from use',
    );
  }

  Future<void> _mutate(Future<void> Function() command, String success) async {
    final view = _view, generation = _readGeneration;
    if (!_current(view, generation) || !_commandsAllowed) return;
    setState(() {
      _busy = true;
      _notice = null;
    });
    try {
      await command();
      if (!_matches(view, generation)) return;
      setState(() {
        _busy = false;
        _notice = success;
      });
      if (_current(view, generation)) await _loadCoupons(retain: true);
    } catch (error) {
      if (!_matches(view, generation)) return;
      setState(() {
        _busy = false;
        _reviewRequired = true;
        _notice =
            'The change outcome is unconfirmed. No request will be retried automatically. Refresh and review the saved coupon state before starting another change.';
        if (error is ApiException && [401, 403].contains(error.statusCode)) {
          _denied = true;
          _coupons = [];
          _loadedQuery = null;
          _total = null;
          _more = null;
          _error = 'Current account or store access could not be confirmed.';
        }
      });
    }
  }

  Future<void> _validateCoupon() async {
    final view = _view, generation = _readGeneration;
    if (!_current(view, generation) || !_commandsAllowed) return;
    await showLetbuyyFormSheet<void>(
      context: context,
      builder: (_) => CouponValidationSheet(
        view: view!,
        ownerCurrent: () => _matches(view, generation) && !_denied,
        onDenied: () {
          if (!_matches(view, generation)) return;
          setState(() {
            _denied = true;
            _coupons = [];
            _loadedQuery = null;
            _total = null;
            _more = null;
            _error = 'Current account or store access could not be confirmed.';
          });
        },
      ),
    );
  }

  int? _observedUsage(CouponContract coupon) {
    final raw = coupon.toJson().containsKey('usage_count')
        ? coupon['usage_count']
        : coupon['used_count'];
    if (raw is int && raw >= 0) return raw;
    if (raw is num && raw.isFinite && raw >= 0 && raw == raw.toInt())
      return raw.toInt();
    return null;
  }

  String _loadedUses() {
    final uses = _coupons.map(_observedUsage).toList(growable: false);
    return uses.any((value) => value == null)
        ? 'Unavailable'
        : uses.fold<int>(0, (sum, value) => sum + value!).toString();
  }

  String _description(CouponContract coupon) =>
      _nonEmpty(coupon['description']) ?? '${_discountLabel(coupon)} discount';
  String _discountLabel(CouponContract coupon) {
    if (coupon.type == 'percentage') return '${coupon.value}%';
    if (coupon.type == 'free_shipping') return 'Free shipping';
    return _money(coupon.value);
  }

  String _limitLabel(CouponContract coupon) {
    final limit = _intValue(coupon['usage_limit']);
    return limit <= 0 ? 'unlimited' : limit.toString();
  }

  String _money(double amount) {
    return 'INR ${NumberFormat.decimalPattern('en_IN').format(amount)}';
  }

  int _intValue(Object? value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  double _doubleValue(Object? value) {
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '') ?? 0;
  }

  String? _nonEmpty(Object? value) {
    final text = value?.toString().trim();
    return text == null || text.isEmpty ? null : text;
  }
}
