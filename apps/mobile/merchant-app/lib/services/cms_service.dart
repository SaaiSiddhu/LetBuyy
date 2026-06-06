import 'package:flutter/foundation.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

import 'api_client.dart';

class CmsService extends ChangeNotifier {
  CmsService({required ApiClient api}) : _api = api;

  final ApiClient _api;

  List<PageContract> _pages = [];
  List<PageContract> get pages => List.unmodifiable(_pages);

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
