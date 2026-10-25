// Browser-safe theme defaults. Keep runtime validation, Liquid source, packaging
// and server sanitization behind the main theme-engine entry point.
export interface ThemeSettings {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  headingFontFamily: string;
  borderRadius: number;
  enableAnimations: boolean;
  enableShadows: boolean;
  isDark?: boolean;
  surfaceColor?: string;
}

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  primaryColor: '#00B3B3',
  secondaryColor: '#008080',
  accentColor: '#A4E500',
  backgroundColor: '#FFFFFF',
  textColor: '#1A1A2E',
  fontFamily: 'Inter',
  headingFontFamily: 'Inter',
  borderRadius: 12,
  enableAnimations: true,
  enableShadows: true,
  isDark: false,
  surfaceColor: '#F9FAFB',
};
