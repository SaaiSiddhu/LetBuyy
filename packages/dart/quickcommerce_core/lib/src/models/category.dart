import 'json_helpers.dart';

class Category {
  const Category({
    required this.id,
    required this.name,
    required this.slug,
    this.parentId,
    this.iconUrl,
    this.displayOrder = 0,
    this.isActive = true,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String? parentId;
  final String name;
  final String slug;
  final String? iconUrl;
  final int displayOrder;
  final bool isActive;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory Category.fromJson(Map<String, dynamic> json) {
    return Category(
      id: json['id'].toString(),
      parentId: json['parent_id']?.toString() ?? json['parentId']?.toString(),
      name: json['name']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
      iconUrl: json['icon_url']?.toString() ?? json['iconUrl']?.toString(),
      displayOrder: parseInt(json['display_order'] ?? json['sort_order'] ?? json['displayOrder']),
      isActive: parseBool(json['is_active'] ?? json['isActive'], true),
      createdAt: parseDateTime(json['created_at'] ?? json['createdAt']),
      updatedAt: parseDateTime(json['updated_at'] ?? json['updatedAt']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'parent_id': parentId,
      'name': name,
      'slug': slug,
      'icon_url': iconUrl,
      'display_order': displayOrder,
      'is_active': isActive,
      'created_at': createdAt?.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
    };
  }

  Category copyWith({
    String? id,
    String? parentId,
    String? name,
    String? slug,
    String? iconUrl,
    int? displayOrder,
    bool? isActive,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Category(
      id: id ?? this.id,
      parentId: parentId ?? this.parentId,
      name: name ?? this.name,
      slug: slug ?? this.slug,
      iconUrl: iconUrl ?? this.iconUrl,
      displayOrder: displayOrder ?? this.displayOrder,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is Category &&
        other.id == id &&
        other.parentId == parentId &&
        other.name == name &&
        other.slug == slug &&
        other.iconUrl == iconUrl &&
        other.displayOrder == displayOrder &&
        other.isActive == isActive &&
        other.createdAt == createdAt &&
        other.updatedAt == updatedAt;
  }

  @override
  int get hashCode => Object.hash(
        id,
        parentId,
        name,
        slug,
        iconUrl,
        displayOrder,
        isActive,
        createdAt,
        updatedAt,
      );

  @override
  String toString() => 'Category(${toJson()})';
}
