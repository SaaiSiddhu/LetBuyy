// Real ProductService and SDK serialization with synthetic Dio boundary.
// Canonical owned API admission is checked separately; no session/provider proof.
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/product_service.dart';
const site='aaaaaaaa-1111-4111-8111-111111111111',id='bbbbbbbb-2222-4222-8222-222222222222',variant='cccccccc-3333-4333-8333-333333333333';
void main(){TestWidgetsFlutterBinding.ensureInitialized();
 for(final editing in [false,true])test('catalog Code option/specification remains legitimate editing=$editing',()async{
  final dio=Dio();var calls=0;dio.interceptors.add(InterceptorsWrapper(onRequest:(request,handler){calls++;handler.resolve(Response<Object?>(requestOptions:request,statusCode:editing?200:201,data:{'data':{'id':id,'store_id':site,'name':'Synthetic code product','price':125,'stock':0,'version':7,'images':[]}}));}));
  final api=ApiClient(baseUrl:'https://synthetic-gateway.example.invalid',storeId:site,dio:dio,maxRetries:0),service=ProductService(api:ApiClient(baseUrl:'https://synthetic-gateway.example.invalid',storeId:site,dio:dio,maxRetries:0));addTearDown(service.dispose);addTearDown(api.close);
  final metadata={'specifications':{'Code':'A-1'}};
  if(editing){await service.updateProduct(id,{'name':'Synthetic code product','metadata':metadata,'variants':[{'id':variant,'title':'A-1','options':{'Code':'A-1'}}]},storeId:site,version:1,idempotencyKey:'dddddddd-4444-4444-8444-444444444444');}
  else{await service.createProduct(storeId:site,name:'Synthetic code product',price:125,metadata:metadata,productOptions:[{'name':'Code','position':0,'values':['A-1']}],variants:[{'title':'A-1','stock':0,'options':{'Code':'A-1'}}]);}
  expect(calls,1);
 });
}
