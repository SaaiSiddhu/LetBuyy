import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';

const _storefrontSessionHeader = 'X-LetBuyy-Storefront-Session';
const _checkoutAttemptStorageKey = 'letbuyy.marketplace.checkout-attempt.v1';

/// Minimal result needed by the shopper flow; it never invents order pricing or status.
class MarketplaceCheckoutResult {
  const MarketplaceCheckoutResult({
    required this.orderId,
    required this.orderNumber,
    required this.status,
    required this.total,
    required this.matchesCurrentCart,
    required this.cartToken,
  });

  final String orderId;
  final String orderNumber;
  final String status;
  final double total;
  final bool matchesCurrentCart;
  final String cartToken;
}

class MarketplaceCheckoutReview {
  const MarketplaceCheckoutReview({
    required this.subtotal,
    required this.discount,
    required this.shipping,
    required this.tax,
    required this.authoritativeTotal,
    this.shippingOptions = const [],
    this.selectedShippingRateId,
  });

  final double subtotal;
  final double discount;
  final double? shipping;
  final double tax;
  final double? authoritativeTotal;
  final List<MarketplaceShippingOption> shippingOptions;
  final String? selectedShippingRateId;
}

class MarketplaceShippingOption {
  const MarketplaceShippingOption({
    required this.id,
    required this.name,
    required this.amount,
    this.estimatedDaysMin,
    this.estimatedDaysMax,
  });

  final String id;
  final String name;
  final double amount;
  final int? estimatedDaysMin;
  final int? estimatedDaysMax;
}

abstract interface class CheckoutAttemptStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

class _FlutterSecureCheckoutAttemptStore implements CheckoutAttemptStore {
  _FlutterSecureCheckoutAttemptStore(this._storage);

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}

/// Native marketplace checkout over the signed, canonical hosted-checkout state machine.
///
/// The app stores only a random cart capability in secure storage. Prices, seller identity,
/// listing eligibility, inventory and order creation remain server-authoritative. A stable
/// capability and stable step idempotency keys let a retry recover the same order after a lost
/// response instead of placing a second order.
class MarketplaceCheckoutService {
  MarketplaceCheckoutService({
    required ApiClient client,
    FlutterSecureStorage? secureStorage,
    CheckoutAttemptStore? attemptStore,
    String Function()? tokenFactory,
  }) : _client = client,
       _attemptStore =
           attemptStore ??
           _FlutterSecureCheckoutAttemptStore(
             secureStorage ?? const FlutterSecureStorage(),
           ),
       _tokenFactory = tokenFactory ?? _newCartToken;

  final ApiClient _client;
  final CheckoutAttemptStore _attemptStore;
  final String Function() _tokenFactory;

  Future<Object> placeCodOrder({
    required List<CartItemModel> items,
    required AddressModel address,
    required String email,
    required String buyerNamespace,
    required String? storefrontSessionToken,
    required int localCartRevision,
    String? selectedShippingRateId,
    double? acceptedTotal,
  }) async {
    final storageKey = '$_checkoutAttemptStorageKey.$buyerNamespace';
    final prior = await _readAttempt(storageKey);

    // Resolve a committed order before validating the current cart or contact fields. After an
    // ambiguous confirmation response, the buyer may have changed or emptied the cart (or edited
    // their contact details) before retrying. The attempt is buyer-namespaced and the receipt is
    // recovered through the seller-scoped capability route, so this does not trust that new input.
    if (prior != null) {
      final recovered = await _recoverCompleted(
        subdomain: prior.subdomain,
        cartToken: prior.cartToken,
        localCartRevision: localCartRevision,
        priorRevision: prior.localCartRevision,
      );
      if (recovered != null) return recovered;
    }

    // An empty cart is valid only as input to the recovery check above. Otherwise, return the
    // familiar empty-cart error before asking for a fresh contact email.
    if (items.isEmpty) {
      throw const ApiException(
        message: 'Your cart is empty.',
        statusCode: 400,
        code: 'CHECKOUT_CART_EMPTY',
      );
    }
    final normalizedEmail = email.trim().toLowerCase();
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(normalizedEmail)) {
      throw const ApiException(
        message: 'Enter a valid email address to place this order.',
        statusCode: 400,
        code: 'CHECKOUT_EMAIL_REQUIRED',
      );
    }

