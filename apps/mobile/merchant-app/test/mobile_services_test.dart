import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:letbuyy_models/letbuyy_models.dart' hide JsonMap;
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/services/analytics_service.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/cms_service.dart';
import 'package:letbuyy_store/services/coupon_service.dart';
import 'package:letbuyy_store/services/customer_service.dart';
import 'package:letbuyy_store/services/domain_service.dart';
import 'package:letbuyy_store/services/inventory_service.dart';
import 'package:letbuyy_store/services/media_service.dart';
import 'package:letbuyy_store/services/notification_settings_service.dart';
import 'package:letbuyy_store/services/order_service.dart';
import 'package:letbuyy_store/services/product_service.dart';
import 'package:letbuyy_store/services/push_service.dart';
import 'package:letbuyy_store/services/review_service.dart';
import 'package:letbuyy_store/services/shipping_tax_service.dart';
import 'package:letbuyy_store/services/skip_needs_backend_exception.dart';
import 'package:letbuyy_store/services/staff_service.dart';
import 'package:letbuyy_store/services/store_auth_service.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/services/subscription_service.dart';
import 'package:letbuyy_store/services/theme_service.dart';
import 'package:letbuyy_store/screens/content/blog_screen.dart';
import 'package:letbuyy_store/screens/content/media_library_screen.dart';
import 'package:letbuyy_store/screens/content/navigation_screen.dart';
import 'package:letbuyy_store/screens/content/page_editor_screen.dart';
import 'package:letbuyy_store/screens/content/pages_screen.dart';
import 'package:letbuyy_store/screens/content/post_editor_screen.dart';
import 'package:letbuyy_store/screens/customize/theme_versions_screen.dart';
import 'package:letbuyy_store/screens/customers/customer_detail_screen.dart';
import 'package:letbuyy_store/screens/customers/customers_screen.dart';
import 'package:letbuyy_store/screens/discounts/coupon_form_screen.dart';
import 'package:letbuyy_store/screens/discounts/coupons_screen.dart';
import 'package:letbuyy_store/screens/inventory/inventory_screen.dart';
import 'package:letbuyy_store/screens/inventory/locations_screen.dart';
import 'package:letbuyy_store/screens/inventory/purchase_orders_screen.dart';
import 'package:letbuyy_store/screens/inventory/suppliers_screen.dart';
import 'package:letbuyy_store/screens/inventory/transfers_screen.dart';
import 'package:letbuyy_store/screens/marketing/reviews_screen.dart';
import 'package:letbuyy_store/screens/orders/order_detail_screen.dart';
import 'package:letbuyy_store/screens/products/collections_screen.dart';
import 'package:letbuyy_store/screens/products/product_form_screen.dart';
import 'package:letbuyy_store/screens/settings/notifications_screen.dart';
import 'package:letbuyy_store/screens/settings/billing_screen.dart';
import 'package:letbuyy_store/screens/settings/domain_settings_screen.dart';
import 'package:letbuyy_store/screens/settings/shipping_screen.dart';
import 'package:letbuyy_store/screens/settings/staff_screen.dart';
import 'package:letbuyy_store/screens/settings/taxes_screen.dart';
import 'package:provider/provider.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('mobile gateway services', () {
    test('StoreService fetches store list through the API client', () async {
      final api = _FakeApiClient(
        paginated: {
          '/stores': [_storeJson()],
        },
      );

      final stores = await StoreService(api: api).fetchStores();

      expect(stores.single.id, 'store_1');
      expect(api.paths, contains('/stores'));
    });

    test('ProductService keeps canonical ProductContract payloads', () async {
      final api = _FakeApiClient(
        paginated: {
          '/products': [_productJson()],
        },
      );

      final products = await ProductService(api: api).fetchProducts('store_1');

      expect(products.single['store_id'], 'store_1');
      expect(products.single.containsKey('salePrice'), isFalse);
    });

    test(
      'ProductService sends variant matrix rows in create payload',
      () async {
        final api = _FakeApiClient(
          json: {
            '/products': _productJson(variants: [_variantJson()]),
          },
        );
        final service = ProductService(api: api);

        await service.createProduct(
          storeId: 'store_1',
          name: 'Cotton Tee',
          description: 'Variant test',
          price: 499,
          sku: 'TEE-BASE',
          stock: 10,
          images: ['https://cdn.test/products/tee.jpg'],
          variants: [_variantJson()],
        );

        final body = api.bodies['/products'] as Map<String, dynamic>;
        final variants = body['variants'] as List<Map<String, dynamic>>;
        expect(body['sku'], 'TEE-BASE');
        expect(variants.single['sku'], 'TEE-XL');
        expect(variants.single['price'], 599);
        expect(variants.single['stock'], 4);
        expect(variants.single['options'], {'Size': 'XL'});
      },
    );

    test(
      'ProductService lists and creates collections, then skips missing mutations',
      () async {
        final api = _FakeApiClient(
          json: {
            '/products/collections': [_collectionJson()],
          },
        );
        final service = ProductService(api: api);

        final collections = await service.fetchCollections('store_1');
        final created = await service.createCollection(
          const ProductCollectionInput(
            storeId: 'store_1',
            title: 'Summer picks',
            description: 'Seasonal merchandising',
          ),
        );

        expect(collections.single.title, 'Summer picks');
        expect(created.handle, 'summer-picks');
        expect(api.paths, contains('/products/collections'));
        await expectLater(
          service.updateCollection(
            'collection_1',
            const ProductCollectionInput(storeId: 'store_1', title: 'Updated'),
          ),
          throwsA(
            isA<SkipNeedsBackendException>().having(
              (error) => error.id,
              'id',
              ProductService.missingCollectionMutationRouteId,
            ),
          ),
        );
        await expectLater(
          service.deleteCollection('collection_1'),
          throwsA(
            isA<SkipNeedsBackendException>().having(
              (error) => error.id,
              'id',
              ProductService.missingCollectionMutationRouteId,
            ),
          ),
        );
      },
    );

    test('OrderService fetches typed orders and status counts', () async {
      final api = _FakeApiClient(
        paginated: {
          '/orders': [
            _orderJson(status: 'paid'),
            _orderJson(id: 'order_2', status: 'paid'),
          ],
        },
      );
      final service = OrderService(api: api);

      final orders = await service.fetchOrders('store_1');

      expect(orders, hasLength(2));
      expect(service.statusCounts['paid'], 2);
    });

    test('OrderService fetches detail and refund lifecycle routes', () async {
      final api = _FakeApiClient(
        json: {
          '/orders/order_1': _orderJson(),
          '/orders/order_1/refund': _orderJson(status: 'refund_pending'),
          '/orders/order_1/refund/complete': _orderJson(status: 'refunded'),
        },
      );
      final service = OrderService(api: api);

      final detail = await service.fetchOrder('order_1');
      await service.refundOrder(
        'order_1',
        amount: 499,
        reason: 'Customer requested return',
        idempotencyKey: 'test-refund-key',
      );
      final completed = await service.completeRefund(
        'order_1',
        refundId: 'refund_1',
        providerRefundId: 'rfnd_1',
      );

      expect(detail.id, 'order_1');
      expect(completed.status, 'refunded');
      expect(api.paths, contains('/orders/order_1'));
      expect(api.paths, contains('/orders/order_1/refund'));
      expect(api.paths, contains('/orders/order_1/refund/complete'));
    });

    test('CustomerService manages customers and addresses', () async {
      final api = _FakeApiClient(
        paginated: {
          '/customers': [_customerJson()],
        },
        json: {
          '/customers/meera%40example.com': _customerJson(),
          '/customers/meera%40example.com/addresses': [_addressJson()],
          '/customers/meera%40example.com/addresses/address_1': _addressJson(),
        },
      );
      final service = CustomerService(api: api);

      final customers = await service.fetchCustomers('store_1');
      final detail = await service.fetchCustomerByEmail('meera@example.com');
      final addresses = await service.fetchAddresses('meera@example.com');
      await service.createAddress('meera@example.com', _addressJson());
      await service.updateAddress(
        'meera@example.com',
        'address_1',
        _addressJson(),
      );
      await service.deleteAddress('meera@example.com', 'address_1');

      expect(customers.single.email, 'meera@example.com');
      expect(detail.displayName, 'Meera Merchant');
      expect(addresses.single.city, 'Bengaluru');
      expect(api.paths, contains('/customers'));
      expect(api.paths, contains('/customers/meera%40example.com'));
      expect(
        api.paths,
        contains('/customers/meera%40example.com/addresses/address_1'),
      );
    });

    test('InventoryService lists and adjusts stock levels', () async {
      final api = _FakeApiClient(
        paginated: {
          '/inventory/levels': [_inventoryJson()],
        },
        json: {'/inventory/adjust': _inventoryJson(available: 15)},
      );
      final service = InventoryService(api: api);

      final levels = await service.fetchLevels('store_1');
      final adjusted = await service.adjustStock(
        storeId: 'store_1',
        level: levels.single,
        delta: 5,
        reason: 'stock_count',
      );

      expect(levels.single.sku, 'TEE-001');
      expect(adjusted.available, 15);
      expect(api.paths, contains('/inventory/levels'));
      expect(api.paths, contains('/inventory/adjust'));
      expect(api.bodies['/inventory/adjust'], containsPair('adjustment', 5));
    });

    test('InventoryService manages WMS locations and suppliers', () async {
      final api = _FakeApiClient(
        json: {
          '/inventory/locations': [_locationJson()],
          '/inventory/suppliers': [_supplierJson()],
        },
      );
      final service = InventoryService(api: api);

      final locations = await service.fetchLocations('store_1');
      final createdLocation = await service.createLocation(
        const InventoryLocationInput(
          storeId: 'store_1',
          name: 'North warehouse',
          city: 'Delhi',
          state: 'Delhi',
          isDefault: true,
        ),
      );
      final suppliers = await service.fetchSuppliers('store_1');
      final createdSupplier = await service.createSupplier(
        const InventorySupplierInput(
          storeId: 'store_1',
          name: 'Acme Textiles',
          contactName: 'Riya',
          email: 'riya@example.com',
          phone: '+911111111111',
        ),
      );

      expect(locations.single.name, 'North warehouse');
      expect(createdLocation.isDefault, isTrue);
      expect(suppliers.single.name, 'Acme Textiles');
      expect(createdSupplier.email, 'riya@example.com');
      expect(api.paths, contains('/inventory/locations'));
      expect(api.paths, contains('/inventory/suppliers'));
    });

    test('InventoryService creates and advances purchase orders', () async {
      final api = _FakeApiClient(
        json: {
          '/inventory/purchase-orders': [_purchaseOrderJson()],
          '/inventory/purchase-orders/po_1/receive': _purchaseOrderJson(
            status: 'received',
            receivedQuantity: 4,
          ),
        },
      );
      final service = InventoryService(api: api);

      final orders = await service.fetchPurchaseOrders('store_1');
      final created = await service.createPurchaseOrder(
        const PurchaseOrderInput(
          storeId: 'store_1',
          supplierId: 'supplier_1',
          locationId: 'loc_1',
          idempotencyKey: 'po-create-123',
          lines: [
            InventoryLineInput(
              productId: 'prod_1',
              variantId: 'variant_1',
              quantity: 4,
              unitCost: 299,
            ),
          ],
        ),
      );
      final received = await service.receivePurchaseOrder(
        created,
        idempotencyKey: 'po-receive-123',
      );

      expect(orders.single.totalQuantity, 4);
      expect(created.supplierName, 'Acme Textiles');
      expect(received.status, 'received');
      expect(received.remainingQuantity, 0);
      expect(api.paths, contains('/inventory/purchase-orders'));
      expect(api.paths, contains('/inventory/purchase-orders/po_1/receive'));
      expect(
        api.bodies['/inventory/purchase-orders'],
        containsPair('idempotency_key', 'po-create-123'),
      );
    });

    test('InventoryService creates, ships, and receives transfers', () async {
      final api = _FakeApiClient(
        json: {
          '/inventory/transfers': [_transferJson()],
          '/inventory/transfers/transfer_1/ship': _transferJson(
            status: 'shipped',
          ),
          '/inventory/transfers/transfer_1/receive': _transferJson(
            status: 'received',
            receivedQuantity: 3,
          ),
        },
      );
      final service = InventoryService(api: api);

      final transfers = await service.fetchTransfers('store_1');
      final created = await service.createTransfer(
        const InventoryTransferInput(
          storeId: 'store_1',
          sourceLocationId: 'loc_1',
          destinationLocationId: 'loc_2',
          idempotencyKey: 'transfer-create-123',
          lines: [InventoryLineInput(productId: 'prod_1', quantity: 3)],
        ),
      );
      final shipped = await service.shipTransfer(
        created,
        idempotencyKey: 'transfer-ship-123',
      );
      final received = await service.receiveTransfer(
        created,
        idempotencyKey: 'transfer-receive-123',
      );

      expect(transfers.single.totalQuantity, 3);
      expect(shipped.status, 'shipped');
      expect(received.status, 'received');
      expect(received.remainingQuantity, 0);
      expect(api.paths, contains('/inventory/transfers'));
      expect(api.paths, contains('/inventory/transfers/transfer_1/ship'));
      expect(api.paths, contains('/inventory/transfers/transfer_1/receive'));
    });

    test(
      'InventoryService scanner seam fails loudly until dependency is added',
      () async {
        final service = InventoryService(api: _FakeApiClient());

        await expectLater(
          service.scanBarcode(),
          throwsA(
            isA<SkipNeedsBackendException>().having(
              (error) => error.id,
              'id',
              InventoryService.scannerDependencyId,
            ),
          ),
        );
      },
    );

    test('CouponService handles coupon CRUD and validation', () async {
      final api = _FakeApiClient(
        paginated: {
          '/coupons': [_couponJson()],
        },
        json: {
          '/coupons': _couponJson(id: 'coupon_2', code: 'WELCOME'),
          '/coupons/coupon_1': _couponJson(isActive: false),
          '/coupons/validate': {'message': 'Coupon is valid'},
        },
      );
      final service = CouponService(api: api);

      final coupons = await service.fetchCoupons('store_1');
      final created = await service.createCoupon(_couponJson(code: 'WELCOME'));
      final toggled = await service.toggleCoupon(coupons.single);
      await service.deleteCoupon('coupon_1');
      final validation = await service.validateCoupon(
        storeId: 'store_1',
        code: 'SAVE10',
        subtotal: 1000,
      );

      expect(coupons.single.code, 'SAVE10');
      expect(created.code, 'WELCOME');
      expect(toggled.isActive, isFalse);
      expect(validation['message'], 'Coupon is valid');
      expect(api.paths, contains('/coupons'));
      expect(api.paths, contains('/coupons/coupon_1'));
      expect(api.paths, contains('/coupons/validate'));
    });

    test('CmsService handles page CRUD through the gateway', () async {
      final api = _FakeApiClient(
        paginated: {
          '/pages': [_pageJson()],
        },
        json: {
          '/pages': _pageJson(id: 'page_2', title: 'About LetBuyy'),
          '/pages/page_1': _pageJson(status: 'published'),
        },
      );
      final service = CmsService(api: api);

      final pages = await service.fetchPages('store_1');
      final created = await service.createPage(
        const CmsPageInput(
          storeId: 'store_1',
          title: 'About LetBuyy',
          body: 'Built from a phone.',
          slug: 'about-letbuyy',
          status: 'draft',
        ),
      );
      final updated = await service.updatePage(
        'page_1',
        const CmsPageInput(
          storeId: 'store_1',
          title: 'About us',
          body: 'Updated from mobile.',
          slug: 'about-us',
          status: 'published',
        ),
      );
      await service.updatePageStatus(pages.single, 'published');
      await service.deletePage('page_1');

      expect(pages.single.title, 'About us');
      expect(created.id, 'page_2');
      expect(updated.status, 'published');
      expect(api.paths, contains('/pages'));
      expect(api.paths, contains('/pages/page_1'));
    });

    test('CmsService manages blog posts and comment moderation', () async {
      final api = _FakeApiClient(
        paginated: {
          '/blog/posts': [_blogPostJson()],
          '/blog/comments': [_blogCommentJson()],
        },
        json: {
          '/blog/posts': _blogPostJson(id: 'post_2', postTitle: 'Mobile tips'),
          '/blog/posts/post_1': _blogPostJson(status: 'published'),
          '/blog/comments/comment_1': _blogCommentJson(status: 'approved'),
        },
      );
      final service = CmsService(api: api);

      final posts = await service.fetchBlogPosts('store_1');
      final created = await service.createBlogPost(
        const BlogPostInput(
          storeId: 'store_1',
          title: 'Mobile tips',
          content: 'Run your store from a phone.',
          slug: 'mobile-tips',
        ),
      );
      final updated = await service.updateBlogPost(
        'post_1',
        const BlogPostInput(
          storeId: 'store_1',
          title: 'Launch update',
          content: 'Published from mobile.',
          slug: 'launch-update',
          status: 'published',
        ),
      );
      await service.updateBlogPostStatus(posts.single, 'published');
      await service.deleteBlogPost('post_1');
      final comments = await service.fetchBlogComments('store_1');
      final moderated = await service.moderateBlogComment(
        comments.single,
        'approved',
      );
      await service.deleteBlogComment('comment_1');

      expect(posts.single.title, 'Launch update');
      expect(created.id, 'post_2');
      expect(updated.status, 'published');
      expect(moderated.status, 'approved');
      expect(api.paths, contains('/blog/posts'));
      expect(api.paths, contains('/blog/posts/post_1'));
      expect(api.paths, contains('/blog/comments'));
      expect(api.paths, contains('/blog/comments/comment_1'));
    });

    test('CmsService loads and replaces storefront navigation', () async {
      final api = _FakeApiClient(
        json: {
          '/pages/navigation': {
            'menu': _navigationMenuJson(),
            'items': [_navigationItemJson()],
          },
          '/pages/navigation/main': {'replaced': true, 'count': 1},
        },
      );
      final service = CmsService(api: api);

      final navigation = await service.fetchNavigation(
        'store_1',
        location: 'main',
      );
      final saved = await service.replaceNavigation(
        storeId: 'store_1',
        location: 'main',
        name: 'Header menu',
        items: [
          NavigationItemInput.fromContract(
            navigation.items.single,
          ).copyWith(label: 'Catalog', url: '/collections/all'),
        ],
      );

      expect(navigation.menu?.location, 'main');
      expect(navigation.items.single.label, 'Home');
      expect(saved.items.single.url, '/');
      expect(api.paths, contains('/pages/navigation'));
      expect(api.paths, contains('/pages/navigation/main'));
    });

    test('MediaService lists, uploads, updates, and deletes assets', () async {
      final tempDir = Directory.systemTemp.createTempSync('letbuyy-media-test');
      addTearDown(() => tempDir.deleteSync(recursive: true));
      final file = File('${tempDir.path}/hero.png')..writeAsBytesSync([1, 2]);
      final api = _FakeApiClient(
        paginated: {
          '/media': [_mediaJson()],
        },
        json: {
          '/upload': _uploadJson(),
          '/media': _mediaJson(id: 'media_2', filename: 'hero.png'),
          '/media/media_1': _mediaJson(altText: 'Campaign hero'),
        },
      );
      final service = MediaService(api: api);

      final assets = await service.fetchMedia('store_1');
      final uploaded = await service.uploadAndCreate(
        storeId: 'store_1',
        file: file,
        folder: 'media',
        altText: 'Hero',
      );
      final updated = await service.updateMedia(
        'media_1',
        const MediaUpdateInput(altText: 'Campaign hero', folder: 'media'),
      );
      await service.deleteMedia(assets.single, deleteObject: true);

      expect(assets.single.displayName, 'Hero image');
      expect(uploaded.id, 'media_2');
      expect(updated.altText, 'Campaign hero');
      expect(api.paths, contains('/media'));
      expect(api.paths, contains('/upload'));
      expect(api.paths, contains('/media/media_1'));
      expect(api.paths, contains('/upload/media%2Fstore_1%2Fhero.png'));
    });

    test('ShippingTaxService manages zones and rates', () async {
      final api = _FakeApiClient(
        json: {
          '/shipping-tax/shipping/zones': [_shippingZoneJson()],
          '/shipping-tax/shipping': [_shippingRateJson()],
          '/shipping-tax/shipping/zones/zone_1': _shippingZoneJson(
            name: 'South India',
          ),
          '/shipping-tax/shipping/rate_1': _shippingRateJson(price: 80),
        },
      );
      final service = ShippingTaxService(api: api);

      final summary = await service.fetchShipping('store_1');
      final createdZone = await service.createZone(
        const ShippingZoneInput(
          storeId: 'store_1',
          name: 'Domestic',
          countries: ['IN'],
        ),
      );
      final updatedZone = await service.updateZone(
        'zone_1',
        const ShippingZoneInput(
          storeId: 'store_1',
          name: 'South India',
          countries: ['IN'],
          states: ['Karnataka'],
        ),
      );
      final createdRate = await service.createRate(
        const ShippingRateInput(
          zoneId: 'zone_1',
          name: 'Standard',
          type: 'flat',
          price: 49,
          estimatedDaysMin: 2,
          estimatedDaysMax: 5,
        ),
      );
      final updatedRate = await service.updateRate(
        'rate_1',
        const ShippingRateInput(
          zoneId: 'zone_1',
          name: 'Standard',
          type: 'flat',
          price: 80,
        ),
      );
      await service.deleteRate('rate_1');
      await service.deleteZone('zone_1');

      expect(summary.zones.single.name, 'Domestic');
      expect(summary.rates.single.name, 'Standard');
      expect(createdZone.countries, ['IN']);
      expect(updatedZone.states, ['Karnataka']);
      expect(createdRate.price, 49);
      expect(updatedRate.price, 80);
      expect(api.paths, contains('/shipping-tax/shipping/zones'));
      expect(api.paths, contains('/shipping-tax/shipping'));
      expect(api.paths, contains('/shipping-tax/shipping/zones/zone_1'));
      expect(api.paths, contains('/shipping-tax/shipping/rate_1'));
    });

    test('ShippingTaxService manages tax rates', () async {
      final api = _FakeApiClient(
        json: {
          '/shipping-tax/taxes': [_taxRateJson()],
          '/shipping-tax/taxes/tax_1': _taxRateJson(rate: 12),
        },
      );
      final service = ShippingTaxService(api: api);

      final taxes = await service.fetchTaxes('store_1');
      final created = await service.createTaxRate(
        const TaxRateInput(
          storeId: 'store_1',
          name: 'GST',
          rate: 18,
          country: 'IN',
          appliesTo: 'all',
        ),
      );
      final updated = await service.updateTaxRate(
        'tax_1',
        const TaxRateInput(
          storeId: 'store_1',
          name: 'Reduced GST',
          rate: 12,
          country: 'IN',
          appliesTo: 'products',
        ),
      );
      await service.deleteTaxRate('tax_1');

      expect(taxes.single.name, 'GST');
      expect(created.country, 'IN');
      expect(updated.rate, 12);
      expect(api.paths, contains('/shipping-tax/taxes'));
      expect(api.paths, contains('/shipping-tax/taxes/tax_1'));
    });

    test(
      'DomainService saves custom domains and skips missing lifecycle',
      () async {
        final api = _FakeApiClient(
          json: {
            '/stores/store_1': _storeJson(
              customDomain: 'shop.example.com',
              customDomainStatus: 'pending',
              dnsConfig: {'CNAME': DomainService.cnameTarget},
            ),
          },
        );
        final service = DomainService(api: api);
        final store = StoreModel.fromJson(_storeJson());

        final updated = await service.saveCustomDomain(
          store,
          'https://Shop.Example.com/path',
        );
        final snapshot = service.snapshotForStore(updated);

        expect(updated.customDomain, 'shop.example.com');
        expect(snapshot.records.single.type, 'CNAME');
        expect(snapshot.records.single.value, DomainService.cnameTarget);
        expect(api.paths, contains('/stores/store_1'));
        await expectLater(
          service.checkAvailability('shop.example.com'),
          throwsA(
            isA<SkipNeedsBackendException>().having(
              (error) => error.id,
              'id',
              DomainService.missingLifecycleRouteId,
            ),
          ),
        );
      },
    );

    test('NotificationSettingsService persists preferences', () async {
      final api = _FakeApiClient(
        json: {'/notifications/preferences': _notificationPreferenceRows()},
      );
      final service = NotificationSettingsService(api: api);

      final settings = await service.fetchSettings('store_1');
      final updated = await service.updateSettings(
        settings.copyWith(marketing: true),
      );

      expect(settings.emailEnabled, isTrue);
      expect(updated.lowStock, isTrue);
      expect(api.paths, contains('/notifications/preferences'));
    });

    test('StaffService manages staff, invites, roles, and removal', () async {
      final api = _FakeApiClient(
        json: {
          '/employees': [_staffJson()],
          '/employees/invite': _staffInviteJson(),
          '/employees/staff_1': _staffJson(role: 'manager'),
        },
      );
      final service = StaffService(api: api);

      final staff = await service.fetchStaff('store_1');
      final created = await service.createStaff(
        const StaffInviteInput(
          storeId: 'store_1',
          email: 'riya@example.com',
          role: 'editor',
        ),
      );
      final invite = await service.inviteStaff(
        const StaffInviteInput(
          storeId: 'store_1',
          email: 'arjun@example.com',
          role: 'support',
        ),
      );
      final updated = await service.updateRole(staff.single, 'manager');
      await service.removeStaff(updated);

      expect(staff.single.email, 'riya@example.com');
      expect(created.role, 'editor');
      expect(invite.status, 'pending');
      expect(updated.role, 'manager');
      expect(api.paths, contains('/employees'));
      expect(api.paths, contains('/employees/invite'));
      expect(api.paths, contains('/employees/staff_1'));
      expect(api.bodies['/employees'], containsPair('role', 'editor'));
      expect(api.bodies['/employees/staff_1'], containsPair('role', 'manager'));
    });

    test('ReviewService moderates reviews and skips missing replies', () async {
      final api = _FakeApiClient(
        paginated: {
          '/reviews': [_reviewJson()],
        },
        json: {'/reviews/review_1': _reviewJson(status: 'approved')},
      );
      final service = ReviewService(api: api);

      final reviews = await service.fetchReviews('store_1', status: 'pending');
      final approved = await service.moderateReview(reviews.single, 'approved');
      await service.deleteReview(approved);

      expect(reviews.single.productName, 'Cotton Tee');
      expect(approved.status, 'approved');
      expect(service.reviews, isEmpty);
      expect(api.paths, contains('/reviews'));
      expect(api.paths, contains('/reviews/review_1'));
      expect(
        api.bodies['/reviews/review_1'],
        containsPair('status', 'approved'),
      );
      await expectLater(
        service.replyToReview(
          const ReviewReplyInput(
            reviewId: 'review_1',
            message: 'Thanks for your feedback.',
          ),
        ),
        throwsA(
          isA<SkipNeedsBackendException>().having(
            (error) => error.id,
            'id',
            ReviewService.missingReplyRouteId,
          ),
        ),
      );
    });

    test(
      'PushService fails closed until device token backend exists',
      () async {
        final service = PushService(api: _FakeApiClient(json: const {}));

        await expectLater(
          service.registerDeviceToken(
            token: 'device-token',
            platform: PushDevicePlatform.android,
            deviceName: 'Pixel test device',
          ),
          throwsA(
            isA<SkipNeedsBackendException>().having(
              (error) => error.id,
              'id',
              PushService.missingRegistrationRouteId,
            ),
          ),
        );

        expect(service.lastAttempt?.toJson(), {
          'token': 'device-token',
          'platform': 'android',
          'device_name': 'Pixel test device',
        });
      },
    );

    test('AnalyticsService assembles dashboard metrics', () async {
      final api = _FakeApiClient(
        json: {
          '/analytics/dashboard': {
            'summary': {
              'revenue': {'value': 1200},
              'orders': {'value': 4},
              'products': 2,
              'avg_order_value': 300,
            },
          },
          '/analytics/orders': {
            'breakdown': {'paid': 3, 'pending': 1},
          },
          '/analytics/revenue': {
            'chart': [
              {'date': '2026-06-01', 'revenue': 1200, 'orders': 4},
            ],
          },
          '/analytics/top-products': [
            {'id': 'prod_1', 'name': 'Tee', 'total_sold': 2, 'revenue': 600},
          ],
        },
      );

      final analytics = await AnalyticsService(
        api: api,
      ).getStoreAnalytics('store_1');

      expect(analytics.totalRevenue, 1200);
      expect(analytics.ordersByStatus['paid'], 3);
      expect(analytics.topProducts.single.name, 'Tee');
    });

    test(
      'ThemeService reads catalog payload without native previews',
      () async {
        final api = _FakeApiClient(
          raw: {
            '/themes': {
              'data': [
                {'id': 'theme_1', 'slug': 'modern', 'name': 'Modern'},
              ],
              'current_theme': 'modern',
              'store_status': 'published',
            },
          },
        );

        final catalog = await ThemeService(api: api).fetchThemes('store_1');

        expect(catalog.themes.single.slug, 'modern');
        expect(catalog.currentTheme, 'modern');
      },
    );

    test(
      'ThemeService manages preview sessions and release rollback',
      () async {
        final api = _FakeApiClient(
          raw: {
            '/themes': {
              'data': [
                {'id': 'theme_1', 'slug': 'modern', 'name': 'Modern'},
              ],
              'current_theme': 'modern',
              'store_status': 'published',
            },
          },
          json: {
            '/themes/modern/preview-session': {
              'preview_token': 'preview_token_123',
            },
            '/themes/modern/releases': [_themeReleaseJson()],
            '/themes/modern/releases/release_1/rollback': {'ok': true},
          },
        );
        final service = ThemeService(api: api);

        final preview = await service.createPreviewSession(
          storeId: 'store_1',
          themeSlug: 'modern',
        );
        final releases = await service.fetchReleases(
          storeId: 'store_1',
          themeSlug: 'modern',
        );
        await service.rollbackRelease(
          storeId: 'store_1',
          themeSlug: 'modern',
          releaseId: 'release_1',
        );

        expect(preview['preview_token'], 'preview_token_123');
        expect(releases.single['release_version'], 3);
        expect(api.paths, contains('/themes/modern/preview-session'));
        expect(api.paths, contains('/themes/modern/releases'));
        expect(
          api.paths,
          contains('/themes/modern/releases/release_1/rollback'),
        );
      },
    );

    test(
      'SubscriptionService creates and verifies Razorpay checkout',
      () async {
        final api = _FakeApiClient(
          json: {
            'payments/subscription/order': {
              'razorpay_order_id': 'order_123',
              'amount': 39900,
              'currency': 'INR',
              'key_id': 'rzp_test_public',
            },
            'payments/subscription/verify': {
              'subscription': {'id': 'sub_1', 'status': 'active'},
            },
          },
        );
        final service = SubscriptionService(api: api);

        final checkout = await service.createSubscriptionOrder(
          storeId: 'store_1',
          plan: SubscriptionPlan.business,
        );
        await service.verifySubscriptionPayment(
          storeId: 'store_1',
          plan: SubscriptionPlan.business,
          razorpayPaymentId: 'pay_123',
          razorpaySignature: 'sig_123',
          razorpayOrderId: 'order_123',
        );

        expect(checkout['razorpay_order_id'], 'order_123');
        expect(api.paths, contains('payments/subscription/verify'));
      },
    );

    test('SubscriptionService reads billing history invoices', () async {
      final api = _FakeApiClient(
        json: {
          '/payments/subscription/history': [_billingHistoryJson()],
        },
      );
      final service = SubscriptionService(api: api);

      final history = await service.fetchBillingHistory('store_1');

      expect(history.single.status, 'active');
      expect(history.single.billingPeriod, 'monthly');
      expect(history.single.amountLabel, 'INR 399.00');
      expect(api.paths, contains('/payments/subscription/history'));
    });
  });

  group('StoreAuthService', () {
    setUp(() {
      FlutterSecureStorage.setMockInitialValues({});
    });

    test('requests signup OTP with CSRF cookie and Turnstile token', () async {
      final requests = <http.Request>[];
      final auth = StoreAuthService(
        api: _FakeApiClient(),
        identityBaseUrl: 'https://accounts.test',
        turnstileTokenProvider: () => 'turnstile_token',
        httpClient: MockClient((request) async {
          requests.add(request);
          if (request.url.path == '/login') {
            return http.Response(
              '',
              200,
              headers: {'set-cookie': 'letbuyy_csrf=csrf_123; Path=/;'},
            );
          }
          return http.Response(
            '{"success":true,"needsVerification":true,"message":"sent"}',
            200,
          );
        }),
      );

      final pending = await auth.requestSignUpOtp('M@Example.COM');

      expect(pending.email, 'm@example.com');
      expect(requests.last.url.path, '/api/auth/signup');
      expect(requests.last.body, contains('turnstile_token'));
      expect(requests.last.headers['X-CSRF-Token'], 'csrf_123');
    });

    test('verifies OTP, sets password, and persists lb_session', () async {
      final auth = StoreAuthService(
        api: _FakeApiClient(),
        identityBaseUrl: 'https://accounts.test',
        turnstileTokenProvider: () => 'turnstile_token',
        httpClient: MockClient((request) async {
          switch (request.url.path) {
            case '/login':
              return http.Response(
                '',
                200,
                headers: {'set-cookie': 'letbuyy_csrf=csrf_123; Path=/;'},
              );
            case '/api/auth/signup':
              return http.Response(
                '{"success":true,"needsVerification":true}',
                200,
              );
            case '/api/auth/verify-otp':
              return http.Response(
                '{"success":true,"verified":true}',
                200,
                headers: {
                  'set-cookie': 'password_set_intent=intent_1; Path=/;',
                },
              );
            case '/api/auth/set-password':
              return http.Response(
                '{"success":true}',
                200,
                headers: {'set-cookie': 'lb_session=session_123; Path=/;'},
              );
            case '/api/auth/session':
              return http.Response(
                '{"authenticated":true,"user":{"id":"user_1","email":"m@example.com"}}',
                200,
              );
          }
          return http.Response('not found', 404);
        }),
      );

      await auth.requestSignUpOtp('m@example.com');
      final user = await auth.signUp(
        'm@example.com',
        'Password123',
        otp: '123456',
      );
      final storage = const FlutterSecureStorage();

      expect(user?.email, 'm@example.com');
      expect(await storage.read(key: 'lb_session'), 'session_123');
      expect(auth.isSignedIn, isTrue);
    });
  });

  testWidgets('OrderDetailScreen renders customer, totals, and actions', (
    tester,
  ) async {
    final api = _FakeApiClient(json: {'/orders/order_1': _orderJson()});
    final orderService = OrderService(api: api);
    final order = OrderContract.fromJson(_orderJson());

    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: orderService,
        child: MaterialApp(
          home: OrderDetailScreen(orderId: order.id, initialOrder: order),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Customer'), findsOneWidget);
    await tester.drag(find.byType(ListView), const Offset(0, -500));
    await tester.pumpAndSettle();

    expect(find.text('Line items'), findsOneWidget);
    expect(find.text('Cotton Tee'), findsOneWidget);
    expect(find.text('Refund'), findsOneWidget);
  });

  testWidgets('CustomersScreen renders customer list from gateway service', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
        '/customers': [_customerJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => StoreService(api: api)),
          ChangeNotifierProvider(create: (_) => CustomerService(api: api)),
        ],
        child: const MaterialApp(home: CustomersScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Customers'), findsWidgets);
    expect(find.text('Meera Merchant'), findsOneWidget);
    expect(find.text('meera@example.com'), findsOneWidget);
  });

  testWidgets('CustomerDetailScreen renders addresses and recent orders', (
    tester,
  ) async {
    final api = _FakeApiClient(
      json: {
        '/customers/meera%40example.com': _customerJson(),
        '/customers/meera%40example.com/addresses': [_addressJson()],
      },
      paginated: {
        '/orders': [_orderJson()],
      },
    );
    final customer = CustomerContract.fromJson(_customerJson());

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => CustomerService(api: api)),
          ChangeNotifierProvider(create: (_) => OrderService(api: api)),
        ],
        child: MaterialApp(
          home: CustomerDetailScreen(
            email: 'meera@example.com',
            initialCustomer: customer,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Meera Merchant'), findsWidgets);
    expect(find.text('Addresses'), findsOneWidget);
    await tester.drag(find.byType(ListView), const Offset(0, -500));
    await tester.pumpAndSettle();
    expect(find.text('Recent orders'), findsOneWidget);
    expect(find.text('order_1'), findsOneWidget);
  });

  testWidgets('InventoryScreen renders stock levels and low-stock filter', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
        '/inventory/levels': [_inventoryJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => StoreService(api: api)),
          ChangeNotifierProvider(create: (_) => InventoryService(api: api)),
        ],
        child: const MaterialApp(home: InventoryScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Inventory'), findsOneWidget);
    expect(find.text('Cotton Tee'), findsOneWidget);
    expect(find.text('TEE-001'), findsOneWidget);
    expect(find.text('Adjust'), findsOneWidget);
    expect(find.text('Locations'), findsOneWidget);
    expect(find.text('Purchase orders'), findsOneWidget);
  });

  testWidgets('InventoryLocationsScreen renders WMS locations', (tester) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
      },
      json: {
        '/inventory/locations': [_locationJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => StoreService(api: api)),
          ChangeNotifierProvider(create: (_) => InventoryService(api: api)),
        ],
        child: const MaterialApp(home: InventoryLocationsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Locations'), findsOneWidget);
    expect(find.text('North warehouse'), findsOneWidget);
    expect(find.text('Default'), findsOneWidget);
  });

  testWidgets('InventorySuppliersScreen renders supplier contacts', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
      },
      json: {
        '/inventory/suppliers': [_supplierJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => StoreService(api: api)),
          ChangeNotifierProvider(create: (_) => InventoryService(api: api)),
        ],
        child: const MaterialApp(home: InventorySuppliersScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Suppliers'), findsOneWidget);
    expect(find.text('Acme Textiles'), findsOneWidget);
    expect(find.text('riya@example.com'), findsOneWidget);
  });

  testWidgets('PurchaseOrdersScreen renders receive workflow', (tester) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
      },
      json: {
        '/inventory/purchase-orders': [_purchaseOrderJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => StoreService(api: api)),
          ChangeNotifierProvider(create: (_) => InventoryService(api: api)),
        ],
        child: const MaterialApp(home: PurchaseOrdersScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Purchase orders'), findsOneWidget);
    expect(find.text('Acme Textiles'), findsOneWidget);
    expect(find.text('Receive'), findsOneWidget);
  });

  testWidgets('InventoryTransfersScreen renders transfer actions', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
      },
      json: {
        '/inventory/transfers': [_transferJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => StoreService(api: api)),
          ChangeNotifierProvider(create: (_) => InventoryService(api: api)),
        ],
        child: const MaterialApp(home: InventoryTransfersScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Transfers'), findsOneWidget);
    expect(find.text('loc_1 -> loc_2'), findsOneWidget);
    expect(find.text('Ship'), findsOneWidget);
    expect(find.text('Receive'), findsOneWidget);
  });

  testWidgets('CouponsScreen renders coupon list and actions', (tester) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
        '/coupons': [_couponJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => StoreService(api: api)),
          ChangeNotifierProvider(create: (_) => CouponService(api: api)),
        ],
        child: const MaterialApp(home: CouponsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Coupons'), findsWidgets);
    expect(find.text('SAVE10'), findsOneWidget);
    expect(find.text('Active'), findsWidgets);
  });

  testWidgets('CollectionsScreen renders collection merchandising rows', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
      },
      json: {
        '/products/collections': [_collectionJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => StoreService(api: api)),
          ChangeNotifierProvider(create: (_) => ProductService(api: api)),
        ],
        child: const MaterialApp(home: CollectionsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Collections'), findsOneWidget);
    expect(find.text('Summer picks'), findsOneWidget);
    expect(find.text('Seasonal merchandising'), findsOneWidget);
    expect(find.text('6 products'), findsOneWidget);
    expect(find.text('/collections/summer-picks'), findsOneWidget);
    expect(find.text('New collection'), findsOneWidget);
  });

  testWidgets('ProductFormScreen exposes variant matrix controls', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: ProductFormScreen()));

    expect(find.text('Add Product'), findsOneWidget);
    for (var i = 0; i < 3; i++) {
      await tester.tap(find.text('Continue').first, warnIfMissed: false);
      await tester.pumpAndSettle();
    }

    expect(find.text('Variant matrix'), findsOneWidget);
    expect(find.text('Base SKU'), findsOneWidget);
    expect(find.text('Add variant'), findsOneWidget);
  });

  testWidgets('CouponFormScreen renders create form', (tester) async {
    final api = _FakeApiClient(json: {'/coupons': _couponJson()});

    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => CouponService(api: api),
        child: const MaterialApp(home: CouponFormScreen(storeId: 'store_1')),
      ),
    );

    expect(find.text('New coupon'), findsOneWidget);
    expect(find.text('Create coupon'), findsOneWidget);
    expect(find.text('Code'), findsOneWidget);
  });

  testWidgets('NotificationsScreen renders persisted toggles', (tester) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
      },
      json: {'/notifications/preferences': _notificationPreferenceRows()},
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => StoreService(api: api)),
          ChangeNotifierProvider(
            create: (_) => NotificationSettingsService(api: api),
          ),
        ],
        child: const MaterialApp(home: NotificationsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Notifications'), findsOneWidget);
    expect(find.text('Channels'), findsOneWidget);
    expect(find.text('New orders'), findsOneWidget);
    expect(find.text('Low stock'), findsOneWidget);
  });

  testWidgets('StaffScreen renders staff roles and access gates', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
      },
      json: {
        '/employees': [_staffJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => StoreService(api: api)),
          ChangeNotifierProvider(create: (_) => StaffService(api: api)),
        ],
        child: const MaterialApp(home: StaffScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Users & Permissions'), findsOneWidget);
    expect(find.text('riya@example.com'), findsWidgets);
    expect(find.text('Editor'), findsWidgets);
    expect(find.text('Catalog'), findsOneWidget);
    expect(find.text('Invite staff'), findsOneWidget);
  });

  testWidgets('BillingScreen renders subscription and invoices', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
      },
      json: {
        'payments/subscription': {
          'store': {'id': 'store_1', 'trial_status': 'active'},
          'subscription': {
            'id': 'sub_1',
            'plan': 'business',
            'status': 'active',
            'billing_period': 'monthly',
            'current_period_end': '2026-07-01T00:00:00.000Z',
            'amount_paid': 39900,
          },
        },
        '/payments/subscription/history': [_billingHistoryJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => StoreService(api: api)),
          Provider<SubscriptionService>(
            create: (_) => SubscriptionService(api: api),
          ),
        ],
        child: const MaterialApp(home: BillingScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Billing'), findsOneWidget);
    expect(find.text('Business'), findsOneWidget);
    expect(find.text('Invoices'), findsOneWidget);
    expect(find.text('INR 399.00'), findsWidgets);
    expect(find.text('Manage plan'), findsOneWidget);
  });

  testWidgets('ReviewsScreen renders review moderation actions', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
        '/reviews': [_reviewJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => StoreService(api: api)),
          ChangeNotifierProvider(create: (_) => ReviewService(api: api)),
        ],
        child: const MaterialApp(home: ReviewsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Reviews'), findsOneWidget);
    expect(find.text('Cotton Tee'), findsOneWidget);
    expect(find.text('Meera Merchant - meera@example.com'), findsOneWidget);
    expect(find.text('Great quality'), findsOneWidget);
    expect(find.text('Approve'), findsOneWidget);
    expect(find.text('Reply'), findsOneWidget);
    expect(find.text('Delete'), findsOneWidget);
  });

  testWidgets('PagesScreen renders CMS pages from gateway service', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
        '/pages': [_pageJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => StoreService(api: api)),
          ChangeNotifierProvider(create: (_) => CmsService(api: api)),
        ],
        child: const MaterialApp(home: PagesScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Pages'), findsOneWidget);
    expect(find.text('About us'), findsOneWidget);
    expect(find.text('/about-us'), findsOneWidget);
    expect(find.text('Published'), findsWidgets);
    expect(find.text('New page'), findsOneWidget);
  });

  testWidgets('PageEditorScreen renders create form fields', (tester) async {
    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => CmsService(api: _FakeApiClient()),
        child: const MaterialApp(home: PageEditorScreen(storeId: 'store_1')),
      ),
    );

    expect(find.text('New page'), findsOneWidget);
    expect(find.text('Title'), findsOneWidget);
    expect(find.text('Body'), findsOneWidget);
    expect(find.byIcon(Icons.check_rounded), findsOneWidget);
  });

  testWidgets('BlogScreen renders posts from gateway service', (tester) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
        '/blog/posts': [_blogPostJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => StoreService(api: api)),
          ChangeNotifierProvider(create: (_) => CmsService(api: api)),
        ],
        child: const MaterialApp(home: BlogScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Blog'), findsOneWidget);
    expect(find.text('Launch update'), findsOneWidget);
    expect(find.text('/blog/launch-update'), findsOneWidget);
    expect(find.text('Published'), findsWidgets);
    expect(find.text('New post'), findsOneWidget);
  });

  testWidgets('PostEditorScreen renders create form fields', (tester) async {
    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => CmsService(api: _FakeApiClient()),
        child: const MaterialApp(home: PostEditorScreen(storeId: 'store_1')),
      ),
    );

    expect(find.text('New post'), findsOneWidget);
    expect(find.text('Title'), findsOneWidget);
    expect(find.text('Content'), findsOneWidget);
    expect(find.byIcon(Icons.check_rounded), findsOneWidget);
  });

  testWidgets('NavigationScreen renders draggable menu items', (tester) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
      },
      json: {
        '/pages/navigation': {
          'menu': _navigationMenuJson(),
          'items': [_navigationItemJson()],
        },
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => StoreService(api: api)),
          ChangeNotifierProvider(create: (_) => CmsService(api: api)),
        ],
        child: const MaterialApp(home: NavigationScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Navigation'), findsOneWidget);
    expect(find.text('Header'), findsWidgets);
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('/'), findsOneWidget);
    expect(find.text('Add item'), findsOneWidget);
    expect(find.text('Save menu'), findsOneWidget);
    expect(find.byIcon(Icons.drag_indicator_rounded), findsOneWidget);
  });

  testWidgets('MediaLibraryScreen renders media assets from gateway service', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
        '/media': [
          _mediaJson(
            filename: 'lookbook.pdf',
            originalName: 'Lookbook.pdf',
            mediaType: 'document',
            mimeType: 'application/pdf',
          ),
        ],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => StoreService(api: api)),
          ChangeNotifierProvider(create: (_) => MediaService(api: api)),
        ],
        child: const MaterialApp(home: MediaLibraryScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Media library'), findsOneWidget);
    expect(find.text('Lookbook.pdf'), findsOneWidget);
    expect(find.text('Document • 2.0 KB'), findsOneWidget);
    expect(find.text('Upload'), findsOneWidget);
    expect(find.text('Search media'), findsOneWidget);
  });

  testWidgets('ShippingScreen renders zones and rates from gateway service', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
      },
      json: {
        '/shipping-tax/shipping/zones': [_shippingZoneJson()],
        '/shipping-tax/shipping': [_shippingRateJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => StoreService(api: api)),
          ChangeNotifierProvider(create: (_) => ShippingTaxService(api: api)),
        ],
        child: const MaterialApp(home: ShippingScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Shipping'), findsOneWidget);
    expect(find.text('Domestic'), findsOneWidget);
    expect(find.text('IN'), findsOneWidget);
    expect(find.text('1 rates'), findsOneWidget);

    await tester.tap(find.text('Rates'));
    await tester.pumpAndSettle();
    expect(find.text('Standard'), findsOneWidget);
    expect(find.text('₹49'), findsOneWidget);
  });

  testWidgets('TaxesScreen renders inclusive setting and tax rates', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson(taxInclusive: true)],
      },
      json: {
        '/shipping-tax/taxes': [_taxRateJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => StoreService(api: api)),
          ChangeNotifierProvider(create: (_) => ShippingTaxService(api: api)),
        ],
        child: const MaterialApp(home: TaxesScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Taxes / GST'), findsOneWidget);
    expect(find.text('All prices include tax'), findsOneWidget);
    expect(find.text('GST'), findsOneWidget);
    expect(find.text('18%'), findsOneWidget);
    expect(find.text('HSN 6204'), findsOneWidget);
    expect(find.text('New tax'), findsOneWidget);
  });

  testWidgets('DomainSettingsScreen renders DNS guidance', (tester) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [
          _storeJson(
            customDomain: 'shop.example.com',
            customDomainStatus: 'pending',
            sslActive: false,
            dnsConfig: {'CNAME': DomainService.cnameTarget},
          ),
        ],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => StoreService(api: api)),
          ChangeNotifierProvider(create: (_) => DomainService(api: api)),
        ],
        child: const MaterialApp(home: DomainSettingsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Domain settings'), findsOneWidget);
    expect(find.text('demo.letbuyy.store'), findsOneWidget);
    expect(find.text('shop.example.com'), findsWidgets);
    expect(find.text('Save domain'), findsOneWidget);
    await tester.drag(find.byType(ListView), const Offset(0, -500));
    await tester.pumpAndSettle();

    expect(find.text('CNAME'), findsOneWidget);
    expect(find.text(DomainService.cnameTarget), findsOneWidget);
    expect(find.text('Email DNS records'), findsOneWidget);
  });

  testWidgets('ThemeVersionsScreen renders releases for rollback', (
    tester,
  ) async {
    final api = _FakeApiClient(
      json: {
        '/themes/modern/releases': [_themeReleaseJson()],
      },
    );

    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => ThemeService(api: api),
        child: const MaterialApp(
          home: ThemeVersionsScreen(
            storeId: 'store_1',
            themeSlug: 'modern',
            themeName: 'Modern',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Theme versions'), findsOneWidget);
    expect(find.text('Version 3'), findsOneWidget);
    expect(find.text('Published'), findsOneWidget);
    expect(find.text('Roll back'), findsOneWidget);
  });
}

class _FakeApiClient extends ApiClient {
  _FakeApiClient({
    Map<String, dynamic> json = const {},
    Map<String, dynamic> raw = const {},
    Map<String, List<Map<String, dynamic>>> paginated = const {},
  }) : _json = json,
       _raw = raw,
       _paginated = paginated,
       super(baseUrl: 'https://gateway.test/v1', maxRetries: 0);

  final Map<String, dynamic> _json;
  final Map<String, dynamic> _raw;
  final Map<String, List<Map<String, dynamic>>> _paginated;
  final List<String> paths = [];
  final Map<String, Object?> bodies = {};

  @override
  Future<dynamic> request(String path, {ApiRequestOptions? options}) async {
    paths.add(path);
    _captureBody(path, options);
    return _raw[path] ?? {'success': true, 'data': _json[path] ?? {}};
  }

  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    paths.add(path);
    _captureBody(path, options);
    final value = _json[path] ?? {};
    if (value is List && value.isNotEmpty) {
      return Map<String, dynamic>.from(value.first as Map);
    }
    return Map<String, dynamic>.from(value as Map);
  }

  @override
  Future<T> requestData<T>(
    String path, {
    ApiRequestOptions? options,
    required JsonDecoder<T> decoder,
  }) async {
    paths.add(path);
    _captureBody(path, options);
    return decoder(_json[path]);
  }

  @override
  Future<PaginatedResponse<JsonMap>> requestPaginatedJson(
    String path, {
    ApiRequestOptions? options,
  }) async {
    paths.add(path);
    _captureBody(path, options);
    final rows = _paginated[path] ?? const <Map<String, dynamic>>[];
    return PaginatedResponse<JsonMap>(
      data: rows,
      total: rows.length,
      page: 1,
      limit: rows.length,
      hasMore: false,
    );
  }

  void _captureBody(String path, ApiRequestOptions? options) {
    if (options?.body != null) bodies[path] = options!.body;
  }
}

