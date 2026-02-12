// packages/models/lib/src/return_qc_model.dart
// 🔍 Quality Check Model for Returns

import 'package:cloud_firestore/cloud_firestore.dart';

/// Quality check result at doorstep pickup
class ReturnQCModel {
  final String id;
  final String returnRequestId;
  final String performedBy; // Pickup agent or seller ID
  final String performedByName;
  final DateTime performedAt;
  
  // QC Result
  final QCResult result;
  final String? remarks;
  
  // Product condition checks
  final bool productMatches; // Is it the same product?
  final bool productIntact; // Is it undamaged?
  final bool packagingOk; // Is original packaging present?
  final bool accessoriesPresent; // Are all accessories present?
  
  // Evidence
  final List<String> photos;
  final String? videoUrl;
  
  // For QC failures
  final String? rejectionReason;
  
  final DateTime? createdAt;

  const ReturnQCModel({
    required this.id,
    required this.returnRequestId,
    required this.performedBy,
    required this.performedByName,
    required this.performedAt,
    required this.result,
    this.remarks,
    this.productMatches = true,
    this.productIntact = true,
    this.packagingOk = true,
    this.accessoriesPresent = true,
    this.photos = const [],
    this.videoUrl,
    this.rejectionReason,
    this.createdAt,
  });

  factory ReturnQCModel.fromMap(Map<String, dynamic> map, String id) {
    return ReturnQCModel(
      id: id,
      returnRequestId: map['returnRequestId'] ?? '',
      performedBy: map['performedBy'] ?? '',
      performedByName: map['performedByName'] ?? '',
      performedAt: map['performedAt'] != null
          ? (map['performedAt'] as Timestamp).toDate()
          : DateTime.now(),
      result: QCResultExtension.fromJson(map['result'] ?? 'pending'),
      remarks: map['remarks'],
      productMatches: map['productMatches'] ?? true,
      productIntact: map['productIntact'] ?? true,
      packagingOk: map['packagingOk'] ?? true,
      accessoriesPresent: map['accessoriesPresent'] ?? true,
      photos: List<String>.from(map['photos'] ?? []),
      videoUrl: map['videoUrl'],
      rejectionReason: map['rejectionReason'],
      createdAt: map['createdAt'] != null
          ? (map['createdAt'] as Timestamp).toDate()
          : null,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'returnRequestId': returnRequestId,
      'performedBy': performedBy,
      'performedByName': performedByName,
      'performedAt': Timestamp.fromDate(performedAt),
      'result': result.toJson(),
      'remarks': remarks,
      'productMatches': productMatches,
      'productIntact': productIntact,
      'packagingOk': packagingOk,
      'accessoriesPresent': accessoriesPresent,
      'photos': photos,
      'videoUrl': videoUrl,
      'rejectionReason': rejectionReason,
      'createdAt': createdAt != null
          ? Timestamp.fromDate(createdAt!)
          : FieldValue.serverTimestamp(),
    };
  }

  /// Check if all conditions are met for approval
  bool get allConditionsMet =>
      productMatches && productIntact && packagingOk && accessoriesPresent;

  ReturnQCModel copyWith({
    String? id,
    String? returnRequestId,
    String? performedBy,
    String? performedByName,
    DateTime? performedAt,
    QCResult? result,
    String? remarks,
    bool? productMatches,
    bool? productIntact,
    bool? packagingOk,
    bool? accessoriesPresent,
    List<String>? photos,
    String? videoUrl,
    String? rejectionReason,
    DateTime? createdAt,
  }) {
    return ReturnQCModel(
      id: id ?? this.id,
      returnRequestId: returnRequestId ?? this.returnRequestId,
      performedBy: performedBy ?? this.performedBy,
      performedByName: performedByName ?? this.performedByName,
      performedAt: performedAt ?? this.performedAt,
      result: result ?? this.result,
      remarks: remarks ?? this.remarks,
      productMatches: productMatches ?? this.productMatches,
      productIntact: productIntact ?? this.productIntact,
      packagingOk: packagingOk ?? this.packagingOk,
      accessoriesPresent: accessoriesPresent ?? this.accessoriesPresent,
      photos: photos ?? this.photos,
      videoUrl: videoUrl ?? this.videoUrl,
      rejectionReason: rejectionReason ?? this.rejectionReason,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  String toString() =>
      'ReturnQCModel(id: $id, result: ${result.name}, allConditionsMet: $allConditionsMet)';
}

/// QC result outcomes
enum QCResult {
  pending,
  passed,
  failed,
  partiallyPassed,
}

extension QCResultExtension on QCResult {
  String get displayName {
    switch (this) {
      case QCResult.pending:
        return 'Pending';
      case QCResult.passed:
        return 'Passed';
      case QCResult.failed:
        return 'Failed';
      case QCResult.partiallyPassed:
        return 'Partially Passed';
    }
  }

  String get description {
    switch (this) {
      case QCResult.pending:
        return 'Quality check not yet performed';
      case QCResult.passed:
        return 'Product meets all return criteria';
      case QCResult.failed:
        return 'Product does not meet return criteria';
      case QCResult.partiallyPassed:
        return 'Some conditions not met, review required';
    }
  }

  String toJson() => name;

  static QCResult fromJson(String json) {
    return QCResult.values.firstWhere(
      (result) => result.name == json,
      orElse: () => QCResult.pending,
    );
  }
}
