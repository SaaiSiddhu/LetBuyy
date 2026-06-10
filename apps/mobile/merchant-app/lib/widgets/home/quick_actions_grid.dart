import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;
import 'package:flutter/services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

import '../shared/accessible_tap_region.dart';

/// Quick actions grid for dashboard
class QuickActionsGrid extends StatelessWidget {
  final VoidCallback? onEditSections;
  final VoidCallback? onTheme;
  final VoidCallback? onProducts;
  final VoidCallback? onPreview;
  final VoidCallback? onAnalytics;
  final VoidCallback? onSettings;

  const QuickActionsGrid({
    super.key,
    this.onEditSections,
    this.onTheme,
    this.onProducts,
    this.onPreview,
    this.onAnalytics,
    this.onSettings,
  });

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2, // 2 columns for wider cards
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 16,
      crossAxisSpacing: 16,
      childAspectRatio: 2.5, // Wide rectangular cards
      children: [
        _ActionCard(
          icon: Icons.layers_outlined,
          label: 'Store Layout',
          subtitle: 'Manage sections',
          color: mobile_tokens.LetbuyyColorTokens.brandPrimary, // Indigo
          onTap: onEditSections,
        ),
        _ActionCard(
          icon: Icons.palette_outlined,
          label: 'Theme & Style',
          subtitle: 'Colors, fonts, logos',
          color: const Color(0xFFEC4899), // Pink
          onTap: onTheme,
        ),
        _ActionCard(
          icon: Icons.inventory_2_outlined,
          label: 'Products',
          subtitle: 'Add or edit items',
          color: Colors.orangeAccent,
          onTap: onProducts,
        ),
        _ActionCard(
          icon: Icons.visibility_outlined,
          label: 'Live Preview',
          subtitle: 'View as customer',
          color: Colors.blueAccent,
          onTap: onPreview,
        ),
        _ActionCard(
          icon: Icons.analytics_outlined,
          label: 'Analytics',
          subtitle: 'Performance',
          color: Colors.greenAccent,
          onTap: onAnalytics,
        ),
        _ActionCard(
          icon: Icons.settings_outlined,
          label: 'Settings',
          subtitle: 'General config',
          color: Colors.blueGrey.shade200,
          onTap: onSettings,
        ),
      ],
    );
  }
}

class _ActionCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String subtitle;
  final Color color;
  final VoidCallback? onTap;

  const _ActionCard({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.color,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    void handleTap() {
      HapticFeedback.lightImpact();
      onTap?.call();
    }

    return AccessibleTapRegion(
      label: label,
      hint: subtitle,
      onTap: onTap == null ? null : handleTap,
      excludeChildSemantics: true,
      child: Material(
        color: Colors.white.withValues(alpha: 0.05), // Glass
        borderRadius: BorderRadius.circular(16),
        elevation: 0,
        child: InkWell(
          onTap: onTap == null ? null : handleTap,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: color, size: 24),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.white.withValues(alpha: 0.5),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
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

/// Single action button widget
class QuickActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color? color;
  final VoidCallback? onTap;

  const QuickActionButton({
    super.key,
    required this.icon,
    required this.label,
    this.color,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveColor = color ?? AppColors.primary;

    void handleTap() {
      HapticFeedback.lightImpact();
      onTap?.call();
    }

    return AccessibleTapRegion(
      label: label,
      onTap: onTap == null ? null : handleTap,
      excludeChildSemantics: true,
      child: GestureDetector(
        onTap: onTap == null ? null : handleTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: effectiveColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: effectiveColor.withValues(alpha: 0.3)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: effectiveColor, size: 20),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  color: effectiveColor,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
