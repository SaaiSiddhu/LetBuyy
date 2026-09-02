import 'dart:async';

import 'package:quickcommerce_api/quickcommerce_api.dart';
import 'package:quickcommerce_domain/quickcommerce_domain.dart';
import 'package:quickcommerce_observability/quickcommerce_observability.dart';
import 'package:quickcommerce_realtime/quickcommerce_realtime.dart';

abstract interface class StoreQueueRepository {
  Future<Result<List<StoreQueueItem>, AppFailure>> listQueue(EntityId storeId);
  Stream<StoreQueueItem> watchQueue(EntityId storeId);
  Future<Result<List<PickListItem>, AppFailure>> getPickList(EntityId orderId);
  Future<Result<void, AppFailure>> confirmItem(ConfirmPickItemCommand command);
  Future<Result<void, AppFailure>> pickOrder(PickPackCommand command);
  Future<Result<void, AppFailure>> packOrder(PickPackCommand command);
  Future<Result<void, AppFailure>> readyOrder(PickPackCommand command);
  Future<Result<List<InventorySnapshot>, AppFailure>> listInventory(
      EntityId storeId);
  Future<Result<void, AppFailure>> adjustInventory(
      StoreInventoryCommand command);
}

final class PickListItem {
  const PickListItem({
    required this.itemId,
    required this.variantId,
    required this.name,
    required this.quantity,
    this.pickedQuantity = 0,
    this.barcode,
    this.shelfCode,
  });

  final EntityId itemId;
  final EntityId variantId;
  final String name;
  final int quantity;
  final int pickedQuantity;
  final String? barcode;
  final String? shelfCode;

  bool get isPicked => pickedQuantity >= quantity;
}

final class PickPackCommand {
  const PickPackCommand({
    required this.metadata,
    required this.orderId,
    required this.expectedVersion,
    this.reason,
  });

  final CommandMetadata metadata;
  final EntityId orderId;
  final int expectedVersion;
  final String? reason;
}

final class ConfirmPickItemCommand {
  const ConfirmPickItemCommand({
    required this.metadata,
    required this.orderId,
    required this.itemId,
    required this.quantity,
  });

  final CommandMetadata metadata;
  final EntityId orderId;
  final EntityId itemId;
  final int quantity;
}

final class StoreInventoryCommand {
  const StoreInventoryCommand({
    required this.metadata,
    required this.storeId,
    required this.variantId,
    required this.delta,
    required this.reason,
  });

  final CommandMetadata metadata;
  final EntityId storeId;
  final EntityId variantId;
  final int delta;
  final String reason;
}

final class ApiStoreQueueRepository implements StoreQueueRepository {
  ApiStoreQueueRepository({
    required QuickcommerceApiClient api,
    required RealtimeClient realtimeClient,
  })  : _api = api,
        _realtimeClient = realtimeClient;

  final QuickcommerceApiClient _api;
  final RealtimeClient _realtimeClient;

  @override
  Future<Result<List<StoreQueueItem>, AppFailure>> listQueue(
      EntityId storeId) async {
    final result = await _api.getMap(
      ApiRoutes.storeQueue,
      trace: TraceContext(
          traceId: 'store-queue-load', requestId: 'store-queue-load'),
      queryParameters: {'store_id': storeId.value},
    );
    return result.fold(
      ok: (json) => Ok(_queueList(json['orders'] ?? json['items'])),
      err: Err.new,
    );
  }

  @override
  Stream<StoreQueueItem> watchQueue(EntityId storeId) {
    return _realtimeClient
        .subscribe(RealtimeChannels.storeQueue(storeId.value))
        .map((message) => _queueItemFromJson(message.payload));
  }

  @override
  Future<Result<List<PickListItem>, AppFailure>> getPickList(
    EntityId orderId,
  ) async {
    final result = await _api.getMap(
      ApiRoutes.storeOrderPicklist(orderId.value),
      trace: TraceContext(
        traceId: 'store-picklist-${orderId.value}',
        requestId: 'store-picklist-${orderId.value}',
      ),
    );
    return result.fold(
      ok: (json) => Ok(_pickList(json['items'])),
      err: Err.new,
    );
  }

  @override
  Future<Result<void, AppFailure>> confirmItem(
    ConfirmPickItemCommand command,
  ) async {
    final result = await _api.postCommand(
      ApiRoutes.storeOrderItemConfirm(
        command.orderId.value,
        command.itemId.value,
      ),
      trace: _traceFromCommand(command.metadata),
      idempotencyKey: command.metadata.idempotencyKey,
      payload: {'quantity': command.quantity},
    );
    return result.fold(ok: (_) => const Ok(null), err: Err.new);
  }

  @override
  Future<Result<void, AppFailure>> pickOrder(PickPackCommand command) async {
    final result = await _api.postCommand(
      ApiRoutes.storeOrderPick(command.orderId.value),
      trace: _traceFromCommand(command.metadata),
      idempotencyKey: command.metadata.idempotencyKey,
      payload: {
        'expectedVersion': command.expectedVersion,
        'reason': command.reason,
      },
    );
    return result.fold(ok: (_) => const Ok(null), err: Err.new);
  }

  @override
  Future<Result<void, AppFailure>> packOrder(PickPackCommand command) async {
    final result = await _api.postCommand(
      ApiRoutes.storeOrderPack(command.orderId.value),
      trace: _traceFromCommand(command.metadata),
      idempotencyKey: command.metadata.idempotencyKey,
      payload: {
        'expectedVersion': command.expectedVersion,
        'reason': command.reason,
      },
    );
    return result.fold(ok: (_) => const Ok(null), err: Err.new);
  }

