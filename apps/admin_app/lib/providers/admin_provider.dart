import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_core/letbuyy_marketplace_core.dart';

class AdminProvider with ChangeNotifier {
  final AdminService _adminService = AdminService();
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  SharedPreferences? _prefs;

  // DASHBOARD STATS
  Map<String, dynamic> _dashboardStats = {
    'products': 0,
    'orders': 0,
    'users': 0,
    'revenue': 0.0,
  };
  Map<String, dynamic> get dashboardStats => _dashboardStats;

  // LOADING STATE
  bool _isLoading = false;
  bool get isLoading => _isLoading;

  // PRODUCTS
  List<ProductModel> _products = [];
  List<ProductModel> get products => _products;
  bool _isLoadingProducts = false;
  bool get isLoadingProducts => _isLoadingProducts;

  // ORDERS
  List<OrderModel> _orders = [];
  List<OrderModel> get orders => _orders;

  // USERS
  List<Map<String, dynamic>> _users = [];
  List<Map<String, dynamic>> get users => _users;

  // SELLERS
  List<Map<String, dynamic>> _sellers = [];
  List<Map<String, dynamic>> get sellers => _sellers;
  bool _isLoadingSellers = false;
  bool get isLoadingSellers => _isLoadingSellers;

  // CATEGORIES
  List<Map<String, dynamic>> _categories = [];
  List<Map<String, dynamic>> get categories => _categories;
  bool _isLoadingCategories = false;
  bool get isLoadingCategories => _isLoadingCategories;

  // COUPONS
  List<Map<String, dynamic>> _coupons = [];
  List<Map<String, dynamic>> get coupons => _coupons;

  // CONSTRUCTOR
  AdminProvider() {
    _initializePreferences();
  }

  Future<void> _initializePreferences() async {
    try {
      _prefs = await SharedPreferences.getInstance();
      debugPrint('✅ AdminProvider SharedPreferences initialized');
    } catch (e) {
      debugPrint('⚠️ Error initializing preferences: $e');
    }
  }

  // DASHBOARD

  Future<void> loadDashboardStats() async {
    try {
      _dashboardStats = await _adminService.getDashboardStats();
      notifyListeners();
    } catch (e) {
      debugPrint('Error loading dashboard stats: $e');
    }
  }

  // PRODUCTS

  void listenToProducts() {
    _isLoadingProducts = true;
    notifyListeners();
    _adminService.getProducts().listen((products) {
      _products = products;
      _isLoadingProducts = false;
      notifyListeners();
    });
  }