Map<String, dynamic> _storeJson({
  bool taxInclusive = false,
  String? customDomain,
  String? customDomainStatus,
  bool sslActive = false,
  Map<String, dynamic>? dnsConfig,
}) => {
  'id': 'store_1',
  'seller_id': 'seller_1',
  'name': 'Demo Store',
  'tagline': 'Demo',
  'subdomain': 'demo',
  'store_url': 'https://demo.letbuyy.store',
  'theme_id': 'modern',
  'tax_inclusive': taxInclusive,
  'custom_domain': customDomain,
  'custom_domain_status': customDomainStatus,
  'ssl_active': sslActive,
  'dns_config': dnsConfig ?? const {},
  'created_at': '2026-06-01T00:00:00.000Z',
  'updated_at': '2026-06-01T00:00:00.000Z',
};

Map<String, dynamic> _productJson({List<Map<String, dynamic>>? variants}) => {
  'id': 'prod_1',
  'store_id': 'store_1',
  'name': 'Cotton Tee',
  'slug': 'cotton-tee',
  'price': 499,
  'currency': 'INR',
  'stock': 8,
  'is_active': true,
  'variants': variants ?? const [],
};

Map<String, dynamic> _variantJson() => {
  'title': 'XL',
  'sku': 'TEE-XL',
  'price': 599,
  'compare_price': 699,
  'stock': 4,
  'inventory_quantity': 4,
  'options': {'Size': 'XL'},
};

