import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace/data/marketplace_checkout.dart';

class _MemoryAttemptStore implements CheckoutAttemptStore {
  final values = <String, String>{};

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> write(String key, String value) async => values[key] = value;

  @override
  Future<void> delete(String key) async => values.remove(key);
}

void main() {
  test(
    'seller COD checkout discloses reprice, keeps retry identity, and recovers by the same cart token',
    () async {
      final dio = Dio();
      final requests = <RequestOptions>[];
      var deliveryQuote = 40;
      var failConfirmationForChangedShipping = false;
      var failConfirmationForChangedListing = false;
      var failConfirmationForUnavailableListing = false;
      var listingUnavailable = false;
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requests.add(options);
            final path = options.path;
            if (path.contains('/checkout-status')) {
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
                        'message': 'Cart not found',
                      },
                    },
                  ),
                  type: DioExceptionType.badResponse,
                ),
              );
              return;
            }

            Object response;
            if (path.contains('/storefront/marketplace/listings/listing-1')) {
              response = listingUnavailable
                  ? const {'success': true, 'data': null}
                  : const {
                      'success': true,
                      'data': {
                        'listing_id': 'listing-1',
                        'product_id': 'product-1',
                        'site_id': 'site-1',
                        'subdomain': 'seller-one',
                        'name': 'Product',
                        'approved_at': '2026-10-04T00:00:00Z',
                      },
                    };
            } else if (path.endsWith('/marketplace-cart')) {
              final token = (options.data as Map)['cart_token'] as String;
              response = {
                'success': true,
                'data': {
                  'id': 'cart-1',
                  'store_id': 'site-1',
                  'cart_token': token,
                  'sales_origin': 'marketplace',
                  'currency': 'INR',
                  'subtotal': 200,
                  'discount_total': 0,
                  'tax_total': 0,
                },
              };
            } else if (path.contains(
              '/storefront/marketplace/listings/listing-2',
            )) {
              response = const {
                'success': true,
                'data': {
                  'listing_id': 'listing-2',
                  'product_id': 'product-2',
                  'site_id': 'site-2',
                  'subdomain': 'seller-two',
                  'name': 'Another product',
                  'approved_at': '2026-10-04T00:00:00Z',
                },
              };
            } else if (path.endsWith('/checkout-url')) {
              response = const {
                'success': true,
                'data': {
                  'checkout_url':
                      'https://checkout.test/checkout/cart?cart_id=cart-1&site_id=site-1&cart_token=token-fixed&signature=signed-value',
                },
              };
            } else if (path.endsWith('/delivery-options')) {
              response = const {
                'success': true,
                'data': {
                  'serviceable': true,
                  'rates': [
                    {
                      'id': 'rate-1',
                      'name': 'Standard delivery',
                      'amount': 40,
                      'currency': 'INR',
                      'estimated_days_min': 3,
                      'estimated_days_max': 5,
                    },
                  ],
                },
              };
            } else if (path.endsWith('/delivery')) {
              response = {
                'success': true,
                'data': {
                  'checkout': {
                    'delivery_quote': {
                      'amount': deliveryQuote,
                      'currency': 'INR',
                      'shipping_rate_id': 'rate-1',
                      'server_resolved': true,
                    },
                  },
                },
              };
            } else if (path.endsWith('/payment-intent')) {
              response = const {
                'success': true,
                'data': {
                  'payment_intent': {'payment_intent_id': 'intent-1'},
                },
              };
            } else if (path.endsWith('/confirm')) {
              if (failConfirmationForChangedShipping) {
                handler.reject(
                  DioException(
                    requestOptions: options,
                    response: Response<Object?>(
                      requestOptions: options,
                      statusCode: 409,
                      data: const {
                        'success': false,
                        'error': {
                          'code': 'CHECKOUT_SHIPPING_CHANGED',
                          'message':
                              'The delivery option changed before order creation.',
                        },
                      },
                    ),
                    type: DioExceptionType.badResponse,
                  ),
                );
                return;
              } else if (failConfirmationForChangedListing) {
                handler.reject(
                  DioException(
                    requestOptions: options,
                    response: Response<Object?>(
                      requestOptions: options,
                      statusCode: 409,
                      data: const {
                        'success': false,
                        'error': {
                          'code': 'MARKETPLACE_LISTING_CHANGED',
                          'message':
                              'A marketplace listing changed after review.',
                        },
                      },
                    ),
                    type: DioExceptionType.badResponse,
                  ),
                );
                return;
              } else if (failConfirmationForUnavailableListing) {
                handler.reject(
                  DioException(
                    requestOptions: options,
                    response: Response<Object?>(
                      requestOptions: options,
                      statusCode: 409,
                      data: const {
                        'success': false,
                        'error': {
                          'code': 'MARKETPLACE_LISTING_UNAVAILABLE',
                          'message':
                              'A marketplace listing became unavailable before order creation.',
                        },
                      },
                    ),
                    type: DioExceptionType.badResponse,
                  ),
                );
                return;
              }
              response = const {
                'success': true,
                'data': {
                  'order': {
                    'id': 'order-1',
                    'order_number': 'LB-1001',
                    'status': 'pending',
                    'currency': 'INR',
                    'total': 280,
                  },
                },
              };
            } else {
              response = const {
                'success': true,
                'data': {'checkout': {}},
              };
            }
            handler.resolve(
              Response<Object?>(
                requestOptions: options,
                statusCode: 200,
                data: response,
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
      final store = _MemoryAttemptStore();
      var tokensGenerated = 0;
      final checkout = MarketplaceCheckoutService(
        client: client,
        attemptStore: store,
        tokenFactory: () {
          tokensGenerated++;
          return 'token-fixed';
        },
      );
      final item = CartItemModel(
        id: 'local-1',
        productId: 'listing-1',
        marketplaceListingId: 'listing-1',
        catalogProductId: 'product-1',
        productName: 'Product',
        productImage: '',
        price: 999,
        quantity: 2,
        userId: 'buyer-1',
        addedAt: DateTime.utc(2026, 10, 4),
        sellerId: 'site-1',
      );
      final address = AddressModel(
        id: 'address-1',
        userId: 'buyer-1',
        name: 'Buyer',
        phone: '9999999999',
        addressLine1: '1 Main Road',
        addressLine2: '',
        city: 'Bengaluru',
        state: 'Karnataka',
        zipcode: '560001',
        country: 'India',
      );

      final review = await checkout.placeCodOrder(
        items: [item],
        address: address,
        email: 'buyer@example.invalid',
        buyerNamespace: 'buyer-1',
        storefrontSessionToken: 'buyer-session',
        localCartRevision: 123,
      );
      expect(review, isA<MarketplaceCheckoutReview>());
      final optionsReview = review as MarketplaceCheckoutReview;
      expect(optionsReview.authoritativeTotal, isNull);
      expect(optionsReview.shippingOptions.single.id, 'rate-1');
      expect(
        requests.where((request) => request.path.endsWith('/delivery')),
        isEmpty,
      );

      final firstTotal = await checkout.placeCodOrder(
        items: [item],
        address: address,
        email: 'buyer@example.invalid',
        buyerNamespace: 'buyer-1',
        storefrontSessionToken: 'buyer-session',
        localCartRevision: 123,
        selectedShippingRateId: 'rate-1',
      );
      expect(firstTotal, isA<MarketplaceCheckoutReview>());
      expect((firstTotal as MarketplaceCheckoutReview).authoritativeTotal, 240);
      expect(
        requests.where((request) => request.path.endsWith('/payment-intent')),
        isEmpty,
      );
      expect(
        requests.where((request) => request.path.endsWith('/confirm')),
        isEmpty,
      );

      deliveryQuote = 80;
      final changedReview = await checkout.placeCodOrder(
        items: [item],
        address: address,
        email: 'buyer@example.invalid',
        buyerNamespace: 'buyer-1',
        storefrontSessionToken: 'buyer-session',
        localCartRevision: 123,
        selectedShippingRateId: 'rate-1',
        acceptedTotal: 240,
      );
      expect(changedReview, isA<MarketplaceCheckoutReview>());
      expect(
        (changedReview as MarketplaceCheckoutReview).authoritativeTotal,
        280,
      );
      expect(
        requests.where((request) => request.path.endsWith('/payment-intent')),
        isEmpty,
      );

      deliveryQuote = 80;
      final result = await checkout.placeCodOrder(
        items: [item],
        address: address,
        email: 'buyer@example.invalid',
        buyerNamespace: 'buyer-1',
        storefrontSessionToken: 'buyer-session',
        localCartRevision: 123,
        selectedShippingRateId: 'rate-1',
        acceptedTotal: 280,
      );
      expect(result, isA<MarketplaceCheckoutResult>());
      final order = result as MarketplaceCheckoutResult;
      expect(order.orderId, 'order-1');
      expect(order.orderNumber, 'LB-1001');
      expect(order.total, 280);
      expect(tokensGenerated, 1);
      expect(store.values, hasLength(1));

      final cartRequests = requests.where(
        (request) => request.path.endsWith('/marketplace-cart'),
      );
      expect(cartRequests, hasLength(4));
      expect(
        cartRequests
            .map((request) => (request.data as Map)['cart_token'])
            .toSet(),
        {'token-fixed'},
      );
      expect(
        cartRequests.every(
          (request) =>
              request.headers['X-LetBuyy-Storefront-Session'] ==
              'buyer-session',
        ),
        isTrue,
      );
      final confirm = requests.singleWhere(
        (request) => request.path.endsWith('/confirm'),
      );
      expect(confirm.data['idempotency_key'], 'marketplace-confirm-cart-1');

      await checkout.clearCompletedAttempt(
        buyerNamespace: 'buyer-1',
        cartToken: 'token-fixed',
      );
      expect(store.values, isEmpty);

      listingUnavailable = true;
      await expectLater(
        checkout.placeCodOrder(
          items: [item],
          address: address,
          email: 'buyer@example.invalid',
          buyerNamespace: 'buyer-1',
          storefrontSessionToken: 'buyer-session',
          localCartRevision: 123,
        ),
        throwsA(
          isA<ApiException>()
              .having(
                (error) => error.code,
                'code',
                'MARKETPLACE_LISTING_UNAVAILABLE',
              )
              .having((error) => error.body, 'body', {
                'listing_ids': ['listing-1'],
              }),
        ),
      );
      expect(
        requests.where((request) => request.path.endsWith('/marketplace-cart')),
        hasLength(4),
      );

      listingUnavailable = false;
      failConfirmationForChangedShipping = true;
      await expectLater(
        checkout.placeCodOrder(
          items: [item],
          address: address,
          email: 'buyer@example.invalid',
          buyerNamespace: 'buyer-1',
          storefrontSessionToken: 'buyer-session',
          localCartRevision: 123,
          selectedShippingRateId: 'rate-1',
          acceptedTotal: 280,
        ),
        throwsA(
          isA<ApiException>().having(
            (error) => error.code,
            'code',
            'CHECKOUT_SHIPPING_CHANGED',
          ),
        ),
      );
      expect(store.values, isEmpty);

      failConfirmationForChangedShipping = false;
      failConfirmationForChangedListing = true;
      await expectLater(
        checkout.placeCodOrder(
          items: [item],
          address: address,
          email: 'buyer@example.invalid',
          buyerNamespace: 'buyer-1',
          storefrontSessionToken: 'buyer-session',
          localCartRevision: 123,
          selectedShippingRateId: 'rate-1',
          acceptedTotal: 280,
        ),
        throwsA(
          isA<ApiException>().having(
            (error) => error.code,
            'code',
            'MARKETPLACE_LISTING_CHANGED',
          ),
        ),
      );
      expect(store.values, isEmpty);

      failConfirmationForChangedListing = false;
      failConfirmationForUnavailableListing = true;
      await expectLater(
        checkout.placeCodOrder(
          items: [item],
          address: address,
          email: 'buyer@example.invalid',
          buyerNamespace: 'buyer-1',
          storefrontSessionToken: 'buyer-session',
          localCartRevision: 123,
          selectedShippingRateId: 'rate-1',
          acceptedTotal: 280,
        ),
        throwsA(
          isA<ApiException>().having(
            (error) => error.code,
            'code',
            'MARKETPLACE_LISTING_UNAVAILABLE',
          ),
        ),
      );
      expect(store.values, isEmpty);

      final otherSellerItem = CartItemModel(
        id: 'local-2',
        productId: 'listing-2',
        marketplaceListingId: 'listing-2',
        catalogProductId: 'product-2',
        productName: 'Another product',
        productImage: '',
        price: 500,
        quantity: 1,
        userId: 'buyer-1',
        addedAt: DateTime.utc(2026, 10, 4),
        sellerId: 'site-2',
      );
      final cartsBeforeMixedSeller = requests
          .where((request) => request.path.endsWith('/marketplace-cart'))
          .length;
      await expectLater(
        checkout.placeCodOrder(
          items: [item, otherSellerItem],
          address: address,
          email: 'buyer@example.invalid',
          buyerNamespace: 'buyer-1',
          storefrontSessionToken: 'buyer-session',
          localCartRevision: 124,
        ),
        throwsA(
          isA<ApiException>().having(
            (error) => error.code,
            'code',
            'MARKETPLACE_SINGLE_SELLER_REQUIRED',
          ),
        ),
      );
      expect(
        requests.where((request) => request.path.endsWith('/marketplace-cart')),
        hasLength(cartsBeforeMixedSeller),
        reason:
            'mixed-seller carts must be rejected before any server cart is created',
      );
    },
  );

  test(
    'recovers a committed buyer order before validating a changed or empty current cart',
    () async {
      final requests = <RequestOptions>[];
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requests.add(options);
            expect(options.path, contains('/checkout-status'));
            handler.resolve(
              Response<Object?>(
                requestOptions: options,
                statusCode: 200,
                data: const {
                  'success': true,
                  'data': {
                    'checkout_state': 'completed',
                    'order': {
                      'id': 'committed-order',
                      'order_number': 'LB-RECOVERED',
                      'status': 'pending_cod',
                      'currency': 'INR',
                      'total': 318,
                    },
                  },
                },
              ),
            );
          },
        ),
      );
      final store = _MemoryAttemptStore()
        ..values['letbuyy.marketplace.checkout-attempt.v1.buyer-1'] =
            jsonEncode({
              'cart_token': 'secure-recovery-token',
              'subdomain': 'seller-one',
              'cart_fingerprint': 'stored-cart-fingerprint',
              'input_fingerprint': 'stored-input-fingerprint',
              'local_cart_revision': 123,
            });
      final checkout = MarketplaceCheckoutService(
        client: ApiClient(
          baseUrl: 'https://gateway.test/v1',
          dio: dio,
          maxRetries: 0,
        ),
        attemptStore: store,
        tokenFactory: () =>
            throw StateError('recovery must not start a new cart'),
      );

      final result = await checkout.placeCodOrder(
        items: const [],
        address: AddressModel(
          id: 'changed-address',
          userId: 'buyer-1',
          name: 'Changed buyer details',
          phone: '9000000000',
          addressLine1: 'New address',
          addressLine2: '',
          city: 'Mysuru',
          state: 'Karnataka',
          zipcode: '570001',
          country: 'India',
        ),
        email: 'no-longer-valid',
        buyerNamespace: 'buyer-1',
        storefrontSessionToken: null,
        localCartRevision: 124,
      );

      expect(result, isA<MarketplaceCheckoutResult>());
      final recovered = result as MarketplaceCheckoutResult;
      expect(recovered.orderId, 'committed-order');
      expect(recovered.orderNumber, 'LB-RECOVERED');
      expect(recovered.cartToken, 'secure-recovery-token');
      expect(recovered.matchesCurrentCart, isFalse);
      expect(requests, hasLength(1));
      expect(store.values, hasLength(1));

      await checkout.clearCompletedAttempt(
        buyerNamespace: 'buyer-1',
        cartToken: recovered.cartToken,
      );
      expect(store.values, isEmpty);
    },
  );
}
