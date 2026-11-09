import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/screens/kyc/kyc_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/kyc_service.dart';
import 'package:letbuyy_store/services/store_service.dart';

Map<String, dynamic> overview(
  String store, {
  String name = 'retained-proof.png',
  String status = 'verified',
}) => {
  'site_id': store,
  'provider_mode': 'sandbox',
  'private_upload_available': true,
  'overall_status': status,
  'documents': [
    {
      'id': 'document-$store',
      'document_type': 'bank_proof',
      'status': 'verified',
      'file_name': name,
    },
  ],
  'required_documents': [
    {
      'document_type': 'bank_proof',
      'title': 'Bank proof',
      'required': true,
      'status': 'verified',
    },
  ],
};

class TestStores extends StoreContext {
  TestStores(ApiClient api) : super(storeService: StoreService(api: api));
  String actor = 'actor-a', store = 'store-a';
  int epoch = 0;
  @override
  int get requestContextVersion => epoch;
  @override
  String get selectedStoreId => store;
  @override
  Object get requestContextKey => (epoch, actor, store);
  @override
  Future<StoreModel?> ensureSelectedStore({bool force = false}) async =>
      StoreModel.fromJson({'id': store, 'name': store});
  void change({required String actorId, required String storeId}) {
    actor = actorId;
    store = storeId;
    epoch++;
    notifyListeners();
  }
}

class Fixture {
  Fixture({Future<String?> Function()? tokenProvider}) {
    FlutterSecureStorage.setMockInitialValues({});
    api = ApiClient(
      baseUrl: 'https://synthetic.invalid/v1',
      dio: dio,
      maxRetries: 0,
      tokenProvider: tokenProvider,
      contextVersionProvider: () => (
        stores.actor.isEmpty ? null : stores.actor,
        stores.requestContextKey,
      ),
    );
    stores = TestStores(api);
    service = KycService(
      api: api,
      actorIdProvider: () => stores.actor,
      storeIdProvider: () => stores.store,
    );
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          calls.add(options);
          pending.add((options, handler));
          final signal = _arrival;
          _arrival = Completer<void>();
          signal.complete();
        },
      ),
    );
  }
  final dio = Dio();
  late final ApiClient api;
  late final TestStores stores;
  late final KycService service;
  final calls = <RequestOptions>[];
  final pending = <(RequestOptions, RequestInterceptorHandler)>[];
  Completer<void> _arrival = Completer<void>();
  Future<void> reply(
    Map<String, dynamic> data, {
    int status = 200,
    int index = 0,
  }) async {
    while (pending.length <= index) {
      await _arrival.future.timeout(const Duration(seconds: 5));
    }
    final (options, handler) = pending.removeAt(index);
    handler.resolve(
      Response(
        requestOptions: options,
        statusCode: status,
        data: status == 200
            ? {'data': data}
            : {
                'error': {'code': 'SYNTHETIC_DENIAL', 'message': 'Unavailable'},
              },
      ),
    );
  }

  Widget screen() => MultiProvider(
    providers: [
      ChangeNotifierProvider<StoreContext>.value(value: stores),
      ChangeNotifierProvider<KycService>.value(value: service),
    ],
    child: MaterialApp(
      home: KycScreen(
        pickDocumentPhoto: () async {
          final dir = Directory.systemTemp.createTempSync('letbuyy-kyc-test-');
          addTearDown(() => dir.deleteSync(recursive: true));
          final file = File('${dir.path}/proof.png');
          file.writeAsBytesSync([
            0x89,
            0x50,
            0x4e,
            0x47,
            0x0d,
            0x0a,
            0x1a,
            0x0a,
            1,
            2,
            3,
          ]);
          return XFile(file.path, name: 'proof.png', mimeType: 'image/png');
        },
      ),
    ),
  );
}

// Dio's scheduled interceptor work runs on Flutter's controlled clock. Drive
// that queue before answering; no HTTP response or guard is bypassed.
Future<void> replyWidget(
  WidgetTester tester,
  Fixture fixture,
  Map<String, dynamic> data, {
  int status = 200,
}) async {
  for (var i = 0; fixture.pending.isEmpty && i < 20; i++) {
    await tester.pump(const Duration(milliseconds: 10));
  }
  expect(
    fixture.pending,
    isNotEmpty,
    reason: 'The real SDK request must reach the synthetic response handler.',
  );
  await fixture.reply(data, status: status);
}