Map<String, dynamic> _collectionJson({
  String id = 'collection_1',
  String title = 'Summer picks',
  bool isActive = true,
}) => {
  'id': id,
  'store_id': 'store_1',
  'title': title,
  'description': 'Seasonal merchandising',
  'image_url': null,
  'handle': 'summer-picks',
  'is_active': isActive,
  'product_count': 6,
  'created_at': '2026-06-01T10:00:00.000Z',
  'updated_at': '2026-06-01T10:30:00.000Z',
};

Map<String, dynamic> _customerJson() => {
  'id': 'customer_1',
  'store_id': 'store_1',
  'email': 'meera@example.com',
  'phone': '+919999999999',
  'first_name': 'Meera',
  'last_name': 'Merchant',
  'display_name': 'Meera Merchant',
  'status': 'active',
  'accepts_marketing': true,
  'order_count': 1,
  'total_spent': 499,
  'last_order_at': '2026-06-01T10:00:00.000Z',
  'addresses': [_addressJson()],
};

Map<String, dynamic> _addressJson() => {
  'id': 'address_1',
  'store_id': 'store_1',
  'customer_id': 'customer_1',
  'full_name': 'Meera Merchant',
  'phone': '+919999999999',
  'address_line1': '12 Market Road',
  'address_line2': '',
  'city': 'Bengaluru',
  'state': 'Karnataka',
  'postal_code': '560001',
  'country': 'IN',
  'label': 'Home',
  'is_default': true,
};

