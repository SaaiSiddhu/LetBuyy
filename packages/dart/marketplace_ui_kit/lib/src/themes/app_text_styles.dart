import 'package:flutter/material.dart';

import 'app_colors.dart';
import 'app_fonts.dart';

class AppTextStyles {
  // ============================================
  // DISPLAY STYLES - Hero text for landing pages
  // ============================================
  static TextStyle displayLarge = AppFonts.poppins(
    fontSize: 32,
    fontWeight: FontWeight.bold,
    color: AppColors.textPrimary,
    letterSpacing: -0.5,
    height: 1.2,
  );
  
  static TextStyle displayMedium = AppFonts.poppins(
    fontSize: 28,
    fontWeight: FontWeight.bold,
    color: AppColors.textPrimary,
    letterSpacing: -0.5,
    height: 1.2,
  );
  
  static TextStyle displaySmall = AppFonts.poppins(
    fontSize: 24,
    fontWeight: FontWeight.bold,
    color: AppColors.textPrimary,
    letterSpacing: -0.25,
    height: 1.3,
  );
  
  // Dark theme variants
  static TextStyle displayLargeDark = displayLarge.copyWith(color: AppColors.textLight);
  static TextStyle displayMediumDark = displayMedium.copyWith(color: AppColors.textLight);
  static TextStyle displaySmallDark = displaySmall.copyWith(color: AppColors.textLight);
  
  // ============================================
  // HEADLINE STYLES - Section headers
  // ============================================
  static TextStyle headlineLarge = AppFonts.poppins(
    fontSize: 22,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimary,
    height: 1.3,
  );
  
  static TextStyle headlineMedium = AppFonts.poppins(
    fontSize: 20,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimary,
    height: 1.3,
  );
  
  static TextStyle headlineSmall = AppFonts.poppins(
    fontSize: 18,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimary,
    height: 1.4,
  );
  
  // Dark theme variants
  static TextStyle headlineLargeDark = headlineLarge.copyWith(color: AppColors.textLight);
  static TextStyle headlineMediumDark = headlineMedium.copyWith(color: AppColors.textLight);
  static TextStyle headlineSmallDark = headlineSmall.copyWith(color: AppColors.textLight);
  
  // ============================================
  // TITLE STYLES - Card titles, list items
  // ============================================
  static TextStyle titleLarge = AppFonts.inter(
    fontSize: 16,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimary,
    height: 1.5,
  );
  
  static TextStyle titleMedium = AppFonts.inter(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimary,
    height: 1.5,
  );
  
  static TextStyle titleSmall = AppFonts.inter(
    fontSize: 12,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimary,
    height: 1.5,
  );
  
  // Dark theme variants
  static TextStyle titleLargeDark = titleLarge.copyWith(color: AppColors.textLight);
  static TextStyle titleMediumDark = titleMedium.copyWith(color: AppColors.textLight);
  static TextStyle titleSmallDark = titleSmall.copyWith(color: AppColors.textLight);
  
  // ============================================
  // BODY STYLES - Main content text
  // ============================================
  static TextStyle bodyLarge = AppFonts.inter(
    fontSize: 16,
    fontWeight: FontWeight.normal,
    color: AppColors.textPrimary,
    height: 1.5,
  );
  
  static TextStyle bodyMedium = AppFonts.inter(
    fontSize: 14,
    fontWeight: FontWeight.normal,
    color: AppColors.textPrimary,
    height: 1.5,
  );
  
  static TextStyle bodySmall = AppFonts.inter(
    fontSize: 12,
    fontWeight: FontWeight.normal,
    color: AppColors.textSecondary,
    height: 1.5,
  );
  
  // Dark theme variants
  static TextStyle bodyLargeDark = bodyLarge.copyWith(color: AppColors.textLight);
  static TextStyle bodyMediumDark = bodyMedium.copyWith(color: AppColors.textLight);
  static TextStyle bodySmallDark = bodySmall.copyWith(color: AppColors.textLightSecondary);
  
