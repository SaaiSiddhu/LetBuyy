// lib/services/deep_link_service.dart
// Deep link handling service for seller app (Web + Mobile)

import 'deep_link_service_stub.dart'
    if (dart.library.html) 'deep_link_service_web.dart';

/// Service to handle deep linking across platforms
class DeepLinkService {
  // Singleton instance
  static final DeepLinkService _instance = DeepLinkService._internal();
  factory DeepLinkService() => _instance;
  DeepLinkService._internal();

  // Store the pending deep link URL (after auth, navigate here)
  String? _pendingDeepLink;
  
  /// Get the initial deep link when app was opened
  String? get initialDeepLink => getInitialUrl();
  
  /// Get pending deep link (set after auth redirect)
  String? get pendingDeepLink => _pendingDeepLink;
  
  /// Set pending deep link to navigate to after auth
  set pendingDeepLink(String? url) => _pendingDeepLink = url;
  
  /// Clear pending deep link after navigation
  void clearPendingDeepLink() => _pendingDeepLink = null;
  
  /// Get the route path from the current URL
  String getInitialRoute() {
    final url = initialDeepLink;
    if (url == null || url.isEmpty) return '/';
    
    try {
      final uri = Uri.parse(url);
      final path = uri.path;
      final query = uri.query.isNotEmpty ? '?${uri.query}' : '';
      return path.isEmpty ? '/' : '$path$query';
    } catch (e) {
      return '/';
    }
  }
  
  /// Check if a route requires authentication
  bool isPublicRoute(String route) {
    final publicRoutes = [
      '/login',
      '/signup',
      '/register',
      '/forgot-password',
      '/reset-password',
      '/download',
      '/terms',
      '/privacy',
      '/help-support',
    ];
    
    // Check if route starts with any public route
    final routePath = route.split('?').first; // Remove query params for check
    return publicRoutes.any((r) => routePath == r || routePath.startsWith(r));
  }
  
  /// Check if route is an auth route (login/signup flow)
  bool isAuthRoute(String route) {
    final authRoutes = [
      '/login',
      '/signup',
      '/register',
      '/auth',
      '/verify-email',
      '/forgot-password',
      '/reset-password',
      '/welcome',
    ];
    
    final routePath = route.split('?').first;
    return authRoutes.any((r) => routePath == r || routePath.startsWith(r));
  }
}