Map<String, dynamic> _inventoryJson({int available = 10}) => {
  'id': 'inventory_1',
  'store_id': 'store_1',
  'product_id': 'prod_1',
  'variant_id': 'variant_1',
  'sku': 'TEE-001',
  'product_name': 'Cotton Tee',
  'location_id': 'main',
  'available': available,
  'reserved': 1,
  'committed': 2,
  'on_hand': available + 3,
};

Map<String, dynamic> _locationJson() => {
  'id': 'loc_1',
  'store_id': 'store_1',
  'name': 'North warehouse',
  'address': '12 Industrial Road',
  'city': 'Delhi',
  'state': 'Delhi',
  'country': 'IN',
  'is_default': true,
  'status': 'active',
};

Map<String, dynamic> _supplierJson() => {
  'id': 'supplier_1',
  'site_id': 'store_1',
  'name': 'Acme Textiles',
  'contact_name': 'Riya',
  'email': 'riya@example.com',
  'phone': '+911111111111',
  'address': {'line1': 'Supplier lane'},
};

Map<String, dynamic> _purchaseOrderJson({
  String status = 'ordered',
  int receivedQuantity = 0,
}) => {
  'id': 'po_1',
  'site_id': 'store_1',
  'supplier_id': 'supplier_1',
  'supplier': {'name': 'Acme Textiles'},
  'location_id': 'loc_1',
  'status': status,
  'expected_at': '2026-06-15T10:00:00.000Z',
  'notes': 'Restock cotton tee',
  'lines': [
    {
      'id': 'po_line_1',
      'product_id': 'prod_1',
      'variant_id': 'variant_1',
      'sku': 'TEE-001',
      'product_name': 'Cotton Tee',
      'quantity': 4,
      'received_quantity': receivedQuantity,
      'unit_cost': 299,
    },
  ],
};

