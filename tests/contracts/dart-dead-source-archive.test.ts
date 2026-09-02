import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');

const archivedFiles = [
    ['apps/merchant_app/lib/widgets/products/product_card.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/products/product_card.dart'],
    ['apps/merchant_app/lib/widgets/products/product_search_bar.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/products/product_search_bar.dart'],
    ['apps/merchant_app/lib/widgets/products/bulk_action_bar.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/products/bulk_action_bar.dart'],
    ['apps/merchant_app/lib/widgets/products/filter_tabs.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/products/filter_tabs.dart'],
    ['apps/merchant_app/lib/widgets/dashboard/bento_grid.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/dashboard/bento_grid.dart'],
    ['apps/merchant_app/lib/widgets/dashboard/glass_stat_card.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/dashboard/glass_stat_card.dart'],
    ['apps/merchant_app/lib/widgets/dashboard/insights_grid.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/dashboard/insights_grid.dart'],
    ['apps/merchant_app/lib/widgets/dashboard/dashboard_header.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/dashboard/dashboard_header.dart'],
    ['apps/merchant_app/lib/widgets/dashboard/performance_chart_card.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/dashboard/performance_chart_card.dart'],
    ['apps/merchant_app/lib/widgets/dashboard/recent_activity_feed.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/dashboard/recent_activity_feed.dart'],
    ['apps/merchant_app/lib/widgets/theme/preset_grid.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/theme/preset_grid.dart'],
    ['apps/merchant_app/lib/widgets/theme/theme_preview_card.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/theme/theme_preview_card.dart'],
    ['apps/merchant_app/lib/widgets/theme/color_picker_row.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/theme/color_picker_row.dart'],
    ['apps/merchant_app/lib/widgets/theme/font_selector.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/theme/font_selector.dart'],
    ['apps/merchant_app/lib/widgets/editor/section_card.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/editor/section_card.dart'],
    ['apps/merchant_app/lib/widgets/editor/section_type_icon.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/editor/section_type_icon.dart'],
    ['apps/merchant_app/lib/widgets/editor/block_editor.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/editor/block_editor.dart'],
    ['apps/merchant_app/lib/widgets/editor/preview_sections/preview_header.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/editor/preview_sections/preview_header.dart'],
    ['apps/merchant_app/lib/widgets/editor/preview_sections/preview_hero.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/editor/preview_sections/preview_hero.dart'],
    ['apps/merchant_app/lib/widgets/editor/preview_sections/preview_products.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/editor/preview_sections/preview_products.dart'],
    ['apps/merchant_app/lib/widgets/editor/preview_sections/preview_about.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/editor/preview_sections/preview_about.dart'],
    ['apps/merchant_app/lib/widgets/editor/preview_sections/preview_testimonials.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/editor/preview_sections/preview_testimonials.dart'],
    ['apps/merchant_app/lib/widgets/editor/preview_sections/preview_newsletter.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/editor/preview_sections/preview_newsletter.dart'],
    ['apps/merchant_app/lib/widgets/editor/preview_sections/preview_footer.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/editor/preview_sections/preview_footer.dart'],
    ['apps/merchant_app/lib/widgets/shared/animated_counter.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/shared/animated_counter.dart'],
    ['apps/merchant_app/lib/widgets/shared/status_badge.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/shared/status_badge.dart'],
    ['apps/merchant_app/lib/widgets/shared/glassmorphic_card.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/shared/glassmorphic_card.dart'],
    ['apps/merchant_app/lib/widgets/home/store_header_card.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/home/store_header_card.dart'],
    ['apps/merchant_app/lib/widgets/home/publish_toggle_card.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/home/publish_toggle_card.dart'],
    ['apps/merchant_app/lib/widgets/settings/plan_card.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/settings/plan_card.dart'],
    ['apps/merchant_app/lib/widgets/subscription/subscription_card.dart', 'docs/archive/dead-code/mobile-merchant-app/widgets/subscription/subscription_card.dart'],
    ['apps/merchant_app/lib/services/domain_service.dart', 'docs/archive/dead-code/mobile-merchant-app/services/domain_service.dart'],
    ['apps/merchant_app/lib/services/preview_service.dart', 'docs/archive/dead-code/mobile-merchant-app/services/preview_service.dart'],
    ['apps/merchant_app/lib/utils/theme_resolver.dart', 'docs/archive/dead-code/mobile-merchant-app/utils/theme_resolver.dart'],
    ['packages/dart/core/lib/src/responsive/responsive_helper.dart', 'docs/archive/dead-code/dart-core/responsive/responsive_helper.dart'],
    ['packages/dart/core/lib/src/responsive/size_config.dart', 'docs/archive/dead-code/dart-core/responsive/size_config.dart'],
    ['packages/dart/core/lib/src/responsive/breakpoints.dart', 'docs/archive/dead-code/dart-core/responsive/breakpoints.dart'],
] as const;

function path(relativePath: string): string {
    return join(repoRoot, relativePath);
}

function read(relativePath: string): string {
    const absolutePath = path(relativePath);
    assert.equal(existsSync(absolutePath), true, `${relativePath} must exist`);
    return readFileSync(absolutePath, 'utf8');
}

test('verified Dart dead-source files are archived outside active source', () => {
    for (const [activePath, archivePath] of archivedFiles) {
        assert.equal(existsSync(path(activePath)), false, `${activePath} must not remain active`);
        assert.equal(existsSync(path(archivePath)), true, `${archivePath} must preserve archive provenance`);
    }
});

test('active Dart replacement surfaces remain available after the archive move', () => {
    assert.equal(existsSync(path('apps/merchant_app/lib/screens/products/products_screen.dart')), true);
    assert.equal(existsSync(path('apps/merchant_app/lib/screens/dashboard/home_screen.dart')), true);
    assert.equal(existsSync(path('packages/dart/core/lib/src/responsive/responsive.dart')), true);
});

test('Dart dead-source validator is wired into governance', () => {
    const validator = read('scripts/validators/dart-dead-source-validator.mjs');
    const governanceRunner = read('scripts/validate-governance.mjs');

    assert.match(validator, /verified Dart dead-source files/);
    assert.match(validator, /home_screen/);
    assert.match(validator, /responsive\.dart/);
    assert.match(governanceRunner, /dart-dead-source-validator\.mjs/);
});
