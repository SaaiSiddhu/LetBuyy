import 'package:quickcommerce_design_system/quickcommerce_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/presentation/rider_scaffold.dart';
import 'assignment_controller.dart';

class AssignmentPage extends ConsumerWidget {
  const AssignmentPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(assignmentControllerProvider);
    final controller = ref.read(assignmentControllerProvider.notifier);
    final offer = state.offer;
    return RiderScaffold(
      title: 'Assignment',
      child: offer == null
          ? const AppEmptyState(
              title: 'No active offer',
              message:
                  'Dispatch offers arrive through rider-scoped realtime channels.',
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                EnterpriseShellBanner(
                  title: 'Delivery ${offer.deliveryId.value.substring(0, 8)}',
                  subtitle: 'Expires in ${state.remaining?.inSeconds ?? 0}s',
                ),
                if (state.failure != null) ...[
                  const SizedBox(height: 12),
                  AppErrorState(
                      title: 'Assignment issue',
                      message: state.failure!.message),
                ],
                const SizedBox(height: 16),
                AppButton(
                  label: 'Accept assignment',
                  icon: Icons.check,
                  loading: state.loading,
                  onPressed: controller.accept,
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: state.loading
                      ? null
                      : () => controller.reject('not_available'),
                  icon: const Icon(Icons.close),
                  label: const Text('Reject'),
                ),
              ],
            ),
    );
  }
}
