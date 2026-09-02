// lib/screens/shop/widgets/trust_badges_widget.dart
// Amazon/Flipkart-style trust badges row

import 'package:flutter/material.dart';

class TrustBadgesWidget extends StatelessWidget {
  final bool isDark;
  final bool isFreeDelivery;
  final bool hasExpress;
  final bool isVerified;

  const TrustBadgesWidget({
    super.key,
    required this.isDark,
    this.isFreeDelivery = false,
    this.hasExpress = false,
    this.isVerified = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _buildBadge(
            icon: Icons.verified_rounded,
            label: 'Genuine\nProduct',
            color: const Color(0xFF4CAF50),
            isActive: isVerified,
          ),
          _buildDivider(),
          _buildBadge(
            icon: Icons.local_shipping_rounded,
            label: isFreeDelivery ? 'Free\nDelivery' : 'Fast\nDelivery',
            color: const Color(0xFF2196F3),
            isActive: true,
          ),
          _buildDivider(),
          _buildBadge(
            icon: Icons.replay_rounded,
            label: 'Easy\nReturns',
            color: const Color(0xFFFF9800),
            isActive: true,
          ),
          _buildDivider(),
          _buildBadge(
            icon: Icons.security_rounded,
            label: 'Secure\nPayment',
            color: const Color(0xFF9C27B0),
            isActive: true,
          ),
        ],
      ),
    );
  }

  Widget _buildBadge({
    required IconData icon,
    required String label,
    required Color color,
    required bool isActive,
  }) {
    final effectiveColor = isActive ? color : Colors.grey;
    
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: effectiveColor.withValues(alpha: 0.12),
            shape: BoxShape.circle,
          ),
          child: Icon(
            icon,
            color: effectiveColor,
            size: 22,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w600,
            color: isDark ? Colors.grey[400] : Colors.grey[700],
            height: 1.3,
          ),
        ),
      ],
    );
  }

  Widget _buildDivider() {
    return Container(
      width: 1,
      height: 40,
      color: isDark ? Colors.grey[800] : Colors.grey[200],
    );
  }
}
