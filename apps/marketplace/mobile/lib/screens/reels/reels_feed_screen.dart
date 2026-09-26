import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:video_player/video_player.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:share_plus/share_plus.dart';

import 'widgets/reel_comments_sheet.dart';

// Use global preload provider for instant video playback

/// Video cache manager - per-screen instance (NOT singleton to ensure cleanup)
class _VideoCache {
  // NOT a singleton anymore - each screen gets its own cache
  _VideoCache();
  
  final Map<String, VideoPlayerController> _cache = {};
  final int _maxCacheSize = 5;
  final List<String> _accessOrder = [];
  bool _isDisposed = false;
  
  VideoPlayerController? get(String url) => _isDisposed ? null : _cache[url];
  
  void put(String url, VideoPlayerController controller) {
    if (_isDisposed) return;
    
    if (_cache.containsKey(url)) {
      // Move to end (most recently accessed)
      _accessOrder.remove(url);
      _accessOrder.add(url);
      return;
    }
    
    // Evict oldest if cache is full
    while (_cache.length >= _maxCacheSize && _accessOrder.isNotEmpty) {
      final oldest = _accessOrder.removeAt(0);
      _cache[oldest]?.pause();
      _cache[oldest]?.dispose();
      _cache.remove(oldest);
    }
    
    _cache[url] = controller;
    _accessOrder.add(url);
  }
  
  void remove(String url) {
    _cache[url]?.pause();
    _cache[url]?.dispose();
    _cache.remove(url);
    _accessOrder.remove(url);
  }
  
  void clear() {
    _isDisposed = true;
    for (final controller in _cache.values) {
      try {
        controller.pause();
        controller.dispose();
      } catch (_) {}
    }
    _cache.clear();
    _accessOrder.clear();
  }
  
  /// Pause all videos in the cache without disposing them
  void pauseAll() {
    for (final controller in _cache.values) {
      try {
        controller.pause();
      } catch (_) {}
    }
  }
  
  bool contains(String url) => !_isDisposed && _cache.containsKey(url);
}

/// TikTok-style full-screen reels feed with video caching
class ReelsFeedScreen extends StatefulWidget {
  final bool isTabActive;
  final String? initialReelId; // For deep linking to a specific reel
  
  const ReelsFeedScreen({
    super.key,
    this.isTabActive = true,
    this.initialReelId,
  });

  @override
  State<ReelsFeedScreen> createState() => _ReelsFeedScreenState();
}

class _ReelsFeedScreenState extends State<ReelsFeedScreen> with WidgetsBindingObserver {
  final ReelService _reelService = ReelService();
  final AdService _adService = AdService(); // Phase 2: For CPV billing
  final PageController _pageController = PageController();
  final _VideoCache _videoCache = _VideoCache();
  
  List<ReelModel> _reels = [];
  int _currentIndex = 0;
  bool _isLoading = false;
  StreamSubscription? _reelsSubscription;
  
