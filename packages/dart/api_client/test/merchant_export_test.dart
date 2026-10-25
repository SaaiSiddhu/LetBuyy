import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:test/test.dart';

class CsvAdapter implements HttpClientAdapter {
  CsvAdapter({this.status=200,this.contentType='text/csv',this.body='name,stock\nSynthetic,3\n'});
  final int status;
  final String contentType,body;
  RequestOptions? request;
  @override
  Future<ResponseBody> fetch(RequestOptions options,Stream<Uint8List>? stream,Future<void>? cancel) async {
    request=options;
    return ResponseBody.fromString(body,status,headers:{'content-type':[contentType]});
  }
  @override
  void close({bool force=false}) {}
}
void main() {
  test('merchant CSV bytes use the configured BFF, normal session and download token',() async {
    final adapter=CsvAdapter(),dio=Dio();dio.httpClientAdapter=adapter;
    final client=ApiClient(baseUrl:'https://bff.example.invalid/v1',dio:dio,token:'synthetic-session',storeId:'synthetic-store',attachSessionCookie:true,maxRetries:0);
    expect(await client.exports.download('synthetic-job',token:'synthetic-download-proof'),'name,stock\nSynthetic,3\n');
    expect(adapter.request!.uri.origin,'https://bff.example.invalid');
    expect(adapter.request!.uri.path,'/v1/export/jobs/synthetic-job/download');
    expect(adapter.request!.queryParameters['token'],'synthetic-download-proof');
    expect(adapter.request!.headers['Cookie'],contains('lb_session=synthetic-session'));
    client.close();
  });
  test('failed downloads and JSON replies never become shared CSV content',() async {
    for(final adapter in [CsvAdapter(status:401,contentType:'application/json',body:'{"error":{"code":"UNAUTHORIZED","message":"Sign in"}}'),CsvAdapter(contentType:'application/json',body:'{"data":{"not":"csv"}}')]) {
      final dio=Dio();dio.httpClientAdapter=adapter;
      final client=ApiClient(baseUrl:'https://bff.example.invalid/v1',dio:dio,maxRetries:0);
      await expectLater(client.exports.download('synthetic-job',token:'synthetic-proof'),throwsA(isA<ApiException>()));
      client.close();
    }
  });
}
