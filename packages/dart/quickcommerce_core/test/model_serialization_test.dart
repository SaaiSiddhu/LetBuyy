import 'package:quickcommerce_core/quickcommerce_core.dart';
import 'package:test/test.dart';

void main() {
  final now = DateTime.utc(2026, 1, 1, 10);

  test('core models round-trip through JSON', () {
    final models = <Object>[
      UserProfile(
        id: 'user-1',
        fullName: 'Asha Farmer',
        phone: '+919999999999',
        email: 'asha@example.com',
        avatarUrl: 'https://cdn.example.com/avatar.png',
        createdAt: now,
        updatedAt: now,
      ),
      Address(
        id: 'address-1',
        userId: 'user-1',
        label: 'Home',
        line1: '12 MG Road',
        city: 'Bengaluru',
        state: 'KA',
        postalCode: '560001',
        latitude: 12.9716,
        longitude: 77.5946,
        createdAt: now,
        updatedAt: now,
      ),
      DarkStore(
        id: 'store-1',
        cityId: 'city-1',
        code: 'BLR-001',
        name: 'Indiranagar Dark Store',
        address: 'Indiranagar',
        latitude: 12.9784,
        longitude: 77.6408,
        createdAt: now,
        updatedAt: now,
      ),
      Category(
        id: 'category-1',
        name: 'Fruits',
        slug: 'fruits',
        displayOrder: 1,
        createdAt: now,
        updatedAt: now,
      ),
      Product(
        id: 'product-1',
        categoryId: 'category-1',
        name: 'Apple',
        slug: 'apple',
        variantId: 'variant-1',
        sku: 'APL-1KG',
        unitLabel: '1 kg',
        mrp: 180,
        salePrice: 149,
        mediaUrls: const ['https://cdn.example.com/apple.png'],
        searchKeywords: const ['apple', 'fruit'],
        isInStock: true,
        stockAvailable: 30,
        barcode: '890000000001',
        weightGrams: 1000,
        hsnCode: '0808',
        taxRate: 5,
        createdAt: now,
        updatedAt: now,
      ),
      CartItem(
        cartId: 'cart-1',
        variantId: 'variant-1',
        productId: 'product-1',
        productName: 'Apple',
        quantity: 2,
        unitPrice: 149,
        mrp: 180,
        addedAt: now,
        updatedAt: now,
      ),
      Cart(
        id: 'cart-1',
        userId: 'user-1',
        storeId: 'store-1',
        items: [
          CartItem(
            cartId: 'cart-1',
            variantId: 'variant-1',
            quantity: 2,
            unitPrice: 149,
          ),
        ],
        subtotal: 298,
        createdAt: now,
        updatedAt: now,
      ),
      OrderItem(
        orderId: 'order-1',
        variantId: 'variant-1',
        productSnapshot: const {'product_name': 'Apple'},
        quantity: 2,
        unitPrice: 149,
        mrp: 180,
        discount: 31,
      ),
      Order(
        id: 'order-1',
        publicOrderNumber: 'AG260101ABCD',
        userId: 'user-1',
        darkStoreId: 'store-1',
        addressSnapshot: const {'address_id': 'address-1'},
        status: OrderStatus.confirmed,
        subtotal: 298,
        payableTotal: 298,
        promisedEtaAt: now,
        items: [
          OrderItem(
            orderId: 'order-1',
            variantId: 'variant-1',
            productSnapshot: const {'product_name': 'Apple'},
            quantity: 2,
            unitPrice: 149,
            mrp: 180,
          ),
        ],
        createdAt: now,
        updatedAt: now,
      ),
      DeliveryInfo(
        id: 'delivery-1',
        orderId: 'order-1',
        darkStoreId: 'store-1',
        status: 'accepted',
        pickupLatitude: 12.9784,
        pickupLongitude: 77.6408,
        dropLatitude: 12.9716,
        dropLongitude: 77.5946,
        promisedEtaAt: now,
        createdAt: now,
        updatedAt: now,
      ),
      RiderProfile(
        userId: 'rider-1',
        cityId: 'city-1',
        vehicleType: 'bike',
        status: 'available',
        isVerified: true,
        createdAt: now,
        updatedAt: now,
      ),
      WalletAccount(
        userId: 'user-1',
        balance: 500,
        lockedBalance: 100,
        updatedAt: now,
      ),
      WalletEntry(
        id: 'entry-1',
        userId: 'user-1',
        entryType: 'cashback',
        amount: 20,
        balanceAfter: 520,
        metadata: const {'source': 'order'},
        createdAt: now,
      ),
      NotificationMessage(
        id: 'notification-1',
        userId: 'user-1',
        channel: 'push',
        templateKey: 'order_confirmed',
        title: 'Order confirmed',
        body: 'Arrives soon',
        payload: const {'order_id': 'order-1'},
        createdAt: now,
      ),
      Referral(
        id: 'referral-1',
        referrerUserId: 'user-1',
        refereeUserId: 'user-2',
        referralCode: 'AGRI50',
        status: 'qualified',
        firstOrderId: 'order-1',
        creditedAt: now,
        createdAt: now,
        updatedAt: now,
      ),
    ];

    for (final model in models) {
      final json = switch (model) {
        UserProfile value => value.toJson(),
        Address value => value.toJson(),
        DarkStore value => value.toJson(),
        Category value => value.toJson(),
        Product value => value.toJson(),
        CartItem value => value.toJson(),
        Cart value => value.toJson(),
        OrderItem value => value.toJson(),
        Order value => value.toJson(),
        DeliveryInfo value => value.toJson(),
        RiderProfile value => value.toJson(),
        WalletAccount value => value.toJson(),
        WalletEntry value => value.toJson(),
        NotificationMessage value => value.toJson(),
        Referral value => value.toJson(),
        _ => throw StateError('Unexpected model $model'),
      };

      final roundTripped = switch (model) {
        UserProfile _ => UserProfile.fromJson(json),
        Address _ => Address.fromJson(json),
        DarkStore _ => DarkStore.fromJson(json),
        Category _ => Category.fromJson(json),
        Product _ => Product.fromJson(json),
        CartItem _ => CartItem.fromJson(json),
        Cart _ => Cart.fromJson(json),
        OrderItem _ => OrderItem.fromJson(json),
        Order _ => Order.fromJson(json),
        DeliveryInfo _ => DeliveryInfo.fromJson(json),
        RiderProfile _ => RiderProfile.fromJson(json),
        WalletAccount _ => WalletAccount.fromJson(json),
        WalletEntry _ => WalletEntry.fromJson(json),
        NotificationMessage _ => NotificationMessage.fromJson(json),
        Referral _ => Referral.fromJson(json),
        _ => throw StateError('Unexpected model $model'),
      };

      expect(roundTripped, model);
      expect(roundTripped.toString(), contains(model.runtimeType.toString()));
    }
  });

  test('copyWith preserves equality semantics', () {
    final product = Product(
      id: 'product-1',
      categoryId: 'category-1',
      name: 'Apple',
      slug: 'apple',
      variantId: 'variant-1',
      sku: 'APL-1KG',
      unitLabel: '1 kg',
      mrp: 180,
      salePrice: 149,
    );

    expect(product.copyWith(), product);
    expect(product.copyWith(salePrice: 139), isNot(product));
  });

  test('contract enums round-trip canonical SQL values only', () {
    for (final status in OrderStatus.values) {
      expect(OrderStatus.fromJson(status.toJson()), status);
    }
    expect(OrderStatus.fromJson('rider_assigned'), OrderStatus.riderAssigned);
    expect(OrderStatus.riderAssigned.toJson(), 'rider_assigned');
    final legacyOutForDelivery = ['out', 'for', 'delivery'].join('_');
    expect(() => OrderStatus.fromJson(legacyOutForDelivery),
        throwsFormatException);
  });
}
