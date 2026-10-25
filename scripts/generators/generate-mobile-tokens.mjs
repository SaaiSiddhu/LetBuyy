#!/usr/bin/env node
'use strict';

/**
 * Generate the Flutter/Dart token bridge from the DTCG interchange artifact.
 *
 * Pipeline:
 *   packages/typescript/ui/src/tokens.ts
 *     -> packages/typescript/ui/tokens.json
 *     -> packages/dart/ui_kit/lib/src/tokens/letbuyy_tokens.dart
 *
 * Usage:
 *   node scripts/generators/generate-mobile-tokens.mjs
 *   node scripts/generators/generate-mobile-tokens.mjs --check
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sourcePath = join(root, 'packages', 'typescript', 'ui', 'tokens.json');
const dartPath = join(root, 'packages', 'dart', 'ui_kit', 'lib', 'src', 'tokens', 'letbuyy_tokens.dart');
const check = process.argv.includes('--check');

const dtcg = JSON.parse(readFileSync(sourcePath, 'utf8'));

function getByPath(obj, path) {
    return path.split('.').reduce((current, key) => (current == null ? undefined : current[key]), obj);
}

function resolveValue(value, seen = new Set()) {
    if (typeof value !== 'string') return value;
    const match = value.match(/^\{([^}]+)\}$/);
    if (!match) return value;
    if (seen.has(match[1])) throw new Error(`Circular token reference: {${match[1]}}`);
    seen.add(match[1]);
    const node = getByPath(dtcg, match[1]);
    if (!node || node.$value === undefined) throw new Error(`Unresolved token reference: {${match[1]}}`);
    return resolveValue(node.$value, seen);
}

function token(path) {
    const node = getByPath(dtcg, path);
    if (!node || node.$value === undefined) throw new Error(`Missing token: ${path}`);
    return resolveValue(node.$value);
}

function hexToDart(hex) {
    const clean = String(hex).replace('#', '').toUpperCase();
    if (!/^[0-9A-F]{6}$/.test(clean)) throw new Error(`Unexpected colour value: ${hex}`);
    return `Color(0xFF${clean})`;
}

function rgbaHexToDart(hex) {
    const clean = String(hex).replace('#', '').toUpperCase();
    if (!/^[0-9A-F]{8}$/.test(clean)) throw new Error(`Unexpected ARGB colour value: ${hex}`);
    return `Color(0x${clean})`;
}

function pxToDouble(value) {
    if (value === '0') return '0';
    const match = String(value).match(/^(\d+(?:\.\d+)?)px$/);
    if (!match) throw new Error(`Expected px dimension, got ${value}`);
    return match[1];
}

const colorTokens = {
    purple100: token('color.primitive.purple.100'),
    purple200: token('color.primitive.purple.200'),
    purple300: token('color.primitive.purple.300'),
    purple400: token('color.primitive.purple.400'),
    purple500: token('color.primitive.purple.500'),
    purple600: token('color.primitive.purple.600'),
    purple700: token('color.primitive.purple.700'),
    purple800: token('color.primitive.purple.800'),
    purple900: token('color.primitive.purple.900'),
    gray50: token('color.primitive.gray.50'),
    gray100: token('color.primitive.gray.100'),
    gray125: token('color.primitive.gray.125'),
    gray150: token('color.primitive.gray.150'),
    gray175: token('color.primitive.gray.175'),
    gray200: token('color.primitive.gray.200'),
    gray300: token('color.primitive.gray.300'),
    gray400: token('color.primitive.gray.400'),
    gray500: token('color.primitive.gray.500'),
    gray600: token('color.primitive.gray.600'),
    gray700: token('color.primitive.gray.700'),
    gray800: token('color.primitive.gray.800'),
    gray900: token('color.primitive.gray.900'),
    slate50: token('color.primitive.slate.50'),
    slate100: token('color.primitive.slate.100'),
    slate200: token('color.primitive.slate.200'),
    slate300: token('color.primitive.slate.300'),
    slate400: token('color.primitive.slate.400'),
    slate500: token('color.primitive.slate.500'),
    slate600: token('color.primitive.slate.600'),
    slate700: token('color.primitive.slate.700'),
    slate800: token('color.primitive.slate.800'),
    slate850: token('color.primitive.slate.850'),
    slate900: token('color.primitive.slate.900'),
    slate950: token('color.primitive.slate.950'),
    white: token('color.primitive.white'),
    black: token('color.primitive.black'),
    green100: token('color.primitive.green.100'),
    green500: token('color.primitive.green.500'),
    green700: token('color.primitive.green.700'),
    green950: token('color.primitive.green.950'),
    emerald500: token('color.primitive.emerald.500'),
    amber100: token('color.primitive.amber.100'),
    amber500: token('color.primitive.amber.500'),
    amber800: token('color.primitive.amber.800'),
    amber950: token('color.primitive.amber.950'),
    red100: token('color.primitive.red.100'),
    red300: token('color.primitive.red.300'),
    red500: token('color.primitive.red.500'),
    red600: token('color.primitive.red.600'),
    red700: token('color.primitive.red.700'),
    red950: token('color.primitive.red.950'),
    pink300: token('color.primitive.pink.300'),
    pink400: token('color.primitive.pink.400'),
    pink500: token('color.primitive.pink.500'),
    pink600: token('color.primitive.pink.600'),
    pink700: token('color.primitive.pink.700'),
    blue100: token('color.primitive.blue.100'),
    blue300: token('color.primitive.blue.300'),
    blue500: token('color.primitive.blue.500'),
    blue700: token('color.primitive.blue.700'),
    blue950: token('color.primitive.blue.950'),
    cyan500: token('color.primitive.cyan.500'),
    teal500: token('color.primitive.teal.500'),
};

// Export the admin primitives for deliberate consumers; do not change the mobile theme.
for (const step of Object.keys(dtcg.color.primitive.brandInk ?? {})) colorTokens[`brandInk${step}`] = token(`color.primitive.brandInk.${step}`);

const primitiveLines = Object.entries(colorTokens)
    .map(([name, value]) => `  static const ${name} = ${hexToDart(value)};`)
    .join('\n');

const spacingAliases = {
    space0: token('dimension.space.none'),
    space2: token('dimension.space.2xs'),
    space4: token('dimension.space.xs'),
    space6: token('dimension.space.xs-plus'),
    space8: token('dimension.space.sm'),
    space12: token('dimension.space.md'),
    space16: token('dimension.space.lg'),
    space20: token('dimension.space.xl'),
    space24: token('dimension.space.2xl'),
    space32: token('dimension.space.3xl'),
    space40: token('dimension.space.4xl'),
    space48: token('dimension.space.5xl'),
    space64: token('dimension.space.6xl'),
    space96: token('dimension.space.7xl'),
};

const spacingLines = [
    ['none', token('dimension.space.none')],
    ['x2s', token('dimension.space.2xs')],
    ['xs', token('dimension.space.xs')],
    ['xsPlus', token('dimension.space.xs-plus')],
    ['sm', token('dimension.space.sm')],
    ['md', token('dimension.space.md')],
    ['lg', token('dimension.space.lg')],
    ['xl', token('dimension.space.xl')],
    ['x2l', token('dimension.space.2xl')],
    ['x3l', token('dimension.space.3xl')],
    ['x4l', token('dimension.space.4xl')],
    ['x5l', token('dimension.space.5xl')],
    ['x6l', token('dimension.space.6xl')],
    ['x7l', token('dimension.space.7xl')],
    ...Object.entries(spacingAliases),
].map(([name, value]) => `  static const double ${name} = ${pxToDouble(value)};`).join('\n');

const dart = `// GENERATED FILE - DO NOT EDIT.
// Source: packages/typescript/ui/tokens.json
// Regenerate: node scripts/generators/generate-mobile-tokens.mjs

import 'package:flutter/material.dart';

enum LetbuyyDensity { compact, comfortable, spacious }

class LetbuyyPrimitiveTokens {
  const LetbuyyPrimitiveTokens._();

${primitiveLines}

  static const purpleSubtle = Color(0x1F8B5CF6);
  static const overlayLight = Color(0x8F0F172A);
  static const overlayDark = Color(0xA3000000);
}

class LetbuyyColorTokens {
  const LetbuyyColorTokens._();

  static const brandPurple = LetbuyyPrimitiveTokens.purple500;
  static const primary = LetbuyyPrimitiveTokens.purple500;
  static const primaryTextLight = LetbuyyPrimitiveTokens.purple700;
  static const primaryTextDark = LetbuyyPrimitiveTokens.purple300;
  static const primaryHover = LetbuyyPrimitiveTokens.purple600;
  static const primaryActive = LetbuyyPrimitiveTokens.purple700;
  static const primarySubtle = LetbuyyPrimitiveTokens.purpleSubtle;

  static const brandPrimary = primary;
  static const brandPrimaryLight = LetbuyyPrimitiveTokens.purple400;
  static const brandPrimaryLighter = LetbuyyPrimitiveTokens.purple300;
  static const brandPrimaryDark = LetbuyyPrimitiveTokens.purple600;
  static const brandPrimaryDarker = LetbuyyPrimitiveTokens.purple700;

  static const accentPink = LetbuyyPrimitiveTokens.pink500;
  static const accentPinkLight = LetbuyyPrimitiveTokens.pink400;
  static const accentPinkLighter = LetbuyyPrimitiveTokens.pink300;
  static const accentPinkDark = LetbuyyPrimitiveTokens.pink600;
  static const accentPinkDarker = LetbuyyPrimitiveTokens.pink700;

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
  static const textSecondaryDark = LetbuyyPrimitiveTokens.slate300;
  static const textMuted = LetbuyyPrimitiveTokens.gray400;

  static const borderLight = LetbuyyPrimitiveTokens.gray200;
  static const borderDark = LetbuyyPrimitiveTokens.slate700;
  static const success = LetbuyyPrimitiveTokens.green500;
  static const successStrong = LetbuyyPrimitiveTokens.emerald500;
  static const warning = LetbuyyPrimitiveTokens.amber500;
  static const danger = LetbuyyPrimitiveTokens.red500;
  static const error = danger;
  static const info = LetbuyyPrimitiveTokens.blue500;
  static const cyan = LetbuyyPrimitiveTokens.cyan500;
  static const teal = LetbuyyPrimitiveTokens.teal500;

  static const slate950 = LetbuyyPrimitiveTokens.slate950;
  static const slate900 = LetbuyyPrimitiveTokens.slate900;
  static const slate800 = LetbuyyPrimitiveTokens.slate800;
  static const slate700 = LetbuyyPrimitiveTokens.slate700;
  static const slate600 = LetbuyyPrimitiveTokens.slate600;
  static const slate500 = LetbuyyPrimitiveTokens.slate500;
  static const slate400 = LetbuyyPrimitiveTokens.slate400;
  static const slate300 = LetbuyyPrimitiveTokens.slate300;
  static const slate200 = LetbuyyPrimitiveTokens.slate200;
  static const slate100 = LetbuyyPrimitiveTokens.slate100;
  static const slate50 = LetbuyyPrimitiveTokens.slate50;
  static const white = LetbuyyPrimitiveTokens.white;
  static const black = LetbuyyPrimitiveTokens.black;

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

  static const display = ${pxToDouble(token('typography.fontSize.display'))};
  static const h1 = ${pxToDouble(token('typography.fontSize.h1'))};
  static const h2 = ${pxToDouble(token('typography.fontSize.h2'))};
  static const h3 = ${pxToDouble(token('typography.fontSize.h3'))};
  static const h4 = ${pxToDouble(token('typography.fontSize.h4'))};
  static const pageTitle = ${pxToDouble(token('typography.fontSize.page-title'))};
  static const sectionTitle = ${pxToDouble(token('typography.fontSize.section-title'))};
  static const cardTitle = ${pxToDouble(token('typography.fontSize.card-title'))};
  static const bodyLarge = ${pxToDouble(token('typography.fontSize.body-large'))};
  static const body = ${pxToDouble(token('typography.fontSize.body'))};
  static const secondary = ${pxToDouble(token('typography.fontSize.secondary'))};
  static const table = ${pxToDouble(token('typography.fontSize.secondary'))};
  static const sidebar = ${pxToDouble(token('typography.fontSize.body'))};
  static const emptyState = ${pxToDouble(token('typography.fontSize.body'))};
  static const small = ${pxToDouble(token('typography.fontSize.secondary'))};
  static const caption = ${pxToDouble(token('typography.fontSize.caption'))};
  static const badge = ${pxToDouble(token('typography.fontSize.caption'))};
  static const heading = ${pxToDouble(token('typography.fontSize.h4'))};

  static const regular = FontWeight.w400;
  static const medium = FontWeight.w500;
  static const semibold = FontWeight.w600;
  static const bold = FontWeight.w700;
}

class LetbuyySpacingTokens {
  const LetbuyySpacingTokens._();

${spacingLines}
}

class LetbuyyRadiusTokens {
  const LetbuyyRadiusTokens._();

  static const sm = ${pxToDouble(token('dimension.radius.sm'))};
  static const md = ${pxToDouble(token('dimension.radius.md'))};
  static const lg = ${pxToDouble(token('dimension.radius.lg'))};
  static const xl = ${pxToDouble(token('dimension.radius.xl'))};
  static const full = ${pxToDouble(token('dimension.radius.full'))};
}

class LetbuyyShadowTokens {
  const LetbuyyShadowTokens._();

  static const sm = [
    BoxShadow(color: ${rgbaHexToDart('0A000000')}, blurRadius: 2, offset: Offset(0, 1)),
  ];

  static const md = [
    BoxShadow(color: ${rgbaHexToDart('0F0F172A')}, blurRadius: 12, offset: Offset(0, 4)),
  ];

  static const lg = [
    BoxShadow(color: ${rgbaHexToDart('140F172A')}, blurRadius: 32, offset: Offset(0, 12)),
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
`;

if (check) {
    const current = existsSync(dartPath) ? readFileSync(dartPath, 'utf8') : '';
    if (current.trim() !== dart.trim()) {
        process.stderr.write('Mobile token drift detected: packages/dart/ui_kit/lib/src/tokens/letbuyy_tokens.dart is out of sync with tokens.json.\nRun: node scripts/generators/generate-mobile-tokens.mjs\n');
        process.exit(1);
    }
    process.stdout.write('Mobile tokens are in sync with the DTCG source.\n');
} else {
    writeFileSync(dartPath, dart);
    process.stdout.write(`Generated ${dartPath} (${Object.keys(colorTokens).length} primitive colours).\n`);
}
