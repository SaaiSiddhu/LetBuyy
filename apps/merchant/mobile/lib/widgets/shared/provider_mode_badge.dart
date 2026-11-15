import 'package:flutter/material.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

enum ProviderMode {
  sandbox,
  live;

  static ProviderMode? parse(Object? value) {
    final normalized = value?.toString().trim().toLowerCase();
    return switch (normalized) {
      'sandbox' => ProviderMode.sandbox,
      'live' => ProviderMode.live,
      _ => null,
    };
  }

  String get label => switch (this) {
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

    return Semantics(
      label: 'Provider mode ${value.label.toLowerCase()}',
      excludeSemantics: true,
      child: LetbuyyStatusBadge(
        label: value.label,
        compact: compact,
        tone: value == ProviderMode.sandbox
            ? LetbuyyStatusTone.warning
            : LetbuyyStatusTone.success,
      ),
    );
  }
}
