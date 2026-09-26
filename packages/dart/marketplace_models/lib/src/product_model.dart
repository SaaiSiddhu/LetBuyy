import 'package:cloud_firestore/cloud_firestore.dart';


// ============================================
// PRODUCT APPROVAL STATUS
// ============================================
enum ProductApprovalStatus { pending, approved, rejected }

// Helper to parse approval status from string
ProductApprovalStatus _parseApprovalStatus(String? status) {
  switch (status?.toLowerCase()) {
    case 'approved':
      return ProductApprovalStatus.approved;
    case 'rejected':
      return ProductApprovalStatus.rejected;
    default:
      return ProductApprovalStatus.pending;
  }
}

// Helper to safely parse timestamps (handles Firestore Timestamp and String)
DateTime? _parseTimestamp(dynamic value) {
  if (value == null) return null;
  if (value is Timestamp) return value.toDate();
  if (value is String) {
    try {
      return DateTime.parse(value);
    } catch (_) {
      return null;
    }
  }
  if (value is DateTime) return value;
  return null;
}


// ============================================
// PRODUCT VARIANT
// ============================================
class ProductVariant {
  final String id;
  final String name;
  final String? sku;
  final double salePrice;
  final double? originalPrice;
  final int stock;
  final List<String> images;
  final Map<String, String> options;

  ProductVariant({
    required this.id,
    required this.name,
    this.sku,
    required this.salePrice,
    this.originalPrice,
    required this.stock,
    this.images = const [],
    required this.options,
  });

  bool get inStock => stock > 0;
  String get primaryImage => images.isNotEmpty ? images.first : '';

  int get discount {
    if (originalPrice != null && originalPrice! > salePrice) {
      return (((originalPrice! - salePrice) / originalPrice!) * 100).round();
    }
    return 0;
  }

  Map<String, dynamic> toMap() => {
        'id': id,
        'name': name,
        'sku': sku,
        'salePrice': salePrice,
        'originalPrice': originalPrice,
        'stock': stock,
        'images': images,
        'options': options,
      };

  factory ProductVariant.fromMap(Map<String, dynamic> map) {
    return ProductVariant(
      id: map['id'] ?? '',
      name: map['name'] ?? '',
      sku: map['sku'],
      salePrice: (map['salePrice'] as num?)?.toDouble() ?? 0.0,
      originalPrice: (map['originalPrice'] as num?)?.toDouble(),
      stock: (map['stock'] as num?)?.toInt() ?? 0,
      images: List<String>.from(map['images'] ?? []),
      options: Map<String, String>.from(map['options'] ?? {}),
    );
  }
}



// ============================================
// VARIANT OPTION
// ============================================
class VariantOption {
  final String name;
  final List<String> values;

  VariantOption({
    required this.name,
    required this.values,
  });

  Map<String, dynamic> toMap() => {
        'name': name,
        'values': values,
      };

  factory VariantOption.fromMap(Map<String, dynamic> map) {
    return VariantOption(
      name: map['name'] ?? '',
      values: List<String>.from(map['values'] ?? []),
    );
  }
}



// ============================================
// MAIN PRODUCT MODEL  (WITH APPROVAL SYSTEM)
// ============================================
class ProductModel {
  final String id;
  final String sellerId;
  // C2 (canonical rewire): the marketplace feed/listing endpoints hand back the seller's display
  // name directly on every row (no separate seller-document fetch needed) -- see
  // ProductProvider._productFromFeedItem/_productFromListingDetail. Null for a product built from
  // any other source that doesn't carry it.
  final String? storeName;
  final String name;
  final String description;
  final double salePrice;
  final double? originalPrice;
  final String categoryId;
  final String? subCategoryId;
  final List<String> images;
  final int stock;
  final double rating;
  final int reviewCount;
  final bool isFeatured;
  final bool isActive;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String? unit;
  final int? minOrderQuantity;
  final int? maxOrderQuantity;
  final bool isNew;
  final bool isVerified;
  final bool isTrending;
  final Map<String, String>? specifications;
  final String? shippingDays;
  final double? shippingPrice;
  final double? freeShippingAbove;
  final bool? isFreeDelivery;
  final bool? expressDelivery;
  final String? expressDeliveryDays;
  final List<VariantOption> variantOptions;
  final List<ProductVariant> variants;
  final List<String>? relatedProductIds;

  // ✅ NEW: Search keywords (max 3) for autocomplete
  final List<String> keywords;

  // ✅ NEW: Dynamic Category Attributes (for faceted search)
  final Map<String, dynamic> attributes;  // Approved attributes
  final Map<String, dynamic>? pendingAttributes;  // Awaiting admin approval

  // ✅ NEW: Approval System Fields
  final ProductApprovalStatus approvalStatus;
  final String? rejectionReason;
  final DateTime? approvedAt;
  final String? approvedBy;
  final String? addedBy;  // 'seller' | 'admin'
  final DateTime? submittedForApprovalAt;

