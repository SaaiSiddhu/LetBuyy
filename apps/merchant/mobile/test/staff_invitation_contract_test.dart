
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_store/services/store_auth_service.dart';
import 'package:letbuyy_store/screens/settings/accept_staff_invitation_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/staff_service.dart';

// Client transport/storage evidence only; owned DB/browser suites prove effects.
const proof =
    'lb-staff-invite-v1.11111111-1111-4111-8111-111111111111.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  test(
    'an invitation survives a service restart and is explicitly discarded',
    () async {
      final api = ApiClient(baseUrl: 'https://gateway.test/v1');
      final service = StaffService(api: api);
      await service.rememberInvitation(
        'https://admin.letbuyy.com/accept-invite?token=$proof',
      );
      final restored = StaffService(api: api);
      await restored.restorePendingInvitation();
      expect(restored.pendingInvitation, proof);
      await restored.clearInvitation();
      final cleared = StaffService(api: api);
      await cleared.restorePendingInvitation();
      expect(cleared.pendingInvitation, isNull);
    },
  );
  test('pasted links reject unrelated destinations, ordinary URLs and other purposes', () {
    for (final input in [
      'not a URL',
      '/accept-invite?token=$proof',
      'https://evil.test/accept-invite?token=$proof',
      'https://admin.letbuyy.com.evil.test/accept-invite?token=$proof',
      'https://user@admin.letbuyy.com/accept-invite?token=$proof',
      'https://admin.letbuyy.com/other?token=$proof',
      'Bearer $proof',
      'lb-session.111',
    ])
      expect(
        staffInvitationProof(input),
        isNull,
        reason: input.split('?').first,
      );
    expect(staffInvitationProof(proof), proof);
  });
  test('preview is read-only; explicit acceptance retries use a retained key and normal session without an unrelated store', () async {
    final requests = <RequestOptions>[];
    final dio = Dio();
    var failed = false;
    final api = ApiClient(
      baseUrl: 'https://gateway.test/v1',
      dio: dio,
      tokenProvider: () => 'synthetic-normal-session',
      storeIdProvider: () => 'unrelated-selected-store',
      attachSessionCookie: true,
      maxRetries: 0,
    );
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          requests.add(options);
          if (options.path.endsWith('/auth/accept-invite') && !failed) {
            failed = true;
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 503,
                data: {
                  'error': {
                    'code': 'STAFF_STATE_UNAVAILABLE',
                    'message': 'Synthetic lost reply',
                  },
                },
              ),
            );
            return;
          }
          handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {
                'success': true,
                'data': options.path.endsWith('/preview')
                    ? {
                        'id': 'invitation-1',
                        'store_id': 'target-store',
                        'permissions': {
                          'granted': ['products:read'],
                        },
                      }
                    : {'accepted': true, 'store_handle': 'target-store'},
              },
            ),
          );
        },
      ),
    );
    final staff = StaffService(api: api);
    await staff.rememberInvitation(proof);
    final preview = await staff.previewInvitation();
    expect(preview['id'], 'invitation-1');
    expect(requests, hasLength(1));
    expect(requests.single.path, endsWith('/employees/invitations/preview'));
    expect(requests.single.headers['X-Store-ID'], isNull);
    await expectLater(
      staff.acceptInvitation('invitation-1'),
      throwsA(isA<ApiException>()),
    );
    final restarted = StaffService(api: api);
    await restarted.restorePendingInvitation();
    expect(
      (await restarted.acceptInvitation('invitation-1'))['accepted'],
      isTrue,
    );
    expect(
      requests[2].headers['X-Idempotency-Key'],
      requests[1].headers['X-Idempotency-Key'],
    );
    expect(requests[1].headers['X-Idempotency-Key'], isNotEmpty);
    for (final request in requests) {
      expect(request.headers['X-Store-ID'], isNull);
      expect(request.headers['Cookie'], 'lb_session=synthetic-normal-session');
      expect(request.data, {'token': proof});
    }
  });
  testWidgets('normal signed-in preview shows actual grants and waits for explicit consent', (tester) async {
    final dio = Dio(); final api = ApiClient(baseUrl: 'https://gateway.test/v1', dio: dio);
    final requests = <RequestOptions>[];
    dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) {
      requests.add(options);
      handler.resolve(Response(requestOptions: options, statusCode: 200, data: {'data': {
        'id': 'invite-1', 'store_id': 'store-1', 'store_name': 'Synthetic invited store',
        'role': 'viewer', 'permissions': {'granted': ['products:read']}, 'status': 'pending',
      }}));
    }));
    final staff = StaffService(api: api); await staff.rememberInvitation(proof);
    final auth = _PreviewAuth(api);
    await tester.pumpWidget(MultiProvider(providers: [
      ChangeNotifierProvider<StaffService>.value(value: staff),
      ChangeNotifierProvider<StoreAuthService>.value(value: auth),
    ], child: const MaterialApp(home: AcceptStaffInvitationScreen())));
    await tester.pumpAndSettle();
    expect(find.text('Synthetic invited store'), findsOneWidget);
    expect(find.text('View products'), findsOneWidget);
    expect(find.text('Accept staff invitation'), findsOneWidget);
    expect(requests, hasLength(1));
    expect(requests.single.path, endsWith('/invitations/preview'));
    // Rendering or reopening a proof must never activate membership.
    await tester.pumpWidget(const SizedBox.shrink());
    expect(requests.where((r) => r.path.endsWith('/auth/accept-invite')), isEmpty);
  });
  test('owner renewal carries observed version and actual grants with a stable new-invitation intent', () async {
    final requests = <RequestOptions>[];
    final dio = Dio();
    final service = StaffService(
      api: ApiClient(baseUrl: 'https://gateway.test/v1', dio: dio),
    );
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          requests.add(options);
          handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 201,
              data: {
                'data': {
                  'id': 'member-1',
                  'store_id': 'store-1',
                  'email': 'synthetic@example.invalid',
                  'role': 'editor',
                  'status': 'invited',
                  'updated_at': '2026-10-15T00:01:00Z',
                  'permissions': {
                    'granted': ['products:read'],
                  },
                  'invitation': {
                    'accept_url':
                        'https://admin.letbuyy.com/accept-invite?token=$proof',
                    'expires_at': '2026-10-16T00:00:00Z',
                  },
                },
              },
            ),
          );
        },
      ),
    );
    final member = StaffMemberContract.fromJson({
      'id': 'member-1',
      'store_id': 'store-1',
      'role': 'editor',
      'updated_at': '2026-10-15T00:00:00Z',
      'permissions': {
        'granted': ['products:read'],
      },
    });
    final invited = await service.inviteStaff(
      const StaffInviteInput(
        storeId: 'store-1',
        email: 'synthetic@example.invalid',
        role: 'editor',
      ),
      renew: member,
    );
    expect(invited.url, contains('/accept-invite?'));
    expect(invited.member.status, 'invited');
    expect(requests.single.path, endsWith('/employees/invite'));
    expect(
      requests.single.data,
      containsPair('expected_updated_at', member.updatedAt),
    );
    expect(
      requests.single.data,
      containsPair('permissions', {
        'granted': ['products:read'],
      }),
    );
    expect(requests.single.headers['X-Idempotency-Key'], isNotEmpty);
  });
}

class _PreviewAuth extends StoreAuthService {
  _PreviewAuth(ApiClient api) : super(api: api, identityBaseUrl: 'https://accounts.test');
  @override bool get isSignedIn => true;
  @override MerchantSessionUser get currentUser => const MerchantSessionUser(id: 'synthetic-subject', email: 'synthetic@example.invalid');
}
