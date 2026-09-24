import 'package:flutter/foundation.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

import 'api_client.dart';
import 'cache_service.dart';

class CustomerService extends ChangeNotifier {
  CustomerService({required ApiClient api, CacheService? cache})
    : _api = api,
      _cache = cache;

  final ApiClient _api;
  final CacheService? _cache;

  List<CustomerContract> _customers = [];
  List<CustomerContract> get customers => List.unmodifiable(_customers);

  List<CustomerSegmentContract> _segments = [];
  List<CustomerSegmentContract> get segments => List.unmodifiable(_segments);

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _customersNextCursor;
  String? get customersNextCursor => _customersNextCursor;

  Future<List<CustomerContract>> fetchCustomers(
    String storeId, {
    String? search,
    int page = 1,
    int limit = 30,
    String? cursor,
  }) async {
    _isLoading = true;
    final normalizedCursor = cursor?.trim();
    final cacheKey = CacheService.customersKey(
      storeId,
      search: search,
      cursor: normalizedCursor,
      page: page,
      limit: limit,
    );
    final cachedRows = _cache?.readJsonList(cacheKey) ?? [];
    if (cachedRows.isNotEmpty) {
      _customers = cachedRows
          .map(CustomerContract.fromJson)
          .toList(growable: false);
    }
    notifyListeners();

    try {
      final pageResult = await _api.customers.list(
        query: {
          'store_id': storeId,
          'page': page,
          'limit': limit,
          if (normalizedCursor != null && normalizedCursor.isNotEmpty)
            'cursor': normalizedCursor,
          if (search != null && search.trim().isNotEmpty)
            'search': search.trim(),
        },
      );
      _customersNextCursor = pageResult.nextCursor;
      _customers = pageResult.data
          .map(CustomerContract.fromJson)
          .toList(growable: false);
      await _cache?.writeJson(
        cacheKey,
        _customers.map((customer) => customer.toJson()).toList(growable: false),
      );
      for (final customer in _customers) {
        final email = customer.email;
        if (email != null && email.trim().isNotEmpty) {
          await _cache?.writeJson(
            CacheService.customerDetailKey(storeId, email),
            customer.toJson(),
          );
        }
      }
      return _customers;
    } catch (e) {
      debugPrint('❌ fetchCustomers error: $e');
      if (_customers.isNotEmpty) return _customers;
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> exportCustomers(String storeId) {
    return _api.exports.customers(storeId: storeId);
  }

  Future<Map<String, dynamic>> fetchExportJob(String id) {
    return _api.exports.job(id);
  }

  Future<CustomerContract> createCustomer({
    required String storeId,
    required String email,
    required String firstName,
    String? lastName,
    String? phone,
    String? notes,
    List<String> tags = const [],
    bool acceptsMarketing = false,
  }) async {
    final normalizedEmail = email.trim().toLowerCase();
    final customer = CustomerContract.fromJson(
      await _api.customers.create({
        'store_id': storeId,
        'email': normalizedEmail,
        'first_name': firstName.trim(),
        if (lastName != null && lastName.trim().isNotEmpty)
          'last_name': lastName.trim(),
        if (phone != null && phone.trim().isNotEmpty) 'phone': phone.trim(),
        if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
        'tags': tags
            .map((tag) => tag.trim())
            .where((tag) => tag.isNotEmpty)
            .toList(growable: false),
        'accepts_marketing': acceptsMarketing,
      }),
    );
    _customers = [
      customer,
      ..._customers.where(
        (row) => row.email?.trim().toLowerCase() != normalizedEmail,
      ),
    ];
    await _cache?.writeJson(
      CacheService.customerDetailKey(storeId, normalizedEmail),
      customer.toJson(),
    );
    notifyListeners();
    return customer;
  }

  Future<CustomerContract> fetchCustomerByEmail(
    String email, {
    String? storeId,
  }) async {
    try {
      final customer = CustomerContract.fromJson(
        await _api.customers.getByEmail(email, storeId: storeId),
      );
      if (storeId != null && storeId.trim().isNotEmpty) {
        await _cache?.writeJson(
          CacheService.customerDetailKey(storeId, email),
          customer.toJson(),
        );
      }
      return customer;
    } catch (e) {
      debugPrint('❌ fetchCustomerByEmail error: $e');
      if (storeId != null && storeId.trim().isNotEmpty) {
        final cached = _cache?.readJsonMap(
          CacheService.customerDetailKey(storeId, email),
        );
        if (cached != null) return CustomerContract.fromJson(cached);
      }
      rethrow;
    }
  }

  CustomerContract? cachedCustomerByEmail(String email, {String? storeId}) {
    final normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail.isEmpty) return null;

    for (final customer in _customers) {
      if (customer.email?.trim().toLowerCase() == normalizedEmail) {
        return customer;
      }
    }

    final normalizedStoreId = storeId?.trim();
    if (normalizedStoreId == null || normalizedStoreId.isEmpty) return null;

    final cached = _cache?.readJsonMap(
      CacheService.customerDetailKey(normalizedStoreId, normalizedEmail),
    );
    if (cached == null) return null;
    return CustomerContract.fromJson(cached);
  }

  Future<CustomerContract> updateCustomer(
    String email,
    Map<String, dynamic> input, {
    String? storeId,
  }) async {
    final customer = CustomerContract.fromJson(
      await _api.customers.update(email, input, storeId: storeId),
    );
    final index = _customers.indexWhere(
      (row) => row.email?.toLowerCase() == email.toLowerCase(),
    );
    if (index >= 0) {
      _customers = [
        ..._customers.take(index),
        customer,
        ..._customers.skip(index + 1),
      ];
      notifyListeners();
    }
    if (storeId != null && storeId.trim().isNotEmpty) {
      await _cache?.writeJson(
        CacheService.customerDetailKey(storeId, email),
        customer.toJson(),
      );
    }
    return customer;
  }

  Future<List<Map<String, dynamic>>> fetchNotes(
    String email, {
    required String storeId,
  }) async {
    return _api.customers.listNotes(email, storeId: storeId);
  }

  Future<Map<String, dynamic>> addNote(
    String email, {
    required String storeId,
    required String note,
  }) async {
    return _api.customers.createNote(email, {
      'store_id': storeId,
      'note': note,
    });
  }

  Future<CustomerContract> updateTags(
    String email, {
    required String storeId,
    required List<String> tags,
  }) async {
    final customer = CustomerContract.fromJson(
      await _api.customers.updateTags(email, {
        'store_id': storeId,
        'tags': tags,
      }),
    );
    await _cache?.writeJson(
      CacheService.customerDetailKey(storeId, email),
      customer.toJson(),
    );
    notifyListeners();
    return customer;
  }

  Future<void> emailCustomer(
    String email, {
    required String storeId,
    required String subject,
    required String message,
  }) async {
    await _api.customers.sendEmail(email, {
      'store_id': storeId,
      'subject': subject,
      'message': message,
    });
  }

  Future<CustomerContract> mergeCustomer(
    String sourceEmail, {
    required String storeId,
    required String targetEmail,
  }) async {
    final payload = await _api.customers.merge(sourceEmail, {
      'store_id': storeId,
      'target_email': targetEmail,
    });
    final customer = CustomerContract.fromJson(
      Map<String, dynamic>.from(payload['customer'] as Map),
    );
    _customers = _customers
        .where((row) => row.email?.toLowerCase() != sourceEmail.toLowerCase())
        .toList(growable: false);
    final existingIndex = _customers.indexWhere(
      (row) => row.email?.toLowerCase() == targetEmail.toLowerCase(),
    );
    if (existingIndex >= 0) {
      _customers = [
        ..._customers.take(existingIndex),
        customer,
        ..._customers.skip(existingIndex + 1),
      ];
    } else {
      _customers = [customer, ..._customers];
    }
    await _cache?.remove(CacheService.customerDetailKey(storeId, sourceEmail));
    await _cache?.writeJson(
      CacheService.customerDetailKey(storeId, targetEmail),
      customer.toJson(),
    );
    notifyListeners();
    return customer;
  }

  Future<void> deleteCustomer(String email, {required String storeId}) async {
    await _api.customers.remove(email, storeId: storeId);
    _customers = _customers
        .where((row) => row.email?.toLowerCase() != email.toLowerCase())
        .toList(growable: false);
    await _cache?.remove(CacheService.customerDetailKey(storeId, email));
    notifyListeners();
  }

  Future<List<CustomerSegmentContract>> fetchSegments(
    String storeId, {
    String? search,
  }) async {
    final rows = await _api.customers.segments.list(
      storeId: storeId,
      search: search,
    );
    _segments = rows
        .map(CustomerSegmentContract.fromJson)
        .toList(growable: false);
    notifyListeners();
    return _segments;
  }

  Future<CustomerSegmentContract> createSegment({
    required String storeId,
    required String name,
    String? description,
    required Map<String, dynamic> rules,
  }) async {
    final segment = CustomerSegmentContract.fromJson(
      await _api.customers.segments.create({
        'store_id': storeId,
        'name': name,
        if (description != null && description.trim().isNotEmpty)
          'description': description.trim(),
        'rules': rules,
      }),
    );
    _segments = [segment, ..._segments.where((row) => row.id != segment.id)];
    notifyListeners();
    return segment;
  }

  Future<Map<String, dynamic>> previewSegment({
    required String storeId,
    required Map<String, dynamic> rules,
  }) {
    return _api.customers.segments.preview({
      'store_id': storeId,
      'rules': rules,
    });
  }

  Future<List<CustomerContract>> fetchSegmentCustomers(
    String segmentId, {
    required String storeId,
    int page = 1,
    int limit = 30,
  }) async {
    final pageResult = await _api.customers.segments.customers(
      segmentId,
      storeId: storeId,
      page: page,
      limit: limit,
    );
    _customers = pageResult.data
        .map(CustomerContract.fromJson)
        .toList(growable: false);
    notifyListeners();
    return _customers;
  }

  Future<List<CustomerAddressContract>> fetchAddresses(
    String email, {
    String? storeId,
  }) async {
    final rows = await _api.customers.addresses.list(email, storeId: storeId);
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
