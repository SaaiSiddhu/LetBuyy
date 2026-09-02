import 'package:cloud_firestore/cloud_firestore.dart';

/// Model for a comment on a reel (Instagram-style)
class ReelCommentModel {
  final String id;
  final String reelId;
  final String userId;
  final String userName;
  final String? userAvatar;
  final String text;
  
  // Engagement
  final int likes;
  final List<String> likedBy;
  
  // Creator/Seller engagement
  final bool likedBySeller;     // "❤️ by creator" feature
  final DateTime? sellerLikedAt;
  
  // Seller features
  final bool isPinned;
  final bool isSellerReply;
  final String? parentCommentId; // For nested replies
  
  // Metadata
  final DateTime createdAt;
  final DateTime? updatedAt;
  
  // Denormalized seller info (for seller replies)
  final String? sellerName;
  final String? sellerAvatar;
  
  ReelCommentModel({
    required this.id,
    required this.reelId,
    required this.userId,
    required this.userName,
    this.userAvatar,
    required this.text,
    this.likes = 0,
    this.likedBy = const [],
    this.likedBySeller = false,
    this.sellerLikedAt,
    this.isPinned = false,
    this.isSellerReply = false,
    this.parentCommentId,
    required this.createdAt,
    this.updatedAt,
    this.sellerName,
    this.sellerAvatar,
  });
  
  /// Create from Firestore document
  factory ReelCommentModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return ReelCommentModel.fromMap(data, doc.id);
  }
  
  /// Create from map with optional id override
  factory ReelCommentModel.fromMap(Map<String, dynamic> map, [String? id]) {
    return ReelCommentModel(
      id: id ?? map['id'] ?? '',
      reelId: map['reelId'] ?? '',
      userId: map['userId'] ?? '',
      userName: map['userName'] ?? 'User',
      userAvatar: map['userAvatar'],
      text: map['text'] ?? '',
      likes: (map['likes'] ?? 0) as int,
      likedBy: List<String>.from(map['likedBy'] ?? []),
      likedBySeller: map['likedBySeller'] ?? false,
      sellerLikedAt: (map['sellerLikedAt'] as Timestamp?)?.toDate(),
      isPinned: map['isPinned'] ?? false,
      isSellerReply: map['isSellerReply'] ?? false,
      parentCommentId: map['parentCommentId'],
      createdAt: (map['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      updatedAt: (map['updatedAt'] as Timestamp?)?.toDate(),
      sellerName: map['sellerName'],
      sellerAvatar: map['sellerAvatar'],
    );
  }
  
  /// Convert to Firestore map
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'reelId': reelId,
      'userId': userId,
      'userName': userName,
      'userAvatar': userAvatar,
      'text': text,
      'likes': likes,
      'likedBy': likedBy,
      'likedBySeller': likedBySeller,
      'sellerLikedAt': sellerLikedAt != null ? Timestamp.fromDate(sellerLikedAt!) : null,
      'isPinned': isPinned,
      'isSellerReply': isSellerReply,
      'parentCommentId': parentCommentId,
      'createdAt': Timestamp.fromDate(createdAt),
      'updatedAt': updatedAt != null ? Timestamp.fromDate(updatedAt!) : null,
      'sellerName': sellerName,
      'sellerAvatar': sellerAvatar,
    };
  }
  
  /// Create a copy with updated fields
  ReelCommentModel copyWith({
    String? id,
    String? reelId,
    String? userId,
    String? userName,
    String? userAvatar,
    String? text,
    int? likes,
    List<String>? likedBy,
    bool? likedBySeller,
    DateTime? sellerLikedAt,
    bool? isPinned,
    bool? isSellerReply,
    String? parentCommentId,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? sellerName,
    String? sellerAvatar,
  }) {
    return ReelCommentModel(
      id: id ?? this.id,
      reelId: reelId ?? this.reelId,
      userId: userId ?? this.userId,
      userName: userName ?? this.userName,
      userAvatar: userAvatar ?? this.userAvatar,
      text: text ?? this.text,
      likes: likes ?? this.likes,
      likedBy: likedBy ?? this.likedBy,
      likedBySeller: likedBySeller ?? this.likedBySeller,
      sellerLikedAt: sellerLikedAt ?? this.sellerLikedAt,
      isPinned: isPinned ?? this.isPinned,
      isSellerReply: isSellerReply ?? this.isSellerReply,
      parentCommentId: parentCommentId ?? this.parentCommentId,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      sellerName: sellerName ?? this.sellerName,
      sellerAvatar: sellerAvatar ?? this.sellerAvatar,
    );
  }
  
  /// Check if this is a reply to another comment
  bool get isReply => parentCommentId != null && parentCommentId!.isNotEmpty;
  
  /// Check if user has liked this comment
  bool hasUserLiked(String userId) => likedBy.contains(userId);
  
  /// Get formatted time ago string
  String get timeAgo {
    final now = DateTime.now();
    final difference = now.difference(createdAt);
    
    if (difference.inDays > 365) {
      return '${(difference.inDays / 365).floor()}y';
    } else if (difference.inDays > 30) {
      return '${(difference.inDays / 30).floor()}mo';
    } else if (difference.inDays > 7) {
      return '${(difference.inDays / 7).floor()}w';
    } else if (difference.inDays > 0) {
      return '${difference.inDays}d';
    } else if (difference.inHours > 0) {
      return '${difference.inHours}h';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes}m';
    } else {
      return 'now';
    }
  }
  
  @override
  String toString() => 'ReelCommentModel(id: $id, userName: $userName, text: ${text.length > 20 ? '${text.substring(0, 20)}...' : text})';
}