  // ============================================
  // LABEL STYLES - Form labels, captions
  // ============================================
  static TextStyle labelLarge = AppFonts.inter(
    fontSize: 14,
    fontWeight: FontWeight.w500,
    color: AppColors.textPrimary,
    letterSpacing: 0.1,
  );
  
  static TextStyle labelMedium = AppFonts.inter(
    fontSize: 12,
    fontWeight: FontWeight.w500,
    color: AppColors.textSecondary,
    letterSpacing: 0.5,
  );
  
  static TextStyle labelSmall = AppFonts.inter(
    fontSize: 11,
    fontWeight: FontWeight.w500,
    color: AppColors.textSecondary,
    letterSpacing: 0.5,
  );
  
  // Dark theme variants
  static TextStyle labelLargeDark = labelLarge.copyWith(color: AppColors.textLight);
  static TextStyle labelMediumDark = labelMedium.copyWith(color: AppColors.textLightSecondary);
  static TextStyle labelSmallDark = labelSmall.copyWith(color: AppColors.textLightSecondary);
  
  // ============================================
  // BUTTON STYLES
  // ============================================
  static TextStyle buttonLarge = AppFonts.poppins(
    fontSize: 16,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.5,
  );
  
  static TextStyle buttonMedium = AppFonts.poppins(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.5,
  );
  
  static TextStyle buttonSmall = AppFonts.poppins(
    fontSize: 12,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.5,
  );
  
  static TextStyle buttonText = AppFonts.poppins(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.75,
    color: AppColors.textLight,
  );
  
  // ============================================
  // PRICE STYLES - E-commerce specific
  // ============================================
  static TextStyle priceLarge = AppFonts.poppins(
    fontSize: 24,
    fontWeight: FontWeight.bold,
    color: AppColors.primary,
    height: 1.2,
  );
  
  static TextStyle priceMedium = AppFonts.poppins(
    fontSize: 18,
    fontWeight: FontWeight.bold,
    color: AppColors.primary,
    height: 1.3,
  );
  
  static TextStyle priceSmall = AppFonts.poppins(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    color: AppColors.primary,
    height: 1.4,
  );
  
  static TextStyle priceStrikethrough = AppFonts.inter(
    fontSize: 14,
    fontWeight: FontWeight.normal,
    color: AppColors.textSecondary,
    decoration: TextDecoration.lineThrough,
    decorationThickness: 2,
  );
  
  // Dark theme price variants
  static TextStyle priceLargeDark = priceLarge.copyWith(color: AppColors.primaryLight);
  static TextStyle priceMediumDark = priceMedium.copyWith(color: AppColors.primaryLight);
  static TextStyle priceSmallDark = priceSmall.copyWith(color: AppColors.primaryLight);
  static TextStyle priceStrikethroughDark = priceStrikethrough.copyWith(color: AppColors.textLightSecondary);
  
  // ============================================
  // STATUS & SPECIAL STYLES
  // ============================================
  
  // Success styles
  static TextStyle success = AppFonts.inter(
    fontSize: 14,
    fontWeight: FontWeight.w500,
    color: AppColors.success,
  );
  
  static TextStyle successBold = AppFonts.inter(
    fontSize: 16,
    fontWeight: FontWeight.bold,
    color: AppColors.success,
  );
  
  // Error styles
  static TextStyle error = AppFonts.inter(
    fontSize: 14,
    fontWeight: FontWeight.w500,
    color: AppColors.error,
  );
  
  static TextStyle errorBold = AppFonts.inter(
    fontSize: 16,
    fontWeight: FontWeight.bold,
    color: AppColors.error,
  );
  
  static TextStyle errorSmall = AppFonts.inter(
    fontSize: 12,
    fontWeight: FontWeight.normal,
    color: AppColors.error,
  );
  
