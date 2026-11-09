import 'package:flutter/material.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

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

    final safeTitle = _safeCopy(title, _titleForAvailability(availability));
    final safeDescription = _safeCopy(
      description,
      _descriptionForAvailability(availability),
    );
    return EmptyState(
      title: safeTitle,
      message: safeDescription,
      icon: icon,
      actionLabel: primaryActionLabel == null
          ? null
          : _safeCopy(primaryActionLabel, 'Continue'),
      onAction: primaryActionLabel == null || onPrimaryAction == null
          ? null
          : () {
              if (isLetbuyySurfaceCurrent(context)) onPrimaryAction!();
            },
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
