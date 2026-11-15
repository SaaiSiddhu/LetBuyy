import 'package:flutter/material.dart';

import '../../theme/app_theme_colors.dart';

enum FeatureAvailability {
  available,
  temporarilyUnavailable,
  desktopHandoff,
  providerSetupRequired,
}

class CapabilityGate extends StatelessWidget {
  const CapabilityGate({
    super.key,
    required this.availability,
    this.child,
    this.title,
    this.description,
    this.icon = Icons.lock_clock_rounded,
    this.primaryActionLabel,
    this.onPrimaryAction,
  });

  final FeatureAvailability availability;
  final Widget? child;
  final String? title;
  final String? description;
  final IconData icon;
  final String? primaryActionLabel;
  final VoidCallback? onPrimaryAction;

  static const _fallbackDescription =
      'Use the desktop dashboard for this workflow while mobile support is being completed.';

  @override
  Widget build(BuildContext context) {
    if (availability == FeatureAvailability.available) {
      return child ?? const SizedBox.shrink();
    }

    final colors = AppThemeColors.of(context);
    final safeTitle = _safeCopy(title, _titleForAvailability(availability));
    final safeDescription = _safeCopy(
      description,
      _descriptionForAvailability(availability),
    );

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: colors.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: colors.glassMediumBorder),
          ),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: colors.accent.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, color: colors.accent, size: 34),
                ),
                const SizedBox(height: 20),
                Text(
                  safeTitle,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  safeDescription,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: colors.textSecondary,
                    fontSize: 14,
                    height: 1.4,
                  ),
                ),
                if (primaryActionLabel != null && onPrimaryAction != null) ...[
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: onPrimaryAction,
                    child: Text(_safeCopy(primaryActionLabel, 'Continue')),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  static String _titleForAvailability(FeatureAvailability availability) {
    switch (availability) {
      case FeatureAvailability.available:
        return '';
      case FeatureAvailability.temporarilyUnavailable:
        return 'Feature temporarily unavailable';
      case FeatureAvailability.desktopHandoff:
        return 'Open this on desktop';
      case FeatureAvailability.providerSetupRequired:
        return 'Feature setup required';
    }
  }

  static String _descriptionForAvailability(FeatureAvailability availability) {
    switch (availability) {
      case FeatureAvailability.available:
        return '';
      case FeatureAvailability.temporarilyUnavailable:
        return 'This workflow is not available right now. Try again later.';
      case FeatureAvailability.desktopHandoff:
        return _fallbackDescription;
      case FeatureAvailability.providerSetupRequired:
        return 'This workflow is unavailable until setup is completed.';
    }
  }

  static String _safeCopy(String? value, String fallback) {
    final text = value?.trim();
    if (text == null || text.isEmpty) return fallback;
    for (final pattern in _internalPatterns) {
      if (pattern.hasMatch(text)) return fallback;
    }
    return text;
  }

  static final List<RegExp> _internalPatterns = [
    RegExp('SKIP_NEEDS_HUMAN', caseSensitive: false),
    RegExp('SKIP-NEEDS-BACKEND', caseSensitive: false),
    RegExp(r'\bS-0\d{2}\b'),
    RegExp('needs backend', caseSensitive: false),
    RegExp('backend contract', caseSensitive: false),
    RegExp('PlatformBlocked', caseSensitive: false),
  ];
}
