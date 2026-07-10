// K6 — Theme Analytics Contract
//
// This module defines the SHAPE of theme-platform analytics — event types, metric types,
// and emission-point annotations. It does NOT fabricate live values.
//
// HONESTY CONTRACT (from CLAUDE.md):
//   Every live value is real-source or NOT-CONNECTED + the exact source. This module
//   defines the schema and the exact emission point / source-of-truth for each metric.
//   Live counts, active stores, and render-engine distribution are NOT-CONNECTED until
//   the gateway DB adapter wires the corresponding queries.
//
// Consumers of this module:
//   - A future marketplace route in the gateway would emit ThemeAnalyticsEvent instances
//     at the exact emission points listed below.
//   - The LCIS domain graph would use ThemeMetricDescriptor to surface the NOT-CONNECTED
//     status and link the exact source query.
//
// This module has ZERO side effects — no I/O, no DB access.

// ---- Event types ----

/**
 * Emitted when a merchant installs a theme (persists a new theme_releases row with is_current=true).
 * Emission point: services/api-gateway/src/execution/theme-execution.adapter.ts, after
 *   buildReleaseArtifacts() succeeds and theme_releases is written.
 */
export interface ThemeInstalledEvent {
  event: 'theme.installed';
  /** UTC ISO-8601 timestamp. */
  occurred_at: string;
  /** The store (tenant) that installed the theme. */
  site_id: string;
  /** The canonical theme slug (e.g. 'letbuyy-core'). */
  theme_slug: string;
  /** The release_version number stamped on the new theme_releases row. */
  release_version: number;
  /** The bundle schema_version epoch string. */
  schema_version: string;
  /** Renderer engine declared in the bundle ('liquid' | 'json-contract'). */
  engine: string;
}

/**
 * Emitted when a merchant updates (re-installs / upgrades) an existing theme.
 * Emission point: same as ThemeInstalledEvent, when a prior theme_releases row is superseded.
 */
export interface ThemeUpdatedEvent {
  event: 'theme.updated';
  occurred_at: string;
  site_id: string;
  theme_slug: string;
  /** Previous release_version (the row being superseded). */
  from_release_version: number;
  /** New release_version. */
  to_release_version: number;
  from_schema_version: string;
  to_schema_version: string;
  engine: string;
}

/**
 * Emitted when a theme developer publishes a new theme package version.
 * Emission point: services/api-gateway/src/routes/operations/marketplace-reviews.ts,
 *   publishThemeReviewDecision() — when release_status transitions to 'published'.
 */
export interface ThemePublishedEvent {
  event: 'theme.published';
  occurred_at: string;
  theme_slug: string;
  /** The theme_package_versions.version string. */
  version: string;
  schema_version: string;
  /** The lint_issue_count at publish time (from ThemePublishManifest). */
  lint_issue_count: number;
  /** True when the bundle passed the Zod + G4 gate at publish time. */
  schema_verified: boolean;
}

/**
 * Emitted when a merchant uninstalls / removes a theme (theme_releases row is rolled back or removed).
 * Emission point: services/api-gateway/src/execution/theme-execution.adapter.ts,
 *   if/when a theme-remove operation is implemented (NOT YET IMPLEMENTED as of 2026-07).
 */
export interface ThemeUninstalledEvent {
  event: 'theme.uninstalled';
  occurred_at: string;
  site_id: string;
  theme_slug: string;
  release_version: number;
}

/**
 * Emitted when a merchant or storefront visitor opens a theme preview.
 * Emission point: storefront-runtime preview render path (apps/storefront-runtime/src/proxy.ts
 *   or a future preview-specific route).
 */
export interface ThemePreviewOpenedEvent {
  event: 'theme.preview.opened';
  occurred_at: string;
  site_id: string;
  theme_slug: string;
  engine: string;
}

/** Discriminated union of all theme platform analytics events. */
export type ThemeAnalyticsEvent =
  | ThemeInstalledEvent
  | ThemeUpdatedEvent
  | ThemePublishedEvent
  | ThemeUninstalledEvent
  | ThemePreviewOpenedEvent;

// ---- Metric types ----

/**
 * ThemeInstallMetrics: the shape of live install metrics for a single theme.
 *
 * NOT-CONNECTED: all numeric values here are query-bound. The exact source for each is
 * documented in the ThemeMetricDescriptor returned by describeThemeMetrics().
 * No live values are computed by this module.
 */
export interface ThemeInstallMetrics {
  /** Total number of is_current=true rows in theme_releases for this theme_slug. NOT-CONNECTED. */
  installCount: number;
  /** Number of distinct site_id values with an active theme_releases row. NOT-CONNECTED. */
  activeStores: number;
  /**
   * Distribution of schema_version strings across active theme_releases rows.
   * Keys are schema_version strings; values are store counts. NOT-CONNECTED.
   */
  versionDistribution: Record<string, number>;
  /**
   * Mix of renderer engines ('liquid' | 'react') across active stores.
   * Source: theme_releases.release_manifest->>'renderer_engine' and lb:canary:render signal.
   * NOT-CONNECTED.
   */
  renderEngineMix: Partial<Record<'liquid' | 'react', number>>;
}

