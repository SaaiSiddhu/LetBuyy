import 'package:flutter/material.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

/// Provider for inline sponsored products in marketplace
/// Products in active ad campaigns will show "Ad" badges in existing grids
class MarketplaceAdProvider extends ChangeNotifier {
  final AdService _adService = AdService();
  FirebaseFirestore get _firestore => FirebaseFirestore.instance;
  
  /// Set of product IDs that are currently sponsored (for quick lookup)
  final Set<String> _sponsoredProductIds = {};
  
  /// Full ad data keyed by product ID
  final Map<String, SponsoredProductData> _sponsoredProductMap = {};
  
  /// Session-based click deduplication: tracks productId+placement combos already billed
  /// Resets when user restarts app or clearData() is called
  final Set<String> _billedClicksThisSession = {};
  
  bool _isLoaded = false;
  bool _isLoading = false;
  String? _error;
  
  // Getters
  bool get isLoaded => _isLoaded;
  bool get isLoading => _isLoading;
  String? get error => _error;
  int get sponsoredCount => _sponsoredProductIds.length;
  
  /// Get all sponsored product IDs (lazy loads if needed)
  Set<String> get sponsoredProductIds {
    if (!_isLoaded && !_isLoading) {
      // Trigger lazy load
      loadSponsoredProducts();
    }
    return _sponsoredProductIds;
  }

  /// Check if a product is sponsored (quick O(1) lookup)
  bool isSponsored(String productId) => _sponsoredProductIds.contains(productId);

  /// Get full sponsored data for a product (for tracking)
  SponsoredProductData? getAdData(String productId) => _sponsoredProductMap[productId];

  /// Get sponsored product data by ID (alias for getAdData)
  SponsoredProductData? getSponsoredProductData(String productId) => _sponsoredProductMap[productId];

  /// Record an impression with placement
  Future<void> recordImpression(String productId, AdPlacement placement, {String? userId}) async {
    final adData = _sponsoredProductMap[productId];
    if (adData == null) return;
    
    try {
      await _adService.recordImpression(
        adProductId: adData.adProduct.id,
        campaignId: adData.campaignId,
        sellerId: adData.adProduct.sellerId,
        userId: userId,
        placement: placement,
      );
    } catch (e) {
      debugPrint('⚠️ Error recording impression: $e');
    }
  }

  /// Load all sponsored products from active campaigns
  /// Call this once when marketplace initializes
  Future<void> loadSponsoredProducts() async {
    if (_isLoading) return;
    
    try {
      _isLoading = true;
      _error = null;
      // Defer notification to avoid setState during build
      Future.microtask(() => notifyListeners());
      
      // Clear existing data
      _sponsoredProductIds.clear();
      _sponsoredProductMap.clear();
      
      // Get active campaigns
      final campaignsSnapshot = await _firestore
          .collection('ad_campaigns')
          .where('status', isEqualTo: 'active')
          .limit(50)
          .get();
      
      if (campaignsSnapshot.docs.isEmpty) {
        _isLoaded = true;
        return;
      }
      
      final campaignIds = campaignsSnapshot.docs.map((d) => d.id).toList();
      
      // Get all active ad products from these campaigns
      for (final campaignId in campaignIds) {
        final productsSnapshot = await _firestore
            .collection('ad_products')
            .where('campaignId', isEqualTo: campaignId)
            .where('status', isEqualTo: 'active')
            .get();
        
        for (final doc in productsSnapshot.docs) {
          final adProduct = AdProductModel.fromFirestore(doc);
          
          // Fetch actual product data for display
          final productDoc = await _firestore
              .collection('products')
              .doc(adProduct.productId)
              .get();
          
          if (productDoc.exists) {
            final product = ProductModel.fromFirestore(productDoc);
            if (product.isActive) {
              final sponsoredData = SponsoredProductData(
                product: product,
                adProduct: adProduct,
                campaignId: campaignId,
              );
              
              _sponsoredProductIds.add(product.id);
              _sponsoredProductMap[product.id] = sponsoredData;
            }
          }
        }
      }
      
      _isLoaded = true;
      debugPrint('📊 Loaded ${_sponsoredProductIds.length} sponsored products');
    } catch (e) {
      debugPrint('❌ Error loading sponsored products: $e');
      _error = e.toString();
    } finally {
      _isLoading = false;
      Future.microtask(() => notifyListeners());
    }
  }

