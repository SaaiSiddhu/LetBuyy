import 'dart:io';
import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';

import 'api_client.dart';
import 'security_command_store.dart';

typedef _KycOperation = ({
  int version,
  String storeId,
  Object? context,
  ApiRequestOptions options,
});

typedef IndiaKycUploadPoster =
    Future<String> Function(
      Uri url,
      Map<String, String> fields,
      Uint8List bytes,
      String filename,
    );

Future<String> _postIndiaKycObject(
  Uri url,
  Map<String, String> fields,
  Uint8List bytes,
  String filename,
) async {
  // A fresh client has no merchant token, cookies, or Gateway interceptors.
  final client = http.Client();
  try {
    final request = http.MultipartRequest('POST', url)
      ..followRedirects = false
      ..fields.addAll(fields)
      ..files.add(
        http.MultipartFile.fromBytes('file', bytes, filename: filename),
      );
    final response = await client
        .send(request)
        .timeout(const Duration(seconds: 30));
    final version = response.headers['x-amz-version-id'];
    await response.stream.drain<void>();
    if (response.statusCode != 201 ||
        version == null ||
        version.isEmpty ||
        version == 'null') {
      throw const ApiException(
        message: 'Private storage did not return a versioned upload.',
        statusCode: 503,
        code: 'KYC_INDIA_OBJECT_UNCONFIRMED',
      );
    }
    return version;
  } finally {
    client.close();
  }
}

String _imageContentType(Uint8List bytes) {
  if (bytes.length >= 8 &&
      bytes[0] == 0x89 &&
      bytes[1] == 0x50 &&
      bytes[2] == 0x4e &&
      bytes[3] == 0x47 &&
      bytes[4] == 0x0d &&
      bytes[5] == 0x0a &&
      bytes[6] == 0x1a &&
      bytes[7] == 0x0a)
    return 'image/png';
  if (bytes.length >= 3 &&
      bytes[0] == 0xff &&
      bytes[1] == 0xd8 &&
      bytes[2] == 0xff) {
    return 'image/jpeg';
  }
  throw const ApiException(
    message: 'Choose a JPEG or PNG document photo.',
    statusCode: 422,
    code: 'KYC_FILE_TYPE_INVALID',
  );
}

({Uri url, Map<String, String> fields, String receiptId}) _indiaTicket(
  Map<String, dynamic> ticket,
  String storeId,
  String documentType,
  int bytes,
) {
  final receiptId = ticket['receipt_id'];
  final rawUrl = ticket['url'];
  final rawFields = ticket['fields'];
  final maximum = ticket['maximum_object_bytes'];
  final expiry = DateTime.tryParse(ticket['expires_at']?.toString() ?? '');
  if (ticket['method'] != 'POST' ||
      receiptId is! String ||
      !RegExp(r'^[a-f0-9-]{36}$', caseSensitive: false).hasMatch(receiptId) ||
      rawUrl is! String ||
      rawFields is! Map ||
      maximum is! num ||
      bytes > maximum ||
      expiry == null ||
      !expiry.isAfter(DateTime.now())) {
    throw const ApiException(
      message: 'Upload ticket is invalid or expired.',
      statusCode: 503,
      code: 'KYC_INDIA_TICKET_INVALID',
    );
  }
  final url = Uri.tryParse(rawUrl);
  if (url == null ||
      url.scheme != 'https' ||
      url.userInfo.isNotEmpty ||
      url.hasPort ||
      url.path != '/' ||
      url.hasQuery ||
      url.hasFragment ||
      !RegExp(
        r'^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\.s3\.ap-south-1\.amazonaws\.com$',
      ).hasMatch(url.host)) {
    throw const ApiException(
      message: 'Upload destination is invalid.',
      statusCode: 503,
      code: 'KYC_INDIA_DESTINATION_INVALID',
    );
  }
  final fields = <String, String>{};
  for (final entry in rawFields.entries) {
    if (entry.key is! String || entry.value is! String) {
      throw const ApiException(
        message: 'Upload ticket fields are invalid.',
        statusCode: 503,
        code: 'KYC_INDIA_TICKET_INVALID',
      );
    }
    fields[entry.key as String] = entry.value as String;
  }
  if (fields['key'] != 'kyc/$storeId/$documentType/$receiptId') {
    throw const ApiException(
      message: 'Upload ticket does not match this store.',
      statusCode: 503,
      code: 'KYC_INDIA_TICKET_SCOPE_MISMATCH',
    );
  }
  return (url: url, fields: fields, receiptId: receiptId);
}

