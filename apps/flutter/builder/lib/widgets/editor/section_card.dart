import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

/// Individual section card for the editor
class SectionCard extends StatelessWidget {
  final SectionModel section;
  final bool isFirst;
  final bool isLast;
  final VoidCallback? onSettings;
  final VoidCallback? onVisibilityToggle;
  final VoidCallback? onDelete;
  final VoidCallback? onMoveUp;
  final VoidCallback? onMoveDown;

  const SectionCard({
    super.key,
    required this.section,
    this.isFirst = false,
    this.isLast = false,
    this.onSettings,
    this.onVisibilityToggle,
    this.onDelete,
    this.onMoveUp,
    this.onMoveDown,
  });

  @override
  Widget build(BuildContext context) {
    final isRequired = section.type.isRequired;
    
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: section.isVisible ? Colors.white : Colors.grey[100],
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: section.isVisible ? Colors.grey[200]! : Colors.grey[300]!,
        ),
        boxShadow: section.isVisible
            ? [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ]
            : null,
      ),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                // Drag handle
                Icon(
                  Icons.drag_handle_rounded,
                  color: Colors.grey[400],
                  size: 24,
                ),
                const SizedBox(width: 12),
                // Icon
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    section.type.icon,
                    color: AppColors.primary,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                // Title and subtitle
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              section.settings['title'] as String? ?? 
                                  section.type.displayName,
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: section.isVisible ? null : Colors.grey,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (isRequired) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.grey[200],
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                'Required',
                                style: TextStyle(
                                  fontSize: 10,
                                  color: Colors.grey,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${section.blocks.length} blocks',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey[500],
                        ),
                      ),
                    ],
                  ),
                ),
                // Actions
                IconButton(
                  icon: Icon(
                    section.isVisible
                        ? Icons.visibility_rounded
                        : Icons.visibility_off_rounded,
                    size: 20,
                  ),
                  onPressed: () {
                    HapticFeedback.lightImpact();
                    onVisibilityToggle?.call();
                  },
                  color: section.isVisible ? AppColors.primary : Colors.grey,
                ),
                IconButton(
                  icon: const Icon(Icons.settings_rounded, size: 20),
                  onPressed: () {
                    HapticFeedback.lightImpact();
                    onSettings?.call();
                  },
                  color: Colors.grey[600],
                ),
                if (!isRequired)
                  IconButton(
                    icon: const Icon(Icons.delete_outline_rounded, size: 20),
                    onPressed: () {
                      HapticFeedback.lightImpact();
                      onDelete?.call();
                    },
                    color: Colors.red[400],
                  ),
              ],
            ),
          ),
          // Preview (collapsed)
          if (section.isVisible)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: _buildPreview(),
            ),
        ],
      ),
    );
  }

  Widget _buildPreview() {
    // Simple preview based on section type
    return Container(
      height: 60,
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Center(
        child: Text(
          section.type.description,
          style: TextStyle(
            fontSize: 12,
            color: Colors.grey[500],
          ),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}