// ---- Metric descriptor ----

/** Describes the connection status and source-of-truth for a single metric field. */
export interface ThemeMetricFieldDescriptor {
  /** The field name on ThemeInstallMetrics. */
  field: keyof ThemeInstallMetrics;
  /** Human-readable description of what the metric represents. */
  description: string;
  /** The exact source-of-truth (table/query/signal) for the live value. */
  source: string;
  /** Always false in this module — live values require DB adapter wiring at the gateway layer. */
  connected: false;
}

/** Descriptor for the full ThemeInstallMetrics shape, exposing the NOT-CONNECTED status. */
export interface ThemeMetricDescriptor {
  topic: 'theme.install.metrics';
  /**
   * Whether live data is connected. Always false in this module — the gateway DB adapter
   * must wire the source queries listed in `fields` for live values to be available.
   */
  connected: false;
  /** Per-field source-of-truth annotations. */
  fields: ThemeMetricFieldDescriptor[];
}

/**
 * describeThemeMetrics returns a ThemeMetricDescriptor documenting the NOT-CONNECTED status
 * and the exact source-of-truth for each metric in ThemeInstallMetrics.
 *
 * This is a pure function — it returns a static descriptor, never live values.
 * The gateway layer is responsible for executing the listed queries and populating
 * ThemeInstallMetrics at runtime.
 */
export function describeThemeMetrics(): ThemeMetricDescriptor {
  return {
    topic: 'theme.install.metrics',
    connected: false,
    fields: [
      {
        field: 'installCount',
        description: 'Total stores with this theme actively installed (is_current=true).',
        source: 'SELECT COUNT(*) FROM theme_releases WHERE theme_id = $slug AND is_current = true',
        connected: false,
      },
      {
        field: 'activeStores',
        description: 'Distinct store count with an active theme release.',
        source: 'SELECT COUNT(DISTINCT store_id) FROM theme_releases WHERE theme_id = $slug AND is_current = true',
        connected: false,
      },
      {
        field: 'versionDistribution',
        description: 'Count of active installs grouped by schema_version epoch.',
        source: "SELECT release_manifest->>'schema_version', COUNT(*) FROM theme_releases WHERE theme_id = $slug AND is_current = true GROUP BY 1",
        connected: false,
      },
      {
        field: 'renderEngineMix',
        description: "Mix of renderer engines across active stores. 'liquid' = Liquid canary stores; 'react' = React renderer stores.",
        source: "SELECT release_manifest->>'renderer_engine', COUNT(*) FROM theme_releases WHERE theme_id = $slug AND is_current = true GROUP BY 1 — additionally cross-reference lb:canary:render Cloudflare Analytics Engine signal",
        connected: false,
      },
    ],
  };
}

// ---- Event emission-point registry ----

/** Annotation for where a given event type should be emitted in the gateway. */
export interface ThemeEventEmissionPoint {
  event: ThemeAnalyticsEvent['event'];
  emissionPoint: string;
  implemented: boolean;
}

/**
 * describeThemeEventEmissionPoints returns the authoritative list of where each
 * ThemeAnalyticsEvent should be emitted in the gateway codebase.
 *
 * 'implemented: false' means the emission point exists structurally (the gateway code path
 * is there) but the event has not yet been wired up with an actual analytics call.
 */
export function describeThemeEventEmissionPoints(): ThemeEventEmissionPoint[] {
  return [
    {
      event: 'theme.installed',
      emissionPoint:
        'services/api-gateway/src/execution/theme-execution.adapter.ts — buildReleaseArtifacts(), after theme_releases upsert',
      implemented: false,
    },
    {
      event: 'theme.updated',
      emissionPoint:
        'services/api-gateway/src/execution/theme-execution.adapter.ts — buildReleaseArtifacts(), when prior release_version is superseded',
      implemented: false,
    },
    {
      event: 'theme.published',
      emissionPoint:
        'services/api-gateway/src/routes/operations/marketplace-reviews.ts — publishThemeReviewDecision(), on status → published',
      implemented: false,
    },
    {
      event: 'theme.uninstalled',
      emissionPoint:
        'services/api-gateway/src/execution/theme-execution.adapter.ts — future theme-remove operation (NOT YET IMPLEMENTED as of 2026-07)',
      implemented: false,
    },
    {
      event: 'theme.preview.opened',
      emissionPoint:
        'apps/storefront-runtime/src/proxy.ts — preview render path, or a future dedicated preview route',
      implemented: false,
    },
  ];
}
