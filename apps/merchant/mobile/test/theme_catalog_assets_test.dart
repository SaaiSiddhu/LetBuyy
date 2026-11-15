import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/config/app_config.dart';
import 'package:letbuyy_store/services/theme_service.dart';
import 'package:letbuyy_store/models/theme_editor_models.dart';

void main() {
  test(
    'Threadline catalog thumbnail resolves to the configured Commerce origin',
    () {
      expect(
        ThemeService.resolveCatalogThumbnail(
          '/theme-previews/threadline-2.0.0.webp',
        ),
        Uri.parse(
          AppConfig.storefrontBaseUrl,
        ).resolve('/theme-previews/threadline-2.0.0.webp').toString(),
      );
      expect(
        ThemeService.resolveCatalogThumbnail(
          'https://cdn.example.invalid/theme.webp',
        ),
        'https://cdn.example.invalid/theme.webp',
      );
      for (final value in [
        null,
        '',
        'relative.webp',
        '//unknown.invalid/theme.webp',
        'javascript:alert(1)',
        'https://user:password@example.invalid/theme.webp',
      ]) {
        expect(ThemeService.resolveCatalogThumbnail(value), isNull);
      }
    },
  );

  test(
    'all ten authored web catalog captures resolve from Merchant, without replacing another version',
    () {
      const designs = {
        'sense': 'threadline',
        'forge': 'circuit',
        'bloom': 'playfield',
        'refresh': 'pantry',
        'craft': 'habitat',
        'summit': 'kindred',
        'nova': 'madeyours',
        'aura': 'dewdrop',
        'ride': 'trailmark',
        'dawn': 'marginalia',
      };
      for (final entry in designs.entries) {
        final placeholder = '/theme-previews/${entry.key}.svg';
        final slug = 'letbuyy-${entry.key}';
        expect(
          ThemeService.resolveCatalogThumbnail(
            placeholder,
            themeSlug: slug,
            version: '2.0.0',
          ),
          Uri.parse(AppConfig.adminBaseUrl)
              .resolve('/theme-previews/catalog-v2/${entry.value}.webp')
              .toString(),
        );
        if (entry.key != 'sense') {
          expect(
            ThemeService.resolveCatalogThumbnail(
              placeholder,
              themeSlug: slug,
              version: '2.1.0',
            ),
            Uri.parse(AppConfig.adminBaseUrl)
                .resolve('/theme-previews/catalog-v2-1/${entry.value}.webp')
                .toString(),
          );
        }
        for (final version in [
          '1.0.0',
          '2.0.1',
          '3.0.0',
          if (entry.key == 'sense') '2.1.0',
        ]) {
          expect(
            ThemeService.resolveCatalogThumbnail(
              placeholder,
              themeSlug: slug,
              version: version,
            ),
            Uri.parse(
              AppConfig.storefrontBaseUrl,
            ).resolve(placeholder).toString(),
          );
        }
        expect(
          ThemeService.resolveCatalogThumbnail(
            'https://cdn.example.invalid/custom.webp',
            themeSlug: slug,
            version: '2.0.0',
          ),
          'https://cdn.example.invalid/custom.webp',
        );
      }
      expect(
        ThemeService.resolveCatalogThumbnail(
          null,
          themeSlug: 'merchant-custom-theme',
          version: '2.0.0',
        ),
        isNull,
      );
    },
  );

  test(
    'catalog retains exact server names, package versions and explicit pricing metadata',
    () {
      final catalog = ThemeCatalogResponse.fromJson({
        'data': [
          {
            'id': 'catalog-circuit',
            'slug': 'letbuyy-forge',
            'name': 'Circuit',
            'version': '2.1.0',
            'letbuyy_pricing_type': 'free',
            'letbuyy_price_inr': 0,
            'features': ['Compatibility guide'],
          },
        ],
        'current_theme': 'letbuyy-summit',
        'current_theme_record': {
          'id': 'catalog-kindred',
          'slug': 'letbuyy-summit',
          'name': 'Kindred',
          'version': '2.0.0',
          'active': true,
        },
      });
      expect(catalog.themes.single.name, 'Circuit');
      expect(catalog.themes.single.version, '2.1.0');
      expect(catalog.themes.single.pricingType, 'free');
      expect(catalog.themes.single.priceInr, 0);
      expect(catalog.themes.single.features, ['Compatibility guide']);
      expect(catalog.currentThemeRecord!.name, 'Kindred');
      expect(catalog.currentThemeRecord!.version, '2.0.0');
      final unknown = ThemeCatalogItem.fromJson({
        'id': 'custom',
        'slug': 'custom',
        'name': 'Custom',
      });
      expect(unknown.version, isNull);
      expect(unknown.pricingType, isNull);
      expect(unknown.priceInr, isNull);
    },
  );
}
