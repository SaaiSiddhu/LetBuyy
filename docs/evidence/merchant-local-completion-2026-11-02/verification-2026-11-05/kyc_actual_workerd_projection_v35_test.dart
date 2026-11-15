// Explicit cross-runtime local proof; projection was emitted by the actual
// compiled Worker/owned PG/private R2 test and parsed by the canonical TS schema.
import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/kyc_service.dart';
void main(){
 TestWidgetsFlutterBinding.ensureInitialized();
 test('Dart SDK and service accept the actual Worker public KYC projection without private fields',()async{
  final file=File(Platform.environment['LETBUYY_KYC_PUBLIC_FIXTURE_OUT']!);
  final body=jsonDecode(await file.readAsString()) as Map<String,dynamic>;
  final api=ApiClient(baseUrl:'https://owned-contract.invalid/v1',maxRetries:0);addTearDown(api.close);
  var calls=0;
  api.dio.interceptors.add(InterceptorsWrapper(onRequest:(o,h){calls++;h.resolve(Response(requestOptions:o,statusCode:200,data:{'data':body}));}));
  final service=KycService(api:api);addTearDown(service.dispose);
  await service.fetchOverview(body['site_id'] as String);
  expect(calls,1);expect(service.documents,hasLength(1));
  expect(service.documents.single['document_type'],'business_pan');
  expect(service.documents.single['status'],'submitted');
  expect(service.documents.single['has_private_upload'],isTrue);
  expect(service.documents.single['evidence_scan_status'],'pending');
  expect(service.documents.single.keys,isNot(anyOf(contains('metadata'),contains('private_object_key'),contains('file_url'),contains('file_name'))));
  final retained=service.overview;
  (body['documents'] as List).first['private_object_key']='synthetic-rejected-field';
  expect(service.overview,retained); // Accepted snapshot cannot be mutated by its transport owner.
  await expectLater(service.fetchOverview(body['site_id'] as String),throwsA(isA<ApiException>().having((e)=>e.code,'code','KYC_INVALID_RESPONSE')));
  expect(service.overview,isNull);
 });
}
