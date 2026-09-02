// packages/services/lib/src/reels_preload_provider.dart
// 🚀 Background Video Preloading for Instant Reels Playback

import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:video_player/video_player.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'reel_service.dart';

/// Singleton provider for preloading reel videos in the background.
/// Initializes on app start and keeps videos cached for instant playback.
class ReelsPreloadProvider extends ChangeNotifier {
  // Singleton
  static final ReelsPreloadProvider _instance = ReelsPreloadProvider._internal();
  factory ReelsPreloadProvider() => _instance;
  ReelsPreloadProvider._internal();

  final ReelService _reelService = ReelService();
  
  // Cached video controllers - persists across screen navigation
  final Map<String, VideoPlayerController> _videoControllers = {};
  
  // Reel metadata
  List<ReelModel> _reels = [];
  List<ReelModel> get reels => _reels;
  
  // Preload configuration
  // 🚀 PERFORMANCE: Reduced counts to minimize codec queue blocking during startup
  static const int _initialPreloadCount = 2;  // Preload only first 2 videos (was 5)
  static const int _aheadPreloadCount = 2;    // Preload 2 ahead while watching (was 3)
  
  // State tracking
  bool _isInitialized = false;
  bool _isPreloading = false;
  int _currentWatchIndex = 0;
  int _highestPreloadedIndex = -1;
  
  bool get isInitialized => _isInitialized;
  bool get isPreloading => _isPreloading;
  bool get hasReels => _reels.isNotEmpty;
  
  StreamSubscription? _reelsSubscription;
  
  /// Initialize and start background preloading
  /// Call this in MainScreen.initState()
  Future<void> initialize() async {
    if (_isInitialized) return;
    
    debugPrint('🎬 ReelsPreloadProvider: Initializing background preload...');
    
    try {
      // Listen to reels feed
      _reelsSubscription = _reelService.getReelsFeed(limit: 30).listen((reels) {
        _reels = reels;
        notifyListeners();
        
        // Preload first batch
        if (!_isPreloading && reels.isNotEmpty) {
          _preloadInitialVideos();
        }
      });
      
      _isInitialized = true;
    } catch (e) {
      debugPrint('❌ ReelsPreloadProvider: Error initializing: $e');
    }
  }
  
  /// Preload the first N videos on app start
  Future<void> _preloadInitialVideos() async {
    if (_reels.isEmpty || _isPreloading) return;
    
    _isPreloading = true;
    
    // 🚀 PERFORMANCE: Delay to let UI render and become interactive first
    // This prevents codec initialization from blocking the main thread during startup
    await Future.delayed(const Duration(milliseconds: 500));
    
    debugPrint('🎬 ReelsPreloadProvider: Preloading first $_initialPreloadCount videos...');
    
    final count = _reels.length < _initialPreloadCount 
        ? _reels.length 
        : _initialPreloadCount;
    
    for (int i = 0; i < count; i++) {
      await _preloadVideo(i);
      
      // 🚀 PERFORMANCE: Stagger codec initialization to prevent queue blocking
      // Each codec init takes ~100-200ms, spacing them out reduces jank
      if (i < count - 1) {
        await Future.delayed(const Duration(milliseconds: 200));
      }
    }
    
    _highestPreloadedIndex = count - 1;
    _isPreloading = false;
    
    debugPrint('✅ ReelsPreloadProvider: Initial preload complete ($count videos)');
    notifyListeners();
  }
  
  /// Preload a single video by index
  Future<void> _preloadVideo(int index) async {
    if (index < 0 || index >= _reels.length) return;
    
    final reel = _reels[index];
    final url = reel.videoUrl;
    
    // Skip if already cached
    if (_videoControllers.containsKey(url)) {
      debugPrint('🎬 Video $index already cached: ${url.split('/').last}');
      return;
    }
    
    try {
      debugPrint('🎬 Preloading video $index: ${url.split('/').last}');
      
      final controller = VideoPlayerController.networkUrl(
        Uri.parse(url),
        videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
      );
      
      await controller.initialize();
      controller.setLooping(true);
      controller.setVolume(0); // Mute during preload
      
      _videoControllers[url] = controller;
      
      debugPrint('✅ Video $index preloaded successfully');
    } catch (e) {
      debugPrint('❌ Failed to preload video $index: $e');
    }
  }
  
  /// Called when user changes reel - triggers progressive preloading
  void onReelChanged(int newIndex) {
    _currentWatchIndex = newIndex;
    
    // Trigger progressive preload if needed
    _progressivePreload();
  }
  
  /// Progressive preloading: preload ahead while user watches
  Future<void> _progressivePreload() async {
    if (_reels.isEmpty || _isPreloading) return;
    
    final targetIndex = _currentWatchIndex + _aheadPreloadCount;
    
    // Only preload if we haven't already
    if (targetIndex <= _highestPreloadedIndex) return;
    if (targetIndex >= _reels.length) return;
    
    _isPreloading = true;
    
    // Preload from highest preloaded to target
    for (int i = _highestPreloadedIndex + 1; i <= targetIndex && i < _reels.length; i++) {
      await _preloadVideo(i);
      _highestPreloadedIndex = i;
    }
    
    _isPreloading = false;
    notifyListeners();
  }
  
  /// Get a preloaded controller (or null if not preloaded)
  VideoPlayerController? getController(String videoUrl) {
    return _videoControllers[videoUrl];
  }
  
  /// Check if a video is preloaded
  bool isPreloaded(String videoUrl) {
    final controller = _videoControllers[videoUrl];
    return controller != null && controller.value.isInitialized;
  }
  
  /// Pause all videos (call when leaving reels tab)
  void pauseAll() {
    for (final controller in _videoControllers.values) {
      try {
        controller.pause();
      } catch (_) {}
    }
  }
  
  /// Resume volume on a specific video
  void prepareForPlayback(String videoUrl) {
    final controller = _videoControllers[videoUrl];
    if (controller != null) {
      controller.setVolume(1.0);
    }
  }
  
  /// Clean up old cached videos (keep only recent ones)
  void _evictOldCache() {
    // Keep videos around current position ± buffer
    const keepBuffer = 3;
    final minKeep = (_currentWatchIndex - keepBuffer).clamp(0, _reels.length);
    final maxKeep = (_currentWatchIndex + _aheadPreloadCount + keepBuffer).clamp(0, _reels.length);
    
    final urlsToKeep = <String>{};
    for (int i = minKeep; i < maxKeep && i < _reels.length; i++) {
      urlsToKeep.add(_reels[i].videoUrl);
    }
    
    // Remove videos outside the keep range
    final urlsToRemove = _videoControllers.keys
        .where((url) => !urlsToKeep.contains(url))
        .toList();
    
    for (final url in urlsToRemove) {
      _videoControllers[url]?.dispose();
      _videoControllers.remove(url);
    }
  }
  
  /// Full cleanup
  @override
  void dispose() {
    _reelsSubscription?.cancel();
    for (final controller in _videoControllers.values) {
      try {
        controller.dispose();
      } catch (_) {}
    }
    _videoControllers.clear();
    super.dispose();
  }
  
  /// Reset for testing/debugging
  void reset() {
    pauseAll();
    for (final controller in _videoControllers.values) {
      try {
        controller.dispose();
      } catch (_) {}
    }
    _videoControllers.clear();
    _reels.clear();
    _isInitialized = false;
    _isPreloading = false;
    _currentWatchIndex = 0;
    _highestPreloadedIndex = -1;
    notifyListeners();
  }
}
