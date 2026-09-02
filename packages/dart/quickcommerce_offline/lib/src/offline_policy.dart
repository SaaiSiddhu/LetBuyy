enum OfflineReadPolicy {
  networkOnly,
  cacheFirst,
  staleWhileRevalidate,
}

enum OfflineWritePolicy {
  serverConfirmed,
  optimistic,
  queued,
}

class OfflinePolicy {
  const OfflinePolicy({
    required this.read,
    required this.write,
  });

  final OfflineReadPolicy read;
  final OfflineWritePolicy write;
}