  // ✅ NEW: Shipping Details (weight in kg, dimensions in cm)
  final double? weight;       // Weight in kg
  final double? length;       // Length in cm
  final double? width;        // Width in cm 
  final double? height;       // Height in cm

  // ✅ NEW: Product Statistics (for seller dashboard)
  final int viewCount;        // Total page views from marketplace
  final int totalOrders;      // Total orders containing this product
  final double totalRevenue;  // Total revenue (price × qty - commissions)

  ProductModel({
    required this.id,
    required this.sellerId,
    this.storeName,
    required this.name,
    required this.description,
    required this.salePrice,
    this.originalPrice,
    required this.categoryId,
    this.subCategoryId,
    required this.images,
    required this.stock,
    this.rating = 0.0,
    this.reviewCount = 0,
    this.isFeatured = false,
    this.isActive = true,
    required this.createdAt,
    required this.updatedAt,
    this.unit,
    this.minOrderQuantity,
    this.maxOrderQuantity,
    this.isNew = false,
    this.isVerified = false,
    this.isTrending = false,
    this.specifications,
    this.shippingDays,
    this.shippingPrice,
    this.freeShippingAbove,
    this.isFreeDelivery,
    this.expressDelivery,
    this.expressDeliveryDays,
    this.variantOptions = const [],
    this.variants = const [],
    this.relatedProductIds,
    this.keywords = const [],
    // ✅ NEW: Attribute fields
    this.attributes = const {},
    this.pendingAttributes,
    // ✅ NEW: Approval fields with defaults
    this.approvalStatus = ProductApprovalStatus.approved, // Default approved for backward compatibility
    this.rejectionReason,
    this.approvedAt,
    this.approvedBy,
    this.addedBy,
    this.submittedForApprovalAt,
    // ✅ NEW: Shipping fields
    this.weight,
    this.length,
    this.width,
    this.height,
    // ✅ NEW: Product Statistics
    this.viewCount = 0,
    this.totalOrders = 0,
    this.totalRevenue = 0.0,
  });


  // ============================================
  // BACKWARD COMPATIBLE GETTERS
  // ============================================
  double get price => salePrice;
  String? get imageUrl => images.isNotEmpty ? images.first : null;
  String get category => categoryId;
  bool get inStock => stock > 0;
  String get primaryImage => images.isNotEmpty ? images.first : '';

  // ✅ NEW: Approval getters
  bool get isPending => approvalStatus == ProductApprovalStatus.pending;
  bool get isApproved => approvalStatus == ProductApprovalStatus.approved;
  bool get isRejected => approvalStatus == ProductApprovalStatus.rejected;
  bool get isAddedByAdmin => addedBy == 'admin';
  bool get isAddedBySeller => addedBy == 'seller' || addedBy == null;

  // ✅ NEW: Shipping getters
  /// Volumetric weight = (L × W × H) / 5000
  double get volumetricWeight {
    if (length != null && width != null && height != null) {
      return (length! * width! * height!) / 5000;
    }
    return 0.0;
  }

  /// Chargeable weight = max(actual weight, volumetric weight)
  double get chargeableWeight {
    final actualWeight = weight ?? 0.0;
    return actualWeight > volumetricWeight ? actualWeight : volumetricWeight;
  }

  /// Check if shipping details are complete
  bool get hasShippingDetails => weight != null && weight! > 0;


  int get discount {
    if (originalPrice != null && originalPrice! > salePrice) {
      return (((originalPrice! - salePrice) / originalPrice!) * 100).round();
    }
    return 0;
  }



  // ============================================
  // TO MAP
  // ============================================
  Map<String, dynamic> toMap() {
    return {
      'sellerId': sellerId,
      'name': name,
      'description': description,
      'salePrice': salePrice,
      'originalPrice': originalPrice,
      'categoryId': categoryId,
      'subCategoryId': subCategoryId,
      'images': images,
      'stock': stock,
      'rating': rating,
      'reviewCount': reviewCount,
      'isFeatured': isFeatured,
      'isActive': isActive,
      'createdAt': Timestamp.fromDate(createdAt),
      'updatedAt': Timestamp.fromDate(updatedAt),
      'unit': unit,
      'minOrderQuantity': minOrderQuantity,
      'maxOrderQuantity': maxOrderQuantity,
      'isNew': isNew,
      'isVerified': isVerified,
      'isTrending': isTrending,
      'specifications': specifications,
      'shippingDays': shippingDays,
      'shippingPrice': shippingPrice,
      'freeShippingAbove': freeShippingAbove,
      'isFreeDelivery': isFreeDelivery,
      'expressDelivery': expressDelivery,
      'expressDeliveryDays': expressDeliveryDays,
      'variantOptions': variantOptions.map((e) => e.toMap()).toList(),
      'variants': variants.map((e) => e.toMap()).toList(),
      'relatedProductIds': relatedProductIds,
      'keywords': keywords,
      // ✅ NEW: Category Attributes
      'attributes': attributes,
      'pendingAttributes': pendingAttributes,
      // ✅ NEW: Approval fields
      'approvalStatus': approvalStatus.toString().split('.').last,
      'rejectionReason': rejectionReason,
      'approvedAt': approvedAt != null ? Timestamp.fromDate(approvedAt!) : null,
      'approvedBy': approvedBy,
      'addedBy': addedBy,
      'submittedForApprovalAt': submittedForApprovalAt != null 
          ? Timestamp.fromDate(submittedForApprovalAt!) 
          : null,
      // ✅ NEW: Shipping fields
      'weight': weight,
      'length': length,
      'width': width,
      'height': height,
      // ✅ NEW: Product Statistics
      'viewCount': viewCount,
      'totalOrders': totalOrders,
      'totalRevenue': totalRevenue,
    };
  }


