import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../theme/app_theme_colors.dart';

/// Simple Settings tile - No Card, No Ripple
class SettingsTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Color? iconColor;
  final Widget? trailing;
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
    this.onTap,
    this.showArrow = true,
    this.isDestructive = false,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final effectiveColor = isDestructive 
        ? const Color(0xFFEF4444) 
        : (iconColor ?? colors.textSecondary);

    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        onTap?.call();
      },
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 0),
        child: Row(
          children: [
            // Simple icon
            Icon(
              icon,
              color: effectiveColor,
              size: 22,
            ),
            const SizedBox(width: 16),
            // Text
            Expanded(
              child: Text(
                title,
                style: TextStyle(
                  fontWeight: FontWeight.w400,
                  fontSize: 15,
                  color: isDestructive ? const Color(0xFFEF4444) : colors.textPrimary,
                ),
              ),
            ),
            // Trailing
            if (trailing != null)
              trailing!
            else if (subtitle != null)
              Text(
                subtitle!,
                style: TextStyle(
                  fontSize: 13,
                  color: colors.textTertiary,
                ),
              )
            else if (showArrow)
              Icon(
                Icons.chevron_right_rounded,
                color: colors.textTertiary,
                size: 20,
              ),
          ],
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
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section divider line
        Container(
          height: 8,
          color: colors.bgStart.withValues(alpha: 0.5),
        ),
        // Section title
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
          child: Text(
            title,
            style: TextStyle(
              fontSize: 14,
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

