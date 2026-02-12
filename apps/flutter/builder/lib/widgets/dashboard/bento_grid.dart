import 'package:flutter/material.dart';
import 'dart:ui';
import 'package:flutter_animate/flutter_animate.dart';
import '../../theme/app_theme_colors.dart';

/// Bento Grid Layout System
/// A flexible grid that supports variable-span items for modern dashboard layouts
class BentoGrid extends StatelessWidget {
  final List<BentoItem> children;
  final int columns;
  final double spacing;
  final EdgeInsets padding;
  final bool animate;

  const BentoGrid({
    super.key,
    required this.children,
    this.columns = 2,
    this.spacing = 12,
    this.padding = const EdgeInsets.symmetric(horizontal: 20),
    this.animate = true,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Padding(
      padding: padding,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final itemWidth = (constraints.maxWidth - (spacing * (columns - 1))) / columns;
          
          return Wrap(
            spacing: spacing,
            runSpacing: spacing,
            children: List.generate(children.length, (index) {
              final item = children[index];
              final width = item.colSpan == columns 
                  ? constraints.maxWidth 
                  : (itemWidth * item.colSpan) + (spacing * (item.colSpan - 1));
              
              Widget child = SizedBox(
                width: width,
                child: item,
              );
              
              if (animate) {
                child = child
                    .animate()
                    .fadeIn(
                      delay: Duration(milliseconds: 50 * index),
                      duration: colors.durationSlow,
                      curve: colors.defaultCurve,
                    )
                    .slideY(
                      begin: 0.1,
                      end: 0,
                      delay: Duration(milliseconds: 50 * index),
                      duration: colors.durationSlow,
                      curve: colors.defaultCurve,
                    );
              }
              
              return child;
            }),
          );
        },
      ),
    );
  }
}

/// Individual Bento Grid Item
class BentoItem extends StatelessWidget {
  final Widget child;
  final int colSpan;
  final double? height;
  final bool useGlass;
  final EdgeInsets? padding;
  final VoidCallback? onTap;

  const BentoItem({
    super.key,
    required this.child,
    this.colSpan = 1,
    this.height,
    this.useGlass = true,
    this.padding,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    Widget content = child;
    
    if (useGlass) {
      content = ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: BackdropFilter(
          filter: ImageFilter.blur(
            sigmaX: colors.glassMediumBlur,
            sigmaY: colors.glassMediumBlur,
          ),
          child: Container(
            height: height,
            padding: padding ?? const EdgeInsets.all(16),
            decoration: colors.bentoCard,
            child: child,
          ),
        ),
      );
    } else {
      content = Container(
        height: height,
        padding: padding ?? const EdgeInsets.all(16),
        child: child,
      );
    }
    
    if (onTap != null) {
      content = GestureDetector(
        onTap: onTap,
        child: content,
      );
    }
    
    return content;
  }
}

/// Simple Bento Card without backdrop filter (for better performance)
class BentoCard extends StatelessWidget {
  final Widget child;
  final EdgeInsets padding;
  final VoidCallback? onTap;
  final Color? backgroundColor;
  final Gradient? gradient;
  final double borderRadius;

  const BentoCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.backgroundColor,
    this.gradient,
    this.borderRadius = 24,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: padding,
        decoration: BoxDecoration(
          color: backgroundColor ?? colors.glassMedium,
          gradient: gradient,
          borderRadius: BorderRadius.circular(borderRadius),
          border: Border.all(color: colors.glassMediumBorder),
        ),
        child: child,
      ),
    );
  }
}
