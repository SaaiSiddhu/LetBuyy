import 'package:agrimore_design_system/agrimore_design_system.dart';
import 'package:agrimore_domain/agrimore_domain.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/presentation/store_scaffold.dart';
import 'inventory_controller.dart';

class InventoryPage extends ConsumerStatefulWidget {
  const InventoryPage({super.key});

  @override
  ConsumerState<InventoryPage> createState() => _InventoryPageState();
}

class _InventoryPageState extends ConsumerState<InventoryPage> {
  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => ref.read(inventoryControllerProvider.notifier).load(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(inventoryControllerProvider);
    final controller = ref.read(inventoryControllerProvider.notifier);
    return StoreScaffold(
      title: 'Inventory',
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (state.failure != null)
            AppErrorState(
              title: 'Inventory unavailable',
              message: state.failure!.message,
            )
          else if (state.loading && state.items.isEmpty)
            const Center(child: CircularProgressIndicator())
          else if (state.items.isEmpty)
            const AppEmptyState(
              title: 'No SKUs found',
              message: 'Inventory appears after the store is assigned.',
            )
          else
            ...state.items.map(
              (item) => _InventoryTile(
                item: item,
                loading: state.loading,
                onAdjust: (delta, reason) => controller.adjust(
                  item.variantId,
                  delta: delta,
                  reason: reason,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _InventoryTile extends StatelessWidget {
  const _InventoryTile({
    required this.item,
    required this.loading,
    required this.onAdjust,
  });

  final InventorySnapshot item;
  final bool loading;
  final void Function(int delta, String reason) onAdjust;

  @override
  Widget build(BuildContext context) {
    final lowStock = item.available <= item.safetyStock;
    return Card(
      child: ListTile(
        title: Text('SKU ${item.variantId.value.substring(0, 8)}'),
        subtitle: Text(
          'On hand ${item.onHand} - reserved ${item.reserved}',
        ),
        leading: Icon(
          lowStock ? Icons.warning_amber_outlined : Icons.inventory_2_outlined,
          color: lowStock ? Theme.of(context).colorScheme.error : null,
        ),
        trailing: Wrap(
          spacing: 8,
          children: [
            IconButton(
              tooltip: 'Damage',
              onPressed: loading ? null : () => onAdjust(-1, 'damaged'),
              icon: const Icon(Icons.remove),
            ),
            IconButton(
              tooltip: 'Received',
              onPressed:
                  loading ? null : () => onAdjust(10, 'received_delivery'),
              icon: const Icon(Icons.add),
            ),
          ],
        ),
      ),
    );
  }
}
