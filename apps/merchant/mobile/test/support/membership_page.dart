/// Canonical metadata for a single synthetic membership page. Larger populations
/// must use explicit page fixtures rather than silently claim a complete list.
Map<String, dynamic> membershipPageMeta(int total) {
  assert(total >= 0 && total <= 50);
  return {
    'total': total,
    'page': 1,
    'per_page': 50,
    'total_pages': total == 0 ? 0 : 1,
    'has_next': false,
    'has_prev': false,
  };
}
