import {
  createReporter,
  exists,
  getTrackedFiles,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Dart dead source validator");
const trackedFiles = getTrackedFiles();

const archivedFiles = [
  ["apps/mobile/merchant-app/lib/widgets/products/product_card.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/products/product_card.dart"],
  ["apps/mobile/merchant-app/lib/widgets/products/product_search_bar.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/products/product_search_bar.dart"],
  ["apps/mobile/merchant-app/lib/widgets/products/bulk_action_bar.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/products/bulk_action_bar.dart"],
  ["apps/mobile/merchant-app/lib/widgets/products/filter_tabs.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/products/filter_tabs.dart"],
  ["apps/mobile/merchant-app/lib/widgets/dashboard/bento_grid.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/dashboard/bento_grid.dart"],
  ["apps/mobile/merchant-app/lib/widgets/dashboard/glass_stat_card.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/dashboard/glass_stat_card.dart"],
  ["apps/mobile/merchant-app/lib/widgets/dashboard/insights_grid.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/dashboard/insights_grid.dart"],
  ["apps/mobile/merchant-app/lib/widgets/dashboard/dashboard_header.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/dashboard/dashboard_header.dart"],
  ["apps/mobile/merchant-app/lib/widgets/dashboard/performance_chart_card.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/dashboard/performance_chart_card.dart"],
  ["apps/mobile/merchant-app/lib/widgets/dashboard/recent_activity_feed.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/dashboard/recent_activity_feed.dart"],
  ["apps/mobile/merchant-app/lib/widgets/theme/preset_grid.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/theme/preset_grid.dart"],
  ["apps/mobile/merchant-app/lib/widgets/theme/theme_preview_card.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/theme/theme_preview_card.dart"],
  ["apps/mobile/merchant-app/lib/widgets/theme/color_picker_row.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/theme/color_picker_row.dart"],
  ["apps/mobile/merchant-app/lib/widgets/theme/font_selector.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/theme/font_selector.dart"],
  ["apps/mobile/merchant-app/lib/widgets/editor/section_card.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/editor/section_card.dart"],
  ["apps/mobile/merchant-app/lib/widgets/editor/section_type_icon.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/editor/section_type_icon.dart"],
  ["apps/mobile/merchant-app/lib/widgets/editor/block_editor.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/editor/block_editor.dart"],
  ["apps/mobile/merchant-app/lib/widgets/editor/preview_sections/preview_header.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/editor/preview_sections/preview_header.dart"],
  ["apps/mobile/merchant-app/lib/widgets/editor/preview_sections/preview_hero.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/editor/preview_sections/preview_hero.dart"],
  ["apps/mobile/merchant-app/lib/widgets/editor/preview_sections/preview_products.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/editor/preview_sections/preview_products.dart"],
  ["apps/mobile/merchant-app/lib/widgets/editor/preview_sections/preview_about.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/editor/preview_sections/preview_about.dart"],
  ["apps/mobile/merchant-app/lib/widgets/editor/preview_sections/preview_testimonials.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/editor/preview_sections/preview_testimonials.dart"],
  ["apps/mobile/merchant-app/lib/widgets/editor/preview_sections/preview_newsletter.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/editor/preview_sections/preview_newsletter.dart"],
  ["apps/mobile/merchant-app/lib/widgets/editor/preview_sections/preview_footer.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/editor/preview_sections/preview_footer.dart"],
  ["apps/mobile/merchant-app/lib/widgets/shared/animated_counter.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/shared/animated_counter.dart"],
  ["apps/mobile/merchant-app/lib/widgets/shared/status_badge.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/shared/status_badge.dart"],
  ["apps/mobile/merchant-app/lib/widgets/shared/glassmorphic_card.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/shared/glassmorphic_card.dart"],
  ["apps/mobile/merchant-app/lib/widgets/home/store_header_card.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/home/store_header_card.dart"],
  ["apps/mobile/merchant-app/lib/widgets/home/publish_toggle_card.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/home/publish_toggle_card.dart"],
  ["apps/mobile/merchant-app/lib/widgets/settings/plan_card.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/settings/plan_card.dart"],
  ["apps/mobile/merchant-app/lib/widgets/subscription/subscription_card.dart", "docs/archive/dead-code/mobile-merchant-app/widgets/subscription/subscription_card.dart"],
  ["apps/mobile/merchant-app/lib/services/domain_service.dart", "docs/archive/dead-code/mobile-merchant-app/services/domain_service.dart"],
  ["apps/mobile/merchant-app/lib/services/preview_service.dart", "docs/archive/dead-code/mobile-merchant-app/services/preview_service.dart"],
  ["apps/mobile/merchant-app/lib/utils/theme_resolver.dart", "docs/archive/dead-code/mobile-merchant-app/utils/theme_resolver.dart"],
  ["packages/dart/core/lib/src/responsive/responsive_helper.dart", "docs/archive/dead-code/dart-core/responsive/responsive_helper.dart"],
  ["packages/dart/core/lib/src/responsive/size_config.dart", "docs/archive/dead-code/dart-core/responsive/size_config.dart"],
  ["packages/dart/core/lib/src/responsive/breakpoints.dart", "docs/archive/dead-code/dart-core/responsive/breakpoints.dart"],
];

for (const [activePath, archivePath] of archivedFiles) {
  reporter.assert(!exists(activePath), `${activePath} must stay out of active Dart source`);
  reporter.assert(exists(archivePath), `${archivePath} must preserve the archived Dart source file`);
}

const archivedBasenames = archivedFiles.map(([activePath]) => activePath.split("/").at(-1));
const activeRefs = trackedFiles.filter((file) => {
  if (!/^(apps\/mobile|packages\/dart)\//.test(file)) return false;
  if (!file.endsWith(".dart")) return false;
  const source = readFile(file);
  return archivedBasenames.some((basename) => source.includes(basename));
});

reporter.assert(
  activeRefs.length === 0,
  `active Dart source must not reference archived Dart dead-source basenames: ${activeRefs.join(", ")}`,
);

reporter.assert(
  exists("apps/mobile/merchant-app/lib/screens/products/products_screen.dart"),
  "live merchant product screen must remain active after archiving old product widgets",
);
reporter.assert(
  exists("apps/mobile/merchant-app/lib/screens/dashboard/home_screen.dart"),
  "live merchant dashboard screen must remain active after archiving old dashboard widgets",
);
reporter.assert(
  exists("packages/dart/core/lib/src/responsive/responsive.dart"),
  "live Dart core responsive widget must remain active after archiving old responsive helpers",
);

reporter.finish("verified Dart dead-source files are archived outside active source");
