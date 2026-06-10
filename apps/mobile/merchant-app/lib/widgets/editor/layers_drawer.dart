import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;
import '../../theme/app_theme_colors.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

/// Side drawer showing sections in order for reordering
class LayersDrawer extends StatelessWidget {
  final List<SectionModel> sections;
  final String? selectedSectionId;
  final ValueChanged<SectionModel>? onSectionTap;
  final ValueChanged<List<SectionModel>>? onReorder;
  final ValueChanged<SectionModel>? onVisibilityToggle;
  final VoidCallback? onClose;

  const LayersDrawer({
    super.key,
    required this.sections,
    this.selectedSectionId,
    this.onSectionTap,
    this.onReorder,
    this.onVisibilityToggle,
    this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    // Separate fixed and body sections
    SectionModel? headerSection;
    SectionModel? footerSection;
    final bodySections = <SectionModel>[];

    for (final section in sections) {
      if (section.type == SectionType.header) {
        headerSection = section;
      } else if (section.type == SectionType.footer) {
        footerSection = section;
      } else {
        bodySections.add(section);
      }
    }

    return Container(
      width: 280,
      decoration: BoxDecoration(
        color: colors.card,
        border: Border(left: BorderSide(color: colors.cardBorder)),
      ),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.fromLTRB(20, 16, 12, 16),
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: colors.cardBorder)),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.layers_outlined,
                  color: colors.textPrimary,
                  size: 20,
                ),
                const SizedBox(width: 12),
                Text(
                  'Layers',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: colors.textPrimary,
                  ),
                ),
                const Spacer(),
                IconButton(
                  icon: Icon(
                    Icons.close_rounded,
                    color: colors.textSecondary,
                    size: 20,
                  ),
                  onPressed: onClose,
                ),
              ],
            ),
          ),

          // Sections list
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 12),
              children: [
                // Header (fixed)
                if (headerSection != null)
                  _LayerItem(
                    section: headerSection,
                    isSelected: headerSection.id == selectedSectionId,
                    isFixed: true,
                    onTap: () => onSectionTap?.call(headerSection!),
                    onVisibilityToggle: () =>
                        onVisibilityToggle?.call(headerSection!),
                  ),

                // Divider
                if (headerSection != null && bodySections.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.drag_indicator,
                          size: 14,
                          color: colors.textTertiary,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'Drag to reorder',
                          style: TextStyle(
                            fontSize: 11,
                            color: colors.textTertiary,
                          ),
                        ),
                      ],
                    ),
                  ),

                // Body sections (reorderable)
                ReorderableListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: bodySections.length,
                  onReorder: (oldIndex, newIndex) {
                    if (oldIndex < newIndex) newIndex -= 1;
                    final reordered = List<SectionModel>.from(bodySections);
                    final item = reordered.removeAt(oldIndex);
                    reordered.insert(newIndex, item);

                    // Reconstruct full list
                    final fullList = <SectionModel>[
                      if (headerSection != null) headerSection,
                      ...reordered,
                      if (footerSection != null) footerSection,
                    ];
                    onReorder?.call(fullList);
                  },
                  itemBuilder: (context, index) {
                    final section = bodySections[index];
                    return _LayerItem(
                      key: ValueKey(section.id),
                      section: section,
                      isSelected: section.id == selectedSectionId,
                      onTap: () => onSectionTap?.call(section),
                      onVisibilityToggle: () =>
                          onVisibilityToggle?.call(section),
                    );
                  },
                ),

                // Footer (fixed)
                if (footerSection != null)
                  _LayerItem(
                    section: footerSection,
                    isSelected: footerSection.id == selectedSectionId,
                    isFixed: true,
                    onTap: () => onSectionTap?.call(footerSection!),
                    onVisibilityToggle: () =>
                        onVisibilityToggle?.call(footerSection!),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LayerItem extends StatelessWidget {
  final SectionModel section;
  final bool isSelected;
  final bool isFixed;
  final VoidCallback? onTap;
  final VoidCallback? onVisibilityToggle;

  const _LayerItem({
    super.key,
    required this.section,
    this.isSelected = false,
    this.isFixed = false,
    this.onTap,
    this.onVisibilityToggle,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap?.call();
      },
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected
              ? mobile_tokens.LetbuyyColorTokens.brandPrimary.withValues(
                  alpha: 0.15,
                )
              : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected
                ? mobile_tokens.LetbuyyColorTokens.brandPrimary
                : Colors.transparent,
          ),
        ),
        child: Row(
          children: [
            // Drag handle or lock
            if (isFixed)
              Icon(Icons.lock_outline, size: 16, color: colors.textTertiary)
            else
              Icon(Icons.drag_indicator, size: 16, color: colors.textTertiary),

            const SizedBox(width: 12),

            // Section icon
            Icon(
              section.type.icon,
              size: 18,
              color: section.isVisible
                  ? mobile_tokens.LetbuyyColorTokens.brandPrimary
                  : colors.textTertiary,
            ),

            const SizedBox(width: 10),

            // Section name
            Expanded(
              child: Text(
                section.type.displayName,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                  color: section.isVisible
                      ? colors.textPrimary
                      : colors.textTertiary,
                  decoration: section.isVisible
                      ? null
                      : TextDecoration.lineThrough,
                ),
              ),
            ),

            // Visibility toggle
            GestureDetector(
              onTap: () {
                HapticFeedback.lightImpact();
                onVisibilityToggle?.call();
              },
              child: Icon(
                section.isVisible
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined,
                size: 18,
                color: section.isVisible
                    ? colors.textSecondary
                    : colors.textTertiary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
