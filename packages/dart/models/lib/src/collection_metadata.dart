// Canonical mirror of shared-types collection metadata/smart projections.
// This client validates acknowledgements; membership is evaluated only by SQL.
import 'dart:convert';
import 'category_contracts.dart' show categoryUuid;

Never _bad() => throw const FormatException(
  'The collection identity, revision or contents could not be confirmed.',
);
Map<String, dynamic> _map(Object? value) {
  if (value is! Map || value.keys.any((key) => key is! String)) _bad();
  return Map<String, dynamic>.from(value);
}

int _int(Object? v, {int min = 0, int max = 9007199254740991}) {
  if (v is! num || !v.isFinite || v != v.roundToDouble() || v < min || v > max)
    _bad();
  return v.toInt();
}

bool _text(Object? v, int max, {bool empty = true}) =>
    v is String && v.length <= max && (empty || v.isNotEmpty);
bool _date(Object? v) =>
    v is String &&
    DateTime.tryParse(v) != null &&
    RegExp(r'(?:Z|[+-]\d\d:\d\d)$').hasMatch(v);
bool _slug(Object? v) =>
    v is String &&
    v.isNotEmpty &&
    v.length <= 100 &&
    RegExp(r'^[a-z0-9]+(-[a-z0-9]+)*$').hasMatch(v);
bool _url(Object? v) =>
    v is String &&
    Uri.tryParse(v)?.hasScheme == true &&
    !RegExp(r'\s').hasMatch(v);
Object? _freeze(Object? v) => v is Map
    ? Map<String, dynamic>.unmodifiable(
        v.map((k, x) => MapEntry(k.toString(), _freeze(x))),
      )
    : v is List
    ? List<Object?>.unmodifiable(v.map(_freeze))
    : v;
Object? _ordered(Object? v) => v is Map
    ? {
        for (final k in v.keys.cast<String>().toList()..sort())
          k: _ordered(v[k]),
      }
    : v is List
    ? v.map(_ordered).toList()
    : v;
bool _same(Object? a, Object? b) =>
    jsonEncode(_ordered(a)) == jsonEncode(_ordered(b));
const collectionRuleFields = [
  'title',
  'product_type',
  'vendor',
  'tag',
  'price',
  'inventory_quantity',
];
const collectionRuleOperators = [
  'equals',
  'not_equals',
  'contains',
  'starts_with',
  'ends_with',
  'gt',
  'lt',
];
List<Map<String, dynamic>> validateCollectionRules(Object? value) {
  if (value is! List || value.length > 50) _bad();
  return List.unmodifiable(
    value.map((v) {
      final rule = _map(v);
      if (rule.length != 3 ||
          !collectionRuleFields.contains(rule['field']) ||
          !collectionRuleOperators.contains(rule['op']) ||
          !_text(rule['value'], 2000))
        _bad();
      return Map<String, dynamic>.unmodifiable(rule);
    }),
  );
}

class SmartCollectionContract {
  SmartCollectionContract._(this.json);
  final Map<String, dynamic> json;
  factory SmartCollectionContract.fromJson(Object? value) {
    final row = _map(value);
    const required = {
      'id',
      'store_id',
      'name',
      'slug',
      'conditions',
      'match_type',
      'is_active',
      'created_at',
      'version',
    };
    if (!required.every(row.containsKey) ||
        row.keys.any(
          (k) => !{
            ...required,
            'description',
            'created_by',
            'updated_by',
          }.contains(k),
        ) ||
        !categoryUuid(row['id']) ||
        !categoryUuid(row['store_id']) ||
        !_text(row['name'], 200, empty: false) ||
        !_slug(row['slug']) ||
        row['description'] != null && !_text(row['description'], 2000) ||
        row['is_active'] is! bool ||
        !const ['all', 'any'].contains(row['match_type']) ||
        row['created_at'] != null && !_date(row['created_at']) ||
        [
          'created_by',
          'updated_by',
        ].any((k) => row[k] != null && !categoryUuid(row[k])))
      _bad();
    _int(row['version'], min: 1);
    validateCollectionRules(row['conditions']);
    return SmartCollectionContract._(_freeze(row) as Map<String, dynamic>);
  }
  String get id => json['id'];
  String get storeId => json['store_id'];
  String get title => json['name'];
  String get slug => json['slug'];
  String? get description => json['description'];
  String? get createdAt => json['created_at'];
  int get version => _int(json['version'], min: 1);
  bool get published => json['is_active'];
  String get matchType => json['match_type'];
  List<Map<String, dynamic>> get rules =>
      validateCollectionRules(json['conditions']);
}

