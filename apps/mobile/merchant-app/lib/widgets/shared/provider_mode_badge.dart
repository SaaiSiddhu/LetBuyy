import 'package:flutter/material.dart';

import '../../theme/app_theme_colors.dart';

enum ProviderMode {
  mock,
  sandbox,
  live;

  static ProviderMode? parse(Object? value) {
    final normalized = value?.toString().trim().toLowerCase();
    return switch (normalized) {
      'mock' => ProviderMode.mock,
      'sandbox' || 'test' => ProviderMode.sandbox,
      'live' => ProviderMode.live,
      _ => null,
    };
  }

  String get label => switch (this) {
    ProviderMode.mock => 'MOCK',
    ProviderMode.sandbox => 'SANDBOX',
    ProviderMode.live => 'LIVE',
  };
}

class ProviderModeBadge extends StatelessWidget {
  const ProviderModeBadge({
    super.key,
    required this.mode,
    this.compact = false,
  });

  final ProviderMode? mode;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final value = mode;
    if (value == null) return const SizedBox.shrink();

    final colors = AppThemeColors.of(context);
    final accent = switch (value) {
      ProviderMode.mock => colors.error,
      ProviderMode.sandbox => colors.warning,
      ProviderMode.live => colors.success,
    };

    return Semantics(
      label: 'Provider mode ${value.label.toLowerCase()}',
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: compact ? 8 : 10,
          vertical: compact ? 4 : 5,
        ),
        decoration: BoxDecoration(
          color: accent.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: accent.withValues(alpha: 0.36)),
        ),
        child: Text(
          value.label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: accent,
            fontSize: compact ? 10 : 11,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}
