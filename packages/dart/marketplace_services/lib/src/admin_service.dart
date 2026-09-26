// lib/services/admin_service.dart

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';

class AdminService {
  FirebaseFirestore get _firestore => FirebaseFirestore.instance;

  // ============================================
  // PRODUCTS
  // ============================================
  
  Future<void> addProduct(ProductModel product) async {
    try {
      await _firestore.collection('products').add(product.toJson());
      debugPrint('✅ Product added');
    } catch (e) {
      debugPrint('❌ Error adding product: $e');
      throw Exception('Failed to add product: $e');
    }
  }

  Future<void> updateProduct(String productId, ProductModel product) async {
    try {
      await _firestore
          .collection('products')
          .doc(productId)
          .update(product.toJson());
      debugPrint('✅ Product updated: $productId');
    } catch (e) {
      debugPrint('❌ Error updating product: $e');
      throw Exception('Failed to update product: $e');
    }
  }

  Future<void> deleteProduct(String productId) async {
    try {
      await _firestore.collection('products').doc(productId).delete();
      debugPrint('✅ Product deleted: $productId');
    } catch (e) {
      debugPrint('❌ Error deleting product: $e');
      throw Exception('Failed to delete product: $e');
    }
  }

  Stream<List<ProductModel>> getProducts() {
    try {
      return _firestore
          .collection('products')
          .orderBy('createdAt', descending: true)
          .snapshots()
          .map((snapshot) {
        return snapshot.docs
            .map((doc) {
              try {
                return ProductModel.fromJson({...doc.data(), 'id': doc.id});
              } catch (e) {
                debugPrint('❌ Error parsing product ${doc.id}: $e');
                return null;
              }
            })
            .whereType<ProductModel>()
            .toList();
      });
    } catch (e) {
      debugPrint('❌ Error getting products stream: $e');
      throw Exception('Failed to get products: $e');
    }
  }

  // ============================================
  // ORDERS
  // ============================================
  
  Stream<List<OrderModel>> getOrders() {
    try {
      return _firestore
          .collection('orders')
          .orderBy('createdAt', descending: true)
          .snapshots()
          .map((snapshot) {
        return snapshot.docs
            .map((doc) {
              try {
                return OrderModel.fromJson({...doc.data(), 'id': doc.id});
              } catch (e) {
                debugPrint('❌ Error parsing order ${doc.id}: $e');
                return null;
              }
            })
            .whereType<OrderModel>()
            .toList();
      });
    } catch (e) {
      debugPrint('❌ Error getting orders stream: $e');
      throw Exception('Failed to get orders: $e');
    }
  }

  Future<void> updateOrderStatus(String orderId, String status) async {
    try {
      await _firestore.collection('orders').doc(orderId).update({
        'status': status,
        'updatedAt': FieldValue.serverTimestamp(),
      });
      debugPrint('✅ Order status updated: $orderId to $status');
    } catch (e) {
      debugPrint('❌ Error updating order status: $e');
      throw Exception('Failed to update order status: $e');
    }
  }

  // ============================================
  // USERS
  // ============================================
  
  Stream<List<Map<String, dynamic>>> getUsers() {
    try {
      return _firestore
          .collection('users')
          .orderBy('createdAt', descending: true)
          .snapshots()
          .map((snapshot) {
        return snapshot.docs
            .map((doc) {
              try {
                return {...doc.data(), 'id': doc.id};
              } catch (e) {
                debugPrint('❌ Error parsing user ${doc.id}: $e');
                return null;
              }
            })
            .whereType<Map<String, dynamic>>()
            .toList();
      });
    } catch (e) {
      debugPrint('❌ Error getting users stream: $e');
      throw Exception('Failed to get users: $e');
    }
  }

  Future<void> updateUserRole(String userId, String role) async {
    try {
      await _firestore.collection('users').doc(userId).update({
        'role': role,
        'updatedAt': FieldValue.serverTimestamp(),
      });
      debugPrint('✅ User role updated: $userId to $role');
    } catch (e) {
      debugPrint('❌ Error updating user role: $e');
      throw Exception('Failed to update user role: $e');
    }
  }

  Future<void> toggleUserStatus(String userId, bool isActive) async {
    try {
      await _firestore.collection('users').doc(userId).update({
        'isActive': isActive,
        'updatedAt': FieldValue.serverTimestamp(),
      });
      debugPrint('✅ User status toggled: $userId to $isActive');
    } catch (e) {
      debugPrint('❌ Error toggling user status: $e');
      throw Exception('Failed to toggle user status: $e');
    }
  }

  Future<void> deleteUser(String userId) async {
    try {
      await _firestore.collection('users').doc(userId).delete();
      debugPrint('✅ User deleted: $userId');
    } catch (e) {
      debugPrint('❌ Error deleting user: $e');
      throw Exception('Failed to delete user: $e');
    }
  }