Future<void> awaitWidgetRequest(WidgetTester tester, Fixture fixture) async {
  for (var i = 0; fixture.pending.isEmpty && i < 50; i++) {
    await tester.pump(const Duration(milliseconds: 10));
    if (fixture.pending.isEmpty) {
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 10)),
      );
    }
  }
  expect(fixture.pending, isNotEmpty);
}

Future<void> replyUploadWidget(
  WidgetTester tester,
  Fixture fixture,
  Map<String, dynamic> data, {
  int status = 200,
}) async {
  await awaitWidgetRequest(tester, fixture);
  await tester.runAsync(() async {
    await fixture.reply(data, status: status);
    await Future<void>.delayed(const Duration(milliseconds: 100));
  });
  await tester.pump();
}

Map<String, dynamic> referenceOverview(
  String store,
  String type,
  String digits,
) => {
  ...overview(store),
  'documents': [
    {
      'id': 'reference-$store',
      'site_id': store,
      'document_type': type,
      'document_number_last4': digits,
      'file_url': null,
      'file_name': null,
      'status': 'verified',
    },
  ],
};

Future<void> openReference(
  WidgetTester tester, {
  String type = 'bank_proof',
}) async {
  await tester.tap(find.byKey(ValueKey('record-reference-$type')));
  await tester.pumpAndSettle();
}

