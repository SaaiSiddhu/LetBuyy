import 'package:agrimore_design_system/agrimore_design_system.dart';
import 'package:agrimore_domain/agrimore_domain.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/presentation/rider_scaffold.dart';
import '../../../core/providers/rider_providers.dart';
import 'shift_controller.dart';

class ShiftPage extends ConsumerStatefulWidget {
  const ShiftPage({super.key});

  @override
  ConsumerState<ShiftPage> createState() => _ShiftPageState();
}

class _ShiftPageState extends ConsumerState<ShiftPage> {
  @override
  void initState() {
    super.initState();
    Future.microtask(
        () => ref.read(shiftControllerProvider.notifier).loadProfile());
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(shiftControllerProvider);
    final controller = ref.read(shiftControllerProvider.notifier);
    final environment = ref.watch(riderEnvironmentProvider);
    final currentLocation = GeoPoint(
      latitude: environment.defaultLatitude,
      longitude: environment.defaultLongitude,
    );
    return RiderScaffold(
      title: 'Shift',
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          EnterpriseShellBanner(
            title: state.status.name,
            subtitle: state.profile?.isVerified == true
                ? 'Verified rider. Presence is Redis-accelerated only.'
                : 'KYC pending or profile unavailable.',
          ),
          const SizedBox(height: 16),
          if (state.failure != null)
            AppErrorState(
                title: 'Shift command failed', message: state.failure!.message),
          AppButton(
            label: 'Go online',
            icon: Icons.play_arrow,
            loading: state.loading,
            onPressed: () => controller.goOnline(currentLocation),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed:
                state.loading ? null : () => controller.pause(currentLocation),
            icon: const Icon(Icons.pause),
            label: const Text('Pause'),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: state.loading
                ? null
                : () => controller.goOffline(currentLocation),
            icon: const Icon(Icons.stop),
            label: const Text('Go offline'),
          ),
          if (state.nextHeartbeatIn != null) ...[
            const SizedBox(height: 16),
            Text('Heartbeat interval: ${state.nextHeartbeatIn!.inSeconds}s'),
          ],
        ],
      ),
    );
  }
}
