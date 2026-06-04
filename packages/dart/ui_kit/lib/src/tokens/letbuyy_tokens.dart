import 'package:flutter/material.dart';

enum LetbuyyDensity { compact, comfortable, spacious }

class LetbuyyPrimitiveTokens {
  const LetbuyyPrimitiveTokens._();

  static const purple500 = Color(0xFF8B5CF6);
  static const purple600 = Color(0xFF7C3AED);
  static const purple700 = Color(0xFF6D28D9);

  static const gray50 = Color(0xFFF9FAFB);
  static const gray100 = Color(0xFFF5F5F7);
  static const gray125 = Color(0xFFF6F7F9);
  static const gray150 = Color(0xFFEFEFF1);
  static const gray175 = Color(0xFFF1F2F4);
  static const gray200 = Color(0xFFE5E7EB);
  static const gray400 = Color(0xFF94A3B8);
  static const gray500 = Color(0xFF6B7280);
  static const gray900 = Color(0xFF111827);

  static const slate700 = Color(0xFF334155);
  static const slate800 = Color(0xFF1E293B);
  static const slate850 = Color(0xFF1F2937);
  static const slate900 = Color(0xFF0F172A);
  static const slate950 = Color(0xFF0A0F1A);

  static const white = Color(0xFFFFFFFF);
  static const black = Color(0xFF000000);
  static const green500 = Color(0xFF22C55E);
  static const green950 = Color(0xFF052E16);
  static const amber500 = Color(0xFFF59E0B);
  static const amber950 = Color(0xFF422006);
  static const red500 = Color(0xFFEF4444);
  static const red600 = Color(0xFFDC2626);
  static const red950 = Color(0xFF451A1A);
  static const blue500 = Color(0xFF3B82F6);
  static const blue950 = Color(0xFF082F49);

  static const purpleSubtle = Color(0x1F8B5CF6);
  static const overlayLight = Color(0x8F0F172A);
  static const overlayDark = Color(0xA3000000);
}

class LetbuyyColorTokens {
  const LetbuyyColorTokens._();

  static const brandPurple = LetbuyyPrimitiveTokens.purple500;
  static const primary = LetbuyyPrimitiveTokens.purple500;
  static const primaryHover = LetbuyyPrimitiveTokens.purple600;
  static const primaryActive = LetbuyyPrimitiveTokens.purple700;
  static const primarySubtle = LetbuyyPrimitiveTokens.purpleSubtle;

  static const backgroundLight = LetbuyyPrimitiveTokens.gray125;
  static const backgroundDark = LetbuyyPrimitiveTokens.gray900;
  static const surfaceLight = LetbuyyPrimitiveTokens.white;
  static const surfaceDark = LetbuyyPrimitiveTokens.gray900;
  static const cardLight = LetbuyyPrimitiveTokens.white;
  static const cardDark = LetbuyyPrimitiveTokens.slate850;
  static const sidebarLight = LetbuyyPrimitiveTokens.gray175;
  static const sidebarDark = LetbuyyPrimitiveTokens.slate900;

  static const textPrimaryLight = LetbuyyPrimitiveTokens.gray900;
  static const textPrimaryDark = LetbuyyPrimitiveTokens.white;
  static const textSecondaryLight = LetbuyyPrimitiveTokens.gray500;
  static const textSecondaryDark = Color(0xFFCBD5E1);
  static const textMuted = LetbuyyPrimitiveTokens.gray400;

  static const borderLight = LetbuyyPrimitiveTokens.gray200;
  static const borderDark = LetbuyyPrimitiveTokens.slate700;
  static const success = LetbuyyPrimitiveTokens.green500;
  static const warning = LetbuyyPrimitiveTokens.amber500;
  static const danger = LetbuyyPrimitiveTokens.red500;
  static const info = LetbuyyPrimitiveTokens.blue500;

  static Color page(Brightness brightness) =>
      brightness == Brightness.dark ? backgroundDark : backgroundLight;

  static Color surface(Brightness brightness) =>
      brightness == Brightness.dark ? surfaceDark : surfaceLight;

  static Color card(Brightness brightness) =>
      brightness == Brightness.dark ? cardDark : cardLight;

  static Color textPrimary(Brightness brightness) =>
      brightness == Brightness.dark ? textPrimaryDark : textPrimaryLight;

  static Color textSecondary(Brightness brightness) =>
      brightness == Brightness.dark ? textSecondaryDark : textSecondaryLight;

  static Color border(Brightness brightness) =>
      brightness == Brightness.dark ? borderDark : borderLight;
}

class LetbuyyTypographyTokens {
  const LetbuyyTypographyTokens._();

  static const fontBody = 'Inter';
  static const fontDisplay = 'Inter';
  static const fontMono = 'ui-monospace';

  static const display = 32.0;
  static const h1 = 28.0;
  static const h2 = 24.0;
  static const h3 = 20.0;
  static const h4 = 18.0;
  static const pageTitle = 24.0;
  static const sectionTitle = 18.0;
  static const cardTitle = 16.0;
  static const bodyLarge = 16.0;
  static const body = 14.0;
  static const secondary = 13.0;
  static const table = 13.0;
  static const sidebar = 14.0;
  static const emptyState = 14.0;
  static const small = 13.0;
  static const caption = 12.0;
  static const badge = 12.0;
  static const heading = 18.0;

  static const regular = FontWeight.w400;
  static const medium = FontWeight.w500;
  static const semibold = FontWeight.w600;
  static const bold = FontWeight.w700;
}

class LetbuyySpacingTokens {
  const LetbuyySpacingTokens._();