    final resolved = await _resolveSellerBoundLines(items);
    final cartFingerprint = _fingerprint(resolved.lines);
    final inputFingerprint = _fingerprint({
      'cart': cartFingerprint,
      'email': normalizedEmail,
      'name': address.name.trim(),
      'phone': address.phone.trim(),
      'address': {
        'line1': address.addressLine1.trim(),
        'line2': address.addressLine2.trim(),
        'city': address.city.trim(),
        'state': address.state.trim(),
        'zip': address.zipcode.trim(),
        'country': _countryCode(address.country),
      },
    });
    final attempt =
        prior != null &&
            prior.cartFingerprint == cartFingerprint &&
            prior.inputFingerprint == inputFingerprint &&
            prior.localCartRevision == localCartRevision &&
            prior.subdomain == resolved.subdomain
        ? prior
        : _CheckoutAttempt(
            cartToken: _tokenFactory(),
            subdomain: resolved.subdomain,
            cartFingerprint: cartFingerprint,
            inputFingerprint: inputFingerprint,
            localCartRevision: localCartRevision,
          );
    if (prior == null ||
        prior.cartToken != attempt.cartToken ||
        prior.cartFingerprint != attempt.cartFingerprint ||
        prior.inputFingerprint != attempt.inputFingerprint ||
        prior.localCartRevision != attempt.localCartRevision ||
        prior.subdomain != attempt.subdomain) {
      await _writeAttempt(storageKey, attempt);
    }

    final headers = storefrontSessionToken == null
        ? null
        : {_storefrontSessionHeader: storefrontSessionToken};
    final requestOptions = headers == null
        ? null
        : ApiRequestOptions(headers: headers);
    final cart = await _client.storefront
        .createMarketplaceCart(attempt.subdomain, {
          'cart_token': attempt.cartToken,
          'channel': 'api',
          'buyer_email': normalizedEmail,
          'lines': resolved.lines,
          'coupon_codes': <String>[],
        }, options: requestOptions);
    if (cart['sales_origin'] != 'marketplace' ||
        cart['cart_token'] != attempt.cartToken ||
        cart['store_id'] != resolved.siteId ||
        cart['currency'] != 'INR') {
      throw const ApiException(
        message: 'The marketplace could not verify this seller cart.',
        statusCode: 409,
        code: 'MARKETPLACE_CART_BINDING_INVALID',
      );
    }
    final cartId = _requiredString(
      cart['id'],
      'MARKETPLACE_CART_RESPONSE_INVALID',
    );
    final handoffResponse = await _client.storefront.createCheckoutHandoff(
      attempt.subdomain,
      attempt.cartToken,
      options: requestOptions,
    );
    final checkoutUrl = _requiredString(
      handoffResponse['checkout_url'],
      'CHECKOUT_HANDOFF_INVALID',
    );
    final uri = Uri.tryParse(checkoutUrl);
    final handoff = uri?.queryParameters;
    if (handoff == null ||
        handoff['cart_id'] != cartId ||
        handoff['site_id'] != resolved.siteId ||
        handoff['cart_token'] != attempt.cartToken ||
        handoff['signature'] == null) {
      throw const ApiException(
        message: 'Secure checkout could not be verified. Please try again.',
        statusCode: 401,
        code: 'CHECKOUT_HANDOFF_INVALID',
      );
    }

    await _client.storefront.checkoutStep(cartId, 'contact', handoff, {
      'idempotency_key': 'marketplace-contact-$cartId',
      'email': normalizedEmail,
      'name': address.name.trim(),
      'phone': address.phone.trim(),
    });
    final normalizedCountry = _countryCode(address.country);
    final optionsResponse = await _client.storefront
        .checkoutDeliveryOptions(cartId, handoff, {
          'country': normalizedCountry,
          'state': address.state.trim(),
          'pincode': address.zipcode.trim(),
        });
    final rawOptions = optionsResponse['rates'];
    final shippingOptions = rawOptions is List
        ? rawOptions.whereType<Map>().map(_shippingOptionFromJson).toList()
        : <MarketplaceShippingOption>[];
    if (shippingOptions.isEmpty) {
      throw const ApiException(
        message:
            'This seller has no delivery option for the selected address. Choose another address or contact the seller.',
        statusCode: 409,
        code: 'CHECKOUT_SHIPPING_UNAVAILABLE',
      );
    }
    MarketplaceShippingOption? selectedRate;
    for (final option in shippingOptions) {
      if (option.id == selectedShippingRateId) selectedRate = option;
    }

    final subtotal = _requiredMoney(
      cart['subtotal'],
      'CHECKOUT_SUBTOTAL_UNAVAILABLE',
    );
    final discount = _requiredMoney(
      cart['discount_total'],
      'CHECKOUT_DISCOUNT_UNAVAILABLE',
    );
    final tax = _requiredMoney(cart['tax_total'], 'CHECKOUT_TAX_UNAVAILABLE');

