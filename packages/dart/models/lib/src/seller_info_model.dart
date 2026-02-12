// lib/models/seller_info_model.dart
import 'package:cloud_firestore/cloud_firestore.dart';
import 'seller_model.dart';

/// Minimal seller info displayed on product pages
/// Similar to Amazon/Flipkart seller information sections
class SellerInfoModel {
  final String sellerId;
  final String storeName;
  final String businessCity;
  final String businessState;
  final double rating;
  final int reviewCount;
  final bool isVerified;
  final DateTime? joinedDate;

  SellerInfoModel({
    required this.sellerId,
    required this.storeName,
    required this.businessCity,
    required this.businessState,
    this.rating = 0.0,
    this.reviewCount = 0,
    this.isVerified = false,
    this.joinedDate,
  });

  // ✅ FROM SELLER MODEL (extract minimal info)
  factory SellerInfoModel.fromSellerModel(SellerModel seller) {
    return SellerInfoModel(
      sellerId: seller.sellerId,
      storeName: seller.storeName,
      businessCity: seller.businessCity,
      businessState: seller.businessState,
      rating: seller.rating,
      reviewCount: seller.reviewCount,
      isVerified: seller.isVerified,
      joinedDate: seller.createdAt,
    );
  }

  // ✅ FROM FIRESTORE (minimal fields only)
  factory SellerInfoModel.fromMap(Map<String, dynamic> map, String sellerId) {
    return SellerInfoModel(
      sellerId: sellerId,
      storeName: map['storeName'] ?? '',
      businessCity: map['businessCity'] ?? '',
      businessState: map['businessState'] ?? '',
      rating: (map['rating'] ?? 0).toDouble(),
      reviewCount: map['reviewCount'] ?? 0,
      isVerified: map['verificationStatus'] == 'verified',
      joinedDate: (map['createdAt'] as Timestamp?)?.toDate(),
    );
  }

  // ✅ TO MAP (for caching/storage)
  Map<String, dynamic> toMap() {
    return {
      'sellerId': sellerId,
      'storeName': storeName,
      'businessCity': businessCity,
      'businessState': businessState,
      'rating': rating,
      'reviewCount': reviewCount,
      'isVerified': isVerified,
      'joinedDate': joinedDate != null ? Timestamp.fromDate(joinedDate!) : null,
    };
  }

  // ✅ DISPLAY HELPERS (like Flipkart/Amazon)
  String get location => '$businessCity, $businessState';
  
  String get verificationBadge => isVerified ? '✓ Verified Seller' : '';
  
  String get ratingDisplay => rating > 0 ? '${rating.toStringAsFixed(1)} ★' : 'New Seller';
  
  String get reviewSummary => reviewCount > 0 
      ? '($reviewCount ${reviewCount == 1 ? 'review' : 'reviews'})'
      : '(No reviews yet)';
  
  String get memberSince {
    if (joinedDate == null) return '';
    final now = DateTime.now();
    final diff = now.difference(joinedDate!);
    
    if (diff.inDays < 30) return 'New Seller';
    if (diff.inDays < 365) return 'Member since ${diff.inDays ~/ 30} months';
    return 'Member since ${diff.inDays ~/ 365} ${diff.inDays ~/ 365 == 1 ? 'year' : 'years'}';
  }

  // ✅ TRUST SCORE (like Amazon/Flipkart trust indicators)
  String get trustLevel {
    if (!isVerified) return '⚠️ Not Verified';
    if (rating >= 4.5 && reviewCount >= 100) return '🏆 Top Rated';
    if (rating >= 4.0 && reviewCount >= 50) return '⭐ Highly Rated';
    if (rating >= 3.5) return '👍 Good';
    return '⚠️ Low Rating';
  }

  bool get isTrusted => isVerified && rating >= 3.5;
}
