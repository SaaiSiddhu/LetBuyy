import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../services/subscription_catalog.dart';

/// Presentation of the existing billing model. Unknown and unlimited allowances
/// have no determinate meter; quota arithmetic remains in MerchantBillingState.
class MerchantProductUsage extends StatelessWidget {
  const MerchantProductUsage({super.key, required this.billing});
  final MerchantBillingState? billing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final fraction = billing?.productUsageFraction;
    final percent = fraction == null ? null : fraction * 100;
    final unlimited =
        billing?.productLimitKnown == true && billing?.productLimit == null;
    final color = percent == null || unlimited
        ? scheme.onSurfaceVariant
        : percent >= 90
        ? scheme.error
        : scheme.primary;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          billing?.productUsageLabel ?? 'Product usage unavailable',
          style: theme.textTheme.bodyMedium?.copyWith(
            color: scheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: LetbuyySpacingTokens.space8),
        Text(
          fraction == null
              ? '—'
              : unlimited
              ? '∞'
              : '${percent!.toInt()}%',
          style: theme.textTheme.labelLarge?.copyWith(color: color),
        ),
        if (fraction != null && !unlimited) ...[
          const SizedBox(height: LetbuyySpacingTokens.space8),
          LinearProgressIndicator(
            value: fraction,
            semanticsLabel: 'Product allowance used',
            backgroundColor: scheme.surfaceContainerHighest,
            color: color,
          ),
        ],
      ],
    );
  }
}