Map<String, dynamic> _transferJson({
  String status = 'reserved',
  int receivedQuantity = 0,
}) => {
  'id': 'transfer_1',
  'site_id': 'store_1',
  'source_location_id': 'loc_1',
  'destination_location_id': 'loc_2',
  'status': status,
  'notes': 'Balance stock',
  'lines': [
    {
      'id': 'transfer_line_1',
      'product_id': 'prod_1',
      'variant_id': 'variant_1',
      'sku': 'TEE-001',
      'product_name': 'Cotton Tee',
      'quantity': 3,
      'received_quantity': receivedQuantity,
    },
  ],
};

Map<String, dynamic> _couponJson({
  String id = 'coupon_1',
  String code = 'SAVE10',
  bool isActive = true,
}) => {
  'id': id,
  'store_id': 'store_1',
  'code': code,
  'description': 'Launch campaign',
  'type': 'percentage',
  'value': 10,
  'currency': 'INR',
  'minimum_order_amount': 500,
  'maximum_discount': 200,
  'usage_limit': 100,
  'used_count': 3,
  'per_customer_limit': 1,
  'expires_at': '2026-12-31T23:59:59.000Z',
  'is_active': isActive,
};

Map<String, dynamic> _pageJson({
  String id = 'page_1',
  String title = 'About us',
  String status = 'published',
}) => {
  'id': id,
  'store_id': 'store_1',
  'title': title,
  'slug': 'about-us',
  'body': 'We build storefronts from a phone.',
  'content': {'body': 'We build storefronts from a phone.'},
  'page_type': 'custom',
  'status': status,
  'show_in_nav': true,
  'display_order': 0,
  'seo_title': title,
  'seo_description': 'Mobile storefront content',
  'published_at': '2026-06-01T10:00:00.000Z',
  'updated_at': '2026-06-01T10:30:00.000Z',
};

