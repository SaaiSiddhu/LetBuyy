// Focused supported Android service/SDK contract; no device, network or provider proof.
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/product_service.dart';

const site='aaaaaaaa-1111-4111-8111-111111111111';
const product='bbbbbbbb-2222-4222-8222-222222222222';
class Harness {
  Harness(this.statuses,{int retries=0,this.changeContext=false}) {
    dio=Dio();
    api=ApiClient(baseUrl:'https://synthetic-gateway.example.invalid',token:'synthetic-not-issued',
      storeId:site,dio:dio,maxRetries:retries,contextVersionProvider:()=>version);
    service=ProductService(api:api);
    service.addListener(()=>notifications++);
    dio.interceptors.add(InterceptorsWrapper(onRequest:(options,handler) {
      expect(options.method,'POST');
      expect(options.uri.path,'/v1/products');
      bodies.add(Map<String,dynamic>.from(options.data as Map));
      keys.add(options.headers['X-Idempotency-Key'] as String?);
      final status=statuses[bodies.length-1];
      if(changeContext) version++;
      handler.resolve(Response<Object?>(requestOptions:options,statusCode:status,data:
        status==201 ? {'data':{'id':product,'store_id':site,'name':'Synthetic Product','price':199,'stock':0}}
        : {'error':{'code':status==503?'ENTITLEMENT_AUTHORITY_UNAVAILABLE':'STAFF_PERMISSION_REQUIRED',
          'message':status==503?'Plan permissions are temporarily unavailable. Try again shortly.':'Current product-write authority is required.'}}));
    }));
  }
  final List<int> statuses;
  final bool changeContext;
  late final Dio dio;
  late final ApiClient api;
  late final ProductService service;
  int version=0,notifications=0;
  final List<Map<String,dynamic>> bodies=[];
  final List<String?> keys=[];
  Future<Map<String,dynamic>> create()=>service.createProduct(storeId:site,name:'Synthetic Product',price:199,stock:0);
  void close(){service.dispose();api.close();}
}
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('unavailable authority surfaces503 without false local product success',()async {
    final h=Harness([503]);addTearDown(h.close);
    await expectLater(h.create(),throwsA(isA<ApiException>()
      .having((e)=>e.statusCode,'status',503).having((e)=>e.code,'code','ENTITLEMENT_AUTHORITY_UNAVAILABLE')));
    expect(h.bodies,hasLength(1));expect(h.bodies.single['store_id'],site);
    expect(h.keys.single,isNotEmpty);expect(h.service.products,isEmpty);expect(h.service.productContracts,isEmpty);
    expect(h.notifications,0);
  });
  test('current principal denial403 is not retried or recorded as a created product',()async {
    final h=Harness([403],retries:2);addTearDown(h.close);
    await expectLater(h.create(),throwsA(isA<ApiException>().having((e)=>e.statusCode,'status',403)));
    expect(h.bodies,hasLength(1));expect(h.service.products,isEmpty);expect(h.notifications,0);
  });
  test('SDK transient retry preserves one body and key and reports success once',()async {
    final h=Harness([503,201],retries:1);addTearDown(h.close);
    final result=await h.create();
    expect(result['id'],product);expect(h.bodies,hasLength(2));expect(h.bodies[1],h.bodies[0]);
    expect(h.keys[0],isNotEmpty);expect(h.keys[1],h.keys[0]);
    expect(h.service.products,hasLength(1));expect(h.service.productContracts,hasLength(1));expect(h.notifications,1);
  });
  test('explicit retry after a refused no-effect attempt adds only the successful product',()async {
    final h=Harness([503,201]);addTearDown(h.close);
    await expectLater(h.create(),throwsA(isA<ApiException>().having((e)=>e.statusCode,'status',503)));
    expect(h.service.products,isEmpty);expect(h.notifications,0);
    await h.create();expect(h.bodies,hasLength(2));expect(h.service.products,hasLength(1));expect(h.notifications,1);
  });
  test('account context change prevents automatic retry and false local success',()async {
    final h=Harness([503],retries:1,changeContext:true);addTearDown(h.close);
    await expectLater(h.create(),throwsA(isA<ApiException>()
      .having((e)=>e.statusCode,'status',409).having((e)=>e.code,'code','SESSION_CONTEXT_CHANGED')));
    expect(h.bodies,hasLength(1));expect(h.service.products,isEmpty);expect(h.notifications,0);
  });
}

