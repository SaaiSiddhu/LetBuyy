import { createReporter, getTrackedFiles, readFile } from "./governance-common.mjs";

// Pricing catalog governance (V4 GAP 3 + single-source enforcement).
//
// The pricing compare matrix is catalog data, authored ONCE in a Supabase
// migration and written to plans.compare_features. The pricing pages (merchant
// control plane + marketing) must render it from /api/plans → plan-ui.ts, never
// from a hardcoded matrix in React. This validator enforces:
//   * every compare row carries { category, label, description, display_order,
//     launch, growth, scale, commerce_os }
//   * labels are unique within a category; descriptions are non-empty
//   * the platform-commission row advertises 0% for every tier (0% moat honesty)
//   * no large compare matrix is hardcoded in a pricing component (single source)

const reporter = createReporter("Pricing catalog validator");

const TIERS = ["launch", "growth", "scale", "commerce_os"];

function extractMatrices(sql) {
  // Match the compare-matrix CTE only: SELECT '[ ... ]'::jsonb AS cf
  // Anchored on SELECT + non-greedy so it never swallows earlier `features` jsonb.
  const matches = [...sql.matchAll(/SELECT\s+'(\[[\s\S]*?\])'::jsonb AS cf/g)];
  return matches.map((m) => m[1]);
}

const migrationFiles = getTrackedFiles().filter(
  (f) => f.startsWith("database/supabase/migrations/") && f.endsWith(".sql"),
);

let matrixFound = false;

for (const file of migrationFiles) {
  const sql = readFile(file);
  if (!sql.includes("compare_features") || !sql.includes("::jsonb AS cf")) continue;

  for (const literal of extractMatrices(sql)) {
    matrixFound = true;
    let groups;
    try {
      groups = JSON.parse(literal);
    } catch (err) {
      reporter.assert(false, `${file}: compare matrix is not valid JSON (${err.message})`);
      continue;
    }

    reporter.assert(Array.isArray(groups), `${file}: compare matrix must be an array of categories`);
    if (!Array.isArray(groups)) continue;

    const seenByCategory = new Map();
    let commissionRowChecked = false;

    for (const group of groups) {
      reporter.assert(Boolean(group && group.category), `${file}: a compare category is missing "category"`);
      reporter.assert(Array.isArray(group?.items) && group.items.length > 0, `${file}: category "${group?.category}" has no items`);
      const labels = seenByCategory.get(group?.category) || new Set();

      for (const item of group?.items || []) {
        const label = item?.label;
        reporter.assert(Boolean(label), `${file}: a row in "${group?.category}" is missing "label"`);
        reporter.assert(typeof item?.description === "string" && item.description.trim().length > 0, `${file}: row "${label}" is missing a description`);
        reporter.assert(typeof item?.display_order === "number", `${file}: row "${label}" is missing numeric "display_order"`);
        for (const tier of TIERS) {
          reporter.assert(item?.[tier] !== undefined, `${file}: row "${label}" is missing tier value "${tier}"`);
        }
        if (label) {
          reporter.assert(!labels.has(label), `${file}: duplicate row label "${label}" in category "${group?.category}"`);
          labels.add(label);
        }
        // 0% commission moat honesty: every commission row must show 0% (as a
        // "0%..." string) or be marked included (true) on every tier.
        if (typeof label === "string" && /commission/i.test(label)) {
          commissionRowChecked = true;
          for (const tier of TIERS) {
            const value = item[tier];
            const ok = value === true || (typeof value === "string" && /0%/.test(value));
            reporter.assert(
              ok,
              `${file}: commission row "${label}" must show 0% (or included) on tier "${tier}" (got ${JSON.stringify(value)})`,
            );
          }
        }
      }
      seenByCategory.set(group?.category, labels);
    }

    reporter.assert(commissionRowChecked, `${file}: compare matrix must include a platform-commission row (0% moat)`);
    reporter.assert(seenByCategory.size >= 15, `${file}: compare matrix should span 15+ categories (found ${seenByCategory.size})`);
  }
}

// Single source of truth: pricing components must not hardcode a large compare
// matrix — they read it from /api/plans. Flag any pricing component that defines
// many tier-keyed comparison rows inline.
const pricingComponents = getTrackedFiles().filter(
  (f) =>
    /apps\/(merchant-control-plane|marketing-site)\/src\//.test(f) &&
    /(pricing|plan|compare)/i.test(f) &&
    (f.endsWith(".tsx") || f.endsWith(".ts")),
);

for (const file of pricingComponents) {
  const src = readFile(file);
  // Heuristic: a hardcoded matrix has many objects each carrying commerce_os tier keys.
  const inlineTierRows = (src.match(/commerce_os\s*:/g) || []).length;
  reporter.warn(
    inlineTierRows < 8,
    `${file}: looks like it may hardcode the compare matrix (${inlineTierRows} inline commerce_os rows) — render it from /api/plans via plan-ui.ts instead`,
  );
}

reporter.assert(matrixFound, "No pricing compare matrix found in migrations (expected plans.compare_features seed)");

reporter.finish(`pricing catalog matrix checked across ${migrationFiles.length} migrations`);
