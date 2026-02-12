import 'package:cloud_firestore/cloud_firestore.dart';

/// Statistics model for a reel
class ReelStatsModel {
  final String reelId;
  final int views;
  final int uniqueViews;
  final int likes;
  final int shares;
  final int comments;
  final int addToCartCount;
  final int purchaseCount;
  final double revenue;
  final double avgWatchTime; // seconds
  final DateTime lastUpdated;
  
  ReelStatsModel({
    required this.reelId,
    this.views = 0,
    this.uniqueViews = 0,
    this.likes = 0,
    this.shares = 0,
    this.comments = 0,
    this.addToCartCount = 0,
    this.purchaseCount = 0,
    this.revenue = 0.0,
    this.avgWatchTime = 0.0,
    DateTime? lastUpdated,
  }) : lastUpdated = lastUpdated ?? DateTime.now();
  
  /// Create from Firestore document
  factory ReelStatsModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return ReelStatsModel.fromMap(data, doc.id);
  }
  
  /// Create from map with optional id override
  factory ReelStatsModel.fromMap(Map<String, dynamic> map, [String? reelId]) {
    return ReelStatsModel(
      reelId: reelId ?? map['reelId'] ?? '',
      views: map['views'] ?? 0,
      uniqueViews: map['uniqueViews'] ?? 0,
      likes: map['likes'] ?? 0,
      shares: map['shares'] ?? 0,
      comments: map['comments'] ?? 0,
      addToCartCount: map['addToCartCount'] ?? 0,
      purchaseCount: map['purchaseCount'] ?? 0,
      revenue: (map['revenue'] ?? 0).toDouble(),
      avgWatchTime: (map['avgWatchTime'] ?? 0).toDouble(),
      lastUpdated: (map['lastUpdated'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }
  
  /// Create empty stats for a new reel
  factory ReelStatsModel.empty(String reelId) {
    return ReelStatsModel(reelId: reelId);
  }
  
  /// Convert to Firestore map
  Map<String, dynamic> toMap() {
    return {
      'reelId': reelId,
      'views': views,
      'uniqueViews': uniqueViews,
      'likes': likes,
      'shares': shares,
      'comments': comments,
      'addToCartCount': addToCartCount,
      'purchaseCount': purchaseCount,
      'revenue': revenue,
      'avgWatchTime': avgWatchTime,
      'lastUpdated': Timestamp.fromDate(lastUpdated),
    };
  }
  
  /// Create a copy with updated fields
  ReelStatsModel copyWith({
    String? reelId,
    int? views,
    int? uniqueViews,
    int? likes,
    int? shares,
    int? comments,
    int? addToCartCount,
    int? purchaseCount,
    double? revenue,
    double? avgWatchTime,
    DateTime? lastUpdated,
  }) {
    return ReelStatsModel(
      reelId: reelId ?? this.reelId,
      views: views ?? this.views,
      uniqueViews: uniqueViews ?? this.uniqueViews,
      likes: likes ?? this.likes,
      shares: shares ?? this.shares,
      comments: comments ?? this.comments,
      addToCartCount: addToCartCount ?? this.addToCartCount,
      purchaseCount: purchaseCount ?? this.purchaseCount,
      revenue: revenue ?? this.revenue,
      avgWatchTime: avgWatchTime ?? this.avgWatchTime,
      lastUpdated: lastUpdated ?? this.lastUpdated,
    );
  }
  
  /// Format views for display (e.g., 1.2K, 5.4M)
  String get formattedViews => _formatNumber(views);
  
  /// Format likes for display
  String get formattedLikes => _formatNumber(likes);
  
  /// Format shares for display
  String get formattedShares => _formatNumber(shares);
  
  /// Get conversion rate (add to cart / views)
  double get addToCartRate {
    if (views == 0) return 0;
    return (addToCartCount / views) * 100;
  }
  
  /// Get purchase conversion rate (purchases / views)
  double get purchaseRate {
    if (views == 0) return 0;
    return (purchaseCount / views) * 100;
  }
  
  /// Get engagement rate (likes + comments + shares / views)
  double get engagementRate {
    if (views == 0) return 0;
    return ((likes + comments + shares) / views) * 100;
  }
  
  /// Format large numbers with K/M suffix
  String _formatNumber(int number) {
    if (number >= 1000000) {
      return '${(number / 1000000).toStringAsFixed(1)}M';
    } else if (number >= 1000) {
      return '${(number / 1000).toStringAsFixed(1)}K';
    }
    return number.toString();
  }
  
  @override
  String toString() => 'ReelStatsModel(reelId: $reelId, views: $views, likes: $likes)';
}

/// Model for tracking individual user interactions with a reel
class ReelInteractionModel {
  final String id;
  final String reelId;
  final String userId;
  final bool liked;
  final double watchTime; // seconds
  final bool addedToCart;
  final bool purchased;
  final DateTime timestamp;
  
  ReelInteractionModel({
    required this.id,
    required this.reelId,
    required this.userId,
    this.liked = false,
    this.watchTime = 0,
    this.addedToCart = false,
    this.purchased = false,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();
  
  /// Create from Firestore document
  factory ReelInteractionModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return ReelInteractionModel.fromMap(data, doc.id);
  }
  
  /// Create from map with optional id override
  factory ReelInteractionModel.fromMap(Map<String, dynamic> map, [String? id]) {
    return ReelInteractionModel(
      id: id ?? map['id'] ?? '',
      reelId: map['reelId'] ?? '',
      userId: map['userId'] ?? '',
      liked: map['liked'] ?? false,
      watchTime: (map['watchTime'] ?? 0).toDouble(),
      addedToCart: map['addedToCart'] ?? false,
      purchased: map['purchased'] ?? false,
      timestamp: (map['timestamp'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }
  
  /// Convert to Firestore map
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'reelId': reelId,
      'userId': userId,
      'liked': liked,
      'watchTime': watchTime,
      'addedToCart': addedToCart,
      'purchased': purchased,
      'timestamp': Timestamp.fromDate(timestamp),
    };
  }
  
  /// Create a copy with updated fields
  ReelInteractionModel copyWith({
    String? id,
    String? reelId,
    String? userId,
    bool? liked,
    double? watchTime,
    bool? addedToCart,
    bool? purchased,
    DateTime? timestamp,
  }) {
    return ReelInteractionModel(
      id: id ?? this.id,
      reelId: reelId ?? this.reelId,
      userId: userId ?? this.userId,
      liked: liked ?? this.liked,
      watchTime: watchTime ?? this.watchTime,
      addedToCart: addedToCart ?? this.addedToCart,
      purchased: purchased ?? this.purchased,
      timestamp: timestamp ?? this.timestamp,
    );
  }
}
