// lib/src/category_attribute_schema_model.dart
// Category-based attribute schema for Amazon-style faceted search

import 'package:cloud_firestore/cloud_firestore.dart';

// ============================================
// ATTRIBUTE TYPE ENUM
// ============================================
enum AttributeType {
  enum_,        // Single selection dropdown
  multiSelect,  // Multi-select chips
  range,        // Min-Max range (e.g., price)
  text,         // Free text input
  boolean_,     // Yes/No toggle
}

// Helper to parse attribute type
AttributeType _parseAttributeType(String? type) {
  switch (type?.toLowerCase()) {
    case 'enum':
    case 'enum_':
      return AttributeType.enum_;
    case 'multiselect':
    case 'multi_select':
      return AttributeType.multiSelect;
    case 'range':
      return AttributeType.range;
    case 'text':
      return AttributeType.text;
    case 'boolean':
    case 'boolean_':
      return AttributeType.boolean_;
    default:
      return AttributeType.enum_;
  }
}

// ============================================
// APPROVAL STATUS ENUM
// ============================================
enum AttributeApprovalStatus {
  approved,   // Visible in marketplace filters
  pending,    // Awaiting admin approval (seller added)
  rejected,   // Rejected by admin
}

AttributeApprovalStatus _parseApprovalStatus(String? status) {
  switch (status?.toLowerCase()) {
    case 'approved':
      return AttributeApprovalStatus.approved;
    case 'pending':
      return AttributeApprovalStatus.pending;
    case 'rejected':
      return AttributeApprovalStatus.rejected;
    default:
      return AttributeApprovalStatus.approved;
  }
}

// ============================================
// ATTRIBUTE FIELD MODEL
// ============================================
/// Represents a single attribute field in a category schema
class AttributeField {
  final String key;              // e.g., "ram", "color", "size"
  final String label;            // e.g., "RAM", "Color", "Size"
  final AttributeType type;      // enum, multiSelect, range, text
  final List<String> options;    // Predefined values for enum/multiSelect
  final bool isFilterable;       // Show in marketplace filters
  final bool isRequired;         // Mandatory in seller form
  final int displayOrder;        // Sort order in form/filters
  final AttributeApprovalStatus status;  // Approval status
  final String? addedBy;         // sellerId if manually added

  AttributeField({
    required this.key,
    required this.label,
    required this.type,
    this.options = const [],
    this.isFilterable = true,
    this.isRequired = false,
    this.displayOrder = 0,
    this.status = AttributeApprovalStatus.approved,
    this.addedBy,
  });

  // --- Convenience getters ---
  bool get isApproved => status == AttributeApprovalStatus.approved;
  bool get isPending => status == AttributeApprovalStatus.pending;
  bool get isRejected => status == AttributeApprovalStatus.rejected;
  bool get isSellerAdded => addedBy != null && addedBy!.isNotEmpty;

  /// Convert to Firestore map
  Map<String, dynamic> toMap() => {
    'key': key,
    'label': label,
    'type': type.name,
    'options': options,
    'isFilterable': isFilterable,
    'isRequired': isRequired,
    'displayOrder': displayOrder,
    'status': status.name,
    'addedBy': addedBy,
  };

  /// Create from Firestore map
  factory AttributeField.fromMap(Map<String, dynamic> map) {
    return AttributeField(
      key: map['key'] ?? '',
      label: map['label'] ?? '',
      type: _parseAttributeType(map['type']),
      options: List<String>.from(map['options'] ?? []),
      isFilterable: map['isFilterable'] ?? true,
      isRequired: map['isRequired'] ?? false,
      displayOrder: (map['displayOrder'] as num?)?.toInt() ?? 0,
      status: _parseApprovalStatus(map['status']),
      addedBy: map['addedBy'],
    );
  }

  /// Create a copy with modifications
  AttributeField copyWith({
    String? key,
    String? label,
    AttributeType? type,
    List<String>? options,
    bool? isFilterable,
    bool? isRequired,
    int? displayOrder,
    AttributeApprovalStatus? status,
    String? addedBy,
  }) {
    return AttributeField(
      key: key ?? this.key,
      label: label ?? this.label,
      type: type ?? this.type,
      options: options ?? this.options,
      isFilterable: isFilterable ?? this.isFilterable,
      isRequired: isRequired ?? this.isRequired,
      displayOrder: displayOrder ?? this.displayOrder,
      status: status ?? this.status,
      addedBy: addedBy ?? this.addedBy,
    );
  }
}

// ============================================
// CATEGORY ATTRIBUTE SCHEMA MODEL
// ============================================
/// Contains all attributes for a specific category
class CategoryAttributeSchema {
  final String categoryId;        // e.g., "electronics_phones"
  final String displayName;       // e.g., "Mobile Phones"
  final List<AttributeField> attributes;
  final DateTime createdAt;
  final DateTime updatedAt;

  CategoryAttributeSchema({
    required this.categoryId,
    required this.displayName,
    required this.attributes,
    required this.createdAt,
    required this.updatedAt,
  });

  // --- Convenience getters ---
  
