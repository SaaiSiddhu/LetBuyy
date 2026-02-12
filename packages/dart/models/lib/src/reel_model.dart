import 'package:cloud_firestore/cloud_firestore.dart';

/// Model for a product reel (short-form vertical video)
class ReelModel {
  final String id;
  final String sellerId;
  final String productId;
  
  // Video details
  final String videoUrl;
  final String? thumbnailUrl;
  final int duration; // seconds
  final String aspectRatio; // '9:16'
  
  // Content
  final String caption;
  final List<String> hashtags;
  
  // Status
  final ReelStatus status;
  final String? moderationNote;
  
  // External source info (Instagram/YouTube)
  final String? sourceType;    // 'instagram', 'youtube', or null for upload
  final String? externalUrl;   // Original external URL
  
  // Denormalized product info (for quick display)
  final String productName;
  final double productPrice;
  final double? productSalePrice;
  final String productImage;
  
  // Timestamps
  final DateTime createdAt;
  final DateTime? publishedAt;
  final DateTime? updatedAt;
  
  ReelModel({
    required this.id,
    required this.sellerId,
    required this.productId,
    required this.videoUrl,
    this.thumbnailUrl,
    required this.duration,
    this.aspectRatio = '9:16',
    required this.caption,
    this.hashtags = const [],
    this.status = ReelStatus.processing,
    this.moderationNote,
    this.sourceType,
    this.externalUrl,
    required this.productName,
    required this.productPrice,
    this.productSalePrice,
    required this.productImage,
    required this.createdAt,
    this.publishedAt,
    this.updatedAt,
  });
  
  /// Create from Firestore document
  factory ReelModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return ReelModel.fromMap(data, doc.id);
  }
  
  /// Create from map with optional id override
  factory ReelModel.fromMap(Map<String, dynamic> map, [String? id]) {
    return ReelModel(
      id: id ?? map['id'] ?? '',
      sellerId: map['sellerId'] ?? '',
      productId: map['productId'] ?? '',
      videoUrl: map['videoUrl'] ?? '',
      thumbnailUrl: map['thumbnailUrl'],
      duration: map['duration'] ?? 0,
      aspectRatio: map['aspectRatio'] ?? '9:16',
      caption: map['caption'] ?? '',
      hashtags: List<String>.from(map['hashtags'] ?? []),
      status: ReelStatus.fromString(map['status'] ?? 'processing'),
      moderationNote: map['moderationNote'],
      sourceType: map['sourceType'],
      externalUrl: map['externalUrl'],
      productName: map['productName'] ?? '',
      productPrice: (map['productPrice'] ?? 0).toDouble(),
      productSalePrice: map['productSalePrice']?.toDouble(),
      productImage: map['productImage'] ?? '',
      createdAt: (map['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      publishedAt: (map['publishedAt'] as Timestamp?)?.toDate(),
      updatedAt: (map['updatedAt'] as Timestamp?)?.toDate(),
    );
  }
  
  /// Convert to Firestore map
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'sellerId': sellerId,
      'productId': productId,
      'videoUrl': videoUrl,
      'thumbnailUrl': thumbnailUrl,
      'duration': duration,
      'aspectRatio': aspectRatio,
      'caption': caption,
      'hashtags': hashtags,
      'status': status.value,
      'moderationNote': moderationNote,
      'sourceType': sourceType,
      'externalUrl': externalUrl,
      'productName': productName,
      'productPrice': productPrice,
      'productSalePrice': productSalePrice,
      'productImage': productImage,
      'createdAt': Timestamp.fromDate(createdAt),
      'publishedAt': publishedAt != null ? Timestamp.fromDate(publishedAt!) : null,
      'updatedAt': updatedAt != null ? Timestamp.fromDate(updatedAt!) : null,
    };
  }
  
  /// Create a copy with updated fields
  ReelModel copyWith({
    String? id,
    String? sellerId,
    String? productId,
    String? videoUrl,
    String? thumbnailUrl,
    int? duration,
    String? aspectRatio,
    String? caption,
    List<String>? hashtags,
    ReelStatus? status,
    String? moderationNote,
    String? sourceType,
    String? externalUrl,
    String? productName,
    double? productPrice,
    double? productSalePrice,
    String? productImage,
    DateTime? createdAt,
    DateTime? publishedAt,
    DateTime? updatedAt,
  }) {
    return ReelModel(
      id: id ?? this.id,
      sellerId: sellerId ?? this.sellerId,
      productId: productId ?? this.productId,
      videoUrl: videoUrl ?? this.videoUrl,
      thumbnailUrl: thumbnailUrl ?? this.thumbnailUrl,
      duration: duration ?? this.duration,
      aspectRatio: aspectRatio ?? this.aspectRatio,
      caption: caption ?? this.caption,
      hashtags: hashtags ?? this.hashtags,
      status: status ?? this.status,
      moderationNote: moderationNote ?? this.moderationNote,
      sourceType: sourceType ?? this.sourceType,
      externalUrl: externalUrl ?? this.externalUrl,
      productName: productName ?? this.productName,
      productPrice: productPrice ?? this.productPrice,
      productSalePrice: productSalePrice ?? this.productSalePrice,
      productImage: productImage ?? this.productImage,
      createdAt: createdAt ?? this.createdAt,
      publishedAt: publishedAt ?? this.publishedAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
  
  /// Get the display price (sale price or regular)
  double get displayPrice => productSalePrice ?? productPrice;
  
  /// Check if product has a discount
  bool get hasDiscount => productSalePrice != null && productSalePrice! < productPrice;
  
  /// Get discount percentage
  int get discountPercentage {
    if (!hasDiscount) return 0;
    return (((productPrice - productSalePrice!) / productPrice) * 100).round();
  }
  
  /// Check if reel is active and visible
  bool get isActive => status == ReelStatus.active;
  
  /// Check if reel is pending moderation
  bool get isPending => status == ReelStatus.pending;
  
  /// Check if reel is still processing
  bool get isProcessing => status == ReelStatus.processing;
  
  @override
  String toString() => 'ReelModel(id: $id, productName: $productName, status: $status)';
}

/// Reel status enum
enum ReelStatus {
  processing('processing'),
  pending('pending'),
  active('active'),
  rejected('rejected'),
  removed('removed');
  
  final String value;
  const ReelStatus(this.value);
  
  static ReelStatus fromString(String value) {
    return ReelStatus.values.firstWhere(
      (s) => s.value == value,
      orElse: () => ReelStatus.processing,
    );
  }
  
  String get displayName {
    switch (this) {
      case ReelStatus.processing:
        return 'Processing';
      case ReelStatus.pending:
        return 'Pending Review';
      case ReelStatus.active:
        return 'Active';
      case ReelStatus.rejected:
        return 'Rejected';
      case ReelStatus.removed:
        return 'Removed';
    }
  }
}
