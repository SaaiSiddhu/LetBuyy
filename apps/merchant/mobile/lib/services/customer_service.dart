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
  final Set<String> _cacheDeniedStores = {};

  // Ephemeral read admission only; cache/storage and command authority remain
  // with the existing owners below.
  bool _disposed = false, _readContextBound = false;
  Object? _readContext;
  final Map<String, int> _readDenials = {};
  final Set<String> _viewDeniedStores = {};
  final Map<(String, String?, String), int> _optionalGenerations = {};
  final Map<(String?, String), int> _detailGenerations = {};
  final Map<
    (String?, String),
    ({
      Object? context,
      WeakReference<CustomerContract> row,
      int generation,
      int denial,
      bool fresh,
    })
  >
  _detailViews = {};
  ({
    Object? context,
    String store,
    List<CustomerContract> rows,
    int denial,
    bool fresh,
  })?
  _customerPage;

  Object? get requestContext => _api.captureRequestContext();
  bool hasDeniedRead(String storeId) =>
      !_disposed &&
      _readContextBound &&
      _readContext == requestContext &&
      _viewDeniedStores.contains(storeId);
  bool acceptsCustomerPage(List<CustomerContract> rows) {
    final page = _customerPage;
    return !_disposed &&
        page != null &&
        page.context == requestContext &&
        identical(page.rows, rows) &&
        identical(_customers, rows) &&
        page.denial == (_readDenials[page.store] ?? 0) &&
        !hasDeniedRead(page.store);
  }

  bool hasFreshCustomerPage(List<CustomerContract> rows) =>
      acceptsCustomerPage(rows) && _customerPage!.fresh;
  bool acceptsCustomer(CustomerContract row) {
    final email = row.email;
    if (_disposed || email == null) return false;
    final key = _detailKey(row.storeId, email),
        state = _detailViews[_detailKey(row.storeId, email)];
    return state != null &&
        state.context == requestContext &&
        identical(state.row.target, row) &&
        state.generation == _detailGenerations[key] &&
        state.denial == (_readDenials[row.storeId] ?? 0) &&
        !hasDeniedRead(row.storeId);
  }

  bool hasFreshCustomer(CustomerContract row) =>
      acceptsCustomer(row) &&
      _detailViews[_detailKey(row.storeId, row.email!)]!.fresh;
  (String?, String) _detailKey(String? store, String email) =>
      (store, email.trim().toLowerCase());
  int _beginRead(String? store) {
    if (_disposed) _checkReadContext(requestContext, false);
    if (!_readContextBound || _readContext != requestContext) {
      _readContextBound = true;
      _readContext = requestContext;
      _readDenials.clear();
      _viewDeniedStores.clear();
      _detailGenerations.clear();
      _optionalGenerations.clear();
      _detailViews.clear();
      _customerPage = null;
    }
    return _readDenials[store] ?? 0;
  }

  void _checkRead(Object? context, bool current, String? store, int denial) =>
      _checkReadContext(
        context,
        !_disposed && current && (_readDenials[store] ?? 0) == denial,
      );
  int _denyRead(String? store) {
    if (store == null) return 0;
    final revision = (_readDenials[store] ?? 0) + 1;
    _readDenials[store] = revision;
    _viewDeniedStores.add(store);
    _customerPage = null;
    if (!_disposed) notifyListeners();
    return revision;
  }

  void _acceptPrimary(String? store) {
    if (store != null) _viewDeniedStores.remove(store);
  }

  void _publishPage(Object? captured, String store, int denial, bool fresh) {
    if (fresh) _acceptPrimary(store);
    _customerPage = (
      context: captured,
      store: store,
      rows: _customers,
      denial: denial,
      fresh: fresh,
    );
  }

  @override
  void dispose() {
    _disposed = true;
    _customersGeneration++;
    _segmentsGeneration++;
    _detailGenerations.clear();
    _optionalGenerations.clear();
    _detailViews.clear();
    _customerPage = null;
    super.dispose();
  }

  List<CustomerContract> _customers = [];
  Object? _customersContext;
  String? _customersStoreId;
  int _customersGeneration = 0;
  List<CustomerContract> get customers => List.unmodifiable(
    !_disposed &&
            _customersContext == _api.captureRequestContext() &&
            !hasDeniedRead(_customersStoreId ?? '')
        ? _customers
        : const <CustomerContract>[],
  );

  List<CustomerSegmentContract> _segments = [];
  Object? _segmentsContext;
  String? _segmentsStoreId;
  int _segmentsGeneration = 0;
  List<CustomerSegmentContract> get segments => List.unmodifiable(
    !_disposed &&
            _segmentsContext == _api.captureRequestContext() &&
            !hasDeniedRead(_segmentsStoreId ?? '')
        ? _segments
        : const <CustomerSegmentContract>[],
  );

  void _checkReadContext(Object? captured, bool currentGeneration) {
    if (!currentGeneration || captured != _api.captureRequestContext()) {
      throw const ApiException(
        message: 'Customer view changed. Reload the selected store.',
        statusCode: 409,
        code: 'SESSION_CONTEXT_CHANGED',
      );
    }
  }

  bool _canUseOfflineCache(Object error) =>
      error is! ApiException ||
      (error.code != 'CUSTOMER_SCOPE_MISMATCH' &&
          (error.statusCode == 0 || error.statusCode >= 500));

  CustomerContract _customer(Map<String, dynamic> row, String? storeId) {
    final customer = CustomerContract.fromJson(row);
    if (storeId != null && customer.storeId != storeId) {
      throw const ApiException(
        message: 'Customer scope could not be confirmed.',
        statusCode: 502,
        code: 'CUSTOMER_SCOPE_MISMATCH',
      );
    }
    return customer;
  }

  bool _isLoading = false;
  bool get isLoading => !_disposed && _isLoading;

  String? _customersNextCursor;
  String? get customersNextCursor => _customersNextCursor;
  bool _customersHasMore = false;
  bool get customersHasMore => _customersHasMore;
  bool _customersOffline = false;
  bool get customersOffline => _customersOffline;

  Future<List<CustomerContract>> fetchCustomers(
    String storeId, {
    String? search,
    int page = 1,
    int limit = 30,
    String? cursor,
  }) async {
    var denial = _beginRead(storeId);
    _customerPage = null;
    final captured = _api.captureRequestContext(),
        generation = ++_customersGeneration;
    _customersContext = captured;
    _customersStoreId = storeId;
    _customers = [];
    _customersNextCursor = null;
    _customersHasMore = false;
    _customersOffline = false;
    _isLoading = true;
    final normalizedCursor = cursor?.trim();
    final cacheKey = CacheService.customersKey(
      storeId,
      search: search,
      cursor: normalizedCursor,
      page: page,
      limit: limit,
    );
    final cachedRows = _cacheDeniedStores.contains(storeId)
        ? <Map<String, dynamic>>[]
        : (_cache?.readJsonList(cacheKey) ?? []);
    if (cachedRows.isNotEmpty) {
      _customers = cachedRows
          .where((row) => row['store_id'] == storeId)
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
      _checkRead(captured, generation == _customersGeneration, storeId, denial);
      _customersNextCursor = pageResult.nextCursor;
      _customersHasMore = pageResult.hasMore;
      final rows = pageResult.data
          .map((row) => _customer(row, storeId))
          .toList(growable: false);
      _customers = rows;
      _cacheDeniedStores.remove(storeId);
      await _cache?.writeJson(
        cacheKey,
        _customers.map((customer) => customer.toJson()).toList(growable: false),
      );
      _checkRead(captured, generation == _customersGeneration, storeId, denial);
      for (final customer in _customers) {
        final email = customer.email;
        if (email != null && email.trim().isNotEmpty) {
          await _cache?.writeJson(
            CacheService.customerDetailKey(storeId, email),
            customer.toJson(),
          );
          _checkRead(
            captured,
            generation == _customersGeneration,
            storeId,
            denial,
          );
        }
      }
      _checkRead(
        captured,
        identical(_customers, rows) && generation == _customersGeneration,
        storeId,
        denial,
      );
      _publishPage(captured, storeId, denial, true);
      return _customers;
    } catch (e) {
      _checkRead(captured, generation == _customersGeneration, storeId, denial);
      if (hasDeniedRead(storeId) && _canUseOfflineCache(e)) rethrow;
      if (_canUseOfflineCache(e) && cachedRows.isNotEmpty) {
        _customers = cachedRows
            .where((row) => row['store_id'] == storeId)
            .map(CustomerContract.fromJson)
            .toList(growable: false);
        _customersOffline = true;
        _publishPage(captured, storeId, denial, false);
        return _customers;
      }
      _customers = [];
      if (e is ApiException && (e.statusCode == 401 || e.statusCode == 403)) {
        _cacheDeniedStores.add(storeId);
        denial = _denyRead(storeId);
      }
      await _cache?.remove(cacheKey);
      _checkRead(captured, generation == _customersGeneration, storeId, denial);
      rethrow;
    } finally {
      if (!_disposed &&
          generation == _customersGeneration &&
          captured == _api.captureRequestContext()) {
        _isLoading = false;
        notifyListeners();
      }
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
    final captured = _api.captureRequestContext();
    final normalizedEmail = email.trim().toLowerCase();
    final customer = _customer(
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
      storeId,
    );
    _checkReadContext(captured, true);
    if (_customersContext == captured && _customersStoreId == storeId)
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
    _checkReadContext(captured, true);
    notifyListeners();
    return customer;
  }

  Future<CustomerContract> fetchCustomerByEmail(
    String email, {
    String? storeId,
  }) async {
    var denial = _beginRead(storeId);
    final captured = _api.captureRequestContext(),
        key = _detailKey(storeId, email);
    final generation = (_detailGenerations[key] ?? 0) + 1;
    _detailGenerations[key] = generation;
    _detailViews.remove(key);
    void check() => _checkRead(
      captured,
      generation == _detailGenerations[key],
      storeId,
      denial,
    );
    try {
      final customer = _customer(
        await _api.customers.getByEmail(email, storeId: storeId),
        storeId,
      );
      check();
      if (customer.email?.trim().toLowerCase() != email.trim().toLowerCase()) {
        throw const ApiException(
          message: 'Customer identity could not be confirmed.',
          statusCode: 502,
          code: 'CUSTOMER_SCOPE_MISMATCH',
        );
      }
      if (storeId != null) _cacheDeniedStores.remove(storeId);
      if (storeId != null && storeId.trim().isNotEmpty) {
        await _cache?.writeJson(
          CacheService.customerDetailKey(storeId, email),
          customer.toJson(),
        );
        check();
      }
      _acceptPrimary(storeId);
      _detailViews[key] = (
        context: captured,
        row: WeakReference(customer),
        generation: generation,
        denial: denial,
        fresh: true,
      );
      if (!_disposed) notifyListeners();
      return customer;
    } catch (e) {
      check();
      if (storeId != null && hasDeniedRead(storeId) && _canUseOfflineCache(e))
        rethrow;
      if (!_cacheDeniedStores.contains(storeId) &&
          _canUseOfflineCache(e) &&
          storeId != null &&
          storeId.trim().isNotEmpty) {
        final cached = _cache?.readJsonMap(
          CacheService.customerDetailKey(storeId, email),
        );
        if (cached != null && cached['store_id'] == storeId) {
          final row = CustomerContract.fromJson(cached);
          if (row.email?.trim().toLowerCase() != email.trim().toLowerCase()) {
            throw const ApiException(
              message: 'Customer identity could not be confirmed.',
              statusCode: 502,
              code: 'CUSTOMER_SCOPE_MISMATCH',
            );
          }
          _detailViews[key] = (
            context: captured,
            row: WeakReference(row),
            generation: generation,
            denial: denial,
            fresh: false,
          );
          return row;
        }
      } else if (storeId != null) {
        if (e is ApiException && (e.statusCode == 401 || e.statusCode == 403)) {
          _cacheDeniedStores.add(storeId);
          denial = _denyRead(storeId);
        }
        _customers = [];
        await _cache?.remove(CacheService.customerDetailKey(storeId, email));
        check();
        if (!_disposed) notifyListeners();
      }
      rethrow;
    }
  }

  CustomerContract? cachedCustomerByEmail(String email, {String? storeId}) {
    if (_disposed || (storeId != null && hasDeniedRead(storeId))) return null;
    if (_cacheDeniedStores.contains(storeId)) return null;
    final normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail.isEmpty) return null;

    for (final customer in customers) {
      if (storeId != null &&
          _customersStoreId == storeId &&
          customer.storeId == storeId &&
          customer.email?.trim().toLowerCase() == normalizedEmail) {
        return customer;
      }
    }

    final normalizedStoreId = storeId?.trim();
    if (normalizedStoreId == null || normalizedStoreId.isEmpty) return null;

    final cached = _cache?.readJsonMap(
      CacheService.customerDetailKey(normalizedStoreId, normalizedEmail),
    );
    if (cached == null || cached['store_id'] != normalizedStoreId) return null;
    return CustomerContract.fromJson(cached);
  }

  Future<CustomerContract> updateCustomer(
    String email,
    Map<String, dynamic> input, {
    String? storeId,
  }) async {
    final captured = _api.captureRequestContext();
    final customer = _customer(
      await _api.customers.update(email, input, storeId: storeId),
      storeId,
    );
    _checkReadContext(captured, true);
    final index = _customers.indexWhere(
      (row) =>
          row.storeId == customer.storeId &&
          row.email?.toLowerCase() == email.toLowerCase(),
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
      _checkReadContext(captured, true);
    }
    return customer;
  }

  Future<List<Map<String, dynamic>>> fetchNotes(
    String email, {
    required String storeId,
  }) async {
    final denial = _beginRead(storeId), captured = requestContext;
    final key = ('notes', storeId, email.trim().toLowerCase());
    final generation = (_optionalGenerations[key] ?? 0) + 1;
    _optionalGenerations[key] = generation;
    void check() => _checkRead(
      captured,
      _optionalGenerations[key] == generation,
      storeId,
      denial,
    );
    try {
      final rows = await _api.customers.listNotes(email, storeId: storeId);
      check();
      for (final row in rows) _checkRelatedRow(row, email, storeId);
      return rows;
    } catch (error) {
      check();
      if (error is ApiException &&
          (error.statusCode == 401 || error.statusCode == 403))
        _denyRead(storeId);
      rethrow;
    }
  }

  void _checkRelatedRow(
    Map<String, dynamic> row,
    String email,
    String? storeId,
  ) {
    if ((storeId != null && row['store_id'] != storeId) ||
        row['customer_email'] is! String ||
        (row['customer_email'] as String).trim().toLowerCase() !=
            email.trim().toLowerCase()) {
      throw const ApiException(
        message: 'Customer record scope could not be confirmed.',
        statusCode: 502,
        code: 'CUSTOMER_SCOPE_MISMATCH',
      );
    }
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
    final captured = _api.captureRequestContext();
    final customer = _customer(
      await _api.customers.updateTags(email, {
        'store_id': storeId,
        'tags': tags,
      }),
      storeId,
    );
    _checkReadContext(captured, true);
    await _cache?.writeJson(
      CacheService.customerDetailKey(storeId, email),
      customer.toJson(),
    );
    _checkReadContext(captured, true);
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
    final captured = _api.captureRequestContext();
    final payload = await _api.customers.merge(sourceEmail, {
      'store_id': storeId,
      'target_email': targetEmail,
    });
    _checkReadContext(captured, true);
    final customer = _customer(
      Map<String, dynamic>.from(payload['customer'] as Map),
      storeId,
    );
    if (_customersContext == captured && _customersStoreId == storeId) {
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
    }
    await _cache?.remove(CacheService.customerDetailKey(storeId, sourceEmail));
    _checkReadContext(captured, true);
    await _cache?.writeJson(
      CacheService.customerDetailKey(storeId, targetEmail),
      customer.toJson(),
    );
    _checkReadContext(captured, true);
    notifyListeners();
    return customer;
  }

  Future<void> deleteCustomer(String email, {required String storeId}) async {
    final captured = _api.captureRequestContext();
    await _api.customers.remove(email, storeId: storeId);
    _checkReadContext(captured, true);
    _customers = _customers
        .where(
          (row) =>
              row.storeId != storeId ||
              row.email?.toLowerCase() != email.toLowerCase(),
        )
        .toList(growable: false);
    await _cache?.remove(CacheService.customerDetailKey(storeId, email));
    _checkReadContext(captured, true);
    notifyListeners();
  }

  Future<List<CustomerSegmentContract>> fetchSegments(
    String storeId, {
    String? search,
  }) async {
    var denial = _beginRead(storeId);
    final captured = _api.captureRequestContext(),
        generation = ++_segmentsGeneration;
    if (_segmentsContext != captured || _segmentsStoreId != storeId)
      _segments = [];
    _segmentsContext = captured;
    _segmentsStoreId = storeId;
    List<Map<String, dynamic>> rows;
    try {
      rows = await _api.customers.segments.list(
        storeId: storeId,
        search: search,
      );
    } catch (error) {
      _checkRead(captured, generation == _segmentsGeneration, storeId, denial);
      if (error is ApiException &&
          (error.statusCode == 401 || error.statusCode == 403)) {
        denial = _denyRead(storeId);
      }
      rethrow;
    }
    _checkRead(captured, generation == _segmentsGeneration, storeId, denial);
    _segments = rows
        .map(CustomerSegmentContract.fromJson)
        .toList(growable: false);
    if (_segments.any((segment) => segment.storeId != storeId)) {
      _segments = [];
      throw const ApiException(
        message: 'Customer segment scope could not be confirmed.',
        statusCode: 502,
        code: 'CUSTOMER_SCOPE_MISMATCH',
      );
    }
    notifyListeners();
    return _segments;
  }

  Future<CustomerSegmentContract> createSegment({
    required String storeId,
    required String name,
    String? description,
    required Map<String, dynamic> rules,
    ApiRequestOptions? options,
  }) async {
    final captured = _api.captureRequestContext();
    final segment = CustomerSegmentContract.fromJson(
      await _api.customers.segments.create({
        'store_id': storeId,
        'name': name,
        if (description != null && description.trim().isNotEmpty)
          'description': description.trim(),
        'rules': rules,
      }, options: options),
    );
    _checkReadContext(captured, true);
    if (segment.storeId != storeId)
      throw const ApiException(
        message: 'Customer segment scope could not be confirmed.',
        statusCode: 502,
        code: 'CUSTOMER_SCOPE_MISMATCH',
      );
    if (_segmentsContext == captured && _segmentsStoreId == storeId)
      _segments = [segment, ..._segments.where((row) => row.id != segment.id)];
    notifyListeners();
    return segment;
  }

  Future<CustomerSegmentContract> updateSegment(
    CustomerSegmentContract existing, {
    required String name,
    String? description,
    required Map<String, dynamic> rules,
    ApiRequestOptions? options,
  }) async {
    final captured = _api.captureRequestContext();
    final segment = CustomerSegmentContract.fromJson(
      await _api.customers.segments.update(existing.id, {
        'name': name,
        'description': description,
        'rules': rules,
      }, options: options),
    );
    _checkReadContext(captured, true);
    if (segment.id != existing.id || segment.storeId != existing.storeId) {
      throw const ApiException(
        message: 'Customer segment scope could not be confirmed.',
        statusCode: 502,
        code: 'CUSTOMER_SCOPE_MISMATCH',
      );
    }
    if (_segmentsContext == captured && _segmentsStoreId == existing.storeId) {
      _segments = [segment, ..._segments.where((row) => row.id != segment.id)];
    }
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
    var denial = _beginRead(storeId);
    _customerPage = null;
    final captured = _api.captureRequestContext(),
        generation = ++_customersGeneration;
    _customersContext = captured;
    _customersStoreId = storeId;
    _customers = [];
    _customersNextCursor = null;
    _customersHasMore = false;
    _customersOffline = false;
    try {
      final pageResult = await _api.customers.segments.customers(
        segmentId,
        storeId: storeId,
        page: page,
        limit: limit,
      );
      _checkRead(captured, generation == _customersGeneration, storeId, denial);
      _customers = pageResult.data
          .map((row) => _customer(row, storeId))
          .toList(growable: false);
      _customersHasMore = pageResult.hasMore;
      _customersNextCursor = pageResult.nextCursor;
      _publishPage(captured, storeId, denial, true);
      notifyListeners();
      return _customers;
    } catch (error) {
      _checkRead(captured, generation == _customersGeneration, storeId, denial);
      if (error is ApiException &&
          (error.statusCode == 401 || error.statusCode == 403)) {
        denial = _denyRead(storeId);
      }
      _customers = [];
      _customersHasMore = false;
      _customersNextCursor = null;
      if (!_disposed) notifyListeners();
      rethrow;
    }
  }

  Future<List<CustomerAddressContract>> fetchAddresses(
    String email, {
    String? storeId,
  }) async {
    final denial = _beginRead(storeId), captured = requestContext;
    final key = ('addresses', storeId, email.trim().toLowerCase());
    final generation = (_optionalGenerations[key] ?? 0) + 1;
    _optionalGenerations[key] = generation;
    void check() => _checkRead(
      captured,
      _optionalGenerations[key] == generation,
      storeId,
      denial,
    );
    try {
      final rows = await _api.customers.addresses.list(email, storeId: storeId);
      check();
      for (final row in rows) _checkRelatedRow(row, email, storeId);
      return rows.map(CustomerAddressContract.fromJson).toList(growable: false);
    } catch (error) {
      check();
      if (error is ApiException &&
          (error.statusCode == 401 || error.statusCode == 403))
        _denyRead(storeId);
      rethrow;
    }
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