  /// Record a click for a sponsored product (triggers billing)
  /// Uses placement tracking and deduplication to prevent double billing
  Future<bool> recordClickWithPlacement(String productId, AdPlacement placement, {String? userId}) async {
    final adData = _sponsoredProductMap[productId];
    if (adData == null) return false;
    
    // Deduplication: Check if this product+placement combo was already billed this session
    final clickKey = '${productId}_${placement.name}';
    if (_billedClicksThisSession.contains(clickKey)) {
      debugPrint('⏭️ Click already billed this session: $clickKey');
      return false; // Already billed, skip
    }
    
    try {
      final success = await _adService.recordClick(
        adProductId: adData.adProduct.id,
        campaignId: adData.campaignId,
        sellerId: adData.adProduct.sellerId,
        productId: productId,
        userId: userId,
        placement: placement, // Seller can see WHERE clicks come from
        costPerClick: adData.adProduct.bidAmount,
      );
      
      if (success) {
        _billedClicksThisSession.add(clickKey); // Mark as billed
        debugPrint('✅ Click recorded for $productId from ${placement.name}');
      }
      return success;
    } catch (e) {
      debugPrint('⚠️ Error recording click: $e');
      return false;
    }
  }

  /// Legacy method - still works but uses HOME placement by default
  Future<void> recordClick(String productId, {String? userId}) async {
    await recordClickWithPlacement(productId, AdPlacement.home, userId: userId);
  }

  /// Get sponsored ads for a specific category
  /// Used in category screen and shop screen with category filter
  Future<List<SponsoredProductData>> getAdsForCategory(String categoryId, {int limit = 4}) async {
    try {
      final ads = await _adService.getAdsForCategory(
        categoryId: categoryId,
        limit: limit,
      );
      
      final List<SponsoredProductData> result = [];
      
      for (final adProduct in ads) {
        final productDoc = await _firestore
            .collection('products')
            .doc(adProduct.productId)
            .get();
        
        if (productDoc.exists) {
          final product = ProductModel.fromFirestore(productDoc);
          if (product.isActive) {
            result.add(SponsoredProductData(
              product: product,
              adProduct: adProduct,
              campaignId: adProduct.campaignId,
            ));
          }
        }
      }
      
      debugPrint('📊 Found ${result.length} sponsored products for category $categoryId');
      return result;
    } catch (e) {
      debugPrint('❌ Error fetching category ads: $e');
      return [];
    }
  }

  /// Get sponsored ads for search query
  /// Used in search screen when user searches for keywords
  Future<List<SponsoredProductData>> getAdsForSearch(String query, {int limit = 3}) async {
    try {
      final ads = await _adService.getAdsForSearch(
        query: query,
        limit: limit,
      );
      
      final List<SponsoredProductData> result = [];
      
      for (final adProduct in ads) {
        final productDoc = await _firestore
            .collection('products')
            .doc(adProduct.productId)
            .get();
        
        if (productDoc.exists) {
          final product = ProductModel.fromFirestore(productDoc);
          if (product.isActive) {
            result.add(SponsoredProductData(
              product: product,
              adProduct: adProduct,
              campaignId: adProduct.campaignId,
            ));
          }
        }
      }
      
      debugPrint('📊 Found ${result.length} sponsored products for search "$query"');
      return result;
    } catch (e) {
      debugPrint('❌ Error fetching search ads: $e');
      return [];
    }
  }

  /// Get category boost ads (premium placement in category header)
  /// Returns high-bid ads for prominent display
  Future<List<SponsoredProductData>> getCategoryBoostAds(String categoryId, {int limit = 2}) async {
    try {
      final ads = await _adService.getCategoryBoostAds(
        categoryId: categoryId,
        limit: limit,
      );
      
      final List<SponsoredProductData> result = [];
      
      for (final adProduct in ads) {
        final productDoc = await _firestore
            .collection('products')
            .doc(adProduct.productId)
            .get();
        
        if (productDoc.exists) {
          final product = ProductModel.fromFirestore(productDoc);
          if (product.isActive) {
            result.add(SponsoredProductData(
              product: product,
              adProduct: adProduct,
              campaignId: adProduct.campaignId,
            ));
          }
        }
      }
      
      debugPrint('📊 Found ${result.length} category boost ads for $categoryId');
      return result;
    } catch (e) {
      debugPrint('❌ Error fetching category boost ads: $e');
      return [];
    }
  }

  /// Clear all cached data
  void clearData() {
    _sponsoredProductIds.clear();
    _sponsoredProductMap.clear();
    _billedClicksThisSession.clear(); // Reset click deduplication
    _isLoaded = false;
    notifyListeners();
  }
}

/// Data class combining product with ad metadata
class SponsoredProductData {
  final ProductModel product;
  final AdProductModel adProduct;
  final String campaignId;

  SponsoredProductData({
    required this.product,
    required this.adProduct,
    required this.campaignId,
  });
}
