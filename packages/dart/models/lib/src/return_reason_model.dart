// packages/models/lib/src/return_reason_model.dart
// 📋 Return Reason Master Data

import 'package:cloud_firestore/cloud_firestore.dart';

/// Predefined return reasons
class ReturnReasonModel {
  final String id;
  final String code;
  final String title;
  final String description;
  final bool requiresImage;
  final bool isActive;
  final int sortOrder;
  final DateTime? createdAt;

  const ReturnReasonModel({
    required this.id,
    required this.code,
    required this.title,
    required this.description,
    this.requiresImage = false,
    this.isActive = true,
    this.sortOrder = 0,
    this.createdAt,
  });

  factory ReturnReasonModel.fromMap(Map<String, dynamic> map, String id) {
    return ReturnReasonModel(
      id: id,
      code: map['code'] ?? '',
      title: map['title'] ?? '',
      description: map['description'] ?? '',
      requiresImage: map['requiresImage'] ?? false,
      isActive: map['isActive'] ?? true,
      sortOrder: map['sortOrder'] ?? 0,
      createdAt: map['createdAt'] != null
          ? (map['createdAt'] as Timestamp).toDate()
          : null,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'code': code,
      'title': title,
      'description': description,
      'requiresImage': requiresImage,
      'isActive': isActive,
      'sortOrder': sortOrder,
      'createdAt': createdAt != null
          ? Timestamp.fromDate(createdAt!)
          : FieldValue.serverTimestamp(),
    };
  }

  ReturnReasonModel copyWith({
    String? id,
    String? code,
    String? title,
    String? description,
    bool? requiresImage,
    bool? isActive,
    int? sortOrder,
    DateTime? createdAt,
  }) {
    return ReturnReasonModel(
      id: id ?? this.id,
      code: code ?? this.code,
      title: title ?? this.title,
      description: description ?? this.description,
      requiresImage: requiresImage ?? this.requiresImage,
      isActive: isActive ?? this.isActive,
      sortOrder: sortOrder ?? this.sortOrder,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  String toString() => 'ReturnReasonModel(id: $id, code: $code, title: $title)';
}

/// Default return reasons (seeded in Firestore)
class DefaultReturnReasons {
  static const List<Map<String, dynamic>> reasons = [
    {
      'code': 'wrong_product',
      'title': 'Wrong product delivered',
      'description': 'Received a different product than ordered',
      'requiresImage': true,
      'sortOrder': 1,
    },
    {
      'code': 'damaged',
      'title': 'Product is damaged',
      'description': 'Product arrived broken or damaged',
      'requiresImage': true,
      'sortOrder': 2,
    },
    {
      'code': 'defective',
      'title': 'Product is defective',
      'description': 'Product does not work as expected',
      'requiresImage': true,
      'sortOrder': 3,
    },
    {
      'code': 'not_as_described',
      'title': 'Not as described',
      'description': 'Product does not match the listing',
      'requiresImage': true,
      'sortOrder': 4,
    },
    {
      'code': 'size_issue',
      'title': 'Size/fit issue',
      'description': 'Product size does not fit correctly',
      'requiresImage': false,
      'sortOrder': 5,
    },
    {
      'code': 'quality_issue',
      'title': 'Quality not satisfactory',
      'description': 'Product quality is below expectations',
      'requiresImage': true,
      'sortOrder': 6,
    },
    {
      'code': 'missing_parts',
      'title': 'Missing parts/accessories',
      'description': 'Package is incomplete',
      'requiresImage': true,
      'sortOrder': 7,
    },
    {
      'code': 'changed_mind',
      'title': 'Changed my mind',
      'description': 'No longer need this product',
      'requiresImage': false,
      'sortOrder': 8,
    },
  ];
}
