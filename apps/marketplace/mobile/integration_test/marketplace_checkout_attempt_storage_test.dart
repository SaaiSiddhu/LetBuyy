import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:integration_test/integration_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace/data/marketplace_checkout.dart';

const _namespace = 'integration-process-restart';
const _storageKey = 'letbuyy.marketplace.checkout-attempt.v1.$_namespace';
const _buyerOneNamespace = 'integration-buyer-switch-one';
const _buyerTwoNamespace = 'integration-buyer-switch-two';
const _buyerOneStorageKey =
    'letbuyy.marketplace.checkout-attempt.v1.$_buyerOneNamespace';
const _buyerTwoStorageKey =
    'letbuyy.marketplace.checkout-attempt.v1.$_buyerTwoNamespace';
const _stage = String.fromEnvironment(
  'LETBUYY_SECURE_STORAGE_STAGE',
  defaultValue: 'unset',
);

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('secure checkout retry survives Android process restart', (
    _,
  ) async {
    const storage = FlutterSecureStorage();
    if (_stage == 'prepare') {
      await storage.delete(key: _storageKey);
    } else if (_stage == 'prepareBuyerSwitch') {
      await storage.delete(key: _buyerOneStorageKey);
      await storage.delete(key: _buyerTwoStorageKey);
    } else if (_stage == 'recover' || _stage == 'retryPending') {
      addTearDown(() => storage.delete(key: _storageKey));
    } else if (_stage == 'buyerTwoAfterRestart') {
      addTearDown(() async {
        await storage.delete(key: _buyerOneStorageKey);
        await storage.delete(key: _buyerTwoStorageKey);
      });
    } else {
      throw StateError('Unsupported secure-storage integration stage: $_stage');
    }

    final requests = <RequestOptions>[];
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          requests.add(options);
          final path = options.path;
          Object payload;
          if (path.contains('/checkout-status') && _stage == 'retryPending') {
            handler.reject(
              DioException(
                requestOptions: options,
                response: Response<Object?>(
                  requestOptions: options,
                  statusCode: 404,
                  data: const {
                    'success': false,
                    'error': {
                      'code': 'NOT_FOUND',
                      'message': 'Synthetic checkout is not committed yet',
                    },
                  },
                ),
                type: DioExceptionType.badResponse,
              ),
            );
            return;
          } else if (path.contains('/checkout-status')) {
            payload = {
              'checkout_state': 'completed',
              'order': {
                'id': 'integration-order',
                'order_number': 'LB-INTEGRATION',
                'status': 'pending_cod',
                'currency': 'INR',
                'total': 240,
              },
            };
          } else if (path.contains(
            '/marketplace/listings/listing-integration',
          )) {
            payload = const {
              'listing_id': 'listing-integration',
              'product_id': 'product-integration',
              'site_id': 'site-integration',
              'subdomain': 'seller-integration',
              'name': 'Synthetic product',
              'approved_at': '2026-10-07T00:00:00Z',
            };
          } else if (path.endsWith('/marketplace-cart')) {
            final token = (options.data as Map)['cart_token'] as String;
            payload = {
              'id': 'cart-integration',
              'store_id': 'site-integration',
              'cart_token': token,
              'sales_origin': 'marketplace',
              'currency': 'INR',
              'subtotal': 200,
              'discount_total': 0,
              'tax_total': 0,
            };
          } else if (path.endsWith('/checkout-url')) {
            payload = const {
              'checkout_url':
                  'https://checkout.test/checkout/cart?cart_id=cart-integration&site_id=site-integration&cart_token=storage-token&signature=synthetic-signature',
            };
          } else if (path.endsWith('/delivery-options')) {
            payload = const {
              'serviceable': true,
              'rates': [
                {
                  'id': 'rate-integration',
                  'name': 'Synthetic delivery',
                  'amount': 40,
                  'currency': 'INR',
                  'estimated_days_min': 3,
                  'estimated_days_max': 5,
                },
              ],
            };
          } else {
            payload = const {'checkout': {}};
          }

          handler.resolve(
            Response<Object?>(
              requestOptions: options,
              statusCode: 200,
              data: {'success': true, 'data': payload},
            ),
          );
        },
      ),
    );

    final client = ApiClient(
      baseUrl: 'https://gateway.test/v1',
      dio: dio,
      maxRetries: 0,
    );
    if (_stage == 'prepare' || _stage == 'prepareBuyerSwitch') {
      final namespace = _stage == 'prepareBuyerSwitch'
          ? _buyerOneNamespace
          : _namespace;
      final storageKey = _stage == 'prepareBuyerSwitch'
          ? _buyerOneStorageKey
          : _storageKey;
      final service = MarketplaceCheckoutService(
        client: client,
        tokenFactory: () => 'storage-token',
      );
      final review = await service.placeCodOrder(
        items: [_item],
        address: _address,
        email: 'buyer@example.invalid',
        buyerNamespace: namespace,
        storefrontSessionToken: null,
        localCartRevision: 1,
      );

      expect(review, isA<MarketplaceCheckoutReview>());
      final attempt = await storage.read(key: storageKey);
      expect(attempt, isNotNull);
      expect(jsonDecode(attempt!)['cart_token'], 'storage-token');
      return;
    }

    if (_stage == 'buyerTwoAfterRestart') {
      final buyerOneAttempt = await storage.read(key: _buyerOneStorageKey);
      expect(
        buyerOneAttempt,
        isNotNull,
        reason: 'the first buyer attempt must survive process restart',
      );
      expect(await storage.read(key: _buyerTwoStorageKey), isNull);
      final service = MarketplaceCheckoutService(
        client: client,
        tokenFactory: () =>
            throw StateError('empty buyer cart must not create an attempt'),
      );

      await expectLater(
        service.placeCodOrder(
          items: const [],
          address: _address,
          email: 'invalid-after-account-switch',
          buyerNamespace: _buyerTwoNamespace,
          storefrontSessionToken: null,
          localCartRevision: 1,
        ),
        throwsA(
          isA<ApiException>().having(
            (error) => error.code,
            'code',
            'CHECKOUT_CART_EMPTY',
          ),
        ),
      );

      expect(requests, isEmpty);
      expect(await storage.read(key: _buyerOneStorageKey), buyerOneAttempt);
      expect(await storage.read(key: _buyerTwoStorageKey), isNull);
      return;
    }

    final attempt = await storage.read(key: _storageKey);
    expect(
      attempt,
      isNotNull,
      reason: 'prepare stage must persist the attempt',
    );
    expect(jsonDecode(attempt!)['cart_token'], 'storage-token');
    final service = MarketplaceCheckoutService(
      client: client,
      tokenFactory: () =>
          throw StateError('recovery must reuse stored attempt'),
    );
    if (_stage == 'retryPending') {
      final review = await service.placeCodOrder(
        items: [_item],
        address: _address,
        email: 'buyer@example.invalid',
        buyerNamespace: _namespace,
        storefrontSessionToken: null,
        localCartRevision: 1,
      );

      expect(review, isA<MarketplaceCheckoutReview>());
      final statusRequests = requests.where(
        (request) => request.path.contains('/checkout-status'),
      );
      final cartRequests = requests.where(
        (request) => request.path.endsWith('/marketplace-cart'),
      );
      expect(statusRequests, hasLength(1));
      expect(cartRequests, hasLength(1));
      expect(
        requests.where((request) => request.path.endsWith('/confirm')),
        isEmpty,
        reason: 'the resumed journey must stop for a fresh buyer review',
      );
      expect(
        (cartRequests.single.data as Map)['cart_token'],
        'storage-token',
        reason: 'a not-yet-committed retry must reuse the durable cart token',
      );
      expect(await storage.read(key: _storageKey), attempt);
      return;
    }

    final recovered = await service.placeCodOrder(
      items: const [],
      address: _address.copyWith(
        name: 'Changed details',
        phone: '9000000001',
        zipcode: '570001',
      ),
      email: 'invalid-after-restart',
      buyerNamespace: _namespace,
      storefrontSessionToken: null,
      localCartRevision: 2,
    );

    expect(recovered, isA<MarketplaceCheckoutResult>());
    final receipt = recovered as MarketplaceCheckoutResult;
    expect(receipt.orderId, 'integration-order');
    expect(receipt.orderNumber, 'LB-INTEGRATION');
    expect(receipt.cartToken, 'storage-token');
    expect(receipt.matchesCurrentCart, isFalse);
    expect(requests, hasLength(1));
    expect(requests.single.path, contains('/checkout-status'));
    await service.clearCompletedAttempt(
      buyerNamespace: _namespace,
      cartToken: receipt.cartToken,
    );
    expect(await storage.read(key: _storageKey), isNull);
  });
}

CartItemModel get _item => CartItemModel(
  id: 'local-integration',
  productId: 'listing-integration',
  marketplaceListingId: 'listing-integration',
  catalogProductId: 'product-integration',
  productName: 'Synthetic product',
  productImage: '',
  price: 100,
  quantity: 2,
  userId: 'synthetic-buyer',
  addedAt: DateTime.utc(2026, 10, 7),
  sellerId: 'site-integration',
);

AddressModel get _address => AddressModel(
  id: 'address-integration',
  userId: 'synthetic-buyer',
  name: 'Synthetic buyer',
  phone: '9000000000',
  addressLine1: '1 Test Road',
  addressLine2: '',
  city: 'Bengaluru',
  state: 'Karnataka',
  zipcode: '560001',
  country: 'India',
);
