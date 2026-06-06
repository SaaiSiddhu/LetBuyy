import 'package:flutter/material.dart';
import 'package:letbuyy_store/theme/letbuyy_color_tokens.dart' as mobile_tokens;
import '../../theme/app_theme_colors.dart';
import 'package:flutter/services.dart';

/// Bottom toolbar for the section editor
/// Contains Add Section, Layers, and Quick Actions
class EditorToolbar extends StatelessWidget {
  final VoidCallback? onAddSection;
  final VoidCallback? onShowLayers;
  final VoidCallback? onUndo;
  final VoidCallback? onRedo;
  final VoidCallback? onRefresh;
  final bool canUndo;
  final bool canRedo;

  const EditorToolbar({
    super.key,
    this.onAddSection,
    this.onShowLayers,
    this.onUndo,
    this.onRedo,
    this.onRefresh,
    this.canUndo = false,
    this.canRedo = false,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        color: colors.card,
        border: Border(top: BorderSide(color: colors.cardBorder)),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            // Add Section Button
            Expanded(
              child: _ToolbarButton(
                icon: Icons.add_rounded,
                label: 'Add Section',
                isPrimary: true,
                onTap: () {
                  HapticFeedback.lightImpact();
                  onAddSection?.call();
                },
              ),
            ),

            const SizedBox(width: 12),

            // Layers Button
            _ToolbarIconButton(
              icon: Icons.layers_outlined,
              onTap: () {
                HapticFeedback.lightImpact();
                onShowLayers?.call();
              },
            ),

            const SizedBox(width: 8),

            // Undo
            _ToolbarIconButton(
              icon: Icons.undo_rounded,
              isEnabled: canUndo,
              onTap: canUndo
                  ? () {
                      HapticFeedback.lightImpact();
                      onUndo?.call();
                    }
                  : null,
            ),

            const SizedBox(width: 8),

            // Redo
            _ToolbarIconButton(
              icon: Icons.redo_rounded,
              isEnabled: canRedo,
              onTap: canRedo
                  ? () {
                      HapticFeedback.lightImpact();
                      onRedo?.call();
                    }
                  : null,
            ),

            const SizedBox(width: 8),

            // Refresh
            _ToolbarIconButton(
              icon: Icons.refresh_rounded,
              onTap: () {
                HapticFeedback.lightImpact();
                onRefresh?.call();
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _ToolbarButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isPrimary;
  final VoidCallback? onTap;

  const _ToolbarButton({
    required this.icon,
    required this.label,
    this.isPrimary = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: isPrimary
              ? mobile_tokens.LetbuyyColorTokens.brandPrimary
              : colors.surfaceVariant,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 20,
              color: isPrimary ? Colors.white : colors.textSecondary,
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: isPrimary ? Colors.white : colors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ToolbarIconButton extends StatelessWidget {
  final IconData icon;
  final bool isEnabled;
  final VoidCallback? onTap;

  const _ToolbarIconButton({
    required this.icon,
    this.isEnabled = true,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: colors.surfaceVariant,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(
          icon,
          size: 20,
          color: isEnabled ? colors.textSecondary : colors.textTertiary,
        ),
      ),
    );
  }
}