Future<void> submitReference(
  WidgetTester tester,
  Fixture fixture,
  String digits,
) async {
  await tester.enterText(find.byType(TextField), digits);
  await tester.tap(
    find.widgetWithText(OutlinedButton, 'Choose document photo'),
  );
  await tester.pumpAndSettle();
  expect(find.text('proof.png'), findsOneWidget);
  // MultipartFile.fromFile performs real filesystem I/O; allow that one
  // bounded operation to complete before the intercepted HTTP request.
  await tester.tap(find.widgetWithText(FilledButton, 'Upload document'));
  await awaitWidgetRequest(tester, fixture);
  expect(find.byKey(const ValueKey('reference-error')), findsNothing);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  for (final method in ['read', 'submit', 'refresh']) {
    test(
      '$method refuses a stale explicitly captured SDK epoch before dispatch',
      () async {
        final f = Fixture();
        final captured = f.api.captureRequestContext();
        f.stores.change(actorId: 'actor-b', storeId: 'store-b');
        final options = ApiRequestOptions(expectedContextVersion: captured);
        final Future<Map<String, dynamic>> result = method == 'read'
            ? f.service.fetchOverview('store-a', options: options)
            : method == 'submit'
            ? f.service.submitDocument(
                storeId: 'store-a',
                documentType: 'bank_proof',
                documentNumberLast4: '1234',
                options: options,
              )
            : f.service.refreshDocument(
                'document-store-a',
                'store-a',
                options: options,
              );
        await expectLater(
          result,
          throwsA(
            isA<ApiException>().having(
              (e) => e.code,
              'code',
              'SESSION_CONTEXT_CHANGED',
            ),
          ),
        );
        expect(f.calls, isEmpty);
        expect(f.service.overview, isNull);
      },
    );

    for (final logout in [false, true]) {
      test(
        '$method denies dispatch after delayed token lookup and ${logout ? 'logout' : 'store switch'}',
        () async {
          final started = Completer<void>(), token = Completer<String?>();
          final f = Fixture(
            tokenProvider: () {
              started.complete();
              return token.future;
            },
          );
          final options = ApiRequestOptions(
            expectedContextVersion: f.api.captureRequestContext(),
          );
          final Future<Map<String, dynamic>> result = method == 'read'
              ? f.service.fetchOverview('store-a', options: options)
              : method == 'submit'
              ? f.service.submitDocument(
                  storeId: 'store-a',
                  documentType: 'bank_proof',
                  documentNumberLast4: '1234',
                  options: options,
                )
              : f.service.refreshDocument(
                  'document-store-a',
                  'store-a',
                  options: options,
                );
          final denied = expectLater(
            result,
            throwsA(
              isA<ApiException>().having(
                (e) => e.code,
                'code',
                'SESSION_CONTEXT_CHANGED',
              ),
            ),
          );
          await started.future;
          f.stores.change(
            actorId: logout ? '' : 'actor-a',
            storeId: logout ? '' : 'store-b',
          );
          token.complete('synthetic-token-never-dispatched');
          await denied;
          expect(f.calls, isEmpty);
          expect(f.service.overview, isNull);
          expect(f.service.isLoading, isFalse);
        },
      );
    }
  }

  for (final method in ['submit', 'refresh']) {
    test(
      '$method delayed response after logout cannot repopulate global cache without a screen',
      () async {
        final f = Fixture();
        final read = f.service.fetchOverview('store-a');
        await f.reply(overview('store-a'));
        await read;
        final result = method == 'submit'
            ? f.service.submitDocument(
                storeId: 'store-a',
                documentType: 'bank_proof',
                documentNumberLast4: '1234',
              )
            : f.service.refreshDocument('document-store-a', 'store-a');
        final denied = expectLater(
          result,
          throwsA(
            isA<ApiException>().having(
              (e) => e.code,
              'code',
              'SESSION_CONTEXT_CHANGED',
            ),
          ),
        );
        while (f.pending.isEmpty) {
          await f._arrival.future;
        }
        f.stores.change(actorId: '', storeId: '');
        await f.reply({'overview': overview('store-a')});
        await denied;
        expect(f.service.overview, isNull);
        expect(f.service.documents, isEmpty);
        expect(f.calls.length, 2);
      },
    );
  }

  test('older refresh cannot replace a newer same-context read', () async {
    final f = Fixture();
    final old = f.service.refreshDocument('document-store-a', 'store-a');
    final denied = expectLater(
      old,
      throwsA(
        isA<ApiException>().having(
          (e) => e.code,
          'code',
          'SESSION_CONTEXT_CHANGED',
        ),
      ),
    );
    final newer = f.service.fetchOverview('store-a');
    await f.reply(overview('store-a', name: 'newer-proof.png'), index: 1);
    await newer;
    await f.reply({'overview': overview('store-a', name: 'old-proof.png')});
    await denied;
    expect(f.service.documents.single['file_name'], 'newer-proof.png');
  });

  test(
    'missing mutation overview reads back with the original SDK context and store',
    () async {
      final f = Fixture();
      final captured = f.api.captureRequestContext();
      final result = f.service.refreshDocument(
        'document-store-a',
        'store-a',
        options: ApiRequestOptions(expectedContextVersion: captured),
      );
      await f.reply({
        'document': {'id': 'document-store-a', 'site_id': 'store-a'},
      });
      await f.reply(overview('store-a'));
      await result;
      expect(f.calls.length, 2);
      expect(
        f.calls.every(
          (r) =>
              r.extra['letbuyy.contextVersion'] == captured &&
              r.headers['X-Store-ID'] == 'store-a',
        ),
        isTrue,
      );
    },
  );

  test(
    'mutation rejects a wrong-site document even beside a matching overview',
    () async {
      final f = Fixture();
      final result = f.service.submitDocument(
        storeId: 'store-a',
        documentType: 'bank_proof',
        documentNumberLast4: '1234',
      );
      final denied = expectLater(
        result,
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'KYC_SCOPE_MISMATCH',
          ),
        ),
      );
      await f.reply({
        'document': {'site_id': 'rival-store'},
        'overview': overview('store-a'),
      });
      await denied;
      expect(f.service.overview, isNull);
    },
  );

  testWidgets(
    'document-type prefills and private upload controls remain available',
    (tester) async {
      final f = Fixture();
      await tester.pumpWidget(f.screen());
      await tester.pump();
      const types = {
        'business_pan': 'Business PAN',
        'bank_proof': 'Bank proof',
        'address_proof': 'Address proof',
        'gst_certificate': 'GST certificate',
        'identity_proof': 'Identity proof',
      };
      await replyWidget(tester, f, {
        ...overview('store-a'),
        'required_documents': types.entries
            .map(
              (e) => {
                'document_type': e.key,
                'title': e.value,
                'status': 'submitted',
              },
            )
            .toList(),
      });
      await tester.pumpAndSettle();
      for (final type in types.keys) {
        await tester.ensureVisible(
          find.byKey(ValueKey('record-reference-$type')),
        );
        await openReference(tester, type: type);
        expect(
          tester
              .widget<LetbuyyChoiceField<String>>(
                find.byType(LetbuyyChoiceField<String>),
              )
              .initialValue,
          type,
        );
        expect(find.text('Camera'), findsNothing);
        expect(find.text('Gallery'), findsNothing);
        expect(find.text('File URL'), findsNothing);
        await tester.tap(find.widgetWithText(TextButton, 'Close'));
        await tester.pumpAndSettle();
      }
      await tester.tap(find.text('Add document'));
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<LetbuyyChoiceField<String>>(
              find.byType(LetbuyyChoiceField<String>),
            )
            .initialValue,
        'business_pan',
      );
      expect(f.calls.where((r) => r.method == 'POST'), isEmpty);
    },
  );

  testWidgets(
    'private upload form validates, shows loading, retries failure and records pending readback',
    (tester) async {
      final f = Fixture();
      await tester.pumpWidget(f.screen());
      await tester.pump();
      await replyWidget(tester, f, overview('store-a'));
      await tester.pumpAndSettle();
      expect(find.text('Verification documents'), findsOneWidget);
      expect(find.text('Required · Verified'), findsOneWidget);
      await openReference(tester);
      await tester.runAsync(() async {
        await tester.tap(find.widgetWithText(FilledButton, 'Upload document'));
        await Future<void>.delayed(const Duration(milliseconds: 100));
      });
      await tester.pump();
      expect(
        find.text('Enter only the final 2–4 reference characters.'),
        findsOneWidget,
      );
      expect(tester.widget<TextField>(find.byType(TextField)).maxLength, 4);
      expect(f.calls.where((r) => r.method == 'POST'), isEmpty);
      await submitReference(tester, f, '1234');
      expect(
        tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNull,
      );
      await replyUploadWidget(tester, f, {}, status: 503);
      expect(find.byKey(const ValueKey('reference-error')), findsOneWidget);
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller?.text,
        '1234',
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Upload document'));
      await awaitWidgetRequest(tester, f);
      await replyUploadWidget(tester, f, {
        'document': {'site_id': 'store-a'},
        'overview': referenceOverview('store-a', 'bank_proof', '1234'),
      });
      await tester.pumpAndSettle();
      expect(
        find.text('Private document received. No security scan result yet.'),
        findsOneWidget,
      );
      expect(find.text('Verification pending'), findsOneWidget);
      expect(find.text('Verified'), findsNothing);
      final writes = f.calls.where((r) => r.method == 'POST').toList();
      expect(writes.length, 2);
      for (final request in writes) {
        expect(request.path.endsWith('/kyc/documents/upload'), isTrue);
        expect(request.data, isA<FormData>());
      }
      expect(f.calls.any((r) => r.path.contains('/upload')), isTrue);
    },
  );

  testWidgets(
    'India direct upload availability enables the document control with test copy',
    (tester) async {
      final f = Fixture();
      await tester.pumpWidget(f.screen());
      await tester.pump();
      await replyWidget(tester, f, {
        ...overview('store-a'),
        'private_upload_available': false,
        'india_direct_upload_available': true,
      });
      await tester.pumpAndSettle();
      expect(find.textContaining('India upload test:'), findsOneWidget);
      expect(find.text('Add document'), findsOneWidget);
      expect(
        tester
            .widget<TextButton>(
              find.byKey(const ValueKey('record-reference-bank_proof')),
            )
            .onPressed,
        isNotNull,
      );
      expect(f.calls.where((r) => r.method == 'POST'), isEmpty);
    },
  );

  testWidgets(
    'unbound private storage disables uploads until a fresh status read reports recovery',
    (tester) async {
      final f = Fixture();
      await tester.pumpWidget(f.screen());
      await tester.pump();
      await replyWidget(tester, f, {
        ...overview('store-a', status: 'in_progress'),
        'private_upload_available': false,
        'next_action':
            'Private document upload is unavailable. Your saved status remains visible; retry later.',
      });
      await tester.pumpAndSettle();
      expect(
        find.textContaining('Private upload is unavailable.'),
        findsOneWidget,
      );
      expect(find.text('Add document'), findsNothing);
      expect(
        tester
            .widget<TextButton>(
              find.byKey(const ValueKey('record-reference-bank_proof')),
            )
            .onPressed,
        isNull,
      );
      expect(f.calls.where((r) => r.method == 'POST'), isEmpty);
      await tester.tap(find.byTooltip('Refresh'));
      await tester.pump();
      await replyWidget(tester, f, overview('store-a', status: 'in_progress'));
      await tester.pumpAndSettle();
      expect(find.text('Add document'), findsOneWidget);
      expect(
        tester
            .widget<FloatingActionButton>(find.byType(FloatingActionButton))
            .onPressed,
        isNotNull,
      );
    },
  );

  testWidgets(
    'upload permission denial is actionable and does not report success',
    (tester) async {
      final f = Fixture();
      await tester.pumpWidget(f.screen());
      await tester.pump();
      await replyWidget(tester, f, overview('store-a'));
      await tester.pumpAndSettle();
      await openReference(tester);
      await submitReference(tester, f, '1234');
      await replyUploadWidget(tester, f, {}, status: 403);
      await tester.pumpAndSettle();
      expect(
        find.text('You do not have permission to upload this document.'),
        findsOneWidget,
      );
      expect(
        find.text('Private document received. No security scan result yet.'),
        findsNothing,
      );
    },
  );

  testWidgets(
    'open reference form hides captured digits after account/store switch and sends nothing',
    (tester) async {
      final f = Fixture();
      await tester.pumpWidget(f.screen());
      await tester.pump();
      await replyWidget(tester, f, overview('store-a'));
      await tester.pumpAndSettle();
      await openReference(tester);
      await tester.enterText(find.byType(TextField), '1234');
      f.stores.change(actorId: 'actor-b', storeId: 'store-b');
      await tester.pumpAndSettle();
      expect(find.text('Store access changed'), findsOneWidget);
      expect(find.byType(TextField), findsNothing);
      expect(
        find.widgetWithText(FilledButton, 'Upload document'),
        findsNothing,
      );
      await tester.tap(find.widgetWithText(TextButton, 'Close'));
      await tester.pumpAndSettle();
      expect(f.calls.where((r) => r.method == 'POST'), isEmpty);
    },
  );

  testWidgets(
    'closed reference screen plus logout cannot accept delayed mutation cache or show success',
    (tester) async {
      final f = Fixture();
      await tester.pumpWidget(f.screen());
      await tester.pump();
      await replyWidget(tester, f, overview('store-a'));
      await tester.pumpAndSettle();
      await openReference(tester);
      await submitReference(tester, f, '1234');
      for (var i = 0; f.pending.isEmpty && i < 20; i++) {
        await tester.pump(const Duration(milliseconds: 10));
      }
      expect(f.pending, isNotEmpty);
      expect(
        tester
            .widget<TextButton>(find.widgetWithText(TextButton, 'Close'))
            .onPressed,
        isNull,
      );
      // Application/logout teardown may still retire a route while its upload finishes.
      await tester.pumpWidget(const SizedBox.shrink());
      f.stores.change(actorId: '', storeId: '');
      await replyUploadWidget(tester, f, {
        'overview': referenceOverview('store-a', 'bank_proof', '1234'),
      });
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(f.service.overview, isNull);
      expect(
        find.text('Private document received. No security scan result yet.'),
        findsNothing,
      );
    },
  );

  test(
    'global KYC cache clears after logout even with no mounted screen',
    () async {
      final f = Fixture();
      final read = f.service.fetchOverview('store-a');
      await f.reply(overview('store-a'));
      await read;
      f.stores.change(actorId: '', storeId: '');
      expect(f.service.overview, isNull);
      expect(f.service.documents, isEmpty);
    },
  );

  for (final method in ['submit', 'refresh']) {
    test(
      '$method fallback read cannot dispatch under a later account',
      () async {
        final fallbackStarted = Completer<void>();
        final fallbackToken = Completer<String?>();
        var lookups = 0;
        final f = Fixture(
          tokenProvider: () async {
            if (++lookups == 1) return 'synthetic-original-token';
            fallbackStarted.complete();
            return fallbackToken.future;
          },
        );
        final result = method == 'submit'
            ? f.service.submitDocument(
                storeId: 'store-a',
                documentType: 'bank_proof',
                documentNumberLast4: '1234',
              )
            : f.service.refreshDocument('document-store-a', 'store-a');
        final denied = expectLater(
          result,
          throwsA(
            isA<ApiException>().having(
              (e) => e.code,
              'code',
              'SESSION_CONTEXT_CHANGED',
            ),
          ),
        );
        await f.reply({
          'document': {'site_id': 'store-a'},
        });
        await fallbackStarted.future;
        f.stores.change(actorId: 'actor-b', storeId: 'store-b');
        fallbackToken.complete('synthetic-new-token');
        await denied;
        expect(f.calls.length, 1);
        expect(f.calls.single.method, 'POST');
        expect(f.service.overview, isNull);
        expect(f.service.isLoading, isFalse);
      },
    );
  }

  testWidgets(
    'in-flight reference dialog refuses a late response after store switch',
    (tester) async {
      final f = Fixture();
      await tester.pumpWidget(f.screen());
      await tester.pump();
      await replyWidget(tester, f, overview('store-a'));
      await tester.pumpAndSettle();
      await openReference(tester);
      await submitReference(tester, f, '1234');
      await awaitWidgetRequest(tester, f);
      f.stores.change(actorId: 'actor-a', storeId: 'store-b');
      await tester.pumpAndSettle();
      expect(find.byType(TextField), findsNothing);
      await replyUploadWidget(tester, f, {
        'overview': referenceOverview('store-a', 'bank_proof', '1234'),
      });
      await tester.pumpAndSettle();
      expect(find.text('Store access changed'), findsOneWidget);
      expect(
        find.text('Private document received. No security scan result yet.'),
        findsNothing,
      );
      expect(f.service.overview, isNull);
      expect(f.calls.length, 2);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'successful status refresh preserves captured SDK context through readback',
    (tester) async {
      final f = Fixture();
      final captured = f.api.captureRequestContext();
      await tester.pumpWidget(f.screen());
      await tester.pump();
      await replyWidget(tester, f, overview('store-a'));
      await tester.pumpAndSettle();
      await tester.drag(find.byType(ListView), const Offset(0, -160));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Refresh status'));
      await tester.pump();
      await replyWidget(tester, f, {
        'overview': overview('store-a', name: 'refreshed.png'),
      });
      await replyWidget(tester, f, overview('store-a', name: 'readback.png'));
      await tester.pumpAndSettle();
      expect(find.textContaining('readback.png'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(f.calls.length, 3);
      expect(
        f.calls.every(
          (r) =>
              r.extra['letbuyy.contextVersion'] == captured &&
              r.headers['X-Store-ID'] == 'store-a',
        ),
        isTrue,
      );
    },
  );

  for (final mutation in ['submit', 'refresh']) {
    test(
      '$mutation refuses wrong-site mutation overview without caching it',
      () async {
        final f = Fixture();
        final action = mutation == 'submit'
            ? f.service.submitDocument(
                storeId: 'store-a',
                documentType: 'bank_proof',
                documentNumberLast4: '1234',
              )
            : f.service.refreshDocument('document-store-a', 'store-a');
        final denied = expectLater(
          action,
          throwsA(
            isA<ApiException>().having(
              (e) => e.code,
              'code',
              'KYC_SCOPE_MISMATCH',
            ),
          ),
        );
        await f.reply({'overview': overview('rival-store')});
        await denied;
        expect(f.service.overview, isNull);
      },
    );
  }

  test(
    'reference-only legacy KYC submission is refused while read and refresh remain available',
    () async {
      final f = Fixture();
      final read = f.service.fetchOverview('store-a');
      await f.reply(overview('store-a', status: 'in_progress'));
      expect((await read)['overall_status'], 'in_progress');
      final submit = f.service.submitDocument(
        storeId: 'store-a',
        documentType: 'business_pan',
        documentNumberLast4: '1234',
      );
      final denied = expectLater(submit, throwsA(isA<ApiException>()));
      await f.reply({}, status: 410);
      await denied;
      final body = f.calls.last.data as Map;
      expect(body['document_type'], 'business_pan');
      expect(body['document_number_last4'], '1234');
      expect(body.containsKey('file_url'), isFalse);
      expect(body.containsKey('file_name'), isFalse);
      final refresh = f.service.refreshDocument('document-store-a', 'store-a');
      await f.reply({'overview': overview('store-a', status: 'in_progress')});
      expect((await refresh)['overview']['overall_status'], 'in_progress');
      expect(f.calls[0].path.endsWith('/kyc'), isTrue);
      expect(f.calls[1].path.endsWith('/kyc/documents'), isTrue);
      expect(f.service.overview?['site_id'], 'store-a');
      expect(
        f.calls.last.path.endsWith('/documents/document-store-a/refresh'),
        isTrue,
      );
    },
  );

  test(
    'a mismatched store overview is refused without exposing document metadata',
    () async {
      final f = Fixture();
      final result = f.service.fetchOverview('store-a');
      final refused = expectLater(
        result,
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'KYC_SCOPE_MISMATCH',
          ),
        ),
      );
      await f.reply(overview('rival-store', name: 'rival-proof.png'));
      await refused;
      expect(f.service.overview, isNull);
      expect(f.service.isLoading, isFalse);
    },
  );

  testWidgets(
    'permission denial while refreshing clears retained document metadata',
    (tester) async {
      final f = Fixture();
      await tester.pumpWidget(f.screen());
      await tester.pump();
      await replyWidget(tester, f, overview('store-a'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Refresh status'));
      await tester.pump();
      await replyWidget(tester, f, {}, status: 403);
      await tester.pumpAndSettle();
      expect(find.textContaining('retained-proof.png'), findsNothing);
      expect(
        find.text('You do not have access to verification for this store.'),
        findsOneWidget,
      );
      expect(find.byTooltip('Refresh status'), findsNothing);
    },
  );

  test(
    'file-bearing KYC submissions fail before SDK transport; no file URL is sent',
    () async {
      final f = Fixture();
      for (final file in [true, false]) {
        await expectLater(
          f.service.submitDocument(
            storeId: 'store-a',
            documentType: 'bank_proof',
            fileUrl: file ? 'https://cdn.invalid/proof.png' : null,
            fileName: file ? null : 'proof.png',
          ),
          throwsA(
            isA<ApiException>().having(
              (e) => e.code,
              'code',
              'KYC_PRIVATE_UPLOAD_UNAVAILABLE',
            ),
          ),
        );
      }
      expect(f.calls, isEmpty);
    },
  );

  test(
    'late store read cannot overwrite current overview or clear its loading state',
    () async {
      final f = Fixture();
      final first = f.service.fetchOverview('store-a');
      final refused = expectLater(
        first,
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'SESSION_CONTEXT_CHANGED',
          ),
        ),
      );
      while (f.pending.isEmpty) {
        await f._arrival.future;
      }
      f.stores.store = 'store-b';
      final second = f.service.fetchOverview('store-b');
      await f.reply(overview('store-a'));
      await refused;
      expect(f.service.overview, isNull);
      expect(f.service.isLoading, isTrue);
      await f.reply(overview('store-b'));
      await second;
      expect(f.service.overview?['site_id'], 'store-b');
      expect(f.service.isLoading, isFalse);
    },
  );

  testWidgets('private upload shows security-scan state before provider review', (
    tester,
  ) async {
    final f = Fixture();
    final pending = overview('store-a', status: 'in_progress');
    final document =
        (pending['documents'] as List).first as Map<String, dynamic>;
    document['status'] = 'submitted';
    document['provider_mode'] = 'sandbox';
    document['evidence_scan_status'] = 'pending';
    ((pending['required_documents'] as List).first
            as Map<String, dynamic>)['status'] =
        'submitted';
    pending['next_action'] =
        'Sandbox uploads are stored for testing only. They are not provider reviewed and cannot enable live payouts.';
    await tester.pumpWidget(f.screen());
    await tester.pump();
    await replyWidget(tester, f, pending);
    await tester.pumpAndSettle();
    expect(find.textContaining('No scan result yet'), findsOneWidget);
    expect(find.textContaining('not provider reviewed'), findsOneWidget);
    expect(find.text('Verified'), findsNothing);
  });

  testWidgets(
    'private upload screen keeps status loading, denial and retry usable',
    (tester) async {
      final f = Fixture();
      await tester.pumpWidget(f.screen());
      await tester.pump();
      expect(find.text('Private document upload'), findsOneWidget);
      expect(
        find.text('Checking private upload availability.'),
        findsOneWidget,
      );
      expect(find.text('Camera'), findsNothing);
      expect(find.text('Gallery'), findsNothing);
      expect(find.text('Submit'), findsNothing);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Add document'), findsNothing);
      await replyWidget(tester, f, {}, status: 403);
      await tester.pumpAndSettle();
      expect(
        find.text('You do not have access to verification for this store.'),
        findsOneWidget,
      );
      expect(find.text('Add document'), findsNothing);
      await tester.tap(find.text('Retry'));
      await tester.pump();
      await replyWidget(tester, f, overview('store-a'));
      await tester.pumpAndSettle();
      expect(find.text('Add document'), findsOneWidget);
      expect(find.text('retained-proof.png'), findsNothing);
      expect(find.textContaining('retained-proof.png'), findsOneWidget);
      expect(
        find.text(
          'Sandbox uploads are not provider reviewed and do not approve live payouts.',
        ),
        findsOneWidget,
      );
      expect(
        f.calls.every((r) => r.method == 'GET' && r.path.endsWith('/kyc')),
        isTrue,
      );
    },
  );

  testWidgets(
    'provider outage presents Retry without an unavailable upload action',
    (tester) async {
      final f = Fixture();
      await tester.pumpWidget(f.screen());
      await tester.pump();
      await replyWidget(tester, f, {}, status: 503);
      await tester.pumpAndSettle();
      expect(
        find.text('Verification details are temporarily unavailable.'),
        findsOneWidget,
      );
      expect(
        find.text(
          'Verification is unavailable. Retry to check whether private upload is available.',
        ),
        findsOneWidget,
      );
      expect(find.text('Retry'), findsOneWidget);
      expect(find.text('Add document'), findsNothing);
      await tester.tap(find.text('Retry'));
      await tester.pump();
      await replyWidget(tester, f, overview('store-a', status: 'in_progress'));
      await tester.pumpAndSettle();
      expect(find.text('Add document'), findsOneWidget);
      expect(f.calls.where((r) => r.method == 'POST'), isEmpty);
    },
  );

  testWidgets(
    'account/store switch hides retained documents immediately and rejects an old response',
    (tester) async {
      final f = Fixture();
      await tester.pumpWidget(f.screen());
      await tester.pump();
      await awaitWidgetRequest(tester, f);
      f.stores.change(actorId: 'actor-b', storeId: 'store-b');
      await tester.pump();
      await replyWidget(
        tester,
        f,
        overview('store-a', name: 'old-actor-proof.png'),
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('old-actor-proof.png'), findsNothing);
      expect(
        find.text('Store access changed. Reload verification details.'),
        findsOneWidget,
      );
      await tester.tap(find.text('Retry'));
      await tester.pump();
      await replyWidget(
        tester,
        f,
        overview('store-b', name: 'current-actor-proof.png'),
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('current-actor-proof.png'), findsOneWidget);
      f.stores.change(actorId: 'actor-b', storeId: 'store-c');
      await tester.pump();
      expect(find.textContaining('current-actor-proof.png'), findsNothing);
      expect(
        f.calls.any((r) => r.path.contains('upload') || r.method != 'GET'),
        isFalse,
      );
    },
  );

  testWidgets(
    'failed status refresh retains retry; account change while refreshing cannot restore old documents',
    (tester) async {
      final f = Fixture();
      await tester.pumpWidget(f.screen());
      await tester.pump();
      await replyWidget(tester, f, overview('store-a'));
      await tester.pumpAndSettle();
      // Scroll the document action above the floating reference button.
      await tester.drag(find.byType(ListView), const Offset(0, -160));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Refresh status'));
      await tester.pump();
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      await awaitWidgetRequest(tester, f);
      final firstRefreshKey =
          f.calls.last.headers['X-Idempotency-Key'] as String?;
      expect(firstRefreshKey, isNotEmpty);
      await replyWidget(tester, f, {}, status: 503);
      await tester.pumpAndSettle();
      expect(
        find.text('Verification status is unavailable. Try refreshing again.'),
        findsOneWidget,
      );
      // Let the error snackbar expire before using the action behind it.
      await tester.pump(const Duration(seconds: 4));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Refresh status'));
      await tester.pump();
      await awaitWidgetRequest(tester, f);
      expect(
        f.calls.last.headers['X-Idempotency-Key'],
        firstRefreshKey,
        reason: 'an uncertain provider result must retry with the same receipt',
      );
      f.stores.change(actorId: 'actor-b', storeId: 'store-b');
      await tester.pump();
      await replyWidget(tester, f, {
        'overview': overview('store-a', name: 'late-refresh-proof.png'),
      });
      await tester.pumpAndSettle();
      expect(find.textContaining('late-refresh-proof.png'), findsNothing);
      expect(
        find.text('Store access changed. Reload verification details.'),
        findsOneWidget,
      );
      expect(
        f.calls
            .where((r) => r.method == 'POST')
            .every((r) => r.path.endsWith('/refresh')),
        isTrue,
      );
    },
  );
}
