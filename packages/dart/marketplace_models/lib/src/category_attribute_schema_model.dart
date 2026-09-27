// lib/src/category_attribute_schema_model.dart
// Category-based attribute schema for Amazon-style faceted search

// Phase 1R (Firebase removal, final pass): category_attribute_service.dart (deleted) was the only
// writer/reader of these schemas, entirely Firestore-backed, with no canonical successor --
// filter_drawer.dart (this model's one remaining consumer) now decides locally that zero
// attribute schemas exist rather than asking a dead backend, so nothing ever calls toMap/fromMap/
// fromFirestore any more; removed along with the cloud_firestore import and Timestamp coupling.
// PendingAttributeRequest (the seller-side "propose a new attribute" workflow) had no consumer
// anywhere outside category_attribute_service.dart even before that service was deleted -- removed
// as genuinely dead, not merely disconnected.

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

// ============================================
// APPROVAL STATUS ENUM
// ============================================
enum AttributeApprovalStatus {
  approved,   // Visible in marketplace filters
  pending,    // Awaiting admin approval (seller added)
  rejected,   // Rejected by admin
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
