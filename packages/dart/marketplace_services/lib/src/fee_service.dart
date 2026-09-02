import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';

/// Service for managing admin-controlled fee configuration
class FeeService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  
  /// Firestore path for fee configuration
  static const String _collection = 'delivery_settings';
  static const String _docId = 'fees';
  
  /// Cached config to avoid repeated reads
  FeeConfigModel? _cachedConfig;
  DateTime? _cacheTime;
  static const Duration _cacheDuration = Duration(minutes: 5);

  // ============================================
  // GET FEE CONFIG
  // ============================================
  
  /// Get current fee configuration (with caching)
  Future<FeeConfigModel> getFeeConfig({bool forceRefresh = false}) async {
    // Return cached if valid
    if (!forceRefresh && 
        _cachedConfig != null && 
        _cacheTime != null &&
        DateTime.now().difference(_cacheTime!) < _cacheDuration) {
      return _cachedConfig!;
    }

    try {
      final doc = await _firestore.collection(_collection).doc(_docId).get();
      
      if (doc.exists && doc.data() != null) {
        _cachedConfig = FeeConfigModel.fromMap(doc.data()!);
      } else {
        // Create default config if doesn't exist
        _cachedConfig = FeeConfigModel.defaults;
        await saveFeeConfig(_cachedConfig!);
      }
      
      _cacheTime = DateTime.now();
      return _cachedConfig!;
    } catch (e) {
      debugPrint('❌ Error getting fee config: $e');
      return FeeConfigModel.defaults;
    }
  }

  /// Stream fee configuration changes
  Stream<FeeConfigModel> streamFeeConfig() {
    return _firestore
        .collection(_collection)
        .doc(_docId)
        .snapshots()
        .map((doc) {
          if (doc.exists && doc.data() != null) {
            _cachedConfig = FeeConfigModel.fromMap(doc.data()!);
            _cacheTime = DateTime.now();
            return _cachedConfig!;
          }
          return FeeConfigModel.defaults;
        });
  }

  // ============================================
  // SAVE FEE CONFIG
  // ============================================
  
  /// Save fee configuration (admin only)
  Future<bool> saveFeeConfig(FeeConfigModel config, {String? updatedBy}) async {
    try {
      final data = config.copyWith(updatedBy: updatedBy).toMap();
      
      await _firestore.collection(_collection).doc(_docId).set(
        data,
        SetOptions(merge: true),
      );
      
      // Update cache
      _cachedConfig = config;
      _cacheTime = DateTime.now();
      
      debugPrint('✅ Fee config saved');
      return true;
    } catch (e) {
      debugPrint('❌ Error saving fee config: $e');
      return false;
    }
  }

  // ============================================
  // UPDATE INDIVIDUAL SETTINGS
  // ============================================
  
  /// Update platform fee
  Future<bool> updatePlatformFee(double amount, {String? updatedBy}) async {
    final config = await getFeeConfig();
    return saveFeeConfig(
      config.copyWith(platformFee: amount),
      updatedBy: updatedBy,
    );
  }

  /// Update delivery fee markup
  Future<bool> updateDeliveryMarkup(double percent, {String? updatedBy}) async {
    final config = await getFeeConfig();
    return saveFeeConfig(
      config.copyWith(deliveryFeeMarkup: percent),
      updatedBy: updatedBy,
    );
  }

  /// Update COD fee
  Future<bool> updateCODFee(double amount, {String? updatedBy}) async {
    final config = await getFeeConfig();
    return saveFeeConfig(
      config.copyWith(codFee: amount),
      updatedBy: updatedBy,
    );
  }

  /// Update payment gateway fee percent
  Future<bool> updatePGFee(double percent, {String? updatedBy}) async {
    final config = await getFeeConfig();
    return saveFeeConfig(
      config.copyWith(paymentGatewayFeePercent: percent),
      updatedBy: updatedBy,
    );
  }

  /// Update quality penalty
  Future<bool> updateQualityPenalty(double amount, {String? updatedBy}) async {
    final config = await getFeeConfig();
    return saveFeeConfig(
      config.copyWith(qualityPenalty: amount),
      updatedBy: updatedBy,
    );
  }

  // ============================================
  // BLOCKED PINCODES
  // ============================================
  
  /// Add pincode to blocked list
  Future<bool> blockPincode(String pincode, {String? updatedBy}) async {
    final config = await getFeeConfig();
    if (config.blockedPincodes.contains(pincode)) return true;
    
    final updated = List<String>.from(config.blockedPincodes)..add(pincode);
    return saveFeeConfig(
      config.copyWith(blockedPincodes: updated),
      updatedBy: updatedBy,
    );
  }

  /// Remove pincode from blocked list
  Future<bool> unblockPincode(String pincode, {String? updatedBy}) async {
    final config = await getFeeConfig();
    if (!config.blockedPincodes.contains(pincode)) return true;
    
    final updated = List<String>.from(config.blockedPincodes)..remove(pincode);
    return saveFeeConfig(
      config.copyWith(blockedPincodes: updated),
      updatedBy: updatedBy,
    );
  }

  /// Check if pincode is serviceable
  Future<bool> isPincodeServiceable(String pincode) async {
    final config = await getFeeConfig();
    return !config.isPincodeBlocked(pincode);
  }

  // ============================================
  // FREE DELIVERY
  // ============================================
  
  /// Toggle free delivery
  Future<bool> toggleFreeDelivery(bool enabled, {String? updatedBy}) async {
    final config = await getFeeConfig();
    return saveFeeConfig(
      config.copyWith(freeDeliveryEnabled: enabled),
      updatedBy: updatedBy,
    );
  }

  /// Update free delivery threshold
  Future<bool> updateFreeDeliveryThreshold(double amount, {String? updatedBy}) async {
    final config = await getFeeConfig();
    return saveFeeConfig(
      config.copyWith(freeDeliveryThreshold: amount),
      updatedBy: updatedBy,
    );
  }

  /// Check if order qualifies for free delivery
  Future<bool> qualifiesForFreeDelivery(double orderTotal) async {
    final config = await getFeeConfig();
    return config.qualifiesForFreeDelivery(orderTotal);
  }

  // ============================================
  // FEE CALCULATIONS
  // ============================================
  
  /// Calculate all fees for an order
  Future<Map<String, double>> calculateOrderFees({
    required double orderTotal,
    required double courierRate,
    required bool isCOD,
    required bool isOnlinePayment,
  }) async {
    final config = await getFeeConfig();
    
    final deliveryFee = config.qualifiesForFreeDelivery(orderTotal)
        ? 0.0
        : config.calculateDeliveryFee(courierRate);
    
    return {
      'platformFee': config.platformFee,
      'deliveryFee': deliveryFee,
      'codFee': isCOD ? config.codFee : 0.0,
      'paymentGatewayFee': isOnlinePayment 
          ? config.calculatePGFee(orderTotal) 
          : 0.0,
    };
  }

  /// Calculate RTO fee based on return type
  Future<double> calculateRTOFee({
    required double forwardShipping,
    required String returnReason,
    required bool isDefective,
  }) async {
    final config = await getFeeConfig();
    
    if (isDefective) {
      // Defective return: return shipping + quality penalty
      return config.calculateDefectiveReturnFee(forwardShipping);
    }
    
    // Check if delivery was refused
    final isRefused = returnReason.toLowerCase().contains('refused') ||
                       returnReason.toLowerCase().contains('reject');
    
    if (isRefused) {
      return config.calculateRTORefusedFee(forwardShipping);
    }
    
    // Regular return
    return config.calculateRTOReturnFee(forwardShipping);
  }

  /// Clear cache (useful after admin updates)
  void clearCache() {
    _cachedConfig = null;
    _cacheTime = null;
  }
}