  // Warning styles
  static TextStyle warning = AppFonts.inter(
    fontSize: 14,
    fontWeight: FontWeight.w500,
    color: AppColors.warning,
  );
  
  static TextStyle warningBold = AppFonts.inter(
    fontSize: 16,
    fontWeight: FontWeight.bold,
    color: AppColors.warning,
  );
  
  // Info styles
  static TextStyle info = AppFonts.inter(
    fontSize: 14,
    fontWeight: FontWeight.w500,
    color: AppColors.info,
  );
  
  static TextStyle infoBold = AppFonts.inter(
    fontSize: 16,
    fontWeight: FontWeight.bold,
    color: AppColors.info,
  );
  
  // ============================================
  // DISCOUNT & BADGE STYLES
  // ============================================
  static TextStyle discount = AppFonts.poppins(
    fontSize: 12,
    fontWeight: FontWeight.bold,
    color: AppColors.discountText,
    letterSpacing: 0.5,
  );
  
  static TextStyle discountLarge = AppFonts.poppins(
    fontSize: 16,
    fontWeight: FontWeight.bold,
    color: AppColors.discountText,
    letterSpacing: 0.5,
  );
  
  static TextStyle badge = AppFonts.inter(
    fontSize: 10,
    fontWeight: FontWeight.w600,
    color: AppColors.textLight,
    letterSpacing: 0.5,
  );
  
  // ============================================
  // SPECIALIZED STYLES
  // ============================================
  
  // AppBar title
  static TextStyle appBarTitle = AppFonts.poppins(
    fontSize: 20,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimary,
    letterSpacing: 0,
  );
  
  static TextStyle appBarTitleDark = appBarTitle.copyWith(color: AppColors.textLight);
  
  // Tab bar
  static TextStyle tabBar = AppFonts.poppins(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.5,
  );
  
  // Chip text
  static TextStyle chip = AppFonts.inter(
    fontSize: 12,
    fontWeight: FontWeight.w500,
    letterSpacing: 0.25,
  );
  
  // Dialog title
  static TextStyle dialogTitle = AppFonts.poppins(
    fontSize: 20,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimary,
  );
  
  static TextStyle dialogTitleDark = dialogTitle.copyWith(color: AppColors.textLight);
  
  // Input text
  static TextStyle input = AppFonts.inter(
    fontSize: 16,
    fontWeight: FontWeight.normal,
    color: AppColors.textPrimary,
  );
  
  static TextStyle inputDark = input.copyWith(color: AppColors.textLight);
  
  // Hint text
  static TextStyle hint = AppFonts.inter(
    fontSize: 14,
    fontWeight: FontWeight.normal,
    color: AppColors.textHint,
  );
  
  static TextStyle hintDark = hint.copyWith(color: AppColors.textLightHint);
  
  // Link text
  static TextStyle link = AppFonts.inter(
    fontSize: 14,
    fontWeight: FontWeight.w500,
    color: AppColors.primary,
    decoration: TextDecoration.underline,
  );
  
  static TextStyle linkDark = link.copyWith(color: AppColors.primaryLight);
  
  // Caption
  static TextStyle caption = AppFonts.inter(
    fontSize: 12,
    fontWeight: FontWeight.normal,
    color: AppColors.textSecondary,
    height: 1.4,
  );
  
  static TextStyle captionDark = caption.copyWith(color: AppColors.textLightSecondary);
  
  // Overline (labels above content)
  static TextStyle overline = AppFonts.inter(
    fontSize: 10,
    fontWeight: FontWeight.w500,
    color: AppColors.textSecondary,
    letterSpacing: 1.5,
  );
  
  static TextStyle overlineDark = overline.copyWith(color: AppColors.textLightSecondary);
  
  // ============================================
  // ORDER STATUS STYLES
  // ============================================
  static TextStyle orderStatus = AppFonts.poppins(
    fontSize: 12,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.5,
  );
  