  Future<void> updateUserInfo(String userId, Map<String, dynamic> data) async {
    try {
      data['updatedAt'] = FieldValue.serverTimestamp();
      await _firestore.collection('users').doc(userId).update(data);
      debugPrint('✅ User info updated: $userId');
    } catch (e) {
      debugPrint('❌ Error updating user info: $e');
      throw Exception('Failed to update user info: $e');
    }
  }

  // ============================================
  // CATEGORIES
  // ============================================
  
  // ✅ UPDATED: Uses category name as document ID (sanitized to lowercase)
  Future<void> addCategory(Map<String, dynamic> categoryData) async {
    try {
      final name = categoryData['name'] as String? ?? '';
      if (name.isEmpty) {
        throw Exception('Category name is required');
      }
      
      // Sanitize name for document ID: lowercase, trim, replace spaces with underscores
      final docId = name.trim().toLowerCase().replaceAll(RegExp(r'\s+'), '_');
      
      // Check if category already exists
      final existingDoc = await _firestore.collection('categories').doc(docId).get();
      if (existingDoc.exists) {
        throw Exception('Category "$name" already exists');
      }
      
      await _firestore.collection('categories').doc(docId).set(categoryData);
      debugPrint('✅ Category added: $name (ID: $docId)');
    } catch (e) {
      debugPrint('❌ Error adding category: $e');
      throw Exception('Failed to add category: $e');
    }
  }

  Stream<List<Map<String, dynamic>>> getCategories() {
    try {
      return _firestore
          .collection('categories')
          .orderBy('displayOrder')
          .snapshots()
          .map((snapshot) {
        return snapshot.docs
            .map((doc) {
              try {
                return {...doc.data(), 'id': doc.id};
              } catch (e) {
                debugPrint('❌ Error parsing category ${doc.id}: $e');
                return null;
              }
            })
            .whereType<Map<String, dynamic>>()
            .toList();
      });
    } catch (e) {
      debugPrint('❌ Error getting categories stream: $e');
      throw Exception('Failed to get categories: $e');
    }
  }

  Future<void> deleteCategory(String categoryId) async {
    try {
      await _firestore.collection('categories').doc(categoryId).delete();
      debugPrint('✅ Category deleted: $categoryId');
    } catch (e) {
      debugPrint('❌ Error deleting category: $e');
      throw Exception('Failed to delete category: $e');
    }
  }

  // ✅ FIXED: Changed signature to accept an ID and a map
  Future<void> updateCategory(
      String categoryId, Map<String, dynamic> categoryData) async {
    try {
      // Add the updatedAt timestamp to the map
      categoryData['updatedAt'] = FieldValue.serverTimestamp();
      
      await _firestore.collection('categories').doc(categoryId).update(categoryData);
      debugPrint('✅ Category updated: $categoryId');
    } catch (e) {
      debugPrint('❌ Error updating category: $e');
      throw Exception('Failed to update category: $e');
    }
  }

  // ============================================
  // COUPONS
  // ============================================
  
  Future<void> addCoupon({
    required String code,
    required double discount,
    required String type,
    required DateTime expiryDate,
    int? maxUses,
  }) async {
    try {
      await _firestore.collection('coupons').add({
        'code': code.toUpperCase(),
        'discount': discount,
        'type': type,
        'expiryDate': Timestamp.fromDate(expiryDate),
        'maxUses': maxUses,
        'currentUses': 0,
        'isActive': true,
        'createdAt': FieldValue.serverTimestamp(),
      });
      debugPrint('✅ Coupon added: $code');
    } catch (e) {
      debugPrint('❌ Error adding coupon: $e');
      throw Exception('Failed to add coupon: $e');
    }
  }

  Stream<List<Map<String, dynamic>>> getCoupons() {
    try {
      return _firestore
          .collection('coupons')
          .orderBy('createdAt', descending: true)
          .snapshots()
          .map((snapshot) {
        return snapshot.docs
            .map((doc) {
              try {
                return {...doc.data(), 'id': doc.id};
              } catch (e) {
                debugPrint('❌ Error parsing coupon ${doc.id}: $e');
                return null;
              }
            })
            .whereType<Map<String, dynamic>>()
            .toList();
      });
    } catch (e) {
      debugPrint('❌ Error getting coupons stream: $e');
      throw Exception('Failed to get coupons: $e');
    }
  }

  Future<void> toggleCouponStatus(String couponId, bool isActive) async {
    try {
      await _firestore.collection('coupons').doc(couponId).update({
        'isActive': isActive,
        'updatedAt': FieldValue.serverTimestamp(),
      });
      debugPrint('✅ Coupon status toggled: $couponId');
    } catch (e) {
      debugPrint('❌ Error toggling coupon status: $e');
      throw Exception('Failed to toggle coupon status: $e');
    }
  }

