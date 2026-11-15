import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

import '../../theme/app_theme_colors.dart';
import '../shared/accessible_tap_region.dart';

/// Simple Settings tile - No Card, No Ripple
class SettingsTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Color? iconColor;
  final Widget? trailing;
  final bool trailingBelow;
  final VoidCallback? onTap;
  final bool showArrow;
  final bool isDestructive;

  const SettingsTile({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.iconColor,
    this.trailing,
    this.trailingBelow = false,
    this.onTap,
    this.showArrow = true,
    this.isDestructive = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = AppThemeColors.of(context);
    final effectiveColor = isDestructive
        ? theme.colorScheme.error
        : (iconColor ?? colors.textSecondary);
    final tile = Padding(
      padding: const EdgeInsets.symmetric(
        vertical: LetbuyySpacingTokens.space16,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: effectiveColor),
          const SizedBox(width: LetbuyySpacingTokens.space16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: isDestructive
                        ? theme.colorScheme.error
                        : colors.textPrimary,
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: LetbuyySpacingTokens.space4),
                  Text(
                    subtitle!,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: colors.textTertiary,
                    ),
                  ),
                ],
                if (trailing != null && trailingBelow)
                  Padding(
                    padding: const EdgeInsets.only(
                      top: LetbuyySpacingTokens.space8,
                    ),
                    child: Align(
                      alignment: AlignmentDirectional.centerEnd,
                      child: trailing,
                    ),
                  ),
              ],
            ),
          ),
          if (trailing != null && !trailingBelow)
            trailing!
          else if (trailing == null && showArrow)
            Icon(
              Icons.chevron_right_rounded,
              color: colors.textTertiary,
              size: 20,
            ),
        ],
      ),
    );

    if (onTap == null) {
      return tile;
    }

    final semanticsLabel = subtitle == null ? title : '$title, $subtitle';
    void activate() {
      HapticFeedback.selectionClick();
      onTap?.call();
    }

    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 48),
      child: AccessibleTapRegion(
        label: semanticsLabel,
        hint: 'Open $title',
        onTap: activate,
        excludeChildSemantics: true,
        child: InkWell(
          excludeFromSemantics: true,
          onTap: activate,
          child: tile,
        ),
      ),
    );
  }
}

/// Simple Settings section - Just Title + Children (No Card)
class SettingsSection extends StatelessWidget {
  final String title;
  final List<Widget> children;

  const SettingsSection({
    super.key,
    required this.title,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section divider line
        Container(height: 8, color: colors.bgStart.withValues(alpha: 0.5)),
        // Section title
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
          child: Text(
            title,
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w600,
              color: colors.textPrimary,
            ),
          ),
        ),
        // Children
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(children: children),
        ),
      ],
    );
  }
}
