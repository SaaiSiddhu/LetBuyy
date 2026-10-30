// Native mirror of the canonical warehouse request/acknowledgement protocol.
import 'inventory_contracts.dart';

const warehouseCommandOperations = [
  'purchase_order.create',
  'purchase_order.receive',
  'transfer.create',
  'transfer.ship',
  'transfer.receive',
];
bool _id(Object? value) =>
    value is String &&
    RegExp(
      r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
    ).hasMatch(value);
Never _invalid() => throw const FormatException(
  'The original warehouse request or acknowledgement could not be confirmed.',
);
Map<String, dynamic> _object(Object? value) {
  if (value is! Map || value.keys.any((key) => key is! String)) _invalid();
  return Map<String, dynamic>.from(value);
}

bool _keys(Map<String, dynamic> value, List<String> keys) =>
    value.length == keys.length && keys.every(value.containsKey);
int _count(Object? value, {int minimum = 0, int maximum = 999999}) {
  if (value is! num ||
      !value.isFinite ||
      value != value.roundToDouble() ||
      value < minimum ||
      value > maximum)
    _invalid();
  return value.toInt();
}

Object? _capture(Object? value, [int depth = 0]) {
  if (depth > 32) _invalid();
  if (value is Map)
    return Map<String, dynamic>.unmodifiable(
      _object(value).map((key, v) => MapEntry(key, _capture(v, depth + 1))),
    );
  if (value is List) {
    if (value.length > 1000) _invalid();
    return List<Object?>.unmodifiable(value.map((v) => _capture(v, depth + 1)));
  }
  if (value == null ||
      value is String ||
      value is bool ||
      value is num && value.isFinite)
    return value;
  _invalid();
}

bool _same(Object? a, Object? b) {
  if (a is num && b is num) return a.isFinite && b.isFinite && a == b;
  if (a is Map && b is Map)
    return a.length == b.length &&
        a.keys.every((k) => b.containsKey(k) && _same(a[k], b[k]));
  if (a is List && b is List)
    return a.length == b.length &&
        List.generate(a.length, (i) => i).every((i) => _same(a[i], b[i]));
  return a == b;
}

String _canonicalId(String value) {
  final text = value.trim();
  if (!_id(text)) _invalid();
  return text.toLowerCase();
}

String? _optionalId(String? value) =>
    value == null || value.trim().isEmpty ? null : _canonicalId(value);
num _cost(num value) {
  if (!value.isFinite ||
      value < 0 ||
      value > 999999 ||
      (value * 100).round() / 100 != value)
    _invalid();
  return value == value.roundToDouble() ? value.toInt() : value;
}

String? _date(String? value) {
  if (value == null || value.trim().isEmpty) return null;
  var text = value.trim();
  final calendar = RegExp(
    r'^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})?)?$',
  ).firstMatch(text);
  if (calendar == null) _invalid();
  final year = int.parse(calendar[1]!),
      month = int.parse(calendar[2]!),
      day = int.parse(calendar[3]!);
  final date = DateTime.utc(year, month, day);
  if (date.year != year ||
      date.month != month ||
      date.day != day ||
      int.parse(calendar[4] ?? '0') > 23 ||
      int.parse(calendar[5] ?? '0') > 59 ||
      int.parse(calendar[6] ?? '0') > 59)
    _invalid();
  if (RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(text)) text += 'T00:00:00Z';
  if (!RegExp(r'(Z|[+-]\d{2}:\d{2})$').hasMatch(text)) text += 'Z';
  final parsed = DateTime.tryParse(text);
  if (parsed == null) _invalid();
  return DateTime.fromMillisecondsSinceEpoch(
    parsed.millisecondsSinceEpoch,
    isUtc: true,
  ).toIso8601String();
}

