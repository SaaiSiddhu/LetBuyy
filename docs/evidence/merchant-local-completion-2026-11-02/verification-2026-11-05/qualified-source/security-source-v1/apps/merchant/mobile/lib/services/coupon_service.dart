import 'package:flutter/foundation.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

import 'api_client.dart';

/// Supplied read metadata only; checkout retains discount/eligibility authority.
class CouponReadPage {
  const CouponReadPage({required this.rows, this.total, this.hasNext});
  final List<CouponContract> rows;
  final int? total;
  final bool? hasNext;
}

class CouponService extends ChangeNotifier {
  CouponService({required ApiClient api}) : _api = api {
    _visibleContext = requestContext;
  }

  final ApiClient _api;

  List<CouponContract> _coupons = [];
  List<CouponContract> get coupons =>
      _disposed || _visibleContext != requestContext
      ? const []
      : List.unmodifiable(_coupons);
  Object? _visibleContext;

  bool _isLoading = false;
  bool get isLoading => _isLoading;
  Object? get requestContext => _api.captureRequestContext();
  int _readGeneration = 0;
  bool _disposed = false;

  @override
  void dispose() {
    _disposed = true;
    ++_readGeneration;
    super.dispose();
  }

  Future<List<CouponContract>> fetchCoupons(
    String storeId, {
    bool? active,
    int page = 1,
    int limit = 50,
  }) async => (await readCouponsPage(
    storeId,
    active: active,
    page: page,
    limit: limit,
  )).rows;

  Future<CouponReadPage> readCouponsPage(
    String storeId, {
    bool? active,
    int page = 1,
    int limit = 50,
  }) async {
    final generation = ++_readGeneration, captured = requestContext;
    bool current() =>
        !_disposed &&
        generation == _readGeneration &&
        captured == requestContext;
    if (_disposed) throw StateError('Coupon reader is closed.');
    _isLoading = true;
    notifyListeners();

    try {
      final pageResult = await _api.coupons.list(
        query: {
          'store_id': storeId,
          'page': page,
          'limit': limit,
          'status': active == true ? 'active' : 'all',
        },
      );
      if (!current()) {
        throw const ApiException(
          message: 'Coupon view changed.',
          statusCode: 409,
          code: 'SESSION_CONTEXT_CHANGED',
        );
      }
      if (pageResult.data.any((row) => row['store_id'] != storeId) ||
          pageResult.meta['page'] != null && pageResult.meta['page'] != page ||
          pageResult.meta['per_page'] != null &&
              pageResult.meta['per_page'] != limit) {
        _coupons = [];
        throw const ApiException(
          message: 'Coupon read does not match this view.',
          statusCode: 403,
          code: 'COUPON_SCOPE_MISMATCH',
        );
      }
      _coupons = pageResult.data
          .map(CouponContract.fromJson)
          .toList(growable: false);
      _visibleContext = captured;
      return CouponReadPage(
        rows: List.unmodifiable(_coupons),
        total:
            pageResult.meta['total'] is int &&
                (pageResult.meta['total'] as int) >= 0
            ? pageResult.meta['total'] as int
            : null,
        hasNext: pageResult.meta['has_next'] is bool
            ? pageResult.meta['has_next'] as bool
            : null,
      );
    } catch (error) {
      if (current() &&
          error is ApiException &&
          [401, 403].contains(error.statusCode))
        _coupons = [];
      rethrow;
    } finally {
      if (!_disposed && generation == _readGeneration) {
        _isLoading = false;
        notifyListeners();
      }
    }
  }

  Future<CouponContract> createCoupon(Map<String, dynamic> input) async {
    final created = CouponContract.fromJson(await _api.coupons.create(input));
    _coupons = [created, ..._coupons];
    notifyListeners();
    return created;
  }

  Future<CouponContract> updateCoupon(
    String id,
    Map<String, dynamic> input,
  ) async {
    final updated = CouponContract.fromJson(
      await _api.coupons.update(id, input),
    );
    final index = _coupons.indexWhere((coupon) => coupon.id == id);
    if (index != -1) {
      final next = List<CouponContract>.from(_coupons);
      next[index] = updated;
      _coupons = next;
    }
    notifyListeners();
    return updated;
  }

  Future<CouponContract> toggleCoupon(CouponContract coupon) {
    return updateCoupon(coupon.id, {'is_active': !coupon.isActive});
  }

  Future<void> deleteCoupon(String id) async {
    await _api.coupons.remove(id);
    _coupons = _coupons.where((coupon) => coupon.id != id).toList();
    notifyListeners();
  }

  Future<Map<String, dynamic>> validateCoupon({
    required String storeId,
    required String code,
    double? subtotal,
  }) async {
    return _api.coupons.validate({
      'store_id': storeId,
      'code': code.trim(),
      'order_total': subtotal ?? 0,
    });
  }
}
