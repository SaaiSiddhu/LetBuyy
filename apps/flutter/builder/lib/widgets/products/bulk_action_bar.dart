import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Bulk action bar for select all / deselect all
class BulkActionBar extends StatelessWidget {
  final int totalCount;
  final int selectedCount;
  final VoidCallback? onSelectAll;
  final VoidCallback? onDeselectAll;

  const BulkActionBar({
    super.key,
    required this.totalCount,
    required this.selectedCount,
    this.onSelectAll,
    this.onDeselectAll,
  });

  @override
  Widget build(BuildContext context) {
    final allSelected = selectedCount == totalCount;
    final noneSelected = selectedCount == 0;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          // Count info
          Expanded(
            child: RichText(
              text: TextSpan(
                style: DefaultTextStyle.of(context).style,
                children: [
                  TextSpan(
                    text: '$selectedCount',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: AppColors.primary,
                    ),
                  ),
                  TextSpan(
                    text: ' of $totalCount selected',
                    style: TextStyle(color: Colors.grey[600]),
                  ),
                ],
              ),
            ),
          ),
          // Actions
          if (!allSelected)
            TextButton(
              onPressed: onSelectAll,
              child: const Text('Select All'),
            ),
          if (!noneSelected) ...[
            const SizedBox(width: 8),
            TextButton(
              onPressed: onDeselectAll,
              style: TextButton.styleFrom(
                foregroundColor: Colors.grey[600],
              ),
              child: const Text('Deselect All'),
            ),
          ],
        ],
      ),
    );
  }
}

/// Floating bulk action bar (for bottom of screen)
class FloatingBulkActionBar extends StatelessWidget {
  final int selectedCount;
  final VoidCallback? onSave;
  final bool isSaving;

  const FloatingBulkActionBar({
    super.key,
    required this.selectedCount,
    this.onSave,
    this.isSaving = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.3),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              '$selectedCount selected',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const Spacer(),
          ElevatedButton(
            onPressed: isSaving ? null : onSave,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: AppColors.primary,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            child: isSaving
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Save'),
          ),
        ],
      ),
    );
  }
}
