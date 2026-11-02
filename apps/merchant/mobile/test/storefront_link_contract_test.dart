import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/services/custom_domains.dart';
import 'package:letbuyy_store/widgets/dashboard/hero_store_card.dart';

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
  testWidgets(
    'dashboard address label follows the exact platform, custom or local visit URL',
    (tester) async {
      for (final url in [
        defaultUrl,
        'https://shop.example.in',
        'http://127.0.0.1:3000/store/demo',
      ]) {
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: HeroStoreCard(
                  store: store(),
                  storefrontUrl: url,
                  onPublishToggle: () {},
                ),
              ),
            ),
          ),
        );
        await tester.pump(const Duration(milliseconds: 500));
        expect(
          find.text(url.replaceFirst(RegExp(r'^https?://'), '')),
          findsOneWidget,
        );
        expect(find.text('demo.letbuyy.com'), findsNothing);
      }
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
}
