import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../services/platform_blocked_service.dart';
import '../../services/skip_needs_backend_exception.dart';
import '../../theme/app_theme_colors.dart';

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
          padding: const EdgeInsets.all(20),
          children: [
            Semantics(
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
            const SizedBox(height: 8),
            Text(
              feature.summary,
              style: TextStyle(color: colors.textSecondary, fontSize: 15),
            ),
            const SizedBox(height: 20),
            _StatusPanel(feature: feature, colors: colors),
            const SizedBox(height: 20),
            _ContractPanel(feature: feature, colors: colors),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: () => _verifyBackend(context),
              icon: const Icon(Icons.warning_amber_rounded),
              label: const Text('Check backend contract'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _verifyBackend(BuildContext context) async {
    try {
      await context.read<PlatformBlockedService>().requireBackend(feature);
    } on SkipNeedsBackendException catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }
}

class _StatusPanel extends StatelessWidget {
  const _StatusPanel({required this.feature, required this.colors});

  final PlatformBlockedFeature feature;
  final AppThemeColors colors;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.glassMediumBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.flag_outlined, color: colors.accent),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Feature flag',
                    style: TextStyle(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    feature.flagKey,
                    style: TextStyle(color: colors.textSecondary),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Switch.adaptive(value: false, onChanged: null),
                      const SizedBox(width: 8),
                      Text(
                        'Backend pending',
                        style: TextStyle(color: colors.textSecondary),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ContractPanel extends StatelessWidget {
  const _ContractPanel({required this.feature, required this.colors});

  final PlatformBlockedFeature feature;
  final AppThemeColors colors;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.elevation1,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.glassMediumBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Missing backend contract',
              style: TextStyle(
                color: colors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              feature.missingContract,
              style: TextStyle(color: colors.textSecondary),
            ),
            const SizedBox(height: 12),
            Text(
              '${feature.ledgerId} / ${feature.id}',
              style: TextStyle(
                color: colors.textSecondary,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
