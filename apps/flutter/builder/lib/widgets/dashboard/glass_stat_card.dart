import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:ui';
import 'package:flutter_animate/flutter_animate.dart';
import '../../theme/app_theme_colors.dart';

/// Premium Enhanced Glassmorphic Stat Card
/// Features: Animated gradients, glow effects, enhanced sparkline, pulse animation
class GlassStatCard extends StatefulWidget {
  final String label;
  final String value;
  final IconData icon;
  final Gradient gradient;
  final String? trend;
  final bool isPositiveTrend;
  final VoidCallback? onTap;
  final List<double>? sparklineData;
  final String? subtitle; // Optional subtitle like "This week"

  const GlassStatCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    required this.gradient,
    this.trend,
    this.isPositiveTrend = true,
    this.onTap,
    this.sparklineData,
    this.subtitle,
  });

  @override
  State<GlassStatCard> createState() => _GlassStatCardState();
}

class _GlassStatCardState extends State<GlassStatCard> 
    with TickerProviderStateMixin {
  bool _isPressed = false;
  late AnimationController _pulseController;
  late AnimationController _shimmerController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _shimmerController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return GestureDetector(
      onTapDown: (_) => setState(() => _isPressed = true),
      onTapUp: (_) {
        setState(() => _isPressed = false);
        HapticFeedback.lightImpact();
        widget.onTap?.call();
      },
      onTapCancel: () => setState(() => _isPressed = false),
      child: AnimatedScale(
        scale: _isPressed ? 0.97 : 1.0,
        duration: colors.durationFast,
        curve: Curves.easeOut,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
            child: AnimatedBuilder(
              animation: _shimmerController,
              builder: (context, child) {
                return Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        colors.glassMedium,
                        colors.glassMedium.withValues(alpha: 0.7),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: widget.gradient.colors.first.withValues(alpha: 0.2),
                      width: 1,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: widget.gradient.colors.first.withValues(alpha: 0.1),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: child,
                );
              },
              child: Stack(
                children: [
                  // Subtle gradient overlay
                  Positioned(
                    top: -20,
                    right: -20,
                    child: AnimatedBuilder(
                      animation: _pulseController,
                      builder: (context, _) {
                        return Container(
                          width: 80,
                          height: 80,
                          decoration: BoxDecoration(
                            gradient: RadialGradient(
                              colors: [
                                widget.gradient.colors.first.withValues(
                                  alpha: 0.15 + 0.05 * _pulseController.value,
                                ),
                                Colors.transparent,
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Icon & Trend Row
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          // Enhanced Gradient Icon Container
                          _buildIconContainer(),
                          // Trend Badge
                          if (widget.trend != null) _buildTrendBadge(colors),
                        ],
                      ),
                      
                      const SizedBox(height: 14),
                      
                      // Enhanced Sparkline
                      if (widget.sparklineData != null && widget.sparklineData!.isNotEmpty)
                        SizedBox(
                          height: 32,
                          child: CustomPaint(
                            size: const Size(double.infinity, 32),
                            painter: _EnhancedSparklinePainter(
                              data: widget.sparklineData!,
                              gradient: widget.gradient,
                            ),
                          ),
                        ),
                      
                      if (widget.sparklineData != null) const SizedBox(height: 12),
                      
                      // Value with animated styling
                      _buildValueSection(colors),
                      
                      const SizedBox(height: 2),
                      
                      // Label with optional subtitle
                      _buildLabelSection(colors),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildIconContainer() {
    return AnimatedBuilder(
      animation: _pulseController,
      builder: (context, child) {
        return Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            gradient: widget.gradient,
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: widget.gradient.colors.first.withValues(
                  alpha: 0.4 + 0.1 * _pulseController.value,
                ),
                blurRadius: 12 + 4 * _pulseController.value,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Icon(
            widget.icon,
            color: Colors.white,
            size: 18,
          ),
        );
      },
    );
  }

  Widget _buildTrendBadge(AppThemeColors colors) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: widget.isPositiveTrend
              ? [
                  colors.success.withValues(alpha: 0.2),
                  colors.success.withValues(alpha: 0.1),
                ]
              : [
                  colors.error.withValues(alpha: 0.2),
                  colors.error.withValues(alpha: 0.1),
                ],
        ),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: widget.isPositiveTrend
              ? colors.success.withValues(alpha: 0.3)
              : colors.error.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            widget.isPositiveTrend
                ? Icons.trending_up_rounded
                : Icons.trending_down_rounded,
            color: widget.isPositiveTrend
                ? colors.success
                : colors.error,
            size: 12,
          ),
          const SizedBox(width: 3),
          Text(
            widget.trend!,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: widget.isPositiveTrend
                  ? colors.success
                  : colors.error,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildValueSection(AppThemeColors colors) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text(
          widget.value,
          style: TextStyle(
            fontSize: 26,
            fontWeight: FontWeight.w800,
            color: colors.textPrimary,
            letterSpacing: -0.5,
            height: 1,
          ),
        ).animate(
          onPlay: (controller) => controller.forward(),
        ).fadeIn(duration: 400.ms).slideY(begin: 0.2, end: 0),
      ],
    );
  }

  Widget _buildLabelSection(AppThemeColors colors) {
    return Row(
      children: [
        Text(
          widget.label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: colors.textSecondary,
          ),
        ),
        if (widget.subtitle != null) ...[
          const SizedBox(width: 6),
          Container(
            width: 3,
            height: 3,
            decoration: BoxDecoration(
              color: colors.textSecondary.withValues(alpha: 0.5),
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            widget.subtitle!,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w400,
              color: colors.textSecondary.withValues(alpha: 0.7),
            ),
          ),
        ],
      ],
    );
  }
}

/// Compact version for smaller grid items  
class GlassStatCardCompact extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color accentColor;
  final VoidCallback? onTap;

  const GlassStatCardCompact({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    required this.accentColor,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        onTap?.call();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: colors.glassMedium,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: colors.glassMediumBorder),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: accentColor.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: accentColor, size: 16),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    value,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: colors.textPrimary,
                    ),
                  ),
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 11,
                      color: colors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Enhanced sparkline painter with gradient fill and glow
class _EnhancedSparklinePainter extends CustomPainter {
  final List<double> data;
  final Gradient gradient;

  _EnhancedSparklinePainter({required this.data, required this.gradient});

  @override
  void paint(Canvas canvas, Size size) {
    if (data.isEmpty) return;

    final maxValue = data.reduce((a, b) => a > b ? a : b);
    final minValue = data.reduce((a, b) => a < b ? a : b);
    final range = maxValue - minValue;
    
    final color = gradient.colors.first;
    
    // Line paint with glow
    final linePaint = Paint()
      ..color = color
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    // Glow paint
    final glowPaint = Paint()
      ..color = color.withValues(alpha: 0.4)
      ..strokeWidth = 6
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4);

    // Fill gradient
    final fillPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          color.withValues(alpha: 0.35),
          color.withValues(alpha: 0.05),
          color.withValues(alpha: 0.0),
        ],
        stops: const [0.0, 0.7, 1.0],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height))
      ..style = PaintingStyle.fill;

    final path = Path();
    final fillPath = Path();
    
    final stepX = size.width / (data.length - 1);
    final padding = 4.0;
    final effectiveHeight = size.height - padding * 2;
    
    for (int i = 0; i < data.length; i++) {
      final normalizedValue = range > 0 
          ? (data[i] - minValue) / range 
          : 0.5;
      final x = i * stepX;
      final y = padding + effectiveHeight - (normalizedValue * effectiveHeight);
      
      if (i == 0) {
        path.moveTo(x, y);
        fillPath.moveTo(x, size.height);
        fillPath.lineTo(x, y);
      } else {
        // Use smooth curves instead of straight lines
        final prevX = (i - 1) * stepX;
        final prevNormalizedValue = range > 0 
            ? (data[i - 1] - minValue) / range 
            : 0.5;
        final prevY = padding + effectiveHeight - (prevNormalizedValue * effectiveHeight);
        
        final midX = (prevX + x) / 2;
        path.cubicTo(midX, prevY, midX, y, x, y);
        fillPath.cubicTo(midX, prevY, midX, y, x, y);
      }
    }
    
    fillPath.lineTo(size.width, size.height);
    fillPath.close();
    
    // Draw fill first
    canvas.drawPath(fillPath, fillPaint);
    // Draw glow
    canvas.drawPath(path, glowPaint);
    // Draw main line
    canvas.drawPath(path, linePaint);
    
    // Draw end dot with glow
    if (data.isNotEmpty) {
      final lastX = (data.length - 1) * stepX;
      final lastNormalized = range > 0 
          ? (data.last - minValue) / range 
          : 0.5;
      final lastY = padding + effectiveHeight - (lastNormalized * effectiveHeight);
      
      // Glow
      canvas.drawCircle(
        Offset(lastX, lastY),
        6,
        Paint()
          ..color = color.withValues(alpha: 0.4)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4),
      );
      
      // Outer ring
      canvas.drawCircle(
        Offset(lastX, lastY),
        4,
        Paint()
          ..color = color
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2,
      );
      
      // Inner dot
      canvas.drawCircle(
        Offset(lastX, lastY),
        2,
        Paint()..color = Colors.white,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _EnhancedSparklinePainter oldDelegate) {
    return oldDelegate.data != data || oldDelegate.gradient != gradient;
  }
}
