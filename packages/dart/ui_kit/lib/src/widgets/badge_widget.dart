import 'package:flutter/material.dart';
import '../tokens/letbuyy_tokens.dart';

enum LetbuyyStatusTone { neutral, success, warning, danger, information }

/// Existing token pairs for readable status copy. Tone conveys presentation,
/// never a domain decision or a permission grant.
class LetbuyyStatusColors {
  const LetbuyyStatusColors._();
  static ({Color background, Color foreground}) of(
    BuildContext context,
    LetbuyyStatusTone tone,
  ) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return switch (tone) {
      LetbuyyStatusTone.success => (
        background: dark
            ? LetbuyyPrimitiveTokens.green950
            : LetbuyyPrimitiveTokens.green100,
        foreground: dark
            ? LetbuyyPrimitiveTokens.green100
            : LetbuyyPrimitiveTokens.green700,
      ),
      LetbuyyStatusTone.warning => (
        background: dark
            ? LetbuyyPrimitiveTokens.amber950
            : LetbuyyPrimitiveTokens.amber100,
        foreground: dark
            ? LetbuyyPrimitiveTokens.amber100
            : LetbuyyPrimitiveTokens.amber800,
      ),
      LetbuyyStatusTone.danger => (
        background: dark
            ? LetbuyyPrimitiveTokens.red950
            : LetbuyyPrimitiveTokens.red100,
        foreground: dark
            ? LetbuyyPrimitiveTokens.red300
            : LetbuyyPrimitiveTokens.red700,
      ),
      LetbuyyStatusTone.information => (
        background: dark
            ? LetbuyyPrimitiveTokens.blue950
            : LetbuyyPrimitiveTokens.blue100,
        foreground: dark
            ? LetbuyyPrimitiveTokens.blue300
            : LetbuyyPrimitiveTokens.blue700,
      ),
      LetbuyyStatusTone.neutral => (
        background: dark
            ? LetbuyyPrimitiveTokens.purple900
            : LetbuyyPrimitiveTokens.purple100,
        foreground: dark
            ? LetbuyyPrimitiveTokens.purple200
            : LetbuyyPrimitiveTokens.purple800,
      ),
    };
  }
}

class LetbuyyStatusBadge extends StatelessWidget {
  const LetbuyyStatusBadge({
    super.key,
    required this.label,
    this.tone = LetbuyyStatusTone.neutral,
    this.compact = false,
  });
  final String label;
  final LetbuyyStatusTone tone;
  final bool compact;
  @override
  Widget build(BuildContext context) {
    final colors = LetbuyyStatusColors.of(context, tone);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(LetbuyyRadiusTokens.md * 1.0),
      ),
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: compact
              ? LetbuyySpacingTokens.space8
              : LetbuyySpacingTokens.space12,
          vertical: compact
              ? LetbuyySpacingTokens.space4
              : LetbuyySpacingTokens.space8,
        ),
        child: Text(
          label,
          style:
              (compact
                      ? Theme.of(context).textTheme.labelSmall
                      : Theme.of(context).textTheme.labelMedium)
                  ?.copyWith(color: colors.foreground),
        ),
      ),
    );
  }
}