class SmartCollectionPage {
  SmartCollectionPage._(
    this.rows,
    this.storeId,
    this.page,
    this.limit,
    this.total,
  );
  final List<SmartCollectionContract> rows;
  final String storeId;
  final int page, limit, total;
  bool get hasNext => page * limit < total;
  factory SmartCollectionPage.fromParts(Object? items, Object? metadata) {
    final m = _map(metadata);
    const keys = {
      'store_id',
      'page',
      'per_page',
      'total',
      'total_pages',
      'total_is_exact',
      'has_next',
      'has_prev',
    };
    if (m.length != keys.length ||
        !keys.every(m.containsKey) ||
        !categoryUuid(m['store_id']) ||
        m['total_is_exact'] != true ||
        items is! List)
      _bad();
    final page = _int(m['page'], min: 1, max: 10000),
        limit = _int(m['per_page'], min: 1, max: 100),
        total = _int(m['total']);
    final rows = items
            .map(SmartCollectionContract.fromJson)
            .toList(growable: false),
        remaining = (total - (page - 1) * limit).clamp(0, limit);
    if (rows.length != remaining ||
        rows.any((r) => r.storeId != m['store_id']) ||
        rows.map((r) => r.id).toSet().length != rows.length ||
        m['total_pages'] != (total / limit).ceil() ||
        m['has_next'] != (page * limit < total) ||
        m['has_prev'] != (page > 1))
      _bad();
    return SmartCollectionPage._(
      List.unmodifiable(rows),
      m['store_id'],
      page,
      limit,
      total,
    );
  }
}

const _metadataFields = {
  'id',
  'store_id',
  'title',
  'slug',
  'description',
  'image_url',
  'is_active',
  'collection_type',
  'conditions',
  'match_type',
  'version',
  'membership_version',
  'created_at',
  'updated_at',
  'deleted_at',
  'created_by',
  'updated_by',
};

class CollectionMetadataContract {
  CollectionMetadataContract._(this.json);
  final Map<String, dynamic> json;
  factory CollectionMetadataContract.fromJson(Object? value) {
    final r = _map(value);
    if (r.length != _metadataFields.length ||
        !_metadataFields.every(r.containsKey) ||
        !categoryUuid(r['id']) ||
        !categoryUuid(r['store_id']) ||
        !_text(r['title'], 200, empty: false) ||
        !const ['manual', 'smart'].contains(r['collection_type']) ||
        r['slug'] != null && !_slug(r['slug']) ||
        r['description'] != null && !_text(r['description'], 2000) ||
        r['image_url'] != null && !_url(r['image_url']) ||
        r['is_active'] != null && r['is_active'] is! bool ||
        !const ['all', 'any'].contains(r['match_type']) ||
        [
          'created_at',
          'updated_at',
          'deleted_at',
        ].any((k) => r[k] != null && !_date(r[k])) ||
        [
          'created_by',
          'updated_by',
        ].any((k) => r[k] != null && !categoryUuid(r[k])))
      _bad();
    _int(r['version'], min: 1);
    _int(r['membership_version'], min: 1);
    if (r['collection_type'] == 'smart') {
      if (!_slug(r['slug']) || r['is_active'] is! bool) _bad();
      validateCollectionRules(r['conditions']);
    }
    jsonEncode(
      r['conditions'],
    ); // Retained manual opaque JSON is never turned into smart rules.
    return CollectionMetadataContract._(_freeze(r) as Map<String, dynamic>);
  }
  String get id => json['id'];
  String get storeId => json['store_id'];
  String get title => json['title'];
  String get kind => json['collection_type'];
  String? get slug => json['slug'];
  String? get description => json['description'];
  String? get imageUrl => json['image_url'];
  int get version => _int(json['version'], min: 1);
  bool get published => json['is_active'] == true;
  bool get isDeleted => json['deleted_at'] != null;
}

