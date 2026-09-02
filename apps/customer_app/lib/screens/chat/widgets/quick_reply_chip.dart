// ═══════════════════════════════════════════════════════════════════
// FILE 1: lib/screens/chat/widgets/quick_reply_chip.dart
// COPY THIS ENTIRE FILE - DO NOT MIX WITH OTHER WIDGETS
// ═══════════════════════════════════════════════════════════════════
import 'package:flutter/material.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

class QuickReplyChip extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const QuickReplyChip({
    super.key,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: AppColors.primary.withValues(alpha: 0.3),
              width: 1.5,
            ),
          ),
          child: Text(
            label,
            style: const TextStyle(
              color: AppColors.primary,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
        ),
      ),
    );
  }
}