class KycService extends ChangeNotifier {
  KycService({
    required ApiClient api,
    IndiaKycUploadPoster? postIndiaObject,
    String? Function()? actorIdProvider,
    String? Function()? storeIdProvider,
    SecurityCommandStore? commands,
  }) : _api = api,
       _postIndiaObject = postIndiaObject ?? _postIndiaKycObject,
       _actorIdProvider = actorIdProvider,
       _storeIdProvider = storeIdProvider,
       _commands = commands ?? SecurityCommandStore();

  final ApiClient _api;
  final String? Function()? _actorIdProvider, _storeIdProvider;
  final SecurityCommandStore _commands;
  static const _uploadCommand = 'kyc-upload';
  PendingSecurityCommand? _pendingUpload;

  bool get hasPendingUpload {
    _synchronizeContext();
    if (_pendingUpload != null &&
        (_pendingUpload!.actor != _actorIdProvider?.call() ||
            _pendingUpload!.store != _storeIdProvider?.call()))
      _pendingUpload = null;
    return _pendingUpload != null;
  }

  bool get canResumeUpload =>
      hasPendingUpload && _pendingUpload!.intent['stage'] == 'complete';
  bool get canRetryUpload =>
      hasPendingUpload && _pendingUpload!.intent['stage'] == 'intent';
  String? get uploadRecoveryMessage {
    if (!hasPendingUpload) return null;
    return switch (_pendingUpload!.intent['stage']) {
      'complete' =>
        'Your photo reached storage. Resume confirmation without uploading it again.',
      'object_pending' =>
        'Storage may have received your photo, but its receipt was interrupted. The upload needs review before another photo can be sent.',
      _ =>
        'An interrupted upload is saved. Choose the same photo, document type and reference to resume it.',
    };
  }

  MerchantSecurityContext _uploadContext(_KycOperation operation) {
    final actor = _actorIdProvider?.call(), store = _storeIdProvider?.call();
    if (actor == null ||
        actor.trim().isEmpty ||
        store == null ||
        store != operation.storeId) {
      throw _contextChanged();
    }
    return (actorId: actor, storeId: store, version: operation.context);
  }

  void _checkUpload(_KycOperation operation, MerchantSecurityContext c) {
    _requireCurrent(operation);
    if (_actorIdProvider?.call() != c.actorId ||
        _storeIdProvider?.call() != c.storeId)
      throw _contextChanged();
  }

  Future<void> _loadPending(_KycOperation operation) async {
    if (_actorIdProvider == null || _storeIdProvider == null) return;
    final c = _uploadContext(operation);
    _pendingUpload = await _commands.serialized(
      () => _commands.read(
        c,
        _uploadCommand,
        check: () => _checkUpload(operation, c),
      ),
    );
    _checkUpload(operation, c);
  }

