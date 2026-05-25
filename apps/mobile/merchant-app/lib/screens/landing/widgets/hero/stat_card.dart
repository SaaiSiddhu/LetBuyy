import 'package:flutter/material.dart';

/// Stat Card widget for dashboard mockup
class StatCard extends StatelessWidget {
  final String value, label;
  final Color color;
  final IconData icon;
  final bool compact;
  
  const StatCard(this.value, this.label, this.color, this.icon, this.compact, {super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(compact ? 6 : 12),
      decoration: BoxDecoration(
        color: Colors.white, 
        borderRadius: BorderRadius.circular(compact ? 10 : 14), 
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start, 
        mainAxisSize: MainAxisSize.min, 
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween, 
            children: [
              Container(
                padding: EdgeInsets.all(compact ? 3 : 6), 
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1), 
                  borderRadius: BorderRadius.circular(6),
                ), 
                child: Icon(icon, size: compact ? 10 : 16, color: color),
              ),
              Icon(Icons.arrow_upward_rounded, size: compact ? 8 : 12, color: const Color(0xFF10B981)),
            ],
          ),
          SizedBox(height: compact ? 4 : 8),
          Text(
            value, 
            style: TextStyle(
              fontSize: compact ? 12 : 20, 
              fontWeight: FontWeight.w800, 
              color: const Color(0xFF0F172A),
            ), 
            overflow: TextOverflow.ellipsis,
          ),
          Text(
            label, 
            style: TextStyle(
              fontSize: compact ? 7 : 10, 
              color: const Color(0xFF64748B),
            ), 
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
