import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';

import 'api_client.dart';

typedef _KycOperation = ({
  int version,
  String storeId,
  Object? context,
  ApiRequestOptions options,
});

class KycService extends ChangeNotifier {
  KycService({required ApiClient api}) : _api = api;

  final ApiClient _api;
  bool _isLoading = false;
  bool _disposed = false;
  bool _contextBound = false;
  Object? _boundContext;
  String? _boundStoreId;
  int _operationVersion = 0;
  Map<String, dynamic>? _overview;
  final Map<String, String> _refreshRetryKeys = {};

  // The SDK owns this opaque account/store snapshot. It is not a credential.
  Object? captureRequestContext() => _api.captureRequestContext();

  void _synchronizeContext() {
    final current = captureRequestContext();
    if (!_contextBound || current != _boundContext) {
      _contextBound = true;
      _boundContext = current;
      _boundStoreId = null;
      _overview = null;
      _refreshRetryKeys.clear();
      _isLoading = false;
      _operationVersion++;
    }
  }

  bool get isLoading {
    _synchronizeContext();
    return _isLoading;
  }

  Map<String, dynamic>? get overview {
    // Also applies when the screen has closed and no UI listener is mounted.
    _synchronizeContext();
    return _overview == null ? null : Map.unmodifiable(_overview!);
  }

  List<Map<String, dynamic>> get documents =>
      _listOfMaps(overview?['documents']);

  static ApiException _contextChanged() => const ApiException(
    message: 'Verification context changed. Reload details.',
    statusCode: 409,
    code: 'SESSION_CONTEXT_CHANGED',
  );

  static ApiException _scopeMismatch() => const ApiException(
    message:
        'Verification details did not match the selected store. Reload details.',
    statusCode: 503,
    code: 'KYC_SCOPE_MISMATCH',
  );

  _KycOperation _begin(String storeId, ApiRequestOptions? options) {
    if (_disposed) throw _contextChanged();
    _synchronizeContext();
    final captured = options?.expectedContextVersion ?? captureRequestContext();
    if (captured != captureRequestContext()) throw _contextChanged();
    if (options?.storeId != null && options!.storeId != storeId)
      throw _scopeMismatch();
    if (_boundStoreId != storeId) _overview = null;
    _boundStoreId = storeId;
    _isLoading = true;
    final operation = (
      version: ++_operationVersion,
      storeId: storeId,
      context: captured,
      options: (options ?? const ApiRequestOptions()).copyWith(
        storeId: storeId,
        expectedContextVersion: captured,
      ),
    );
    notifyListeners();
    return operation;
  }

  bool _isCurrent(_KycOperation operation) {
    _synchronizeContext();
    return !_disposed &&
        operation.version == _operationVersion &&
        operation.context == captureRequestContext() &&
        operation.storeId == _boundStoreId;
  }

  void _requireCurrent(_KycOperation operation) {
    if (!_isCurrent(operation)) throw _contextChanged();
  }

  void _acceptOverview(Map value, _KycOperation operation) {
    _requireCurrent(operation);
    if (value['site_id'] != operation.storeId) {
      _overview = null;
      throw _scopeMismatch();
    }
    _overview = Map<String, dynamic>.from(value);
  }

  void _finish(_KycOperation operation) {
    if (_isCurrent(operation)) {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> _readOverview(_KycOperation operation) async {
    _requireCurrent(operation);
    final response = await _api.kyc.overview(
      query: {'store_id': operation.storeId},
      options: operation.options,
    );
    _acceptOverview(response, operation);
    return response;
  }

  Future<Map<String, dynamic>> fetchOverview(
    String storeId, {
    ApiRequestOptions? options,
  }) async {
    final operation = _begin(storeId, options);
    _overview = null;
    try {
      return await _readOverview(operation);
    } finally {
      _finish(operation);
    }
  }

  Future<void> _acceptMutation(
    Map<String, dynamic> response,
    _KycOperation operation,
  ) async {
    _requireCurrent(operation);
    final document = response['document'];
    if ((response['site_id'] != null &&
            response['site_id'] != operation.storeId) ||
        (document is Map &&
            document['site_id'] != null &&
            document['site_id'] != operation.storeId)) {
      _overview = null;
      throw _scopeMismatch();
    }
    final value = response['overview'];
    if (value is Map) {
      _acceptOverview(value, operation);
    } else {
      // A missing overview does not authorize a read under a newer account.
      await _readOverview(operation);
    }
  }

  Future<Map<String, dynamic>> submitDocument({
    required String storeId,
    required String documentType,
    String? documentNumberLast4,
    String? fileUrl,
    String? fileName,
    ApiRequestOptions? options,
  }) async {
    if ((fileUrl != null && fileUrl.isNotEmpty) ||
        (fileName != null && fileName.isNotEmpty)) {
      throw const ApiException(
        message:
            'Private document upload is unavailable. Do not use public media links.',
        statusCode: 503,
        code: 'KYC_PRIVATE_UPLOAD_UNAVAILABLE',
      );
    }
    final operation = _begin(storeId, options);
    try {
      final response = await _api.kyc.submitDocument({
        'store_id': storeId,
        'document_type': documentType,
        if (documentNumberLast4 != null && documentNumberLast4.isNotEmpty)
          'document_number_last4': documentNumberLast4,
        'idempotency_key':
            'mobile-kyc-$storeId-$documentType-${DateTime.now().microsecondsSinceEpoch}',
      }, options: operation.options);
      await _acceptMutation(response, operation);
      return response;
    } finally {
      _finish(operation);
    }
  }

  Future<Map<String, dynamic>> uploadDocument({
    required String storeId,
    required String documentType,
    required String documentNumberLast4,
    required File file,
    ApiRequestOptions? options,
  }) async {
    final operation = _begin(storeId, options);
    try {
      final response = await _api.kyc.uploadDocument(
        storeId: storeId,
        documentType: documentType,
        documentNumberLast4: documentNumberLast4,
        file: file,
        options: operation.options,
      );
      await _acceptMutation(response, operation);
      return response;
    } finally {
      _finish(operation);
    }
  }

  Future<Map<String, dynamic>> refreshDocument(
    String documentId,
    String storeId, {
    ApiRequestOptions? options,
  }) async {
    final current = documents.where((row) => row['id'] == documentId);
    final revision = current.isEmpty ? '' : (current.first['updated_at'] ?? '');
    final operationKey = '$storeId:$documentId:$revision';
    final retryKey =
        _refreshRetryKeys.putIfAbsent(operationKey, () => const Uuid().v4());
    final operation = _begin(storeId, options);
    try {
      final response = await _api.kyc.refreshDocument(
        documentId,
        storeId,
        options: operation.options.copyWith(idempotencyKey: retryKey),
      );
      await _acceptMutation(response, operation);
      _refreshRetryKeys.remove(operationKey);
      return response;
    } finally {
      _finish(operation);
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _overview = null;
    _isLoading = false;
    _operationVersion++;
    super.dispose();
  }

  static List<Map<String, dynamic>> _listOfMaps(Object? value) {
    if (value is! List) return const [];
    return value
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList(growable: false);
  }
}