Map<String, dynamic> _blogPostJson({
  String id = 'post_1',
  String postTitle = 'Launch update',
  String status = 'published',
}) => {
  'id': id,
  'store_id': 'store_1',
  'title': postTitle,
  'slug': 'launch-update',
  'excerpt': 'New mobile-first store operations.',
  'content': 'Run your whole commerce workflow from a phone.',
  'status': status,
  'allow_comments': true,
  'is_featured': true,
  'is_pinned': false,
  'reading_time_min': 3,
  'seo_title': postTitle,
  'seo_description': 'Mobile commerce update',
  'published_at': '2026-06-01T10:00:00.000Z',
  'updated_at': '2026-06-01T10:30:00.000Z',
};

Map<String, dynamic> _blogCommentJson({
  String id = 'comment_1',
  String status = 'pending',
}) => {
  'id': id,
  'store_id': 'store_1',
  'post_id': 'post_1',
  'post_title': 'Launch update',
  'author_name': 'Meera Merchant',
  'email': 'meera@example.com',
  'body': 'This update is useful.',
  'status': status,
  'created_at': '2026-06-01T11:00:00.000Z',
};

Map<String, dynamic> _navigationMenuJson() => {
  'id': 'menu_1',
  'store_id': 'store_1',
  'handle': 'main',
  'location': 'main',
  'name': 'Header menu',
};

