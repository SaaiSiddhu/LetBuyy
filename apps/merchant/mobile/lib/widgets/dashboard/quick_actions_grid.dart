import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../theme/app_theme_colors.dart';
import '../shared/accessible_tap_region.dart';

/// Quick Actions Grid for Dashboard
/// Modern bento-style quick action buttons
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
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Quick Actions',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: colors.textPrimary,
          ),
        ),
        const SizedBox(height: 14),
        Container(
          decoration: colors.glassCard,
          child: Column(
            children: [
              _QuickActionItem(
                icon: Icons.palette_rounded,
                title: 'Customize Design',
                subtitle: 'Edit sections & layout',
                color: colors.accent,
                onTap: onEditorTap,
              ),
              _Divider(),
              _QuickActionItem(
                icon: Icons.inventory_2_rounded,
                title: 'Manage Products',
                subtitle: '$productCount products',
                color: colors.accentBlue,
                onTap: onProductsTap,
              ),
              _Divider(),
              _QuickActionItem(
                icon: Icons.receipt_long_rounded,
                title: 'Manage Orders',
                subtitle: 'View & update orders',
                color: colors.warning,
                onTap: onOrdersTap,
              ),
              _Divider(),
              _QuickActionItem(
                icon: Icons.bar_chart_rounded,
                title: 'View Analytics',
                subtitle: 'Performance insights',
                color: colors.success,
                onTap: onAnalyticsTap,
              ),
              _Divider(),
              _QuickActionItem(
                icon: Icons.settings_rounded,
                title: 'Store Settings',
                subtitle: 'Domain, SEO, billing',
                color: colors.textTertiary,
                onTap: onSettingsTap,
                isLast: true,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Divider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Container(height: 1, color: colors.glassMediumBorder);
  }
}

class _QuickActionItem extends StatefulWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback? onTap;
  final bool isLast;

  const _QuickActionItem({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    this.onTap,
    this.isLast = false,
  });

  @override
  State<_QuickActionItem> createState() => _QuickActionItemState();
}

class _QuickActionItemState extends State<_QuickActionItem> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return AccessibleTapRegion(
      label: widget.title,
      hint: widget.subtitle,
      onTap: widget.onTap,
      excludeChildSemantics: true,
      child: GestureDetector(
        onTapDown: (_) => setState(() => _isPressed = true),
        onTapUp: (_) {
          setState(() => _isPressed = false);
          HapticFeedback.selectionClick();
          widget.onTap?.call();
        },
        onTapCancel: () => setState(() => _isPressed = false),
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: colors.durationFast,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: _isPressed ? colors.glassHeavy : Colors.transparent,
            borderRadius: BorderRadius.vertical(
              top: widget.isLast ? Radius.zero : Radius.zero,
              bottom: widget.isLast ? const Radius.circular(20) : Radius.zero,
            ),
          ),
          child: Row(
            children: [
              // Icon with glow
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: widget.color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(widget.icon, color: widget.color, size: 20),
              ),
              const SizedBox(width: 14),
              // Text
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.title,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: colors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      widget.subtitle,
                      style: TextStyle(
                        fontSize: 12,
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              // Chevron
              Icon(
                Icons.chevron_right_rounded,
                color: colors.textTertiary,
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Compact quick action buttons for horizontal scroll
class QuickActionPill extends StatefulWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;

  const QuickActionPill({
    super.key,
    required this.icon,
    required this.label,
    required this.color,
    this.onTap,
  });

  @override
  State<QuickActionPill> createState() => _QuickActionPillState();
}

class _QuickActionPillState extends State<QuickActionPill> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return AccessibleTapRegion(
      label: widget.label,
      onTap: widget.onTap,
      excludeChildSemantics: true,
      child: GestureDetector(
        onTapDown: (_) => setState(() => _isPressed = true),
        onTapUp: (_) {
          setState(() => _isPressed = false);
          HapticFeedback.lightImpact();
          widget.onTap?.call();
        },
        onTapCancel: () => setState(() => _isPressed = false),
        child: AnimatedScale(
          scale: _isPressed ? 0.95 : 1.0,
          duration: colors.durationFast,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: colors.glassMedium,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: colors.glassMediumBorder),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: widget.color.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(widget.icon, color: widget.color, size: 16),
                ),
                const SizedBox(width: 10),
                Text(
                  widget.label,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: colors.textPrimary,
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
