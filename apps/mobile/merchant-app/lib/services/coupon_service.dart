import 'package:flutter/foundation.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

import 'api_client.dart';

class CouponService extends ChangeNotifier {
  CouponService({required ApiClient api}) : _api = api;

  final ApiClient _api;

  List<CouponContract> _coupons = [];
  List<CouponContract> get coupons => List.unmodifiable(_coupons);

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  Future<List<CouponContract>> fetchCoupons(
    String storeId, {
    bool? active,
    int page = 1,
    int limit = 50,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final pageResult = await _api.coupons.list(
        query: {
          'store_id': storeId,
          'page': page,
          'limit': limit,
          if (active != null) 'is_active': active,
        },
      );
      _coupons = pageResult.data
          .map(CouponContract.fromJson)
          .toList(growable: false);
      return _coupons;
    } finally {
      _isLoading = false;
      notifyListeners();
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
      if (subtotal != null) 'subtotal': subtotal,
    });
  }
}
