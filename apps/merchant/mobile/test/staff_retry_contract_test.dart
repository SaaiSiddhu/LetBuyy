import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/staff_service.dart';

// Client persistence/transport checks only. Actual membership/audit/receipt effects
// are proved by the Gateway owned-database journey, not this transport double.
class StaffTransport extends ApiClient {
  StaffTransport() : super(baseUrl: 'https://gateway.test/v1', maxRetries: 0);
  bool failNext = true;
  final calls = <ApiRequestOptions>[];
  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    calls.add(options!);
    if (failNext) {
      failNext = false;
      throw const ApiException(
        message: 'Synthetic lost reply',
        statusCode: 503,
        code: 'STAFF_STATE_UNAVAILABLE',
      );
    }
    return {
      'id': 'synthetic-member',
      'store_id': 'synthetic-store',
      'email': 'staff@example.invalid',
      'full_name': 'Synthetic Staff',
      'role': 'viewer',
      'status': 'active',
      'is_active': true,
      'created_at': '2026-10-15T00:00:00.000Z',
      'updated_at': '2026-10-15T00:00:01.000Z',
    };
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  test('a new service instance reuses a durably saved key after an ambiguous reply', () async {
    final api = StaffTransport();
    const input = StaffInviteInput(
      storeId: 'synthetic-store',
      email: 'staff@example.invalid',
      role: 'viewer',
    );
    await expectLater(
      StaffService(api: api).createStaff(input),
      throwsA(isA<ApiException>()),
    );
    final restored = StaffService(api: api);
    final member = await restored.createStaff(input);
    expect(api.calls[0].idempotencyKey, isNotEmpty);
    expect(api.calls[1].idempotencyKey, api.calls[0].idempotencyKey);
    expect(restored.members.single.id, member.id);
    await restored.createStaff(input);
    expect(
      api.calls.last.idempotencyKey,
      isNot(api.calls.first.idempotencyKey),
    );
    expect(
      restored.members.length,
      1,
      reason: 'a replayed member never duplicates the local roster',
    );
  });
  test('role changes and removal carry the observed version, store and stable logical key', () async {
    final api = StaffTransport()..failNext = false;
    final service = StaffService(api: api);
    final member = await service.createStaff(
      const StaffInviteInput(
        storeId: 'synthetic-store',
        email: 'staff@example.invalid',
        role: 'viewer',
      ),
    );
    api.failNext = true;
    await expectLater(
      service.updateRole(member, 'viewer'),
      throwsA(isA<ApiException>()),
    );
    final firstUpdate = api.calls.last;
    await service.updateRole(member, 'viewer');
    expect(api.calls.last.idempotencyKey, firstUpdate.idempotencyKey);
    expect(api.calls.last.body, {
      'role': 'viewer',
      'expected_updated_at': member.updatedAt,
      'store_id': member.storeId,
    });
    await service.removeStaff(member);
    expect(api.calls.last.body, {
      'expected_updated_at': member.updatedAt,
      'store_id': member.storeId,
    });
    expect(api.calls.last.idempotencyKey, isNot(firstUpdate.idempotencyKey));
    expect(service.members, isEmpty);
  });
}
