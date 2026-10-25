import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:video_player/video_player.dart';
import '../../app/store_context.dart';

import '../../models/store_model.dart';
import '../../services/media_service.dart';
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../widgets/shared/cached_merchant_image.dart';
import '../../widgets/shared/image_source_sheet.dart';
import '../../widgets/shared/merchant_media_picker.dart';

class MediaLibraryScreen extends StatefulWidget {
  const MediaLibraryScreen({super.key});

  @override
  State<MediaLibraryScreen> createState() => _MediaLibraryScreenState();
}

class _MediaLibraryScreenState extends State<MediaLibraryScreen> {
  static const _typeFilters = ['all', 'image', 'video', 'document'];

  final _searchController = TextEditingController();
  final _picker = ImagePicker();

  StoreModel? _store;
  List<MediaAssetContract> _assets = const [];
  String _type = 'all';
  bool _isLoading = true;
  bool _isBusy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadMedia();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadMedia() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final store = await context.read<StoreContext>().ensureSelectedStore();
      if (store == null) {
        if (!mounted) return;
        setState(() {
          _store = null;
          _assets = const [];
        });
        return;
      }

      final assets = await context.read<MediaService>().fetchMedia(
        store.id,
        type: _type,
        search: _searchController.text,
      );
      if (!mounted) return;
      setState(() {
        _store = store;
        _assets = assets;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = 'Unable to load media: $error');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _changeType(String type) async {
    if (_type == type || _isBusy) return;
    setState(() => _type = type);
    await _loadMedia();
  }

  Future<void> _openUploadSheet() async {
    final colors = AppThemeColors.of(context);
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: colors.card,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.image_outlined),
                title: const Text('Upload image'),
                subtitle: const Text('PNG, JPG, GIF, or WebP'),
                onTap: () async {
                  Navigator.pop(sheetContext);
                  final source = await showImageSourceSheet(
                    context,
                    title: 'Image source',
                  );
                  if (source == null) return;
                  _pickAndUpload(video: false, source: source);
                },
              ),
              ListTile(
                leading: const Icon(Icons.videocam_outlined),
                title: const Text('Upload video'),
                subtitle: const Text('Storefront video asset'),
                onTap: () {
                  Navigator.pop(sheetContext);
                  _pickAndUpload(video: true);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickAndUpload({
    required bool video,
    ImageSource source = ImageSource.gallery,
  }) async {
    final store = _store;
    if (store == null || _isBusy) return;

    setState(() => _isBusy = true);
    try {
      final picked = await pickMerchantMedia(context, source: source, pick: () => video
          ? _picker.pickVideo(source: ImageSource.gallery)
          : _picker.pickImage(source: source));
      if (!mounted || picked == null) return;
      final file = File(picked.path);
      await context.read<MediaService>().uploadAndCreate(
        storeId: store.id,
        file: file,
        folder: 'media',
        altText: _baseName(picked.name),
      );
      if (!mounted) return;
      _showMessage('Media uploaded', isSuccess: true);
      await _loadMedia();
    } catch (error) {
      if (mounted) _showMessage('$error', isError: true);
    } finally {
      if (mounted) setState(() => _isBusy = false);
    }
  }

  Future<void> _editMetadata(MediaAssetContract asset) async {
    final result = await _showMetadataEditor(asset);
    if (result == null || _isBusy) return;

    setState(() => _isBusy = true);
    try {
      await context.read<MediaService>().updateMedia(asset.id, result);
      if (!mounted) return;
      _showMessage('Media updated', isSuccess: true);
      await _loadMedia();
    } catch (error) {
      if (mounted) _showMessage('$error', isError: true);
    } finally {
      if (mounted) setState(() => _isBusy = false);
    }
  }

  Future<MediaUpdateInput?> _showMetadataEditor(
    MediaAssetContract asset,
  ) async {
    final colors = AppThemeColors.of(context);
    final altController = TextEditingController(text: asset.altText ?? '');
    final captionController = TextEditingController(text: asset.caption ?? '');
    final folderController = TextEditingController(text: asset.folder);
    final tagsController = TextEditingController(text: asset.tags.join(', '));

    final result = await showDialog<MediaUpdateInput>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: colors.card,
        title: Text('Edit media', style: TextStyle(color: colors.textPrimary)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: altController,
                decoration: const InputDecoration(labelText: 'Alt text'),
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: captionController,
                decoration: const InputDecoration(labelText: 'Caption'),
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: folderController,
                decoration: const InputDecoration(labelText: 'Folder'),
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: tagsController,
                decoration: const InputDecoration(
                  labelText: 'Tags',
                  hintText: 'hero, product, campaign',
                ),
                textInputAction: TextInputAction.done,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.pop(
                dialogContext,
                MediaUpdateInput(
                  altText: altController.text,
                  caption: captionController.text,
                  folder: folderController.text,
                  tags: tagsController.text
                      .split(',')
                      .map((tag) => tag.trim())
                      .where((tag) => tag.isNotEmpty)
                      .toList(growable: false),
                ),
              );
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );

    altController.dispose();
    captionController.dispose();
    folderController.dispose();
    tagsController.dispose();
    return result;
  }

  Future<void> _deleteAsset(MediaAssetContract asset) async {
    final confirmed = await _confirmDelete(asset);
    if (confirmed != true || _isBusy) return;

    setState(() => _isBusy = true);
    try {
      await context.read<MediaService>().deleteMedia(
        asset,
        deleteObject: asset.storageKey != null,
      );
      if (!mounted) return;
      _showMessage('Media deleted', isSuccess: true);
      await _loadMedia();
    } catch (error) {
      if (mounted) _showMessage('$error', isError: true);
    } finally {
      if (mounted) setState(() => _isBusy = false);
    }
  }

  Future<bool?> _confirmDelete(MediaAssetContract asset) {
    final colors = AppThemeColors.of(context);
    return showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: colors.card,
        title: Text(
          'Delete media?',
          style: TextStyle(color: colors.textPrimary),
        ),
        content: Text(
          'Delete "${asset.displayName}" from the media library.',
          style: TextStyle(color: colors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Scaffold(
      backgroundColor: colors.bgStart,
      floatingActionButton: _store == null
          ? null
          : FloatingActionButton.extended(
              onPressed: _isBusy ? null : _openUploadSheet,
              backgroundColor: LetbuyyColorTokens.brandPrimary,
              foregroundColor: LetbuyyColorTokens.white,
              icon: const Icon(Icons.cloud_upload_outlined),
              label: const Text('Upload'),
            ),
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildHeader(colors),
                const SizedBox(height: 14),
                _buildSearch(colors),
                const SizedBox(height: 12),
                _buildFilters(colors),
                const SizedBox(height: 14),
                Expanded(child: _buildBody(colors)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(AppThemeColors colors) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Media library',
                style: TextStyle(
                  color: colors.textPrimary,
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                _store?.name ?? 'Select a store',
                style: TextStyle(color: colors.textSecondary, fontSize: 12),
              ),
            ],
          ),
        ),
        IconButton(
          onPressed: _isLoading || _isBusy ? null : _loadMedia,
          icon: Icon(Icons.refresh_rounded, color: colors.textPrimary),
          tooltip: 'Refresh media',
        ),
      ],
    );
  }

  Widget _buildSearch(AppThemeColors colors) {
    return TextField(
      controller: _searchController,
      textInputAction: TextInputAction.search,
      onSubmitted: (_) => _loadMedia(),
      decoration: InputDecoration(
        labelText: 'Search media',
        prefixIcon: Icon(Icons.search_rounded, color: colors.textSecondary),
        suffixIcon: IconButton(
          tooltip: 'Run search',
          icon: Icon(Icons.arrow_forward_rounded, color: colors.textSecondary),
          onPressed: _isBusy ? null : _loadMedia,
        ),
      ),
    );
  }

  Widget _buildFilters(AppThemeColors colors) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final type in _typeFilters) ...[
            ChoiceChip(
              label: Text(_sentenceCase(type)),
              selected: _type == type,
              onSelected: (_) => _changeType(type),
              selectedColor: LetbuyyColorTokens.brandPrimary.withValues(
                alpha: 0.18,
              ),
              labelStyle: TextStyle(
                color: _type == type
                    ? LetbuyyColorTokens.brandPrimary
                    : colors.textSecondary,
                fontWeight: FontWeight.w700,
              ),
              side: BorderSide(
                color: _type == type
                    ? LetbuyyColorTokens.brandPrimary
                    : colors.border,
              ),
            ),
            const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }

