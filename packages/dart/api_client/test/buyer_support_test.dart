// Explicit Dio transport fakes. Ownership/public visibility are also checked
// through the real production worker by the separate owned database fixture.
import 'dart:async';

import 'package:dio/dio.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:test/test.dart';

const ticketId = '11111111-1111-4111-8111-111111111111';
const messageId = '22222222-2222-4222-8222-222222222222';
JsonMap ticket() => {
  'id': ticketId,
  'ticket_ref': 'SYN-1',
  'subject': 'Synthetic ticket',
  'status': 'open',
  'topic': null,
  'created_at': '2026-10-16T10:00:00+00:00',
  'last_agent_message_at': null,
};
JsonMap message() => {
  'id': messageId,
  'author_type': 'agent',
  'body': 'A public reply',
  'created_at': '2026-10-16T10:01:00Z',
};
Object envelope(Object? data) => {'success': true, 'data': data};

({BuyerSupportApi api, Dio dio, List<RequestOptions> requests}) transport(
  Object? body, {
  int status = 200,
}) {
  final requests = <RequestOptions>[];
  final dio = Dio();
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (request, handler) {
        requests.add(request);
        handler.resolve(
          Response(requestOptions: request, statusCode: status, data: body),
        );
      },
    ),
  );
  return (
    api: BuyerSupportApi(
      ApiClient(
        baseUrl: 'https://gateway.example.invalid/v1',
        dio: dio,
        maxRetries: 0,
      ),
    ),
    dio: dio,
    requests: requests,
  );
}

