// C3 (Firebase SDK removal, 27 September 2026 review continuation): fromMap/toMap (and the
// Firestore Timestamp/FieldValue.serverTimestamp they used) deleted outright -- grepping every
// real caller anywhere in the app found none: ReturnService.getReturnReasons() (its only
// constructor of this type) is now a plain empty-list stub, and DefaultReturnReasons (this file's
// own Firestore seed data for a `seedDefaultReasons()` method that itself had zero callers) is
// deleted alongside it.
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
