import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Large publish toggle card
class PublishToggleCard extends StatelessWidget {
  final bool isPublished;
  final bool isLoading;
  final ValueChanged<bool>? onToggle;

  const PublishToggleCard({
    super.key,
    required this.isPublished,
    this.isLoading = false,
    this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isPublished 
            ? const Color(0xFF22C55E).withValues(alpha: 0.1) // Green tint
            : Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isPublished 
              ? const Color(0xFF22C55E).withValues(alpha: 0.3)
              : Colors.white.withValues(alpha: 0.1),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          // Icon
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: isPublished 
                  ? const Color(0xFF22C55E)
                  : Colors.grey.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(
              isPublished ? Icons.public_rounded : Icons.public_off_rounded,
              color: Colors.white,
              size: 28,
            ),
          ),
          const SizedBox(width: 16),
          // Text
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Store Status',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.white.withValues(alpha: 0.6),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  isPublished ? 'Published' : 'Draft',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: isPublished ? const Color(0xFF22C55E) : Colors.white,
                  ),
                ),
              ],
            ),
          ),
          // Toggle
          if (isLoading)
            const SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
            )
          else
            Transform.scale(
              scale: 1.2,
              child: Switch.adaptive(
                value: isPublished,
                onChanged: (value) {
                  HapticFeedback.mediumImpact();
                  onToggle?.call(value);
                },
                activeColor: const Color(0xFF22C55E),
                activeTrackColor: const Color(0xFF22C55E).withValues(alpha: 0.4),
                inactiveThumbColor: Colors.grey[400],
                inactiveTrackColor: Colors.grey[800],
              ),
            ),
        ],
      ),
    );
  }
}

/// Compact publish button for app bars
class PublishButton extends StatelessWidget {
  final bool isPublished;
  final bool isLoading;
  final VoidCallback? onPressed;

  const PublishButton({
    super.key,
    required this.isPublished,
    this.isLoading = false,
    this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return ElevatedButton.icon(
      onPressed: isLoading ? null : onPressed,
      icon: isLoading
          ? const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
            )
          : Icon(
              isPublished ? Icons.public_off_rounded : Icons.public_rounded,
              size: 18,
            ),
      label: Text(isPublished ? 'Unpublish' : 'Publish'),
      style: ElevatedButton.styleFrom(
        backgroundColor: isPublished ? Colors.orange : AppColors.primary,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
        ),
      ),
    );
  }
}
