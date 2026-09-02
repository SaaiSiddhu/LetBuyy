import 'dart:async';
import 'dart:convert';

import 'package:quickcommerce_domain/quickcommerce_domain.dart';
import 'package:drift/drift.dart';

enum PendingMutationStatus { pending, inFlight, succeeded, failed, expired }

final class CacheRecord {
  const CacheRecord({
    required this.key,
    required this.namespace,
    required this.payload,
    required this.updatedAt,
    this.expiresAt,
  });

  final String key;
  final String namespace;
  final Map<String, Object?> payload;
  final DateTime updatedAt;
  final DateTime? expiresAt;

  bool get isExpired {
    final expiry = expiresAt;
    return expiry != null && DateTime.now().isAfter(expiry);
  }
}

final class PendingMutation {
  const PendingMutation({
    required this.id,
    required this.feature,
    required this.operation,
    required this.payload,
    required this.idempotencyKey,
    required this.traceId,
    required this.createdAt,
    required this.expiresAt,
    required this.attemptCount,
    required this.status,
    this.lastError,
  });

  final String id;
  final String feature;
  final String operation;
  final Map<String, Object?> payload;
  final IdempotencyKey idempotencyKey;
  final TraceId traceId;
  final DateTime createdAt;
  final DateTime expiresAt;
  final int attemptCount;
  final PendingMutationStatus status;
  final String? lastError;

  PendingMutation markInFlight() => copyWith(
        status: PendingMutationStatus.inFlight,
        attemptCount: attemptCount + 1,
      );

  PendingMutation markFailed(String error) => copyWith(
        status: PendingMutationStatus.failed,
        lastError: error,
      );

  PendingMutation markSucceeded() =>
      copyWith(status: PendingMutationStatus.succeeded);

  PendingMutation copyWith({
    int? attemptCount,
    PendingMutationStatus? status,
    String? lastError,
  }) {
    return PendingMutation(
      id: id,
      feature: feature,
      operation: operation,
      payload: payload,
      idempotencyKey: idempotencyKey,
      traceId: traceId,
      createdAt: createdAt,
      expiresAt: expiresAt,
      attemptCount: attemptCount ?? this.attemptCount,
      status: status ?? this.status,
      lastError: lastError ?? this.lastError,
    );
  }
}

abstract interface class OfflineStore {
  Future<void> initialize();
  Future<void> put(CacheRecord record);
  Future<CacheRecord?> get(String namespace, String key);
  Future<void> remove(String namespace, String key);
  Future<void> enqueue(PendingMutation mutation);
  Future<List<PendingMutation>> pendingMutations({int limit = 50});
  Future<void> updateMutation(PendingMutation mutation);
  Stream<List<PendingMutation>> watchPendingMutations();
}

final class InMemoryOfflineStore implements OfflineStore {
  final Map<String, CacheRecord> _records = {};
  final Map<String, PendingMutation> _mutations = {};
  final StreamController<List<PendingMutation>> _mutationController =
      StreamController<List<PendingMutation>>.broadcast();

  @override
  Future<void> initialize() async {}

  @override
  Future<void> put(CacheRecord record) async {
    _records[_cacheKey(record.namespace, record.key)] = record;
  }

  @override
  Future<CacheRecord?> get(String namespace, String key) async {
    final record = _records[_cacheKey(namespace, key)];
    if (record == null || record.isExpired) {
      return null;
    }
    return record;
  }

  @override
  Future<void> remove(String namespace, String key) async {
    _records.remove(_cacheKey(namespace, key));
  }

  @override
  Future<void> enqueue(PendingMutation mutation) async {
    _mutations[mutation.id] = mutation;
    _emitMutations();
  }

  @override
  Future<List<PendingMutation>> pendingMutations({int limit = 50}) async {
    final now = DateTime.now();
    return _mutations.values
        .where((mutation) =>
            mutation.status == PendingMutationStatus.pending &&
            mutation.expiresAt.isAfter(now))
        .take(limit)
        .toList(growable: false);
  }

  @override
  Future<void> updateMutation(PendingMutation mutation) async {
    _mutations[mutation.id] = mutation;
    _emitMutations();
  }

  @override
  Stream<List<PendingMutation>> watchPendingMutations() {
    return _mutationController.stream;
  }

  void _emitMutations() {
    _mutationController.add(List.unmodifiable(_mutations.values));
  }
}

final class DriftOfflineStore implements OfflineStore {
  DriftOfflineStore(QueryExecutor executor)
      : _database = _QuickcommerceRawDriftDatabase(executor);

  final _QuickcommerceRawDriftDatabase _database;
  final StreamController<List<PendingMutation>> _mutationController =
      StreamController<List<PendingMutation>>.broadcast();

  @override
  Future<void> initialize() async {
    await _database.customStatement('''
      CREATE TABLE IF NOT EXISTS cached_records (
        namespace TEXT NOT NULL,
        cache_key TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        expires_at TEXT,
        PRIMARY KEY (namespace, cache_key)
      )
    ''');
    await _database.customStatement('''
      CREATE TABLE IF NOT EXISTS pending_mutations (
        id TEXT PRIMARY KEY,
        feature TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        trace_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        attempt_count INTEGER NOT NULL,
        status TEXT NOT NULL,
        last_error TEXT
      )
    ''');
  }

