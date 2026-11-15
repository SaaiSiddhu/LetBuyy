import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_store/app/app.dart';
import 'package:letbuyy_store/app/routes.dart';
import 'package:letbuyy_store/services/native_media_selection.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/store_auth_service.dart';
import 'package:letbuyy_store/services/theme_provider.dart';
import 'package:letbuyy_store/services/language_service.dart';

class SignedInRecoveryFixture extends StoreAuthService {
  SignedInRecoveryFixture(ApiClient api)
    : super(api: api, identityBaseUrl: 'https://synthetic.invalid');
  @override
  MerchantSessionUser? get currentUser => const MerchantSessionUser(
    id: 'owner-a',
    email: 'synthetic@example.invalid',
  );
}

void main() {
  testWidgets(
    'actual routed recovery notice exposes its action and retires it during account transitions',
    (tester) async {
      FlutterSecureStorage.setMockInitialValues({});
      final semantics = tester.ensureSemantics();
      final dir = Directory.systemTemp.createTempSync(
        'merchant-notice-semantics-',
      );
      final file = File('${dir.path}/original.jpg')
        ..writeAsBytesSync([1, 2, 3]);
      final selection = NativeMediaSelection(
        contextProvider: () =>
            (actorId: 'owner-a', storeId: 'site-a', version: 1),
        directoryProvider: () async => dir,
        retrieveLostData: () async => LostDataResponse.empty(),
      );
      await tester.runAsync(
        () => selection.pick(
          purpose: 'public-media-image',
          kind: 'image',
          maxBytes: 100,
          pick: () async => XFile(file.path),
        ),
      );
      final api = ApiClient(
            baseUrl: 'https://synthetic.invalid/v1',
            maxRetries: 0,
          ),
          theme = ThemeProvider(),
          language = LanguageService();
      final auth = SignedInRecoveryFixture(api);
      try {
        await tester.pumpWidget(
          MultiProvider(
            providers: [
              ChangeNotifierProvider<NativeMediaSelection>.value(
                value: selection,
              ),
              ChangeNotifierProvider<StoreAuthService>.value(value: auth),
              ChangeNotifierProvider<ThemeProvider>.value(value: theme),
              ChangeNotifierProvider<LanguageService>.value(value: language),
            ],
            child: Builder(
              builder: (context) {
                final actual =
                    const StoreBuilderApp().build(context) as MaterialApp;
                return MaterialApp(
                  builder: actual.builder,
                  home: AppRoutes.withNativeMediaRecovery(
                    const Scaffold(body: Text('Owned recovery destination')),
                  ),
                );
              },
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Review selection'), findsOneWidget);
        expect(
          find.semantics.byLabel('Review selection'),
          findsOneWidget,
          reason: 'A visible recovery action must reach platform accessibility',
        );
        await tester.tap(find.text('Review selection'));
        await tester.pumpAndSettle();
        expect(find.text('Saved file selection'), findsOneWidget);
        await tester.tap(find.text('Keep for later'));
        await tester.pumpAndSettle();
        auth.setAccountTransition(true);
        await tester.pumpAndSettle();
        expect(find.semantics.byLabel('Review selection'), findsNothing);
        auth.setAccountTransition(false);
        await tester.pumpAndSettle();
        expect(find.semantics.byLabel('Review selection'), findsOneWidget);
        expect(
          AppRoutes.nativeSelectionRoute('product-image'),
          AppRoutes.products,
        );
        expect(
          AppRoutes.nativeSelectionRoute('private-kyc-business_pan'),
          AppRoutes.kyc,
        );
      } finally {
        await tester.pumpWidget(const SizedBox());
        selection.dispose();
        auth.dispose();
        api.close();
        theme.dispose();
        language.dispose();
        semantics.dispose();
        dir.deleteSync(recursive: true);
      }
    },
  );
}
