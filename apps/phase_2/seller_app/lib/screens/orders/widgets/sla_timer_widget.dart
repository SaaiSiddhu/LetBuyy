// lib/screens/orders/widgets/sla_timer_widget.dart
// Enhanced SLA Timer with Color Escalation and Animation

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

/// Live countdown SLA timer with color escalation
class SLATimerWidget extends StatefulWidget {
  final DateTime orderCreatedAt;
  final int slaHours;
  final bool compact;

  const SLATimerWidget({
    super.key,
    required this.orderCreatedAt,
    this.slaHours = 24,
    this.compact = false,
  });

  @override
  State<SLATimerWidget> createState() => _SLATimerWidgetState();
}

class _SLATimerWidgetState extends State<SLATimerWidget> {
  Timer? _timer;
  Duration _remaining = Duration.zero;
  bool _isBreached = false;

  @override
  void initState() {
    super.initState();
    _calculateRemaining();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      _calculateRemaining();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _calculateRemaining() {
    final deadline = widget.orderCreatedAt.add(Duration(hours: widget.slaHours));
    final now = DateTime.now();
    final remaining = deadline.difference(now);
    
    if (mounted) {
      setState(() {
        _remaining = remaining;
        _isBreached = remaining.isNegative;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _getColorForRemaining();
    final shouldPulse = _remaining.inHours < 2 && !_isBreached;
    final shouldShake = _isBreached;

    Widget timerWidget = Container(
      padding: EdgeInsets.symmetric(
        horizontal: widget.compact ? 8 : 12,
        vertical: widget.compact ? 4 : 6,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            _isBreached ? Icons.error_rounded : Icons.timer_rounded,
            size: widget.compact ? 14 : 16,
            color: color,
          ),
          SizedBox(width: widget.compact ? 4 : 6),
          Text(
            _formatTime(),
            style: TextStyle(
              fontSize: widget.compact ? 11 : 13,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          if (_isBreached) ...[
            SizedBox(width: widget.compact ? 4 : 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
              decoration: BoxDecoration(
                color: Colors.red,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                'BREACHED',
                style: TextStyle(
                  fontSize: widget.compact ? 8 : 9,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ],
      ),
    );

    // Apply animations
    if (shouldShake) {
      timerWidget = timerWidget
          .animate(onPlay: (c) => c.repeat(reverse: true))
          .shake(hz: 4, duration: 500.ms);
    } else if (shouldPulse) {
      timerWidget = timerWidget
          .animate(onPlay: (c) => c.repeat(reverse: true))
          .shimmer(duration: 1500.ms, color: color.withValues(alpha: 0.3));
    }

    return timerWidget;
  }

  String _formatTime() {
    final duration = _remaining.abs();
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);

    if (_isBreached) {
      // Show how much overdue
      if (hours > 0) {
        return '-${hours}h ${minutes}m';
      }
      return '-${minutes}m ${seconds}s';
    }

    // Show remaining time
    if (hours > 12) {
      return '${hours}h remaining';
    } else if (hours > 0) {
      return '${hours}h ${minutes}m';
    } else if (minutes > 0) {
      return '${minutes}m ${seconds}s';
    }
    return '${seconds}s';
  }

  Color _getColorForRemaining() {
    if (_isBreached) return const Color(0xFFB71C1C); // Dark red
    
    final hours = _remaining.inHours;
    
    if (hours > 12) return Colors.green;
    if (hours > 6) return Colors.amber;
    if (hours > 2) return Colors.orange;
    return Colors.red;
  }
}

/// Compact SLA indicator for list views
class SLAIndicator extends StatelessWidget {
  final DateTime orderCreatedAt;
  final int slaHours;

  const SLAIndicator({
    super.key,
    required this.orderCreatedAt,
    this.slaHours = 24,
  });

  @override
  Widget build(BuildContext context) {
    final deadline = orderCreatedAt.add(Duration(hours: slaHours));
    final remaining = deadline.difference(DateTime.now());
    final isBreached = remaining.isNegative;
    final hours = remaining.abs().inHours;
    
    Color color;
    if (isBreached) {
      color = Colors.red;
    } else if (hours > 12) {
      color = Colors.green;
    } else if (hours > 6) {
      color = Colors.amber;
    } else {
      color = Colors.orange;
    }

    return Container(
      width: 8,
      height: 8,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.5),
            blurRadius: 4,
          ),
        ],
      ),
    );
  }
}
