import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

/// Comprehensive Ads Service for Sponsored Products
/// Handles campaigns, bidding, auction, billing, and analytics
class AdService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  // Collection references
  CollectionReference get _campaignsRef => _firestore.collection('ad_campaigns');
  CollectionReference get _adProductsRef => _firestore.collection('ad_products');
  CollectionReference get _impressionsRef => _firestore.collection('ad_impressions');
  CollectionReference get _clicksRef => _firestore.collection('ad_clicks');
  CollectionReference get _adWalletsRef => _firestore.collection('ad_wallets');
  CollectionReference get _walletTransactionsRef => _firestore.collection('ad_wallet_transactions');
  CollectionReference get _productsRef => _firestore.collection('products');

  // =========================================================
  // CAMPAIGN OPERATIONS
  // =========================================================

  /// Create a new ad campaign (status = pendingReview)
  Future<String> createCampaign({
    required String sellerId,
    required String name,
    required CampaignTargetType targetType,
    AdType adType = AdType.sponsoredProduct,
    BillingType billingType = BillingType.cpc,
    required double dailyBudget,
    required double totalBudget,
    double? bidAmount,
    required DateTime startDate,
    DateTime? endDate,
    List<String>? keywords,
    String? categoryId,
  }) async {
    try {
      // Get CPC range for this ad type
      final cpcRange = AdCampaignModel.getCpcRange(adType);
      final effectiveBid = bidAmount ?? cpcRange['min']!;
      
      final campaign = AdCampaignModel(
        id: '',
        sellerId: sellerId,
        name: name,
        status: CampaignStatus.pendingReview, // Requires admin approval
        targetType: targetType,
        adType: adType,
        billingType: billingType,
        dailyBudget: dailyBudget,
        totalBudget: totalBudget,
        bidAmount: effectiveBid,
        minBid: cpcRange['min'],
        maxBid: cpcRange['max'],
        keywords: keywords ?? [],
        categoryId: categoryId,
        startDate: startDate,
        endDate: endDate,
        createdAt: DateTime.now(),
      );

      final docRef = await _campaignsRef.add(campaign.toFirestore());
      debugPrint('✅ Created ad campaign: ${docRef.id} (type: ${adType.name}, billing: ${billingType.name})');
      return docRef.id;
    } catch (e) {
      debugPrint('❌ Error creating campaign: $e');
      rethrow;
    }
  }

  /// Get all campaigns for a seller
  Stream<List<AdCampaignModel>> getSellerCampaigns(String sellerId) {
    return _campaignsRef
        .where('sellerId', isEqualTo: sellerId)
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => AdCampaignModel.fromFirestore(doc))
            .toList());
  }

  /// Get single campaign by ID
  Future<AdCampaignModel?> getCampaign(String campaignId) async {
    final doc = await _campaignsRef.doc(campaignId).get();
    if (!doc.exists) return null;
    return AdCampaignModel.fromFirestore(doc);
  }

  /// Update campaign
  Future<void> updateCampaign(String campaignId, Map<String, dynamic> updates) async {
    await _campaignsRef.doc(campaignId).update({
      ...updates,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  /// Pause campaign
  Future<void> pauseCampaign(String campaignId) async {
    await updateCampaign(campaignId, {'status': CampaignStatus.paused.name});
  }

  /// Resume campaign (if approved and has sufficient wallet balance)
  /// Returns true if resumed, false if failed (check wallet balance)
  Future<bool> resumeCampaign(String campaignId) async {
    final campaign = await getCampaign(campaignId);
    if (campaign == null) return false;
    
    // Can only resume if previously paused or exhausted
    if (campaign.status != CampaignStatus.paused && 
        campaign.status != CampaignStatus.exhausted) {
      debugPrint('⚠️ Cannot resume: campaign status is ${campaign.status.name}');
      return false;
    }
    
    // Check wallet balance before resuming
    final wallet = await getAdWallet(campaign.sellerId);
    if (wallet == null || wallet.balance < campaign.dailyBudget) {
      debugPrint('⚠️ Cannot resume: Insufficient wallet balance (${wallet?.balance ?? 0} < ${campaign.dailyBudget})');
      return false;
    }
    
    // Check if campaign still has budget remaining
    if (campaign.spentTotal >= campaign.totalBudget) {
      debugPrint('⚠️ Cannot resume: Campaign total budget exhausted');
      return false;
    }
    
    await updateCampaign(campaignId, {'status': CampaignStatus.active.name});
    debugPrint('✅ Resumed campaign: $campaignId');
    return true;
  }

  /// Delete campaign and all associated ad_products
  /// Only allowed for: ended, exhausted, rejected, draft campaigns
  Future<bool> deleteCampaign(String campaignId) async {
    try {
      final campaign = await getCampaign(campaignId);
      if (campaign == null) {
        debugPrint('⚠️ Campaign not found: $campaignId');
        return false;
      }

      // Only allow delete for certain statuses
      final allowedStatuses = [
        CampaignStatus.ended,
        CampaignStatus.exhausted,
        CampaignStatus.rejected,
        CampaignStatus.draft,
        CampaignStatus.paused,
      ];

      if (!allowedStatuses.contains(campaign.status)) {
        debugPrint('⚠️ Cannot delete active or pending campaign');
        return false;
      }

      // Delete all ad_products associated with this campaign
      final productsQuery = await _adProductsRef
          .where('campaignId', isEqualTo: campaignId)
          .get();

      final batch = _firestore.batch();
      
      // Delete ad products
      for (final doc in productsQuery.docs) {
        batch.delete(doc.reference);
      }
      
      // Delete the campaign
      batch.delete(_campaignsRef.doc(campaignId));
      
      await batch.commit();

      debugPrint('✅ Deleted campaign: $campaignId with ${productsQuery.docs.length} products');
      return true;
    } catch (e) {
      debugPrint('❌ Error deleting campaign: $e');
      return false;
    }
  }

  /// Admin: Approve campaign
  Future<void> approveCampaign(String campaignId, String adminId) async {
    await updateCampaign(campaignId, {
      'status': CampaignStatus.active.name,
      'reviewedAt': FieldValue.serverTimestamp(),
      'reviewedBy': adminId,
    });
  }

  /// Admin: Reject campaign
  Future<void> rejectCampaign(String campaignId, String adminId, String reason) async {
    await updateCampaign(campaignId, {
      'status': CampaignStatus.rejected.name,
      'rejectionReason': reason,
      'reviewedAt': FieldValue.serverTimestamp(),
      'reviewedBy': adminId,
    });
  }

  /// Admin: Get all pending campaigns for review
  Stream<List<AdCampaignModel>> getPendingCampaigns() {
    return _campaignsRef
        .where('status', isEqualTo: CampaignStatus.pendingReview.name)
        .orderBy('createdAt')
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => AdCampaignModel.fromFirestore(doc))
            .toList());
  }

  // =========================================================
  // AD PRODUCTS OPERATIONS
  // =========================================================

  /// Add product to campaign
  Future<String> addProductToCampaign({
    required String campaignId,
    required String sellerId,
    required String productId,
    required double bidAmount,
  }) async {
    // Validate minimum bid
    if (bidAmount < AdCampaignModel.minCPC) {
      throw Exception('Bid amount must be at least ₹${AdCampaignModel.minCPC}');
    }

    // Get product details for denormalization
    final productDoc = await _productsRef.doc(productId).get();
    final productData = productDoc.data() as Map<String, dynamic>?;

    final adProduct = AdProductModel(
      id: '',
      campaignId: campaignId,
      sellerId: sellerId,
      productId: productId,
      bidAmount: bidAmount,
      createdAt: DateTime.now(),
      productName: productData?['name']?.toString(),
      productImage: (productData?['images'] as List?)?.first?.toString(),
      productPrice: productData?['price'] != null 
          ? (productData!['price'] as num).toDouble() 
          : null,
    );

    final docRef = await _adProductsRef.add(adProduct.toFirestore());
    return docRef.id;
  }

  /// Get products for a campaign
  Stream<List<AdProductModel>> getCampaignProducts(String campaignId) {
    return _adProductsRef
        .where('campaignId', isEqualTo: campaignId)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => AdProductModel.fromFirestore(doc))
            .toList());
  }

  /// Update ad product bid
  Future<void> updateProductBid(String adProductId, double newBid) async {
    if (newBid < AdCampaignModel.minCPC) {
      throw Exception('Bid amount must be at least ₹${AdCampaignModel.minCPC}');
    }
    await _adProductsRef.doc(adProductId).update({
      'bidAmount': newBid,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  /// Pause/resume ad product
  Future<void> toggleAdProductStatus(String adProductId, bool active) async {
    await _adProductsRef.doc(adProductId).update({
      'status': active ? AdProductStatus.active.name : AdProductStatus.paused.name,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  /// Remove product from campaign
  Future<void> removeProductFromCampaign(String adProductId) async {
    await _adProductsRef.doc(adProductId).delete();
  }

  // =========================================================
  // AD AUCTION ENGINE
  // =========================================================

  /// Get ads for search query - runs auction and returns winners
  Future<List<AdProductModel>> getAdsForSearch({
    required String query,
    int limit = 3,
  }) async {
    try {
      // Get all active campaigns with keyword targeting
      final campaignsQuery = await _campaignsRef
          .where('status', isEqualTo: CampaignStatus.active.name)
          .where('targetType', whereIn: [
            CampaignTargetType.keywords.name,
            CampaignTargetType.auto.name,
          ])
          .get();

      if (campaignsQuery.docs.isEmpty) return [];

      // Filter campaigns by keyword match
      final queryWords = query.toLowerCase().split(' ');
      final matchingCampaignIds = <String>[];

      for (final doc in campaignsQuery.docs) {
        final campaign = AdCampaignModel.fromFirestore(doc);
        
        // Check budget
        if (!campaign.canServeAds) continue;

        // Keyword matching (auto campaigns match all)
        if (campaign.targetType == CampaignTargetType.auto) {
          matchingCampaignIds.add(campaign.id);
        } else {
          for (final keyword in campaign.keywords) {
            if (queryWords.any((w) => keyword.toLowerCase().contains(w))) {
              matchingCampaignIds.add(campaign.id);
              break;
            }
          }
        }
      }

      if (matchingCampaignIds.isEmpty) return [];

      // Get active ad products from matching campaigns
      final adProductsQuery = await _adProductsRef
          .where('campaignId', whereIn: matchingCampaignIds.take(10).toList())
          .where('status', isEqualTo: AdProductStatus.active.name)
          .get();

      if (adProductsQuery.docs.isEmpty) return [];

      // Calculate ad scores and rank
      final scoredAds = <MapEntry<AdProductModel, double>>[];

      for (final doc in adProductsQuery.docs) {
        final adProduct = AdProductModel.fromFirestore(doc);
        final score = _calculateAdScore(adProduct);
        scoredAds.add(MapEntry(adProduct, score));
      }

      // Sort by score (descending)
      scoredAds.sort((a, b) => b.value.compareTo(a.value));

      // Return top N winners
      return scoredAds.take(limit).map((e) => e.key).toList();
    } catch (e) {
      debugPrint('❌ Error getting ads for search: $e');
      return [];
    }
  }

  /// Get ads for category page
  Future<List<AdProductModel>> getAdsForCategory({
    required String categoryId,
    int limit = 4,
  }) async {
    try {
      // Get active campaigns targeting this category
      final campaignsQuery = await _campaignsRef
          .where('status', isEqualTo: CampaignStatus.active.name)
          .where('targetType', isEqualTo: CampaignTargetType.category.name)
          .where('categoryId', isEqualTo: categoryId)
          .get();

      // Also include auto campaigns
      final autoCampaignsQuery = await _campaignsRef
          .where('status', isEqualTo: CampaignStatus.active.name)
          .where('targetType', isEqualTo: CampaignTargetType.auto.name)
          .get();

      final allCampaignIds = <dynamic>{
        ...campaignsQuery.docs.map((d) => d.id),
        ...autoCampaignsQuery.docs.map((d) => d.id),
      }.toList();

      if (allCampaignIds.isEmpty) return [];

      // Get ad products
      final adProductsQuery = await _adProductsRef
          .where('campaignId', whereIn: allCampaignIds.take(10).toList())
          .where('status', isEqualTo: AdProductStatus.active.name)
          .get();

      if (adProductsQuery.docs.isEmpty) return [];

      // Rank by score
      final scoredAds = adProductsQuery.docs
          .map((doc) => AdProductModel.fromFirestore(doc))
          .map((ad) => MapEntry(ad, _calculateAdScore(ad)))
          .toList();

      scoredAds.sort((a, b) => b.value.compareTo(a.value));

      return scoredAds.take(limit).map((e) => e.key).toList();
    } catch (e) {
      debugPrint('❌ Error getting ads for category: $e');
      return [];
    }
  }

  /// Get boosted reels for the feed (Phase 2: Reels Boost Ads)
  /// Returns list of reel IDs with their CPV bid amounts
  Future<List<BoostedReelData>> getBoostedReels({int limit = 3}) async {
    try {
      // Get active reel boost campaigns
      final campaignsSnapshot = await _campaignsRef
          .where('status', isEqualTo: CampaignStatus.active.name)
          .where('adType', isEqualTo: AdType.reelsBoost.name)
          .limit(limit * 2) // Get more to filter
          .get();
      
      if (campaignsSnapshot.docs.isEmpty) {
        return [];
      }
      
      List<BoostedReelData> boostedReels = [];
      
      for (final doc in campaignsSnapshot.docs) {
        final campaign = AdCampaignModel.fromFirestore(doc);
        
        // Check if campaign can serve (budget checks)
        if (!campaign.canServeAds) continue;
        
        // Get ad products for this campaign (reels)
        final productsSnapshot = await _adProductsRef
            .where('campaignId', isEqualTo: campaign.id)
            .where('status', isEqualTo: 'active')
            .limit(1)
            .get();
        
        for (final productDoc in productsSnapshot.docs) {
          final adProduct = AdProductModel.fromFirestore(productDoc);
          
          boostedReels.add(BoostedReelData(
            reelId: adProduct.productId, // productId is the reel ID for reels
            campaignId: campaign.id,
            adProductId: adProduct.id,
            sellerId: campaign.sellerId,
            bidAmount: adProduct.bidAmount,
            billingType: campaign.billingType,
          ));
        }
      }
      
      // Sort by bid amount (highest first)
      boostedReels.sort((a, b) => b.bidAmount.compareTo(a.bidAmount));
      
      debugPrint('📺 Found ${boostedReels.length} boosted reels');
      return boostedReels.take(limit).toList();
    } catch (e) {
      debugPrint('❌ Error getting boosted reels: $e');
      return [];
    }
  }

  /// Get category boost ads for premium category placement
  Future<List<AdProductModel>> getCategoryBoostAds({
    required String categoryId,
    int limit = 2,
  }) async {
    try {
      // Get active category boost campaigns for this specific category
      final campaignsSnapshot = await _campaignsRef
          .where('status', isEqualTo: CampaignStatus.active.name)
          .where('adType', isEqualTo: AdType.categoryBoost.name)
          .where('categoryId', isEqualTo: categoryId)
          .get();
      
      if (campaignsSnapshot.docs.isEmpty) {
        return [];
      }
      
      List<MapEntry<AdProductModel, double>> scoredAds = [];
      
      for (final doc in campaignsSnapshot.docs) {
        final campaign = AdCampaignModel.fromFirestore(doc);
        if (!campaign.canServeAds) continue;
        
        final productsSnapshot = await _adProductsRef
            .where('campaignId', isEqualTo: campaign.id)
            .where('status', isEqualTo: 'active')
            .get();
        
        for (final productDoc in productsSnapshot.docs) {
          final adProduct = AdProductModel.fromFirestore(productDoc);
          final score = _calculateAdScore(adProduct, relevanceScore: 1.0);
          scoredAds.add(MapEntry(adProduct, score));
        }
      }
      
      // Sort by score and return top ads
      scoredAds.sort((a, b) => b.value.compareTo(a.value));
      
      debugPrint('🏷️ Found ${scoredAds.length} category boost ads for $categoryId');
      return scoredAds.take(limit).map((e) => e.key).toList();
    } catch (e) {
      debugPrint('❌ Error getting category boost ads: $e');
      return [];
    }
  }

  // =========================================================
  // PHASE 3: BRAND STORE, BANNER, AND RETARGETING ADS
  // =========================================================

  /// Get homepage banner ads (Phase 3)
  /// Returns approved banner campaigns for homepage placement
  Future<List<BannerAdData>> getHomepageBannerAds({int limit = 3}) async {
    try {
      final campaignsSnapshot = await _campaignsRef
          .where('status', isEqualTo: CampaignStatus.active.name)
          .where('adType', isEqualTo: AdType.homeBanner.name)
          .limit(limit)
          .get();
      
      if (campaignsSnapshot.docs.isEmpty) return [];
      
      List<BannerAdData> banners = [];
      for (final doc in campaignsSnapshot.docs) {
        final campaign = AdCampaignModel.fromFirestore(doc);
        if (!campaign.canServeAds) continue;
        
        banners.add(BannerAdData(
          campaignId: campaign.id,
          sellerId: campaign.sellerId,
          imageUrl: campaign.bannerImageUrl ?? '',
          linkUrl: campaign.bannerLinkUrl,
          position: campaign.bannerPosition ?? 0,
          billingType: campaign.billingType,
          bidAmount: campaign.bidAmount,
        ));
      }
      
      // Sort by position
      banners.sort((a, b) => a.position.compareTo(b.position));
      debugPrint('🖼️ Found ${banners.length} homepage banner ads');
      return banners.take(limit).toList();
    } catch (e) {
      debugPrint('❌ Error getting banner ads: $e');
      return [];
    }
  }

  /// Get brand store spotlight ads (Phase 3)
  Future<List<BrandStoreAdData>> getBrandStoreAds({int limit = 4}) async {
    try {
      final campaignsSnapshot = await _campaignsRef
          .where('status', isEqualTo: CampaignStatus.active.name)
          .where('adType', isEqualTo: AdType.brandStore.name)
          .limit(limit * 2)
          .get();
      
      if (campaignsSnapshot.docs.isEmpty) return [];
      
      List<BrandStoreAdData> stores = [];
      for (final doc in campaignsSnapshot.docs) {
        final campaign = AdCampaignModel.fromFirestore(doc);
        if (!campaign.canServeAds) continue;
        
        // Fetch seller details
        final sellerDoc = await _firestore.collection('sellers').doc(campaign.sellerId).get();
        if (!sellerDoc.exists) continue;
        
        final sellerData = sellerDoc.data()!;
        stores.add(BrandStoreAdData(
          campaignId: campaign.id,
          sellerId: campaign.sellerId,
          storeName: sellerData['businessName'] ?? sellerData['name'] ?? 'Store',
          logoUrl: sellerData['logoUrl'] ?? sellerData['profileImageUrl'],
          bidAmount: campaign.bidAmount,
        ));
      }
      
      // Sort by bid amount (highest first)
      stores.sort((a, b) => b.bidAmount.compareTo(a.bidAmount));
      debugPrint('🏪 Found ${stores.length} brand store ads');
      return stores.take(limit).toList();
    } catch (e) {
      debugPrint('❌ Error getting brand store ads: $e');
      return [];
    }
  }

  /// Get retargeting ads based on user intent (Phase 3)
  /// Uses view/wishlist/cart signals to show relevant products
  Future<List<AdProductModel>> getRetargetingAds({
    required String userId,
    int limit = 4,
  }) async {
    try {
      // Get user's recent intent signals
      final intentsSnapshot = await _firestore
          .collection('user_intents')
          .doc(userId)
          .collection('signals')
          .orderBy('timestamp', descending: true)
          .limit(20)
          .get();
      
      if (intentsSnapshot.docs.isEmpty) return [];
      
      // Extract product IDs from intent signals
      final Set<String> targetProductIds = {};
      final Map<String, double> intentMultipliers = {};
      
      for (final doc in intentsSnapshot.docs) {
        final data = doc.data();
        final productId = data['productId'] as String?;
        final intentType = data['type'] as String? ?? 'view';
        
        if (productId != null) {
          targetProductIds.add(productId);
          // Higher multiplier for stronger intent signals
          intentMultipliers[productId] = _getIntentMultiplier(intentType);
        }
      }
      
      if (targetProductIds.isEmpty) return [];
      
      // Get active retargeting campaigns
      final campaignsSnapshot = await _campaignsRef
          .where('status', isEqualTo: CampaignStatus.active.name)
          .where('adType', isEqualTo: AdType.retargeting.name)
          .get();
      
      if (campaignsSnapshot.docs.isEmpty) return [];
      
      List<MapEntry<AdProductModel, double>> scoredAds = [];
      
      for (final doc in campaignsSnapshot.docs) {
        final campaign = AdCampaignModel.fromFirestore(doc);
        if (!campaign.canServeAds) continue;
        
        // Check if campaign has products user viewed
        final productsSnapshot = await _adProductsRef
            .where('campaignId', isEqualTo: campaign.id)
            .where('status', isEqualTo: 'active')
            .get();
        
        for (final productDoc in productsSnapshot.docs) {
          final adProduct = AdProductModel.fromFirestore(productDoc);
          
          // Check if this product matches user intent
          if (targetProductIds.contains(adProduct.productId)) {
            final multiplier = intentMultipliers[adProduct.productId] ?? 1.0;
            final score = _calculateAdScore(adProduct) * multiplier;
            scoredAds.add(MapEntry(adProduct, score));
          }
        }
      }
      
      // Sort by score
      scoredAds.sort((a, b) => b.value.compareTo(a.value));
      debugPrint('🎯 Found ${scoredAds.length} retargeting ads for user');
      return scoredAds.take(limit).map((e) => e.key).toList();
    } catch (e) {
      debugPrint('❌ Error getting retargeting ads: $e');
      return [];
    }
  }

  /// Record user intent signal for retargeting
  Future<void> recordUserIntent({
    required String userId,
    required String productId,
    required UserIntentType intentType,
  }) async {
    try {
      await _firestore
          .collection('user_intents')
          .doc(userId)
          .collection('signals')
          .add({
        'productId': productId,
        'type': intentType.name,
        'timestamp': FieldValue.serverTimestamp(),
      });
    } catch (e) {
      debugPrint('⚠️ Error recording user intent: $e');
    }
  }

  /// Get intent multiplier for retargeting scoring
  double _getIntentMultiplier(String intentType) {
    switch (intentType) {
      case 'cart': return 2.5;      // Highest intent
      case 'wishlist': return 2.0;  // High intent
      case 'purchase': return 1.5;  // May want similar
      case 'view': return 1.0;      // Base intent
      default: return 1.0;
    }
  }

  /// Calculate ad score for auction ranking
  /// Score = (Bid × 0.4) + (CTR × 0.25) + (Relevance × 0.2) + (Seller Rating × 0.15)
  /// This balances advertiser spend with user experience (CTR = users find it relevant)
  double _calculateAdScore(AdProductModel ad, {double? relevanceScore, double? sellerRating}) {
    // Bid weight (40%) - higher bids increase visibility
    final bidWeight = (ad.bidAmount / 15.0).clamp(0.0, 1.0) * 0.4; // Normalized to max ₹15
    
    // CTR weight (25%) - ads users click get priority
    final ctrWeight = (ad.ctr / 5.0).clamp(0.0, 1.0) * 0.25; // Normalized to 5% CTR
    
    // Relevance weight (20%) - based on conversion rate or passed score
    final relevance = relevanceScore ?? (ad.conversionRate / 3.0).clamp(0.0, 1.0); // Normalized to 3% conversion
    final relevanceWeight = relevance * 0.2;
    
    // Seller rating weight (15%) - trusted sellers get slight boost
    final rating = sellerRating ?? 4.0; // Default 4/5 if not provided
    final ratingWeight = (rating / 5.0).clamp(0.0, 1.0) * 0.15;
    
    return bidWeight + ctrWeight + relevanceWeight + ratingWeight;
  }

  // =========================================================
  // IMPRESSION & CLICK TRACKING
  // =========================================================

  /// Record an impression (ad was shown)
  Future<void> recordImpression({
    required String adProductId,
    required String campaignId,
    required String sellerId,
    String? userId,
    required AdPlacement placement,
    String? searchQuery,
    String? categoryId,
  }) async {
    try {
      final impression = AdImpressionModel(
        id: '',
        adProductId: adProductId,
        campaignId: campaignId,
        sellerId: sellerId,
        userId: userId,
        placement: placement,
        searchQuery: searchQuery,
        categoryId: categoryId,
        timestamp: DateTime.now(),
      );

      await _impressionsRef.add(impression.toFirestore());

      // Update impression count on ad product
      await _adProductsRef.doc(adProductId).update({
        'impressions': FieldValue.increment(1),
      });

      // Update campaign stats
      await _campaignsRef.doc(campaignId).update({
        'impressions': FieldValue.increment(1),
      });
    } catch (e) {
      debugPrint('⚠️ Error recording impression: $e');
    }
  }

  /// Record a click (ad was clicked) - BILLABLE EVENT
  Future<bool> recordClick({
    required String adProductId,
    required String campaignId,
    required String sellerId,
    required String productId,
    String? userId,
    required double costPerClick,
    required AdPlacement placement,
    String? searchQuery,
  }) async {
    try {
      // Check if seller has sufficient wallet balance
      final wallet = await getAdWallet(sellerId);
      if (wallet == null || wallet.balance < costPerClick) {
        debugPrint('⚠️ Insufficient ad wallet balance for click');
        // Pause the campaign
        await updateCampaign(campaignId, {
          'status': CampaignStatus.exhausted.name,
        });
        return false;
      }

      // Record the click
      final click = AdClickModel(
        id: '',
        adProductId: adProductId,
        campaignId: campaignId,
        sellerId: sellerId,
        productId: productId,
        userId: userId,
        costPerClick: costPerClick,
        placement: placement,
        searchQuery: searchQuery,
        timestamp: DateTime.now(),
      );

      final clickRef = await _clicksRef.add(click.toFirestore());

      // Deduct from ad wallet
      await _deductFromWallet(
        sellerId: sellerId,
        amount: costPerClick,
        referenceId: clickRef.id,
        description: 'Ad click charge',
      );

      // Update stats
      await _adProductsRef.doc(adProductId).update({
        'clicks': FieldValue.increment(1),
        'spend': FieldValue.increment(costPerClick),
      });

      await _campaignsRef.doc(campaignId).update({
        'clicks': FieldValue.increment(1),
        'spentToday': FieldValue.increment(costPerClick),
        'spentTotal': FieldValue.increment(costPerClick),
      });

      // Check if daily/total budget exhausted
      final campaign = await getCampaign(campaignId);
      if (campaign != null && !campaign.canServeAds) {
        await updateCampaign(campaignId, {
          'status': CampaignStatus.exhausted.name,
        });
      }

      return true;
    } catch (e) {
      debugPrint('❌ Error recording click: $e');
      return false;
    }
  }

  /// Record conversion (user purchased after clicking ad)
  Future<void> recordConversion({
    required String clickId,
    required double orderValue,
  }) async {
    try {
      final clickDoc = await _clicksRef.doc(clickId).get();
      if (!clickDoc.exists) return;

      final click = AdClickModel.fromFirestore(clickDoc);

      await _clicksRef.doc(clickId).update({
        'converted': true,
        'conversionValue': orderValue,
        'conversionAt': FieldValue.serverTimestamp(),
      });

      // Update ad product revenue
      await _adProductsRef.doc(click.adProductId).update({
        'conversions': FieldValue.increment(1),
        'revenue': FieldValue.increment(orderValue),
      });

      // Update campaign
      await _campaignsRef.doc(click.campaignId).update({
        'conversions': FieldValue.increment(1),
      });
    } catch (e) {
      debugPrint('❌ Error recording conversion: $e');
    }
  }

  /// Record a view (for CPV billing) - BILLABLE EVENT for Reels Boost Ads
  /// A view counts after 3 seconds of watch time
  Future<bool> recordView({
    required String adProductId,
    required String campaignId,
    required String sellerId,
    required String reelId,
    String? userId,
    required double costPerView,
    required AdPlacement placement,
  }) async {
    try {
      // Check if seller has sufficient wallet balance
      final wallet = await getAdWallet(sellerId);
      if (wallet == null || wallet.balance < costPerView) {
        debugPrint('⚠️ Insufficient ad wallet balance for view');
        // Pause the campaign
        await updateCampaign(campaignId, {
          'status': CampaignStatus.exhausted.name,
        });
        return false;
      }

      // Record the view in Firestore (separate collection for views)
      final viewRef = await _firestore.collection('ad_views').add({
        'adProductId': adProductId,
        'campaignId': campaignId,
        'sellerId': sellerId,
        'reelId': reelId,
        'userId': userId,
        'costPerView': costPerView,
        'placement': placement.name,
        'timestamp': FieldValue.serverTimestamp(),
      });

      // Deduct from ad wallet
      await _deductFromWallet(
        sellerId: sellerId,
        amount: costPerView,
        referenceId: viewRef.id,
        description: 'Reel view charge (CPV)',
      );

      // Update ad product stats
      await _adProductsRef.doc(adProductId).update({
        'views': FieldValue.increment(1),
        'spend': FieldValue.increment(costPerView),
      });

      // Update campaign stats
      await _campaignsRef.doc(campaignId).update({
        'views': FieldValue.increment(1),
        'spentToday': FieldValue.increment(costPerView),
        'spentTotal': FieldValue.increment(costPerView),
      });

      // Check if daily/total budget exhausted
      final campaign = await getCampaign(campaignId);
      if (campaign != null && !campaign.canServeAds) {
        await updateCampaign(campaignId, {
          'status': CampaignStatus.exhausted.name,
        });
      }

      debugPrint('✅ CPV view recorded: ₹$costPerView for reel $reelId');
      return true;
    } catch (e) {
      debugPrint('❌ Error recording view: $e');
      return false;
    }
  }

  // =========================================================
  // AD WALLET OPERATIONS
  // =========================================================

  /// Get seller's ad wallet
  Future<AdWalletModel?> getAdWallet(String sellerId) async {
    final doc = await _adWalletsRef.doc(sellerId).get();
    if (!doc.exists) return null;
    return AdWalletModel.fromFirestore(doc);
  }

  /// Get or create ad wallet
  Future<AdWalletModel> getOrCreateAdWallet(String sellerId) async {
    final existing = await getAdWallet(sellerId);
    if (existing != null) return existing;

    // Create new wallet
    final wallet = AdWalletModel.empty(sellerId);
    await _adWalletsRef.doc(sellerId).set(wallet.toFirestore());
    return wallet;
  }

  /// Top up ad wallet (direct payment)
  Future<void> topUpAdWallet({
    required String sellerId,
    required double amount,
    required String paymentId,
  }) async {
    final wallet = await getOrCreateAdWallet(sellerId);
    final newBalance = wallet.balance + amount;

    // Create transaction record
    await _walletTransactionsRef.add(AdWalletTransaction(
      id: '',
      sellerId: sellerId,
      type: AdWalletTransactionType.topUp,
      amount: amount,
      balanceBefore: wallet.balance,
      balanceAfter: newBalance,
      description: 'Wallet top-up',
      referenceId: paymentId,
      createdAt: DateTime.now(),
    ).toFirestore());

    // Update wallet
    await _adWalletsRef.doc(sellerId).update({
      'balance': newBalance,
      'totalTopUp': FieldValue.increment(amount),
      'lastTopUpAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  /// Transfer from main seller wallet to ads wallet
  /// Returns a map with success status and message
  Future<Map<String, dynamic>> transferFromMainWallet({
    required String sellerId,
    required double amount,
  }) async {
    try {
      if (amount <= 0) {
        return {'success': false, 'message': 'Amount must be greater than 0'};
      }

      // Use Firestore transaction for atomic operation
      final result = await _firestore.runTransaction<Map<String, dynamic>>((transaction) async {
        // 1. Read main wallet balance
        final sellerRef = _firestore.collection('sellers').doc(sellerId);
        final sellerDoc = await transaction.get(sellerRef);
        
        if (!sellerDoc.exists) {
          return {'success': false, 'message': 'Seller not found'};
        }
        
        final mainBalance = (sellerDoc.data()?['walletBalance'] as num?)?.toDouble() ?? 0.0;

        if (mainBalance < amount) {
          return {
            'success': false, 
            'message': 'Insufficient balance. Available: ₹${mainBalance.toStringAsFixed(2)}'
          };
        }

        // 2. Read or create ad wallet
        final adWalletRef = _adWalletsRef.doc(sellerId);
        final adWalletDoc = await transaction.get(adWalletRef);
        
        double adWalletBalanceBefore = 0.0;
        if (adWalletDoc.exists) {
          adWalletBalanceBefore = (adWalletDoc.data() as Map<String, dynamic>?)?['balance'] as double? ?? 0.0;
        }
        final adWalletBalanceAfter = adWalletBalanceBefore + amount;
        final mainBalanceAfter = mainBalance - amount;

        // 3. Deduct from main wallet
        transaction.update(sellerRef, {
          'walletBalance': FieldValue.increment(-amount),
        });

        // 4. Record debit transaction in main wallet history
        final mainWalletTxRef = _firestore.collection('wallet_transactions').doc();
        transaction.set(mainWalletTxRef, {
          'sellerId': sellerId,
          'type': 'transfer_to_ads',
          'amount': -amount,
          'balanceBefore': mainBalance,
          'balanceAfter': mainBalanceAfter,
          'description': 'Transfer to Ads Wallet',
          'referenceId': 'ad_wallet_transfer',
          'status': 'completed',
          'createdAt': FieldValue.serverTimestamp(),
        });

        // 5. Credit to ads wallet
        if (adWalletDoc.exists) {
          transaction.update(adWalletRef, {
            'balance': adWalletBalanceAfter,
            'totalTransferredIn': FieldValue.increment(amount),
            'updatedAt': FieldValue.serverTimestamp(),
          });
        } else {
          transaction.set(adWalletRef, {
            'balance': amount,
            'totalTopUp': 0.0,
            'totalSpent': 0.0,
            'totalTransferredIn': amount,
            'lowBalanceAlert': true,
            'lowBalanceThreshold': 100.0,
            'createdAt': FieldValue.serverTimestamp(),
            'updatedAt': FieldValue.serverTimestamp(),
          });
        }

        // 6. Record credit transaction in ad wallet history
        final adWalletTxRef = _walletTransactionsRef.doc();
        transaction.set(adWalletTxRef, AdWalletTransaction(
          id: '',
          sellerId: sellerId,
          type: AdWalletTransactionType.transferIn,
          amount: amount,
          balanceBefore: adWalletBalanceBefore,
          balanceAfter: adWalletBalanceAfter,
          description: 'Transfer from main wallet',
          createdAt: DateTime.now(),
        ).toFirestore());

        return {
          'success': true,
          'message': 'Successfully transferred ₹${amount.toStringAsFixed(2)}',
          'mainBalanceBefore': mainBalance,
          'mainBalanceAfter': mainBalanceAfter,
          'adBalanceBefore': adWalletBalanceBefore,
          'adBalanceAfter': adWalletBalanceAfter,
        };
      });

      debugPrint('✅ Transfer completed: ${result['message']}');
      return result;
    } catch (e) {
      debugPrint('❌ Error transferring from main wallet: $e');
      return {'success': false, 'message': 'Transfer failed. Please try again.'};
    }
  }

  /// Get main wallet balance for a seller
  Future<double> getMainWalletBalance(String sellerId) async {
    try {
      final doc = await _firestore.collection('sellers').doc(sellerId).get();
      return (doc.data()?['walletBalance'] as num?)?.toDouble() ?? 0.0;
    } catch (e) {
      debugPrint('❌ Error getting main wallet balance: $e');
      return 0.0;
    }
  }

  /// Internal: Deduct amount from ad wallet
  Future<void> _deductFromWallet({
    required String sellerId,
    required double amount,
    required String referenceId,
    required String description,
  }) async {
    final wallet = await getAdWallet(sellerId);
    if (wallet == null) throw Exception('Ad wallet not found');

    final newBalance = wallet.balance - amount;

    await _walletTransactionsRef.add(AdWalletTransaction(
      id: '',
      sellerId: sellerId,
      type: AdWalletTransactionType.adSpend,
      amount: amount,
      balanceBefore: wallet.balance,
      balanceAfter: newBalance,
      description: description,
      referenceId: referenceId,
      createdAt: DateTime.now(),
    ).toFirestore());

    await _adWalletsRef.doc(sellerId).update({
      'balance': newBalance,
      'totalSpent': FieldValue.increment(amount),
      'lastSpendAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  /// Get wallet transaction history
  Stream<List<AdWalletTransaction>> getWalletTransactions(String sellerId, {int limit = 50}) {
    return _walletTransactionsRef
        .where('sellerId', isEqualTo: sellerId)
        .orderBy('createdAt', descending: true)
        .limit(limit)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => AdWalletTransaction.fromFirestore(doc))
            .toList());
  }

  // =========================================================
  // ANALYTICS
  // =========================================================

  /// Get campaign analytics
  Future<Map<String, dynamic>> getCampaignAnalytics(String campaignId) async {
    final campaign = await getCampaign(campaignId);
    if (campaign == null) return {};

    final adProductsQuery = await _adProductsRef
        .where('campaignId', isEqualTo: campaignId)
        .get();

    int totalImpressions = 0;
    int totalClicks = 0;
    int totalConversions = 0;
    double totalSpend = 0;
    double totalRevenue = 0;

    for (final doc in adProductsQuery.docs) {
      final ad = AdProductModel.fromFirestore(doc);
      totalImpressions += ad.impressions;
      totalClicks += ad.clicks;
      totalConversions += ad.conversions;
      totalSpend += ad.spend;
      totalRevenue += ad.revenue;
    }

    return {
      'campaign': campaign,
      'impressions': totalImpressions,
      'clicks': totalClicks,
      'conversions': totalConversions,
      'spend': totalSpend,
      'revenue': totalRevenue,
      'ctr': totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0.0,
      'conversionRate': totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0.0,
      'acos': totalRevenue > 0 ? (totalSpend / totalRevenue) * 100 : 0.0,
      'roas': totalSpend > 0 ? totalRevenue / totalSpend : 0.0,
    };
  }

  /// Get click placement breakdown for a campaign
  /// Shows sellers WHERE their clicks are coming from (home, productPage, search, etc.)
  Future<Map<String, int>> getClickPlacementBreakdown(String campaignId) async {
    try {
      final clicksQuery = await _clicksRef
          .where('campaignId', isEqualTo: campaignId)
          .get();
      
      final placementCounts = <String, int>{};
      
      for (final doc in clicksQuery.docs) {
        final data = doc.data() as Map<String, dynamic>?;
        final placement = data?['placement']?.toString() ?? 'unknown';
        placementCounts[placement] = (placementCounts[placement] ?? 0) + 1;
      }
      
      return placementCounts;
    } catch (e) {
      debugPrint('❌ Error getting placement breakdown: $e');
      return {};
    }
  }

  /// Get time-series data for campaign analytics charts
  /// Returns impressions and clicks grouped by date for the specified period
  Future<Map<String, List<Map<String, dynamic>>>> getCampaignTimeSeries(
    String campaignId, {
    String period = '7d', // 1d, 7d, 30d, all
  }) async {
    try {
      // Determine date range based on period
      final now = DateTime.now();
      final DateTime startDate;
      
      switch (period) {
        case '1d':
          startDate = DateTime(now.year, now.month, now.day);
          break;
        case '7d':
          startDate = now.subtract(const Duration(days: 7));
          break;
        case '30d':
          startDate = now.subtract(const Duration(days: 30));
          break;
        case 'all':
          // Get campaign start date
          final campaign = await getCampaign(campaignId);
          startDate = campaign?.startDate ?? now.subtract(const Duration(days: 365));
          break;
        default:
          startDate = now.subtract(const Duration(days: 7));
      }

      // Query impressions for this campaign in date range
      final impressionsQuery = await _impressionsRef
          .where('campaignId', isEqualTo: campaignId)
          .where('timestamp', isGreaterThanOrEqualTo: Timestamp.fromDate(startDate))
          .orderBy('timestamp')
          .get();

      // Query clicks for this campaign in date range
      final clicksQuery = await _clicksRef
          .where('campaignId', isEqualTo: campaignId)
          .where('timestamp', isGreaterThanOrEqualTo: Timestamp.fromDate(startDate))
          .orderBy('timestamp')
          .get();

      // Group by date
      final Map<String, int> impressionsByDate = {};
      final Map<String, int> clicksByDate = {};
      final Map<String, double> spendByDate = {};

      // Process impressions
      for (final doc in impressionsQuery.docs) {
        final data = doc.data() as Map<String, dynamic>?;
        if (data == null) continue;
        
        final timestamp = data['timestamp'];
        if (timestamp == null) continue;
        
        final date = (timestamp as Timestamp).toDate();
        final dateKey = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
        impressionsByDate[dateKey] = (impressionsByDate[dateKey] ?? 0) + 1;
      }

      // Process clicks
      for (final doc in clicksQuery.docs) {
        final data = doc.data() as Map<String, dynamic>?;
        if (data == null) continue;
        
        final timestamp = data['timestamp'];
        if (timestamp == null) continue;
        
        final date = (timestamp as Timestamp).toDate();
        final dateKey = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
        clicksByDate[dateKey] = (clicksByDate[dateKey] ?? 0) + 1;
        
        // Sum up spend
        final cpc = (data['costPerClick'] ?? 0.0) as num;
        spendByDate[dateKey] = (spendByDate[dateKey] ?? 0.0) + cpc.toDouble();
      }

      // Generate list of all dates in range (fill empty days with 0)
      final List<Map<String, dynamic>> impressionsData = [];
      final List<Map<String, dynamic>> clicksData = [];
      final List<Map<String, dynamic>> spendData = [];

      DateTime currentDate = startDate;
      while (!currentDate.isAfter(now)) {
        final dateKey = '${currentDate.year}-${currentDate.month.toString().padLeft(2, '0')}-${currentDate.day.toString().padLeft(2, '0')}';
        
        impressionsData.add({
          'date': dateKey,
          'value': impressionsByDate[dateKey] ?? 0,
        });
        clicksData.add({
          'date': dateKey,
          'value': clicksByDate[dateKey] ?? 0,
        });
        spendData.add({
          'date': dateKey,
          'value': spendByDate[dateKey] ?? 0.0,
        });
        
        currentDate = currentDate.add(const Duration(days: 1));
      }

      debugPrint('📊 Loaded time-series: ${impressionsData.length} days, ${impressionsQuery.docs.length} impressions, ${clicksQuery.docs.length} clicks');
      
      return {
        'impressions': impressionsData,
        'clicks': clicksData,
        'spend': spendData,
      };
    } catch (e) {
      debugPrint('❌ Error getting campaign time-series: $e');
      return {
        'impressions': [],
        'clicks': [],
        'spend': [],
      };
    }
  }

  /// Get seller's overall ads analytics
  Future<Map<String, dynamic>> getSellerAdsAnalytics(String sellerId) async {
    final campaignsQuery = await _campaignsRef
        .where('sellerId', isEqualTo: sellerId)
        .get();

    int totalCampaigns = campaignsQuery.docs.length;
    int activeCampaigns = 0;
    double totalSpent = 0;

    for (final doc in campaignsQuery.docs) {
      final campaign = AdCampaignModel.fromFirestore(doc);
      if (campaign.status == CampaignStatus.active) activeCampaigns++;
      totalSpent += campaign.spentTotal;
    }

    final wallet = await getAdWallet(sellerId);

    return {
      'totalCampaigns': totalCampaigns,
      'activeCampaigns': activeCampaigns,
      'totalSpent': totalSpent,
      'walletBalance': wallet?.balance ?? 0.0,
    };
  }

  // =========================================================
  // DAILY RESET (Called by Cloud Function)
  // =========================================================

  /// Reset daily spend for all active campaigns
  Future<void> resetDailySpend() async {
    try {
      final activeCampaigns = await _campaignsRef
          .where('status', isEqualTo: CampaignStatus.active.name)
          .get();

      final batch = _firestore.batch();
      for (final doc in activeCampaigns.docs) {
        batch.update(doc.reference, {'spentToday': 0});
      }
      await batch.commit();

      debugPrint('✅ Reset daily spend for ${activeCampaigns.docs.length} campaigns');
    } catch (e) {
      debugPrint('❌ Error resetting daily spend: $e');
    }
  }

  /// Resume exhausted campaigns if they have remaining budget
  Future<void> resumeEligibleCampaigns() async {
    try {
      final exhaustedCampaigns = await _campaignsRef
          .where('status', isEqualTo: CampaignStatus.exhausted.name)
          .get();

      for (final doc in exhaustedCampaigns.docs) {
        final campaign = AdCampaignModel.fromFirestore(doc);
        
        // Check if total budget still available
        if (campaign.spentTotal < campaign.totalBudget) {
          // Check if end date hasn't passed
          if (campaign.endDate == null || DateTime.now().isBefore(campaign.endDate!)) {
            await doc.reference.update({
              'status': CampaignStatus.active.name,
              'spentToday': 0,
            });
          }
        }
      }
    } catch (e) {
      debugPrint('❌ Error resuming campaigns: $e');
    }
  }
}