  // Phase 2: Boosted reels tracking for CPV billing
  final Map<String, BoostedReelData> _boostedReelsMap = {};
  final Set<String> _billedViews = {}; // Track which reels have been billed this session
  
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ));
    
    // 🚀 PERFORMANCE FIX: Only load reels data when tab is ACTIVE
    if (widget.isTabActive) {
      debugPrint('🎬 initState: Tab is active, calling _loadReels()');
      _loadReels();
      _loadBoostedReels(); // Phase 2: Load promoted reels
      _initializePreloadIfNeeded();
    } else {
      debugPrint('🎬 initState: Tab is NOT active, deferring load');
    }
  }
  
  /// Phase 2: Load boosted reels for CPV tracking
  Future<void> _loadBoostedReels() async {
    try {
      final boostedReels = await _adService.getBoostedReels(limit: 3);
      for (final data in boostedReels) {
        _boostedReelsMap[data.reelId] = data;
      }
      debugPrint('📺 Loaded ${boostedReels.length} boosted reels for CPV tracking');
    } catch (e) {
      debugPrint('⚠️ Error loading boosted reels: $e');
    }
  }
  
  /// Phase 2: Track CPV view (called after 3 seconds of watch time)
  Future<void> _trackCPVView(String reelId) async {
    // Check if this is a boosted reel
    final boostedData = _boostedReelsMap[reelId];
    if (boostedData == null) return;
    
    // Deduplicate - only bill once per session
    if (_billedViews.contains(reelId)) return;
    
    final userId = safeFirebaseUserId();
    
    final success = await _adService.recordView(
      adProductId: boostedData.adProductId,
      campaignId: boostedData.campaignId,
      sellerId: boostedData.sellerId,
      reelId: reelId,
      userId: userId,
      costPerView: boostedData.costPerView,
      placement: AdPlacement.reels,
    );
    
    if (success) {
      _billedViews.add(reelId);
      debugPrint('💰 CPV billed for reel $reelId');
    }
  }
  
  /// Check if a reel is boosted (for showing "Ad" badge)
  bool _isBoostedReel(String reelId) => _boostedReelsMap.containsKey(reelId);
  
  /// 🚀 PERFORMANCE: Only initialize preload when user actually visits Reels tab
  void _initializePreloadIfNeeded() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && widget.isTabActive) {
        ReelsPreloadProvider().initialize();
      }
    });
  }
  
  @override
  void didUpdateWidget(ReelsFeedScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    
    debugPrint('🎬 didUpdateWidget: isTabActive=${widget.isTabActive}, wasActive=${oldWidget.isTabActive}');
    
    // Handle tab visibility changes
    if (widget.isTabActive != oldWidget.isTabActive) {
      debugPrint('🎬 Tab visibility changed! Now: ${widget.isTabActive}');
      if (widget.isTabActive) {
        // ✅ FIX: Tab became active - ALWAYS load if reels are empty
        debugPrint('🎬 Tab became active, reels.isEmpty=${_reels.isEmpty}, isLoading=$_isLoading');
        if (_reels.isEmpty) {
          debugPrint('🎬 Reels are empty, calling _loadReels()');
          _loadReels();
          _initializePreloadIfNeeded();
        }
        
        // Play current video
        if (_reels.isNotEmpty && _currentIndex < _reels.length) {
          _videoCache.get(_reels[_currentIndex].videoUrl)?.play();
        }
      } else {
        // Tab became inactive - pause all videos
        _videoCache.pauseAll();
      }
    }
  }
  
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Only handle lifecycle if tab is active
    if (!widget.isTabActive) return;
    
    if (state == AppLifecycleState.paused) {
      // Pause current video when app goes to background
      final currentReel = _reels.isNotEmpty ? _reels[_currentIndex] : null;
      if (currentReel != null) {
        _videoCache.get(currentReel.videoUrl)?.pause();
      }
    } else if (state == AppLifecycleState.resumed) {
      // Resume current video when app comes back
      final currentReel = _reels.isNotEmpty ? _reels[_currentIndex] : null;
      if (currentReel != null) {
        _videoCache.get(currentReel.videoUrl)?.play();
      }
    }
  }
  
  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pageController.dispose();
    _reelsSubscription?.cancel();
    // Pause all videos and clear cache when leaving the screen
    _videoCache.pauseAll();
    _videoCache.clear();
    super.dispose();
  }
  
  Future<void> _loadReels() async {
    if (!mounted) return;
    setState(() => _isLoading = true);
    
    debugPrint('🎬 _loadReels() called, isTabActive=${widget.isTabActive}');
    
    try {
      // If deep linking to a specific reel, fetch it first
      if (widget.initialReelId != null) {
        debugPrint('🎯 Loading specific reel: ${widget.initialReelId}');
        final targetReel = await _reelService.getReel(widget.initialReelId!);
        
        if (targetReel != null) {
          // Start with the target reel, then load more
          if (mounted) {
            setState(() {
              _reels = [targetReel];
              _isLoading = false;
            });
          }
          
          // Load remaining reels in background
          _reelsSubscription = _reelService.getReelsFeed(limit: 20).listen((reels) {
            debugPrint('🎬 Received ${reels.length} reels from feed (deep link)');
            if (mounted) {
              // Add more reels but keep target first, avoiding duplicates
              final otherReels = reels.where((r) => r.id != widget.initialReelId).toList();
              setState(() {
                _reels = [targetReel, ...otherReels];
              });
            }
          }, onError: (e) {
            debugPrint('❌ Error in reels stream: $e');
          });
          return;
        }
      }
      
      // Use preloaded reels from global provider if available AND has reels
      final preloadProvider = ReelsPreloadProvider();
      if (preloadProvider.hasReels && preloadProvider.reels.isNotEmpty) {
        debugPrint('🎬 Using ${preloadProvider.reels.length} preloaded reels');
        if (mounted) {
          setState(() {
            _reels = preloadProvider.reels;
            _isLoading = false;
          });
        }
        return;
      }
      
      // Fallback to loading from service
      debugPrint('🎬 preloadProvider.hasReels=${preloadProvider.hasReels}, loading from service...');
      _reelsSubscription?.cancel(); // Cancel any existing subscription
      _reelsSubscription = _reelService.getReelsFeed(limit: 20).listen((reels) {
        debugPrint('🎬 ✅ Received ${reels.length} reels from Firestore feed');
        if (mounted) {
          setState(() {
            _reels = reels;
            _isLoading = false;
          });
        }
      }, onError: (e) {
        debugPrint('❌ Error loading reels stream: $e');
        if (mounted) setState(() => _isLoading = false);
      });
    } catch (e) {
      debugPrint('❌ Exception in _loadReels: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }
  
  void _onPageChanged(int index) {
    final preloadProvider = ReelsPreloadProvider();
    
    // Pause previous video
    if (_reels.isNotEmpty && _currentIndex < _reels.length) {
      final prevUrl = _reels[_currentIndex].videoUrl;
      _videoCache.get(prevUrl)?.pause();
      preloadProvider.getController(prevUrl)?.pause();
    }
    
    if (!mounted) return;
    setState(() => _currentIndex = index);
    
    // Notify preload provider for progressive preloading
    preloadProvider.onReelChanged(index);
    
    // Play new video
    if (index < _reels.length) {
      final url = _reels[index].videoUrl;
      final preloaded = preloadProvider.getController(url);
      if (preloaded != null) {
        preloadProvider.prepareForPlayback(url);
        preloaded.play();
      } else {
        _videoCache.get(url)?.play();
      }
    }
  }
  
  /// Handle back navigation - pause all videos before leaving
  Future<bool> _handleBackNavigation() async {
    // Pause all videos immediately
    _videoCache.pauseAll();
    _videoCache.clear();
    return true; // Allow navigation
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return PopScope(
        canPop: true,
        onPopInvokedWithResult: (didPop, result) {
          if (didPop) {
            _videoCache.pauseAll();
            _videoCache.clear();
          }
        },
        child: Scaffold(
          backgroundColor: Colors.black,
          body: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                CircularProgressIndicator(color: AppColors.primary),
                const SizedBox(height: 16),
                const Text(
                  'Loading Reels...',
                  style: TextStyle(color: Colors.white70),
                ),
              ],
            ),
          ),
        ),
      );
    }
    
    if (_reels.isEmpty) {
      return PopScope(
        canPop: true,
        onPopInvokedWithResult: (didPop, result) {
          if (didPop) {
            _videoCache.pauseAll();
            _videoCache.clear();
          }
        },
        child: Scaffold(
          backgroundColor: Colors.black,
          appBar: _buildAppBar(),
          body: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.videocam_off_rounded, size: 64, color: Colors.white24),
                const SizedBox(height: 16),
                const Text(
                  'No Reels Available',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Check back later!',
                  style: TextStyle(color: Colors.white54),
                ),
              ],
            ),
          ),
        ),
      );
    }
    
    return PopScope(
      canPop: true,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) {
          _videoCache.pauseAll();
          _videoCache.clear();
        }
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        extendBodyBehindAppBar: true,
        appBar: _buildAppBar(),
        body: PageView.builder(
          controller: _pageController,
          scrollDirection: Axis.vertical,
          itemCount: _reels.length,
          onPageChanged: _onPageChanged,
          itemBuilder: (context, index) {
            final reel = _reels[index];
            return _CachedReelPlayer(
              key: ValueKey(reel.id),
              reel: reel,
              isActive: index == _currentIndex,
              isTabActive: widget.isTabActive,
              isBoosted: _isBoostedReel(reel.id), // Phase 2: Show "Ad" badge
              reelService: _reelService,
              videoCache: _videoCache,
              onViewComplete: () => _trackCPVView(reel.id), // Phase 2: CPV billing
            );
          },
        ),
      ),
    );
  }
  
  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: Colors.transparent,
      elevation: 0,
      title: const Text('Reels', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      leading: Container(
        margin: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: Colors.black45,
          shape: BoxShape.circle,
        ),
        child: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white, size: 18),
          onPressed: () {
            // Pause all videos and clear cache
            _videoCache.pauseAll();
            _videoCache.clear();
            
            // Navigate to main screen (home tab)
            Navigator.pushNamedAndRemoveUntil(
              context,
              '/main',
              (route) => false,
              arguments: {'initialIndex': 0}, // Home tab
            );
          },
        ),
      ),
    );
  }
}

