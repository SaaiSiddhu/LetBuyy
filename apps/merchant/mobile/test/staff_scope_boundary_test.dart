// Client/widget scope regressions. Failed baselines and current results are
// retained in MOBILE_UI_MIGRATION.md; the storage-policy dependency stays open.
// canonical membership and receipt effects require the separate owned DB lane.
import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/screens/settings/staff_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/staff_service.dart';
import 'package:letbuyy_store/services/store_service.dart';

const siteA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const siteB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const memberId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const invitation =
    'lb-staff-invite-v1.11111111-1111-4111-8111-111111111111.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
JsonMap member(String site) => {
  'id': memberId,
  'store_id': site,
  'email': 'staff@example.invalid',
  'full_name': site == siteA ? 'Private staff A' : 'Private staff B',
  'role': 'viewer',
  'status': 'active',
  'is_active': true,
  'created_at': '2026-11-04T00:00:00Z',
  'updated_at': '2026-11-04T00:00:01Z',
  'permissions': {
    'granted': ['products:read'],
  },
};
void respond(RequestOptions r, RequestInterceptorHandler h, Object body) =>
    h.resolve(
      Response(
        requestOptions: r,
        statusCode: 200,
        data: {
          'data': body,
          if (r.method == 'GET' &&
              r.path.endsWith('/employees') &&
              body is List)
            'meta': {
              'page': r.queryParameters['page'] ?? 1,
              'per_page': r.queryParameters['limit'] ?? 50,
              'total': body.length,
              'total_pages': body.isEmpty ? 0 : 1,
              'has_prev': false,
              'has_next': false,
            },
        },
      ),
    );

class FixedStores extends StoreService {
  FixedStores(ApiClient api) : super(api: api);
  @override
  Future<List<StoreModel>> fetchStores() async => [siteA, siteB]
      .map(
        (id) => StoreModel.fromJson({
          'id': id,
          'name': id,
          'site_type': 'store',
          'subdomain': 'synthetic',
        }),
      )
      .toList();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    SharedPreferences.setMockInitialValues({});
  });
  test(
    'positive hosted invitation remains in its existing namespace; local restore cannot adopt it',
    () async {
      FlutterSecureStorage.setMockInitialValues({
        'letbuyy.staff.pending-invitation.v1': invitation,
      });
      final api = ApiClient(baseUrl: 'https://gateway.test/v1', maxRetries: 0);
      try {
        final hosted = StaffService(api: api, environment: 'production');
        await hosted.restorePendingInvitation();
        expect(hosted.pendingInvitation, invitation);
        final local = StaffService(api: api, environment: 'local');
        await local.restorePendingInvitation();
        expect(local.pendingInvitation, isNull);
        expect(
          await const FlutterSecureStorage().read(
            key: 'letbuyy.staff.pending-invitation.v1',
          ),
          invitation,
          reason: 'Local work must preserve hosted proof bytes',
        );
      } finally {
        api.close();
      }
    },
  );
  test(
    'a populated private staff cache retires immediately when its captured actor/store context changes',
    () async {
      Object frame = Object();
      final dio = Dio();
      final api = ApiClient(
        baseUrl: 'https://gateway.test/v1',
        dio: dio,
        maxRetries: 0,
        contextVersionProvider: () => frame,
      );
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (r, h) => respond(r, h, [member(siteA)]),
        ),
      );
      try {
        final service = StaffService(api: api);
        expect(
          (await service.fetchStaff(siteA)).single.fullName,
          'Private staff A',
        );
        expect(service.members, hasLength(1));
        frame = Object();
        expect(service.members, isEmpty);
      } finally {
        api.close();
      }
    },
  );
  test(
    'queued staff commands cannot acquire another current account after waiting on the first command',
    () async {
      Object frame = Object();
      final firstArrived = Completer<void>();
      final calls = <RequestOptions>[];
      late RequestOptions heldRequest;
      late RequestInterceptorHandler heldHandler;
      final dio = Dio();
      final api = ApiClient(
        baseUrl: 'https://gateway.test/v1',
        dio: dio,
        maxRetries: 0,
        contextVersionProvider: () => frame,
        tokenProvider: () => 'synthetic-session',
      );
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (r, h) {
            calls.add(r);
            if (calls.length == 1) {
              heldRequest = r;
              heldHandler = h;
              firstArrived.complete();
            } else {
              respond(r, h, member(siteA));
            }
          },
        ),
      );
      try {
        final service = StaffService(api: api);
        const input = StaffInviteInput(
          storeId: siteA,
          email: 'staff@example.invalid',
          role: 'viewer',
        );
        final first = service.createStaff(input);
        final firstDenied = expectLater(first, throwsA(isA<ApiException>()));
        final queued = service.createStaff(input);
        final queuedDenied = expectLater(queued, throwsA(isA<ApiException>()));
        await firstArrived.future;
        frame = Object();
        respond(heldRequest, heldHandler, member(siteA));
        await firstDenied;
        await queuedDenied;
        expect(
          calls,
          hasLength(1),
          reason:
              'Only the first request was dispatched; the queued original context is retired',
        );
        expect(service.members, isEmpty);
      } finally {
        api.close();
      }
    },
  );
  testWidgets(
    'staff roster and mutation controls cannot retain store A under selected store B',
    (tester) async {
      final dio = Dio();
      late StoreContext stores;
      final api = ApiClient(
        baseUrl: 'https://gateway.test/v1',
        dio: dio,
        maxRetries: 0,
        contextVersionProvider: () => stores.requestContextKey,
        storeIdProvider: () => stores.selectedStoreId,
      );
      stores = StoreContext(
        storeService: FixedStores(api),
        environment: 'local',
      );
      await stores.ensureSelectedStore();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (r, h) =>
              respond(r, h, [member(r.queryParameters['store_id'] as String)]),
        ),
      );
      final staff = StaffService(api: api, environment: 'local');
      try {
        await tester.pumpWidget(
          MultiProvider(
            providers: [
              ChangeNotifierProvider<StoreContext>.value(value: stores),
              ChangeNotifierProvider<StaffService>.value(value: staff),
            ],
            child: const MaterialApp(home: StaffScreen()),
          ),
        );
        await tester.pumpAndSettle();
        expect(
          find.text('Private staff A'),
          findsOneWidget,
          reason: 'A populated positive must precede privacy denial',
        );
        await stores.selectStoreById(siteB);
        await tester.pump();
        expect(
          find.text('Private staff A'),
          findsNothing,
          reason: 'Retire private content before any new read/notice',
        );
        await tester.pumpAndSettle();
        expect(find.text('Private staff A'), findsNothing);
      } finally {
        await tester.pumpWidget(const SizedBox.shrink());
        staff.dispose();
        stores.dispose();
        api.close();
      }
    },
  );
}