Map<String, dynamic> validateCollectionMetadataCommand(
  String operation,
  Object? value,
) {
  final r = _map(value),
      create = operation == 'create',
      remove = operation == 'delete';
  if (!const ['create', 'update', 'delete'].contains(operation) ||
      !categoryUuid(r['store_id']) ||
      !categoryUuid(r['idempotency_key']) ||
      r.keys.any(
        (k) => !{
          'store_id',
          'idempotency_key',
          if (!create) 'version',
          'collection_type',
          if (!remove) ...[
            'title',
            'slug',
            'description',
            'image_url',
            'is_active',
            'conditions',
            'match_type',
          ],
        }.contains(k),
      ))
    _bad();
  if (!create) _int(r['version'], min: 1);
  if (create || remove) {
    if (!const ['manual', 'smart'].contains(r['collection_type'])) _bad();
  } else if (r.containsKey('collection_type') &&
      !const ['manual', 'smart'].contains(r['collection_type']))
    _bad();
  if (create || r.containsKey('title')) {
    if (r['title'] is! String) _bad();
    r['title'] = (r['title'] as String).trim();
    if (!_text(r['title'], 200, empty: false)) _bad();
  }
  if (r.containsKey('slug') && r['slug'] != null && !_slug(r['slug']) ||
      r.containsKey('description') &&
          r['description'] != null &&
          !_text(r['description'], 2000) ||
      r.containsKey('image_url') &&
          r['image_url'] != null &&
          !_url(r['image_url']) ||
      r.containsKey('is_active') && r['is_active'] is! bool ||
      r.containsKey('match_type') &&
          !const ['all', 'any'].contains(r['match_type']))
    _bad();
  if (r.containsKey('conditions')) validateCollectionRules(r['conditions']);
  if (create &&
      r['collection_type'] == 'smart' &&
      (!_slug(r['slug']) ||
          !r.containsKey('conditions') ||
          !r.containsKey('match_type')))
    _bad();
  if (create &&
      r['collection_type'] == 'manual' &&
      ((r['title'] as String).length > 160 ||
          (r['description'] as String?)?.length != null &&
              (r['description'] as String).length > 1000 ||
          r['conditions'] != null && (r['conditions'] as List).isNotEmpty ||
          r['match_type'] == 'any'))
    _bad();
  if (!create &&
      !remove &&
      !r.keys.any(
        (k) => !const [
          'store_id',
          'idempotency_key',
          'version',
          'collection_type',
        ].contains(k),
      ))
    _bad();
  return _freeze(r) as Map<String, dynamic>;
}

class CollectionMetadataReceipt {
  CollectionMetadataReceipt._(this.collection, this.json);
  final CollectionMetadataContract collection;
  final Map<String, dynamic> json;
  factory CollectionMetadataReceipt.confirm(
    Object? value, {
    required String actorId,
    required String operation,
    required String? id,
    required Map<String, dynamic> command,
  }) {
    final r = _map(value),
        body = validateCollectionMetadataCommand(operation, command);
    const keys = {
      'operation',
      'idempotency_key',
      'actor_id',
      'expected_version',
      'request',
    };
    if (r.length != _metadataFields.length + keys.length ||
        !keys.every(r.containsKey) ||
        r.keys.any((k) => !{..._metadataFields, ...keys}.contains(k)))
      _bad();
    final row = CollectionMetadataContract.fromJson({
      for (final k in _metadataFields) k: r[k],
    });
    final request = {
      for (final e in body.entries)
        if (!const ['store_id', 'idempotency_key', 'version'].contains(e.key))
          e.key: e.value,
    };
    if (!categoryUuid(r['actor_id']) ||
        r['actor_id'] != actorId ||
        r['operation'] != operation ||
        r['idempotency_key'] != body['idempotency_key'] ||
        r['expected_version'] != body['version'] ||
        row.storeId != body['store_id'] ||
        id != null && row.id != id ||
        body.containsKey('collection_type') &&
            row.kind != body['collection_type'] ||
        row.version !=
            (operation == 'create' ? 1 : (body['version'] as num) + 1) ||
        operation == 'delete' && (!row.isDeleted || row.published) ||
        !_same(request, r['request']))
      _bad();
    return CollectionMetadataReceipt._(row, _freeze(r) as Map<String, dynamic>);
  }
}

class SmartCollectionPreview {
  SmartCollectionPreview._(this.json);
  final Map<String, dynamic> json;
  factory SmartCollectionPreview.fromJson(Object? value) {
    final r = _map(value);
    const keys = {
      'store_id',
      'collection_id',
      'collection_version',
      'match_type',
      'condition_count',
      'count',
      'sample_product_ids',
      'evaluated_of',
      'capped_at',
      'catalog_count',
      'count_is_exact',
    };
    if (r.length != keys.length ||
        !keys.every(r.containsKey) ||
        !categoryUuid(r['store_id']) ||
        !categoryUuid(r['collection_id']) ||
        !const ['all', 'any'].contains(r['match_type']) ||
        r['capped_at'] != 500 ||
        r['count_is_exact'] is! bool ||
        r['sample_product_ids'] is! List)
      _bad();
    _int(r['collection_version'], min: 1);
    _int(r['condition_count']);
    final count = _int(r['count']),
        evaluated = _int(r['evaluated_of']),
        total = _int(r['catalog_count']);
    final ids = r['sample_product_ids'] as List;
    if (evaluated != (total < 500 ? total : 500) ||
        count > evaluated ||
        r['count_is_exact'] != (evaluated == total) ||
        ids.length != (count < 10 ? count : 10) ||
        ids.any((id) => !categoryUuid(id)) ||
        ids.toSet().length != ids.length)
      _bad();
    return SmartCollectionPreview._(_freeze(r) as Map<String, dynamic>);
  }
  String get storeId => json['store_id'];
  String get collectionId => json['collection_id'];
  int get version => _int(json['collection_version'], min: 1);
  int get count => _int(json['count']);
  int get evaluated => _int(json['evaluated_of']);
  int get catalogCount => _int(json['catalog_count']);
  bool get isExact => json['count_is_exact'];
}