Map<String, dynamic> _navigationItemJson({
  String id = 'nav_1',
  String label = 'Home',
  String url = '/',
  int sortOrder = 0,
}) => {
  'id': id,
  'menu_id': 'menu_1',
  'store_id': 'store_1',
  'label': label,
  'url': url,
  'target_type': 'url',
  'target_resource_id': null,
  'parent_item_id': null,
  'sort_order': sortOrder,
  'is_visible': true,
  'open_in_new_tab': false,
  'updated_at': '2026-06-01T11:00:00.000Z',
};

Map<String, dynamic> _mediaJson({
  String id = 'media_1',
  String filename = 'hero.jpg',
  String originalName = 'Hero image',
  String mediaType = 'image',
  String mimeType = 'image/jpeg',
  String? altText = 'Homepage hero',
}) => {
  'id': id,
  'store_id': 'store_1',
  'uploaded_by': 'user_1',
  'filename': filename,
  'original_name': originalName,
  'url': 'https://cdn.test/media/store_1/$filename',
  'thumbnail_url': null,
  'mime_type': mimeType,
  'size_bytes': 2048,
  'width': mediaType == 'image' ? 1200 : null,
  'height': mediaType == 'image' ? 800 : null,
  'alt_text': altText,
  'caption': 'Launch asset',
  'folder': 'media',
  'media_type': mediaType,
  'tags': ['hero', 'launch'],
  'usage_count': 1,
  'storage_key': 'media/store_1/hero.png',
  'created_at': '2026-06-01T11:00:00.000Z',
  'updated_at': '2026-06-01T11:00:00.000Z',
};

