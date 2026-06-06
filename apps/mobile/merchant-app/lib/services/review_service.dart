import 'package:flutter/foundation.dart';

import 'api_client.dart';
import 'skip_needs_backend_exception.dart';

class ProductReviewContract {
  const ProductReviewContract({
    required this.id,
    required this.storeId,
    required this.productId,
    required this.productName,
    required this.customerName,
    required this.customerEmail,
    required this.rating,
    required this.title,
    required this.body,
    required this.status,
    required this.isVerified,
    required this.isApproved,
    required this.helpfulCount,
    required this.createdAt,
  });

  factory ProductReviewContract.fromJson(Map<String, dynamic> json) {
    final status = _stringValue(
      json['status'],
      fallback: _boolValue(json['is_approved']) ? 'approved' : 'pending',
    );
    return ProductReviewContract(
      id: _stringValue(json['id']),
      storeId: _stringValue(json['store_id'] ?? json['site_id']),
      productId: _stringValue(json['product_id']),
      productName: _stringValue(
        json['product_name'],
        fallback: 'Unknown product',
      ),
      customerName: _stringValue(
        json['customer_name'] ?? json['author_name'] ?? json['name'],
        fallback: 'Customer',
      ),
      customerEmail: _stringValue(json['customer_email'] ?? json['email']),
      rating: _numValue(json['rating']).clamp(0, 5).toDouble(),
      title: _stringValue(json['title'], fallback: 'Review'),
      body: _stringValue(json['body'] ?? json['content']),
      status: status,
      isVerified: _boolValue(json['is_verified'] ?? json['verified']),
      isApproved: status == 'approved' || _boolValue(json['is_approved']),
      helpfulCount: _intValue(json['helpful_count']),
      createdAt: _stringValue(json['created_at']),
    );
  }

  final String id;
  final String storeId;
  final String productId;
  final String productName;
  final String customerName;
  final String customerEmail;
  final double rating;
  final String title;
  final String body;
  final String status;
  final bool isVerified;
  final bool isApproved;
  final int helpfulCount;
  final String createdAt;

  ProductReviewContract copyWith({String? status}) {
    final nextStatus = status ?? this.status;
    return ProductReviewContract(
      id: id,
      storeId: storeId,
      productId: productId,
      productName: productName,
      customerName: customerName,
      customerEmail: customerEmail,
      rating: rating,
      title: title,
      body: body,
      status: nextStatus,
      isVerified: isVerified,
      isApproved: nextStatus == 'approved',
      helpfulCount: helpfulCount,
      createdAt: createdAt,
    );
  }

  String get ratingLabel {
    final wholeRating = rating == rating.roundToDouble()
        ? rating.toStringAsFixed(0)
        : rating.toStringAsFixed(1);
    return '$wholeRating / 5';
  }
}

class ReviewReplyInput {
  const ReviewReplyInput({required this.reviewId, required this.message});

  final String reviewId;
  final String message;
}

class ReviewService extends ChangeNotifier {
  ReviewService({required ApiClient api}) : _api = api;

  static const missingReplyRouteId = 'MOBILE_REVIEW_REPLY_ROUTE';

  final ApiClient _api;

  List<ProductReviewContract> _reviews = [];
  List<ProductReviewContract> get reviews => List.unmodifiable(_reviews);

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  Future<List<ProductReviewContract>> fetchReviews(
    String storeId, {
    String status = 'all',
  }) async {
    _isLoading = true;
    notifyListeners();
    try {
      final response = await _api.reviews.list(
        storeId: storeId,
        status: status,
      );
      _reviews = response.data
          .map(ProductReviewContract.fromJson)
          .toList(growable: false);
      return _reviews;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<ProductReviewContract> moderateReview(
    ProductReviewContract review,
    String status,
  ) async {
    final updated = ProductReviewContract.fromJson(
      await _api.reviews.update(review.id, {'status': status}),
    );
    _reviews = _reviews
        .map((item) => item.id == updated.id ? updated : item)
        .toList(growable: false);
    notifyListeners();
    return updated;
  }

  Future<void> deleteReview(ProductReviewContract review) async {
    await _api.reviews.remove(review.id);
    _reviews = _reviews.where((item) => item.id != review.id).toList();
    notifyListeners();
  }

  Future<void> replyToReview(ReviewReplyInput input) async {
    // [SKIP-NEEDS-BACKEND: MOBILE_REVIEW_REPLY_ROUTE]
    throw const SkipNeedsBackendException(
      missingReplyRouteId,
      'Gateway reviews route has no merchant reply endpoint yet.',
    );
  }
}

bool _boolValue(Object? value, {bool fallback = false}) {
  if (value is bool) return value;
  if (value is num) return value != 0;
  if (value is String) return value.toLowerCase() == 'true';
  return fallback;
}

int _intValue(Object? value, {int fallback = 0}) {
  if (value is int) return value;
  if (value is num) return value.round();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

num _numValue(Object? value, {num fallback = 0}) {
  if (value is num) return value;
  if (value is String) return num.tryParse(value) ?? fallback;
  return fallback;
}

String _stringValue(Object? value, {String fallback = ''}) {
  final text = value?.toString().trim();
  return text == null || text.isEmpty ? fallback : text;
}
