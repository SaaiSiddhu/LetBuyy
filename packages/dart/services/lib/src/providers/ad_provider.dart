import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import '../ad_service.dart';

/// Provider for managing ads state in Seller app
class AdProvider with ChangeNotifier {
  final AdService _adService = AdService();

  // State
  List<AdCampaignModel> _campaigns = [];
  AdCampaignModel? _currentCampaign;
  List<AdProductModel> _currentCampaignProducts = [];
  AdWalletModel? _adWallet;
  Map<String, dynamic>? _analytics;
  
  bool _isLoading = false;
  String? _error;

  // Subscriptions
  StreamSubscription? _campaignsSubscription;
  StreamSubscription? _productsSubscription;
  StreamSubscription? _transactionsSubscription;

  String? _sellerId;

  // Getters
  List<AdCampaignModel> get campaigns => _campaigns;
  AdCampaignModel? get currentCampaign => _currentCampaign;
  List<AdProductModel> get currentCampaignProducts => _currentCampaignProducts;
  AdWalletModel? get adWallet => _adWallet;
  Map<String, dynamic>? get analytics => _analytics;
  bool get isLoading => _isLoading;
  String? get error => _error;

  // Computed
  int get activeCampaignsCount => 
      _campaigns.where((c) => c.status == CampaignStatus.active).length;
  
  int get pendingCampaignsCount =>
      _campaigns.where((c) => c.status == CampaignStatus.pendingReview).length;
  
  double get totalSpent =>
      _campaigns.fold(0, (sum, c) => sum + c.spentTotal);

  /// Initialize provider with seller ID
  Future<void> init(String sellerId) async {
    _sellerId = sellerId;
    _isLoading = true;
    notifyListeners();

    try {
      // Load wallet
      _adWallet = await _adService.getOrCreateAdWallet(sellerId);

      // Subscribe to campaigns
      _campaignsSubscription = _adService.getSellerCampaigns(sellerId).listen(
        (campaigns) {
          _campaigns = campaigns;
          notifyListeners();
        },
        onError: (e) {
          _error = 'Failed to load campaigns: $e';
          notifyListeners();
        },
      );

      // Load analytics
      _analytics = await _adService.getSellerAdsAnalytics(sellerId);
    } catch (e) {
      _error = 'Failed to initialize ads: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Create a new campaign
  Future<String?> createCampaign({
    required String name,
    required CampaignTargetType targetType,
    required double dailyBudget,
    required double totalBudget,
    required DateTime startDate,
    DateTime? endDate,
    List<String>? keywords,
    String? categoryId,
  }) async {
    if (_sellerId == null) return null;

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final campaignId = await _adService.createCampaign(
        sellerId: _sellerId!,
        name: name,
        targetType: targetType,
        dailyBudget: dailyBudget,
        totalBudget: totalBudget,
        startDate: startDate,
        endDate: endDate,
        keywords: keywords,
        categoryId: categoryId,
      );
      
      // Refresh analytics
      _analytics = await _adService.getSellerAdsAnalytics(_sellerId!);
      
      return campaignId;
    } catch (e) {
      _error = 'Failed to create campaign: $e';
      return null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Load campaign details
  Future<void> loadCampaign(String campaignId) async {
    _isLoading = true;
    notifyListeners();

    try {
      _currentCampaign = await _adService.getCampaign(campaignId);
      
      // Subscribe to products
      _productsSubscription?.cancel();
      _productsSubscription = _adService.getCampaignProducts(campaignId).listen(
        (products) {
          _currentCampaignProducts = products;
          notifyListeners();
        },
      );
    } catch (e) {
      _error = 'Failed to load campaign: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Add product to current campaign
  Future<bool> addProductToCampaign({
    required String productId,
    required double bidAmount,
  }) async {
    if (_currentCampaign == null || _sellerId == null) return false;

    try {
      await _adService.addProductToCampaign(
        campaignId: _currentCampaign!.id,
        sellerId: _sellerId!,
        productId: productId,
        bidAmount: bidAmount,
      );
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  /// Update product bid
  Future<bool> updateProductBid(String adProductId, double newBid) async {
    try {
      await _adService.updateProductBid(adProductId, newBid);
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  /// Remove product from campaign
  Future<void> removeProduct(String adProductId) async {
    await _adService.removeProductFromCampaign(adProductId);
  }

  /// Pause campaign
  Future<void> pauseCampaign(String campaignId) async {
    await _adService.pauseCampaign(campaignId);
    if (_currentCampaign?.id == campaignId) {
      _currentCampaign = await _adService.getCampaign(campaignId);
      notifyListeners();
    }
  }

  /// Resume campaign
  Future<void> resumeCampaign(String campaignId) async {
    await _adService.resumeCampaign(campaignId);
    if (_currentCampaign?.id == campaignId) {
      _currentCampaign = await _adService.getCampaign(campaignId);
      notifyListeners();
    }
  }

  /// Delete campaign (only for ended/exhausted/rejected/draft/paused)
  Future<bool> deleteCampaign(String campaignId) async {
    _isLoading = true;
    notifyListeners();
    
    try {
      final success = await _adService.deleteCampaign(campaignId);
      if (success) {
        // Remove from local list
        _campaigns.removeWhere((c) => c.id == campaignId);
        if (_currentCampaign?.id == campaignId) {
          _currentCampaign = null;
        }
        // Refresh analytics
        if (_sellerId != null) {
          _analytics = await _adService.getSellerAdsAnalytics(_sellerId!);
        }
      }
      return success;
    } catch (e) {
      _error = 'Failed to delete campaign: $e';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Get campaign analytics
  Future<Map<String, dynamic>> getCampaignAnalytics(String campaignId) async {
    return await _adService.getCampaignAnalytics(campaignId);
  }

  /// Refresh wallet
  Future<void> refreshWallet() async {
    if (_sellerId == null) return;
    _adWallet = await _adService.getAdWallet(_sellerId!);
    notifyListeners();
  }

  /// Top up wallet
  Future<void> topUpWallet(double amount, String paymentId) async {
    if (_sellerId == null) return;
    await _adService.topUpAdWallet(
      sellerId: _sellerId!,
      amount: amount,
      paymentId: paymentId,
    );
    await refreshWallet();
  }

  /// Transfer from main wallet
  Future<bool> transferFromMainWallet(double amount) async {
    if (_sellerId == null) return false;
    final result = await _adService.transferFromMainWallet(
      sellerId: _sellerId!,
      amount: amount,
    );
    final success = result['success'] == true;
    if (success) {
      await refreshWallet();
    }
    return success;
  }

  /// Clear current campaign
  void clearCurrentCampaign() {
    _currentCampaign = null;
    _currentCampaignProducts = [];
    _productsSubscription?.cancel();
    notifyListeners();
  }

  /// Clear error
  void clearError() {
    _error = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _campaignsSubscription?.cancel();
    _productsSubscription?.cancel();
    _transactionsSubscription?.cancel();
    super.dispose();
  }
}