/// Cached reel player with persistent video controller
class _CachedReelPlayer extends StatefulWidget {
  final ReelModel reel;
  final bool isActive;
  final bool isTabActive;
  final bool isBoosted;         // Phase 2: Is this a promoted reel?
  final ReelService reelService;
  final _VideoCache videoCache;
  final VoidCallback? onViewComplete; // Phase 2: Called after 3 seconds for CPV
  
  const _CachedReelPlayer({
    super.key,
    required this.reel,
    required this.isActive,
    required this.isTabActive,
    this.isBoosted = false,
    required this.reelService,
    required this.videoCache,
    this.onViewComplete,
  });
  
  // Combined check: only play if BOTH tab is visible AND this is the current reel
  bool get shouldPlay => isTabActive && isActive;

  @override
  State<_CachedReelPlayer> createState() => _CachedReelPlayerState();
}

class _CachedReelPlayerState extends State<_CachedReelPlayer> {
  VideoPlayerController? _controller;
  bool _isInitialized = false;
  bool _isPaused = false;
  bool _isLiked = false;
  bool _hasTrackedView = false;
  bool _showHeart = false;
  bool _hasError = false;
  bool _isDisposed = false;
  
  // Seek & buffering state
  bool _isSeeking = false;
  bool _isSeekingForward = false;
  bool _isBuffering = false;
  bool _isSaved = false;
  Timer? _seekTimer;
  VoidCallback? _bufferListener;
  
  // Phase 2: CPV billing timer
  Timer? _cpvTimer;
  bool _hasBilledCPV = false;
  
  @override
  void initState() {
    super.initState();
    _isDisposed = false;
    _initVideo();
    _checkIfLiked();
    _checkIfSaved();
  }
  
  @override
  void didUpdateWidget(_CachedReelPlayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    
    // Check if play state changed (either tab visibility or current reel changed)
    final bool shouldPlayNow = widget.shouldPlay;
    final bool wasPlaying = oldWidget.shouldPlay;
    
    if (shouldPlayNow != wasPlaying) {
      if (shouldPlayNow) {
        _controller?.play();
        _trackView();
        _startCPVTimer(); // Phase 2: Start 3-second timer for CPV billing
      } else {
        _controller?.pause();
        _cpvTimer?.cancel(); // Stop timer if paused
      }
    }
  }
  
  /// Phase 2: Start 3-second timer for CPV billing (boosted reels only)
  void _startCPVTimer() {
    if (!widget.isBoosted || _hasBilledCPV) return;
    
    _cpvTimer?.cancel();
    _cpvTimer = Timer(const Duration(seconds: 3), () {
      if (!_isDisposed && mounted && widget.shouldPlay) {
        _hasBilledCPV = true;
        widget.onViewComplete?.call();
      }
    });
  }
  
  @override
  void dispose() {
    _isDisposed = true;
    _seekTimer?.cancel();
    _cpvTimer?.cancel(); // Phase 2: Cancel CPV timer
    _controller?.removeListener(_bufferListener ?? () {});
    // Don't dispose controller - it's managed by the cache
    super.dispose();
  }
  
  void _safeSetState(VoidCallback fn) {
    if (!_isDisposed && mounted) {
      setState(fn);
    }
  }
  
