// lib/screens/chat/widgets/typing_indicator.dart
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

class TypingIndicator extends HookWidget {
  const TypingIndicator({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = useAnimationController(
      duration: const Duration(milliseconds: 1200),
    )..repeat();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surfaceVariant,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(20),
          topRight: Radius.circular(20),
          bottomLeft: Radius.circular(4),
          bottomRight: Radius.circular(20),
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.shadowLight,
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(3, (index) {
          return Padding(
            padding: EdgeInsets.only(right: index < 2 ? 6 : 0),
            child: _buildDot(controller, index),
          );
        }),
      ),
    );
  }
}

Widget _buildDot(AnimationController controller, int index) {
  return AnimatedBuilder(
    animation: controller,
    builder: (context, child) {
      final value = (controller.value + (index * 0.25)) % 1.0;
      final curveValue = Curves.easeInOut.transform(
        value < 0.5 ? value * 2 : (1 - value) * 2,
      );
      return Transform.scale(
        scale: 0.9 + (curveValue * 0.3),
        child: Opacity(
          opacity: 0.4 + (curveValue * 0.6),
          child: Container(
            width: 8,
            height: 8,
            decoration: const BoxDecoration(
              color: AppColors.textTertiary,
              shape: BoxShape.circle,
            ),
          ),
        ),
      );
    },
  );
}