  static TextStyle orderStatusLarge = AppFonts.poppins(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.5,
  );
  
  // ============================================
  // HELPER METHODS
  // ============================================
  
  /// Get text style based on theme brightness
  static TextStyle getDisplayLarge(bool isDark) {
    return isDark ? displayLargeDark : displayLarge;
  }
  
  static TextStyle getDisplayMedium(bool isDark) {
    return isDark ? displayMediumDark : displayMedium;
  }
  
  static TextStyle getDisplaySmall(bool isDark) {
    return isDark ? displaySmallDark : displaySmall;
  }
  
  static TextStyle getHeadlineLarge(bool isDark) {
    return isDark ? headlineLargeDark : headlineLarge;
  }
  
  static TextStyle getHeadlineMedium(bool isDark) {
    return isDark ? headlineMediumDark : headlineMedium;
  }
  
  static TextStyle getHeadlineSmall(bool isDark) {
    return isDark ? headlineSmallDark : headlineSmall;
  }
  
  static TextStyle getTitleLarge(bool isDark) {
    return isDark ? titleLargeDark : titleLarge;
  }
  
  static TextStyle getTitleMedium(bool isDark) {
    return isDark ? titleMediumDark : titleMedium;
  }
  
  static TextStyle getTitleSmall(bool isDark) {
    return isDark ? titleSmallDark : titleSmall;
  }
  
  static TextStyle getBodyLarge(bool isDark) {
    return isDark ? bodyLargeDark : bodyLarge;
  }
  
  static TextStyle getBodyMedium(bool isDark) {
    return isDark ? bodyMediumDark : bodyMedium;
  }
  
  static TextStyle getBodySmall(bool isDark) {
    return isDark ? bodySmallDark : bodySmall;
  }
  
  static TextStyle getPriceLarge(bool isDark) {
    return isDark ? priceLargeDark : priceLarge;
  }
  
  static TextStyle getPriceMedium(bool isDark) {
    return isDark ? priceMediumDark : priceMedium;
  }
  
  static TextStyle getPriceSmall(bool isDark) {
    return isDark ? priceSmallDark : priceSmall;
  }
  
  static TextStyle getPriceStrikethrough(bool isDark) {
    return isDark ? priceStrikethroughDark : priceStrikethrough;
  }
  
  /// Get order status text style with color
  static TextStyle getOrderStatusStyle(String status, {bool large = false}) {
    final color = AppColors.getOrderStatusColor(status);
    return large 
        ? orderStatusLarge.copyWith(color: color)
        : orderStatus.copyWith(color: color);
  }
  
  /// Apply custom color to any style
  static TextStyle withColor(TextStyle style, Color color) {
    return style.copyWith(color: color);
  }
  
  /// Apply custom font size to any style
  static TextStyle withFontSize(TextStyle style, double fontSize) {
    return style.copyWith(fontSize: fontSize);
  }
  
  /// Apply bold weight to any style
  static TextStyle toBold(TextStyle style) {
    return style.copyWith(fontWeight: FontWeight.bold);
  }
  
  /// Apply italic to any style
  static TextStyle toItalic(TextStyle style) {
    return style.copyWith(fontStyle: FontStyle.italic);
  }
  
  /// Apply underline to any style
  static TextStyle withUnderline(TextStyle style) {
    return style.copyWith(decoration: TextDecoration.underline);
  }
  
  /// Scale font size based on device
  static TextStyle scale(TextStyle style, double scaleFactor) {
    return style.copyWith(
      fontSize: (style.fontSize ?? 14) * scaleFactor,
    );
  }
  
  /// Get responsive text style based on screen width
  static TextStyle responsive(
    TextStyle mobile,
    TextStyle tablet,
    TextStyle desktop,
    double screenWidth,
  ) {
    if (screenWidth >= 1100) return desktop;
    if (screenWidth >= 650) return tablet;
    return mobile;
  }
}
