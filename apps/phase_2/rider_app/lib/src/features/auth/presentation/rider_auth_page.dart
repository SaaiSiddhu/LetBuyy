import 'package:agrimore_design_system/agrimore_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'rider_auth_controller.dart';

class RiderAuthPage extends ConsumerWidget {
  const RiderAuthPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(riderAuthControllerProvider);
    final controller = ref.read(riderAuthControllerProvider.notifier);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Rider login',
                      style: Theme.of(context).textTheme.headlineSmall),
                  const SizedBox(height: 16),
                  TextField(
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      labelText: 'Phone number',
                      prefixIcon: Icon(Icons.phone_outlined),
                    ),
                    onChanged: controller.setPhone,
                  ),
                  if (state.otpRequested) ...[
                    const SizedBox(height: 12),
                    TextField(
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'OTP',
                        prefixIcon: Icon(Icons.password_outlined),
                      ),
                      onChanged: controller.setOtp,
                    ),
                  ],
                  if (state.failure != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      state.failure!.message,
                      style:
                          TextStyle(color: Theme.of(context).colorScheme.error),
                    ),
                  ],
                  const SizedBox(height: 20),
                  AppButton(
                    label: state.otpRequested ? 'Verify' : 'Send OTP',
                    icon: Icons.arrow_forward,
                    loading: state.loading,
                    onPressed: state.otpRequested
                        ? controller.verifyOtp
                        : controller.requestOtp,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
