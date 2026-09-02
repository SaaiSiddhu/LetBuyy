import 'package:agrimore_design_system/agrimore_design_system.dart';
import 'package:agrimore_domain/agrimore_domain.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/presentation/store_scaffold.dart';
import 'pick_pack_controller.dart';

class PickPackPage extends ConsumerStatefulWidget {
  const PickPackPage({super.key, this.orderId});

  final String? orderId;

  @override
  ConsumerState<PickPackPage> createState() => _PickPackPageState();
}

class _PickPackPageState extends ConsumerState<PickPackPage> {
  EntityId? get _orderId =>
      widget.orderId == null ? null : EntityId(widget.orderId!);

  @override
  void initState() {
    super.initState();
    final orderId = _orderId;
    if (orderId != null) {
      Future.microtask(
        () => ref.read(pickPackControllerProvider.notifier).load(orderId),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(pickPackControllerProvider);
    final controller = ref.read(pickPackControllerProvider.notifier);
    final orderId = _orderId;
    return StoreScaffold(
      title: 'Pick and pack',
      child: orderId == null
          ? const AppEmptyState(
              title: 'Select an order',
              message: 'Open a queue item to pick and pack it.',
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                EnterpriseShellBanner(
                  title: 'Order ${orderId.value.substring(0, 8)}',
                  subtitle:
                      '${state.pickedCount} of ${state.items.length} picked',
                ),
                if (state.failure != null) ...[
                  const SizedBox(height: 12),
                  AppErrorState(
                      title: 'Command failed', message: state.failure!.message),
                ],
                if (state.lastAction != null) ...[
                  const SizedBox(height: 12),
                  Text('Last action: ${state.lastAction}'),
                ],
                const SizedBox(height: 16),
                if (state.items.isEmpty)
                  AppEmptyState(
                    title: state.loading ? 'Loading pick list' : 'No pick list',
                    message:
                        'Items will appear after the order is assigned here.',
                  )
                else
                  for (final item in state.items) ...[
                    CheckboxListTile(
                      value: item.isPicked,
                      onChanged: state.loading
                          ? null
                          : (_) => controller.confirmItem(
                                orderId,
                                item.itemId,
                                item.quantity,
                              ),
                      title: Text(item.name),
                      subtitle: Text(
                        '${item.quantity} units'
                        '${item.shelfCode == null ? '' : ' - ${item.shelfCode}'}',
                      ),
                    ),
                  ],
                const SizedBox(height: 16),
                AppButton(
                  label: 'Mark picked',
                  icon: Icons.fact_check_outlined,
                  loading: state.loading,
                  onPressed: () => controller.pick(orderId, 1),
                ),
                const SizedBox(height: 10),
                AppButton(
                  label: 'Mark packed',
                  icon: Icons.inventory_2_outlined,
                  loading: state.loading,
                  onPressed: () => controller.pack(orderId, 2),
                ),
                const SizedBox(height: 10),
                AppButton(
                  label: 'Ready for rider',
                  icon: Icons.local_shipping_outlined,
                  loading: state.loading,
                  onPressed: state.allPicked
                      ? () => controller.ready(orderId, 3)
                      : null,
                ),
              ],
            ),
    );
  }
}
