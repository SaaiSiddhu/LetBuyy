// lib/screens/reels/saved_reels_screen.dart
// 🔥 Instagram-Style Saved Reels - Full Screen PageView
// Header at top, actions at bottom - all overlaid on video

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:video_player/video_player.dart';
import 'package:share_plus/share_plus.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'widgets/reel_comments_sheet.dart';
import 'reels_feed_screen.dart';

class SavedReelsScreen extends StatefulWidget {
  const SavedReelsScreen({super.key});

  @override
  State<SavedReelsScreen> createState() => _SavedReelsScreenState();
}

class _SavedReelsScreenState extends State<SavedReelsScreen> {
  final ReelService _reelService = ReelService();
  final PageController _pageController = PageController();
  
  List<ReelModel> _savedReels = [];
  bool _isLoading = true;
  int _currentIndex = 0;
  
  @override
  void initState() {
    super.initState();
    _loadSavedReels();
  }
  
  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }
  
  Future<void> _loadSavedReels() async {
    final userId = FirebaseAuth.instance.currentUser?.uid;
    if (userId == null) {
      setState(() => _isLoading = false);
      return;
    }
    
    try {
      final savedDoc = await FirebaseFirestore.instance
          .collection('users')
          .doc(userId)
          .collection('saved_reels')
          .orderBy('savedAt', descending: true)
          .get();
      
      final reelIds = savedDoc.docs.map((d) => d.id).toList();
      
      if (reelIds.isEmpty) {
        setState(() {
          _savedReels = [];
          _isLoading = false;
        });
        return;
      }
      
      final reels = <ReelModel>[];
      for (final id in reelIds) {
        final reel = await _reelService.getReel(id);
        if (reel != null) reels.add(reel);
      }
      
      setState(() {
        _savedReels = reels;
        _isLoading = false;
      });
    } catch (e) {
      debugPrint('Error loading saved reels: $e');
      setState(() => _isLoading = false);
    }
  }
  
  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(child: CircularProgressIndicator(color: Colors.white)),
      );
    }
    
    if (_savedReels.isEmpty) {
      return _buildEmptyState();
    }
    
    return Scaffold(
      resizeToAvoidBottomInset: false, // 🔥 KEYBOARD FIX
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Full-screen PageView
          PageView.builder(
            controller: _pageController,
            scrollDirection: Axis.vertical,
            itemCount: _savedReels.length,
            onPageChanged: (i) => setState(() => _currentIndex = i),
            itemBuilder: (context, index) {
              return _SavedReelCard(
                key: ValueKey(_savedReels[index].id),
                reel: _savedReels[index],
                isActive: index == _currentIndex,
                reelService: _reelService,
                onRemove: () {
                  setState(() => _savedReels.removeAt(index));
                  if (_savedReels.isEmpty) Navigator.pop(context);
                },
              );
            },
          ),
          
          // Back button (top left)
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.arrow_back, color: Colors.white, size: 28),
              ),
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildEmptyState() {
    return Scaffold(
      resizeToAvoidBottomInset: false, // 🔥 KEYBOARD FIX
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.bookmark_border, size: 80, color: Colors.white24),
            const SizedBox(height: 24),
            const Text('No Saved Reels', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            const Text('Tap bookmark on reels to save them', style: TextStyle(color: Colors.white54)),
            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: () => Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const ReelsFeedScreen())),
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14)),
              child: const Text('Explore Reels'),
            ),
          ],
        ),
      ),
    );
  }
}

class _SavedReelCard extends StatefulWidget {
  final ReelModel reel;
  final bool isActive;
  final ReelService reelService;
  final VoidCallback onRemove;
  
  const _SavedReelCard({
    super.key,
    required this.reel,
    required this.isActive,
    required this.reelService,
    required this.onRemove,
  });

  @override
  State<_SavedReelCard> createState() => _SavedReelCardState();
}

class _SavedReelCardState extends State<_SavedReelCard> {
  VideoPlayerController? _controller;
  bool _initialized = false;
  bool _paused = false;
  bool _liked = false;
  bool _following = false;
  bool _showHeart = false;
  String? _sellerName;
  String? _sellerAvatar;
  int _likes = 0;
  int _comments = 0;
  int _shares = 0;
  
  @override
  void initState() {
    super.initState();
    _initVideo();
    _loadData();
  }
  
