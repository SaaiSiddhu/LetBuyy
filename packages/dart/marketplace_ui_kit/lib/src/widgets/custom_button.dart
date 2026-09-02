import 'package:flutter/material.dart';
import '../themes/app_colors.dart';
import '../themes/app_text_styles.dart';

enum ButtonType { filled, outlined, text, glass }

class CustomButton extends StatefulWidget {
  final String text;
  final VoidCallback? onPressed;
  final ButtonType type;
  final bool isLoading;
  final bool isFullWidth;
  final IconData? icon;
  final Color? color;
  final Color? textColor;

  const CustomButton({
    super.key,
    required this.text,
    this.onPressed,
    this.type = ButtonType.filled,
    this.isLoading = false,
    this.isFullWidth = true,
    this.icon,
    this.color,
    this.textColor,
  });

  @override
  State<CustomButton> createState() => _CustomButtonState();
}

class _CustomButtonState extends State<CustomButton> with SingleTickerProviderStateMixin {
  late AnimationController _scaleController;
  late Animation<double> _scaleAnimation;
  bool _isHovering = false;

  @override
  void initState() {
    super.initState();
    _scaleController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.98).animate(
      CurvedAnimation(parent: _scaleController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _scaleController.dispose();
    super.dispose();
  }

  void _onTapDown(TapDownDetails details) {
    if (!widget.isLoading && widget.onPressed != null) {
      _scaleController.forward();
    }
  }

  void _onTapUp(TapUpDetails details) {
    if (!widget.isLoading && widget.onPressed != null) {
      _scaleController.reverse();
    }
  }

  void _onTapCancel() {
    if (!widget.isLoading && widget.onPressed != null) {
      _scaleController.reverse();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    Widget childContent = widget.isLoading
        ? SizedBox(
            height: 20,
            width: 20,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: widget.type == ButtonType.filled || widget.type == ButtonType.glass
                  ? Colors.white
                  : AppColors.primary,
            ),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (widget.icon != null) ...[
                Icon(widget.icon, size: 18),
                const SizedBox(width: 8),
              ],
              Text(
                widget.text,
                style: widget.type == ButtonType.filled || widget.type == ButtonType.glass
                    ? AppTextStyles.buttonMedium.copyWith(color: widget.textColor ?? Colors.white)
                    : AppTextStyles.buttonMedium.copyWith(
                        color: widget.textColor ?? (isDark ? AppColors.primaryLight : AppColors.primary)),
              ),
            ],
          );

    Widget button;
    switch (widget.type) {
      case ButtonType.filled:
        button = ElevatedButton(
          onPressed: widget.isLoading ? null : widget.onPressed,
          style: ElevatedButton.styleFrom(
            backgroundColor: widget.color ?? (isDark ? AppColors.primaryDark : AppColors.primary),
            foregroundColor: widget.textColor ?? Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
            elevation: _isHovering ? 4 : 2,
            shadowColor: (widget.color ?? AppColors.primary).withValues(alpha: 0.4),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          child: childContent,
        );
        break;
      case ButtonType.outlined:
        button = OutlinedButton(
          onPressed: widget.isLoading ? null : widget.onPressed,
          style: OutlinedButton.styleFrom(
            foregroundColor: widget.color ?? (isDark ? AppColors.primaryLight : AppColors.primary),
            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
            side: BorderSide(
              color: widget.color ?? (isDark ? AppColors.primaryLight : AppColors.primary),
              width: 1.5,
            ),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          child: childContent,
        );
        break;
      case ButtonType.text:
        button = TextButton(
          onPressed: widget.isLoading ? null : widget.onPressed,
          style: TextButton.styleFrom(
            foregroundColor: widget.color ?? (isDark ? AppColors.primaryLight : AppColors.primary),
            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          child: childContent,
        );
        break;
      case ButtonType.glass:
        button = Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            gradient: LinearGradient(
              colors: [
                (widget.color ?? Colors.white).withValues(alpha: 0.2),
                (widget.color ?? Colors.white).withValues(alpha: 0.1),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.3),
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.1),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: widget.isLoading ? null : widget.onPressed,
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
                child: Center(
                  child: childContent,
                ),
              ),
            ),
          ),
        );
        break;
    }

    return MouseRegion(
      onEnter: (_) => setState(() => _isHovering = true),
      onExit: (_) => setState(() => _isHovering = false),
      child: GestureDetector(
        onTapDown: _onTapDown,
        onTapUp: _onTapUp,
        onTapCancel: _onTapCancel,
        child: ScaleTransition(
          scale: _scaleAnimation,
          child: widget.isFullWidth
              ? SizedBox(width: double.infinity, child: button)
              : button,
        ),
      ),
    );
  }
}
