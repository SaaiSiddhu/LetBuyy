import 'package:quickcommerce_design_system/quickcommerce_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/presentation/store_scaffold.dart';
import '../../../app/router/store_routes.dart';
import 'store_queue_controller.dart';

class StoreQueuePage extends ConsumerStatefulWidget {
  const StoreQueuePage({super.key});

  @override
  ConsumerState<StoreQueuePage> createState() => _StoreQueuePageState();
}

class _StoreQueuePageState extends ConsumerState<StoreQueuePage> {
  @override
  void initState() {
    super.initState();
    Future.microtask(
        () => ref.read(storeQueueControllerProvider.notifier).load());
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(storeQueueControllerProvider);
    return StoreScaffold(
      title: 'Store queue',
      child: state.items.isEmpty
          ? AppEmptyState(
              title: 'Queue empty',
              message: state.loading
                  ? 'Loading active queue.'
                  : 'Realtime store queue updates will appear here.',
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                EnterpriseShellBanner(
                  title: 'Load ${state.loadState.name}',
                  subtitle:
                      '${state.items.length} active orders prioritized by SLA',
                ),
                const SizedBox(height: 12),
                for (final item in state.items)
                  Card(
                    child: ListTile(
                      title:
                          Text('Order ${item.orderId.value.substring(0, 8)}'),
                      subtitle:
                          Text('${item.status.name} - ${item.itemCount} items'),
                      trailing: Text(
                          '${item.slaRemaining(DateTime.now()).inMinutes}m'),
                      onTap: () => context.go(
                        StoreRoutes.pickPackForOrder(item.orderId.value),
                      ),
                    ),
                  ),
              ],
            ),
    );
  }
}
