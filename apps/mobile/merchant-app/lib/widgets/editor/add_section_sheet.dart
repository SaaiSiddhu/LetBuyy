import 'package:flutter/material.dart';
import '../../theme/app_theme_colors.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

/// Bottom sheet for adding new sections - Dark Theme
class AddSectionSheet extends StatelessWidget {
  final List<SectionType> existingSectionTypes;

  const AddSectionSheet({
    super.key,
    this.existingSectionTypes = const [],
  });

  static Future<SectionType?> show(
    BuildContext context, {
    List<SectionType> existingSectionTypes = const [],
  }) {
    return showModalBottomSheet<SectionType>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => AddSectionSheet(
        existingSectionTypes: existingSectionTypes,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    // Available section types (excluding already added or restricted ones)
    final availableTypes = SectionType.values.where((type) {
      // Skip header and footer - they're always present
      if (type == SectionType.header || type == SectionType.footer) return false;
      // Skip already added sections
      if (existingSectionTypes.contains(type)) return false;
      return true;
    }).toList();

    return Container(
      height: MediaQuery.of(context).size.height * 0.7,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(color: colors.cardBorder),
      ),
      child: Column(
        children: [
          // Handle
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: colors.textTertiary,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFF8B5CF6).withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.add_box_rounded,
                    color: Color(0xFF8B5CF6),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Add Section',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: colors.textPrimary,
                        ),
                      ),
                      Text(
                        'Choose a section to add to your store',
                        style: TextStyle(
                          color: colors.textSecondary,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: Icon(Icons.close_rounded, color: colors.textSecondary),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          
          Divider(color: colors.divider, height: 1),
          
          // Section grid
          Expanded(
            child: GridView.builder(
              padding: const EdgeInsets.all(20),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 1.2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
              ),
              itemCount: availableTypes.length,
              itemBuilder: (context, index) {
                final type = availableTypes[index];
                return _SectionTypeCard(
                  type: type,
                  onTap: () {
                    HapticFeedback.mediumImpact();
                    Navigator.pop(context, type);
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionTypeCard extends StatelessWidget {
  final SectionType type;
  final VoidCallback? onTap;

  const _SectionTypeCard({
    required this.type,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: colors.surfaceVariant,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: colors.cardBorder),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: const Color(0xFF8B5CF6).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                type.icon,
                color: const Color(0xFF8B5CF6),
                size: 24,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              type.displayName,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: colors.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