  // ✅ NEW: Start seeking forward or backward
  void _startSeek({required bool isForward}) {
    if (_controller == null || !_isInitialized) return;
    
    HapticFeedback.mediumImpact();
    _safeSetState(() {
      _isSeeking = true;
      _isSeekingForward = isForward;
    });
    
    // Perform initial seek
    _performSeek(isForward);
    
    // Set up repeated seeking while held
    _seekTimer = Timer.periodic(const Duration(milliseconds: 500), (_) {
      _performSeek(isForward);
       HapticFeedback.lightImpact();
    });
  }
  
  // ✅ NEW: Perform a single seek operation
  void _performSeek(bool isForward) {
    if (_controller == null) return;
    
    final current = _controller!.value.position;
    final duration = _controller!.value.duration;
    final seekAmount = const Duration(seconds: 10);
    
    Duration newPosition;
    if (isForward) {
      newPosition = current + seekAmount;
      if (newPosition > duration) newPosition = duration;
    } else {
      newPosition = current - seekAmount;
      if (newPosition < Duration.zero) newPosition = Duration.zero;
    }
    
    _controller!.seekTo(newPosition);
  }
  
  // ✅ NEW: Stop seeking
  void _stopSeek() {
    _seekTimer?.cancel();
    _seekTimer = null;
    _safeSetState(() => _isSeeking = false);
  }
  
  // ✅ NEW: Set up buffer listener
  void _setupBufferListener() {
    if (_controller == null) return;
    
    _bufferListener = () {
      if (_isDisposed || !mounted) return;
      final isBuffering = _controller!.value.isBuffering;
      if (_isBuffering != isBuffering) {
        _safeSetState(() => _isBuffering = isBuffering);
      }
    };
    _controller!.addListener(_bufferListener!);
  }
  
  Future<void> _initVideo() async {
    final url = widget.reel.videoUrl;
    final preloadProvider = ReelsPreloadProvider();
    
    debugPrint('🎬 _initVideo: shouldPlay=${widget.shouldPlay}, isActive=${widget.isActive}, isTabActive=${widget.isTabActive}');
    
    // 1. Check GLOBAL preload provider first (instant playback!)
    final preloaded = preloadProvider.getController(url);
    if (preloaded != null && preloaded.value.isInitialized) {
      _controller = preloaded;
      preloadProvider.prepareForPlayback(url); // Restore volume
      _setupBufferListener(); // ✅ Hook up buffering detection
      _safeSetState(() => _isInitialized = true);
      
      if (widget.shouldPlay) {
        debugPrint('🎬 Playing preloaded video');
        await _controller!.seekTo(Duration.zero);
        _controller!.play();
        _trackView();
      }
      debugPrint('🎬 Using preloaded video: ${url.split('/').last}');
      return;
    }
    
    // 2. Check per-screen cache second
    final cached = widget.videoCache.get(url);
    if (cached != null && cached.value.isInitialized) {
      _controller = cached;
      _setupBufferListener(); // ✅ Hook up buffering detection
      _safeSetState(() => _isInitialized = true);
      
      if (widget.shouldPlay) {
        debugPrint('🎬 Playing cached video');
        await _controller!.seekTo(Duration.zero);
        _controller!.play();
        _trackView();
      }
      return;
    }
    
    // 3. Create new controller as fallback
    try {
      debugPrint('🎬 Loading video on-demand');
      debugPrint('🎬 Full URL: $url');
      
      // Check if this is an external embed URL (YouTube/Instagram)
      // These won't work with video_player - they need WebView
      if (url.contains('youtube.com/embed') || url.contains('instagram.com')) {
        debugPrint('⚠️ External embed URL detected - video_player cannot play this');
        _safeSetState(() => _hasError = true);
        return;
      }
      
      _controller = VideoPlayerController.networkUrl(
        Uri.parse(url),
        videoPlayerOptions: VideoPlayerOptions(mixWithOthers: false),
      );
      
      await _controller!.initialize();
      _controller!.setLooping(true);
      _setupBufferListener(); // ✅ Hook up buffering detection
      
      // Add to cache
      widget.videoCache.put(url, _controller!);
      
      _safeSetState(() => _isInitialized = true);
      
      // Always check shouldPlay after initialization completes
      if (widget.shouldPlay) {
        debugPrint('🎬 Playing on-demand video after init');
        _controller!.play();
        _trackView();
      }
    } catch (e) {
      debugPrint('❌ Error initializing video: $e');
      debugPrint('❌ Failed URL: ${widget.reel.videoUrl}');
      _safeSetState(() => _hasError = true);
    }
  }
  
  Future<void> _checkIfLiked() async {
    final userId = safeFirebaseUserId();
    if (userId == null) return;
    
    try {
      final liked = await widget.reelService.hasUserLiked(
        reelId: widget.reel.id,
        userId: userId,
      );
      _safeSetState(() => _isLiked = liked);
    } catch (e) {
      debugPrint('Error checking like: $e');
    }
  }
  
  // ✅ NEW: Check if reel is saved by user
  Future<void> _checkIfSaved() async {
    final userId = safeFirebaseUserId();
    if (userId == null) return;
    
    try {
      final doc = await FirebaseFirestore.instance
          .collection('users')
          .doc(userId)
          .collection('saved_reels')
          .doc(widget.reel.id)
          .get();
      _safeSetState(() => _isSaved = doc.exists);
    } catch (e) {
      debugPrint('Error checking saved: $e');
    }
  }
  
