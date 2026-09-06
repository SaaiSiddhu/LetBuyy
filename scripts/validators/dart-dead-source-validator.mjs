import {
  createReporter,
  exists,
  getTrackedFiles,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Dart dead source validator");
const trackedFiles = getTrackedFiles();

const archivedFiles = [
  ["apps/merchant_app/lib/widgets/products/product_card.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/products/product_card.dart"],
  ["apps/merchant_app/lib/widgets/products/product_search_bar.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/products/product_search_bar.dart"],
  ["apps/merchant_app/lib/widgets/products/bulk_action_bar.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/products/bulk_action_bar.dart"],
  ["apps/merchant_app/lib/widgets/products/filter_tabs.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/products/filter_tabs.dart"],
  ["apps/merchant_app/lib/widgets/dashboard/bento_grid.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/dashboard/bento_grid.dart"],
  ["apps/merchant_app/lib/widgets/dashboard/glass_stat_card.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/dashboard/glass_stat_card.dart"],
  ["apps/merchant_app/lib/widgets/dashboard/insights_grid.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/dashboard/insights_grid.dart"],
  ["apps/merchant_app/lib/widgets/dashboard/dashboard_header.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/dashboard/dashboard_header.dart"],
  ["apps/merchant_app/lib/widgets/dashboard/performance_chart_card.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/dashboard/performance_chart_card.dart"],
  ["apps/merchant_app/lib/widgets/dashboard/recent_activity_feed.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/dashboard/recent_activity_feed.dart"],
  ["apps/merchant_app/lib/widgets/theme/preset_grid.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/theme/preset_grid.dart"],
  ["apps/merchant_app/lib/widgets/theme/theme_preview_card.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/theme/theme_preview_card.dart"],
  ["apps/merchant_app/lib/widgets/theme/color_picker_row.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/theme/color_picker_row.dart"],
  ["apps/merchant_app/lib/widgets/theme/font_selector.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/theme/font_selector.dart"],
  ["apps/merchant_app/lib/widgets/editor/section_card.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/editor/section_card.dart"],
  ["apps/merchant_app/lib/widgets/editor/section_type_icon.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/editor/section_type_icon.dart"],
  ["apps/merchant_app/lib/widgets/editor/block_editor.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/editor/block_editor.dart"],
  ["apps/merchant_app/lib/widgets/editor/preview_sections/preview_header.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/editor/preview_sections/preview_header.dart"],
  ["apps/merchant_app/lib/widgets/editor/preview_sections/preview_hero.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/editor/preview_sections/preview_hero.dart"],
  ["apps/merchant_app/lib/widgets/editor/preview_sections/preview_products.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/editor/preview_sections/preview_products.dart"],
  ["apps/merchant_app/lib/widgets/editor/preview_sections/preview_about.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/editor/preview_sections/preview_about.dart"],
  ["apps/merchant_app/lib/widgets/editor/preview_sections/preview_testimonials.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/editor/preview_sections/preview_testimonials.dart"],
  ["apps/merchant_app/lib/widgets/editor/preview_sections/preview_newsletter.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/editor/preview_sections/preview_newsletter.dart"],
  ["apps/merchant_app/lib/widgets/editor/preview_sections/preview_footer.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/editor/preview_sections/preview_footer.dart"],
  ["apps/merchant_app/lib/widgets/shared/animated_counter.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/shared/animated_counter.dart"],
  ["apps/merchant_app/lib/widgets/shared/status_badge.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/shared/status_badge.dart"],
  ["apps/merchant_app/lib/widgets/shared/glassmorphic_card.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/shared/glassmorphic_card.dart"],
  ["apps/merchant_app/lib/widgets/home/store_header_card.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/home/store_header_card.dart"],
  ["apps/merchant_app/lib/widgets/home/publish_toggle_card.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/home/publish_toggle_card.dart"],
  ["apps/merchant_app/lib/widgets/settings/plan_card.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/settings/plan_card.dart"],
  ["apps/merchant_app/lib/widgets/subscription/subscription_card.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/subscription/subscription_card.dart"],
  ["apps/merchant_app/lib/services/domain_service.dart", "docs/archive/dead-code/mobile-merchant-app/services/domain_service.dart"],
  ["apps/merchant_app/lib/services/preview_service.dart", "docs/archive/dead-code/mobile-merchant-app/services/preview_service.dart"],
  ["apps/merchant_app/lib/utils/theme_resolver.dart", "docs/archive/dead-code/mobile-merchant-app/utils/theme_resolver.dart"],
  ["packages/dart/core/lib/src/responsive/responsive_helper.dart", "docs/archive/dead-code/dart-core/responsive/responsive_helper.dart"],
  ["packages/dart/core/lib/src/responsive/size_config.dart", "docs/archive/dead-code/dart-core/responsive/size_config.dart"],
  ["packages/dart/core/lib/src/responsive/breakpoints.dart", "docs/archive/dead-code/dart-core/responsive/breakpoints.dart"],
  // Reintroduced by Phase N's cross-repo package recovery: byte-name duplicates of the three
  // files directly above, in a package that did not exist here when they were archived. Measured
  // dead by the same test that condemned their twins -- zero importers, zero symbol users, and
  // the marketplace_core barrel exports only src/responsive/responsive.dart, not these.
  ["packages/dart/marketplace_core/lib/src/responsive/responsive_helper.dart", "docs/archive/dead-code/dart-marketplace-core/responsive/responsive_helper.dart"],
  ["packages/dart/marketplace_core/lib/src/responsive/size_config.dart", "docs/archive/dead-code/dart-marketplace-core/responsive/size_config.dart"],
  ["packages/dart/marketplace_core/lib/src/responsive/breakpoints.dart", "docs/archive/dead-code/dart-marketplace-core/responsive/breakpoints.dart"],
];

for (const [activePath, archivePath] of archivedFiles) {
  reporter.assert(!exists(activePath), `${activePath} must stay out of active Dart source`);
  reporter.assert(exists(archivePath), `${archivePath} must preserve the archived Dart source file`);
}

// The roots that actually hold Dart today. `apps/mobile` survived the Phase M rename as two RESERVED
// manifest shells (shopper-app, operator-app: 4 tracked files, no Dart), so a filter naming only it
// and packages/dart was scanning two empty directories -- while every archived file below came from
// apps/merchant_app, which it did not match.
const dartSourceRoots = /^(apps\/(merchant_app|customer_app|admin_app|mobile|phase_2)|packages\/dart)\//;

// A REFERENCE is an import or export directive that RESOLVES TO the archived file's path. Nothing
// less is sound, and the two weaker forms were both tried against this tree:
//
//   * `source.includes(basename)` flagged 8 files -- one whose own header comment names itself, one
//     importing `order_STATUS_BADGE.dart` (the archived name as a suffix), one importing
//     `compact_PRODUCT_CARD.dart` (the archived name contained in a longer one);
//   * comparing the imported file's BASENAME still flagged 5, because customer_app has its own
//     `product_card.dart`. Same name, different file, different package -- exactly the collision this
//     repository keeps rediscovering.
//
// So the target is resolved: a relative import against the importing file's directory, a
// `package:<name>/rest` import against the package whose pubspec declares that name. Only an exact
// path match counts.
const archivedActivePaths = new Set(archivedFiles.map(([activePath]) => activePath));
const directivePattern = /^\s*(?:import|export)\s+['"]([^'"]+)['"]/gm;

// package name -> its lib directory, read from the pubspecs rather than assumed from the folder name.
const packageLibDirs = new Map();
for (const pubspec of trackedFiles.filter((file) => file.endsWith("pubspec.yaml"))) {
  const declared = /^name:\s*([A-Za-z0-9_]+)\s*$/m.exec(readFile(pubspec));
  if (declared) packageLibDirs.set(declared[1], `${pubspec.slice(0, -"pubspec.yaml".length)}lib`);
}

function normalize(path) {
  const parts = [];
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") parts.pop();
    else parts.push(segment);
  }
  return parts.join("/");
}

