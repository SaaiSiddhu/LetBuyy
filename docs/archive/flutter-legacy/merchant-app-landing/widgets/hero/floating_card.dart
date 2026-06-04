import 'package:flutter/material.dart';

/// Floating Card widget for hero mockup
class FloatingCard extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String value, label;
  final bool wide;
  final bool compact;
  
  const FloatingCard({
    super.key,
    required this.icon, 
    required this.color, 
    required this.value, 
    required this.label, 
    this.wide = false, 
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 8 : (wide ? 14 : 12), 
        vertical: compact ? 6 : 10,
      ),
      decoration: BoxDecoration(
        color: Colors.white, 
        borderRadius: BorderRadius.circular(compact ? 10 : 14), 
        border: Border.all(color: color.withValues(alpha: 0.12)), 
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06), 
            blurRadius: compact ? 12 : 20, 
            offset: const Offset(0, 6),
          ), 
          BoxShadow(
            color: color.withValues(alpha: 0.08), 
            blurRadius: compact ? 10 : 16,
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min, 
        children: [
          Container(
            padding: EdgeInsets.all(compact ? 4 : 6), 
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [color, color.withValues(alpha: 0.8)]), 
              borderRadius: BorderRadius.circular(compact ? 6 : 8), 
              boxShadow: [
                BoxShadow(
                  color: color.withValues(alpha: 0.3), 
                  blurRadius: 8, 
                  offset: const Offset(0, 2),
                ),
              ],
            ), 
            child: Icon(icon, color: Colors.white, size: compact ? 10 : 12),
          ),
          SizedBox(width: compact ? 6 : 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start, 
            mainAxisSize: MainAxisSize.min, 
            children: [
              Text(
                value, 
                style: TextStyle(
                  fontSize: compact ? 10 : 13, 
                  fontWeight: FontWeight.w800, 
                  color: color,
                ),
              ),
              Text(
                label, 
                style: TextStyle(
                  fontSize: compact ? 7 : 9, 
                  color: const Color(0xFF64748B),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
