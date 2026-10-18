// SDK DTO/transport proof only; the owned PostgreSQL and device suites prove authority.
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:test/test.dart';

const site = '22222222-2222-4222-8222-222222222222';
const version = '2026-10-16T05:00:00.123456Z';
JsonMap program() => {
  'site_id': site,
  'is_active': true,
  'earn_rate_bps': 1234,
  'redeem_cap_bps': 5000,
  'point_value_minor': '9007199254740993',
  'updated_at': version,
};
JsonMap snapshot() => {
  'store_id': site,
  'enrolled': true,
  'program': program(),
  'outstanding_points': '9007199254740993',
  'valuation_policy': 'block_decrease_while_outstanding',
  'value_decrease_allowed': false,
};

class Adapter implements HttpClientAdapter {
  Adapter(this.reply, {this.status = 200});
  final Object reply;
  final int status;
  final calls = <RequestOptions>[];
  @override
  Future<ResponseBody> fetch(
    RequestOptions r,
    Stream<Uint8List>? stream,
    Future<void>? cancel,
  ) async {
    calls.add(r);
    return ResponseBody.fromString(
      jsonEncode({
        'success': status == 200,
        ...(status == 200 ? {'data': reply} : {'error': reply}),
      }),
      status,
      headers: {
        'content-type': ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

(ApiClient, Adapter) client(Object reply, {int status = 200}) {
  final dio = Dio(), adapter = Adapter(reply, status: status);
  dio.httpClientAdapter = adapter;
  return (
    ApiClient(
      baseUrl: 'https://gateway.example.invalid/v1',
      dio: dio,
      maxRetries: 0,
      tokenProvider: () => 'synthetic-owner',
      storeIdProvider: () => 'stale-default',
    ),
    adapter,
  );
}

void main() {
  test('read and save preserve exact timestamps, integer strings, scoped headers and retry identity', () async {
    final (c, a) = client(snapshot());
    final read = await c.loyalty.program(site);
    expect(read['outstanding_points'], '9007199254740993');
    expect((read['program'] as Map)['updated_at'], version);
    expect(a.calls.single.queryParameters, {'store_id': site});
    expect(a.calls.single.headers['X-Store-ID'], site);
    expect(a.calls.single.headers['Authorization'], 'Bearer synthetic-owner');
    c.close();
    final (w, b) = client({
      ...program(),
      'created': false,
      'outstanding_points': '41',
      'valuation_policy': 'block_decrease_while_outstanding',
      'value_decrease_allowed': false,
      'liability_delta_minor': '9007199254740993',
    });
    final input = {
      'store_id': site,
      'expected_updated_at': version,
      'point_value_minor': '9007199254740993',
    };
    final result = await w.loyalty.setProgram(
      input,
      idempotencyKey: 'synthetic-same-save',
    );
    expect(result['liability_delta_minor'], '9007199254740993');
    expect(b.calls.single.data, input);
    expect(b.calls.single.headers['X-Idempotency-Key'], 'synthetic-same-save');
    w.close();
  });
  test('not-enrolled and paused are distinct real response states', () async {
    for (final enrolled in [false, true]) {
      final (c, _) = client({
        ...snapshot(),
        'enrolled': enrolled,
        'program': enrolled ? {...program(), 'is_active': false} : null,
      });
      final r = await c.loyalty.program(site);
      expect(r['enrolled'], enrolled);
      expect(
        enrolled ? (r['program'] as Map)['is_active'] : r['program'],
        enrolled ? false : null,
      );
      c.close();
    }
  });
  test('unsafe money, malformed versions and mismatched scopes never become form defaults', () async {
    for (final bad in [
      {...snapshot(), 'outstanding_points': 4},
      {
        ...snapshot(),
        'program': {...program(), 'point_value_minor': 9007199254740992},
      },
      {
        ...snapshot(),
        'program': {...program(), 'updated_at': 'bad'},
      },
      {
        ...snapshot(),
        'program': {...program(), 'site_id': 'other'},
      },
      {...snapshot(), 'valuation_policy': 'allow_decrease'},
      {...snapshot(), 'enrolled': false},
    ]) {
      final (c, _) = client(bad);
      await expectLater(
        c.loyalty.program(site),
        throwsA(
          isA<ApiException>().having((e) => e.code, 'code', 'INVALID_RESPONSE'),
        ),
      );
      c.close();
    }
  });
  test('invalid intents and keys fail before bytes are sent', () async {
    final (c, a) = client({});
    for (final input in [
      {'store_id': site, 'is_active': true},
      {'store_id': site, 'expected_updated_at': null, 'point_value_minor': 100},
      {
        'store_id': site,
        'expected_updated_at': null,
        'point_value_minor': '9223372036854775808',
      },
      {'store_id': site, 'expected_updated_at': null, 'earn_rate_bps': 10001},
      {
        'store_id': site,
        'expected_updated_at': null,
        'is_active': true,
        'actor_id': 'forged',
      },
    ]) {
      await expectLater(
        c.loyalty.setProgram(input, idempotencyKey: 'synthetic-key'),
        throwsArgumentError,
      );
    }
    await expectLater(
      c.loyalty.setProgram({
        'store_id': site,
        'expected_updated_at': null,
        'is_active': true,
      }, idempotencyKey: ' bad-key '),
      throwsArgumentError,
    );
    expect(a.calls, isEmpty);
    c.close();
  });
  test(
    'conflict and ownership denials remain failures without automatic retry',
    () async {
      for (final status in [401, 403, 404, 409, 503]) {
        final (c, a) = client({
          'code': 'SYNTHETIC_FAILURE',
          'message': 'Synthetic failure',
        }, status: status);
        await expectLater(
          c.loyalty.setProgram({
            'store_id': site,
            'expected_updated_at': version,
            'is_active': false,
          }, idempotencyKey: 'same-save-key'),
          throwsA(
            isA<ApiException>().having((e) => e.statusCode, 'status', status),
          ),
        );
        expect(a.calls, hasLength(1));
        c.close();
      }
    },
  );
}