  Future<void> addProduct(ProductModel product) async {
    try {
      _isLoadingProducts = true;
      notifyListeners();
      await _adminService.addProduct(product);
      _isLoadingProducts = false;
      notifyListeners();
    } catch (e) {
      _isLoadingProducts = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> updateProduct(String productId, ProductModel product) async {
    try {
      await _adminService.updateProduct(productId, product);
    } catch (e) {
      rethrow;
    }
  }

  Future<void> deleteProduct(String productId) async {
    try {
      await _adminService.deleteProduct(productId);
    } catch (e) {
      rethrow;
    }
  }

  Future<void> deleteProducts(List<String> productIds) async {
    try {
      for (final productId in productIds) {
        await _adminService.deleteProduct(productId);
      }
    } catch (e) {
      rethrow;
    }
  }

  Future<void> updateProductStatus(String productId, bool isActive) async {
    try {
      final product = _products.firstWhere((p) => p.id == productId);
      final updatedProduct = product.copyWith(
        isActive: isActive,
        updatedAt: DateTime.now(),
      );
      await _adminService.updateProduct(productId, updatedProduct);
    } catch (e) {
      debugPrint('Error updating product status: $e');
      rethrow;
    }
  }

  Future<void> bulkUpdateProductStatus(List<String> productIds, bool isActive) async {
    try {
      for (final productId in productIds) {
        final product = _products.firstWhere((p) => p.id == productId);
        final updatedProduct = product.copyWith(
          isActive: isActive,
          updatedAt: DateTime.now(),
        );
        await _adminService.updateProduct(productId, updatedProduct);
      }
    } catch (e) {
      debugPrint('Error bulk updating product status: $e');
      rethrow;
    }
  }

  // ORDERS

  void listenToOrders() {
    _adminService.getOrders().listen((orders) {
      _orders = orders;
      notifyListeners();
    });
  }

  Future<void> updateOrderStatus(String orderId, String status) async {
    try {
      await _adminService.updateOrderStatus(orderId, status);
    } catch (e) {
      rethrow;
    }
  }

  // USERS

  Future<void> listenToUsers() async {
    try {
      _isLoading = true;
      notifyListeners();
      _adminService.getUsers().listen((users) {
        _users = users;
        _isLoading = false;
        notifyListeners();
      });
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      debugPrint('Error listening to users: $e');
      rethrow;
    }
  }

  Future<void> updateUserRole(String userId, String role) async {
    try {
      await _adminService.updateUserRole(userId, role);
    } catch (e) {
      rethrow;
    }
  }

  Future<void> toggleUserStatus(String userId, bool isActive) async {
    try {
      await _adminService.toggleUserStatus(userId, isActive);
    } catch (e) {
      rethrow;
    }
  }

  Future<void> deleteUser(String userId) async {
    try {
      await _adminService.deleteUser(userId);
    } catch (e) {
      rethrow;
    }
  }

  Future<void> updateUserInfo(String userId, Map<String, dynamic> data) async {
    try {
      await _adminService.updateUserInfo(userId, data);
    } catch (e) {
      rethrow;
    }
  }

  // SELLERS

  Future<void> listenToSellers() async {
    try {
      _isLoadingSellers = true;
      notifyListeners();
      _firestore.collection('sellers').snapshots().listen((snapshot) {
        _sellers = snapshot.docs
            .map((doc) => {'id': doc.id, ...doc.data()})
            .toList();
        _isLoadingSellers = false;
        notifyListeners();
      });
      debugPrint('✅ Listening to sellers');
    } catch (e) {
      _isLoadingSellers = false;
      notifyListeners();
      debugPrint('❌ Error listening to sellers: $e');
      rethrow;
    }
  }

  // Updated to handle optional isActive boolean for seller active status update
  Future<void> updateSellerVerification(
    String sellerId,
    VerificationStatus status, {
    bool? isActive,
  }) async {
    try {
      debugPrint('📝 Updating seller verification: $sellerId to $status, isActive: $isActive');
      final dataToUpdate = <String, dynamic>{
        'verificationStatus': status.toString().split('.').last,
      };
      if (isActive != null) {
        dataToUpdate['isActive'] = isActive;
      }
      if (status == VerificationStatus.verified) {
        dataToUpdate['verifiedAt'] = FieldValue.serverTimestamp();
        dataToUpdate.remove('rejectionReason'); // Clear rejection on verify
      } else if (status == VerificationStatus.rejected) {
        dataToUpdate['rejectedAt'] = FieldValue.serverTimestamp();
      }
      await _firestore.collection('sellers').doc(sellerId).update(dataToUpdate);
      debugPrint('✅ Seller verification updated: $sellerId');
      notifyListeners();
    } catch (e) {
      debugPrint('❌ Error updating seller verification: $e');
      throw Exception('Failed to update seller verification');
    }
  }

  Future<void> rejectSeller(String sellerId, String reason) async {
    try {
      debugPrint('❌ Rejecting seller: $sellerId with reason: $reason');
      await _firestore.collection('sellers').doc(sellerId).update({
        'verificationStatus': 'rejected',
        'rejectionReason': reason,
        'rejectedAt': FieldValue.serverTimestamp(),
      });
      debugPrint('✅ Seller rejected: $sellerId');
      notifyListeners();
    } catch (e) {
      debugPrint('❌ Error rejecting seller: $e');
      throw Exception('Failed to reject seller');
    }
  }

  Future<void> deleteSeller(String sellerId) async {
    try {
      debugPrint('🗑️ Deleting seller: $sellerId');
      await _firestore.collection('sellers').doc(sellerId).delete();
      debugPrint('✅ Seller deleted: $sellerId');
      notifyListeners();
    } catch (e) {
      debugPrint('❌ Error deleting seller: $e');
      throw Exception('Failed to delete seller');
    }
  }

  Future<void> updateSellerStatus(String sellerId, bool isActive) async {
    try {
      debugPrint('${isActive ? '✅' : '⛔'} Updating seller status: $sellerId to ${isActive ? 'active' : 'inactive'}');
      await _firestore.collection('sellers').doc(sellerId).update({
        'isActive': isActive,
      });
      debugPrint('✅ Seller status updated: $sellerId');
      notifyListeners();
    } catch (e) {
      debugPrint('❌ Error updating seller status: $e');
      throw Exception('Failed to update seller status');
    }
  }

  Future<void> bulkUpdateSellerVerification(List<String> sellerIds, VerificationStatus status) async {
    try {
      debugPrint('📝 Bulk updating ${sellerIds.length} sellers to $status');
      for (final sellerId in sellerIds) {
        await updateSellerVerification(sellerId, status);
      }
      debugPrint('✅ Bulk seller verification updated');
    } catch (e) {
      debugPrint('❌ Error bulk updating seller verification: $e');
      throw Exception('Failed to bulk update seller verification');
    }
  }

  // CATEGORIES

  void listenToCategories() {
    _isLoadingCategories = true;
    notifyListeners();
    _adminService.getCategories().listen((categories) {
      _categories = categories;
      _isLoadingCategories = false;
      notifyListeners();
    });
  }

  Future<void> addCategory({
    required String name,
    required String description,
    String? parentId,
    required int level,
    String? iconName,
    String? iconImageUrl,
    String? bannerImageUrl,
    int displayOrder = 0,
    bool isActive = true,
  }) async {
    try {
      debugPrint('📝 Adding category: $name');
      final categoryData = {
        'name': name,
        'description': description,
        'parentId': parentId,
        'level': level,
        'iconName': iconName,
        'iconImageUrl': iconImageUrl,
        'bannerImageUrl': bannerImageUrl,
        'displayOrder': displayOrder,
        'isActive': isActive,
        'createdAt': FieldValue.serverTimestamp(),
        'productCount': 0,
      };
      await _adminService.addCategory(categoryData);
      debugPrint('✅ Category added successfully: $name');
    } catch (e) {
      debugPrint('❌ Error adding category: $e');
      rethrow;
    }
  }

  Future<void> updateCategory({
    required String categoryId,
    required String name,
    required String description,
    String? parentId,
    required int level,
    String? iconName,
    String? iconImageUrl,
    String? bannerImageUrl,
    int? displayOrder,
    bool? isActive,
  }) async {
    try {
      debugPrint('📝 Updating category: $categoryId');
      final categoryData = {
        'name': name,
        'description': description,
        'parentId': parentId,
        'level': level,
        'iconName': iconName,
        'iconImageUrl': iconImageUrl,
        'bannerImageUrl': bannerImageUrl,
        'displayOrder': displayOrder,
        'isActive': isActive,
      };
      categoryData.removeWhere((key, value) => value == null);
      await _adminService.updateCategory(categoryId, categoryData);
      debugPrint('✅ Category updated successfully: $categoryId');
    } catch (e) {
      debugPrint('❌ Error updating category: $e');
      rethrow;
    }
  }

  Future<void> deleteCategory(String categoryId) async {
    try {
      await _adminService.deleteCategory(categoryId);
    } catch (e) {
      rethrow;
    }
  }

  // COUPONS

  void listenToCoupons() {
    _adminService.getCoupons().listen((coupons) {
      _coupons = coupons;
      notifyListeners();
    });
  }

  Future<void> addCoupon({
    required String code,
    required double discount,
    required String type,
    required DateTime expiryDate,
    int? maxUses,
  }) async {
    try {
      await _adminService.addCoupon(
        code: code,
        discount: discount,
        type: type,
        expiryDate: expiryDate,
        maxUses: maxUses,
      );
    } catch (e) {
      rethrow;
    }
  }

  Future<void> toggleCouponStatus(String couponId, bool isActive) async {
    try {
      await _adminService.toggleCouponStatus(couponId, isActive);
    } catch (e) {
      rethrow;
    }
  }

  // ADMIN SESSION INFO (DEBUG)

  Future<Map<String, dynamic>> getAdminSessionInfo() async {
    try {
      if (_prefs == null) {
        await _initializePreferences();
      }
      return {
        'isLoggedIn': _prefs?.getBool(StorageConstants.keyIsLoggedIn) ?? false,
        'userId': _prefs?.getString(StorageConstants.keyUserId),
        'userEmail': _prefs?.getString(StorageConstants.keyUserEmail),
        'userRole': _prefs?.getString(StorageConstants.keyUserRole),
        'lastLoginTime': _prefs?.getString(StorageConstants.keyLastLoginTime),
      };
    } catch (e) {
      debugPrint('❌ Error getting admin session info: $e');
      return {};
    }
  }
}
