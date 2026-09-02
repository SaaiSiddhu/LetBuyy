import 'package:agrimore_design_system/agrimore_design_system.dart';
import 'package:agrimore_domain/agrimore_domain.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/presentation/rider_scaffold.dart';
import 'earnings_controller.dart';

class EarningsPage extends ConsumerStatefulWidget {
  const EarningsPage({super.key});

  @override
  ConsumerState<EarningsPage> createState() => _EarningsPageState();
}

class _EarningsPageState extends ConsumerState<EarningsPage> {
  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => ref.read(earningsControllerProvider.notifier).load(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(earningsControllerProvider);
    final controller = ref.read(earningsControllerProvider.notifier);
    final summary = state.summary;
    return RiderScaffold(
      title: 'Earnings',
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'today', label: Text('Today')),
              ButtonSegment(value: 'week', label: Text('Week')),
              ButtonSegment(value: 'month', label: Text('Month')),
            ],
            selected: {state.period},
            onSelectionChanged: state.loading
                ? null
                : (selection) => controller.load(period: selection.single),
          ),
          const SizedBox(height: 16),
          if (state.failure != null)
            AppErrorState(
              title: 'Earnings unavailable',
              message: state.failure!.message,
            )
          else if (state.loading && summary == null)
            const Center(child: CircularProgressIndicator())
          else if (summary == null)
            const AppEmptyState(
              title: 'No earnings yet',
              message: 'Completed deliveries will appear here.',
            )
          else ...[
            EnterpriseShellBanner(
              title: _money(summary.totalEarnings),
              subtitle:
                  '${summary.totalOrders} orders - ${summary.totalDistanceMeters} m',
            ),
            const SizedBox(height: 16),
            if (summary.deliveries.isEmpty)
              const AppEmptyState(
                title: 'No delivered trips',
                message: 'Finish a delivery to create an earnings line.',
              )
            else
              ...summary.deliveries.map(_EarningTile.new),
          ],
        ],
      ),
    );
  }
}

class _EarningTile extends StatelessWidget {
  const _EarningTile(this.line);

  final RiderEarningLine line;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text('Order ${line.orderId.value.substring(0, 8)}'),
        subtitle: Text(line.deliveredAt.toLocal().toIso8601String()),
        trailing: Text(_money(line.amount)),
      ),
    );
  }
}

String _money(Money money) => 'Rs ${(money.paise / 100).toStringAsFixed(2)}';
