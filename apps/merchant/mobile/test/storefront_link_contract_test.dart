import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/services/custom_domains.dart';

void main() {
  const defaultUrl = 'https://demo.${StoreModel.storefrontRootDomain}';
  StoreModel store({
    String? custom,
    String status = 'pending',
    bool ssl = false,
  }) => StoreModel.fromJson({
    'id': 'synthetic-site', 'name': 'Demo', 'subdomain': 'demo',
    'custom_domain': custom, 'custom_domain_status': status, 'ssl_active': ssl,
    // Old persisted links must not override the current platform root.
    'store_url': 'https://demo.letbuyy.com',
  });
  test(
    'platform, preview and settings links share the governed storefront root',
    () {
      final value = store();
    expect(StoreModel.generateStoreUrl('demo'), defaultUrl);
    expect(value.publicUrl, defaultUrl);
      expect(value.previewUrl, value.publicUrl);
      expect(
        DomainSettingsSnapshot.fromStore(value).defaultDomain,
      'demo.${StoreModel.storefrontRootDomain}',
      );
    },
  );
  test(
    'custom storefront link requires active domain and TLS; preview stays platform scoped',
    () {
      expect(
        store(custom: 'shop.example.in', status: 'active', ssl: true).publicUrl,
        'https://shop.example.in',
      );
      for (final value in [
        store(custom: 'shop.example.in'),
        store(custom: 'shop.example.in', status: 'active'),
        store(custom: 'shop.example.in', status: 'verifying', ssl: true),
      ]) {
      expect(value.publicUrl, defaultUrl);
      }
      expect(
        store(
          custom: 'shop.example.in',
          status: 'active',
          ssl: true,
        ).previewUrl,
      defaultUrl,
      );
    },
  );
}