  // ✅ NEW: Toggle save/unsave reel
  Future<void> _toggleSave() async {
    final userId = safeFirebaseUserId();
    if (userId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please login to save reels')),
      );
      return;
    }
    
    HapticFeedback.mediumImpact();
    
    try {
      final docRef = FirebaseFirestore.instance
          .collection('users')
          .doc(userId)
          .collection('saved_reels')
          .doc(widget.reel.id);
      
      if (_isSaved) {
        // Unsave
        await docRef.delete();
        _safeSetState(() => _isSaved = false);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Removed from saved'),
              duration: Duration(seconds: 1),
            ),
          );
        }
      } else {
        // Save
        await docRef.set({
          'savedAt': FieldValue.serverTimestamp(),
          'reelId': widget.reel.id,
          'productName': widget.reel.productName,
          'thumbnailUrl': widget.reel.thumbnailUrl,
        });
        _safeSetState(() => _isSaved = true);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Saved to your collection'),
              duration: const Duration(seconds: 2),
              action: SnackBarAction(
                label: 'View',
                textColor: AppColors.primary,
                onPressed: () {
                  Navigator.pushNamed(context, '/saved-reels');
                },
              ),
            ),
          );
        }
      }
    } catch (e) {
      debugPrint('Error toggling save: $e');
    }
  }
  
  void _trackView() {
    if (_hasTrackedView) return;
    _hasTrackedView = true;
    
    final userId = safeFirebaseUserId();
    if (userId != null) {
      widget.reelService.trackView(reelId: widget.reel.id, userId: userId);
    }
  }
  
  void _togglePlayPause() {
    if (_controller == null || !_isInitialized) return;
    
    HapticFeedback.lightImpact();
    
    if (_controller!.value.isPlaying) {
      _controller!.pause();
      _safeSetState(() => _isPaused = true);
    } else {
      _controller!.play();
      _safeSetState(() => _isPaused = false);
    }
  }
  
  Future<void> _toggleLike({bool fromDoubleTap = false}) async {
    final userId = safeFirebaseUserId();
    if (userId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please login to like')),
      );
      return;
    }
    
    HapticFeedback.mediumImpact();
    
    if (fromDoubleTap) {
      _safeSetState(() => _showHeart = true);
      Future.delayed(const Duration(milliseconds: 700), () {
        _safeSetState(() => _showHeart = false);
      });
    }
    
    try {
      final liked = await widget.reelService.toggleLike(
        reelId: widget.reel.id,
        userId: userId,
      );
      _safeSetState(() => _isLiked = liked);
    } catch (e) {
      debugPrint('Error toggling like: $e');
    }
  }
  
  Future<void> _shareReel() async {
    HapticFeedback.lightImpact();
    await widget.reelService.trackShare(reelId: widget.reel.id);
    
    // Generate unique shareable URL for this reel
    const baseUrl = 'https://letbuyy.com';
    final shareUrl = '$baseUrl/reels/${widget.reel.id}';
    
    await Share.share(
      '🎬 Check out ${widget.reel.productName} on LetBuyy!\n\n$shareUrl',
      subject: '${widget.reel.productName} - LetBuyy',
    );
  }
  
  void _showProductSheet() {
    HapticFeedback.mediumImpact();
    _controller?.pause();
    
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ProductSheet(reel: widget.reel),
    ).then((_) {
      if (widget.isActive && mounted) {
        _controller?.play();
      }
    });
  }
  
  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    
    return Stack(
      fit: StackFit.expand,
      children: [
        // Main gesture detector for tap to play/pause
        GestureDetector(
          onTap: _togglePlayPause,
          onDoubleTap: () => _toggleLike(fromDoubleTap: true),
          child: Container(
            color: Colors.black,
            child: Stack(
              fit: StackFit.expand,
              children: [
                // Video
                _buildVideo(),
                
                // ✅ LONG-PRESS SEEK ZONES
                Row(
                  children: [
                    // Left side - Rewind 10s
                    Expanded(
                      child: GestureDetector(
                        behavior: HitTestBehavior.translucent,
                        onLongPressStart: (_) => _startSeek(isForward: false),
                        onLongPressEnd: (_) => _stopSeek(),
                        child: Container(color: Colors.transparent),
                      ),
                    ),
                    // Right side - Forward 10s
                    Expanded(
                      child: GestureDetector(
                        behavior: HitTestBehavior.translucent,
                        onLongPressStart: (_) => _startSeek(isForward: true),
                        onLongPressEnd: (_) => _stopSeek(),
                        child: Container(color: Colors.transparent),
                      ),
                    ),
                  ],
                ),
                
                // Heart animation
                if (_showHeart)
                  Center(
                    child: TweenAnimationBuilder<double>(
                      tween: Tween(begin: 0.5, end: 1.0),
                      duration: const Duration(milliseconds: 200),
                      curve: Curves.elasticOut,
                      builder: (_, value, __) {
                        return Transform.scale(
                          scale: value,
                          child: const Icon(Icons.favorite, size: 100, color: Colors.white),
                        );
                      },
                    ),
                  ),
                
                // ✅ SEEK INDICATOR (shows when long-pressing)
                if (_isSeeking)
                  Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                      decoration: BoxDecoration(
                        color: Colors.black87,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            _isSeekingForward ? Icons.fast_forward : Icons.fast_rewind,
                            color: Colors.white,
                            size: 32,
                          ),
                          const SizedBox(width: 12),
                          Text(
                            _isSeekingForward ? '+10s' : '-10s',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                
                // ✅ BUFFERING INDICATOR
                if (_isBuffering && _isInitialized)
                  Center(
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.black54,
                        shape: BoxShape.circle,
                      ),
                      child: CircularProgressIndicator(
                        color: AppColors.primary,
                        strokeWidth: 3,
                      ),
                    ),
                  ),
                
                // Pause icon
                if (_isPaused && _isInitialized && !_isSeeking)
                  Center(
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.black54,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.play_arrow, size: 50, color: Colors.white),
                    ),
                  ),
                
                // Gradients
                _buildGradients(),
                
                // SOURCE TYPE BADGE (Instagram/YouTube/Upload)
                Positioned(
                  top: MediaQuery.of(context).padding.top + 50,
                  left: 12,
                  child: _buildSourceTypeBadge(),
                ),
                
                // Phase 2: "AD" badge for boosted/promoted reels
                if (widget.isBoosted)
                  Positioned(
                    top: MediaQuery.of(context).padding.top + 50,
                    right: 70,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.amber.withValues(alpha: 0.9),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.campaign, color: Colors.black, size: 14),
                          SizedBox(width: 4),
                          Text(
                            'Promoted',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Colors.black,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                
                // Progress bar
                if (_isInitialized && _controller != null)
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: _ProgressBar(controller: _controller!),
                  ),
                
                // Actions
                _buildActions(),
                
                // Bottom info
                _buildBottomInfo(),
                
                // Product card
                _buildProductCard(),
              ],
            ),
          ),
        ),
      ],
    );
  }
  
  /// Build source type badge for external content
  Widget _buildSourceTypeBadge() {
    final sourceType = widget.reel.sourceType;
    
    // Don't show badge for regular uploads (null or empty)
    if (sourceType == null || sourceType.isEmpty) {
      return const SizedBox.shrink();
    }
    
    IconData icon;
    Color bgColor;
    String label;
    
    switch (sourceType) {
      case 'instagram':
        icon = Icons.camera_alt_rounded;
        bgColor = const Color(0xFFE4405F); // Instagram pink
        label = 'Instagram';
        break;
      case 'youtube':
        icon = Icons.play_circle_filled_rounded;
        bgColor = const Color(0xFFFF0000); // YouTube red
        label = 'YouTube';
        break;
      default:
        return const SizedBox.shrink();
    }
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: bgColor.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: bgColor.withValues(alpha: 0.4),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white, size: 14),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildVideo() {
    // Check if this is an external source (Instagram/YouTube)
    final sourceType = widget.reel.sourceType;
    final isExternalSource = sourceType == 'instagram' || sourceType == 'youtube';
    
    if (isExternalSource) {
      return _buildExternalVideo();
    }
    
    if (_hasError) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Colors.white38),
            const SizedBox(height: 12),
            const Text('Failed to load', style: TextStyle(color: Colors.white54)),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () {
                _safeSetState(() => _hasError = false);
                widget.videoCache.remove(widget.reel.videoUrl);
                _initVideo();
              },
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }
    
    if (!_isInitialized) {
      return Stack(
        fit: StackFit.expand,
        children: [
          if (widget.reel.thumbnailUrl != null)
            Image.network(
              widget.reel.thumbnailUrl!,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(color: Colors.grey[900]),
            )
          else
            Container(color: Colors.grey[900]),
          Center(
            child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 3),
          ),
        ],
      );
    }
    
    return SizedBox.expand(
      child: FittedBox(
        fit: BoxFit.cover,
        child: SizedBox(
          width: _controller!.value.size.width,
          height: _controller!.value.size.height,
          child: VideoPlayer(_controller!),
        ),
      ),
    );
  }
  
  /// Build WebView for external embed sources (Instagram/YouTube)
  Widget _buildExternalVideo() {
    final embedUrl = widget.reel.videoUrl;
    
    return Stack(
      fit: StackFit.expand,
      children: [
        // Show thumbnail as background while loading
        if (widget.reel.thumbnailUrl != null)
          Image.network(
            widget.reel.thumbnailUrl!,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => Container(color: Colors.grey[900]),
          )
        else
          Container(color: Colors.grey[900]),
        
        // WebView for embedded content
        WebViewWidget(
          controller: WebViewController()
            ..setJavaScriptMode(JavaScriptMode.unrestricted)
            ..setBackgroundColor(Colors.black)
            ..loadRequest(Uri.parse(embedUrl)),
        ),
        
        // Loading overlay (will be covered by WebView content)
        Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(color: AppColors.primary, strokeWidth: 3),
              const SizedBox(height: 12),
              Text(
                'Loading ${widget.reel.sourceType == 'instagram' ? 'Instagram' : 'YouTube'} Reel...',
                style: const TextStyle(color: Colors.white54, fontSize: 12),
              ),
            ],
          ),
        ),
      ],
    );
  }
  
  Widget _buildGradients() {
    return Column(
      children: [
        Container(
          height: 100,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Colors.black54, Colors.transparent],
            ),
          ),
        ),
        const Spacer(),
        Container(
          height: 180,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.bottomCenter,
              end: Alignment.topCenter,
              colors: [Colors.black87, Colors.transparent],
            ),
          ),
        ),
      ],
    );
  }
  
  Widget _buildActions() {
    return Positioned(
      right: 12,
      bottom: 160,
      child: Column(
        children: [
          _ActionBtn(
            icon: _isLiked ? Icons.favorite : Icons.favorite_border,
            label: 'Like',
            color: _isLiked ? AppColors.error : Colors.white,
            onTap: () => _toggleLike(),
          ),
          const SizedBox(height: 20),
          _ActionBtn(
            icon: Icons.chat_bubble_outline,
            label: 'Comment',
            onTap: _showComments,
          ),
          const SizedBox(height: 20),
          _ActionBtn(icon: Icons.send, label: 'Share', onTap: _shareReel),
          const SizedBox(height: 20),
          // ✅ NEW: Save/Bookmark button
          _ActionBtn(
            icon: _isSaved ? Icons.bookmark : Icons.bookmark_border,
            label: _isSaved ? 'Saved' : 'Save',
            color: _isSaved ? AppColors.primary : Colors.white,
            onTap: _toggleSave,
          ),
          const SizedBox(height: 20),
          GestureDetector(
            onTap: _showProductSheet,
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    gradient: AppColors.primaryGradient,
                    shape: BoxShape.circle,
                    boxShadow: [BoxShadow(color: AppColors.primary.withValues(alpha: 0.5), blurRadius: 8)],
                  ),
                  child: const Icon(Icons.shopping_bag, size: 22, color: Colors.white),
                ),
                const SizedBox(height: 4),
                const Text('Buy', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        ],
      ),
    );
  }
  
  void _showComments() {
    _controller?.pause();
    ReelCommentsSheet.show(
      context,
      reelId: widget.reel.id,
      sellerId: widget.reel.sellerId,
      onClose: () {
        if (widget.isActive && mounted) {
          _controller?.play();
        }
      },
    );
  }
  
  Widget _buildBottomInfo() {
    return Positioned(
      left: 12,
      right: 70,
      bottom: 40,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Views count
          FutureBuilder<ReelStatsModel?>(
            future: widget.reelService.getReelStats(widget.reel.id),
            builder: (context, snapshot) {
              final views = snapshot.data?.views ?? 0;
              if (views == 0) return const SizedBox.shrink();
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    const Icon(Icons.visibility_outlined, size: 14, color: Colors.white70),
                    const SizedBox(width: 4),
                    Text(
                      '${_formatViews(views)} views',
                      style: const TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                  ],
                ),
              );
            },
          ),
          
          // Seller name (tappable)
          GestureDetector(
            onTap: () => _openSellerProfile(),
            child: Row(
              children: [
                Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.primary, width: 2),
                  ),
                  child: const CircleAvatar(
                    radius: 14,
                    backgroundColor: Colors.white12,
                    child: Icon(Icons.store, size: 14, color: Colors.white),
                  ),
                ),
                const SizedBox(width: 8),
                FutureBuilder<String>(
                  future: _getSellerName(),
                  builder: (context, snapshot) {
                    final name = snapshot.data ?? 'seller';
                    return Text(
                      '@$name',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
          if (widget.reel.caption.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              widget.reel.caption,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          if (widget.reel.hashtags.isNotEmpty) ...[
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              children: widget.reel.hashtags.take(3).map((t) => Text(
                '#$t',
                style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600, fontSize: 12),
              )).toList(),
            ),
          ],
        ],
      ),
    );
  }
  
  String _formatViews(int views) {
    if (views >= 1000000) {
      return '${(views / 1000000).toStringAsFixed(1)}M';
    } else if (views >= 1000) {
      return '${(views / 1000).toStringAsFixed(1)}K';
    }
    return views.toString();
  }
  
  Future<String> _getSellerName() async {
    try {
      final doc = await FirebaseFirestore.instance
          .collection('sellers')
          .doc(widget.reel.sellerId)
          .get();
      if (doc.exists) {
        final data = doc.data() ?? {};
        return data['businessName'] ?? data['name'] ?? 'seller';
      }
    } catch (e) {
      debugPrint('Error getting seller name: $e');
    }
    return 'seller';
  }
  
  void _openSellerProfile() {
    _controller?.pause();
    Navigator.pushNamed(
      context,
      '/seller-profile/${widget.reel.sellerId}',
    ).then((_) {
      if (widget.isActive && mounted) {
        _controller?.play();
      }
    });
  }
  
  Widget _buildProductCard() {
    final hasDiscount = widget.reel.productSalePrice != null && 
        widget.reel.productSalePrice! < widget.reel.productPrice;
    
    return Positioned(
      left: 12,
      right: 70,
      bottom: 130,
      child: GestureDetector(
        onTap: _showProductSheet,
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: Colors.black54,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.white24),
          ),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.network(
                  widget.reel.productImage,
                  width: 48,
                  height: 48,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                    width: 48,
                    height: 48,
                    color: Colors.grey[800],
                    child: const Icon(Icons.image, color: Colors.white38, size: 20),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      widget.reel.productName,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Text(
                          '₹${(hasDiscount ? widget.reel.productSalePrice! : widget.reel.productPrice).toStringAsFixed(0)}',
                          style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                        if (hasDiscount) ...[
                          const SizedBox(width: 6),
                          Text(
                            '₹${widget.reel.productPrice.toStringAsFixed(0)}',
                            style: const TextStyle(color: Colors.white38, fontSize: 11, decoration: TextDecoration.lineThrough),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: Colors.white38),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActionBtn extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color color;
  
  const _ActionBtn({required this.icon, required this.label, required this.onTap, this.color = Colors.white});
  
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: Colors.black45, shape: BoxShape.circle),
            child: Icon(icon, size: 24, color: color),
          ),
          const SizedBox(height: 4),
          Text(label, style: TextStyle(color: color, fontSize: 11)),
        ],
      ),
    );
  }
}

