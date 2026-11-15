import 'package:letbuyy_models/letbuyy_models.dart' hide JsonMap;
import 'api_client.dart';
import 'security_command_store.dart';

/// Presentation transport and encrypted original intents; the database remains
/// the only metadata/membership authority for manual and smart collections.
class CollectionMetadataService {
  CollectionMetadataService({
    required ApiClient api,
    required String? Function() actorIdProvider,
    required String? Function() storeIdProvider,
    required SecurityCommandStore commands,
  }) : _api = api,
       _actor = actorIdProvider,
       _store = storeIdProvider,
       _commands = commands;
  final ApiClient _api;
  final String? Function() _actor, _store;
  final SecurityCommandStore _commands;
  static const _slot = 'collection-metadata';
  MerchantSecurityContext _context(String store) {
    final actor = _actor();
    if (actor == null || actor.isEmpty || _store() != store)
      throw const ApiException(
        message: 'Reload the selected account and store.',
        statusCode: 409,
        code: 'SESSION_CONTEXT_CHANGED',
      );
    return (
      actorId: actor,
      storeId: store,
      version: _api.captureRequestContext(),
    );
  }

  void _check(MerchantSecurityContext c) {
    if (_actor() != c.actorId ||
        _store() != c.storeId ||
        _api.captureRequestContext() != c.version)
      throw const ApiException(
        message: 'Store access changed. Reopen collections.',
        statusCode: 409,
        code: 'SESSION_CONTEXT_CHANGED',
      );
  }

  ApiRequestOptions _options(MerchantSecurityContext c) => ApiRequestOptions(
    storeId: c.storeId,
    expectedContextVersion: c.version,
    maxRetries: 0,
  );
  Future<T> _work<T>(
    String store,
    Future<T> Function(MerchantSecurityContext) action,
  ) {
    late final MerchantSecurityContext c;
    try {
      c = _context(store);
    } catch (e, s) {
      return Future.error(e, s);
    }
    return _commands.serialized(() async {
      _check(c);
      return action(c);
    });
  }

  Future<SmartCollectionPage> readSmartPage(
    String store, {
    int page = 1,
    String search = '',
  }) async {
    final c = _context(store),
        raw = await _api.products.smartCollectionPage(
          store,
          page: page,
          limit: 20,
          search: search,
          options: _options(c),
        );
    _check(c);
    final result = SmartCollectionPage.fromParts(raw.data, raw.meta);
    if (result.storeId != store || result.page != page || result.limit != 20)
      throw const FormatException('The collection page scope changed.');
    return result;
  }

  Future<CollectionMetadataContract> readManual(String store, String id) async {
    final c = _context(store),
        raw = await _api.products.collectionMetadata(
          store,
          id,
          options: _options(c),
        );
    _check(c);
    final result = CollectionMetadataContract.fromJson(raw);
    if (result.id != id ||
        result.storeId != store ||
        result.kind != 'manual' ||
        result.isDeleted)
      throw const FormatException('The current collection scope changed.');
    return result;
  }

  Future<SmartCollectionContract> readSmart(String store, String id) async {
    final c = _context(store),
        raw = await _api.products.collectionMetadata(
          store,
          id,
          smart: true,
          options: _options(c),
        );
    _check(c);
    final result = SmartCollectionContract.fromJson(raw);
    if (result.id != id || result.storeId != store)
      throw const FormatException('The current collection scope changed.');
    return result;
  }

  Future<SmartCollectionPreview> preview(
    String store,
    String id,
    int version,
  ) async {
    final c = _context(store),
        raw = await _api.products.smartCollectionPreview(
          store,
          id,
          options: _options(c),
        );
    _check(c);
    final result = SmartCollectionPreview.fromJson(raw);
    if (result.collectionId != id ||
        result.storeId != store ||
        result.version != version)
      throw const FormatException(
        'The collection changed. Reload its current version before previewing.',
      );
    return result;
  }

  void _validatePending(MerchantSecurityContext c, PendingSecurityCommand p) {
    final i = p.intent, op = i['operation'], id = i['collection_id'];
    if (i.length != 4 ||
        !const ['create', 'update', 'delete'].contains(op) ||
        (op == 'create') != (id == null) ||
        id != null && !categoryUuid(id) ||
        !const ['pending', 'rejected', 'missing'].contains(i['outcome']) ||
        i['outcome'] == 'missing' && op == 'create')
      throw const FormatException(
        'The saved collection request needs recovery.',
      );
    validateCollectionMetadataCommand(op, {
      ...asJsonMap(i['fields']),
      'store_id': c.storeId,
      'idempotency_key': p.key,
    });
  }