/// Frozen normalized intent. Actor/site and the durable key belong to the journal.
class WarehouseCommandIntent {
  WarehouseCommandIntent._(this.operation, this.targetId, this.command);
  final String operation;
  final String? targetId;
  final Map<String, dynamic> command;
  factory WarehouseCommandIntent.fromJson(Map<String, dynamic> json) {
    if (!_keys(json, ['operation', 'target_id', 'command']) ||
        !warehouseCommandOperations.contains(json['operation']))
      _invalid();
    final op = json['operation'] as String,
        create = op.endsWith('.create'),
        target = json['target_id'];
    if (create ? target != null : !_id(target)) _invalid();
    final command = _object(json['command']);
    final expected = op == 'purchase_order.create'
        ? ['supplier_id', 'location_id', 'expected_at', 'notes', 'lines']
        : op == 'transfer.create'
        ? ['source_location_id', 'destination_location_id', 'notes', 'lines']
        : op == 'transfer.ship'
        ? <String>[]
        : ['lines'];
    if (!_keys(command, expected)) _invalid();
    if (create) {
      if (command['notes'] != null &&
          (command['notes'] is! String ||
              (command['notes'] as String).length > 1000))
        _invalid();
      if (op == 'purchase_order.create') {
        if (!_id(command['location_id']) ||
            command['supplier_id'] != null && !_id(command['supplier_id']) ||
            command['expected_at'] != null &&
                (command['expected_at'] is! String ||
                    _date(command['expected_at'] as String) !=
                        command['expected_at']))
          _invalid();
      } else if (!_id(command['source_location_id']) ||
          !_id(command['destination_location_id']) ||
          command['source_location_id'] == command['destination_location_id'])
        _invalid();
    }
    if (op != 'transfer.ship') {
      final lines = command['lines'];
      if (lines != null || create) {
        if (lines is! List || lines.isEmpty || lines.length > 200) _invalid();
        final ids = <String>{};
        for (final raw in lines) {
          final row = _object(raw);
          if (create) {
            if (!_keys(
                  row,
                  op == 'purchase_order.create'
                      ? ['product_id', 'variant_id', 'quantity', 'unit_cost']
                      : ['product_id', 'variant_id', 'quantity'],
                ) ||
                !_id(row['product_id']) ||
                row['variant_id'] != null && !_id(row['variant_id']))
              _invalid();
            _count(row['quantity'], minimum: 1);
            if (op == 'purchase_order.create') {
              if (row['unit_cost'] is! num) _invalid();
              _cost(row['unit_cost'] as num);
            }
          } else {
            final idKey = op == 'purchase_order.receive'
                ? 'purchase_order_line_id'
                : 'transfer_line_id';
            if (!_keys(row, [idKey, 'quantity']) ||
                !_id(row[idKey]) ||
                !ids.add(row[idKey] as String))
              _invalid();
            _count(row['quantity'], minimum: 1);
          }
        }
      }
    }
    return WarehouseCommandIntent._(
      op,
      target as String?,
      _capture(command) as Map<String, dynamic>,
    );
  }
  factory WarehouseCommandIntent.purchaseOrder(PurchaseOrderInput input) =>
      WarehouseCommandIntent.fromJson({
        'operation': 'purchase_order.create',
        'target_id': null,
        'command': {
          'supplier_id': _optionalId(input.supplierId),
          'location_id': _canonicalId(input.locationId),
          'expected_at': _date(input.expectedAt),
          'notes': input.notes.trim().isEmpty ? null : input.notes.trim(),
          'lines': input.lines
              .map(
                (line) => {
                  'product_id': _canonicalId(line.productId),
                  'variant_id': _optionalId(line.variantId),
                  'quantity': line.quantity,
                  'unit_cost': _cost(line.unitCost),
                },
              )
              .toList(),
        },
      });
  factory WarehouseCommandIntent.transfer(InventoryTransferInput input) =>
      WarehouseCommandIntent.fromJson({
        'operation': 'transfer.create',
        'target_id': null,
        'command': {
          'source_location_id': _canonicalId(input.sourceLocationId),
          'destination_location_id': _canonicalId(input.destinationLocationId),
          'notes': input.notes.trim().isEmpty ? null : input.notes.trim(),
          'lines': input.lines
              .map(
                (line) => {
                  'product_id': _canonicalId(line.productId),
                  'variant_id': _optionalId(line.variantId),
                  'quantity': line.quantity,
                },
              )
              .toList(),
        },
      });
  factory WarehouseCommandIntent.ship(String target) =>
      WarehouseCommandIntent.fromJson({
        'operation': 'transfer.ship',
        'target_id': _canonicalId(target),
        'command': <String, dynamic>{},
      });
  factory WarehouseCommandIntent.receivePurchaseOrder(
    PurchaseOrderContract row, {
    Map<String, int>? quantities,
  }) {
    final lines = <Map<String, dynamic>>[], known = <String>{};
    for (final line in row.lines) {
      known.add(line.id);
      final remaining = line.remainingQuantity,
          quantity = quantities == null ? remaining : quantities[line.id] ?? 0;
      if (quantity < 0 || quantity > remaining) _invalid();
      if (quantity > 0)
        lines.add({
          'purchase_order_line_id': _canonicalId(line.id),
          'quantity': quantity,
        });
    }
    if (quantities != null && quantities.keys.any((id) => !known.contains(id)))
      _invalid();
    return WarehouseCommandIntent.fromJson({
      'operation': 'purchase_order.receive',
      'target_id': _canonicalId(row.id),
      'command': {'lines': lines},
    });
  }
  factory WarehouseCommandIntent.receiveTransfer(
    InventoryTransferContract row, {
    Map<String, int>? quantities,
  }) {
    final lines = <Map<String, dynamic>>[], known = <String>{};
    for (final line in row.lines) {
      known.add(line.id);
      final limit = row.status == 'reserved'
          ? line.quantity
          : line.shippedQuantity;
      final remaining = limit - line.receivedQuantity,
          quantity = quantities == null ? remaining : quantities[line.id] ?? 0;
      if (quantity < 0 || quantity > remaining) _invalid();
      if (quantity > 0)
        lines.add({
          'transfer_line_id': _canonicalId(line.id),
          'quantity': quantity,
        });
    }
    if (quantities != null && quantities.keys.any((id) => !known.contains(id)))
      _invalid();
    return WarehouseCommandIntent.fromJson({
      'operation': 'transfer.receive',
      'target_id': _canonicalId(row.id),
      'command': {'lines': lines},
    });
  }
  Map<String, dynamic> toJson() => {
    'operation': operation,
    'target_id': targetId,
    'command': command,
  };
  bool sameAs(WarehouseCommandIntent other) => _same(toJson(), other.toJson());
  bool matches(WarehouseCommandAcknowledgement ack) =>
      operation == ack.operation &&
      (targetId == null || targetId == ack.targetId) &&
      _same(command, ack.command);
}

