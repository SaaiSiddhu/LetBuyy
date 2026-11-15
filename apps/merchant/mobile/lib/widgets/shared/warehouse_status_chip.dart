import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Shared presentation of already verified warehouse document status.
class WarehouseStatusChip extends StatelessWidget {
  const WarehouseStatusChip({super.key, required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final tone = switch (status) {
      'received' || 'closed' => LetbuyyStatusTone.success,
      'ordered' ||
      'reserved' ||
      'shipped' ||
      'partially_received' => LetbuyyStatusTone.warning,
      _ => LetbuyyStatusTone.neutral,
    };
    const labels = {
      'draft': 'Draft',
      'ordered': 'Ordered',
      'reserved': 'Reserved',
      'shipped': 'Shipped',
      'partially_received': 'Partially received',
      'received': 'Received',
      'cancelled': 'Cancelled',
      'closed': 'Closed',
    };
    return LetbuyyStatusBadge(
      label: labels[status] ?? 'Status unavailable',
      tone: tone,
      compact: true,
    );
  }
}
