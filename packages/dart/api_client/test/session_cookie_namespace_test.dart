import 'package:dio/dio.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:test/test.dart';

void main() {
  test(
    'staging transport replaces stale session cookies and withOptions preserves its namespace',
    () async {
      final dio = Dio();
      final client = ApiClient(
        baseUrl: 'https://stage.invalid/v1',
        token: 'current-stage-token',
        attachSessionCookie: true,
        sessionCookieName: 'lb_session_staging',
        dio: dio,
        headers: {
          'Cookie':
              'other=value; lb_session=production-token; lb_session_staging=stale-stage-token',
        },
      );
      final copyDio = Dio();
      final copy = client.withOptions(dio: copyDio);
      var seen = 0;
      for (final transport in [dio, copyDio]) {
        transport.interceptors.add(
          InterceptorsWrapper(
            onRequest: (options, handler) {
              seen++;
              expect(
                options.headers['Cookie'],
                'other=value; lb_session_staging=current-stage-token',
              );
              expect(
                options.headers['Authorization'],
                'Bearer current-stage-token',
              );
              handler.resolve(
                Response(
                  requestOptions: options,
                  statusCode: 200,
                  data: {
                    'success': true,
                    'data': {'authenticated': true},
                  },
                ),
              );
            },
          ),
        );
      }
      await client.requestJson('/auth/session');
      await copy.requestJson('/auth/session');
      expect(seen, 2);
      client.close();
      copy.close();
    },
  );

  test('unknown cookie names cannot create an arbitrary credential header', () {
    expect(
      () => ApiClient(
        baseUrl: 'https://stage.invalid',
        sessionCookieName: 'other_cookie',
      ),
      throwsArgumentError,
    );
  });
}