  @override
  Future<void> put(CacheRecord record) async {
    await _database.customInsert(
      '''
      INSERT INTO cached_records
        (namespace, cache_key, payload_json, updated_at, expires_at)
      VALUES
        (?1, ?2, ?3, ?4, ?5)
      ON CONFLICT(namespace, cache_key) DO UPDATE SET
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at,
        expires_at = excluded.expires_at
      ''',
      variables: [
        Variable.withString(record.namespace),
        Variable.withString(record.key),
        Variable.withString(jsonEncode(record.payload)),
        Variable.withString(record.updatedAt.toUtc().toIso8601String()),
        Variable<String>(record.expiresAt?.toUtc().toIso8601String()),
      ],
    );
  }

  @override
  Future<CacheRecord?> get(String namespace, String key) async {
    final rows = await _database.customSelect(
      '''
          SELECT namespace, cache_key, payload_json, updated_at, expires_at
          FROM cached_records
          WHERE namespace = ?1 AND cache_key = ?2
          LIMIT 1
          ''',
      variables: [Variable.withString(namespace), Variable.withString(key)],
    ).get();
    if (rows.isEmpty) {
      return null;
    }
    final record = _recordFromRow(rows.single);
    if (record.isExpired) {
      await remove(namespace, key);
      return null;
    }
    return record;
  }

  @override
  Future<void> remove(String namespace, String key) async {
    await _database.customStatement(
      'DELETE FROM cached_records WHERE namespace = ?1 AND cache_key = ?2',
      [namespace, key],
    );
  }

  @override
  Future<void> enqueue(PendingMutation mutation) async {
    await _upsertMutation(mutation);
    await _emitMutations();
  }

  @override
  Future<List<PendingMutation>> pendingMutations({int limit = 50}) async {
    final rows = await _database.customSelect(
      '''
          SELECT *
          FROM pending_mutations
          WHERE status = ?1 AND expires_at > ?2
          ORDER BY created_at ASC
          LIMIT ?3
          ''',
      variables: [
        Variable.withString(PendingMutationStatus.pending.name),
        Variable.withString(DateTime.now().toUtc().toIso8601String()),
        Variable.withInt(limit),
      ],
    ).get();
    return rows.map(_mutationFromRow).toList(growable: false);
  }

  @override
  Future<void> updateMutation(PendingMutation mutation) async {
    await _upsertMutation(mutation);
    await _emitMutations();
  }

  @override
  Stream<List<PendingMutation>> watchPendingMutations() {
    return _mutationController.stream;
  }

  Future<void> _upsertMutation(PendingMutation mutation) async {
    await _database.customInsert(
      '''
      INSERT INTO pending_mutations
        (id, feature, operation, payload_json, idempotency_key, trace_id,
         created_at, expires_at, attempt_count, status, last_error)
      VALUES
        (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
      ON CONFLICT(id) DO UPDATE SET
        payload_json = excluded.payload_json,
        attempt_count = excluded.attempt_count,
        status = excluded.status,
        last_error = excluded.last_error
      ''',
      variables: [
        Variable.withString(mutation.id),
        Variable.withString(mutation.feature),
        Variable.withString(mutation.operation),
        Variable.withString(jsonEncode(mutation.payload)),
        Variable.withString(mutation.idempotencyKey.value),
        Variable.withString(mutation.traceId.value),
        Variable.withString(mutation.createdAt.toUtc().toIso8601String()),
        Variable.withString(mutation.expiresAt.toUtc().toIso8601String()),
        Variable.withInt(mutation.attemptCount),
        Variable.withString(mutation.status.name),
        Variable<String>(mutation.lastError),
      ],
    );
  }

  Future<void> _emitMutations() async {
    final rows =
        await _database.customSelect('SELECT * FROM pending_mutations').get();
    _mutationController.add(rows.map(_mutationFromRow).toList(growable: false));
  }
}

final class _QuickcommerceRawDriftDatabase extends GeneratedDatabase {
  _QuickcommerceRawDriftDatabase(super.executor);

  @override
  Iterable<TableInfo<Table, Object?>> get allTables => const [];

  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => const [];

  @override
  int get schemaVersion => 1;
}

CacheRecord _recordFromRow(QueryRow row) {
  return CacheRecord(
    namespace: row.read<String>('namespace'),
    key: row.read<String>('cache_key'),
    payload: (jsonDecode(row.read<String>('payload_json')) as Map)
        .cast<String, Object?>(),
    updatedAt: DateTime.parse(row.read<String>('updated_at')),
    expiresAt: row.readNullable<String>('expires_at') == null
        ? null
        : DateTime.parse(row.read<String>('expires_at')),
  );
}

PendingMutation _mutationFromRow(QueryRow row) {
  return PendingMutation(
    id: row.read<String>('id'),
    feature: row.read<String>('feature'),
    operation: row.read<String>('operation'),
    payload: (jsonDecode(row.read<String>('payload_json')) as Map)
        .cast<String, Object?>(),
    idempotencyKey: IdempotencyKey(row.read<String>('idempotency_key')),
    traceId: TraceId(row.read<String>('trace_id')),
    createdAt: DateTime.parse(row.read<String>('created_at')),
    expiresAt: DateTime.parse(row.read<String>('expires_at')),
    attemptCount: row.read<int>('attempt_count'),
    status: PendingMutationStatus.values.byName(row.read<String>('status')),
    lastError: row.readNullable<String>('last_error'),
  );
}

String _cacheKey(String namespace, String key) => '$namespace:$key';
