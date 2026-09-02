import 'package:agrimore_design_system/agrimore_design_system.dart';
import 'package:agrimore_domain/agrimore_domain.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/presentation/rider_scaffold.dart';
import 'active_delivery_controller.dart';

class ActiveDeliveryPage extends ConsumerStatefulWidget {
  const ActiveDeliveryPage({super.key});

  @override
  ConsumerState<ActiveDeliveryPage> createState() => _ActiveDeliveryPageState();
}

class _ActiveDeliveryPageState extends ConsumerState<ActiveDeliveryPage> {
  @override
  void initState() {
    super.initState();
    Future.microtask(
        () => ref.read(activeDeliveryControllerProvider.notifier).load());
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(activeDeliveryControllerProvider);
    final controller = ref.read(activeDeliveryControllerProvider.notifier);
    final delivery = state.delivery;
    return RiderScaffold(
      title: 'Active trip',
      child: delivery == null
          ? AppEmptyState(
              title: 'No active trip',
              message:
                  state.failure?.message ?? 'Accepted deliveries appear here.',
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                EnterpriseShellBanner(
                  title: delivery.status.name,
                  subtitle: state.staleLiveState
                      ? 'Live overlay stale. Durable state remains authoritative.'
                      : 'Live delivery overlay active.',
                ),
                const SizedBox(height: 16),
                AppButton(
                  label: 'Arriving at store',
                  icon: Icons.storefront,
                  loading: state.loading,
                  onPressed: () =>
                      controller.transition(DeliveryStatus.arrivingAtStore),
                ),
                const SizedBox(height: 10),
                AppButton(
                  label: 'Picked up',
                  icon: Icons.inventory_2_outlined,
                  loading: state.loading,
                  onPressed: () =>
                      controller.transition(DeliveryStatus.pickedUp),
                ),
                const SizedBox(height: 10),
                AppButton(
                  label: 'Arriving at customer',
                  icon: Icons.near_me_outlined,
                  loading: state.loading,
                  onPressed: () =>
                      controller.transition(DeliveryStatus.arrivingAtCustomer),
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed:
                      state.loading ? null : controller.requestProofUpload,
                  icon: const Icon(Icons.camera_alt_outlined),
                  label: const Text('Create proof upload'),
                ),
                const SizedBox(height: 10),
                AppButton(
                  label: 'Complete delivery',
                  icon: Icons.check_circle_outline,
                  loading: state.loading,
                  onPressed: () =>
                      controller.transition(DeliveryStatus.delivered),
                ),
                if (state.proofUpload != null) ...[
                  const SizedBox(height: 16),
                  EnterpriseShellBanner(
                    title: state.proofUpload!.skipped
                        ? 'Proof upload skipped'
                        : 'Proof upload ready',
                    subtitle: state.proofUpload!.skipped
                        ? state.proofUpload!.reason ??
                            'R2 proof upload bucket is not configured.'
                        : state.proofUpload!.key,
                  ),
                ],
                if (state.liveState != null) ...[
                  const SizedBox(height: 16),
                  EtaBadge(etaSeconds: state.liveState!.etaSeconds),
                ],
              ],
            ),
    );
  }
}