function resolveDirective(fromFile, target) {
  if (target.startsWith("dart:")) return null;
  if (target.startsWith("package:")) {
    const [packageName, ...rest] = target.slice("package:".length).split("/");
    const libDir = packageLibDirs.get(packageName);
    return libDir && rest.length ? normalize(`${libDir}/${rest.join("/")}`) : null;
  }
  return normalize(`${fromFile.split("/").slice(0, -1).join("/")}/${target}`);
}

const activeRefs = trackedFiles.filter((file) => {
  if (!dartSourceRoots.test(file)) return false;
  if (!file.endsWith(".dart")) return false;
  for (const match of readFile(file).matchAll(directivePattern)) {
    const resolved = resolveDirective(file, match[1]);
    if (resolved && archivedActivePaths.has(resolved)) return true;
  }
  return false;
});

reporter.assert(
  activeRefs.length === 0,
  `active Dart source must not import an archived Dart dead-source file: ${activeRefs.join(", ")}`,
);

reporter.assert(
  exists("apps/merchant_app/lib/screens/products/products_screen.dart"),
  "live merchant product screen must remain active after archiving old product widgets",
);
reporter.assert(
  exists("apps/merchant_app/lib/screens/dashboard/home_screen.dart"),
  "live merchant dashboard screen must remain active after archiving old dashboard widgets",
);
reporter.assert(
  exists("packages/dart/core/lib/src/responsive/responsive.dart"),
  "live Dart core responsive widget must remain active after archiving old responsive helpers",
);

reporter.finish("verified Dart dead-source files are archived outside active source");
