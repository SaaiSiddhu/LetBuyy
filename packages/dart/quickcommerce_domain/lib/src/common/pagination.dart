final class PageCursor {
  const PageCursor({
    this.after,
    this.limit = 20,
  });

  final String? after;
  final int limit;
}

final class Paginated<T> {
  Paginated({
    required List<T> items,
    required this.nextCursor,
    required this.hasMore,
  }) : items = List.unmodifiable(items);

  final List<T> items;
  final String? nextCursor;
  final bool hasMore;
}