  Widget _buildBody(AppThemeColors colors) {
    if (_isLoading) {
      return Center(
        child: CircularProgressIndicator(
          color: LetbuyyColorTokens.brandPrimary,
        ),
      );
    }
    if (_error != null) return _buildMessage(colors, _error!, Icons.error);
    if (_store == null) {
      return _buildMessage(
        colors,
        'Create or select a store before uploading media.',
        Icons.storefront_outlined,
      );
    }
    if (_assets.isEmpty) {
      return _buildMessage(
        colors,
        'Upload your first storefront media asset.',
        Icons.perm_media_outlined,
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 640 ? 3 : 2;
        return GridView.builder(
          padding: const EdgeInsets.only(bottom: 96),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columns,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 0.72,
          ),
          itemCount: _assets.length,
          itemBuilder: (context, index) {
            return _buildAssetCard(_assets[index], colors);
          },
        );
      },
    );
  }

  Widget _buildAssetCard(MediaAssetContract asset, AppThemeColors colors) {
    return Container(
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.cardBorder),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(child: _buildPreview(asset, colors)),
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 10, 10, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  asset.displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${_sentenceCase(asset.mediaType)} • ${_formatBytes(asset.sizeBytes)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
                if (asset.altText != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    asset.altText!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: colors.textTertiary, fontSize: 11),
                  ),
                ],
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        asset.folder,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: colors.textTertiary,
                          fontSize: 11,
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Edit media',
                      icon: Icon(
                        Icons.edit_rounded,
                        color: colors.textSecondary,
                      ),
                      onPressed: _isBusy ? null : () => _editMetadata(asset),
                    ),
                    IconButton(
                      tooltip: 'Delete media',
                      icon: Icon(
                        Icons.delete_outline_rounded,
                        color: colors.error,
                      ),
                      onPressed: _isBusy ? null : () => _deleteAsset(asset),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPreview(MediaAssetContract asset, AppThemeColors colors) {
    if (asset.isImage) {
      return CachedMerchantImage(
        imageUrl: asset.thumbnailUrl ?? asset.url,
        fit: BoxFit.cover,
        errorBuilder: (_) => _previewIcon(asset, colors),
      );
    }
    if (asset.isVideo) {
      return GestureDetector(
        onTap: () => _showVideoPreview(asset),
        child: _VideoAssetPreview(asset: asset, colors: colors),
      );
    }
    if (asset.isThreeDModel) {
      return _ModelAssetPreview(asset: asset, colors: colors);
    }
    return _previewIcon(asset, colors);
  }

  Future<void> _showVideoPreview(MediaAssetContract asset) {
    final colors = AppThemeColors.of(context);
    return showDialog<void>(
      context: context,
      builder: (dialogContext) => Dialog(
        backgroundColor: colors.card,
        insetPadding: const EdgeInsets.all(20),
        child: _VideoPreviewDialog(asset: asset, colors: colors),
      ),
    );
  }

  Widget _previewIcon(MediaAssetContract asset, AppThemeColors colors) {
    final icon = switch (asset.mediaType) {
      'video' => Icons.play_circle_outline_rounded,
      'document' => Icons.description_outlined,
      'audio' => Icons.graphic_eq_rounded,
      _ => Icons.insert_drive_file_outlined,
    };
    return Container(
      color: colors.surfaceVariant,
      child: Center(child: Icon(icon, color: colors.textTertiary, size: 40)),
    );
  }

  Widget _buildMessage(AppThemeColors colors, String text, IconData icon) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: colors.textTertiary, size: 40),
          const SizedBox(height: 12),
          Text(
            text,
            textAlign: TextAlign.center,
            style: TextStyle(color: colors.textSecondary),
          ),
        ],
      ),
    );
  }

  void _showMessage(
    String message, {
    bool isError = false,
    bool isSuccess = false,
  }) {
    final colors = AppThemeColors.of(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError
            ? colors.error
            : isSuccess
            ? colors.success
            : colors.snackbarBackground,
      ),
    );
  }

  static String _baseName(String fileName) {
    final dot = fileName.lastIndexOf('.');
    return dot <= 0 ? fileName : fileName.substring(0, dot);
  }

  static String _formatBytes(int bytes) {
    if (bytes >= 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    if (bytes >= 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '$bytes B';
  }

  static String _sentenceCase(String value) {
    final normalized = value.replaceAll('-', ' ').replaceAll('_', ' ').trim();
    if (normalized.isEmpty) return value;
    return '${normalized[0].toUpperCase()}${normalized.substring(1)}';
  }
}

class _VideoAssetPreview extends StatefulWidget {
  final MediaAssetContract asset;
  final AppThemeColors colors;

  const _VideoAssetPreview({required this.asset, required this.colors});

  @override
  State<_VideoAssetPreview> createState() => _VideoAssetPreviewState();
}

class _VideoAssetPreviewState extends State<_VideoAssetPreview> {
  VideoPlayerController? _controller;
  bool _hasError = false;

  @override
  void initState() {
    super.initState();
    _loadVideo();
  }

  @override
  void didUpdateWidget(covariant _VideoAssetPreview oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.asset.url != widget.asset.url) {
      _controller?.dispose();
      _controller = null;
      _hasError = false;
      _loadVideo();
    }
  }

  Future<void> _loadVideo() async {
    try {
      final controller = VideoPlayerController.networkUrl(
        Uri.parse(widget.asset.url),
      );
      _controller = controller;
      await controller.initialize();
      await controller.setLooping(true);
      if (mounted) setState(() {});
    } catch (_) {
      if (mounted) setState(() => _hasError = true);
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    if (_hasError || controller == null || !controller.value.isInitialized) {
      return Container(
        color: widget.colors.surfaceVariant,
        child: Center(
          child: Icon(
            Icons.play_circle_outline_rounded,
            color: widget.colors.textTertiary,
            size: 44,
          ),
        ),
      );
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        FittedBox(
          fit: BoxFit.cover,
          child: SizedBox(
            width: controller.value.size.width,
            height: controller.value.size.height,
            child: VideoPlayer(controller),
          ),
        ),
        Container(color: Colors.black.withValues(alpha: 0.18)),
        Center(
          child: Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.54),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.play_arrow_rounded, color: Colors.white),
          ),
        ),
      ],
    );
  }
}

