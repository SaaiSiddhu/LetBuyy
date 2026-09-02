import 'package:quickcommerce_domain/quickcommerce_domain.dart';
import 'package:quickcommerce_offline/quickcommerce_offline.dart';
import 'package:test/test.dart';

void main() {
  test('in-memory offline store persists cache records and pending mutations',
      () async {
    final store = InMemoryOfflineStore();
    await store.initialize();
    await store.put(
      CacheRecord(
        key: 'active',
        namespace: 'cart',
        payload: const {'items': []},
        updatedAt: DateTime.utc(2026),
      ),
    );

    expect((await store.get('cart', 'active'))?.payload['items'], isEmpty);

    final mutation = PendingMutation(
      id: 'cart-idem-123456',
      feature: 'cart',
      operation: 'update_item',
      payload: const {'quantity': 2},
      idempotencyKey: IdempotencyKey('cart-idem-123456'),
      traceId: TraceId('trace-123456'),
      createdAt: DateTime.utc(2026),
      expiresAt: DateTime.utc(2027),
      attemptCount: 0,
      status: PendingMutationStatus.pending,
    );
    await store.enqueue(mutation);

    expect(await store.pendingMutations(), hasLength(1));
  });
}
