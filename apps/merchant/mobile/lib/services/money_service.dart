import 'package:flutter/foundation.dart';

import 'api_client.dart';

class MoneyService extends ChangeNotifier {
  MoneyService({required ApiClient api}) : _api = api;

  final ApiClient _api;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  List<Map<String, dynamic>> _payouts = const [];
  List<Map<String, dynamic>> get payouts => List.unmodifiable(_payouts);

  Map<String, dynamic>? _payoutSummary;
  Map<String, dynamic>? get payoutSummary =>
      _payoutSummary == null ? null : Map.unmodifiable(_payoutSummary!);

  Map<String, dynamic>? _wallet;
  Map<String, dynamic>? get wallet =>
      _wallet == null ? null : Map.unmodifiable(_wallet!);

  Map<String, dynamic>? _commission;
  Map<String, dynamic>? get commission =>
      _commission == null ? null : Map.unmodifiable(_commission!);

  Map<String, dynamic>? _cod;
  Map<String, dynamic>? get cod =>
      _cod == null ? null : Map.unmodifiable(_cod!);

  Future<Map<String, dynamic>> fetchPayouts(String storeId) async {
    _isLoading = true;
    notifyListeners();
    try {
      final response = await _api.payouts.list(
        query: {'store_id': storeId, 'limit': 25},
      );
      _payouts = _listOfMaps(response['payouts']);
      _payoutSummary = _mapOrEmpty(response['summary']);
      return response;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> fetchPayoutSummary(String storeId) async {
    final response = await _api.payouts.summary(query: {'store_id': storeId});
    _payoutSummary = Map<String, dynamic>.from(response);
    notifyListeners();
    return _payoutSummary!;
  }

  Future<Map<String, dynamic>> fetchPayoutStatement(String payoutId) =>
      _api.payouts.get(payoutId);

  Future<Map<String, dynamic>> createPayoutStatement(String storeId) async {
    final payout = await _api.payouts.create({
      'store_id': storeId,
      'idempotency_key':
          'mobile-payout-$storeId-${DateTime.now().microsecondsSinceEpoch}',
    });
    await fetchPayouts(storeId);
    await fetchWallet(storeId);
    return payout;
  }

  Future<Map<String, dynamic>> settlePayout(
    String payoutId,
    String storeId,
  ) async {
    final payout = await _api.payouts.settle(payoutId, {
      'idempotency_key':
          'mobile-payout-settle-$payoutId-${DateTime.now().microsecondsSinceEpoch}',
    });
    await fetchPayouts(storeId);
    await fetchWallet(storeId);
    return payout;
  }

  Future<Map<String, dynamic>> fetchWallet(String storeId) async {
    final response = await _api.wallet.get(
      query: {'store_id': storeId, 'limit': 50},
    );
    _wallet = Map<String, dynamic>.from(response);
    notifyListeners();
    return _wallet!;
  }

  Future<Map<String, dynamic>> fetchCommission(String storeId) async {
    final response = await _api.commission.overview(
      query: {'store_id': storeId, 'limit': 50},
    );
    _commission = Map<String, dynamic>.from(response);
    notifyListeners();
    return _commission!;
  }

  Future<Map<String, dynamic>> reconcileCommission(String storeId) async {
    final response = await _api.commission.reconcile({
      'store_id': storeId,
      'idempotency_key':
          'mobile-commission-$storeId-${DateTime.now().microsecondsSinceEpoch}',
    });
    final overview = response['overview'];
    if (overview is Map) {
      _commission = Map<String, dynamic>.from(overview);
    }
    notifyListeners();
    return response;
  }

  Future<Map<String, dynamic>> fetchCodReconciliation(String storeId) async {
    final response = await _api.cod.overview(
      query: {'store_id': storeId, 'status': 'all', 'limit': 50},
    );
    _cod = Map<String, dynamic>.from(response);
    notifyListeners();
    return _cod!;
  }

  Future<Map<String, dynamic>> collectCodOrder(
    String storeId,
    String orderId, {
    int? collectedAmountMinor,
    String? notes,
  }) async {
    final response = await _api.cod.collect({
      'store_id': storeId,
      'order_id': orderId,
      if (collectedAmountMinor != null)
        'collected_amount_minor': collectedAmountMinor,
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
      'idempotency_key':
          'mobile-cod-collect-$orderId-${DateTime.now().microsecondsSinceEpoch}',
    });
    await fetchCodReconciliation(storeId);
    return response;
  }

  Future<Map<String, dynamic>> reconcileCodEntry(
    String storeId,
    String entryId, {
    int? depositedAmountMinor,
    String? notes,
  }) async {
    final response = await _api.cod.reconcile(entryId, {
      'store_id': storeId,
      if (depositedAmountMinor != null)
        'deposited_amount_minor': depositedAmountMinor,
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
      'idempotency_key':
          'mobile-cod-reconcile-$entryId-${DateTime.now().microsecondsSinceEpoch}',
    });
    await Future.wait([fetchCodReconciliation(storeId), fetchWallet(storeId)]);
    return response;
  }

  Future<void> refreshMoney(String storeId) async {
    await Future.wait([
      fetchPayouts(storeId),
      fetchWallet(storeId),
      fetchCommission(storeId),
      fetchCodReconciliation(storeId),
    ]);
  }

  static Map<String, dynamic> _mapOrEmpty(Object? value) {
    if (value is Map) return Map<String, dynamic>.from(value);
    return <String, dynamic>{};
  }

  static List<Map<String, dynamic>> _listOfMaps(Object? value) {
    if (value is! List) return const [];
    return value
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList(growable: false);
  }
}
