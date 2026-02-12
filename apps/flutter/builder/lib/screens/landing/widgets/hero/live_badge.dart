import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

/// Simple live badge without animation controller - uses flutter_animate
class SimpleLiveBadge extends StatelessWidget {
  final bool compact;
  const SimpleLiveBadge({super.key, required this.compact});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: compact ? 8 : 12, vertical: compact ? 4 : 6),
      decoration: BoxDecoration(
        color: const Color(0xFF10B981).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: const BoxDecoration(
              color: Color(0xFF10B981),
              shape: BoxShape.circle,
            ),
          ).animate(onPlay: (c) => c.repeat(reverse: true))
           .fade(begin: 0.5, end: 1.0, duration: 800.ms),
          const SizedBox(width: 5),
          Text(
            'Live', 
            style: TextStyle(
              fontSize: compact ? 8 : 10, 
              color: const Color(0xFF10B981), 
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