  static const none = 0.0;
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 20.0;
  static const x2l = 24.0;
  static const x3l = 32.0;
  static const x4l = 40.0;
}

class LetbuyyRadiusTokens {
  const LetbuyyRadiusTokens._();

  static const sm = 4.0;
  static const md = 8.0;
  static const lg = 12.0;
  static const xl = 16.0;
  static const full = 999.0;
}

class LetbuyyShadowTokens {
  const LetbuyyShadowTokens._();

  static const sm = [
    BoxShadow(color: Color(0x0A000000), blurRadius: 2, offset: Offset(0, 1)),
  ];

  static const md = [
    BoxShadow(color: Color(0x0F0F172A), blurRadius: 12, offset: Offset(0, 4)),
  ];

  static const lg = [
    BoxShadow(color: Color(0x140F172A), blurRadius: 32, offset: Offset(0, 12)),
  ];
}

class LetbuyyDensityTokens {
  const LetbuyyDensityTokens({
    required this.sidebarRowHeight,
    required this.inputHeight,
    required this.buttonHeight,
    required this.buttonHeightLarge,
    required this.iconButtonHeight,
    required this.pillHeight,
    required this.tableRowHeight,
    required this.tableHeaderHeight,
    required this.pageGap,
    required this.sectionGap,
    required this.cardGap,
    required this.cardPadding,
    required this.headerHeight,
    required this.actionBarHeight,
    required this.modalPadding,
    required this.nestedSpacing,
    required this.sectionSpacing,
    required this.emptyStateScale,
    required this.emptyStateIllustrationWidth,
    required this.emptyStateIllustrationHeight,
    required this.emptyStateMinHeight,
    required this.iconPage,
    required this.iconSidebar,
    required this.iconButton,
    required this.iconTable,
    required this.iconAction,
  });

  final double sidebarRowHeight;
  final double inputHeight;
  final double buttonHeight;
  final double buttonHeightLarge;
  final double iconButtonHeight;
  final double pillHeight;
  final double tableRowHeight;
  final double tableHeaderHeight;
  final double pageGap;
  final double sectionGap;
  final double cardGap;
  final double cardPadding;
  final double headerHeight;
  final double actionBarHeight;
  final double modalPadding;
  final double nestedSpacing;
  final double sectionSpacing;
  final double emptyStateScale;
  final double emptyStateIllustrationWidth;
  final double emptyStateIllustrationHeight;
  final double emptyStateMinHeight;
  final double iconPage;
  final double iconSidebar;
  final double iconButton;
  final double iconTable;
  final double iconAction;

  static const compact = LetbuyyDensityTokens(
    sidebarRowHeight: 40,
    inputHeight: 36,
    buttonHeight: 36,
    buttonHeightLarge: 40,
    iconButtonHeight: 32,
    pillHeight: 28,
    tableRowHeight: 44,
    tableHeaderHeight: 44,
    pageGap: 12,
    sectionGap: 12,
    cardGap: 16,
    cardPadding: 16,
    headerHeight: 64,
    actionBarHeight: 36,
    modalPadding: 16,
    nestedSpacing: 8,
    sectionSpacing: 16,
    emptyStateScale: 0.72,
    emptyStateIllustrationWidth: 160,
    emptyStateIllustrationHeight: 108,
    emptyStateMinHeight: 180,
    iconPage: 18,
    iconSidebar: 18,
    iconButton: 16,
    iconTable: 14,
    iconAction: 16,
  );

  static const comfortable = LetbuyyDensityTokens(
    sidebarRowHeight: 44,
    inputHeight: 40,
    buttonHeight: 40,
    buttonHeightLarge: 44,
    iconButtonHeight: 36,
    pillHeight: 32,
    tableRowHeight: 48,
    tableHeaderHeight: 48,
    pageGap: 16,
    sectionGap: 16,
    cardGap: 20,
    cardPadding: 20,
    headerHeight: 72,
    actionBarHeight: 40,
    modalPadding: 20,
    nestedSpacing: 8,
    sectionSpacing: 16,
    emptyStateScale: 0.88,
    emptyStateIllustrationWidth: 184,
    emptyStateIllustrationHeight: 122,
    emptyStateMinHeight: 220,
    iconPage: 20,
    iconSidebar: 18,
    iconButton: 16,
    iconTable: 14,
    iconAction: 16,
  );

  static const spacious = LetbuyyDensityTokens(
    sidebarRowHeight: 48,
    inputHeight: 44,
    buttonHeight: 44,
    buttonHeightLarge: 48,
    iconButtonHeight: 40,
    pillHeight: 36,
    tableRowHeight: 52,
    tableHeaderHeight: 52,
    pageGap: 20,
    sectionGap: 20,
    cardGap: 24,
    cardPadding: 24,
    headerHeight: 88,
    actionBarHeight: 44,
    modalPadding: 24,
    nestedSpacing: 12,
    sectionSpacing: 20,
    emptyStateScale: 1,
    emptyStateIllustrationWidth: 208,
    emptyStateIllustrationHeight: 138,
    emptyStateMinHeight: 260,
    iconPage: 22,
    iconSidebar: 20,
    iconButton: 18,
    iconTable: 16,
    iconAction: 18,
  );

  static LetbuyyDensityTokens resolve(LetbuyyDensity density) {
    switch (density) {
      case LetbuyyDensity.compact:
        return compact;
      case LetbuyyDensity.comfortable:
        return comfortable;
      case LetbuyyDensity.spacious:
        return spacious;
    }
  }
}