Map<String, dynamic> _uploadJson() => {
  'url': 'https://cdn.test/media/store_1/hero.png',
  'key': 'media/store_1/hero.png',
  'size': 2,
  'content_type': 'image/png',
};

Map<String, dynamic> _shippingZoneJson({
  String id = 'zone_1',
  String name = 'Domestic',
}) => {
  'id': id,
  'store_id': 'store_1',
  'name': name,
  'countries': ['IN'],
  'states': ['Karnataka'],
  'zip_codes': ['560001'],
  'created_at': '2026-06-01T11:00:00.000Z',
  'updated_at': '2026-06-01T11:00:00.000Z',
};

Map<String, dynamic> _shippingRateJson({
  String id = 'rate_1',
  String name = 'Standard',
  double price = 49,
}) => {
  'id': id,
  'zone_id': 'zone_1',
  'name': name,
  'type': 'flat',
  'price': price,
  'min_order_amount': 0,
  'max_order_amount': null,
  'estimated_days_min': 2,
  'estimated_days_max': 5,
  'is_active': true,
  'created_at': '2026-06-01T11:00:00.000Z',
  'updated_at': '2026-06-01T11:00:00.000Z',
};

Map<String, dynamic> _taxRateJson({
  String id = 'tax_1',
  String name = 'GST',
  double rate = 18,
}) => {
  'id': id,
  'store_id': 'store_1',
  'name': name,
  'rate': rate,
  'country': 'IN',
  'state': 'Karnataka',
  'hsn_code': '6204',
  'applies_to': 'all',
  'is_compound': false,
  'is_shipping': false,
  'priority': 0,
  'is_active': true,
  'created_at': '2026-06-01T11:00:00.000Z',
  'updated_at': '2026-06-01T11:00:00.000Z',
};

Map<String, dynamic> _staffJson({
  String id = 'staff_1',
  String email = 'riya@example.com',
  String role = 'editor',
  String status = 'active',
}) => {
  'id': id,
  'store_id': 'store_1',
  'email': email,
  'full_name': 'Riya Staff',
  'role': role,
  'status': status,
  'is_active': status != 'removed',
  'created_at': '2026-06-01T11:00:00.000Z',
};

Map<String, dynamic> _staffInviteJson() => {
  'id': 'invite_1',
  'store_id': 'store_1',
  'email': 'arjun@example.com',
  'role': 'support',
  'status': 'pending',
  'token': 'invite-token',
  'expires_at': '2026-06-08T11:00:00.000Z',
};

Map<String, dynamic> _reviewJson({
  String id = 'review_1',
  String status = 'pending',
}) => {
  'id': id,
  'store_id': 'store_1',
  'product_id': 'prod_1',
  'product_name': 'Cotton Tee',
  'customer_name': 'Meera Merchant',
  'customer_email': 'meera@example.com',
  'rating': 5,
  'title': 'Great quality',
  'body': 'The fabric feels premium and shipped quickly.',
  'status': status,
  'is_approved': status == 'approved',
  'is_verified': true,
  'helpful_count': 2,
  'created_at': '2026-06-01T11:00:00.000Z',
};

Map<String, dynamic> _billingHistoryJson() => {
  'id': 'sub_1',
  'amount_paid': 39900,
  'status': 'active',
  'billing_period': 'monthly',
  'created_at': '2026-06-01T11:00:00.000Z',
};

Map<String, dynamic> _themeReleaseJson() => {
  'id': 'release_1',
  'release_version': 3,
  'release_status': 'published',
  'published_at': '2026-06-01T10:00:00.000Z',
  'release_manifest': {'message': 'Homepage and checkout polish'},
};

List<Map<String, dynamic>> _notificationPreferenceRows() => [
  {
    'store_id': 'store_1',
    'channel': 'email',
    'category': 'system',
    'enabled': true,
  },
  {
    'store_id': 'store_1',
    'channel': 'sms',
    'category': 'system',
    'enabled': false,
  },
  {
    'store_id': 'store_1',
    'channel': 'push',
    'category': 'system',
    'enabled': true,
  },
  {
    'store_id': 'store_1',
    'channel': 'push',
    'category': 'order_created',
    'enabled': true,
  },
  {
    'store_id': 'store_1',
    'channel': 'push',
    'category': 'low_stock',
    'enabled': true,
  },
];

Map<String, dynamic> _orderJson({
  String id = 'order_1',
  String status = 'paid',
}) => {
  'id': id,
  'store_id': 'store_1',
  'order_number': id,
  'customer_name': 'Meera Merchant',
  'customer_email': 'meera@example.com',
  'customer_phone': '+919999999999',
  'status': status,
  'payment_status': 'paid',
  'fulfillment_status': 'unfulfilled',
  'currency': 'INR',
  'subtotal': 499,
  'discount_amount': 0,
  'shipping_amount': 0,
  'tax_amount': 0,
  'total': 499,
  'created_at': '2026-06-01T10:00:00.000Z',
  'updated_at': '2026-06-01T10:30:00.000Z',
  'shipping_address': const {
    'name': 'Meera Merchant',
    'line1': '12 Market Road',
    'city': 'Bengaluru',
    'state': 'Karnataka',
    'postal_code': '560001',
    'country': 'IN',
  },
  'billing_address': const {
    'name': 'Meera Merchant',
    'line1': '12 Market Road',
    'city': 'Bengaluru',
    'state': 'Karnataka',
    'postal_code': '560001',
    'country': 'IN',
  },
  'line_items': const [
    {
      'id': 'line_1',
      'name': 'Cotton Tee',
      'sku': 'TEE-001',
      'quantity': 1,
      'unit_price': 499,
      'total': 499,
      'currency': 'INR',
    },
  ],
};
