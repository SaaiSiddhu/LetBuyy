import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../theme/app_theme_colors.dart';

/// Skeleton Loader for Dashboard
/// Static placeholders with one visible, reduced-motion aware pending owner.
class SkeletonLoader extends StatelessWidget {
  const SkeletonLoader({super.key});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Loading dashboard',
      liveRegion: true,
      excludeSemantics: true,
      child: SingleChildScrollView(
        physics: const NeverScrollableScrollPhysics(),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 16),
              Row(
                children: [
                  const ExcludeSemantics(child: LoadingIndicator()),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Loading dashboard',
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              // Hero card skeleton
              _SkeletonBox(
                width: double.infinity,
                height: 180,
                borderRadius: 28,
              ),
              const SizedBox(height: 24),
              // Stats grid skeleton
              Row(
                children: [
                  Expanded(child: _SkeletonBox(height: 120, borderRadius: 24)),
                  const SizedBox(width: 12),
                  Expanded(child: _SkeletonBox(height: 120, borderRadius: 24)),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(child: _SkeletonBox(height: 120, borderRadius: 24)),
                  const SizedBox(width: 12),
                  Expanded(child: _SkeletonBox(height: 120, borderRadius: 24)),
                ],
              ),
              const SizedBox(height: 24),
              // Chart skeleton
              _SkeletonBox(
                width: double.infinity,
                height: 200,
                borderRadius: 24,
              ),
              const SizedBox(height: 24),
              // Quick actions skeleton
              _SkeletonBox(width: 120, height: 20),
              const SizedBox(height: 12),
              _SkeletonBox(
                width: double.infinity,
                height: 280,
                borderRadius: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Individual static skeleton placeholder
class _SkeletonBox extends StatelessWidget {
  final double? width;
  final double height;
  final double borderRadius;

  const _SkeletonBox({
    this.width,
    required this.height,
    this.borderRadius = 12,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: colors.elevation1,
        borderRadius: BorderRadius.circular(borderRadius),
      ),
    );
  }
}

/// Reusable skeleton card for individual items
class SkeletonCard extends StatelessWidget {
  final double? width;
  final double height;
  final double borderRadius;

  const SkeletonCard({
    super.key,
    this.width,
    this.height = 100,
    this.borderRadius = 20,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: colors.elevation1,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: colors.borderSubtle),
      ),
    );
  }
}

/// Skeleton for stat cards in bento grid
class SkeletonStatCard extends StatelessWidget {
  const SkeletonStatCard({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: colors.bentoCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: colors.elevation2,
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              Container(
                width: 50,
                height: 22,
                decoration: BoxDecoration(
                  color: colors.elevation2,
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            ],
          ),
          const Spacer(),
          Container(
            width: 80,
            height: 28,
            decoration: BoxDecoration(
              color: colors.elevation2,
              borderRadius: BorderRadius.circular(6),
            ),
          ),
          const SizedBox(height: 6),
          Container(
            width: 60,
            height: 14,
            decoration: BoxDecoration(
              color: colors.elevation2,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
        ],
      ),
    );
  }
}
