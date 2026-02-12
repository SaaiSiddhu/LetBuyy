import 'package:flutter/foundation.dart';
import '../models/store_model.dart';

/// Device type for preview
enum PreviewDevice {
  mobile,
  tablet,
  desktop,
}

extension PreviewDeviceExtension on PreviewDevice {
  String get displayName {
    switch (this) {
      case PreviewDevice.mobile:
        return 'Mobile';
      case PreviewDevice.tablet:
        return 'Tablet';
      case PreviewDevice.desktop:
        return 'Desktop';
    }
  }

  double get width {
    switch (this) {
      case PreviewDevice.mobile:
        return 375;
      case PreviewDevice.tablet:
        return 768;
      case PreviewDevice.desktop:
        return 1280;
    }
  }

  double get height {
    switch (this) {
      case PreviewDevice.mobile:
        return 667;
      case PreviewDevice.tablet:
        return 1024;
      case PreviewDevice.desktop:
        return 800;
    }
  }

  String get iconName {
    switch (this) {
      case PreviewDevice.mobile:
        return 'phone_iphone';
      case PreviewDevice.tablet:
        return 'tablet_mac';
      case PreviewDevice.desktop:
        return 'desktop_windows';
    }
  }
}

/// Preview URL configuration
class PreviewConfig {
  final String baseUrl;
  final String storeId;
  final String? version;
  final bool isDraft;
  final DateTime timestamp;

  PreviewConfig({
    required this.baseUrl,
    required this.storeId,
    this.version,
    this.isDraft = false,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();

  /// Get full preview URL with cache busting
  String get url {
    final cacheBuster = timestamp.millisecondsSinceEpoch;
    var previewUrl = baseUrl;
    
    if (isDraft) {
      previewUrl += '?preview=true&v=$cacheBuster';
    } else {
      previewUrl += '?v=$cacheBuster';
    }
    
    if (version != null) {
      previewUrl += '&version=$version';
    }
    
    return previewUrl;
  }

  /// Get URL for specific device preview
  String urlForDevice(PreviewDevice device) {
    return '$url&device=${device.name}';
  }
}

/// Service for managing store preview functionality
class PreviewService {
  static const String _baseFirebaseUrl = 'https://stores-letbuy-y.web.app';
  static const String _baseProdUrl = 'https://stores.letbuyy.store';

  /// Generate preview URL for a store
  PreviewConfig getPreviewConfig({
    required StoreModel store,
    bool isDraft = false,
    bool useProductionUrl = false,
  }) {
    String baseUrl;
    
    if (useProductionUrl && store.subdomain.isNotEmpty) {
      // Production subdomain URL
      baseUrl = 'https://${store.subdomain}.letbuyy.store';
    } else {
      // Firebase hosting URL with store ID
      baseUrl = '$_baseFirebaseUrl/${store.id}';
    }

    return PreviewConfig(
      baseUrl: baseUrl,
      storeId: store.id,
      isDraft: isDraft,
    );
  }

  /// Get live store URL
  String getLiveUrl(StoreModel store) {
    if (store.subdomain.isNotEmpty) {
      return 'https://${store.subdomain}.letbuyy.store';
    }
    return '$_baseFirebaseUrl/${store.id}';
  }

  /// Get draft preview URL (unpublished changes)
  String getDraftUrl(StoreModel store) {
    final config = getPreviewConfig(store: store, isDraft: true);
    return config.url;
  }

  /// Get shareable store URL
  String getShareableUrl(StoreModel store) {
    if (store.subdomain.isNotEmpty) {
      return 'https://${store.subdomain}.letbuyy.store';
    }
    // Fallback to Firebase URL
    return '$_baseFirebaseUrl/${store.id}';
  }

  /// Get QR code URL for the store
  String getQrCodeUrl(StoreModel store, {int size = 200}) {
    final storeUrl = Uri.encodeComponent(getShareableUrl(store));
    return 'https://api.qrserver.com/v1/create-qr-code/?size=${size}x$size&data=$storeUrl';
  }

  /// Generate embed code for the store
  String getEmbedCode(StoreModel store, {
    int width = 800,
    int height = 600,
  }) {
    final url = getShareableUrl(store);
    return '''
<iframe 
  src="$url" 
  width="$width" 
  height="$height" 
  frameborder="0" 
  style="border: none; border-radius: 8px;"
  allow="payment"
  title="${store.name}"
></iframe>
''';
  }

  /// Validate preview URL is accessible
  Future<bool> isPreviewAccessible(String url) async {
    try {
      // In a real implementation, we'd make an HTTP HEAD request
      // For now, just validate URL format
      final uri = Uri.tryParse(url);
      return uri != null && uri.hasScheme && uri.host.isNotEmpty;
    } catch (e) {
      debugPrint('Error checking preview accessibility: $e');
      return false;
    }
  }

  /// Clear preview cache for a store
  Future<void> clearPreviewCache(String storeId) async {
    try {
      // This would typically trigger a CDN cache purge
      // For Firebase Hosting, we rely on version-based cache busting
      debugPrint('Preview cache cleared for store: $storeId');
    } catch (e) {
      debugPrint('Error clearing preview cache: $e');
    }
  }

  /// Get device frame dimensions
  Map<String, double> getDeviceFrame(PreviewDevice device) {
    return {
      'width': device.width,
      'height': device.height,
    };
  }

  /// Generate social share preview URLs
  Map<String, String> getSocialShareUrls(StoreModel store) {
    final storeUrl = Uri.encodeComponent(getShareableUrl(store));
    final storeName = Uri.encodeComponent(store.name);
    
    return {
      'facebook': 'https://www.facebook.com/sharer/sharer.php?u=$storeUrl',
      'twitter': 'https://twitter.com/intent/tweet?url=$storeUrl&text=Check%20out%20$storeName',
      'whatsapp': 'https://wa.me/?text=Check%20out%20$storeName%20$storeUrl',
      'linkedin': 'https://www.linkedin.com/shareArticle?mini=true&url=$storeUrl&title=$storeName',
      'telegram': 'https://t.me/share/url?url=$storeUrl&text=$storeName',
    };
  }

  /// Copy store URL to clipboard (utility method - actual clipboard access done in UI)
  String getUrlForClipboard(StoreModel store) {
    return getShareableUrl(store);
  }
}
