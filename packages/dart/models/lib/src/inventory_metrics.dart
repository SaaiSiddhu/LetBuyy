/// Transport mirrors of the canonical commerce operations metrics contracts.
/// Quantities, rates and lifecycle aggregation remain server-authoritative.
const operationsMetricKeys = [
  'order_count',
  'open_order_count',
  'po_count',
  'open_po_count',
  'transfer_count',
  'in_transit_transfer_count',
  'low_stock_sku_count',
  'total_sku_count',
];

int _count(Object? value) {
  if (value is num &&
      value.isFinite &&
      value >= 0 &&
      value <= 9007199254740991 &&
      value == value.roundToDouble())
    return value.toInt();
  throw const FormatException('An observed operations count is unavailable.');
}

String _id(Object? value) {
  if (value is String &&
      RegExp(
        r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
      ).hasMatch(value))
    return value;
  throw const FormatException(
    'The operations identity could not be confirmed.',
  );
}

String _text(Object? value) {
  if (value is String) return value;
  throw const FormatException('An operations label is unavailable.');
}

Map<String, dynamic> _map(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  throw const FormatException('The operations record is unavailable.');
}

List<Object?> _list(Object? value) {
  if (value is List) return value;
  throw const FormatException('The operations collection is unavailable.');
}

class InventoryMetricPage {
  const InventoryMetricPage({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
    required this.hasNext,
    required this.hasPrevious,
  });
  factory InventoryMetricPage.fromJson(
    Map<String, dynamic> json,
    int rowCount,
  ) {
    final page = _count(json['page']),
        limit = _count(json['per_page']),
        total = _count(json['total']),
        pages = _count(json['total_pages']);
    final offset = (page - 1) * limit, remaining = total - offset;
    final expected = remaining <= 0
        ? 0
        : remaining < limit
        ? remaining
        : limit;
    if (page < 1 ||
        limit < 1 ||
        limit > 100 ||
        offset > 9007199254740991 ||
        pages != (total / limit).ceil() ||
        json['has_next'] != (page < pages) ||
        json['has_prev'] != (page > 1) ||
        rowCount != expected) {
      throw const FormatException(
        'The operations page and counts could not be confirmed.',
      );
    }
    return InventoryMetricPage(
      page: page,
      limit: limit,
      total: total,
      totalPages: pages,
      hasNext: json['has_next'] as bool,
      hasPrevious: json['has_prev'] as bool,
    );
  }
  final int page, limit, total, totalPages;
  final bool hasNext, hasPrevious;
}

class SupplierMetric {
  const SupplierMetric({
    required this.id,
    required this.name,
    required this.purchaseOrders,
    required this.onTimeRate,
    required this.leadTimeDays,
  });
  factory SupplierMetric.fromJson(Map<String, dynamic> json) {
    final rate = json['on_time_rate'];
    if (rate != null &&
        (rate is! num || !rate.isFinite || rate < 0 || rate > 1))
      throw const FormatException('The supplier rate is unavailable.');
    return SupplierMetric(
      id: json['supplier_id'] == null ? null : _id(json['supplier_id']),
      name: _text(json['supplier_name']),
      purchaseOrders: _count(json['po_count']),
      onTimeRate: (rate as num?)?.toDouble(),
      leadTimeDays: json['avg_lead_time_days'] == null
          ? null
          : _count(json['avg_lead_time_days']),
    );
  }
  final String? id;
  final String name;
  final int purchaseOrders;
  final double? onTimeRate;
  final int? leadTimeDays;
}

class SupplierMetricPage {
  const SupplierMetricPage({
    required this.storeId,
    required this.rows,
    required this.meta,
  });
  factory SupplierMetricPage.fromJson(Map<String, dynamic> json) {
    final rows = _list(
      json['suppliers'],
    ).map((row) => SupplierMetric.fromJson(_map(row))).toList(growable: false);
    if (rows.map((row) => row.id).toSet().length != rows.length)
      throw const FormatException(
        'The supplier page contains duplicate records.',
      );
    return SupplierMetricPage(
      storeId: _id(json['store_id']),
      rows: List.unmodifiable(rows),
      meta: InventoryMetricPage.fromJson(_map(json['meta']), rows.length),
    );
  }
  final String storeId;
  final List<SupplierMetric> rows;
  final InventoryMetricPage meta;
}

