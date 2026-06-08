import 'package:flutter/material.dart';

import '../../services/platform_blocked_service.dart';
import '../../theme/app_theme_colors.dart';
import '../../widgets/shared/capability_gate.dart';

class PlatformBlockedScreen extends StatelessWidget {
  const PlatformBlockedScreen({super.key, required this.feature});

  final PlatformBlockedFeature feature;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Scaffold(
      backgroundColor: colors.bgStart,
      appBar: AppBar(
        title: Text(feature.title),
        backgroundColor: colors.card,
        foregroundColor: colors.textPrimary,
      ),
      body: SafeArea(
        child: ListView(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
              child: Semantics(
                header: true,
                child: Text(
                  feature.title,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
            CapabilityGate(
              availability: FeatureAvailability.desktopHandoff,
              title: 'Open this on desktop',
              description:
                  'Use the desktop dashboard for this workflow while mobile support is being completed.',
              icon: Icons.desktop_windows_rounded,
            ),
          ],
        ),
      ),
    );
  }
}
