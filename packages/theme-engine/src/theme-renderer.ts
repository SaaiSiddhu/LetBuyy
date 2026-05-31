import type {
  StorefrontCompositionInput,
  StorefrontCompositionResult,
  ThemeRuntimeOrchestrator,
  RuntimeSectionInjection,
} from './execution-runtime';
import {
  composeStorefrontTheme,
  hydrateAndComposeStorefrontTheme,
} from './execution-runtime';

export type ThemeRendererEngine = 'json-contract' | 'liquid';
export type ThemeRendererStatus = 'rendered' | 'unsupported';

export interface ThemeRendererInput extends StorefrontCompositionInput {
  orchestrator?: Pick<ThemeRuntimeOrchestrator, 'sectionRegistry' | 'blockRegistry'>;
  injections?: RuntimeSectionInjection[];
}

export interface ThemeRendererResult {
  engine: ThemeRendererEngine;
  status: ThemeRendererStatus;
  composition: StorefrontCompositionResult;
  warnings: string[];
}

export interface ThemeRenderer {
  readonly engine: ThemeRendererEngine;
  readonly interfaceVersion: string;
  render(input: ThemeRendererInput): Promise<ThemeRendererResult>;
}

export const THEME_RENDERER_INTERFACE_VERSION = '2026-05-theme-renderer';

export class JsonContractThemeRenderer implements ThemeRenderer {
  readonly engine = 'json-contract' as const;
  readonly interfaceVersion = THEME_RENDERER_INTERFACE_VERSION;

  async render(input: ThemeRendererInput): Promise<ThemeRendererResult> {
    const composition = input.orchestrator
      ? hydrateAndComposeStorefrontTheme(
        input.orchestrator,
        input,
        input.injections || [],
      )
      : composeStorefrontTheme(input);

    return {
      engine: this.engine,
      status: 'rendered',
      composition,
      warnings: [],
    };
  }
}

export class LiquidRenderer implements ThemeRenderer {
  readonly engine = 'liquid' as const;
  readonly interfaceVersion = THEME_RENDERER_INTERFACE_VERSION;

  async render(input: ThemeRendererInput): Promise<ThemeRendererResult> {
    return {
      engine: this.engine,
      status: 'unsupported',
      composition: composeStorefrontTheme(input),
      warnings: ['Liquid rendering is reserved behind the ThemeRenderer interface and is not implemented in the JSON-contract phase.'],
    };
  }
}

export const defaultThemeRenderer = new JsonContractThemeRenderer();
export const liquidThemeRenderer = new LiquidRenderer();

export function createThemeRenderer(engine: ThemeRendererEngine = 'json-contract'): ThemeRenderer {
  return engine === 'liquid' ? new LiquidRenderer() : new JsonContractThemeRenderer();
}

export function getDefaultThemeRenderer(): ThemeRenderer {
  return defaultThemeRenderer;
}