  // REQUIRED FOR YOUR ADMIN SERVICE
  Map<String, dynamic> toJson() => toMap();



  // ============================================
  // FROM MAP
  // ============================================
  factory ProductModel.fromMap(Map<String, dynamic> map, String id) {
    return ProductModel(
      id: id,
      sellerId: map['sellerId'] ?? '',
      name: map['name'] ?? '',
      description: map['description'] ?? '',
      salePrice: (map['salePrice'] as num?)?.toDouble() ?? 0.0,
      originalPrice: (map['originalPrice'] as num?)?.toDouble(),
      categoryId: map['categoryId'] ?? '',
      subCategoryId: map['subCategoryId'],
      images: List<String>.from(map['images'] ?? []),
      stock: (map['stock'] as num?)?.toInt() ?? 0,
      rating: (map['rating'] as num?)?.toDouble() ?? 0.0,
      reviewCount: (map['reviewCount'] as num?)?.toInt() ?? 0,
      isFeatured: map['isFeatured'] ?? false,
      isActive: map['isActive'] ?? true,
      createdAt: _parseTimestamp(map['createdAt']) ?? DateTime.now(),
      updatedAt: _parseTimestamp(map['updatedAt']) ?? DateTime.now(),
      unit: map['unit'],
      minOrderQuantity: (map['minOrderQuantity'] as num?)?.toInt(),
      maxOrderQuantity: (map['maxOrderQuantity'] as num?)?.toInt(),
      isNew: map['isNew'] ?? false,
      isVerified: map['isVerified'] ?? false,
      isTrending: map['isTrending'] ?? false,
      specifications: map['specifications'] != null
          ? Map<String, String>.from(map['specifications'])
          : null,
      shippingDays: map['shippingDays'],
      shippingPrice: (map['shippingPrice'] as num?)?.toDouble(),
      freeShippingAbove: (map['freeShippingAbove'] as num?)?.toDouble(),
      isFreeDelivery: map['isFreeDelivery'],
      expressDelivery: map['expressDelivery'],
      expressDeliveryDays: map['expressDeliveryDays'],
      variantOptions: (map['variantOptions'] as List? ?? [])
          .map((e) => VariantOption.fromMap(e))
          .toList(),
      variants: (map['variants'] as List? ?? [])
          .map((e) => ProductVariant.fromMap(e))
          .toList(),
      relatedProductIds: List<String>.from(map['relatedProductIds'] ?? []),
      keywords: List<String>.from(map['keywords'] ?? []),
      // ✅ NEW: Parse category attributes
      attributes: Map<String, dynamic>.from(map['attributes'] ?? {}),
      pendingAttributes: map['pendingAttributes'] != null
          ? Map<String, dynamic>.from(map['pendingAttributes'])
          : null,
      // ✅ NEW: Parse approval fields (default to approved for backward compatibility)
      approvalStatus: _parseApprovalStatus(map['approvalStatus'] ?? 'approved'),
      rejectionReason: map['rejectionReason'],
      approvedAt: _parseTimestamp(map['approvedAt']),
      approvedBy: map['approvedBy'],
      addedBy: map['addedBy'],
      submittedForApprovalAt: _parseTimestamp(map['submittedForApprovalAt']),
      // ✅ NEW: Shipping fields
      weight: (map['weight'] as num?)?.toDouble(),
      length: (map['length'] as num?)?.toDouble(),
      width: (map['width'] as num?)?.toDouble(),
      height: (map['height'] as num?)?.toDouble(),
      // ✅ NEW: Product Statistics
      viewCount: (map['viewCount'] as num?)?.toInt() ?? 0,
      totalOrders: (map['totalOrders'] as num?)?.toInt() ?? 0,
      totalRevenue: (map['totalRevenue'] as num?)?.toDouble() ?? 0.0,
    );
  }


