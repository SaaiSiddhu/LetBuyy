import 'dart:io';

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
  final hasOwnedFixture = [
    'LETBUYY_MARKETPLACE_OWNED_GATEWAY_URL',
    'LETBUYY_MARKETPLACE_OWNED_LISTING_ID',
    'LETBUYY_MARKETPLACE_OWNED_PRODUCT_ID',
    'LETBUYY_MARKETPLACE_OWNED_SITE_ID',
    'LETBUYY_MARKETPLACE_OWNED_STALE_CART_TOKEN',
    'LETBUYY_MARKETPLACE_OWNED_LOST_RESPONSE_CART_TOKEN',
  ].every((key) => Platform.environment[key]?.isNotEmpty == true);

  test(
    'real client completes COD and then refuses a listing edited after final review',
    () async {
      final baseUrl =
          Platform.environment['LETBUYY_MARKETPLACE_OWNED_GATEWAY_URL'];
      final listingId =
          Platform.environment['LETBUYY_MARKETPLACE_OWNED_LISTING_ID'];
      final productId =
          Platform.environment['LETBUYY_MARKETPLACE_OWNED_PRODUCT_ID'];
      final siteId = Platform.environment['LETBUYY_MARKETPLACE_OWNED_SITE_ID'];
      final staleCartToken =
          Platform.environment['LETBUYY_MARKETPLACE_OWNED_STALE_CART_TOKEN'];
      final lostResponseCartToken = Platform
          .environment['LETBUYY_MARKETPLACE_OWNED_LOST_RESPONSE_CART_TOKEN'];
      expect(hasOwnedFixture, isTrue);

      final client = ApiClient(baseUrl: baseUrl!, maxRetries: 0);
      final items = [
        CartItemModel(
          id: 'mobile-integration-line',
          productId: productId!,
          marketplaceListingId: listingId,
          catalogProductId: productId,
          productName: 'Client supplied name and price are display-only',
          productImage: '',
          price: 0.01,
          quantity: 2,
          userId: 'guest',
          addedAt: DateTime.utc(2026),
          sellerId: siteId,
          sellerName: 'Fixture seller',
        ),
      ];
      final address = AddressModel(
        id: 'mobile-owned-address',
        userId: 'guest',
        name: 'Synthetic mobile buyer',
        phone: '9000000011',
        addressLine1: 'Owned Gateway fixture road',
        addressLine2: '',
        city: 'Bengaluru',
        state: 'Karnataka',
        zipcode: '560001',
        country: 'India',
      );
      final successAttempts = _MemoryAttemptStore();
      final successfulCheckout = MarketplaceCheckoutService(
        client: client,
        attemptStore: successAttempts,
        tokenFactory: () => 'ct_market_mobile_success_owned_e2e',
      );
      final selection = await successfulCheckout.placeCodOrder(
        items: items,
        address: address,
        email: 'mobile-owned@example.invalid',
        buyerNamespace: 'owned-mobile-success',
        storefrontSessionToken: null,
        localCartRevision: 41,
      );
      expect(selection, isA<MarketplaceCheckoutReview>());
      final selectedReview = selection as MarketplaceCheckoutReview;
      expect(selectedReview.shippingOptions, isNotEmpty);
      expect(
        selectedReview.subtotal,
        258,
        reason:
            'the Gateway must supply price 129 × quantity 2, ignoring the 0.01 local display price',
      );

      final reviewed = await successfulCheckout.placeCodOrder(
        items: items,
        address: address,
        email: 'mobile-owned@example.invalid',
        buyerNamespace: 'owned-mobile-success',
        storefrontSessionToken: null,
        localCartRevision: 41,
        selectedShippingRateId: selectedReview.shippingOptions.single.id,
      );
      expect(reviewed, isA<MarketplaceCheckoutReview>());
      final accepted = reviewed as MarketplaceCheckoutReview;
      expect(accepted.authoritativeTotal, 318);
      expect(
        accepted.selectedShippingRateId,
        selectedReview.shippingOptions.single.id,
      );
      expect(
        successAttempts.values,
        isNotEmpty,
        reason: 'the secure retry capability exists before final confirmation',
      );

      final successfulResult = await successfulCheckout.placeCodOrder(
        items: items,
        address: address,
        email: 'mobile-owned@example.invalid',
        buyerNamespace: 'owned-mobile-success',
        storefrontSessionToken: null,
        localCartRevision: 41,
        selectedShippingRateId: accepted.selectedShippingRateId,
        acceptedTotal: accepted.authoritativeTotal,
      );
      expect(successfulResult, isA<MarketplaceCheckoutResult>());
      final completed = successfulResult as MarketplaceCheckoutResult;
      expect(completed.orderId, isNotEmpty);
      expect(completed.total, 318);
      expect(completed.matchesCurrentCart, isTrue);
      await successfulCheckout.clearCompletedAttempt(
        buyerNamespace: 'owned-mobile-success',
        cartToken: completed.cartToken,
      );
      expect(successAttempts.values, isEmpty);

      final lostResponseAttempts = _MemoryAttemptStore();
      final lostResponseCheckout = MarketplaceCheckoutService(
        client: client,
        attemptStore: lostResponseAttempts,
        tokenFactory: () => lostResponseCartToken!,
      );
      const lostResponseBuyerNamespace = 'owned-mobile-lost-response';
      final lostResponseSelection = await lostResponseCheckout.placeCodOrder(
        items: items,
        address: address,
        email: 'mobile-owned@example.invalid',
        buyerNamespace: lostResponseBuyerNamespace,
        storefrontSessionToken: null,
        localCartRevision: 43,
      );
      expect(lostResponseSelection, isA<MarketplaceCheckoutReview>());
      final lostResponseReview =
          lostResponseSelection as MarketplaceCheckoutReview;
      final lostResponseAccepted = await lostResponseCheckout.placeCodOrder(
        items: items,
        address: address,
        email: 'mobile-owned@example.invalid',
        buyerNamespace: lostResponseBuyerNamespace,
        storefrontSessionToken: null,
        localCartRevision: 43,
        selectedShippingRateId: lostResponseReview.shippingOptions.single.id,
      );
      expect(lostResponseAccepted, isA<MarketplaceCheckoutReview>());
      final lostResponseTotal =
          lostResponseAccepted as MarketplaceCheckoutReview;
      expect(
        lostResponseAttempts.values,
        isNotEmpty,
        reason: 'the secure attempt must survive until checkout recovery',
      );

      var confirmationResponseWasLost = false;
      try {
        await lostResponseCheckout.placeCodOrder(
          items: items,
          address: address,
          email: 'mobile-owned@example.invalid',
          buyerNamespace: lostResponseBuyerNamespace,
          storefrontSessionToken: null,
          localCartRevision: 43,
          selectedShippingRateId: lostResponseTotal.selectedShippingRateId,
          acceptedTotal: lostResponseTotal.authoritativeTotal,
        );
      } catch (_) {
        confirmationResponseWasLost = true;
      }
      expect(
        confirmationResponseWasLost,
        isTrue,
        reason: 'the bridge drops the response only after the order commits',
      );
      expect(lostResponseAttempts.values, isNotEmpty);

      final recoveredResult = await lostResponseCheckout.placeCodOrder(
        items: const [],
        address: address,
        email: 'contact-changed-after-commit',
        buyerNamespace: lostResponseBuyerNamespace,
        storefrontSessionToken: null,
        localCartRevision: 44,
        selectedShippingRateId: lostResponseTotal.selectedShippingRateId,
        acceptedTotal: lostResponseTotal.authoritativeTotal,
      );
      expect(recoveredResult, isA<MarketplaceCheckoutResult>());
      final recovered = recoveredResult as MarketplaceCheckoutResult;
      expect(recovered.cartToken, lostResponseCartToken);
      expect(recovered.orderId, isNotEmpty);
      expect(recovered.total, 318);
      expect(
        recovered.matchesCurrentCart,
        isFalse,
        reason:
            'recovery must not depend on the changed current cart or contact input',
      );
      await lostResponseCheckout.clearCompletedAttempt(
        buyerNamespace: lostResponseBuyerNamespace,
        cartToken: recovered.cartToken,
      );
      expect(lostResponseAttempts.values, isEmpty);

      final attempts = _MemoryAttemptStore();
      final checkout = MarketplaceCheckoutService(
        client: client,
        attemptStore: attempts,
        tokenFactory: () => staleCartToken!,
      );
      const staleBuyerNamespace = 'owned-mobile-stale';
      final staleSelection = await checkout.placeCodOrder(
        items: items,
        address: address,
        email: 'mobile-owned@example.invalid',
        buyerNamespace: staleBuyerNamespace,
        storefrontSessionToken: null,
        localCartRevision: 42,
      );
      expect(staleSelection, isA<MarketplaceCheckoutReview>());
      final staleReview = staleSelection as MarketplaceCheckoutReview;
      final staleAccepted = await checkout.placeCodOrder(
        items: items,
        address: address,
        email: 'mobile-owned@example.invalid',
        buyerNamespace: staleBuyerNamespace,
        storefrontSessionToken: null,
        localCartRevision: 42,
        selectedShippingRateId: staleReview.shippingOptions.single.id,
      );
      expect(staleAccepted, isA<MarketplaceCheckoutReview>());
      final staleTotal = staleAccepted as MarketplaceCheckoutReview;

      try {
        await checkout.placeCodOrder(
          items: items,
          address: address,
          email: 'mobile-owned@example.invalid',
          buyerNamespace: staleBuyerNamespace,
          storefrontSessionToken: null,
          localCartRevision: 42,
          selectedShippingRateId: staleTotal.selectedShippingRateId,
          acceptedTotal: staleTotal.authoritativeTotal,
        );
        fail('edited marketplace listing must prevent COD order confirmation');
      } on ApiException catch (error) {
        expect(error.statusCode, 409);
        expect(error.code, 'MARKETPLACE_LISTING_UNAVAILABLE');
      }
      expect(
        attempts.values,
        isEmpty,
        reason:
            'an unavailable listing must retire the incomplete secure checkout attempt',
      );
    },
    skip: hasOwnedFixture
        ? false
        : 'requires disposable fixtures from the owned Gateway integration suite',
  );
}