  Future<PendingSecurityCommand?> pending(String store) =>
      _work(store, (c) async {
        final p = await _commands.read(c, _slot, check: () => _check(c));
        if (p != null) _validatePending(c, p);
        return p;
      });
  Future<CollectionMetadataReceipt> save(
    String store,
    String operation,
    JsonMap fields, {
    String? id,
  }) {
    final captured = SecurityCommandStore.captureIntent(fields);
    return _work(store, (c) async {
      if ((operation == 'create') != (id == null) ||
          id != null && !categoryUuid(id))
        throw const FormatException('Choose a valid collection operation.');
      final body =
          Map<String, dynamic>.of(
              validateCollectionMetadataCommand(operation, {
                ...captured,
                'store_id': store,
                'idempotency_key': '00000000-0000-4000-8000-000000000000',
              }),
            )
            ..remove('store_id')
            ..remove('idempotency_key');
      if (await _commands.read(c, _slot, check: () => _check(c)) != null)
        throw const FormatException(
          'Recover the original collection request before another change.',
        );
      final p = await _commands.prepare(c, _slot, {
        'operation': operation,
        'collection_id': id,
        'fields': body,
        'outcome': 'pending',
      }, check: () => _check(c));
      return _send(c, p, firstAttempt: true);
    });
  }

  Future<CollectionMetadataReceipt> retry(String store) =>
      _work(store, (c) async {
        final p = await _commands.read(c, _slot, check: () => _check(c));
        if (p == null)
          throw const FormatException(
            'No original collection request is retained.',
          );
        return _send(c, p);
      });

  /// Called only after explicit discard confirmation. Always reconcile the
  /// original command under current authority before releasing its local key.
  /// A transport404, outage, revoked access or changed context keeps it intact.
  Future<CollectionMetadataReceipt?> discardMissing(
    String store,
  ) => _work(store, (c) async {
    final p = await _commands.read(c, _slot, check: () => _check(c));
    if (p == null || p.intent['outcome'] != 'missing')
      throw const FormatException(
        'Retry the original request to confirm the collection is missing first.',
      );
    _validatePending(c, p);
    try {
      return await _send(c, p);
    } on ApiException catch (e) {
      _check(c);
      if (e.statusCode != 404 || e.code != 'COLLECTION_NOT_FOUND') rethrow;
      await _commands.complete(c, p, check: () => _check(c));
      return null;
    }
  });
  Future<(CollectionMetadataContract?, SmartCollectionContract?)> review(
    String store,
  ) => _work(store, (c) async {
    final p = await _commands.read(c, _slot, check: () => _check(c));
    if (p == null || p.intent['outcome'] != 'rejected')
      throw const FormatException(
        'An unconfirmed collection request cannot be discarded. Retry its original details.',
      );
    _validatePending(c, p);
    CollectionMetadataContract? manual;
    SmartCollectionContract? smart;
    final id = p.intent['collection_id'],
        fields = asJsonMap(p.intent['fields']);
    if (id != null) {
      if (fields['collection_type'] == 'smart') {
        smart = await readSmart(store, id);
      } else {
        manual = await readManual(store, id);
      }
    }
    _check(c);
    await _commands.complete(c, p, check: () => _check(c));
    return (manual, smart);
  });
  Future<CollectionMetadataReceipt> _send(
    MerchantSecurityContext c,
    PendingSecurityCommand p, {
    bool firstAttempt = false,
  }) async {
    _validatePending(c, p);
    final operation = p.intent['operation'] as String,
        id = p.intent['collection_id'] as String?;
    final body = validateCollectionMetadataCommand(operation, {
      ...asJsonMap(p.intent['fields']),
      'store_id': c.storeId,
      'idempotency_key': p.key,
    });
    try {
      final raw = await _api.products.collectionMetadataCommand(
        operation,
        id,
        body,
        options: _options(c),
      );
      _check(c);
      final receipt = CollectionMetadataReceipt.confirm(
        raw,
        actorId: c.actorId,
        operation: operation,
        id: id,
        command: body,
      );
      await _commands.complete(c, p, check: () => _check(c));
      return receipt;
    } on ApiException catch (e) {
      _check(c);
      if (operation != 'create' &&
          e.statusCode == 404 &&
          e.code == 'COLLECTION_NOT_FOUND') {
        await _commands.replaceIntent(c, p, {
          ...p.intent,
          'outcome': 'missing',
        }, check: () => _check(c));
      } else if (e.statusCode == 409 &&
              const [
                'COLLECTION_VERSION_CONFLICT',
                'COLLECTION_SLUG_CONFLICT',
              ].contains(e.code) ||
          firstAttempt && e.statusCode == 400 && e.code == 'VALIDATION_ERROR') {
        await _commands.replaceIntent(c, p, {
          ...p.intent,
          'outcome': 'rejected',
        }, check: () => _check(c));
      }
      rethrow;
    }
  }
}
