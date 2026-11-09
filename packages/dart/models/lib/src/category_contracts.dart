// Canonical Dart mirror of the ProductCategory* contracts in shared-types.
Never _badCategory() => throw const FormatException(
  'The category identity, revision or contents could not be confirmed.',
);
bool categoryUuid(Object? value) =>
    value is String &&
    RegExp(
      r'^[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}$',
    ).hasMatch(value);
Map<String, dynamic> _categoryObject(Object? value) {
  if (value is! Map || value.keys.any((key) => key is! String)) _badCategory();
  return Map<String, dynamic>.from(value);
}

int _categoryCount(Object? value, {int min = 0, int max = 9007199254740991}) {
  if (value is! num ||
      !value.isFinite ||
      value < min ||
      value > max ||
      value != value.roundToDouble())
    _badCategory();
  return value.toInt();
}

bool _categoryDate(Object? value) =>
    value is String &&
    DateTime.tryParse(value) != null &&
    RegExp(r'(?:Z|[+-]\d\d:\d\d)$').hasMatch(value);
bool _categoryImage(Object? value) {
  if (value is! String || value.length > 2048) return false;
  final uri = Uri.tryParse(value);
  return uri != null &&
      const ['http', 'https'].contains(uri.scheme) &&
      uri.host.isNotEmpty &&
      !RegExp(r'\s').hasMatch(value);
}

const _categoryFields = {
  'id',
  'store_id',
  'name',
  'slug',
  'description',
  'image_url',
  'parent_id',
  'display_order',
  'is_visible',
  'level',
  'path',
  'version',
  'created_at',
  'updated_at',
  'deleted_at',
  'created_by',
  'updated_by',
  'deleted_by',
  'products_count',
  'children_count',
};

class ProductCategoryContract {
  ProductCategoryContract._(this._json);
  final Map<String, dynamic> _json;
  factory ProductCategoryContract.fromJson(Object? value) {
    final row = _categoryObject(value);
    if (row.length != _categoryFields.length ||
        !_categoryFields.every(row.containsKey) ||
        row.keys.any((key) => !_categoryFields.contains(key)) ||
        !categoryUuid(row['id']) ||
        !categoryUuid(row['store_id']) ||
        row['name'] is! String ||
        (row['name'] as String).isEmpty ||
        (row['name'] as String).length > 100 ||
        row['slug'] is! String ||
        (row['slug'] as String).length > 100 ||
        !RegExp(r'^[a-z0-9]+(-[a-z0-9]+)*$').hasMatch(row['slug']) ||
        row['is_visible'] is! bool ||
        row['path'] is! String ||
        (row['path'] as String).isEmpty ||
        (row['path'] as String).length > 500 ||
        !_categoryDate(row['created_at']) ||
        !_categoryDate(row['updated_at']) ||
        row['deleted_at'] != null && !_categoryDate(row['deleted_at']) ||
        row['description'] != null &&
            (row['description'] is! String ||
                (row['description'] as String).length > 500) ||
        row['image_url'] != null && !_categoryImage(row['image_url']) ||
        [
          'parent_id',
          'created_by',
          'updated_by',
          'deleted_by',
        ].any((key) => row[key] != null && !categoryUuid(row[key])))
      _badCategory();
    _categoryCount(row['version'], min: 1, max: 2147483647);
    _categoryCount(row['display_order'], max: 2147483647);
    for (final key in ['level', 'products_count', 'children_count']) {
      _categoryCount(row[key]);
    }
    return ProductCategoryContract._(Map.unmodifiable(row));
  }
  String get id => _json['id'];
  String get storeId => _json['store_id'];
  String get name => _json['name'];
  String get slug => _json['slug'];
  String get path => _json['path'];
  String? get description => _json['description'];
  String? get imageUrl => _json['image_url'];
  String? get parentId => _json['parent_id'];
  bool get isVisible => _json['is_visible'];
  bool get isDeleted => _json['deleted_at'] != null;
  int get version => (_json['version'] as num).toInt();
  int get displayOrder => (_json['display_order'] as num).toInt();
  int get productsCount => (_json['products_count'] as num).toInt();
  int get childrenCount => (_json['children_count'] as num).toInt();
  Map<String, dynamic> toJson() => Map.of(_json);
}

