// lib/screens/orders/widgets/bulk_action_bar.dart
// Floating Bulk Action Bar for Multi-Select Operations

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Floating action bar for bulk order operations
class BulkActionBar extends StatelessWidget {
  final int selectedCount;
  final VoidCallback onBulkAccept;
  final VoidCallback onBulkPack;
  final VoidCallback onBulkShip;
  final VoidCallback onBulkPrint;
  final VoidCallback onBulkCancel;
  final VoidCallback onClearSelection;
  final VoidCallback onSelectAll;
  final bool isDark;

  const BulkActionBar({
    super.key,
    required this.selectedCount,
    required this.onBulkAccept,
    required this.onBulkPack,
    required this.onBulkShip,
    required this.onBulkPrint,
    required this.onBulkCancel,
    required this.onClearSelection,
    required this.onSelectAll,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E2E) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.15),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(
          color: isDark 
              ? Colors.white.withValues(alpha: 0.1) 
              : Colors.grey.withValues(alpha: 0.2),
        ),
      ),
      child: Row(
        children: [
          // Selection Info
          _buildSelectionInfo(),
          
          const SizedBox(width: 12),
          Container(width: 1, height: 32, color: Colors.grey.withValues(alpha: 0.3)),
          const SizedBox(width: 12),
          
          // Action Buttons
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildActionChip(
                    icon: Icons.check_circle_rounded,
                    label: 'Accept',
                    color: Colors.green,
                    onTap: onBulkAccept,
                  ),
                  const SizedBox(width: 8),
                  _buildActionChip(
                    icon: Icons.inventory_2_rounded,
                    label: 'Pack',
                    color: Colors.blue,
                    onTap: onBulkPack,
                  ),
                  const SizedBox(width: 8),
                  _buildActionChip(
                    icon: Icons.local_shipping_rounded,
                    label: 'Ship',
                    color: Colors.purple,
                    onTap: onBulkShip,
                  ),
                  const SizedBox(width: 8),
                  _buildActionChip(
                    icon: Icons.print_rounded,
                    label: 'Print',
                    color: Colors.teal,
                    onTap: onBulkPrint,
                  ),
                  const SizedBox(width: 8),
                  _buildMoreMenu(),
                ],
              ),
            ),
          ),
          
          // Close button
          IconButton(
            onPressed: onClearSelection,
            icon: Icon(
              Icons.close_rounded,
              color: isDark ? Colors.grey[400] : Colors.grey[600],
            ),
            tooltip: 'Clear Selection',
          ),
        ],
      ),
    ).animate().slideY(begin: 1, end: 0, curve: Curves.easeOutCubic).fadeIn();
  }

  Widget _buildSelectionInfo() {
    return GestureDetector(
      onTap: onSelectAll,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.primary.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Center(
                child: Text(
                  '$selectedCount',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              'selected',
              style: TextStyle(
                color: isDark ? Colors.white70 : Colors.black87,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionChip({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.lightImpact();
          onTap();
        },
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: color.withValues(alpha: 0.3)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMoreMenu() {
    return PopupMenuButton<String>(
      icon: Icon(
        Icons.more_horiz_rounded,
        color: isDark ? Colors.grey[400] : Colors.grey[600],
      ),
      onSelected: (value) {
        HapticFeedback.lightImpact();
        switch (value) {
          case 'cancel':
            onBulkCancel();
            break;
        }
      },
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      itemBuilder: (context) => [
        PopupMenuItem(
          value: 'cancel',
          child: Row(
            children: [
              Icon(Icons.cancel_rounded, size: 18, color: Colors.red),
              const SizedBox(width: 10),
              const Text('Cancel Orders'),
            ],
          ),
        ),
      ],
    );
  }
}

/// Compact version for mobile
class CompactBulkActionBar extends StatelessWidget {
  final int selectedCount;
  final VoidCallback onAction;
  final VoidCallback onClear;

  const CompactBulkActionBar({
    super.key,
    required this.selectedCount,
    required this.onAction,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: AppColors.primary,
      child: Row(
        children: [
          Text(
            '$selectedCount selected',
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
            ),
          ),
          const Spacer(),
          TextButton(
            onPressed: onAction,
            child: const Text(
              'Actions',
              style: TextStyle(color: Colors.white),
            ),
          ),
          IconButton(
            onPressed: onClear,
            icon: const Icon(Icons.close, color: Colors.white),
          ),
        ],
      ),
    );
  }
}
