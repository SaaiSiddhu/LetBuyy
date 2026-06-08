import 'package:flutter/foundation.dart';

import 'api_client.dart';

class MerchantReturn {
  MerchantReturn(this._json);

  final JsonMap _json;

  factory MerchantReturn.fromJson(JsonMap json) => MerchantReturn(json);

  String get id => (_json['id'] ?? '').toString();
  String get storeId =>
      (_json['store_id'] ?? _json['site_id'] ?? '').toString();
  String get orderId => (_json['order_id'] ?? '').toString();
  String get orderNumber => (_json['order_number'] ?? orderId).toString();
  String get status => (_json['status'] ?? 'requested').toString();
  String get customerEmail => (_json['customer_email'] ?? '').toString();
  String get reason => (_json['reason'] ?? '').toString();
  String get refundStatus => (_json['refund_status'] ?? '').toString();
  String get refundId => (_json['refund_id'] ?? '').toString();
  double get refundAmount => (_json['refund_amount'] as num?)?.toDouble() ?? 0;
  String get currency => (_json['currency'] ?? 'INR').toString();
  DateTime? get createdAt =>
      DateTime.tryParse((_json['created_at'] ?? '').toString());

  JsonMap toJson() => Map<String, dynamic>.from(_json);
}

class ReturnService extends ChangeNotifier {
  ReturnService({required ApiClient api}) : _api = api;

  final ApiClient _api;

  List<MerchantReturn> _returns = [];
  List<MerchantReturn> get returns => List.unmodifiable(_returns);

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  Future<List<MerchantReturn>> fetchReturns(
    String storeId, {
    String status = 'all',
    int page = 1,
    int limit = 20,
  }) async {
    _isLoading = true;
    notifyListeners();
    try {
      final result = await _api.returns.list(
        query: {
          'store_id': storeId,
          'status': status,
          'page': page,
          'limit': limit,
        },
      );
      _returns = result.data
          .map(MerchantReturn.fromJson)
          .toList(growable: false);
      return _returns;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<MerchantReturn> createReturn({
    required String orderId,
    String? reason,
    bool restock = false,
    String refundMethod = 'original_payment',
    List<JsonMap>? lines,
    String? idempotencyKey,
  }) async {
    final key =
        idempotencyKey ??
        'mobile-return-$orderId-${DateTime.now().microsecondsSinceEpoch}';
    final data = await _api.returns.create({
      'order_id': orderId,
      'idempotency_key': key,
      if (lines != null && lines.isNotEmpty) 'lines': lines,
      if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
      'refund_method': refundMethod,
      'restock': restock,
    });
    final created = MerchantReturn.fromJson(data);
    _upsert(created);
    return created;
  }

  Future<MerchantReturn> updateStatus(
    String returnId, {
    required String status,
    String? notes,
  }) async {
    final data = await _api.returns.update(returnId, {
      'status': status,
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
    final updated = MerchantReturn.fromJson(data);
    _upsert(updated);
    return updated;
  }

  Future<MerchantReturn> completeRefund(
    String returnId, {
    String? refundId,
    String? providerRefundId,
    String? notes,
    String? idempotencyKey,
  }) async {
    final key =
        idempotencyKey ??
        'mobile-return-refund-$returnId-${DateTime.now().microsecondsSinceEpoch}';
    final data = await _api.returns.completeRefund(returnId, {
      'idempotency_key': key,
      if (refundId != null && refundId.trim().isNotEmpty)
        'refund_id': refundId.trim(),
      if (providerRefundId != null && providerRefundId.trim().isNotEmpty)
        'provider_refund_id': providerRefundId.trim(),
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
    final updated = MerchantReturn.fromJson(data);
    _upsert(updated);
    return updated;
  }

  void _upsert(MerchantReturn record) {
    final index = _returns.indexWhere((item) => item.id == record.id);
    if (index == -1) {
      _returns = [record, ..._returns];
    } else {
      final next = [..._returns];
      next[index] = record;
      _returns = next;
    }
    notifyListeners();
  }
}
