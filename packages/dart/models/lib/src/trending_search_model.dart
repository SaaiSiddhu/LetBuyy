import 'package:cloud_firestore/cloud_firestore.dart';

/// Model for admin-managed trending searches
/// Displayed on search screen to guide user searches
class TrendingSearchModel {
  final String id;
  final String text;           // Search term text
  final String? imageUrl;      // Optional trending icon/image
  final String? appRoute;      // In-app route (e.g., '/search?q=samsung')
  final String? webUrl;        // Web URL for web platform
  final int priority;          // Display order (lower = first)
  final bool isActive;
  final DateTime createdAt;
  final DateTime updatedAt;

  TrendingSearchModel({
    required this.id,
    required this.text,
    this.imageUrl,
    this.appRoute,
    this.webUrl,
    this.priority = 0,
    this.isActive = true,
    required this.createdAt,
    required this.updatedAt,
  });

  // ============================================
  // TO MAP
  // ============================================
  Map<String, dynamic> toMap() => {
    'text': text,
    'imageUrl': imageUrl,
    'appRoute': appRoute,
    'webUrl': webUrl,
    'priority': priority,
    'isActive': isActive,
    'createdAt': Timestamp.fromDate(createdAt),
    'updatedAt': Timestamp.fromDate(updatedAt),
  };

  Map<String, dynamic> toJson() => toMap();

  // ============================================
  // FROM FIRESTORE
  // ============================================
  factory TrendingSearchModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return TrendingSearchModel(
      id: doc.id,
      text: data['text'] ?? '',
      imageUrl: data['imageUrl'],
      appRoute: data['appRoute'],
      webUrl: data['webUrl'],
      priority: (data['priority'] as num?)?.toInt() ?? 0,
      isActive: data['isActive'] ?? true,
      createdAt: (data['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  factory TrendingSearchModel.fromMap(Map<String, dynamic> map, String id) {
    return TrendingSearchModel(
      id: id,
      text: map['text'] ?? '',
      imageUrl: map['imageUrl'],
      appRoute: map['appRoute'],
      webUrl: map['webUrl'],
      priority: (map['priority'] as num?)?.toInt() ?? 0,
      isActive: map['isActive'] ?? true,
      createdAt: (map['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      updatedAt: (map['updatedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  // ============================================
  // COPY WITH
  // ============================================
  TrendingSearchModel copyWith({
    String? id,
    String? text,
    String? imageUrl,
    String? appRoute,
    String? webUrl,
    int? priority,
    bool? isActive,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return TrendingSearchModel(
      id: id ?? this.id,
      text: text ?? this.text,
      imageUrl: imageUrl ?? this.imageUrl,
      appRoute: appRoute ?? this.appRoute,
      webUrl: webUrl ?? this.webUrl,
      priority: priority ?? this.priority,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
