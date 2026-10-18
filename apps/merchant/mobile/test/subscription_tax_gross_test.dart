import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/subscription_service.dart';
const summary={'schema_version':1,'policy_version':'D-SUB-TAX-INCLUSIVE-V1','basis':'inclusive','currency':'INR','supply_type':'inter_state','gross_minor':69900,'taxable_minor':59237,'tax_minor':10663,'cgst_minor':0,'sgst_minor':0,'igst_minor':10663};
void main(){
 TestWidgetsFlutterBinding.ensureInitialized();
 setUp(()=>FlutterSecureStorage.setMockInitialValues({}));
 test('saved gross includes tax and the native caller does not add tax',(){
  final tax=SubscriptionTaxBreakdown.fromJson(summary,grossMinor:69900);expect(tax.gross,69900);expect(tax.base+tax.tax,69900);expect(tax.igst,10663);
 });
 test('intra-state canonical remainder survives the wire unchanged',(){
  final tax=SubscriptionTaxBreakdown.fromJson({...summary,'supply_type':'intra_state','cgst_minor':5331,'sgst_minor':5332,'igst_minor':0},grossMinor:69900);
  expect(tax.cgst+tax.sgst,tax.tax);expect(tax.gross,69900);
 });
 test('missing or inconsistent breakdown is refused before provider presentation',(){
  for(final value in [null,{...summary,'gross_minor':82482},{...summary,'tax_minor':0},{...summary,'supply_type':'intra_state'},{...summary,'gross_minor':69900.5}]){
   expect(()=>SubscriptionTaxBreakdown.fromJson(value,grossMinor:69900),throwsFormatException);
  }
 });
 test('new invoice reads public saved base while historical additive invoice stays unchanged',(){
  final current=BillingHistoryEntry.fromJson({'id':'synthetic','amount':69900,'tax_amount':10663,'total_amount':69900,'currency':'INR','tax':summary});
  expect(current.amountPaid,69900);expect(current.taxBreakdown!.base,59237);expect(current.totalAmount,69900);
  final legacy=BillingHistoryEntry.fromJson({'id':'synthetic-old','amount':69900,'tax_amount':12582,'total_amount':82482,'currency':'INR'});
  expect(legacy.amountPaid,69900);expect(legacy.totalAmount,82482);expect(legacy.taxBreakdown,isNull);
 });
 test('maintained service and SDK retain the same key/body through setup503 then saved gross reply',()async{
  final requests=<RequestOptions>[];final dio=Dio();
  final api=ApiClient(baseUrl:'https://gateway.test/v1',dio:dio,maxRetries:0,tokenProvider:()=>'synthetic-token');
  dio.interceptors.add(InterceptorsWrapper(onRequest:(options,handler){
   requests.add(options);final unavailable=requests.length==1;
   handler.resolve(Response(requestOptions:options,statusCode:unavailable?503:200,data:unavailable?
    {'error':{'code':'SUBSCRIPTION_TAX_SETUP_REQUIRED','message':'Synthetic missing profile'}}:
    {'data':{'amount':69900,'currency':'INR','tax':summary,'razorpay_order_id':'order_syn_tax'}}));
  }));
  final service=SubscriptionService(api:api,actorIdProvider:()=>'synthetic-actor');
  await expectLater(service.createCatalogCheckout(storeId:'synthetic-store',planSlug:'growth'),throwsA(anything));
  final reply=await service.createCatalogCheckout(storeId:'synthetic-store',planSlug:'growth');
  expect(reply['amount'],69900);expect(SubscriptionTaxBreakdown.fromJson(reply['tax'],grossMinor:reply['amount']).tax,10663);
  expect(requests.length,2);expect(requests[0].data,requests[1].data);
  expect(requests[0].headers['X-Idempotency-Key'],requests[1].headers['X-Idempotency-Key']);
  final storage=await const FlutterSecureStorage().readAll();expect(storage.values.join(),isNot(contains('gstin')));expect(storage.values.join(),isNot(contains('address')));
 });
}