class WarehouseCommandAcknowledgement {
  WarehouseCommandAcknowledgement._(this.data, this.receipt);
  final Map<String, dynamic> data, receipt;
  factory WarehouseCommandAcknowledgement.fromJson(Map<String, dynamic> json) {
    final data = _capture(json) as Map<String, dynamic>,
        receipt = _object(data['command_receipt']);
    if (data.keys.any(
          (key) => ![
            'command_receipt',
            'purchase_order',
            'transfer',
            'lines',
          ].contains(key),
        ) ||
        !_keys(receipt, [
          'id',
          'key',
          'site_id',
          'actor_id',
          'operation',
          'target_id',
          'command',
          'effective_lines',
          'outcome',
        ]) ||
        !_id(receipt['id']) ||
        !_id(receipt['site_id']) ||
        !_id(receipt['actor_id']) ||
        receipt['key'] is! String ||
        (receipt['key'] as String).length < 8 ||
        (receipt['key'] as String).length > 200 ||
        !warehouseCommandOperations.contains(receipt['operation']) ||
        !['applied', 'cancelled'].contains(receipt['outcome']))
      _invalid();
    final op = receipt['operation'] as String,
        po = op.startsWith('purchase_order.'),
        create = op.endsWith('.create');
    WarehouseCommandIntent.fromJson({
      'operation': op,
      'target_id': create ? null : receipt['target_id'],
      'command': _object(receipt['command']),
    });
    final lines = data['lines'];
    if (lines is! List || lines.length > 200) _invalid();
    if (receipt['outcome'] == 'cancelled') {
      if (data['purchase_order'] != null ||
          data['transfer'] != null ||
          lines.isNotEmpty ||
          receipt['effective_lines'] != null ||
          (create ? receipt['target_id'] != null : !_id(receipt['target_id'])))
        _invalid();
    } else {
      if (!_id(receipt['target_id']) ||
          lines.isEmpty ||
          data[po ? 'transfer' : 'purchase_order'] != null)
        _invalid();
      final header = _object(data[po ? 'purchase_order' : 'transfer']);
      final states = po
          ? [
              'draft',
              'ordered',
              'partially_received',
              'received',
              'cancelled',
              'closed',
            ]
          : [
              'reserved',
              'shipped',
              'partially_received',
              'received',
              'cancelled',
            ];
      if (header['id'] != receipt['target_id'] ||
          header['site_id'] != receipt['site_id'] ||
          !states.contains(header['status']))
        _invalid();
      final ids = <String>{}, lineRows = <String, Map<String, dynamic>>{};
      for (final raw in lines) {
        final row = _object(raw);
        if (!_id(row['id']) ||
            !ids.add(row['id'] as String) ||
            !_id(row['product_id']) ||
            row['variant_id'] != null && !_id(row['variant_id']) ||
            row['site_id'] != receipt['site_id'] ||
            row[po ? 'purchase_order_id' : 'transfer_id'] !=
                receipt['target_id'])
          _invalid();
        if (po) {
          PurchaseOrderLineContract.fromJson(row);
        } else {
          InventoryTransferLineContract.fromJson(row);
        }
        lineRows[row['id'] as String] = row;
      }
      final effective = receipt['effective_lines'];
      if (op.endsWith('.receive')) {
        if (effective is! List || effective.isEmpty || effective.length > 200)
          _invalid();
        final seen = <String>{},
            idKey = po ? 'purchase_order_line_id' : 'transfer_line_id';
        for (final raw in effective) {
          final line = _object(raw),
              id = line[idKey],
              quantity = _count(line['quantity'], minimum: 1);
          if (!_keys(line, [idKey, 'quantity']) ||
              !_id(id) ||
              !seen.add(id as String) ||
              !lineRows.containsKey(id) ||
              quantity > _count(lineRows[id]!['quantity_received']))
            _invalid();
        }
      } else if (effective != null)
        _invalid();
    }
    return WarehouseCommandAcknowledgement._(
      data,
      _capture(receipt) as Map<String, dynamic>,
    );
  }
  String get key => receipt['key'] as String;
  String get storeId => receipt['site_id'] as String;
  String get actorId => receipt['actor_id'] as String;
  String get operation => receipt['operation'] as String;
  String? get targetId => receipt['target_id'] as String?;
  bool get applied => receipt['outcome'] == 'applied';
  Map<String, dynamic> get command => _object(receipt['command']);
  PurchaseOrderContract? get purchaseOrder =>
      applied && operation.startsWith('purchase_order.')
      ? PurchaseOrderContract.fromJson(data)
      : null;
  InventoryTransferContract? get transfer =>
      applied && operation.startsWith('transfer.')
      ? InventoryTransferContract.fromJson(data)
      : null;
}
