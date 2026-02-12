import 'dart:math' as math;
import 'package:flutter/material.dart';

class AnimatedMeshBackground extends StatefulWidget {
  const AnimatedMeshBackground({super.key});

  @override
  State<AnimatedMeshBackground> createState() => _AnimatedMeshBackgroundState();
}

class _AnimatedMeshBackgroundState extends State<AnimatedMeshBackground> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(seconds: 20))..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _controller,
      builder: (context, child) {
        return CustomPaint(
          size: MediaQuery.of(context).size,
          painter: MeshGradientPainter(_controller.value),
        );
      },
    );
  }
}

class MeshGradientPainter extends CustomPainter {
  final double animationValue;
  MeshGradientPainter(this.animationValue);

  @override
  void paint(Canvas canvas, Size size) {
    // Soft blobs
    _drawBlob(canvas, size, const Color(0xFFEEF2FF), 0.2, 0.2, size.width * 0.4); // Light Indigo
    _drawBlob(canvas, size, const Color(0xFFF0F9FF), 0.8, 0.3, size.width * 0.5); // Light Sky
    _drawBlob(canvas, size, const Color(0xFFFAF5FF), 0.5, 0.7, size.width * 0.45); // Light Purple
    
    // Accent blobs
    _drawBlob(canvas, size, const Color(0xFFE0E7FF).withValues(alpha: 0.4), 0.8, 0.8, 200);
    _drawBlob(canvas, size, const Color(0xFFCCFBF1).withValues(alpha: 0.4), 0.1, 0.9, 250);
  }

  void _drawBlob(Canvas canvas, Size size, Color color, double x, double y, double radius) {
    final paint = Paint()
      ..color = color
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 80);

    // Simple movement based on animation
    final dx = x * size.width + math.sin(animationValue * 2 * math.pi + x) * 30;
    final dy = y * size.height + math.cos(animationValue * 2 * math.pi + y) * 30;

    canvas.drawCircle(Offset(dx, dy), radius, paint);
  }

  @override
  bool shouldRepaint(covariant MeshGradientPainter oldDelegate) => true;
}
