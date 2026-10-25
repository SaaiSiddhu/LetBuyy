import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/config/app_config.dart';
import 'package:letbuyy_store/services/theme_service.dart';

void main() {
  test('Threadline catalog thumbnail resolves to the configured Commerce origin', () {
    expect(ThemeService.resolveCatalogThumbnail('/theme-previews/threadline-2.0.0.webp'),
        Uri.parse(AppConfig.storefrontBaseUrl).resolve('/theme-previews/threadline-2.0.0.webp').toString());
    expect(ThemeService.resolveCatalogThumbnail('https://cdn.example.invalid/theme.webp'),
        'https://cdn.example.invalid/theme.webp');
    for (final value in [null, '', 'relative.webp', '//unknown.invalid/theme.webp', 'javascript:alert(1)', 'https://user:password@example.invalid/theme.webp']) {
      expect(ThemeService.resolveCatalogThumbnail(value), isNull);
    }
  });
}