/// ✅ Enhanced seekable progress bar - pauses on drag, shows time
class _ProgressBar extends StatefulWidget {
  final VideoPlayerController controller;
  final VoidCallback? onSeekStart;
  final VoidCallback? onSeekEnd;
  
  const _ProgressBar({
    required this.controller,
    this.onSeekStart,
    this.onSeekEnd,
  });

  @override
  State<_ProgressBar> createState() => _ProgressBarState();
}

class _ProgressBarState extends State<_ProgressBar> {
  bool _isDragging = false;
  double _dragPosition = 0.0;
  bool _wasPlayingBeforeDrag = false;

  String _formatDuration(Duration duration) {
    final minutes = duration.inMinutes.remainder(60).toString().padLeft(1, '0');
    final seconds = duration.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  void _onHorizontalDragStart(DragStartDetails details) {
    _wasPlayingBeforeDrag = widget.controller.value.isPlaying;
    widget.controller.pause();
    widget.onSeekStart?.call();
    HapticFeedback.lightImpact();
    setState(() => _isDragging = true);
  }

  void _onHorizontalDragUpdate(DragUpdateDetails details, BoxConstraints constraints) {
    final box = constraints.maxWidth;
    final position = (details.localPosition.dx / box).clamp(0.0, 1.0);
    setState(() => _dragPosition = position);
  }

  void _onHorizontalDragEnd(DragEndDetails details) {
    final duration = widget.controller.value.duration;
    final newPosition = Duration(milliseconds: (duration.inMilliseconds * _dragPosition).toInt());
    widget.controller.seekTo(newPosition);
    
    if (_wasPlayingBeforeDrag) {
      widget.controller.play();
    }
    widget.onSeekEnd?.call();
    HapticFeedback.mediumImpact();
    setState(() => _isDragging = false);
  }

  void _onTapUp(TapUpDetails details, BoxConstraints constraints) {
    final box = constraints.maxWidth;
    final position = (details.localPosition.dx / box).clamp(0.0, 1.0);
    final duration = widget.controller.value.duration;
    final newPosition = Duration(milliseconds: (duration.inMilliseconds * position).toInt());
    widget.controller.seekTo(newPosition);
    HapticFeedback.lightImpact();
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<VideoPlayerValue>(
      valueListenable: widget.controller,
      builder: (_, value, __) {
        final duration = value.duration.inMilliseconds.toDouble();
        final position = value.position.inMilliseconds.toDouble();
        final progress = _isDragging 
            ? _dragPosition 
            : (duration > 0 ? (position / duration).clamp(0.0, 1.0) : 0.0);
        
        return LayoutBuilder(
          builder: (context, constraints) {
            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Time display when dragging
                if (_isDragging)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.black87,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        '${_formatDuration(Duration(milliseconds: (duration * _dragPosition).toInt()))} / ${_formatDuration(value.duration)}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                  
                // Progress bar
                GestureDetector(
                  onHorizontalDragStart: _onHorizontalDragStart,
                  onHorizontalDragUpdate: (d) => _onHorizontalDragUpdate(d, constraints),
                  onHorizontalDragEnd: _onHorizontalDragEnd,
                  onTapUp: (d) => _onTapUp(d, constraints),
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    height: _isDragging ? 24 : 16, // Larger hit area when dragging
                    alignment: Alignment.center,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      height: _isDragging ? 6 : 3,
                      margin: const EdgeInsets.symmetric(horizontal: 16),
                      decoration: BoxDecoration(
                        color: Colors.white24,
                        borderRadius: BorderRadius.circular(3),
                      ),
                      child: Stack(
                        children: [
                          // Progress fill
                          FractionallySizedBox(
                            alignment: Alignment.centerLeft,
                            widthFactor: progress,
                            child: Container(
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [AppColors.primary, AppColors.primaryLight],
                                ),
                                borderRadius: BorderRadius.circular(3),
                                boxShadow: _isDragging ? [
                                  BoxShadow(
                                    color: AppColors.primary.withValues(alpha: 0.5),
                                    blurRadius: 8,
                                    spreadRadius: 1,
                                  ),
                                ] : null,
                              ),
                            ),
                          ),
                          // Thumb indicator when dragging
                          if (_isDragging)
                            Positioned(
                              left: (constraints.maxWidth - 32) * progress - 6,
                              top: -3,
                              child: Container(
                                width: 12,
                                height: 12,
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  shape: BoxShape.circle,
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black26,
                                      blurRadius: 4,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }
}

class _ProductSheet extends StatelessWidget {
  final ReelModel reel;
  const _ProductSheet({required this.reel});
  
  @override
  Widget build(BuildContext context) {
    final hasDiscount = reel.productSalePrice != null && reel.productSalePrice! < reel.productPrice;
    
    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.6),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(color: Colors.grey[400], borderRadius: BorderRadius.circular(2)),
          ),
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.network(reel.productImage, height: 160, width: double.infinity, fit: BoxFit.cover),
                  ),
                  const SizedBox(height: 16),
                  Text(reel.productName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Text(
                        '₹${(hasDiscount ? reel.productSalePrice! : reel.productPrice).toStringAsFixed(0)}',
                        style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: AppColors.primary),
                      ),
                      if (hasDiscount) ...[
                        const SizedBox(width: 8),
                        Text(
                          '₹${reel.productPrice.toStringAsFixed(0)}',
                          style: TextStyle(fontSize: 14, color: Colors.grey[500], decoration: TextDecoration.lineThrough),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('${reel.productName} added to cart!'), backgroundColor: AppColors.success),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: const Text('Add to Cart'),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
