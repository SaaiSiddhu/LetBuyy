// Mirror of packages/shared-types/src/product-import.ts. No raw CSV or row plans.
const productImportContractVersion = 2;
const productImportMaxRows = 500;
const productImportMaxBytes = 1048576;
const productImportErrorCodes = {
  'PRODUCT_IMPORT_ROW_FAILED',
  'PRODUCT_LIMIT_REACHED',
  'ENTITLEMENT_AUTHORITY_UNAVAILABLE',
  'PRODUCT_IMPORT_ACCESS_CHANGED',
  'PRODUCT_IMPORT_LEASE_EXPIRED',
  'PRODUCT_IMPORT_SOURCE_CONFLICT',
  'PRODUCT_IMPORT_STOPPED',
};
bool _id(Object? v) =>
    v is String &&
    RegExp(
      r'^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$',
    ).hasMatch(v);
Never _bad() => throw const FormatException(
  'The import identity or progress could not be confirmed.',
);
Map<String, dynamic> _object(Object? v) {
  if (v is! Map || v.keys.any((k) => k is! String)) _bad();
  return Map<String, dynamic>.from(v);
}

void _keys(Map<String, dynamic> v, List<String> keys) {
  if (v.length != keys.length || !keys.every(v.containsKey)) _bad();
}

int _count(Object? v, {int min = 0, int max = 500}) {
  if (v is! num || !v.isFinite || v != v.roundToDouble() || v < min || v > max)
    _bad();
  return v.toInt();
}

void _date(Object? v, {bool nullable = false}) {
  if (v == null && nullable) return;
  if (v is! String ||
      !RegExp(r'^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$').hasMatch(v) ||
      DateTime.tryParse(v) == null)
    _bad();
}

void _error(Object? v) {
  if (v != null && !productImportErrorCodes.contains(v)) _bad();
}

class ProductImportCapabilities {
  ProductImportCapabilities._(this.storeId, this.actorId);
  final String storeId, actorId;
  factory ProductImportCapabilities.fromJson(Map<String, dynamic> v) {
    _keys(v, [
      'store_id',
      'actor_id',
      'contract_version',
      'max_rows',
      'max_bytes',
      'durable_registration',
      'durable_rows',
      'async_recovery',
    ]);
    if (!_id(v['store_id']) ||
        !_id(v['actor_id']) ||
        v['contract_version'] != 2 ||
        v['max_rows'] != 500 ||
        v['max_bytes'] != 1048576 ||
        v['durable_registration'] != true ||
        v['durable_rows'] != true ||
        v['async_recovery'] != true)
      _bad();
    return ProductImportCapabilities._(v['store_id'], v['actor_id']);
  }
}

class ProductImportJob {
  ProductImportJob._(this.json);
  final Map<String, dynamic> json;
  String get id => json['id'];
  String get storeId => json['store_id'];
  String get actorId => json['actor_id'];
  String get key => json['idempotency_key'];
  String get sourceSha256 => json['source_sha256'];
  String get status => json['status'];
  int get totalRows => json['total_rows'];
  int get committedRows => json['row_count'];
  int get failedRows => json['failed_rows'];
  int get pendingRows => json['pending_rows'];
  int get stoppedRows => json['stopped_rows'];
  bool get resumable => json['resumable'];
  String? get errorCode => json['error_code'];
  DateTime get createdAt => DateTime.parse(json['created_at']);
  factory ProductImportJob.fromJson(Map<String, dynamic> v) {
    _keys(v, [
      'id',
      'type',
      'contract_version',
      'store_id',
      'actor_id',
      'idempotency_key',
      'source_sha256',
      'status',
      'total_rows',
      'row_count',
      'failed_rows',
      'pending_rows',
      'stopped_rows',
      'resumable',
      'error_code',
      'created_at',
      'updated_at',
      'started_at',
      'completed_at',
      'download_url',
    ]);
    if (![
          'id',
          'store_id',
          'actor_id',
          'idempotency_key',
        ].every((k) => _id(v[k])) ||
        v['type'] != 'product_import' ||
        v['contract_version'] != 2 ||
        v['source_sha256'] is! String ||
        !RegExp(r'^[a-f0-9]{64}$').hasMatch(v['source_sha256']) ||
        ![
          'queued',
          'running',
          'completed',
          'failed',
          'stopped',
          'blocked',
        ].contains(v['status']) ||
        v['resumable'] is! bool ||
        v['download_url'] != null)
      _bad();
    final total = _count(v['total_rows']),
        done = _count(v['row_count']),
        failed = _count(v['failed_rows']),
        pending = _count(v['pending_rows']),
        stopped = _count(v['stopped_rows']);
    if ((total == 0 &&
            (v['status'] != 'stopped' ||
                v['error_code'] != 'PRODUCT_IMPORT_STOPPED' ||
                v['completed_at'] == null)) ||
        done + failed + pending + stopped != total ||
        (v['status'] == 'completed' &&
            (done != total || v['completed_at'] == null)) ||
        (v['resumable'] == true &&
            [
              'completed',
              'running',
              'stopped',
              'blocked',
            ].contains(v['status'])))
      _bad();
    _date(v['created_at']);
    _date(v['updated_at']);
    _date(v['started_at'], nullable: true);
    _date(v['completed_at'], nullable: true);
    _error(v['error_code']);
    return ProductImportJob._(
      Map.unmodifiable({
        ...v,
        'total_rows': total,
        'row_count': done,
        'failed_rows': failed,
        'pending_rows': pending,
        'stopped_rows': stopped,
      }),
    );
  }
}