  @override
  void didUpdateWidget(_SavedReelCard old) {
    super.didUpdateWidget(old);
    if (widget.isActive && !old.isActive) {
      _controller?.play();
    } else if (!widget.isActive && old.isActive) {
      _controller?.pause();
    }
  }
  
  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }
  
  Future<void> _initVideo() async {
    try {
      _controller = VideoPlayerController.networkUrl(Uri.parse(widget.reel.videoUrl));
      await _controller!.initialize();
      _controller!.setLooping(true);
      if (mounted) {
        setState(() => _initialized = true);
        if (widget.isActive) _controller!.play();
      }
    } catch (e) {
      debugPrint('Video error: $e');
    }
  }
  
  Future<void> _loadData() async {
    final userId = FirebaseAuth.instance.currentUser?.uid;
    
    // Load stats
    try {
      final stats = await widget.reelService.getReelStats(widget.reel.id);
      if (stats != null && mounted) {
        setState(() {
          _likes = stats.likes;
          _comments = stats.comments;
          _shares = stats.shares;
        });
      }
    } catch (_) {}
    
    // Load seller
    try {
      final doc = await FirebaseFirestore.instance.collection('sellers').doc(widget.reel.sellerId).get();
      if (doc.exists && mounted) {
        setState(() {
          _sellerName = doc.data()?['businessName'] ?? doc.data()?['name'] ?? 'Seller';
          _sellerAvatar = doc.data()?['profileImageUrl'] ?? doc.data()?['logoUrl'];
        });
      }
    } catch (_) {}
    
    // Check liked
    if (userId != null) {
      try {
        _liked = await widget.reelService.hasUserLiked(reelId: widget.reel.id, userId: userId);
        if (mounted) setState(() {});
      } catch (_) {}
      
      // Check following
      try {
        final fDoc = await FirebaseFirestore.instance.collection('seller_followers').doc(widget.reel.sellerId).collection('followers').doc(userId).get();
        if (mounted) setState(() => _following = fDoc.exists);
      } catch (_) {}
    }
  }
  
  void _togglePlay() {
    HapticFeedback.lightImpact();
    if (_controller == null) return;
    if (_controller!.value.isPlaying) {
      _controller!.pause();
      setState(() => _paused = true);
    } else {
      _controller!.play();
      setState(() => _paused = false);
    }
  }
  
  Future<void> _toggleLike({bool doubleTap = false}) async {
    final userId = FirebaseAuth.instance.currentUser?.uid;
    if (userId == null) return;
    HapticFeedback.mediumImpact();
    
    if (doubleTap && !_liked) {
      setState(() => _showHeart = true);
      Future.delayed(const Duration(milliseconds: 800), () {
        if (mounted) setState(() => _showHeart = false);
      });
    }
    
    try {
      final liked = await widget.reelService.toggleLike(reelId: widget.reel.id, userId: userId);
      setState(() {
        _liked = liked;
        _likes += liked ? 1 : -1;
        if (_likes < 0) _likes = 0;
      });
    } catch (_) {}
  }
  
  Future<void> _toggleFollow() async {
    final userId = FirebaseAuth.instance.currentUser?.uid;
    if (userId == null) return;
    HapticFeedback.mediumImpact();
    
    try {
      final ref = FirebaseFirestore.instance.collection('seller_followers').doc(widget.reel.sellerId).collection('followers').doc(userId);
      if (_following) {
        await ref.delete();
      } else {
        await ref.set({'followedAt': FieldValue.serverTimestamp()});
      }
      setState(() => _following = !_following);
    } catch (_) {}
  }
  
  Future<void> _unsave() async {
    final userId = FirebaseAuth.instance.currentUser?.uid;
    if (userId == null) return;
    HapticFeedback.mediumImpact();
    
    try {
      await FirebaseFirestore.instance.collection('users').doc(userId).collection('saved_reels').doc(widget.reel.id).delete();
      widget.onRemove();
    } catch (_) {}
  }
  
  void _openComments() {
    _controller?.pause();
    ReelCommentsSheet.show(context, reelId: widget.reel.id, sellerId: widget.reel.sellerId, onClose: () {
      if (widget.isActive) _controller?.play();
    });
  }
  
  Future<void> _share() async {
    HapticFeedback.lightImpact();
    try {
      await Share.share('Check out this reel!\nhttps://letbuyy.com/reels/${widget.reel.id}');
      setState(() => _shares++);
    } catch (_) {}
  }
  
  String _fmt(int n) {
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
    return '$n';
  }
  
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _togglePlay,
      onDoubleTap: () => _toggleLike(doubleTap: true),
      child: Container(
        color: Colors.black,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // VIDEO
            if (_initialized && _controller != null)
              Center(
                child: AspectRatio(
                  aspectRatio: _controller!.value.aspectRatio,
                  child: VideoPlayer(_controller!),
                ),
              )
            else if (widget.reel.thumbnailUrl != null)
              Image.network(widget.reel.thumbnailUrl!, fit: BoxFit.contain)
            else
              const Center(child: CircularProgressIndicator(color: Colors.white)),
            
            // Heart animation
            if (_showHeart)
              const Center(child: Icon(Icons.favorite, size: 120, color: Colors.white)),
            
            // Pause icon
            if (_paused && _initialized)
              Center(
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: const BoxDecoration(color: Colors.black45, shape: BoxShape.circle),
                  child: const Icon(Icons.play_arrow, size: 50, color: Colors.white),
                ),
              ),
            
            // TOP: Seller header
            Positioned(
              top: MediaQuery.of(context).padding.top + 50,
              left: 16,
              right: 16,
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 18,
                    backgroundColor: Colors.grey[800],
                    backgroundImage: _sellerAvatar != null ? NetworkImage(_sellerAvatar!) : null,
                    child: _sellerAvatar == null ? const Icon(Icons.store, size: 18, color: Colors.white54) : null,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _sellerName ?? 'Seller',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (!_following)
                    TextButton(
                      onPressed: _toggleFollow,
                      style: TextButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: const Text('Follow', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    )
                  else
                    OutlinedButton(
                      onPressed: _toggleFollow,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: const BorderSide(color: Colors.white38),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: const Text('Following', style: TextStyle(fontSize: 13)),
                    ),
                  IconButton(
                    icon: const Icon(Icons.more_vert, color: Colors.white),
                    onPressed: () {
                      showModalBottomSheet(
                        context: context,
                        backgroundColor: Colors.grey[900],
                        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
                        builder: (_) => SafeArea(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const SizedBox(height: 12),
                              Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[600], borderRadius: BorderRadius.circular(2))),
                              const SizedBox(height: 16),
                              ListTile(
                                leading: const Icon(Icons.bookmark_remove, color: Colors.red),
                                title: const Text('Remove from Saved', style: TextStyle(color: Colors.white)),
                                onTap: () { Navigator.pop(context); _unsave(); },
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
            
            // BOTTOM: Actions + Caption
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: Container(
                padding: EdgeInsets.only(
                  left: 16,
                  right: 16,
                  bottom: MediaQuery.of(context).padding.bottom + 16,
                  top: 60,
                ),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                    colors: [Colors.black87, Colors.transparent],
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Actions row
                    Row(
                      children: [
                        GestureDetector(
                          onTap: () => _toggleLike(),
                          child: Icon(_liked ? Icons.favorite : Icons.favorite_border, color: _liked ? Colors.red : Colors.white, size: 28),
                        ),
                        const SizedBox(width: 4),
                        Text(_fmt(_likes), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                        const SizedBox(width: 20),
                        GestureDetector(
                          onTap: _openComments,
                          child: const Icon(Icons.chat_bubble_outline, color: Colors.white, size: 26),
                        ),
                        const SizedBox(width: 4),
                        Text(_fmt(_comments), style: const TextStyle(color: Colors.white)),
                        const SizedBox(width: 20),
                        GestureDetector(
                          onTap: _share,
                          child: const Icon(Icons.send, color: Colors.white, size: 26),
                        ),
                        const SizedBox(width: 4),
                        Text(_fmt(_shares), style: const TextStyle(color: Colors.white)),
                        const Spacer(),
                        GestureDetector(
                          onTap: _unsave,
                          child: Icon(Icons.bookmark, color: AppColors.primary, size: 28),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    // Caption
                    if (widget.reel.caption.isNotEmpty)
                      RichText(
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        text: TextSpan(
                          style: const TextStyle(color: Colors.white, fontSize: 14),
                          children: [
                            TextSpan(text: '${_sellerName ?? 'Seller'} ', style: const TextStyle(fontWeight: FontWeight.bold)),
                            TextSpan(text: widget.reel.caption),
                          ],
                        ),
                      ),
                    const SizedBox(height: 8),
                    // Product tag
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(color: Colors.white12, borderRadius: BorderRadius.circular(6)),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.shopping_bag_outlined, color: Colors.white, size: 16),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              widget.reel.productName,
                              style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            
            // Mute button (bottom right above actions)
            if (_initialized)
              Positioned(
                right: 16,
                bottom: MediaQuery.of(context).padding.bottom + 200,
                child: GestureDetector(
                  onTap: () {
                    final vol = _controller?.value.volume ?? 1;
                    _controller?.setVolume(vol > 0 ? 0 : 1);
                    setState(() {});
                  },
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: const BoxDecoration(color: Colors.black45, shape: BoxShape.circle),
                    child: Icon(
                      (_controller?.value.volume ?? 1) > 0 ? Icons.volume_up : Icons.volume_off,
                      color: Colors.white,
                      size: 20,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
