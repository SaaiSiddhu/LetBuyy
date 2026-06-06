import 'package:flutter/foundation.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

import 'api_client.dart' hide JsonMap;

class CmsService extends ChangeNotifier {
  CmsService({required ApiClient api}) : _api = api;

  final ApiClient _api;

  List<PageContract> _pages = [];
  List<PageContract> get pages => List.unmodifiable(_pages);

  List<BlogPostContract> _blogPosts = [];
  List<BlogPostContract> get blogPosts => List.unmodifiable(_blogPosts);

  List<BlogCommentContract> _blogComments = [];
  List<BlogCommentContract> get blogComments =>
      List.unmodifiable(_blogComments);

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  Future<List<PageContract>> fetchPages(
    String storeId, {
    String status = 'all',
    int page = 1,
    int limit = 50,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final pageResult = await _api.pages.list(
        query: {
          'store_id': storeId,
          'status': status,
          'page': page,
          'limit': limit,
        },
      );
      _pages = pageResult.data
          .map(PageContract.fromJson)
          .toList(growable: false);
      return _pages;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<PageContract> createPage(CmsPageInput input) async {
    final created = PageContract.fromJson(
      await _api.pages.create(input.toJson(includeStoreId: true)),
    );
    _pages = [created, ..._pages];
    notifyListeners();
    return created;
  }

  Future<PageContract> updatePage(String id, CmsPageInput input) async {
    final updated = PageContract.fromJson(
      await _api.pages.update(id, input.toJson(includeStoreId: false)),
    );
    final index = _pages.indexWhere((page) => page.id == id);
    if (index == -1) {
      _pages = [updated, ..._pages];
    } else {
      final next = List<PageContract>.from(_pages);
      next[index] = updated;
      _pages = next;
    }
    notifyListeners();
    return updated;
  }

  Future<PageContract> updatePageStatus(
    PageContract page,
    String status,
  ) async {
    final updated = PageContract.fromJson(
      await _api.pages.update(page.id, {'status': status}),
    );
    final index = _pages.indexWhere((item) => item.id == page.id);
    if (index != -1) {
      final next = List<PageContract>.from(_pages);
      next[index] = updated;
      _pages = next;
      notifyListeners();
    }
    return updated;
  }

  Future<void> deletePage(String id) async {
    await _api.pages.remove(id);
    _pages = _pages.where((page) => page.id != id).toList(growable: false);
    notifyListeners();
  }

  Future<List<BlogPostContract>> fetchBlogPosts(
    String storeId, {
    String? status,
    int page = 1,
    int limit = 50,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final pageResult = await _api.blog.posts(
        query: {
          'store_id': storeId,
          'page': page,
          'limit': limit,
          if (status != null && status != 'all') 'status': status,
        },
      );
      _blogPosts = pageResult.data
          .map(BlogPostContract.fromJson)
          .toList(growable: false);
      return _blogPosts;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<BlogPostContract> fetchBlogPost(String id) async {
    return BlogPostContract.fromJson(await _api.blog.post(id));
  }

  Future<BlogPostContract> createBlogPost(BlogPostInput input) async {
    final created = BlogPostContract.fromJson(
      await _api.blog.createPost(input.toJson(includeStoreId: true)),
    );
    _blogPosts = [created, ..._blogPosts];
    notifyListeners();
    return created;
  }

  Future<BlogPostContract> updateBlogPost(
    String id,
    BlogPostInput input,
  ) async {
    final updated = BlogPostContract.fromJson(
      await _api.blog.updatePost(id, input.toJson(includeStoreId: false)),
    );
    final index = _blogPosts.indexWhere((post) => post.id == id);
    if (index == -1) {
      _blogPosts = [updated, ..._blogPosts];
    } else {
      final next = List<BlogPostContract>.from(_blogPosts);
      next[index] = updated;
      _blogPosts = next;
    }
    notifyListeners();
    return updated;
  }

  Future<BlogPostContract> updateBlogPostStatus(
    BlogPostContract post,
    String status,
  ) async {
    final updated = BlogPostContract.fromJson(
      await _api.blog.updatePost(post.id, {'status': status}),
    );
    final index = _blogPosts.indexWhere((item) => item.id == post.id);
    if (index != -1) {
      final next = List<BlogPostContract>.from(_blogPosts);
      next[index] = updated;
      _blogPosts = next;
      notifyListeners();
    }
    return updated;
  }

  Future<void> deleteBlogPost(String id) async {
    await _api.blog.removePost(id);
    _blogPosts = _blogPosts.where((post) => post.id != id).toList();
    notifyListeners();
  }

  Future<List<BlogTaxonomyContract>> fetchBlogCategories(String storeId) async {
    final rows = await _api.blog.categories(storeId);
    return rows.map(BlogTaxonomyContract.fromJson).toList(growable: false);
  }

  Future<List<BlogTaxonomyContract>> fetchBlogTags(String storeId) async {
    final rows = await _api.blog.tags(storeId);
    return rows.map(BlogTaxonomyContract.fromJson).toList(growable: false);
  }

  Future<BlogTaxonomyContract> createBlogTag({
    required String storeId,
    required String name,
  }) async {
    return BlogTaxonomyContract.fromJson(
      await _api.blog.createTag({'store_id': storeId, 'name': name.trim()}),
    );
  }

  Future<List<BlogCommentContract>> fetchBlogComments(
    String storeId, {
    String status = 'all',
    int page = 1,
    int limit = 50,
  }) async {
    final pageResult = await _api.blog.comments(
      query: {
        'store_id': storeId,
        'status': status,
        'page': page,
        'limit': limit,
      },
    );
    _blogComments = pageResult.data
        .map(BlogCommentContract.fromJson)
        .toList(growable: false);
    notifyListeners();
    return _blogComments;
  }

  Future<BlogCommentContract> moderateBlogComment(
    BlogCommentContract comment,
    String status,
  ) async {
    final updated = BlogCommentContract.fromJson(
      await _api.blog.updateComment(comment.id, {'status': status}),
    );
    final index = _blogComments.indexWhere((item) => item.id == comment.id);
    if (index != -1) {
      final next = List<BlogCommentContract>.from(_blogComments);
      next[index] = updated;
      _blogComments = next;
      notifyListeners();
    }
    return updated;
  }

  Future<void> deleteBlogComment(String id) async {
    await _api.blog.removeComment(id);
    _blogComments = _blogComments.where((comment) => comment.id != id).toList();
    notifyListeners();
  }
}

class CmsPageInput {
  const CmsPageInput({
    required this.storeId,
    required this.title,
    required this.body,
    this.slug,
    this.pageType = 'custom',
    this.status = 'draft',
    this.showInNav = false,
    this.seoTitle,
    this.seoDescription,
    this.displayOrder = 0,
  });

  final String storeId;
  final String title;
  final String body;
  final String? slug;
  final String pageType;
  final String status;
  final bool showInNav;
  final String? seoTitle;
  final String? seoDescription;
  final int displayOrder;

  Map<String, dynamic> toJson({required bool includeStoreId}) {
    return {
      if (includeStoreId) 'store_id': storeId,
      'title': title.trim(),
      if (slug != null && slug!.trim().isNotEmpty) 'slug': slug!.trim(),
      'body': body,
      'page_type': pageType.trim().isEmpty ? 'custom' : pageType.trim(),
      'status': status,
      'show_in_nav': showInNav,
      'seo_title': _nullableTrim(seoTitle),
      'seo_description': _nullableTrim(seoDescription),
      'display_order': displayOrder,
    };
  }

  static String? _nullableTrim(String? value) {
    final trimmed = value?.trim();
    return trimmed == null || trimmed.isEmpty ? null : trimmed;
  }
}

class BlogPostContract extends SharedTypeContract {
  BlogPostContract(super.json);

  factory BlogPostContract.fromJson(JsonMap json) => BlogPostContract(json);

  String get id => _string('id');
  String get storeId => _string('store_id');
  String get title => _string('title');
  String get slug => _string('slug');
  String get excerpt => _string('excerpt');
  String get content => _string('content');
  String get status => _string('status', fallback: 'draft');
  String? get featuredImage => _optionalString('featured_image');
  bool get allowComments => _bool('allow_comments', fallback: true);
  bool get isFeatured => _bool('is_featured');
  bool get isPinned => _bool('is_pinned');
  int get readingTimeMin => _int('reading_time_min');

  String _string(String key, {String fallback = ''}) {
    return toJson()[key]?.toString() ?? fallback;
  }

  String? _optionalString(String key) {
    return toJson()[key]?.toString();
  }

  bool _bool(String key, {bool fallback = false}) {
    final value = toJson()[key];
    return value is bool ? value : fallback;
  }

  int _int(String key) {
    final value = toJson()[key];
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }
}

class BlogCommentContract extends SharedTypeContract {
  BlogCommentContract(super.json);

  factory BlogCommentContract.fromJson(JsonMap json) =>
      BlogCommentContract(json);

  String get id => _string('id');
  String get storeId => _string('store_id');
  String get postId => _string('post_id');
  String get postTitle => _string('post_title');
  String get authorName =>
      _string('author_name', fallback: _string('full_name'));
  String get email => _string('email');
  String get body => _string('body', fallback: _string('content'));
  String get status => _string('status', fallback: 'pending');

  String _string(String key, {String fallback = ''}) {
    return toJson()[key]?.toString() ?? fallback;
  }
}

class BlogTaxonomyContract extends SharedTypeContract {
  BlogTaxonomyContract(super.json);

  factory BlogTaxonomyContract.fromJson(JsonMap json) =>
      BlogTaxonomyContract(json);

  String get id => _string('id');
  String get name => _string('name');
  String get slug => _string('slug');

  String _string(String key, {String fallback = ''}) {
    return toJson()[key]?.toString() ?? fallback;
  }
}

class BlogPostInput {
  const BlogPostInput({
    required this.storeId,
    required this.title,
    required this.content,
    this.slug,
    this.excerpt,
    this.contentHtml,
    this.featuredImage,
    this.categoryId,
    this.tagIds = const [],
    this.status = 'draft',
    this.allowComments = true,
    this.isFeatured = false,
    this.isPinned = false,
    this.readingTimeMin,
    this.seoTitle,
    this.seoDescription,
  });

  final String storeId;
  final String title;
  final String content;
  final String? slug;
  final String? excerpt;
  final String? contentHtml;
  final String? featuredImage;
  final String? categoryId;
  final List<String> tagIds;
  final String status;
  final bool allowComments;
  final bool isFeatured;
  final bool isPinned;
  final int? readingTimeMin;
  final String? seoTitle;
  final String? seoDescription;

  Map<String, dynamic> toJson({required bool includeStoreId}) {
    return {
      if (includeStoreId) 'store_id': storeId,
      'title': title.trim(),
      if (slug != null && slug!.trim().isNotEmpty) 'slug': slug!.trim(),
      if (excerpt != null && excerpt!.trim().isNotEmpty)
        'excerpt': excerpt!.trim(),
      'content': content,
      if (contentHtml != null && contentHtml!.trim().isNotEmpty)
        'content_html': contentHtml,
      if (featuredImage != null && featuredImage!.trim().isNotEmpty)
        'featured_image': featuredImage!.trim(),
      if (categoryId != null && categoryId!.trim().isNotEmpty)
        'category_id': categoryId!.trim(),
      if (tagIds.isNotEmpty) 'tag_ids': tagIds,
      'status': status,
      'allow_comments': allowComments,
      'is_featured': isFeatured,
      'is_pinned': isPinned,
      if (readingTimeMin != null) 'reading_time_min': readingTimeMin,
      'seo_title': _nullableTrim(seoTitle),
      'seo_description': _nullableTrim(seoDescription),
    };
  }

  static String? _nullableTrim(String? value) {
    final trimmed = value?.trim();
    return trimmed == null || trimmed.isEmpty ? null : trimmed;
  }
}
