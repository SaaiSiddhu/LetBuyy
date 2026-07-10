// H2 — Theme Artifact Exporter
//
// Converts an in-memory LiquidThemePackageBundle into a flat list of {path, contents} pairs that
// mirror a real Liquid theme directory layout:
//
//   layout/theme.liquid
//   sections/<type>.liquid
//   blocks/<type>.liquid
//   config/settings_schema.json
//   config/settings_data.json
//   templates/<key>.json
//   locales/<key>.json
//   letbuyy-theme.json   ← metadata manifest for tooling; not read by the renderer
//
// The export is pure (deterministic): same bundle → identical output on every call.
// Output is sorted ascending by .path for stable comparison and checksumming.
//
// ZERO-REGRESSION NOTE: the TS fixtures in theme-bundle.ts remain the source of truth.
// The .liquid artifacts produced here are READ-ONLY views — they carry no authority over the
// renderer. If bundle.sections[type].source changes, regenerate via generate-examples.mjs.

import type { LiquidThemePackageBundle } from './theme-bundle';

export interface ThemeArtifactFile {
  path: string;
  contents: string;
}

export interface LetbuyyThemeManifest {
  schema_version: string;
  package: {
    slug: string;
    name: string;
    version: string;
    author_name: string;
    description: string;
  };
  renderer: {
    engine: string;
    renderer_version: string;
    liquid_ready: boolean;
  };
}

export class UnsafeThemeArtifactPathError extends Error {
  readonly artifactPath: string;
  constructor(artifactPath: string) {
    super(`Refusing to export theme artifact to unsafe path "${artifactPath}" (absolute or contains a ".." segment).`);
    this.name = 'UnsafeThemeArtifactPathError';
    this.artifactPath = artifactPath;
  }
}

// Exported artifacts may be written to disk or bundled into a distributable package, so a bundle-supplied
// path (or a template/locale KEY embedded into a path) must never escape the theme directory. Reject
// absolute paths and any `..` traversal segment. Legitimate theme paths (layout/theme.liquid,
// sections/hero-banner.liquid, templates/index.json) pass unchanged.
function assertSafeArtifactPath(artifactPath: string): string {
  const normalized = artifactPath.replace(/\\/g, '/');
  if (
    normalized.startsWith('/')
    || /^[a-zA-Z]:/.test(normalized)
    || normalized.split('/').some((seg) => seg === '..')
  ) {
    throw new UnsafeThemeArtifactPathError(artifactPath);
  }
  return artifactPath;
}

export function exportThemeBundleToFiles(bundle: LiquidThemePackageBundle): ThemeArtifactFile[] {
  const files: ThemeArtifactFile[] = [];

  // 1. Layout
  files.push({
    path: assertSafeArtifactPath(bundle.layout.theme.path),
    contents: bundle.layout.theme.source,
  });

  // 2. Sections (.liquid files)
  for (const [, section] of Object.entries(bundle.sections)) {
    files.push({
      path: assertSafeArtifactPath(section.path),
      contents: section.source,
    });
  }

  // 3. Blocks (.liquid files)
  for (const [, block] of Object.entries(bundle.blocks)) {
    files.push({
      path: assertSafeArtifactPath(block.path),
      contents: block.source,
    });
  }

  // 4. config/settings_schema.json
  files.push({
    path: 'config/settings_schema.json',
    contents: JSON.stringify(bundle.config.settings_schema, null, 2),
  });

  // 5. config/settings_data.json
  // NOTE: settings_data is exported as-is, matching the Liquid theme-file convention (a theme's
  // config/settings_data.json is the merchant's saved values verbatim). The BLOCKED_DROP_KEYS
  // credential-key filtering is a RENDER-TIME defense (buildLiquidScope / filterBlockedSettingsKeys)
  // and is intentionally NOT applied here — a well-formed theme's settings_data holds design tokens
  // (colors/fonts), never credentials. If exported artifacts are ever distributed from untrusted
  // merchant data, apply filterBlockedSettingsKeys to `.current` before packaging.
  files.push({
    path: 'config/settings_data.json',
    contents: JSON.stringify(bundle.config.settings_data, null, 2),
  });

  // 6. templates/<key>.json — key is bundle-controlled, so guard the composed path against traversal.
  for (const [templateKey, template] of Object.entries(bundle.templates)) {
    files.push({
      path: assertSafeArtifactPath(`templates/${templateKey}.json`),
      contents: JSON.stringify(template, null, 2),
    });
  }

  // 7. locales/<key>.json — same traversal guard on the composed path.
  for (const [localeKey, locale] of Object.entries(bundle.locales)) {
    files.push({
      path: assertSafeArtifactPath(`locales/${localeKey}.json`),
      contents: JSON.stringify(locale, null, 2),
    });
  }

  // 8. letbuyy-theme.json — tooling manifest (not read by the renderer)
  const manifest: LetbuyyThemeManifest = {
    schema_version: bundle.schema_version,
    package: {
      slug: bundle.package.slug,
      name: bundle.package.name,
      version: bundle.package.version,
      author_name: bundle.package.author_name,
      description: bundle.package.description,
    },
    renderer: {
      engine: bundle.renderer.engine,
      renderer_version: bundle.renderer.renderer_version,
      liquid_ready: bundle.renderer.liquid_ready,
    },
  };
  files.push({
    path: 'letbuyy-theme.json',
    contents: JSON.stringify(manifest, null, 2),
  });

  // Sort ascending by path for determinism
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  return files;
}