class WarehouseMetric {
  const WarehouseMetric({
    required this.id,
    required this.name,
    required this.isDefault,
    required this.stockEntries,
    required this.totalUnits,
  });
  factory WarehouseMetric.fromJson(Map<String, dynamic> json) {
    if (json['is_default'] is! bool)
      throw const FormatException(
        'The warehouse default state is unavailable.',
      );
    return WarehouseMetric(
      id: _id(json['location_id']),
      name: _text(json['location_name']),
      isDefault: json['is_default'] as bool,
      stockEntries: _count(json['sku_count']),
      totalUnits: _count(json['total_units']),
    );
  }
  final String id, name;
  final bool isDefault;
  final int stockEntries, totalUnits;
}

class WarehouseMetricPage {
  const WarehouseMetricPage({
    required this.storeId,
    required this.rows,
    required this.meta,
  });
  factory WarehouseMetricPage.fromJson(Map<String, dynamic> json) {
    final rows = _list(
      json['warehouses'],
    ).map((row) => WarehouseMetric.fromJson(_map(row))).toList(growable: false);
    if (rows.map((row) => row.id).toSet().length != rows.length)
      throw const FormatException(
        'The warehouse page contains duplicate records.',
      );
    return WarehouseMetricPage(
      storeId: _id(json['store_id']),
      rows: List.unmodifiable(rows),
      meta: InventoryMetricPage.fromJson(_map(json['meta']), rows.length),
    );
  }
  final String storeId;
  final List<WarehouseMetric> rows;
  final InventoryMetricPage meta;
}

class TransferMetrics {
  const TransferMetrics({
    required this.storeId,
    required this.byStatus,
    required this.inTransit,
    required this.total,
  });
  factory TransferMetrics.fromJson(Map<String, dynamic> json) {
    final counts = _map(
      json['by_status'],
    ).map((key, value) => MapEntry(key, _count(value)));
    final total = _count(json['total_count']),
        moving = _count(json['in_transit_count']);
    if (counts.values.fold(0, (a, b) => a + b) != total ||
        moving !=
            (counts['shipped'] ?? 0) + (counts['partially_received'] ?? 0))
      throw const FormatException(
        'The transfer totals could not be confirmed.',
      );
    return TransferMetrics(
      storeId: _id(json['store_id']),
      byStatus: Map.unmodifiable(counts),
      inTransit: moving,
      total: total,
    );
  }
  final String storeId;
  final Map<String, int> byStatus;
  final int inTransit, total;
}

class OperationsSnapshot {
  const OperationsSnapshot({required this.storeId, required this.values});
  factory OperationsSnapshot.fromJson(Map<String, dynamic> json) {
    final values = <String, int>{
      for (final key in operationsMetricKeys)
        if (json.containsKey(key)) key: _count(json[key]),
    };
    if (values.isEmpty)
      throw const FormatException('No operations counts could be confirmed.');
    for (final pair in [
      ('order_count', 'open_order_count'),
      ('po_count', 'open_po_count'),
      ('transfer_count', 'in_transit_transfer_count'),
    ]) {
      if (values.containsKey(pair.$2) &&
          (!values.containsKey(pair.$1) || values[pair.$2]! > values[pair.$1]!))
        throw const FormatException(
          'The operations counts could not be confirmed.',
        );
    }
    return OperationsSnapshot(
      storeId: _id(json['store_id']),
      values: Map.unmodifiable(values),
    );
  }
  final String storeId;
  final Map<String, int> values;
  bool get isComplete => values.length == operationsMetricKeys.length;
}
