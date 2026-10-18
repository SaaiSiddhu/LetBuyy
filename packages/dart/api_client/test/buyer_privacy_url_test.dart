import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:test/test.dart';
void main() {
 const id='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
 test('privacy entry keeps the canonical Identity origin and a refusal-only account hint',(){
  final uri=buildBuyerPrivacyUri(identityBaseUrl:'https://accounts.letbuyy.test',buyerAccountId:id);
  expect(uri.origin,'https://accounts.letbuyy.test');expect(uri.path,'/buyer/privacy');expect(uri.queryParameters,{'buyer_hint':id});expect(uri.fragment,isEmpty);expect(uri.userInfo,isEmpty);
  expect(buildBuyerPrivacyUri(identityBaseUrl:'http://127.0.0.1:12345',buyerAccountId:id).port,12345);
 });
 test('unsafe origins and credential-shaped or malformed hints cannot create privacy entry URLs',(){
  for(final origin in ['http://evil.example','https://user:password@accounts.example','https://accounts.example/path','https://accounts.example?token=secret']) {
   expect(()=>buildBuyerPrivacyUri(identityBaseUrl:origin,buyerAccountId:id),throwsArgumentError);
  }
  for(final value in ['','not-a-buyer','https://evil.example','bearer-token']) {
   expect(()=>buildBuyerPrivacyUri(identityBaseUrl:'https://accounts.letbuyy.test',buyerAccountId:value),throwsArgumentError);
  }
 });
}