    if (selectedRate == null) {
      return MarketplaceCheckoutReview(
        subtotal: subtotal,
        discount: discount,
        shipping: null,
        tax: tax,
        authoritativeTotal: null,
        shippingOptions: shippingOptions,
      );
    }

    final delivery = await _client.storefront.checkoutStep(
      cartId,
      'delivery',
      handoff,
      {
        'idempotency_key':
            'marketplace-delivery-$cartId-${selectedRate.id}-${address.zipcode.trim()}-${selectedRate.amount.toStringAsFixed(2)}',
        'shipping_method': 'standard',
        'cod_requested': true,
        'shipping_address': {
          'line1': address.addressLine1.trim(),
          if (address.addressLine2.trim().isNotEmpty)
            'line2': address.addressLine2.trim(),
          'city': address.city.trim(),
          'state': address.state.trim(),
          'zip': address.zipcode.trim(),
          'country': normalizedCountry,
          'phone': address.phone.trim(),
        },
        'shipping_quote': <String, Object?>{
          'shipping_rate_id': selectedRate.id,
          'expected_shipping_amount': selectedRate.amount,
        },
      },
    );

    final deliveryQuote = delivery['checkout'] is Map
        ? (delivery['checkout'] as Map)['delivery_quote']
        : null;
    if (deliveryQuote is! Map ||
        deliveryQuote['currency'] != 'INR' ||
        deliveryQuote['server_resolved'] != true) {
      throw const ApiException(
        message:
            'The server could not verify this delivery quote. Please retry.',
        statusCode: 503,
        code: 'CHECKOUT_SHIPPING_UNAVAILABLE',
      );
    }
    final shipping = _requiredMoney(
      deliveryQuote['amount'],
      'CHECKOUT_SHIPPING_UNAVAILABLE',
    );
    if (deliveryQuote['shipping_rate_id'] != selectedRate.id) {
      throw const ApiException(
        message:
            'The delivery option changed. Review the available options again.',
        statusCode: 409,
        code: 'CHECKOUT_SHIPPING_CHANGED',
      );
    }
    final authoritativeTotal = subtotal - discount + shipping + tax;
    if (authoritativeTotal < 0 || !authoritativeTotal.isFinite) {
      throw const ApiException(
        message: 'The server could not confirm the checkout total.',
        statusCode: 503,
        code: 'CHECKOUT_TOTAL_UNAVAILABLE',
      );
    }
    if (acceptedTotal == null ||
        _minorUnits(acceptedTotal) != _minorUnits(authoritativeTotal)) {
      return MarketplaceCheckoutReview(
        subtotal: subtotal,
        discount: discount,
        shipping: shipping,
        tax: tax,
        authoritativeTotal: authoritativeTotal,
        shippingOptions: shippingOptions,
        selectedShippingRateId: selectedRate.id,
      );
    }