void main() {
  final invalid = throwsA(
    isA<ApiException>().having((e) => e.code, 'code', 'INVALID_RESPONSE'),
  );

  test(
    'tickets use the canonical per-call buyer header and allowlist immutable display fields',
    () async {
      final h = transport(
        envelope([
          {
            ...ticket(),
            'internal_notes': 'must not expose',
            'requester_user_id': 'private',
          },
        ]),
      );
      final records = await h.api.listTickets('synthetic-A');
      expect(records.single, ticket());
      expect(() => records.add(ticket()), throwsUnsupportedError);
      expect(
        () => records.single['subject'] = 'changed',
        throwsUnsupportedError,
      );
      final request = h.requests.single;
      expect(request.uri.path, '/v1/storefront/buyer/support/tickets');
      expect(request.queryParameters, {'limit': 50});
      expect(request.headers[letbuyyBuyerSessionHeader], 'synthetic-A');
      expect(request.headers.containsKey('Authorization'), isFalse);
      expect(request.method, 'GET');
    },
  );

  test(
    'public messages bind the ticket path and strip unrelated metadata',
    () async {
      final h = transport(
        envelope([
          {
            ...message(),
            'visibility': 'public',
            'ticket_id': ticketId,
            'metadata': {'private': true},
          },
        ]),
      );
      final records = await h.api.listPublicMessages('synthetic-A', ticketId);
      expect(records.single, message());
      expect(
        h.requests.single.uri.path,
        '/v1/storefront/buyer/support/tickets/$ticketId/messages',
      );
      expect(h.requests.single.queryParameters, isEmpty);
      expect(
        h.requests.single.headers[letbuyyBuyerSessionHeader],
        'synthetic-A',
      );
    },
  );

  test(
    'invalid input cannot send a request or substitute an owner/site authority',
    () async {
      final h = transport(envelope([]));
      await expectLater(h.api.listTickets(''), throwsArgumentError);
      await expectLater(h.api.listTickets('   '), throwsArgumentError);
      await expectLater(h.api.listTickets('A', limit: 0), throwsRangeError);
      await expectLater(h.api.listTickets('A', limit: 51), throwsRangeError);
      for (final id in [
        '',
        '../tickets',
        '$ticketId/messages?buyer_account_id=other',
      ]) {
        await expectLater(
          h.api.listPublicMessages('A', id),
          throwsArgumentError,
        );
      }
      expect(h.requests, isEmpty);
    },
  );

  test(
    'malformed envelopes remain errors instead of fabricated empty support',
    () async {
      for (final body in [
        null,
        [],
        {'data': []},
        {'success': false, 'data': []},
        envelope({}),
        envelope([null]),
      ]) {
        await expectLater(transport(body).api.listTickets('A'), invalid);
      }
    },
  );

  test(
    'ticket IDs, status, optional fields, dates and duplicate records are validated',
    () async {
      for (final record in [
        {...ticket(), 'id': 'bad'},
        {...ticket(), 'status': ''},
        {...ticket(), 'status': true},
        {...ticket(), 'subject': 42},
        {...ticket(), 'ticket_ref': []},
        {...ticket(), 'topic': {}},
        {...ticket(), 'created_at': null},
        {...ticket(), 'created_at': 'today'},
        {...ticket(), 'last_agent_message_at': 'invalid'},
        Map.of(ticket())..remove('subject'),
        Map.of(ticket())..remove('last_agent_message_at'),
      ]) {
        await expectLater(
          transport(envelope([record])).api.listTickets('A'),
          invalid,
        );
      }
      await expectLater(
        transport(envelope([ticket(), ticket()])).api.listTickets('A'),
        invalid,
      );
      await expectLater(
        transport(
          envelope([
            ticket(),
            {...ticket(), 'id': messageId},
          ]),
        ).api.listTickets('A', limit: 1),
        invalid,
      );
    },
  );

  test(
    'explicitly private, foreign, malformed and duplicated messages are rejected as a whole',
    () async {
      for (final record in [
        {...message(), 'visibility': 'internal'},
        {...message(), 'visibility': null},
        {...message(), 'ticket_id': messageId},
        {...message(), 'ticket_id': null},
        {...message(), 'author_type': 'internal'},
        {...message(), 'body': null},
        {...message(), 'id': 'bad'},
        {...message(), 'created_at': 'now'},
      ]) {
        await expectLater(
          transport(envelope([record])).api.listPublicMessages('A', ticketId),
          invalid,
        );
      }
      await expectLater(
        transport(
          envelope([message(), message()]),
        ).api.listPublicMessages('A', ticketId),
        invalid,
      );
      final overLimit = List.generate(
        201,
        (i) => {
          ...message(),
          'id':
              '33333333-3333-4333-8333-${i.toRadixString(16).padLeft(12, '0')}',
        },
      );
      await expectLater(
        transport(envelope(overLimit)).api.listPublicMessages('A', ticketId),
        invalid,
      );
    },
  );

  test(
    'empty windows and nullable ticket display fields retain their actual meaning',
    () async {
      expect(await transport(envelope([])).api.listTickets('A'), isEmpty);
      expect(
        await transport(envelope([])).api.listPublicMessages('A', ticketId),
        isEmpty,
      );
      final row = {
        ...ticket(),
        'subject': null,
        'ticket_ref': null,
        'last_agent_message_at': '2026-10-16T10:00:00.123456Z',
      };
      expect(
        (await transport(envelope([row])).api.listTickets('A')).single,
        row,
      );
    },
  );

  test(
    'shared-client overlapping A/B reads keep credentials per request without mutable defaults',
    () async {
      final dio = Dio();
      final requests = <RequestOptions>[];
      final a = Completer<void>();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (request, handler) async {
            requests.add(request);
            final token = request.headers[letbuyyBuyerSessionHeader];
            if (token == 'A') await a.future;
            handler.resolve(
              Response(
                requestOptions: request,
                statusCode: 200,
                data: envelope([
                  {...ticket(), 'subject': 'Ticket $token'},
                ]),
              ),
            );
          },
        ),
      );
      final api = BuyerSupportApi(
        ApiClient(
          baseUrl: 'https://gateway.example.invalid',
          dio: dio,
          maxRetries: 0,
        ),
      );
      final readA = api.listTickets('A');
      final readB = api.listTickets('B');
      expect((await readB).single['subject'], 'Ticket B');
      a.complete();
      expect((await readA).single['subject'], 'Ticket A');
      expect(requests.map((r) => r.headers[letbuyyBuyerSessionHeader]), [
        'A',
        'B',
      ]);
      expect(
        dio.options.headers.containsKey(letbuyyBuyerSessionHeader),
        isFalse,
      );
      expect(dio.options.headers.containsKey('Authorization'), isFalse);
      expect(
        requests.every(
          (r) => r.queryParameters.keys.every((k) => k == 'limit'),
        ),
        isTrue,
      );
      expect(requests.every((r) => r.method == 'GET'), isTrue);
    },
  );

  test(
    'ownership/revocation/server failures retain errors with no fake empty window',
    () async {
      for (final status in [401, 403, 404, 500, 503]) {
        final body = {
          'success': false,
          'error': {'code': 'UNAVAILABLE', 'message': 'Unavailable'},
        };
        final h = transport(body, status: status);
        await expectLater(
          h.api.listTickets('A'),
          throwsA(
            isA<ApiException>().having((e) => e.statusCode, 'status', status),
          ),
        );
        await expectLater(
          h.api.listPublicMessages('A', ticketId),
          throwsA(
            isA<ApiException>().having((e) => e.statusCode, 'status', status),
          ),
        );
        expect(h.requests.length, 2);
      }
    },
  );

  test(
    'a connection failure is actionable rather than an empty ticket list',
    () async {
      final dio = Dio()
        ..interceptors.add(
          InterceptorsWrapper(
            onRequest: (request, handler) {
              handler.reject(
                DioException(
                  requestOptions: request,
                  type: DioExceptionType.connectionError,
                ),
              );
            },
          ),
        );
      final api = BuyerSupportApi(
        ApiClient(
          baseUrl: 'https://gateway.example.invalid',
          dio: dio,
          maxRetries: 0,
        ),
      );
      await expectLater(api.listTickets('A'), throwsA(isA<ApiException>()));
    },
  );
}
