import 'package:quickcommerce_design_system/quickcommerce_design_system.dart';
import 'package:quickcommerce_domain/quickcommerce_domain.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/presentation/store_scaffold.dart';
import '../../queue/presentation/store_queue_controller.dart';

class HandoffPage extends ConsumerStatefulWidget {
  const HandoffPage({super.key});

  @override
  ConsumerState<HandoffPage> createState() => _HandoffPageState();
}

class _HandoffPageState extends ConsumerState<HandoffPage> {
  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => ref.read(storeQueueControllerProvider.notifier).load(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(storeQueueControllerProvider);
    final ready = state.items
        .where((item) => item.status == OrderStatus.readyForPickup)
        .toList(growable: false);
    return StoreScaffold(
      title: 'Handoff',
      child: ready.isEmpty
          ? AppEmptyState(
              title: state.loading ? 'Loading handoffs' : 'No handoffs ready',
              message: 'Packed orders move here when they are ready for rider.',
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                for (final item in ready)
                  Card(
                    child: ListTile(
                      title:
                          Text('Order ${item.orderId.value.substring(0, 8)}'),
                      subtitle: Text(
                        item.assignedRiderId == null
                            ? 'Waiting for rider assignment'
                            : 'Rider ${item.assignedRiderId!.value.substring(0, 8)}',
                      ),
                      trailing: const Icon(Icons.verified_user_outlined),
                    ),
                  ),
              ],
            ),
    );
  }
}
