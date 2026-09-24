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

  NavigationPayload? _navigationPayload;
  NavigationPayload? get navigationPayload => _navigationPayload;

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

  Future<NavigationPayload> fetchNavigation(
    String storeId, {
    String location = 'main',
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final payload = NavigationPayload.fromJson(
        await _api.pages.navigation(storeId: storeId, location: location),
      );
      _navigationPayload = payload;
      return payload;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<NavigationPayload> replaceNavigation({
    required String storeId,
    required String location,
    required String name,
    required List<NavigationItemInput> items,
  }) async {
    await _api.pages.replaceNavigation(location, {
      'store_id': storeId,
      'location': location,
      'name': name.trim().isEmpty ? _navigationName(location) : name.trim(),
      'items': [
        for (var index = 0; index < items.length; index += 1)
          items[index].copyWith(sortOrder: index).toJson(),
      ],
    });
    return fetchNavigation(storeId, location: location);
  }

  static String _navigationName(String location) {
    final label = location.replaceAll('-', ' ').replaceAll('_', ' ').trim();
    if (label.isEmpty) return 'Main menu';
    return '${label[0].toUpperCase()}${label.substring(1)} menu';
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

class NavigationPayload {
  const NavigationPayload({required this.menu, required this.items});

  factory NavigationPayload.fromJson(JsonMap json) {
    final menuValue = json['menu'];
    final itemValues = json['items'];
    return NavigationPayload(
      menu: menuValue is Map
          ? NavigationMenuContract.fromJson(
              Map<String, dynamic>.from(menuValue),
            )
          : null,
      items: itemValues is List
          ? itemValues
                .whereType<Map>()
                .map((item) {
                  return NavigationItemContract.fromJson(
                    Map<String, dynamic>.from(item),
                  );
                })
                .toList(growable: false)
          : const [],
    );
  }

  final NavigationMenuContract? menu;
  final List<NavigationItemContract> items;
}

class NavigationMenuContract extends SharedTypeContract {
  NavigationMenuContract(super.json);

  factory NavigationMenuContract.fromJson(JsonMap json) =>
      NavigationMenuContract(json);

  String get id => _string('id');
  String get storeId => _string('store_id');
  String get handle => _string('handle');
  String get location => _string('location', fallback: handle);
  String get name => _string('name', fallback: 'Storefront menu');

  String _string(String key, {String fallback = ''}) {
    return toJson()[key]?.toString() ?? fallback;
  }
}

class NavigationItemContract extends SharedTypeContract {
  NavigationItemContract(super.json);

  factory NavigationItemContract.fromJson(JsonMap json) =>
      NavigationItemContract(json);

  String get id => _string('id');
  String get menuId => _string('menu_id');
  String get storeId => _string('store_id');
  String? get parentItemId => _optionalString('parent_item_id');
  String get label => _string('label', fallback: 'Menu item');
  String get url => _string('url', fallback: '#');
  String get targetType => _string('target_type', fallback: 'url');
  String? get targetResourceId => _optionalString('target_resource_id');
  int get sortOrder => _int('sort_order');
  bool get isVisible => _bool('is_visible', fallback: true);
  bool get openInNewTab => _bool('open_in_new_tab');
  String? get updatedAt => _optionalString('updated_at');

  String _string(String key, {String fallback = ''}) {
    return toJson()[key]?.toString() ?? fallback;
  }

  String? _optionalString(String key) {
    final value = toJson()[key]?.toString();
    return value == null || value.isEmpty ? null : value;
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

class NavigationItemInput {
  const NavigationItemInput({
    required this.label,
    required this.url,
    this.targetType = 'url',
    this.targetResourceId,
    this.parentItemId,
    this.sortOrder = 0,
    this.isVisible = true,
    this.openInNewTab = false,
  });

  factory NavigationItemInput.fromContract(NavigationItemContract item) {
    return NavigationItemInput(
      label: item.label,
      url: item.url,
      targetType: item.targetType,
      targetResourceId: item.targetResourceId,
      parentItemId: item.parentItemId,
      sortOrder: item.sortOrder,
      isVisible: item.isVisible,
      openInNewTab: item.openInNewTab,
    );
  }

  final String label;
  final String url;
  final String targetType;
  final String? targetResourceId;
  final String? parentItemId;
  final int sortOrder;
  final bool isVisible;
  final bool openInNewTab;

  NavigationItemInput copyWith({
    String? label,
    String? url,
    String? targetType,
    String? targetResourceId,
    String? parentItemId,
    int? sortOrder,
    bool? isVisible,
    bool? openInNewTab,
  }) {
    return NavigationItemInput(
      label: label ?? this.label,
      url: url ?? this.url,
      targetType: targetType ?? this.targetType,
      targetResourceId: targetResourceId ?? this.targetResourceId,
      parentItemId: parentItemId ?? this.parentItemId,
      sortOrder: sortOrder ?? this.sortOrder,
      isVisible: isVisible ?? this.isVisible,
      openInNewTab: openInNewTab ?? this.openInNewTab,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'label': label.trim(),
      'url': url.trim().isEmpty ? '#' : url.trim(),
      'target_type': targetType.trim().isEmpty ? 'url' : targetType.trim(),
      'target_resource_id': _nullableTrim(targetResourceId),
      'parent_item_id': _nullableTrim(parentItemId),
      'sort_order': sortOrder,
      'is_visible': isVisible,
      'open_in_new_tab': openInNewTab,
    };
  }

  static String? _nullableTrim(String? value) {
    final trimmed = value?.trim();
    return trimmed == null || trimmed.isEmpty ? null : trimmed;
  }
}