    final intent = await _client.storefront.checkoutStep(
      cartId,
      'payment-intent',
      handoff,
      {
        'idempotency_key': 'marketplace-payment-intent-$cartId',
        'provider': 'cod',
        'mode': 'sandbox',
        'tokenize': false,
        'metadata': <String, Object?>{'source': 'marketplace_mobile'},
      },
    );
    final intentData = intent['payment_intent'];
    if (intentData is! Map || intentData['payment_intent_id'] is! String) {
      throw const ApiException(
        message: 'Cash on delivery could not be prepared. Please retry.',
        statusCode: 503,
        code: 'CHECKOUT_INTENT_UNAVAILABLE',
      );
    }
    late final JsonMap confirmation;
    try {
      confirmation = await _client.storefront
          .checkoutStep(cartId, 'confirm', handoff, {
            'idempotency_key': 'marketplace-confirm-$cartId',
            'payment_intent_id': intentData['payment_intent_id'],
          });
    } on ApiException catch (error) {
      if (error.code == 'CHECKOUT_SHIPPING_CHANGED' ||
          error.code == 'MARKETPLACE_LISTING_CHANGED' ||
          error.code == 'MARKETPLACE_LISTING_UNAVAILABLE') {
        // The atomic database check refused an order whose reviewed rate changed during the final
        // request window, or whose approved marketplace revision changed after review. Retire only
        // this incomplete secure capability so the next retry starts a fresh signed cart;
        // completed orders are recovered before this path is reached.
        await _attemptStore.delete(storageKey);
      }
      rethrow;
    }
    final order = confirmation['order'];
    if (order is! Map) {
      throw const ApiException(
        message:
            'The server did not confirm the order. Retry to recover its final status.',
        statusCode: 503,
        code: 'CHECKOUT_ORDER_UNCONFIRMED',
      );
    }
    return _resultFromOrder(order, attempt.cartToken, matchesCurrentCart: true);
  }

  Future<void> clearCompletedAttempt({
    required String buyerNamespace,
    required String cartToken,
  }) async {
    final key = '$_checkoutAttemptStorageKey.$buyerNamespace';
    final attempt = await _readAttempt(key);
    if (attempt?.cartToken == cartToken) await _attemptStore.delete(key);
  }

  Future<_ResolvedCart> _resolveSellerBoundLines(
    List<CartItemModel> items,
  ) async {
    final lines = <Map<String, Object?>>[];
    final listingIds = <String>{};
    String? siteId;
    String? subdomain;
    final lineIdentities = <String>{};
    final unavailableListingIds = <String>[];
    for (final item in items) {
      final listingId = item.marketplaceListingId;
      if (listingId == null ||
          listingId.isEmpty ||
          item.quantity < 1 ||
          item.quantity > 99) {
        throw const ApiException(
          message:
              'A cart item is missing its approved marketplace listing. Remove it and add it again.',
          statusCode: 409,
          code: 'MARKETPLACE_LISTING_REQUIRED',
        );
      }
      final detail = await _client.marketplaceListing(listingId);
      if (detail == null || detail.listingId != listingId) {
        unavailableListingIds.add(listingId);
        continue;
      }
      if (item.sellerId != detail.siteId ||
          (item.catalogProductId != null &&
              item.catalogProductId != detail.productId) ||
          detail.subdomain == null ||
          detail.subdomain!.isEmpty ||
          (siteId != null && siteId != detail.siteId) ||
          (subdomain != null && subdomain != detail.subdomain)) {
        throw const ApiException(
          message:
              'Marketplace checkout currently supports products from one seller at a time.',
          statusCode: 409,
          code: 'MARKETPLACE_SINGLE_SELLER_REQUIRED',
        );
      }
      siteId = detail.siteId;
      subdomain = detail.subdomain;
      final identity = '${detail.productId}:${item.variantId ?? ''}';
      if (!lineIdentities.add(identity)) {
        throw const ApiException(
          message:
              'Your cart contains a duplicate product option. Refresh the cart and retry.',
          statusCode: 409,
          code: 'MARKETPLACE_DUPLICATE_LINE',
        );
      }
      listingIds.add(listingId);
      lines.add({
        'product_id': detail.productId,
        'marketplace_listing_id': listingId,
        if (item.variantId != null) 'variant_id': item.variantId,
        'quantity': item.quantity,
        'properties': <String, Object?>{},
      });
    }
    if (unavailableListingIds.isNotEmpty) {
      throw ApiException(
        message:
            'One or more products in your cart are no longer available. Remove them before continuing.',
        statusCode: 409,
        code: 'MARKETPLACE_LISTING_UNAVAILABLE',
        body: {'listing_ids': unavailableListingIds},
      );
    }
    if (siteId == null || subdomain == null || listingIds.isEmpty) {
      throw const ApiException(
        message: 'Your cart has no checkout-ready marketplace products.',
        statusCode: 409,
        code: 'MARKETPLACE_CART_EMPTY',
      );
    }
    lines.sort(
      (a, b) => '${a['marketplace_listing_id']}:${a['variant_id'] ?? ''}'
          .compareTo('${b['marketplace_listing_id']}:${b['variant_id'] ?? ''}'),
    );
    return _ResolvedCart(siteId: siteId, subdomain: subdomain, lines: lines);
  }

  Future<MarketplaceCheckoutResult?> _recoverCompleted({
    required String subdomain,
    required String cartToken,
    required int localCartRevision,
    required int priorRevision,
  }) async {
    try {
      final status = await _client.storefront.checkoutStatus(
        subdomain,
        cartToken,
      );
      if (status['checkout_state'] != 'completed' || status['order'] is! Map)
        return null;
      return _resultFromOrder(
        status['order'] as Map,
        cartToken,
        matchesCurrentCart: localCartRevision == priorRevision,
      );
    } on ApiException catch (error) {
      if (error.statusCode == 404) return null;
      rethrow;
    }
  }

  Future<_CheckoutAttempt?> _readAttempt(String key) async {
    final value = await _attemptStore.read(key);
    if (value == null) return null;
    try {
      final map = jsonDecode(value) as Map<String, dynamic>;
      return _CheckoutAttempt.fromJson(map);
    } catch (_) {
      await _attemptStore.delete(key);
      return null;
    }
  }

  Future<void> _writeAttempt(String key, _CheckoutAttempt attempt) =>
      _attemptStore.write(key, jsonEncode(attempt.toJson()));

  static MarketplaceCheckoutResult _resultFromOrder(
    Map order,
    String cartToken, {
    required bool matchesCurrentCart,
  }) {
    if (order['currency'] != 'INR') {
      throw const ApiException(
        message: 'The server returned an unsupported order currency.',
        statusCode: 502,
        code: 'CHECKOUT_ORDER_CURRENCY_UNSUPPORTED',
      );
    }
    return MarketplaceCheckoutResult(
      orderId: _requiredString(order['id'], 'CHECKOUT_ORDER_RESPONSE_INVALID'),
      orderNumber: _requiredString(
        order['order_number'] ?? order['orderNumber'],
        'CHECKOUT_ORDER_RESPONSE_INVALID',
      ),
      status: order['status'] is String ? order['status'] as String : 'pending',
      total: _requiredMoney(order['total'], 'CHECKOUT_ORDER_TOTAL_UNAVAILABLE'),
      matchesCurrentCart: matchesCurrentCart,
      cartToken: cartToken,
    );
  }

  static String _requiredString(Object? value, String code) {
    if (value is String && value.trim().isNotEmpty) return value.trim();
    throw ApiException(
      message: 'The server returned an incomplete checkout response.',
      statusCode: 502,
      code: code,
    );
  }

  static double _requiredMoney(Object? value, String code) {
    if (value is num && value.isFinite) return value.toDouble();
    if (value is String) {
      final parsed = double.tryParse(value);
      if (parsed != null && parsed.isFinite) return parsed;
    }
    return _unavailableMoney(code);
  }

  static MarketplaceShippingOption _shippingOptionFromJson(Map value) {
    final id = _requiredString(
      value['id'],
      'CHECKOUT_SHIPPING_RESPONSE_INVALID',
    );
    final name = _requiredString(
      value['name'],
      'CHECKOUT_SHIPPING_RESPONSE_INVALID',
    );
    if (value['currency'] != 'INR') {
      throw const ApiException(
        message: 'The server returned an unsupported delivery currency.',
        statusCode: 502,
        code: 'CHECKOUT_SHIPPING_CURRENCY_UNSUPPORTED',
      );
    }
    final minDays = value['estimated_days_min'];
    final maxDays = value['estimated_days_max'];
    return MarketplaceShippingOption(
      id: id,
      name: name,
      amount: _requiredMoney(
        value['amount'],
        'CHECKOUT_SHIPPING_RESPONSE_INVALID',
      ),
      estimatedDaysMin: minDays is num ? minDays.toInt() : null,
      estimatedDaysMax: maxDays is num ? maxDays.toInt() : null,
    );
  }

  static double _unavailableMoney(String code) {
    throw ApiException(
      message: 'The server could not confirm the checkout total. Please retry.',
      statusCode: 503,
      code: code,
    );
  }

  static int _minorUnits(double value) => (value * 100).round();

  static String _countryCode(String country) =>
      country.trim().toLowerCase() == 'india' ? 'IN' : country.trim();

  static String _fingerprint(Object value) =>
      sha256.convert(utf8.encode(jsonEncode(value))).toString();

  static String _newCartToken() {
    final random = Random.secure();
    final bytes = List<int>.generate(32, (_) => random.nextInt(256));
    return 'ct_${bytes.map((byte) => byte.toRadixString(16).padLeft(2, '0')).join()}';
  }
}

class _ResolvedCart {
  const _ResolvedCart({
    required this.siteId,
    required this.subdomain,
    required this.lines,
  });
  final String siteId;
  final String subdomain;
  final List<Map<String, Object?>> lines;
}

class _CheckoutAttempt {
  const _CheckoutAttempt({
    required this.cartToken,
    required this.subdomain,
    required this.cartFingerprint,
    required this.inputFingerprint,
    required this.localCartRevision,
  });

  final String cartToken;
  final String subdomain;
  final String cartFingerprint;
  final String inputFingerprint;
  final int localCartRevision;

  Map<String, Object?> toJson() => {
    'cart_token': cartToken,
    'subdomain': subdomain,
    'cart_fingerprint': cartFingerprint,
    'input_fingerprint': inputFingerprint,
    'local_cart_revision': localCartRevision,
  };

  factory _CheckoutAttempt.fromJson(Map<String, dynamic> json) =>
      _CheckoutAttempt(
        cartToken: json['cart_token'] as String,
        subdomain: json['subdomain'] as String,
        cartFingerprint: json['cart_fingerprint'] as String,
        inputFingerprint: json['input_fingerprint'] as String,
        localCartRevision: json['local_cart_revision'] as int,
      );
}
