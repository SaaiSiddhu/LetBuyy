import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Status badge showing Live, Draft, or Pending status
enum StoreStatus { live, draft, pending, error }

class StatusBadge extends StatelessWidget {
  final StoreStatus status;
  final bool showIcon;
  final double? fontSize;

  const StatusBadge({
    super.key,
    required this.status,
    this.showIcon = true,
    this.fontSize,
  });

  @override
  Widget build(BuildContext context) {
    final config = _getConfig();
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: config.backgroundColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: config.borderColor, width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (showIcon) ...[
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: config.dotColor,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 6),
          ],
          Text(
            config.label,
            style: TextStyle(
              color: config.textColor,
              fontWeight: FontWeight.w600,
              fontSize: fontSize ?? 12,
            ),
          ),
        ],
      ),
    );
  }

  _StatusConfig _getConfig() {
    switch (status) {
      case StoreStatus.live:
        return _StatusConfig(
          label: 'LIVE',
          dotColor: Colors.green,
          textColor: Colors.green[700]!,
          backgroundColor: Colors.green.withValues(alpha: 0.1),
          borderColor: Colors.green.withValues(alpha: 0.3),
        );
      case StoreStatus.draft:
        return _StatusConfig(
          label: 'DRAFT',
          dotColor: Colors.orange,
          textColor: Colors.orange[700]!,
          backgroundColor: Colors.orange.withValues(alpha: 0.1),
          borderColor: Colors.orange.withValues(alpha: 0.3),
        );
      case StoreStatus.pending:
        return _StatusConfig(
          label: 'PENDING',
          dotColor: AppColors.primary,
          textColor: AppColors.primary,
          backgroundColor: AppColors.primary.withValues(alpha: 0.1),
          borderColor: AppColors.primary.withValues(alpha: 0.3),
        );
      case StoreStatus.error:
        return _StatusConfig(
          label: 'ERROR',
          dotColor: Colors.red,
          textColor: Colors.red[700]!,
          backgroundColor: Colors.red.withValues(alpha: 0.1),
          borderColor: Colors.red.withValues(alpha: 0.3),
        );
    }
  }
}

class _StatusConfig {
  final String label;
  final Color dotColor;
  final Color textColor;
  final Color backgroundColor;
  final Color borderColor;

  _StatusConfig({
    required this.label,
    required this.dotColor,
    required this.textColor,
    required this.backgroundColor,
    required this.borderColor,
  });
}
