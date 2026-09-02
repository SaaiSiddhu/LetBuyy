import 'package:quickcommerce_domain/quickcommerce_domain.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:store_ops_app/src/core/data/store_ops_repositories.dart';
import 'package:store_ops_app/src/core/providers/store_providers.dart';
import 'package:store_ops_app/src/app.dart';

void main() {
  testWidgets('renders store operations queue', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          storeQueueRepositoryProvider
              .overrideWithValue(_FakeStoreQueueRepository()),
        ],
        child: const QuickcommerceStoreOpsApp(),
      ),
    );
    await tester.pump();

    expect(find.text('Store queue'), findsOneWidget);
    expect(find.text('Queue empty'), findsOneWidget);
  });
}

final class _FakeStoreQueueRepository implements StoreQueueRepository {
  @override
  Future<Result<List<StoreQueueItem>, AppFailure>> listQueue(
      EntityId storeId) async {
    return const Ok([]);
  }

  @override
  Stream<StoreQueueItem> watchQueue(EntityId storeId) => const Stream.empty();

  @override
  Future<Result<List<PickListItem>, AppFailure>> getPickList(
    EntityId orderId,
  ) async {
    return const Ok([]);
  }

  @override
  Future<Result<void, AppFailure>> confirmItem(
    ConfirmPickItemCommand command,
  ) async {
    return const Ok(null);
  }

  @override
  Future<Result<void, AppFailure>> pickOrder(PickPackCommand command) async {
    return const Ok(null);
  }

  @override
  Future<Result<void, AppFailure>> packOrder(PickPackCommand command) async {
    return const Ok(null);
  }

  @override
  Future<Result<void, AppFailure>> readyOrder(PickPackCommand command) async {
    return const Ok(null);
  }

  @override
  Future<Result<List<InventorySnapshot>, AppFailure>> listInventory(
    EntityId storeId,
  ) async {
    return const Ok([]);
  }

  @override
  Future<Result<void, AppFailure>> adjustInventory(
    StoreInventoryCommand command,
  ) async {
    return const Ok(null);
  }
}
