import 'package:flutter/material.dart';

/// iPad-style tablet frame with thin bezels
/// Fixed size frame - content inside scrolls
class TabletFrame extends StatelessWidget {
  final Widget child;

  const TabletFrame({
    super.key,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 420,
      height: 560,
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1C), // Space Gray
        borderRadius: BorderRadius.circular(28),
        border: Border.all(
          color: const Color(0xFF2A2A2C),
          width: 2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.4),
            blurRadius: 25,
            offset: const Offset(0, 12),
            spreadRadius: 3,
          ),
          BoxShadow(
            color: Colors.white.withValues(alpha: 0.05),
            blurRadius: 1,
            offset: const Offset(0, -1),
          ),
        ],
      ),
      child: Column(
        children: [
          // Top bezel with camera
          Container(
            height: 20,
            padding: const EdgeInsets.only(top: 8),
            child: _buildCamera(),
          ),
          
          // Screen area (scrollable content)
          Expanded(
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
              ),
              clipBehavior: Clip.antiAlias,
              child: child,
            ),
          ),
          
          // Bottom bezel
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _buildCamera() {
    return Center(
      child: Container(
        width: 6,
        height: 6,
        decoration: BoxDecoration(
          color: const Color(0xFF1C3A4A),
          shape: BoxShape.circle,
          border: Border.all(color: const Color(0xFF0A1A20), width: 1),
        ),
      ),
    );
  }
}
