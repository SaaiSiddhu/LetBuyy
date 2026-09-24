import 'dart:async';

import 'package:quickcommerce_domain/quickcommerce_domain.dart';
import 'package:quickcommerce_observability/quickcommerce_observability.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:store_ops_app/src/core/data/store_ops_repositories.dart';
import 'package:store_ops_app/src/features/inventory/presentation/inventory_controller.dart';
import 'package:store_ops_app/src/features/pick_pack/presentation/pick_pack_controller.dart';
import 'package:store_ops_app/src/features/queue/presentation/store_queue_controller.dart';

void main() {
  test('store queue to pick pack to inventory adjustment succeeds', () async {
    final ids = _Ids();
    final repository = _FakeStoreQueueRepository(ids);
    final traceFactory = TraceFactory();

    final queue = StoreQueueController(
      repository: repository,
      storeId: ids.storeId,
      loadPolicy: const StoreLoadPolicy(),
      slaPolicy: const SlaPolicy(),
    );
    await queue.load();

    expect(queue.state.items.single.orderId, ids.orderId);

    final pickPack = PickPackController(
      repository: repository,
      traceFactory: traceFactory,
    );
    await pickPack.load(ids.orderId);
    await pickPack.confirmItem(ids.orderId, ids.itemId, 2);
    await pickPack.pick(ids.orderId, 1);
    await pickPack.pack(ids.orderId, 2);
    await pickPack.ready(ids.orderId, 3);

    expect(pickPack.state.allPicked, true);
    expect(repository.orderStatus, OrderStatus.readyForPickup);

    final inventory = InventoryController(
      repository: repository,
      storeId: ids.storeId,
      traceFactory: traceFactory,
    );
    await inventory.load();
    await inventory.adjust(ids.variantId, delta: -1, reason: 'damaged');

    expect(inventory.state.items.single.onHand, 9);

    queue.dispose();
    pickPack.dispose();
    inventory.dispose();
  });
}

final class _Ids {
  final storeId = EntityId('00000000-0000-4000-8000-000000000701');
  final orderId = EntityId('00000000-0000-4000-8000-000000000702');
  final riderId = EntityId('00000000-0000-4000-8000-000000000703');
  final itemId = EntityId('00000000-0000-4000-8000-000000000704');
  final variantId = EntityId('00000000-0000-4000-8000-000000000705');
}

final class _FakeStoreQueueRepository implements StoreQueueRepository {
  _FakeStoreQueueRepository(this.ids);

  final _Ids ids;
  final _queue = StreamController<StoreQueueItem>.broadcast();
  OrderStatus orderStatus = OrderStatus.confirmed;
  bool itemConfirmed = false;
  int onHand = 10;

  @override
  Future<Result<void, AppFailure>> adjustInventory(
    StoreInventoryCommand command,
  ) async {
    onHand += command.delta;
    return const Ok(null);
  }

  @override
  Future<Result<void, AppFailure>> confirmItem(
    ConfirmPickItemCommand command,
  ) async {
    itemConfirmed = true;
    return const Ok(null);
  }

  @override
  Future<Result<List<PickListItem>, AppFailure>> getPickList(
    EntityId orderId,
  ) async {
    return Ok([
      PickListItem(
        itemId: ids.itemId,
        variantId: ids.variantId,
        name: 'Whole wheat atta',
        quantity: 2,
        shelfCode: 'A1',
      ),
    ]);
  }

  @override
  Future<Result<List<InventorySnapshot>, AppFailure>> listInventory(
    EntityId storeId,
  ) async {
    return Ok([
      InventorySnapshot(
        storeId: ids.storeId,
        variantId: ids.variantId,
        onHand: onHand,
        reserved: 0,
        safetyStock: 2,
        version: 1,
      ),
    ]);
  }

  @override
  Future<Result<List<StoreQueueItem>, AppFailure>> listQueue(
    EntityId storeId,
  ) async {
    return Ok([_queueItem()]);
  }

  @override
  Future<Result<void, AppFailure>> packOrder(PickPackCommand command) async {
    orderStatus = OrderStatus.packing;
    return const Ok(null);
  }

  @override
  Future<Result<void, AppFailure>> pickOrder(PickPackCommand command) async {
    orderStatus = OrderStatus.picking;
    return const Ok(null);
  }

  @override
  Future<Result<void, AppFailure>> readyOrder(PickPackCommand command) async {
    orderStatus = OrderStatus.readyForPickup;
    return const Ok(null);
  }

  @override
  Stream<StoreQueueItem> watchQueue(EntityId storeId) => _queue.stream;

  StoreQueueItem _queueItem() {
    return StoreQueueItem(
      orderId: ids.orderId,
      storeId: ids.storeId,
      status: orderStatus,
      createdAt: DateTime.utc(2026, 6, 1, 8),
      promisedReadyAt: DateTime.utc(2026, 6, 1, 8, 10),
      itemCount: 1,
      version: 1,
      assignedRiderId: ids.riderId,
    );
  }
}