  // REQUIRED FOR YOUR ADMIN SERVICE
  factory ProductModel.fromJson(Map<String, dynamic> json) {
    final id = json['id'] ?? '';
    return ProductModel.fromMap(json, id);
  }


  factory ProductModel.fromFirestore(DocumentSnapshot doc) {
    return ProductModel.fromMap(doc.data() as Map<String, dynamic>, doc.id);
  }


  // ============================================
  // COPY-WITH (Updated with approval fields)
  // ============================================
  ProductModel copyWith({
    String? id,
    String? sellerId,
    String? storeName,
    String? name,
    String? description,
    double? salePrice,
    double? originalPrice,
    String? categoryId,
    String? subCategoryId,
    List<String>? images,
    int? stock,
    double? rating,
    int? reviewCount,
    bool? isFeatured,
    bool? isActive,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? unit,
    int? minOrderQuantity,
    int? maxOrderQuantity,
    bool? isNew,
    bool? isVerified,
    bool? isTrending,
    Map<String, String>? specifications,
    String? shippingDays,
    double? shippingPrice,
    double? freeShippingAbove,
    bool? isFreeDelivery,
    bool? expressDelivery,
    String? expressDeliveryDays,
    List<VariantOption>? variantOptions,
    List<ProductVariant>? variants,
    List<String>? relatedProductIds,
    List<String>? keywords,
    // ✅ NEW: Attribute fields
    Map<String, dynamic>? attributes,
    Map<String, dynamic>? pendingAttributes,
    // ✅ NEW: Approval fields
    ProductApprovalStatus? approvalStatus,
    String? rejectionReason,
    DateTime? approvedAt,
    String? approvedBy,
    String? addedBy,
    DateTime? submittedForApprovalAt,
    // ✅ NEW: Shipping fields
    double? weight,
    double? length,
    double? width,
    double? height,
    // ✅ NEW: Product Statistics
    int? viewCount,
    int? totalOrders,
    double? totalRevenue,
  }) {
    return ProductModel(
      id: id ?? this.id,
      sellerId: sellerId ?? this.sellerId,
      storeName: storeName ?? this.storeName,
      name: name ?? this.name,
      description: description ?? this.description,
      salePrice: salePrice ?? this.salePrice,
      originalPrice: originalPrice ?? this.originalPrice,
      categoryId: categoryId ?? this.categoryId,
      subCategoryId: subCategoryId ?? this.subCategoryId,
      images: images ?? this.images,
      stock: stock ?? this.stock,
      rating: rating ?? this.rating,
      reviewCount: reviewCount ?? this.reviewCount,
      isFeatured: isFeatured ?? this.isFeatured,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      unit: unit ?? this.unit,
      minOrderQuantity: minOrderQuantity ?? this.minOrderQuantity,
      maxOrderQuantity: maxOrderQuantity ?? this.maxOrderQuantity,
      isNew: isNew ?? this.isNew,
      isVerified: isVerified ?? this.isVerified,
      isTrending: isTrending ?? this.isTrending,
      specifications: specifications ?? this.specifications,
      shippingDays: shippingDays ?? this.shippingDays,
      shippingPrice: shippingPrice ?? this.shippingPrice,
      freeShippingAbove: freeShippingAbove ?? this.freeShippingAbove,
      isFreeDelivery: isFreeDelivery ?? this.isFreeDelivery,
      expressDelivery: expressDelivery ?? this.expressDelivery,
      expressDeliveryDays: expressDeliveryDays ?? this.expressDeliveryDays,
      variantOptions: variantOptions ?? this.variantOptions,
      variants: variants ?? this.variants,
      relatedProductIds: relatedProductIds ?? this.relatedProductIds,
      keywords: keywords ?? this.keywords,
      // ✅ NEW: Attribute fields
      attributes: attributes ?? this.attributes,
      pendingAttributes: pendingAttributes ?? this.pendingAttributes,
      // ✅ NEW: Approval fields
      approvalStatus: approvalStatus ?? this.approvalStatus,
      rejectionReason: rejectionReason ?? this.rejectionReason,
      approvedAt: approvedAt ?? this.approvedAt,
      approvedBy: approvedBy ?? this.approvedBy,
      addedBy: addedBy ?? this.addedBy,
      submittedForApprovalAt: submittedForApprovalAt ?? this.submittedForApprovalAt,
      // ✅ NEW: Shipping fields
      weight: weight ?? this.weight,
      length: length ?? this.length,
      width: width ?? this.width,
      height: height ?? this.height,
      // ✅ NEW: Product Statistics
      viewCount: viewCount ?? this.viewCount,
      totalOrders: totalOrders ?? this.totalOrders,
      totalRevenue: totalRevenue ?? this.totalRevenue,
    );
  }
}