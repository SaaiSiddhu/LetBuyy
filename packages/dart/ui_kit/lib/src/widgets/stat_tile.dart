import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../tokens/letbuyy_tokens.dart';

/// Displays the caller's exact metric text. This owner does not derive values,
/// permissions, trends or availability from a domain object.
class StatTile extends StatelessWidget {
  const StatTile({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.color,
    this.onTap,
    this.supportingText,
  });
  final IconData icon;
  final String label, value;
  final Color? color;
  final VoidCallback? onTap;
  final String? supportingText;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context), scheme = theme.colorScheme;
    final content = Padding(
      padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: ExcludeSemantics(
              child: Icon(icon, color: color ?? scheme.primary),
            ),
          ),
          const SizedBox(height: LetbuyySpacingTokens.space12),
          Text(label, style: theme.textTheme.labelLarge),
          const SizedBox(height: LetbuyySpacingTokens.space8),
          Text(value, style: theme.textTheme.titleLarge),
          if (supportingText != null) ...[
            const SizedBox(height: LetbuyySpacingTokens.space8),
            Text(supportingText!, style: theme.textTheme.bodySmall),
          ],
        ],
      ),
    );
    return Semantics(
      container: true,
      button: onTap != null,
      label: [
        label,
        value,
        if (supportingText != null) supportingText!,
      ].join(', '),
      onTap: onTap,
      excludeSemantics: true,
      child: Card(
        margin: EdgeInsets.zero,
        clipBehavior: Clip.antiAlias,
        child: onTap == null
            ? content
            : InkWell(excludeFromSemantics: true, onTap: onTap, child: content),
      ),
    );
  }
}

/// Responsive metric composition; text keeps the person's full scaling policy.
class StatGrid extends StatelessWidget {
  const StatGrid({
    super.key,
    required this.children,
    this.minimumTileWidth = 200,
  });
  final List<Widget> children;
  final double minimumTileWidth;
  @override
  Widget build(BuildContext context) {
    if (children.isEmpty) return const SizedBox.shrink();
    return LayoutBuilder(
      builder: (context, constraints) {
        if (!constraints.maxWidth.isFinite) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: children,
          );
        }
        const gap = LetbuyySpacingTokens.space12;
        final scale = MediaQuery.textScalerOf(context).scale(14) / 14;
        final minimum = minimumTileWidth * math.max(1, scale);
        final columns = ((constraints.maxWidth + gap) / (minimum + gap))
            .floor()
            .clamp(1, children.length);
        final width = (constraints.maxWidth - gap * (columns - 1)) / columns;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final child in children) SizedBox(width: width, child: child),
          ],
        );
      },
    );
  }
}