  /// Only approved attributes (for marketplace)
  List<AttributeField> get approvedAttributes =>
      attributes.where((a) => a.isApproved).toList();

  /// Only filterable approved attributes
  List<AttributeField> get filterableAttributes =>
      approvedAttributes.where((a) => a.isFilterable).toList();

  /// Required attributes for seller form
  List<AttributeField> get requiredAttributes =>
      attributes.where((a) => a.isRequired).toList();

  /// Pending attributes awaiting approval
  List<AttributeField> get pendingAttributes =>
      attributes.where((a) => a.isPending).toList();

  /// Sorted attributes for display
  List<AttributeField> get sortedAttributes {
    final sorted = List<AttributeField>.from(attributes);
    sorted.sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
    return sorted;
  }

  /// Convert to Firestore map
  Map<String, dynamic> toMap() => {
    'categoryId': categoryId,
    'displayName': displayName,
    'attributes': attributes.map((a) => a.toMap()).toList(),
    'createdAt': Timestamp.fromDate(createdAt),
    'updatedAt': Timestamp.fromDate(updatedAt),
  };

  /// Create from Firestore map
  factory CategoryAttributeSchema.fromMap(Map<String, dynamic> map, String id) {
    return CategoryAttributeSchema(
      categoryId: id,
      displayName: map['displayName'] ?? '',
      attributes: (map['attributes'] as List? ?? [])
          .map((a) => AttributeField.fromMap(a as Map<String, dynamic>))
          .toList(),
      createdAt: (map['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      updatedAt: (map['updatedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  factory CategoryAttributeSchema.fromFirestore(DocumentSnapshot doc) {
    return CategoryAttributeSchema.fromMap(
      doc.data() as Map<String, dynamic>,
      doc.id,
    );
  }

  /// Create a copy with modifications
  CategoryAttributeSchema copyWith({
    String? categoryId,
    String? displayName,
    List<AttributeField>? attributes,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return CategoryAttributeSchema(
      categoryId: categoryId ?? this.categoryId,
      displayName: displayName ?? this.displayName,
      attributes: attributes ?? this.attributes,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

// ============================================
// PENDING ATTRIBUTE REQUEST MODEL
// ============================================
/// Seller's request to add a new attribute to a category
class PendingAttributeRequest {
  final String id;
  final String categoryId;
  final String sellerId;
  final String attributeKey;
  final String attributeLabel;
  final AttributeType attributeType;
  final List<String> suggestedOptions;
  final String sampleValue;          // Example value from seller's product
  final String? productId;           // Product where this was first used
  final AttributeApprovalStatus status;
  final String? rejectionReason;
  final DateTime createdAt;
  final DateTime? reviewedAt;
  final String? reviewedBy;          // Admin who reviewed

  PendingAttributeRequest({
    required this.id,
    required this.categoryId,
    required this.sellerId,
    required this.attributeKey,
    required this.attributeLabel,
    required this.attributeType,
    this.suggestedOptions = const [],
    required this.sampleValue,
    this.productId,
    this.status = AttributeApprovalStatus.pending,
    this.rejectionReason,
    required this.createdAt,
    this.reviewedAt,
    this.reviewedBy,
  });

  bool get isPending => status == AttributeApprovalStatus.pending;
  bool get isApproved => status == AttributeApprovalStatus.approved;
  bool get isRejected => status == AttributeApprovalStatus.rejected;

  Map<String, dynamic> toMap() => {
    'categoryId': categoryId,
    'sellerId': sellerId,
    'attributeKey': attributeKey,
    'attributeLabel': attributeLabel,
    'attributeType': attributeType.name,
    'suggestedOptions': suggestedOptions,
    'sampleValue': sampleValue,
    'productId': productId,
    'status': status.name,
    'rejectionReason': rejectionReason,
    'createdAt': Timestamp.fromDate(createdAt),
    'reviewedAt': reviewedAt != null ? Timestamp.fromDate(reviewedAt!) : null,
    'reviewedBy': reviewedBy,
  };

  factory PendingAttributeRequest.fromMap(Map<String, dynamic> map, String id) {
    return PendingAttributeRequest(
      id: id,
      categoryId: map['categoryId'] ?? '',
      sellerId: map['sellerId'] ?? '',
      attributeKey: map['attributeKey'] ?? '',
      attributeLabel: map['attributeLabel'] ?? '',
      attributeType: _parseAttributeType(map['attributeType']),
      suggestedOptions: List<String>.from(map['suggestedOptions'] ?? []),
      sampleValue: map['sampleValue'] ?? '',
      productId: map['productId'],
      status: _parseApprovalStatus(map['status']),
      rejectionReason: map['rejectionReason'],
      createdAt: (map['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      reviewedAt: (map['reviewedAt'] as Timestamp?)?.toDate(),
      reviewedBy: map['reviewedBy'],
    );
  }

  factory PendingAttributeRequest.fromFirestore(DocumentSnapshot doc) {
    return PendingAttributeRequest.fromMap(
      doc.data() as Map<String, dynamic>,
      doc.id,
    );
  }
}