  static ApiException _heldUpload() => const ApiException(
    message:
        'The storage receipt is unconfirmed. This upload needs review before another photo can be sent.',
    statusCode: 409,
    code: 'KYC_UPLOAD_NEEDS_REVIEW',
  );
  final IndiaKycUploadPoster _postIndiaObject;
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
      _pendingUpload = null;
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
      final result = await _readOverview(operation);
      await _loadPending(operation);
      return result;
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
      _requireUploadAvailable();
      final c = _uploadContext(operation);
      // Capture the account before queuing; a newer account cannot inherit work.
      return await _commands.serialized(() async {
        void check() => _checkUpload(operation, c);
        check();
        final bytes = await file.readAsBytes();
        check();
        if (bytes.isEmpty || bytes.length > 5 * 1024 * 1024) {
          throw const ApiException(
            message: 'Choose a document photo under 5 MB.',
            statusCode: 413,
            code: 'KYC_FILE_TOO_LARGE',
          );
        }
        final contentType = _imageContentType(bytes);
        final input = <String, dynamic>{
          'store_id': storeId,
          'document_type': documentType,
          'document_number_last4': documentNumberLast4,
          'content_type': contentType,
          'byte_size': bytes.length,
          'sha256_hex': sha256.convert(bytes).toString(),
        };
        var pending = await _commands.read(c, _uploadCommand, check: check);
        if (pending != null) {
          // Compare only immutable input; progress retains the original key.
          if (jsonEncode(SecurityCommandStore.captureIntent(input)) !=
              jsonEncode(
                SecurityCommandStore.captureIntent(
                  asJsonMap(pending.intent['input']),
                ),
              )) {
            throw const ApiException(
              message:
                  'Recover the original photo and reference before changing this upload.',
              statusCode: 409,
              code: 'PENDING_SECURITY_COMMAND',
            );
          }
        } else {
          pending = await _commands.prepare(c, _uploadCommand, {
            'input': input,
            'transport': _overview?['india_direct_upload_available'] == true
                ? 'india'
                : 'private',
            'stage': 'intent',
          }, check: check);
        }
        _pendingUpload = pending;
        final requestOptions = operation.options.copyWith(
          idempotencyKey: pending.key,
          maxRetries: 0,
        );
        if (pending.intent['transport'] == 'india') {
          if (_overview?['india_direct_upload_available'] != true)
            throw _heldUpload();
          if (pending.intent['stage'] == 'object_pending') throw _heldUpload();
          if (pending.intent['stage'] == 'complete') {
            return _completeIndia(operation, c, pending);
          }
          final intent = await _api.kyc.indiaUploadIntent(
            input,
            options: requestOptions,
          );
          check();
          final ticket = _indiaTicket(
            intent,
            storeId,
            documentType,
            bytes.length,
          );
          // Persist BEFORE sending bytes. Unknown storage acknowledgement must
          // never turn into another POST after a crash or account transition.
          pending = await _commands.replaceIntent(c, pending, {
            ...pending.intent,
            'stage': 'object_pending',
            'receipt_id': ticket.receiptId,
          }, check: check);
          _pendingUpload = pending;
          final version = await _postIndiaObject(
            ticket.url,
            ticket.fields,
            bytes,
            file.uri.pathSegments.last,
          );
          check();
          if (version.isEmpty ||
              version == 'null' ||
              version.length > 1024 ||
              RegExp(r'[\x00-\x1f\x7f]').hasMatch(version))
            throw _heldUpload();
          pending = await _commands.replaceIntent(c, pending, {
            ...pending.intent,
            'stage': 'complete',
            'version_id': version,
          }, check: check);
          _pendingUpload = pending;
          return _completeIndia(operation, c, pending);
        }
        if (pending.intent['transport'] != 'private' ||
            _overview?['private_upload_available'] != true) {
          throw _heldUpload();
        }
        final response = await _api.kyc.uploadDocument(
          storeId: storeId,
          documentType: documentType,
          documentNumberLast4: documentNumberLast4,
          file: file,
          options: requestOptions,
        );
        await _acceptMutation(response, operation);
        await _commands.complete(c, pending, check: check);
        _pendingUpload = null;
        return response;
      });
    } finally {
      _finish(operation);
    }
  }

  void _requireUploadAvailable() {
    if (_overview?['india_direct_upload_available'] != true &&
        _overview?['private_upload_available'] != true) {
      throw const ApiException(
        message:
            'Private India upload is unavailable. Refresh status and retry.',
        statusCode: 503,
        code: 'KYC_UPLOAD_UNAVAILABLE',
      );
    }
  }

  Future<Map<String, dynamic>> _completeIndia(
    _KycOperation operation,
    MerchantSecurityContext c,
    PendingSecurityCommand pending,
  ) async {
    void check() => _checkUpload(operation, c);
    check();
    final receipt = pending.intent['receipt_id'],
        version = pending.intent['version_id'];
    if (receipt is! String ||
        version is! String ||
        receipt.isEmpty ||
        version.isEmpty)
      throw _heldUpload();
    final response = await _api.kyc.indiaUploadComplete(
      {'store_id': c.storeId, 'receipt_id': receipt, 'version_id': version},
      options: operation.options.copyWith(
        idempotencyKey: pending.key,
        maxRetries: 0,
      ),
    );
    check();
    if (response['receipt_id'] != receipt ||
        response['document_status'] is! String) {
      throw const ApiException(
        message:
            'Document confirmation could not be verified. Resume the saved confirmation.',
        statusCode: 503,
        code: 'KYC_UPLOAD_CONFIRMATION_INVALID',
      );
    }
    await _acceptMutation(response, operation);
    await _commands.complete(c, pending, check: check);
    _pendingUpload = null;
    return response;
  }

  /// Known object version can be confirmed after restart without retaining or
  /// selecting the photo. Server permission/receipt checks remain authoritative.
  Future<Map<String, dynamic>> resumeUpload(
    String storeId, {
    ApiRequestOptions? options,
  }) async {
    final operation = _begin(storeId, options);
    try {
      _requireUploadAvailable();
      final c = _uploadContext(operation);
      return await _commands.serialized(() async {
        final pending = await _commands.read(
          c,
          _uploadCommand,
          check: () => _checkUpload(operation, c),
        );
        if (pending == null ||
            pending.intent['transport'] != 'india' ||
            pending.intent['stage'] != 'complete' ||
            _overview?['india_direct_upload_available'] != true)
          throw _heldUpload();
        _pendingUpload = pending;
        return _completeIndia(operation, c, pending);
      });
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
    final retryKey = _refreshRetryKeys.putIfAbsent(
      operationKey,
      () => const Uuid().v4(),
    );
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
