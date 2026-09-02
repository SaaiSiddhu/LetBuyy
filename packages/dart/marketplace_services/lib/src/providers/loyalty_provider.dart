// Loyalty Provider - State management for loyalty system
import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import '../loyalty_service.dart';

/// Provider for loyalty points and tier management
class LoyaltyProvider with ChangeNotifier {
  final LoyaltyService _loyaltyService = LoyaltyService();

  LoyaltyModel? _loyalty;
  List<LoyaltyTransaction> _transactions = [];
  bool _isLoading = false;
  String? _error;
  StreamSubscription? _loyaltySubscription;
  StreamSubscription? _transactionsSubscription;

  // Getters
  LoyaltyModel? get loyalty => _loyalty;
  List<LoyaltyTransaction> get transactions => _transactions;
  bool get isLoading => _isLoading;
  String? get error => _error;

  /// Current points balance
  int get points => _loyalty?.points ?? 0;

  /// Points as INR value
  double get pointsAsInr => points.toDouble();

  /// Current tier
  LoyaltyTier get currentTier => _loyalty?.currentTier ?? LoyaltyTier.bronze;

  /// Progress to next tier (0.0 - 1.0)
  double get progressToNextTier => _loyalty?.progressToNextTier ?? 0.0;

  /// Amount needed for next tier
  double get amountToNextTier => _loyalty?.amountToNextTier ?? 0.0;

  /// Total orders in current period
  int get totalOrders => _loyalty?.totalOrderCount ?? 0;

  /// Total spent in current period
  double get totalSpent => _loyalty?.totalSpentAmount ?? 0.0;

  // ============================================================
  // INITIALIZATION
  // ============================================================

  /// Initialize loyalty for current user
  Future<void> init() async {
    final userId = FirebaseAuth.instance.currentUser?.uid;
    if (userId == null) {
      _loyalty = null;
      _transactions = [];
      notifyListeners();
      return;
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // Check if tier reset is needed
      await _loyaltyService.checkAndResetTierIfNeeded(userId);

      // Subscribe to loyalty updates
      _loyaltySubscription?.cancel();
      _loyaltySubscription = _loyaltyService.getLoyaltyStream(userId).listen(
        (loyalty) {
          _loyalty = loyalty;
          _isLoading = false;
          notifyListeners();
        },
        onError: (e) {
          _error = 'Failed to load loyalty: $e';
          _isLoading = false;
          notifyListeners();
        },
      );

      // Subscribe to transactions
      _transactionsSubscription?.cancel();
      _transactionsSubscription = _loyaltyService.getTransactionHistory(userId).listen(
        (transactions) {
          _transactions = transactions;
          notifyListeners();
        },
        onError: (e) {
          debugPrint('Error loading transactions: $e');
        },
      );
    } catch (e) {
      _error = 'Failed to initialize loyalty: $e';
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Refresh loyalty data
  Future<void> refresh() async {
    await init();
  }

  // ============================================================
  // POINTS REDEMPTION
  // ============================================================

  /// Redeem points at checkout
  /// Returns true if successful
  Future<bool> redeemPoints(int pointsToRedeem, String orderId) async {
    final userId = FirebaseAuth.instance.currentUser?.uid;
    if (userId == null) {
      _error = 'User not logged in';
      notifyListeners();
      return false;
    }

    if (pointsToRedeem > points) {
      _error = 'Insufficient points';
      notifyListeners();
      return false;
    }

    if (pointsToRedeem <= 0) {
      _error = 'Invalid points amount';
      notifyListeners();
      return false;
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final success = await _loyaltyService.redeemPoints(
        userId: userId,
        pointsToRedeem: pointsToRedeem,
        orderId: orderId,
      );

      _isLoading = false;
      
      if (!success) {
        _error = 'Failed to redeem points';
      }
      
      notifyListeners();
      return success;
    } catch (e) {
      _error = 'Error redeeming points: $e';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Calculate max redeemable points for an order
  /// (50% of order total, or all available points, whichever is less)
  int getMaxRedeemable(double orderTotal) {
    final maxByOrder = (orderTotal * 0.5).floor(); // 50% max
    return points.clamp(0, maxByOrder);
  }

  /// Check if user can redeem points
  bool canRedeemPoints(int amount) {
    return amount > 0 && amount <= points;
  }

  // ============================================================
  // TIER INFO
  // ============================================================

  /// Get benefits for current tier
  List<String> get currentTierBenefits {
    return _getTierBenefits(currentTier);
  }

  /// Get benefits for next tier
  List<String>? get nextTierBenefits {
    if (currentTier == LoyaltyTier.diamond) return null;
    return _getTierBenefits(LoyaltyTier.values[currentTier.index + 1]);
  }

  List<String> _getTierBenefits(LoyaltyTier tier) {
    switch (tier) {
      case LoyaltyTier.bronze:
        return [
          '1% cashback on all orders',
          'Access to exclusive deals',
        ];
      case LoyaltyTier.silver:
        return [
          '1.5% cashback on all orders',
          'Early access to sales',
          'Priority customer support',
        ];
      case LoyaltyTier.gold:
        return [
          '2.5% cashback on all orders',
          'Free express shipping',
          'Birthday rewards',
          'Exclusive gold-only deals',
        ];
      case LoyaltyTier.platinum:
        return [
          '3% cashback on all orders',
          'Free same-day delivery',
          'Extended return window',
          'Personal shopping assistant',
        ];
      case LoyaltyTier.diamond:
        return [
          '5% cashback on all orders',
          'Free unlimited delivery',
          'VIP customer support',
          'Early product access',
          'Exclusive Diamond events',
        ];
    }
  }

  // ============================================================
  // CLEANUP
  // ============================================================

  @override
  void dispose() {
    _loyaltySubscription?.cancel();
    _transactionsSubscription?.cancel();
    super.dispose();
  }

  /// Clear loyalty state (on logout)
  void clear() {
    _loyaltySubscription?.cancel();
    _transactionsSubscription?.cancel();
    _loyalty = null;
    _transactions = [];
    _error = null;
    _isLoading = false;
    notifyListeners();
  }
}