class ProductImportRow {
  ProductImportRow._(this.json);
  final Map<String, dynamic> json;
  String get id => json['id'];
  String get jobId => json['job_id'];
  String get storeId => json['store_id'];
  int get ordinal => json['ordinal'];
  String get status => json['status'];
  String? get productId => json['product_id'];
  String? get errorCode => json['error_code'];
  factory ProductImportRow.fromJson(Map<String, dynamic> v) {
    _keys(v, [
      'id',
      'job_id',
      'store_id',
      'ordinal',
      'status',
      'product_id',
      'error_code',
      'attempt_count',
    ]);
    if (!['id', 'job_id', 'store_id'].every((k) => _id(v[k])) ||
        !['queued', 'completed', 'failed', 'stopped'].contains(v['status']) ||
        (v['product_id'] != null && !_id(v['product_id'])) ||
        (v['status'] == 'completed') != (v['product_id'] != null))
      _bad();
    final ordinal = _count(v['ordinal'], min: 1),
        attempts = _count(v['attempt_count'], max: 9007199254740991);
    _error(v['error_code']);
    return ProductImportRow._(
      Map.unmodifiable({...v, 'ordinal': ordinal, 'attempt_count': attempts}),
    );
  }
}

class ProductImportPage<T> {
  ProductImportPage._(
    this.items,
    this.storeId,
    this.actorId,
    this.page,
    this.perPage,
    this.total,
    this.hasNext,
    this.jobId,
  );
  final List<T> items;
  final String storeId, actorId;
  final String? jobId;
  final int page, perPage, total;
  final bool hasNext;
  static ProductImportPage<ProductImportJob> history(Map<String, dynamic> v) =>
      _page(v, false, (v) => ProductImportJob.fromJson(v));
  static ProductImportPage<ProductImportRow> rows(Map<String, dynamic> v) =>
      _page(v, true, (v) => ProductImportRow.fromJson(v));
  static ProductImportPage<T> _page<T>(
    Map<String, dynamic> v,
    bool rows,
    T Function(Map<String, dynamic>) decode,
  ) {
    _keys(v, ['data', 'meta']);
    final m = _object(v['meta']);
    _keys(m, [
      'store_id',
      'actor_id',
      if (rows) 'job_id',
      'page',
      'per_page',
      'total',
      'total_is_exact',
      'has_next',
    ]);
    if (!_id(m['store_id']) ||
        !_id(m['actor_id']) ||
        (rows && !_id(m['job_id'])) ||
        m['total_is_exact'] != true ||
        m['has_next'] is! bool ||
        v['data'] is! List)
      _bad();
    final page = _count(m['page'], min: 1, max: 1000000),
        limit = _count(m['per_page'], min: 1, max: 100),
        total = _count(m['total'], max: rows ? 500 : 9007199254740991);
    final data = v['data'] as List,
        remaining = (total - (page - 1) * limit).clamp(0, limit);
    if (data.length != remaining || m['has_next'] != (page * limit < total))
      _bad();
    final items = data.map((v) => decode(_object(v))).toList(growable: false),
        seen = <String>{};
    int previous = 0;
    for (final item in items) {
      if (item is ProductImportJob) {
        if (item.storeId != m['store_id'] ||
            item.actorId != m['actor_id'] ||
            !seen.add(item.id))
          _bad();
      } else if (item is ProductImportRow) {
        if (item.storeId != m['store_id'] ||
            item.jobId != m['job_id'] ||
            item.ordinal <= previous ||
            !seen.add(item.id))
          _bad();
        previous = item.ordinal;
      } else {
        _bad();
      }
    }
    return ProductImportPage._(
      List.unmodifiable(items),
      m['store_id'],
      m['actor_id'],
      page,
      limit,
      total,
      m['has_next'],
      m['job_id'],
    );
  }
}