  @override
  Future<Result<void, AppFailure>> readyOrder(PickPackCommand command) async {
    final result = await _api.postCommand(
      ApiRoutes.storeOrderReady(command.orderId.value),
      trace: _traceFromCommand(command.metadata),
      idempotencyKey: command.metadata.idempotencyKey,
      payload: {
        'expectedVersion': command.expectedVersion,
        'reason': command.reason,
      },
    );
    return result.fold(ok: (_) => const Ok(null), err: Err.new);
  }

  @override
  Future<Result<List<InventorySnapshot>, AppFailure>> listInventory(
    EntityId storeId,
  ) async {
    final result = await _api.getMap(
      ApiRoutes.storeInventory,
      trace: TraceContext(
        traceId: 'store-inventory-${storeId.value}',
        requestId: 'store-inventory-${storeId.value}',
      ),
      queryParameters: {'store_id': storeId.value},
    );
    return result.fold(
      ok: (json) => Ok(_inventoryList(json['inventory'] ?? json['items'])),
      err: Err.new,
    );
  }

  @override
  Future<Result<void, AppFailure>> adjustInventory(
    StoreInventoryCommand command,
  ) async {
    final result = await _api.postCommand(
      ApiRoutes.storeInventoryAdjust,
      trace: _traceFromCommand(command.metadata),
      idempotencyKey: command.metadata.idempotencyKey,
      payload: {
        'storeId': command.storeId.value,
        'variantId': command.variantId.value,
        'delta': command.delta,
        'reason': command.reason,
      },
    );
    return result.fold(ok: (_) => const Ok(null), err: Err.new);
  }
}

List<StoreQueueItem> _queueList(Object? value) {
  return ((value as List?) ?? const []).map(_queueItemFromJson).toList();
}

List<PickListItem> _pickList(Object? value) {
  return ((value as List?) ?? const []).map(_pickListItemFromJson).toList();
}

List<InventorySnapshot> _inventoryList(Object? value) {
  return ((value as List?) ?? const []).map(_inventoryFromJson).toList();
}

StoreQueueItem _queueItemFromJson(Object? value) {
  final json = (value as Map).cast<String, Object?>();
  return StoreQueueItem(
    orderId: EntityId(_string(json, 'orderId', 'id')),
    storeId: EntityId(_string(json, 'storeId', 'store_id')),
    status:
        OrderStatus.fromJson(json['status'] ?? OrderStatus.confirmed.toJson()),
    createdAt: _date(json, 'createdAt', 'created_at'),
    promisedReadyAt: _nullableDate(
            json, 'promisedReadyAt', 'promised_eta_at') ??
        _date(json, 'createdAt', 'created_at').add(const Duration(minutes: 8)),
    itemCount: _int(json, 'itemCount', 'item_count') ?? 0,
    version: json['version'] as int? ?? 0,
    assignedRiderId:
        _nullableString(json, 'assignedRiderId', 'rider_id') == null
            ? null
            : EntityId(_nullableString(json, 'assignedRiderId', 'rider_id')!),
  );
}

PickListItem _pickListItemFromJson(Object? value) {
  final json = (value as Map).cast<String, Object?>();
  return PickListItem(
    itemId: EntityId(_string(json, 'itemId', 'id')),
    variantId: EntityId(_string(json, 'variantId', 'variant_id')),
    name: _nullableString(json, 'name', 'product_name') ??
        _nullableString(json, 'variantName', 'variant_name') ??
        'Item ${_string(json, 'itemId', 'id').substring(0, 8)}',
    quantity: _int(json, 'quantity') ?? 1,
    pickedQuantity: _int(json, 'pickedQuantity', 'picked_quantity') ?? 0,
    barcode: _nullableString(json, 'barcode'),
    shelfCode: _nullableString(json, 'shelfCode', 'shelf_code'),
  );
}

InventorySnapshot _inventoryFromJson(Object? value) {
  final json = (value as Map).cast<String, Object?>();
  return InventorySnapshot(
    storeId: EntityId(_string(json, 'storeId', 'store_id')),
    variantId: EntityId(_string(json, 'variantId', 'variant_id')),
    onHand: _int(json, 'onHand', 'on_hand') ?? 0,
    reserved: _int(json, 'reserved', 'reserved_qty') ?? 0,
    safetyStock: _int(json, 'safetyStock', 'safety_stock') ?? 0,
    version: _int(json, 'version') ?? 0,
  );
}

TraceContext _traceFromCommand(CommandMetadata metadata) {
  return TraceContext(
      traceId: metadata.traceId.value, requestId: metadata.traceId.value);
}

String _string(Map<String, Object?> json, String key, [String? fallbackKey]) {
  final value = _nullableString(json, key, fallbackKey);
  if (value == null || value.isEmpty) {
    throw StateError('Missing required field $key');
  }
  return value;
}

String? _nullableString(
  Map<String, Object?> json,
  String key, [
  String? fallbackKey,
]) {
  return (json[key] ?? (fallbackKey == null ? null : json[fallbackKey]))
      as String?;
}

int? _int(Map<String, Object?> json, String key, [String? fallbackKey]) {
  final value = json[key] ?? (fallbackKey == null ? null : json[fallbackKey]);
  return (value as num?)?.toInt();
}

DateTime _date(Map<String, Object?> json, String key, [String? fallbackKey]) {
  return DateTime.parse(_string(json, key, fallbackKey));
}

DateTime? _nullableDate(
  Map<String, Object?> json,
  String key, [
  String? fallbackKey,
]) {
  final value = _nullableString(json, key, fallbackKey);
  return value == null ? null : DateTime.parse(value);
}
