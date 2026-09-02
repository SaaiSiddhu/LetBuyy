import 'package:quickcommerce_core/quickcommerce_core.dart' as core;

abstract interface class IAuthRepository {
  Future<void> signIn({required String phone});
  Future<core.UserProfile> signUp({
    required String phone,
    required String fullName,
    String? email,
  });
  Future<core.UserProfile> verifyOtp({
    required String phone,
    required String token,
  });
  Future<void> signOut();
  Future<core.UserProfile?> currentUser();
}

abstract interface class ICatalogRepository {
  Future<Map<String, dynamic>> getHomeFeed({String? storeId});
  Future<List<core.Category>> getCategories();
  Future<List<core.Product>> getProducts({
    String? storeId,
    String? categoryId,
    int limit = 20,
    String? cursor,
  });
  Future<List<core.Product>> searchProducts({
    required String query,
    String? storeId,
    String? categoryId,
    int limit = 20,
  });
}

abstract interface class ICartRepository {
  Future<core.Cart> getCart();
  Future<core.Cart> addItem({
    required String productId,
    required String variantId,
    required int quantity,
  });
  Future<core.Cart> removeItem({required String productId});
  Future<core.Cart> updateQuantity({
    required String productId,
    required int quantity,
  });
  Future<void> clearCart();
}

abstract interface class IOrderRepository {
  Future<core.Order> placeOrder(Map<String, dynamic> payload);
  Future<List<core.Order>> getOrders({int limit = 20, String? cursor});
  Future<core.Order> getOrderById(String orderId);
  Future<core.Order> cancelOrder({
    required String orderId,
    required String reason,
  });
}

abstract interface class IAddressRepository {
  Future<List<core.Address>> getAddresses();
  Future<core.Address> addAddress(core.Address address);
  Future<void> setDefault(String addressId);
  Future<void> delete(String addressId);
}

abstract interface class IWalletRepository {
  Future<core.WalletAccount> getBalance();
  Future<List<core.WalletEntry>> getTransactions({
    int limit = 20,
    String? cursor,
  });
}

abstract interface class IRiderRepository {
  Future<core.RiderProfile> getStatus();
  Future<void> setOnline({double? latitude, double? longitude});
  Future<void> setOffline();
  Future<List<core.DeliveryInfo>> getAvailableOrders();
  Future<core.DeliveryInfo> acceptOrder(String deliveryId);
  Future<core.DeliveryInfo> updateDeliveryStatus({
    required String deliveryId,
    required String status,
    int? expectedVersion,
  });
  Future<Uri> uploadProof({
    required String deliveryId,
    required String contentType,
  });
}

abstract interface class IStoreOpsRepository {
  Future<List<core.Order>> getOrderQueue({String? storeId});
  Future<List<core.OrderItem>> getPickList(String orderId);
  Future<core.OrderItem> confirmPick({
    required String orderId,
    required String itemId,
    required int quantity,
  });
  Future<void> updateInventory({
    required String storeId,
    required String variantId,
    required int delta,
    required String reason,
  });
}
