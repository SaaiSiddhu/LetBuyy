import 'package:flutter/material.dart';

/// Simple static chart painter - no animation for performance
class SimpleChartPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final gridPaint = Paint()
      ..color = const Color(0xFFE5E7EB)
      ..strokeWidth = 0.5;

    for (int i = 1; i < 4; i++) {
      final y = size.height * (i / 4);
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    final linePaint = Paint()
      ..color = const Color(0xFF8B5CF6)
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final fillPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          const Color(0xFF8B5CF6).withValues(alpha: 0.2),
          const Color(0xFF8B5CF6).withValues(alpha: 0.0),
        ],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));

    final path = Path();
    final fillPath = Path();
    final data = [0.28, 0.42, 0.35, 0.52, 0.45, 0.62, 0.55, 0.7, 0.65, 0.78, 0.72, 0.85];

    for (int i = 0; i < data.length; i++) {
      final x = (i / (data.length - 1)) * size.width;
      final y = size.height - (data[i] * size.height * 0.88) - size.height * 0.06;

      if (i == 0) {
        path.moveTo(x, y);
        fillPath.moveTo(x, size.height);
        fillPath.lineTo(x, y);
      } else {
        path.lineTo(x, y);
        fillPath.lineTo(x, y);
      }
    }

    fillPath.lineTo(size.width, size.height);
    fillPath.close();
    canvas.drawPath(fillPath, fillPaint);
    canvas.drawPath(path, linePaint);

    // End dot
    final endY = size.height - (0.85 * size.height * 0.88) - size.height * 0.06;
    canvas.drawCircle(Offset(size.width, endY), 5, Paint()..color = const Color(0xFF8B5CF6));
    canvas.drawCircle(Offset(size.width, endY), 8, Paint()..color = const Color(0xFF8B5CF6).withValues(alpha: 0.25));
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
