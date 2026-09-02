// lib/screens/user/home/widgets/categories_grid.dart

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_marketplace/app/routes.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';

class CategoriesGrid extends StatefulWidget {
  const CategoriesGrid({super.key});

  @override
  State<CategoriesGrid> createState() => _CategoriesGridState();
}

class _CategoriesGridState extends State<CategoriesGrid>
    with TickerProviderStateMixin {
  late AnimationController _shimmerController;

  @override
  void initState() {
    super.initState();
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
  }

  @override
  void dispose() {
    _shimmerController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    
    // --- RESPONSIVE CALCULATIONS ---
    final double itemHeight = 75.0;
    final double spacing = 10.0;
    final double containerHeight = (itemHeight * 2) + spacing + 5;

    return Consumer<CategoryProvider>(
      builder: (context, categoryProvider, child) {
        final categories = categoryProvider.mainCategories;

        if (categories.isEmpty) return const SizedBox.shrink();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // HEADER
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
              child: _buildSectionHeader(context, categories.length, isDark),
            ),

            // 2-ROW HORIZONTAL CAROUSEL GRID
            SizedBox(
              height: containerHeight,
              child: GridView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                  childAspectRatio: 75 / 140,
                ),
                itemCount: categories.length, 
                itemBuilder: (context, index) {
                  return _buildCompactCard(
                    context, 
                    categories[index], 
                    isDark
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildCompactCard(
    BuildContext context,
    CategoryModel category,
    bool isDark,
  ) {
    final primaryColor = isDark ? AppColors.primaryLight : AppColors.primary;

    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        // ✅ FIXED: Navigate to Category Screen with the selected category ID
        Navigator.pushNamed(
          context,
          AppRoutes.categories,
          arguments: category.id, // ✅ Pass category ID so it opens with the correct category
        );
      },
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: isDark ? AppColors.surfaceDark : AppColors.surface,
          border: Border.all(
            color: (isDark ? AppColors.borderDark : AppColors.border).withValues(alpha: 0.3),
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: (isDark ? Colors.black : Colors.grey).withValues(alpha: isDark ? 0.3 : 0.12),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Stack(
            children: [
              // IMAGE BACKGROUND
              Positioned.fill(
                child: (category.iconImageUrl != null &&
                        category.iconImageUrl!.isNotEmpty)
                    ? CachedNetworkImage(
                        imageUrl: category.iconImageUrl!,
                        fit: BoxFit.cover,
                        memCacheWidth: 300,
                        placeholder: (context, url) => Container(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [
                                (isDark ? Colors.grey[850] : Colors.grey[200])!,
                                (isDark ? Colors.grey[800] : Colors.grey[100])!,
                              ],
                            ),
                          ),
                          child: Center(
                            child: Icon(
                              Icons.image_outlined,
                              size: 20,
                              color: primaryColor.withValues(alpha: 0.3),
                            ),
                          ),
                        ),
                        errorWidget: (context, url, error) => Container(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [
                                primaryColor.withValues(alpha: 0.15),
                                primaryColor.withValues(alpha: 0.05),
                              ],
                            ),
                          ),
                          child: Center(
                            child: Icon(
                              Icons.category_outlined,
                              size: 24,
                              color: primaryColor.withValues(alpha: 0.5),
                            ),
                          ),
                        ),
                      )
                    : Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              primaryColor.withValues(alpha: 0.15),
                              primaryColor.withValues(alpha: 0.05),
                            ],
                          ),
                        ),
                      ),
              ),

              // GRADIENT OVERLAY FOR TEXT READABILITY
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.transparent,
                        Colors.black.withValues(alpha: 0.75),
                      ],
                      stops: const [0.4, 1.0],
                    ),
                  ),
                ),
              ),

              // CATEGORY NAME
              Positioned(
                left: 10,
                right: 10,
                bottom: 8,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      category.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.caption.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 12,
                        height: 1.2,
                        shadows: [
                          const Shadow(
                            offset: Offset(0, 1),
                            blurRadius: 4,
                            color: Colors.black54,
                          ),
                        ],
                      ),
                    ),
                    if (category.productCount > 0) ...[
                      const SizedBox(height: 3),
                      Text(
                        '${category.productCount}+ items',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.85),
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                          shadows: [
                            const Shadow(
                              offset: Offset(0, 1),
                              blurRadius: 3,
                              color: Colors.black45,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),

              // TAP INDICATOR
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: primaryColor.withValues(alpha: 0.9),
                    borderRadius: BorderRadius.circular(6),
                    boxShadow: [
                      BoxShadow(
                        color: primaryColor.withValues(alpha: 0.4),
                        blurRadius: 6,
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.arrow_forward_ios_rounded,
                    size: 10,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionHeader(BuildContext context, int count, bool isDark) {
    final primaryColor = isDark ? AppColors.primaryLight : AppColors.primary;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Container(
              width: 4,
              height: 24,
              margin: const EdgeInsets.only(right: 10),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    primaryColor,
                    primaryColor.withValues(alpha: 0.6),
                  ],
                ),
                borderRadius: BorderRadius.circular(2),
                boxShadow: [
                  BoxShadow(
                    color: primaryColor.withValues(alpha: 0.3),
                    blurRadius: 4,
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "Browse Categories",
                  style: TextStyle(
                    fontSize: 19,
                    fontWeight: FontWeight.w900,
                    color: isDark ? AppColors.textLight : AppColors.textPrimary,
                    letterSpacing: -0.5,
                  ),
                ),
                Text(
                  "$count categories available",
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ],
        ),
        
        // VIEW ALL BUTTON
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () {
              HapticFeedback.lightImpact();
              // ✅ Navigate without arguments to show all categories (first one selected by default)
              Navigator.pushNamed(context, AppRoutes.categories);
            },
            borderRadius: BorderRadius.circular(20),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: primaryColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: primaryColor.withValues(alpha: 0.3),
                  width: 1,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    "View All",
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: primaryColor,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Icon(
                    Icons.arrow_forward_rounded,
                    size: 16,
                    color: primaryColor,
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}