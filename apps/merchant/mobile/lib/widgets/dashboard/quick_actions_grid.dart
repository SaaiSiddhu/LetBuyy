import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../shared/accessible_tap_region.dart';

/// Existing dashboard destinations, presented as native operational rows.
class QuickActionsGrid extends StatelessWidget {
  final VoidCallback? onEditorTap;
  final VoidCallback? onProductsTap;
  final VoidCallback? onOrdersTap;
  final VoidCallback? onAnalyticsTap;
  final VoidCallback? onSettingsTap;
  final int productCount;

  const QuickActionsGrid({
    super.key,
    this.onEditorTap,
    this.onProductsTap,
    this.onOrdersTap,
    this.onAnalyticsTap,
    this.onSettingsTap,
    this.productCount = 0,
  });

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Semantics(
        header: true,
        child: Text(
          'Quick Actions',
          style: Theme.of(context).textTheme.titleLarge,
        ),
      ),
      const SizedBox(height: LetbuyySpacingTokens.space12),
      Card(
        margin: EdgeInsets.zero,
        clipBehavior: Clip.antiAlias,
        child: Column(
          children: [
            _QuickActionItem(
              icon: Icons.palette_rounded,
              title: 'Customize Design',
              subtitle: 'Edit sections & layout',
              onTap: onEditorTap,
            ),
            const Divider(height: 1),
            _QuickActionItem(
              icon: Icons.inventory_2_rounded,
              title: 'Manage Products',
              subtitle: '$productCount products',
              onTap: onProductsTap,
            ),
            const Divider(height: 1),
            _QuickActionItem(
              icon: Icons.receipt_long_rounded,
              title: 'Manage Orders',
              subtitle: 'View & update orders',
              onTap: onOrdersTap,
            ),
            const Divider(height: 1),
            _QuickActionItem(
              icon: Icons.bar_chart_rounded,
              title: 'View Analytics',
              subtitle: 'Performance insights',
              onTap: onAnalyticsTap,
            ),
            const Divider(height: 1),
            _QuickActionItem(
              icon: Icons.settings_rounded,
              title: 'Store Settings',
              subtitle: 'Domain, SEO, billing',
              onTap: onSettingsTap,
            ),
          ],
        ),
      ),
    ],
  );
}

class _QuickActionItem extends StatefulWidget {
  const _QuickActionItem({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.onTap,
  });
  final IconData icon;
  final String title, subtitle;
  final VoidCallback? onTap;
  @override
  State<_QuickActionItem> createState() => _QuickActionItemState();
}

class _QuickActionItemState extends State<_QuickActionItem> {
  final _focus = FocusNode(debugLabel: 'Dashboard quick action');
  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  void _activate() {
    if (widget.onTap == null) return;
    HapticFeedback.selectionClick();
    widget.onTap!();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AccessibleTapRegion(
      focusNode: _focus,
      label: widget.title,
      hint: widget.subtitle,
      onTap: widget.onTap == null ? null : _activate,
      excludeChildSemantics: true,
      child: InkWell(
        focusNode: _focus,
        excludeFromSemantics: true,
        onTap: widget.onTap == null ? null : _activate,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: Padding(
            padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ExcludeSemantics(
                  child: Icon(
                    widget.icon,
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(width: LetbuyySpacingTokens.space12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(widget.title, style: theme.textTheme.titleMedium),
                      const SizedBox(height: LetbuyySpacingTokens.space8),
                      Text(widget.subtitle, style: theme.textTheme.bodyMedium),
                    ],
                  ),
                ),
                const SizedBox(width: LetbuyySpacingTokens.space8),
                ExcludeSemantics(
                  child: Icon(
                    Icons.chevron_right_rounded,
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Compatibility surface for existing compact action callers. Native feedback
/// replaces the old press-scale controller, including under reduced motion.
class QuickActionPill extends StatefulWidget {
  const QuickActionPill({
    super.key,
    required this.icon,
    required this.label,
    required this.color,
    this.onTap,
  });
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;
  @override
  State<QuickActionPill> createState() => _QuickActionPillState();
}

class _QuickActionPillState extends State<QuickActionPill> {
  final _focus = FocusNode(debugLabel: 'Dashboard compact action');
  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  void _activate() {
    if (widget.onTap == null) return;
    HapticFeedback.lightImpact();
    widget.onTap!();
  }

  @override
  Widget build(BuildContext context) => AccessibleTapRegion(
    focusNode: _focus,
    label: widget.label,
    onTap: widget.onTap == null ? null : _activate,
    excludeChildSemantics: true,
    child: OutlinedButton.icon(
      focusNode: _focus,
      onPressed: widget.onTap == null ? null : _activate,
      style: OutlinedButton.styleFrom(minimumSize: const Size(48, 48)),
      icon: Icon(widget.icon),
      label: Text(widget.label),
    ),
  );
}