  Future<void> deleteCoupon(String couponId) async {
    try {
      await _firestore.collection('coupons').doc(couponId).delete();
      debugPrint('✅ Coupon deleted: $couponId');
    } catch (e) {
      debugPrint('❌ Error deleting coupon: $e');
      throw Exception('Failed to delete coupon: $e');
    }
  }

  Future<void> updateCoupon({
    required String couponId,
    required String code,
    required double discount,
    required String type,
    required DateTime expiryDate,
    int? maxUses,
  }) async {
    try {
      await _firestore.collection('coupons').doc(couponId).update({
        'code': code.toUpperCase(),
        'discount': discount,
        'type': type,
        'expiryDate': Timestamp.fromDate(expiryDate),
        'maxUses': maxUses,
        'updatedAt': FieldValue.serverTimestamp(),
      });
      debugPrint('✅ Coupon updated: $couponId');
    } catch (e) {
      debugPrint('❌ Error updating coupon: $e');
      throw Exception('Failed to update coupon: $e');
    }
  }

  // ============================================
  // ANALYTICS
  // ============================================
  
  Future<Map<String, dynamic>> getDashboardStats() async {
    try {
      final productsSnapshot = await _firestore.collection('products').get();
      final productsCount = productsSnapshot.docs.length;

      final ordersSnapshot = await _firestore.collection('orders').get();
      final ordersCount = ordersSnapshot.docs.length;

      final usersSnapshot = await _firestore.collection('users').get();
      final usersCount = usersSnapshot.docs.length;

      double revenue = 0.0;
      for (var doc in ordersSnapshot.docs) {
        final data = doc.data();
        if (data['status'] == 'delivered') {
          revenue += (data['total'] ?? 0).toDouble();
        }
      }

      debugPrint('✅ Dashboard stats loaded: $productsCount products, $ordersCount orders, $usersCount users, \$$revenue revenue');

      return {
        'products': productsCount,
        'orders': ordersCount,
        'users': usersCount,
        'revenue': revenue,
      };
    } catch (e) {
      debugPrint('❌ Error getting dashboard stats: $e');
      return {
        'products': 0,
        'orders': 0,
        'users': 0,
        'revenue': 0.0,
      };
    }
  }

  // ============================================
  // NOTIFICATIONS
  // ============================================

  Future<void> sendNotificationToUser(
    String userId,
    String title,
    String body,
  ) async {
    try {
      await _firestore.collection('notifications').add({
        'userId': userId,
        'title': title,
        'body': body,
        'isRead': false,
        'createdAt': FieldValue.serverTimestamp(),
      });
      debugPrint('✅ Notification sent to user: $userId');
    } catch (e) {
      debugPrint('❌ Error sending notification: $e');
      throw Exception('Failed to send notification: $e');
    }
  }

  Future<void> sendBroadcastNotification(String title, String body) async {
    try {
      final usersSnapshot = await _firestore.collection('users').get();
      
      final batch = _firestore.batch();
      for (var userDoc in usersSnapshot.docs) {
        final notificationRef = _firestore.collection('notifications').doc();
        batch.set(notificationRef, {
          'userId': userDoc.id,
          'title': title,
          'body': body,
          'isRead': false,
          'createdAt': FieldValue.serverTimestamp(),
        });
      }
      
      await batch.commit();
      debugPrint('✅ Broadcast notification sent to ${usersSnapshot.docs.length} users');
    } catch (e) {
      debugPrint('❌ Error sending broadcast notification: $e');
      throw Exception('Failed to send broadcast notification: $e');
    }
  }

  // ============================================
  // SEARCH & FILTERS
  // ============================================

  Future<List<ProductModel>> searchProducts(String query) async {
    try {
      final snapshot = await _firestore
          .collection('products')
          .where('name', isGreaterThanOrEqualTo: query)
          .where('name', isLessThanOrEqualTo: '$query\uf8ff')
          .get();

      final products = snapshot.docs
          .map((doc) {
            try {
              return ProductModel.fromJson({...doc.data(), 'id': doc.id});
            } catch (e) {
              return null;
            }
          })
          .whereType<ProductModel>()
          .toList();

      debugPrint('✅ Found ${products.length} products for query: "$query"');
      return products;
    } catch (e) {
      debugPrint('❌ Error searching products: $e');
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> searchUsers(String query) async {
    try {
      final snapshot = await _firestore
          .collection('users')
          .where('name', isGreaterThanOrEqualTo: query)
          .where('name', isLessThanOrEqualTo: '$query\uf8ff')
          .get();

      final users = snapshot.docs
          .map((doc) {
            try {
              return {...doc.data(), 'id': doc.id};
            } catch (e) {
              return null;
            }
          })
          .whereType<Map<String, dynamic>>()
          .toList();

      debugPrint('✅ Found ${users.length} users for query: "$query"');
      return users;
    } catch (e) {
      debugPrint('❌ Error searching users: $e');
      return [];
    }
  }
}