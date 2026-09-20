// lib/screens/products/widgets/bulk_actions_panel.dart
// 🔧 BULK ACTIONS PANEL - Multi-select operations
// ✨ Professional floating action bar

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class BulkActionsPanel extends StatelessWidget {
  final List<String> selectedProductIds;
  final VoidCallback onClearSelection;
  final VoidCallback onRefresh;

  const BulkActionsPanel({
    super.key,
    required this.selectedProductIds,
    required this.onClearSelection,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final count = selectedProductIds.length;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.15),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          // Selection count
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.check_box_rounded, color: AppColors.primary, size: 18),
                const SizedBox(width: 6),
                Text(
                  '$count selected',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const Spacer(),
          
          // Actions
          _buildAction(context, 'Activate', Icons.visibility_rounded, const Color(0xFF10B981), 
              () => _bulkActivate(context, true)),
          const SizedBox(width: 8),
          _buildAction(context, 'Deactivate', Icons.visibility_off_rounded, const Color(0xFFF59E0B), 
              () => _bulkActivate(context, false)),
          const SizedBox(width: 8),
          _buildAction(context, 'Delete', Icons.delete_rounded, const Color(0xFFEF4444), 
              () => _bulkDelete(context)),
          const SizedBox(width: 12),
          
          // Clear
          IconButton(
            onPressed: onClearSelection,
            icon: Icon(Icons.close_rounded, color: Colors.grey[500]),
            style: IconButton.styleFrom(
              backgroundColor: isDark ? Colors.grey[800] : Colors.grey[100],
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            tooltip: 'Clear Selection',
          ),
        ],
      ),
    ).animate().slideY(begin: 1, end: 0, duration: 200.ms).fadeIn();
  }

  Widget _buildAction(BuildContext context, String tooltip, IconData icon, Color color, VoidCallback onTap) {
    return IconButton(
      onPressed: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      icon: Icon(icon, color: color, size: 22),
      style: IconButton.styleFrom(
        backgroundColor: color.withValues(alpha: 0.1),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      tooltip: tooltip,
    );
  }

  Future<void> _bulkActivate(BuildContext context, bool activate) async {
    final firestore = FirebaseFirestore.instance;
    final batch = firestore.batch();
    
    for (final id in selectedProductIds) {
      batch.update(firestore.collection('products').doc(id), {
        'isActive': activate,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    }
    
    try {
      await batch.commit();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${selectedProductIds.length} products ${activate ? 'activated' : 'deactivated'}'),
          backgroundColor: activate ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
        ),
      );
      onRefresh();
      onClearSelection();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
      );
    }
  }

  Future<void> _bulkDelete(BuildContext context) async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
        title: Text(
          'Delete ${selectedProductIds.length} products?',
          style: TextStyle(color: isDark ? Colors.white : Colors.black),
        ),
        content: Text(
          'This action cannot be undone. Products will be permanently deleted.',
          style: TextStyle(color: Colors.grey[500]),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEF4444)),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    
    if (confirm != true) return;
    
    final firestore = FirebaseFirestore.instance;
    final batch = firestore.batch();
    
    for (final id in selectedProductIds) {
      batch.delete(firestore.collection('products').doc(id));
    }
    
    try {
      await batch.commit();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${selectedProductIds.length} products deleted'),
          backgroundColor: const Color(0xFFEF4444),
        ),
      );
      onRefresh();
      onClearSelection();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
      );
    }
  }
}