class _VideoPreviewDialog extends StatefulWidget {
  final MediaAssetContract asset;
  final AppThemeColors colors;

  const _VideoPreviewDialog({required this.asset, required this.colors});

  @override
  State<_VideoPreviewDialog> createState() => _VideoPreviewDialogState();
}

class _VideoPreviewDialogState extends State<_VideoPreviewDialog> {
  late final VideoPlayerController _controller;
  bool _isReady = false;
  bool _hasError = false;

  @override
  void initState() {
    super.initState();
    _controller = VideoPlayerController.networkUrl(Uri.parse(widget.asset.url));
    _initialize();
  }

  Future<void> _initialize() async {
    try {
      await _controller.initialize();
      await _controller.setLooping(true);
      await _controller.play();
      if (mounted) setState(() => _isReady = true);
    } catch (_) {
      if (mounted) setState(() => _hasError = true);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  widget.asset.displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: widget.colors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Close preview',
                onPressed: () => Navigator.pop(context),
                icon: Icon(
                  Icons.close_rounded,
                  color: widget.colors.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          AspectRatio(
            aspectRatio: _isReady ? _controller.value.aspectRatio : 16 / 9,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: ColoredBox(
                color: Colors.black,
                child: _hasError
                    ? const Center(
                        child: Icon(
                          Icons.play_circle_outline_rounded,
                          color: Colors.white54,
                          size: 48,
                        ),
                      )
                    : _isReady
                    ? VideoPlayer(_controller)
                    : const Center(
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ModelAssetPreview extends StatelessWidget {
  final MediaAssetContract asset;
  final AppThemeColors colors;

  const _ModelAssetPreview({required this.asset, required this.colors});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: colors.surfaceVariant,
      padding: const EdgeInsets.all(14),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.view_in_ar_rounded, color: colors.textTertiary, size: 40),
          const SizedBox(height: 8),
          Text(
            asset.filename.toLowerCase().endsWith('.usdz')
                ? 'USDZ model'
                : '3D model',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: colors.textSecondary,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
