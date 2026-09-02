import 'generated_api_routes.dart';

final class ApiRoutes {
  const ApiRoutes._();

  static const allTemplates = generatedApiRouteTemplates;

  static const health = '/health';
  static const authOtp = '/v1/auth/otp';
  static const authOtpVerify = '/v1/auth/otp/verify';
  static const authRefresh = '/v1/auth/refresh';
  static const me = '/v1/me';
  static const categories = '/v1/catalog/categories';
  static const homeFeed = '/v1/catalog/home-feed';
  static const search = '/v1/catalog/search';
  static const product = '/v1/catalog/products';
  static const recentViews = '/v1/catalog/recent-views';
  static const serviceabilityZones = '/v1/serviceability/public-zones';
  static const addresses = '/v1/addresses';
  static const addressServiceability = '/v1/addresses/serviceability';
  static const cart = '/v1/cart';
  static const cartItems = '/v1/cart/items';
  static const checkoutQuote = '/v1/checkout/quote';
  static const paymentIntents = '/v1/payments/intents';
  static const paymentCreateOrder = '/v1/payments/create-order';
  static const orders = '/v1/orders';
  static const wallet = '/v1/wallet';
  static const notifications = '/v1/notifications';
  static const notificationToken = '/v1/notifications/register-token';
  static const riderProfile = '/v1/rider/profile';
  static const riderStatus = '/v1/rider/status';
  static const riderAvailability = '/v1/rider/availability';
  static const riderHeartbeat = '/v1/rider/heartbeat';
  static const riderEarnings = '/v1/rider/earnings';
  static const riderDeliveries = '/v1/rider/deliveries';
  static const storeQueue = '/v1/store/queue';
  static const storeInventory = '/v1/store/inventory';
  static const storeInventoryAdjust = '/v1/store/inventory/adjust';
  static const sellerProfile = '/v1/seller/profile';
  static const sellerOnboarding = '/v1/seller/onboarding';
  static const sellerCatalogProducts = '/v1/seller/catalog/products';
  static const sellerOrders = '/v1/seller/orders';
  static const sellerPayouts = '/v1/seller/payouts';
  static const sellerAnalytics = '/v1/seller/analytics';
  static const operationsSummary = '/v1/ops/summary';
  static const operationsDispatchControl = '/v1/ops/dispatch/control';

  static String productById(String productId) => '$product/$productId';
  static String recentViewProduct(String productId) =>
      '$recentViews/$productId';
  static String addressById(String addressId) => '$addresses/$addressId';
  static String cartItemByProduct(String productId) => '$cartItems/$productId';
  static String orderById(String orderId) => '$orders/$orderId';
  static String cancelOrder(String orderId) => '$orders/$orderId/cancel';
  static String deliveryTransition(String deliveryId) =>
      '/v1/delivery/$deliveryId/transition';
  static String riderDeliveryAccept(String deliveryId) =>
      '$riderDeliveries/$deliveryId/accept';
  static String riderDeliveryStatus(String deliveryId) =>
      '$riderDeliveries/$deliveryId/status';
  static String riderDeliveryProof(String deliveryId) =>
      '$riderDeliveries/$deliveryId/proof';
  static String storeOrderPicklist(String orderId) =>
      '/v1/store/orders/$orderId/picklist';
  static String storeOrderPick(String orderId) =>
      '/v1/store/orders/$orderId/pick';
  static String storeOrderPack(String orderId) =>
      '/v1/store/orders/$orderId/pack';
  static String storeOrderItemConfirm(String orderId, String itemId) =>
      '/v1/store/orders/$orderId/items/$itemId/confirm';
  static String storeOrderReady(String orderId) =>
      '/v1/store/orders/$orderId/ready';
  static String sellerCatalogProduct(String productId) =>
      '$sellerCatalogProducts/$productId';
  static String adminSellerApprove(String sellerId) =>
      '/v1/admin/sellers/$sellerId/approve';
}