class ProductCategoryPage {
  ProductCategoryPage._(
    this.rows,
    this.page,
    this.limit,
    this.total,
    this.hasNext,
  );
  final List<ProductCategoryContract> rows;
  final int page, limit, total;
  final bool hasNext;
  factory ProductCategoryPage.fromParts(Object? data, Object? metadata) {
    final m = _categoryObject(metadata);
    if (data is! List ||
        data.length > 100 ||
        m.length != 6 ||
        !{
          'page',
          'per_page',
          'total',
          'total_pages',
          'has_prev',
          'has_next',
        }.every(m.containsKey) ||
        m['has_prev'] is! bool ||
        m['has_next'] is! bool)
      _badCategory();
    final page = _categoryCount(m['page'], min: 1, max: 10000),
        limit = _categoryCount(m['per_page'], min: 1, max: 100),
        total = _categoryCount(m['total']),
        pages = _categoryCount(m['total_pages']);
    final rows = data.map(ProductCategoryContract.fromJson).toList(),
        remaining = total - (page - 1) * limit;
    if (rows.length !=
            (remaining < 0
                ? 0
                : remaining > limit
                ? limit
                : remaining) ||
        rows.any((r) => r.isDeleted) ||
        rows.map((r) => r.id).toSet().length != rows.length ||
        pages != (total / limit).ceil() ||
        m['has_prev'] != (page > 1) ||
        m['has_next'] != (page < pages))
      _badCategory();
    return ProductCategoryPage._(
      List.unmodifiable(rows),
      page,
      limit,
      total,
      m['has_next'],
    );
  }
}

class ProductCategoryReceipt {
  ProductCategoryReceipt._(
    this.category,
    this.key,
    this.operation,
    this.affectedProducts,
  );
  final ProductCategoryContract category;
  final String key, operation;
  final int affectedProducts;
  factory ProductCategoryReceipt.fromJson(Object? value) {
    final map = _categoryObject(value),
        row = Map<String, dynamic>.of(map)
          ..remove('idempotency_key')
          ..remove('operation')
          ..remove('affected_products');
    if (!categoryUuid(map['idempotency_key']) ||
        !const ['create', 'update', 'delete'].contains(map['operation']))
      _badCategory();
    final category = ProductCategoryContract.fromJson(row);
    if ((map['operation'] == 'delete') != category.isDeleted) _badCategory();
    return ProductCategoryReceipt._(
      category,
      map['idempotency_key'],
      map['operation'],
      _categoryCount(map['affected_products']),
    );
  }
}

Map<String, dynamic> validateProductCategoryCommand(
  String operation,
  Object? value,
) {
  final row = _categoryObject(value),
      fields = {
        'name',
        'slug',
        'description',
        'image_url',
        'parent_id',
        'display_order',
        'is_visible',
      };
  if (!const ['create', 'update', 'delete'].contains(operation) ||
      !categoryUuid(row['store_id']) ||
      !categoryUuid(row['idempotency_key']) ||
      row.keys.any(
        (key) => !{
          'store_id',
          'idempotency_key',
          if (operation != 'create') 'version',
          if (operation != 'delete') ...fields,
        }.contains(key),
      ))
    _badCategory();
  if (operation != 'create')
    _categoryCount(row['version'], min: 1, max: 2147483647);
  if (operation == 'create' && !row.containsKey('name') ||
      operation == 'update' && !fields.any(row.containsKey))
    _badCategory();
  if (row.containsKey('name') &&
      (row['name'] is! String ||
          (row['name'] as String).trim().isEmpty ||
          (row['name'] as String).trim().length > 100))
    _badCategory();
  if (row.containsKey('name')) row['name'] = (row['name'] as String).trim();
  if (row.containsKey('slug') &&
      (row['slug'] is! String ||
          (row['slug'] as String).length > 100 ||
          !RegExp(r'^[a-z0-9]+(-[a-z0-9]+)*$').hasMatch(row['slug'])))
    _badCategory();
  if (row.containsKey('description') &&
      row['description'] != null &&
      (row['description'] is! String ||
          (row['description'] as String).length > 500))
    _badCategory();
  if (row.containsKey('image_url') &&
      row['image_url'] != null &&
      !_categoryImage(row['image_url']))
    _badCategory();
  if (row.containsKey('parent_id') &&
      row['parent_id'] != null &&
      !categoryUuid(row['parent_id']))
    _badCategory();
  if (row.containsKey('display_order'))
    _categoryCount(row['display_order'], max: 2147483647);
  if (row.containsKey('is_visible') && row['is_visible'] is! bool)
    _badCategory();
  if (operation == 'create') {
    row.putIfAbsent('display_order', () => 0);
    row.putIfAbsent('is_visible', () => true);
  }
  return Map.unmodifiable(row);
}
