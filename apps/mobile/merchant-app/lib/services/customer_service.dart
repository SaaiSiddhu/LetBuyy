import 'package:flutter/foundation.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

import 'api_client.dart';

class CustomerService extends ChangeNotifier {
  CustomerService({required ApiClient api}) : _api = api;

  final ApiClient _api;

  List<CustomerContract> _customers = [];
  List<CustomerContract> get customers => List.unmodifiable(_customers);

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  Future<List<CustomerContract>> fetchCustomers(
    String storeId, {
    String? search,
    int page = 1,
    int limit = 30,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final pageResult = await _api.customers.list(
        query: {
          'store_id': storeId,
          'page': page,
          'limit': limit,
          if (search != null && search.trim().isNotEmpty)
            'search': search.trim(),
        },
      );
      _customers = pageResult.data
          .map(CustomerContract.fromJson)
          .toList(growable: false);
      return _customers;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<CustomerContract> fetchCustomerByEmail(String email) async {
    return CustomerContract.fromJson(await _api.customers.getByEmail(email));
  }

  Future<List<CustomerAddressContract>> fetchAddresses(String email) async {
    final rows = await _api.customers.addresses.list(email);
    return rows.map(CustomerAddressContract.fromJson).toList(growable: false);
  }

  Future<CustomerAddressContract> createAddress(
    String email,
    Map<String, dynamic> input,
  ) async {
    return CustomerAddressContract.fromJson(
      await _api.customers.addresses.create(email, input),
    );
  }

  Future<CustomerAddressContract> updateAddress(
    String email,
    String id,
    Map<String, dynamic> input,
  ) async {
    return CustomerAddressContract.fromJson(
      await _api.customers.addresses.update(email, id, input),
    );
  }

  Future<void> deleteAddress(String email, String id) async {
    await _api.customers.addresses.remove(email, id);
  }
}
