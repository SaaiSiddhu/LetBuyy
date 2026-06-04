import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:shimmer/shimmer.dart';

class ShimmerButton extends StatefulWidget {
  final String text;
  final VoidCallback onPressed;
  final bool isPrimary;
  final IconData? icon;

  const ShimmerButton({
    super.key,
    required this.text,
    required this.onPressed,
    this.isPrimary = true,
    this.icon,
  });

  @override
  State<ShimmerButton> createState() => _ShimmerButtonState();
}

class _ShimmerButtonState extends State<ShimmerButton> {
  bool _isHovered = false;
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final primaryGradient = const [Color(0xFF8B5CF6), Color(0xFF7C3AED)];
    
    return MouseRegion(
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTapDown: (_) => setState(() => _isPressed = true),
        onTapUp: (_) {
          setState(() => _isPressed = false);
          widget.onPressed();
        },
        onTapCancel: () => setState(() => _isPressed = false),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          curve: Curves.easeOutCubic,
          transform: Matrix4.identity()
            ..setEntry(3, 2, 0.001)
            ..translate(0.0, _isPressed ? 2.0 : (_isHovered ? -2.0 : 0.0))
            ..scale(_isPressed ? 0.98 : (_isHovered ? 1.02 : 1.0)),
          padding: EdgeInsets.symmetric(
            horizontal: widget.isPrimary ? 32 : 28,
            vertical: widget.isPrimary ? 18 : 16,
          ),
          decoration: BoxDecoration(
            gradient: widget.isPrimary
                ? LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: primaryGradient,
                  )
                : null,
            color: widget.isPrimary ? null : Colors.white,
            borderRadius: BorderRadius.circular(50),
            border: widget.isPrimary 
                ? null 
                : Border.all(
                    color: _isHovered ? const Color(0xFF8B5CF6).withValues(alpha: 0.3) : Colors.grey.shade300,
                    width: _isHovered ? 1.5 : 1,
                  ),
            boxShadow: [
              if (widget.isPrimary)
                BoxShadow(
                  color: const Color(0xFF8B5CF6).withValues(alpha: _isPressed ? 0.2 : (_isHovered ? 0.5 : 0.35)),
                  blurRadius: _isPressed ? 15 : (_isHovered ? 30 : 20),
                  offset: Offset(0, _isPressed ? 4 : (_isHovered ? 10 : 6)),
                )
              else
                BoxShadow(
                  color: Colors.black.withValues(alpha: _isHovered ? 0.08 : 0.04),
                  blurRadius: _isHovered ? 15 : 8,
                  offset: Offset(0, _isHovered ? 6 : 3),
                ),
            ],
          ),
          child: Stack(
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    widget.text,
                    style: TextStyle(
                      color: widget.isPrimary ? Colors.white : const Color(0xFF0F172A),
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                      letterSpacing: -0.2,
                    ),
                  ),
                  if (widget.icon != null) ...[
                    const SizedBox(width: 10),
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      transform: Matrix4.identity()..translate(_isHovered ? 4.0 : 0.0, 0.0),
                      child: Icon(
                        widget.icon,
                        color: widget.isPrimary ? Colors.white : const Color(0xFF8B5CF6),
                        size: 18,
                      ),
                    ),
                  ],
                ],
              ),
              // Shimmer overlay for primary
              if (widget.isPrimary)
                Positioned.fill(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(50),
                    child: Shimmer.fromColors(
                      baseColor: Colors.transparent,
                      highlightColor: Colors.white.withValues(alpha: 0.25),
                      period: const Duration(seconds: 2),
                      child: Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(50),
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              Colors.transparent,
                              Colors.white.withValues(alpha: 0.2),
                              Colors.transparent,
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ).animate(target: _isHovered && widget.isPrimary ? 1 : 0)
            .shimmer(duration: 1500.ms, color: Colors.white.withValues(alpha: 0.15)),
      ),
    );
  }
}
