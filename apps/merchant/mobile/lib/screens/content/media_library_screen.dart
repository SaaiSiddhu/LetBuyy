import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:video_player/video_player.dart';
import '../../app/store_context.dart';

import '../../models/store_model.dart';
import '../../services/media_service.dart';
import '../../services/native_media_selection.dart';
import '../../services/api_client.dart' show ApiException;
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../widgets/shared/cached_merchant_image.dart';
import '../../widgets/shared/image_source_sheet.dart';
import '../../widgets/shared/merchant_media_picker.dart';
import '../../widgets/shared/merchant_webm_video_controller.dart';

class MediaLibraryScreen extends StatefulWidget {
  const MediaLibraryScreen({
    super.key,
    this.pickMedia,
    this.videoControllerFactory,
    this.selectProductImage = false,
    this.initialImageSource,
  }) : assert(initialImageSource == null || selectProductImage);
  final Future<XFile?> Function(bool video, ImageSource source)? pickMedia;
  final VideoPlayerController Function(Uri)? videoControllerFactory;
  final bool selectProductImage;
  final ImageSource? initialImageSource;

  @override
  State<MediaLibraryScreen> createState() => _MediaLibraryScreenState();
}

class _MediaLibraryScreenState extends State<MediaLibraryScreen> {
  static const _typeFilters = ['all', 'image', 'video', 'document'];

  final _searchController = TextEditingController();
  final _picker = ImagePicker();

  StoreContext? _stores;
  MediaService? _media;
  Object? _scopeKey, _sdkContext;
  int _readVersion = 0;
  int _page = 1;
  bool _hasMore = false;
  String _appliedSearch = '';
  StoreModel? _store;
  List<MediaAssetContract> _assets = const [];
  String _type = 'all';
  bool _isLoading = true;
  bool _isBusy = false;
  String? _error;
  bool _initialImageAttempted = false;

  @override
  void initState() {
    super.initState();
    if (widget.selectProductImage) _type = 'image';
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadMedia());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final stores = context.watch<StoreContext>(),
        media = context.watch<MediaService>();
    final replaced =
        _stores != null &&
        (!identical(stores, _stores) || !identical(media, _media));
    if (!identical(stores, _stores)) {
      _stores?.removeListener(_onContextChange);
      _stores = stores;
      stores.addListener(_onContextChange);
    }
    _media = media;
    if (replaced) _retire();
  }

  void _retire() {
    ++_readVersion;
    _store = null;
    _assets = const [];
    _scopeKey = null;
    _sdkContext = null;
    _isLoading = false;
    _isBusy = false;
    _hasMore = false;
    _error = 'Store access changed. Reload media.';
  }

  void _onContextChange() {
    if (!mounted ||
        _scopeKey == null ||
        (_scopeKey == _stores?.requestContextKey &&
            _sdkContext == _media?.captureRequestContext()))
      return;
    setState(_retire);
  }

  bool _current(int version) =>
      mounted &&
      version == _readVersion &&
      _scopeKey == _stores?.requestContextKey &&
      _sdkContext == _media?.captureRequestContext();

  @override
  void dispose() {
    ++_readVersion;
    _stores?.removeListener(_onContextChange);
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadMedia({int page = 1}) async {
    if (!mounted) return;
    final version = ++_readVersion,
        stores = _stores!,
        media = _media!,
        epoch = _stores!.requestContextVersion;
    final search = page == 1 ? _searchController.text.trim() : _appliedSearch;
    final initialStore = stores.selectedStoreId,
        initialKey = stores.requestContextKey;
    _scopeKey = null;
    _sdkContext = null;
    setState(() {
      _isLoading = true;
      _error = null;
      _store = null;
      _assets = const [];
    });
    try {
      final store = await stores.ensureSelectedStore();
      if (!mounted ||
          version != _readVersion ||
          !identical(stores, _stores) ||
          !identical(media, _media) ||
          epoch != stores.requestContextVersion ||
          (initialStore != null && initialKey != stores.requestContextKey))
        return;
      _scopeKey = stores.requestContextKey;
      _sdkContext = media.captureRequestContext();
      if (store == null) return;
      final assets = await media.fetchMedia(
        store.id,
        type: _type,
        search: search,
        page: page,
      );
      if (!_current(version)) return;
      setState(() {
        _store = store;
        _assets = widget.selectProductImage
            ? assets.where((asset) => asset.isImage).toList(growable: false)
            : assets;
        _page = page;
        _appliedSearch = search;
        _hasMore = media.hasMore;
      });
    } catch (_) {
      if (mounted &&
          version == _readVersion &&
          identical(stores, _stores) &&
          identical(media, _media) &&
          epoch == stores.requestContextVersion)
        setState(
          () => _error =
              'Media is unavailable. Retry to reload the current store.',
        );
    } finally {
      if (mounted && version == _readVersion)
        setState(() => _isLoading = false);
    }
    if (_current(version) &&
        _store != null &&
        !_initialImageAttempted &&
        widget.initialImageSource != null) {
      _initialImageAttempted = true;
      // A saved receipt takes priority over starting another upload.
      if (!media.hasPendingUpload && !media.hasPendingChange)
        await _pickAndUpload(video: false, source: widget.initialImageSource!);
    }
  }

  Future<void> _changeType(String type) async {
    if (_type == type || _isBusy) return;
    setState(() => _type = type);
    await _loadMedia();
  }

  Future<void> _openUploadSheet() async {
    final colors = AppThemeColors.of(context), version = _readVersion;
    if (!_current(version) ||
        !isLetbuyySurfaceCurrent(context) ||
        (_media?.hasPendingChange ?? false))
      return;
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: colors.card,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheetContext) => SafeArea(
        child: SingleChildScrollView(
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
                    if (!_current(version)) return;
                    Navigator.pop(sheetContext);
                    final source = await showImageSourceSheet(
                      context,
                      title: 'Image source',
                    );
                    if (source == null || !_current(version)) return;
                    _pickAndUpload(video: false, source: source);
                  },
                ),
                if (!widget.selectProductImage)
                  ListTile(
                    leading: const Icon(Icons.videocam_outlined),
                    title: const Text('Upload video'),
                    subtitle: const Text('Storefront video asset'),
                    onTap: () async {
                      if (!_current(version)) return;
                      Navigator.pop(sheetContext);
                      final source = await showMerchantMediaSourceSheet(
                        context,
                        title: 'Video source',
                        video: true,
                        allowFiles: true,
                      );
                      if (source == null || !_current(version)) return;
                      _pickAndUpload(
                        video: true,
                        fromFiles: source == MerchantMediaSource.files,
                        source: source == MerchantMediaSource.camera
                            ? ImageSource.camera
                            : ImageSource.gallery,
                      );
                    },
                  ),
                if (!widget.selectProductImage)
                  ListTile(
                    leading: const Icon(Icons.view_in_ar_outlined),
                    title: const Text('Upload 3D model'),
                    subtitle: const Text('GLB or GLTF, up to 50 MB'),
                    onTap: () {
                      if (!_current(version)) return;
                      Navigator.pop(sheetContext);
                      _pickAndUpload(video: false, model: true);
                    },
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _pickAndUpload({
    required bool video,
    bool model = false,
    bool fromFiles = false,
    ImageSource source = ImageSource.gallery,
  }) async {
    final store = _store, version = _readVersion, media = _media;
    if (store == null ||
        _isBusy ||
        !_current(version) ||
        media!.hasPendingChange)
      return;

    setState(() => _isBusy = true);
    String? nativeUploadKey;
    NativeMediaSelection? nativeSelection;
    try {
      final picked = await pickMerchantMedia(
        context,
        source: source,
        imagePickerSource: !model && !fromFiles,
        purpose: widget.selectProductImage
            ? 'product-image'
            : model
            ? 'public-media-model'
            : video
            ? 'public-media-video'
            : 'public-media-image',
        kind: model
            ? 'model'
            : video
            ? 'video'
            : 'image',
        maxBytes: model
            ? PublicMediaUpload.modelLimitBytes
            : video
            ? PublicMediaUpload.videoLimitBytes
            : PublicMediaUpload.imageLimitBytes,
        sourceLabel: model || fromFiles ? 'files' : null,
        pick: () => model || fromFiles
            ? _pickFile()
            : widget.pickMedia != null
            ? widget.pickMedia!(video, source)
            : video
            ? _picker.pickVideo(source: source)
            : _picker.pickImage(source: source),
      );
      if (!_current(version) ||
          !isLetbuyySurfaceCurrent(context) ||
          picked == null)
        return;
      if (model &&
          !(PublicMediaUpload.mimeForFilename(
                picked.name,
              )?.startsWith('model/') ??
              false)) {
        _showMessage('Choose a GLB or GLTF model file.', isError: true);
        return;
      }
      if (video &&
          fromFiles &&
          !(PublicMediaUpload.mimeForFilename(
                picked.name,
              )?.startsWith('video/') ??
              false)) {
        _showMessage('Choose an MP4, MOV, or WebM video file.', isError: true);
        return;
      }
      final file = File(picked.path);
      final selection = context.read<NativeMediaSelection>();
      nativeSelection = selection;
      final selectionKey = selection.claimUpload(picked);
      nativeUploadKey = selectionKey;
      await media!.uploadAndCreate(
        storeId: store.id,
        file: file,
        folder: 'media',
        altText: _baseName(picked.name),
        selectionKey: selectionKey,
      );
      await selection.completeKey(selectionKey);
      if (!_current(version)) return;
      _showMessage('Media uploaded', isSuccess: true);
      await _loadMedia();
    } catch (error) {
      if (_current(version) && isLetbuyySurfaceCurrent(context))
        _showMessage(
          error is ApiException && error.code == 'MEDIA_UPLOAD_INPUT_INVALID'
              ? error.message
              : media?.uploadRecoveryMessage ??
                    'The media change was not confirmed. Refresh media to review it.',
          isError: true,
        );
    } finally {
      nativeSelection?.releaseUpload(nativeUploadKey);
      if (mounted &&
          _scopeKey == _stores?.requestContextKey &&
          _sdkContext == _media?.captureRequestContext())
        setState(() => _isBusy = false);
    }
  }

  Future<XFile?> _pickFile() async {
    // The locked native plugin drops unregistered GLTF UTIs from custom iOS
    // filters. Use Files, then enforce the canonical extensions before effects.
    final result = await FilePicker.platform.pickFiles(
      type: FileType.any,
      allowMultiple: false,
      withData: false,
    );
    return result?.files.single.xFile;
  }

  Future<void> _resumeUpload() async {
    final store = _store, version = _readVersion, media = _media;
    if (store == null || _isBusy || !_current(version)) return;
    setState(() => _isBusy = true);
    try {
      final selectionKey = media!.pendingUploadKey;
      await media!.resumeUpload(store.id);
      if (mounted)
        await context.read<NativeMediaSelection?>()?.completeOperation(
          selectionKey,
          'media-upload',
        );
      if (!_current(version) || !isLetbuyySurfaceCurrent(context)) return;
      _showMessage('Library entry confirmed', isSuccess: true);
      await _loadMedia();
    } catch (_) {
      if (_current(version) && isLetbuyySurfaceCurrent(context))
        _showMessage(
          'The library entry is still unconfirmed. Your saved request is retained.',
          isError: true,
        );
    } finally {
      if (mounted &&
          _scopeKey == _stores?.requestContextKey &&
          _sdkContext == _media?.captureRequestContext())
        setState(() => _isBusy = false);
    }
  }

  Future<void> _reselectOriginalUpload() async {
    final store = _store, version = _readVersion, media = _media;
    if (store == null || _isBusy || !_current(version)) return;
    setState(() => _isBusy = true);
    NativeMediaSelection? nativeSelection;
    String? nativeUploadKey;
    try {
      final videoSource = media!.pendingUploadIsVideo
          ? await showMerchantMediaSourceSheet(
              context,
              title: 'Original video source',
              video: true,
              allowFiles: true,
              allowCamera: false,
            )
          : null;
      if (!_current(version) ||
          !isLetbuyySurfaceCurrent(context) ||
          (media.pendingUploadIsVideo && videoSource == null))
        return;
      final fromFiles =
          media.pendingUploadIsModel ||
          videoSource == MerchantMediaSource.files;
      final picked = await pickMerchantMedia(
        context,
        source: ImageSource.gallery,
        purpose: 'original-media-upload',
        imagePickerSource: !fromFiles,
        draft: {
          'operation': 'media-upload',
          'operation_key': media.pendingUploadKey,
        },
        kind: media.pendingUploadIsModel
            ? 'model'
            : media.pendingUploadIsVideo
            ? 'video'
            : 'image',
        maxBytes: media.pendingUploadIsModel
            ? PublicMediaUpload.modelLimitBytes
            : media.pendingUploadIsVideo
            ? PublicMediaUpload.videoLimitBytes
            : PublicMediaUpload.imageLimitBytes,
        sourceLabel: fromFiles ? 'files' : null,
        pick: () => fromFiles
            ? _pickFile()
            : widget.pickMedia != null
            ? widget.pickMedia!(
                media!.pendingUploadIsVideo,
                ImageSource.gallery,
              )
            : media!.pendingUploadIsVideo
            ? _picker.pickVideo(source: ImageSource.gallery)
            : _picker.pickImage(source: ImageSource.gallery),
      );
      if (!_current(version) ||
          !isLetbuyySurfaceCurrent(context) ||
          picked == null)
        return;
      nativeSelection = context.read<NativeMediaSelection>();
      nativeUploadKey = nativeSelection.claimUpload(picked);
      await media!.retryUploadWithOriginal(store.id, File(picked.path));
      if (mounted) {
        final selection = context.read<NativeMediaSelection>();
        await selection.completeKey(selection.keyForFile(picked));
      }
      if (!_current(version) || !isLetbuyySurfaceCurrent(context)) return;
      _showMessage('Library entry confirmed', isSuccess: true);
      await _loadMedia();
    } on ApiException catch (error) {
      if (_current(version) && isLetbuyySurfaceCurrent(context))
        _showMessage(
          error.code == 'MEDIA_UPLOAD_INPUT_CHANGED'
              ? error.message
              : 'This upload is still unconfirmed. Your original request is retained.',
          isError: true,
        );
    } catch (_) {
      if (_current(version) && isLetbuyySurfaceCurrent(context))
        _showMessage(
          'This upload is still unconfirmed. Your original request is retained.',
          isError: true,
        );
    } finally {
      nativeSelection?.releaseUpload(nativeUploadKey);
      if (mounted &&
          _scopeKey == _stores?.requestContextKey &&
          _sdkContext == _media?.captureRequestContext())
        setState(() => _isBusy = false);
    }
  }

  Widget _buildUploadRecovery() => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Upload recovery', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        Text(_media!.uploadRecoveryMessage!),
        if (_media!.canReselectOriginal)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: _isBusy ? null : _reselectOriginalUpload,
              child: const Text('Choose original file'),
            ),
          ),
        if (_media!.canResumeUpload)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: _isBusy ? null : _resumeUpload,
              child: Text(
                _isBusy
                    ? 'Checking'
                    : _media!.isUploadStored
                    ? 'Confirm library entry'
                    : 'Check saved upload',
              ),
            ),
          ),
      ],
    ),
  );

  Future<void> _resumeChange() async {
    final store = _store, version = _readVersion, media = _media;
    if (store == null ||
        _isBusy ||
        !_current(version) ||
        !isLetbuyySurfaceCurrent(context))
      return;
    setState(() => _isBusy = true);
    try {
      await media!.resumeChange(store.id);
      if (!_current(version)) return;
      _showMessage('Original media change confirmed', isSuccess: true);
      await _loadMedia();
    } catch (_) {
      if (_current(version) && isLetbuyySurfaceCurrent(context)) {
        _showMessage(
          'The original media change could not be confirmed. Its request is retained.',
          isError: true,
        );
      }
    } finally {
      if (mounted &&
          _scopeKey == _stores?.requestContextKey &&
          _sdkContext == _media?.captureRequestContext())
        setState(() => _isBusy = false);
    }
  }

  Widget _buildChangeRecovery() => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LetbuyyInlineFeedback(
          title: 'Media change recovery',
          message: _media!.changeRecoveryMessage!,
        ),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton(
            onPressed: _isBusy ? null : _resumeChange,
            child: Text(_isBusy ? 'Confirming' : 'Confirm media change'),
          ),
        ),
      ],
    ),
  );

  Future<void> _editMetadata(MediaAssetContract asset) async {
    final version = _readVersion, media = _media;
    if (!_current(version) ||
        !isLetbuyySurfaceCurrent(context) ||
        media!.hasPendingChange)
      return;
    final result = await _showMetadataEditor(asset);
    if (result == null || _isBusy || !_current(version)) return;

    setState(() => _isBusy = true);
    try {
      await media!.updateMedia(asset.id, result);
      if (!_current(version)) return;
      _showMessage('Media updated', isSuccess: true);
      await _loadMedia();
    } catch (error) {
      if (_current(version) && isLetbuyySurfaceCurrent(context))
        _showMessage(
          media!.hasPendingChange
              ? 'The original media change is retained. Use Confirm media change to recover it.'
              : 'The media change was not confirmed. Refresh before trying again.',
          isError: true,
        );
    } finally {
      if (mounted &&
          _scopeKey == _stores?.requestContextKey &&
          _sdkContext == _media?.captureRequestContext())
        setState(() => _isBusy = false);
    }
  }

  Future<MediaUpdateInput?> _showMetadataEditor(MediaAssetContract asset) {
    final version = _readVersion;
    final scopeKey = _scopeKey, sdkContext = _sdkContext;
    final ownerStores = _stores, ownerMedia = _media;
    return showDialog<MediaUpdateInput>(
      context: context,
      builder: (_) => _MediaMetadataEditor(
        asset: asset,
        isCurrent: () => _current(version),
        isOwnerCurrent: () =>
            mounted &&
            scopeKey != null &&
            scopeKey == _scopeKey &&
            scopeKey == _stores?.requestContextKey &&
            sdkContext == _sdkContext &&
            sdkContext == _media?.captureRequestContext() &&
            identical(ownerStores, _stores) &&
            identical(ownerMedia, _media) &&
            _store?.id == asset.storeId &&
            _error == null,
        ownerStores: ownerStores,
        ownerMedia: ownerMedia,
      ),
    );
  }

  Future<void> _deleteAsset(MediaAssetContract asset) async {
    final version = _readVersion, media = _media;
    if (!_current(version) ||
        !isLetbuyySurfaceCurrent(context) ||
        media!.hasPendingChange)
      return;
    final confirmed = await _confirmDelete(asset);
    if (confirmed != true || _isBusy || !_current(version)) return;

    setState(() => _isBusy = true);
    try {
      await media!.deleteMedia(
        asset,
        // The canonical library endpoint removes the record. Object cleanup
        // belongs to the server; existing storefront references may still use it.
        deleteObject: false,
      );
      if (!_current(version)) return;
      _showMessage('Media deleted', isSuccess: true);
      await _loadMedia();
    } catch (error) {
      if (_current(version) && isLetbuyySurfaceCurrent(context))
        _showMessage(
          media!.hasPendingChange
              ? 'The original media change is retained. Use Confirm media change to recover it.'
              : 'The media change was not confirmed. Refresh before trying again.',
          isError: true,
        );
    } finally {
      if (mounted &&
          _scopeKey == _stores?.requestContextKey &&
          _sdkContext == _media?.captureRequestContext())
        setState(() => _isBusy = false);
    }
  }

  Future<bool?> _confirmDelete(MediaAssetContract asset) {
    final colors = AppThemeColors.of(context), version = _readVersion;
    final ownerStores = _stores, ownerMedia = _media;
    return showDialog<bool>(
      context: context,
      builder: (dialogContext) => Consumer2<StoreContext, MediaService>(
        builder: (surfaceContext, stores, media, _) {
          if (!_current(version) ||
              !identical(stores, ownerStores) ||
              !identical(media, ownerMedia)) {
            return AlertDialog(
              title: const Text('Store access changed'),
              content: const Text(
                'Close and reload media for the current store.',
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  child: const Text('Close'),
                ),
              ],
            );
          }
          return AlertDialog(
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
                onPressed: () {
                  if (_current(version) &&
                      isLetbuyySurfaceCurrent(surfaceContext))
                    Navigator.pop(dialogContext, true);
                },
                child: const Text('Delete'),
              ),
            ],
          );
        },
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
              onPressed:
                  _isBusy ||
                      (_media?.hasPendingUpload ?? false) ||
                      (_media?.hasPendingChange ?? false)
                  ? null
                  : _openUploadSheet,
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
            child: _buildBody(colors),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(AppThemeColors colors) {
    return Row(
      children: [
        if (widget.selectProductImage || Navigator.canPop(context))
          const BackButton(),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.selectProductImage
                    ? 'Choose product image'
                    : 'Media library',
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
          for (final type
              in widget.selectProductImage ? ['image'] : _typeFilters) ...[
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
    return LayoutBuilder(
      builder: (context, constraints) {
        final textScale = MediaQuery.textScalerOf(context).scale(14) / 14;
        final columns = ((constraints.maxWidth + 12) / (144 * textScale + 12))
            .floor()
            .clamp(1, 3);
        return CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildHeader(colors),
                  const SizedBox(height: 14),
                  _buildSearch(colors),
                  const SizedBox(height: 12),
                  _buildFilters(colors),
                  const SizedBox(height: 14),
                  if (!_isLoading &&
                      _error == null &&
                      _store != null &&
                      (_page > 1 || _hasMore))
                    Wrap(
                      spacing: 12,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text('Page $_page'),
                        if (_page > 1)
                          TextButton(
                            onPressed: _isBusy
                                ? null
                                : () => _loadMedia(page: _page - 1),
                            child: const Text('Previous'),
                          ),
                        if (_hasMore)
                          TextButton(
                            onPressed: _isBusy
                                ? null
                                : () => _loadMedia(page: _page + 1),
                            child: const Text('Next'),
                          ),
                      ],
                    ),
                ],
              ),
            ),
            if (_media?.uploadRecoveryMessage != null)
              SliverToBoxAdapter(child: _buildUploadRecovery()),
            if (_media?.changeRecoveryMessage != null)
              SliverToBoxAdapter(child: _buildChangeRecovery()),
            if (_isLoading)
              SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: CircularProgressIndicator(
                    color: LetbuyyColorTokens.brandPrimary,
                  ),
                ),
              )
            else if (_error != null)
              SliverFillRemaining(
                hasScrollBody: false,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _buildMessage(colors, _error!, Icons.error),
                    OutlinedButton(
                      onPressed: _loadMedia,
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              )
            else if (_store == null)
              SliverFillRemaining(
                hasScrollBody: false,
                child: _buildMessage(
                  colors,
                  'Create or select a store before uploading media.',
                  Icons.storefront_outlined,
                ),
              )
            else if (_assets.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: _buildMessage(
                  colors,
                  'Upload your first storefront media asset.',
                  Icons.perm_media_outlined,
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.only(bottom: 96),
                sliver: SliverGrid(
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: columns,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: 0.72,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => _buildAssetCard(_assets[index], colors),
                    childCount: _assets.length,
                  ),
                ),
              ),
          ],
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
                if (widget.selectProductImage)
                  TextButton.icon(
                    onPressed: _isBusy || (_media?.hasPendingChange ?? false)
                        ? null
                        : () => _selectProductImage(asset),
                    icon: const Icon(Icons.add_photo_alternate_outlined),
                    label: const Text('Use image'),
                  )
                else
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
                        onPressed:
                            _isBusy || (_media?.hasPendingChange ?? false)
                            ? null
                            : () => _editMetadata(asset),
                      ),
                      IconButton(
                        tooltip: 'Delete media',
                        icon: Icon(
                          Icons.delete_outline_rounded,
                          color: colors.error,
                        ),
                        onPressed:
                            _isBusy || (_media?.hasPendingChange ?? false)
                            ? null
                            : () => _deleteAsset(asset),
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

  void _selectProductImage(MediaAssetContract asset) {
    if (!_current(_readVersion) ||
        !isLetbuyySurfaceCurrent(context) ||
        _isLoading ||
        _isBusy ||
        (_media?.hasPendingChange ?? false) ||
        !asset.isImage ||
        asset.storeId != _store?.id ||
        !_assets.any((value) => identical(value, asset)))
      return;
    Navigator.pop(context, asset);
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
      return Semantics(
        button: true,
        label: 'Play video ${asset.displayName}',
        child: InkWell(
          onTap: () => _showVideoPreview(asset),
          child: _VideoAssetPreview(asset: asset, colors: colors),
        ),
      );
    }
    if (asset.isThreeDModel) {
      return _ModelAssetPreview(asset: asset, colors: colors);
    }
    return _previewIcon(asset, colors);
  }

  Future<void> _showVideoPreview(MediaAssetContract asset) {
    final version = _readVersion, ownerStores = _stores, ownerMedia = _media;
    if (!_current(version) || !isLetbuyySurfaceCurrent(context))
      return Future<void>.value();
    final colors = AppThemeColors.of(context);
    return showDialog<void>(
      context: context,
      builder: (dialogContext) => Consumer2<StoreContext, MediaService>(
        builder: (surfaceContext, stores, media, _) {
          if (!_current(version) ||
              !identical(stores, ownerStores) ||
              !identical(media, ownerMedia)) {
            return AlertDialog(
              title: const Text('Store access changed'),
              content: const Text(
                'Close and reload media for the current store.',
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  child: const Text('Close'),
                ),
              ],
            );
          }
          return Dialog(
            backgroundColor: colors.card,
            insetPadding: const EdgeInsets.all(20),
            child: _VideoPreviewDialog(
              asset: asset,
              colors: colors,
              createController: widget.videoControllerFactory,
            ),
          );
        },
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
    showLetbuyyOperationFeedback(
      context,
      message: message,
      kind: isError
          ? LetbuyyFeedbackKind.error
          : isSuccess
          ? LetbuyyFeedbackKind.success
          : LetbuyyFeedbackKind.information,
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

/// Controllers live with the actual dialog widget, including its reverse
/// transition. The pop-result future finishes before that transition does.
class _MediaMetadataEditor extends StatefulWidget {
  const _MediaMetadataEditor({
    required this.asset,
    required this.isCurrent,
    required this.isOwnerCurrent,
    required this.ownerStores,
    required this.ownerMedia,
  });
  final MediaAssetContract asset;
  final bool Function() isCurrent;
  final bool Function() isOwnerCurrent;
  final StoreContext? ownerStores;
  final MediaService? ownerMedia;
  @override
  State<_MediaMetadataEditor> createState() => _MediaMetadataEditorState();
}

class _MediaMetadataEditorState extends State<_MediaMetadataEditor> {
  late final TextEditingController filenameController;
  late final TextEditingController altController;
  late final TextEditingController captionController;
  late final TextEditingController folderController;
  late final TextEditingController tagsController;
  String? validationError;
  bool closing = false;
  @override
  void initState() {
    super.initState();
    filenameController = TextEditingController(text: widget.asset.filename);
    altController = TextEditingController(text: widget.asset.altText ?? '');
    captionController = TextEditingController(text: widget.asset.caption ?? '');
    folderController = TextEditingController(text: widget.asset.folder);
    tagsController = TextEditingController(text: widget.asset.tags.join(', '));
  }

  @override
  void dispose() {
    filenameController.dispose();
    altController.dispose();
    captionController.dispose();
    folderController.dispose();
    tagsController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Consumer2<StoreContext, MediaService>(
      builder: (surfaceContext, stores, media, _) {
        // A successful save reloads the list before this route's reverse
        // transition ends. Keep its fields during that transition, but still
        // retire immediately if the actor, store, or provider changes.
        if (!(closing ? widget.isOwnerCurrent() : widget.isCurrent()) ||
            !identical(stores, widget.ownerStores) ||
            !identical(media, widget.ownerMedia)) {
          return AlertDialog(
            scrollable: true,
            title: const Text('Store access changed'),
            content: const Text(
              'Close and reload media for the current store.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Close'),
              ),
            ],
          );
        }
        return AlertDialog(
          scrollable: true,
          backgroundColor: colors.card,
          title: Text(
            'Edit media',
            style: TextStyle(color: colors.textPrimary),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (validationError != null)
                LetbuyyInlineFeedback(
                  title: 'Review media details',
                  message: validationError!,
                ),
              TextField(
                controller: filenameController,
                decoration: const InputDecoration(labelText: 'Filename'),
                maxLength: 500,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: altController,
                decoration: const InputDecoration(labelText: 'Alt text'),
                maxLength: 500,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: captionController,
                decoration: const InputDecoration(labelText: 'Caption'),
                maxLength: 1000,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: folderController,
                decoration: const InputDecoration(labelText: 'Folder'),
                maxLength: 200,
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
          actions: [
            TextButton(
              onPressed: () {
                closing = true;
                Navigator.pop(context);
              },
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () {
                if (!widget.isCurrent() ||
                    !isLetbuyySurfaceCurrent(surfaceContext))
                  return;
                final input = MediaUpdateInput(
                  filename: filenameController.text,
                  altText: altController.text,
                  caption: captionController.text,
                  folder: folderController.text,
                  tags: tagsController.text
                      .split(',')
                      .map((tag) => tag.trim())
                      .where((tag) => tag.isNotEmpty)
                      .toList(growable: false),
                );
                try {
                  MediaUpdateInput.validateJson(input.toJson());
                } on FormatException {
                  setState(
                    () => validationError =
                        'Check the filename and field lengths. Use at most 20 tags with 50 characters each.',
                  );
                  return;
                }
                closing = true;
                Navigator.pop(context, input);
              },
              child: const Text('Save'),
            ),
          ],
        );
      },
    );
  }
}

// Listing video metadata must not instantiate a decoder or download video bytes.
// An optional poster is an image; the player belongs to explicit preview only.
class _VideoAssetPreview extends StatelessWidget {
  const _VideoAssetPreview({required this.asset, required this.colors});
  final MediaAssetContract asset;
  final AppThemeColors colors;

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: colors.surfaceVariant,
    child: Stack(
      fit: StackFit.expand,
      children: [
        if (asset.thumbnailUrl != null)
          CachedMerchantImage(
            imageUrl: asset.thumbnailUrl!,
            fit: BoxFit.cover,
            errorBuilder: (_) => const SizedBox.shrink(),
          ),
        Center(
          child: Icon(
            Icons.play_circle_outline_rounded,
            color: colors.textTertiary,
            size: 44,
          ),
        ),
      ],
    ),
  );
}

class _VideoPreviewDialog extends StatefulWidget {
  final MediaAssetContract asset;
  final AppThemeColors colors;

  const _VideoPreviewDialog({
    required this.asset,
    required this.colors,
    this.createController,
  });
  final VideoPlayerController Function(Uri)? createController;

  @override
  State<_VideoPreviewDialog> createState() => _VideoPreviewDialogState();
}

class _VideoPreviewDialogState extends State<_VideoPreviewDialog>
    with WidgetsBindingObserver {
  VideoPlayerController? _controller;
  bool _isReady = false, _hasError = false;
  bool _foreground = true;
  int _attempt = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _foreground =
        WidgetsBinding.instance.lifecycleState == null ||
        WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed;
    _initialize();
  }

  bool _owns(VideoPlayerController controller, int attempt) =>
      mounted && attempt == _attempt && identical(controller, _controller);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!isLetbuyySurfaceCurrent(context)) _pause();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    if (!_foreground) _pause();
  }

  Future<void> _pause() async {
    final controller = _controller;
    if (controller == null) return;
    try {
      await controller.pause();
    } catch (_) {
      /* A retired player is disposed. */
    }
  }

  Future<void> _initialize() async {
    final attempt = ++_attempt, old = _controller;
    _controller = null;
    _isReady = false;
    _hasError = false;
    if (old != null) await old.dispose();
    if (!mounted || attempt != _attempt) return;
    if (old != null) setState(() {});
    try {
      final uri = Uri.parse(widget.asset.url);
      final controller =
          widget.createController?.call(uri) ??
          (usesMerchantWebMPreview(widget.asset.mimeType, defaultTargetPlatform)
              ? MerchantWebMVideoController(uri)
              : VideoPlayerController.networkUrl(uri));
      _controller = controller;
      await controller.initialize();
      if (!_owns(controller, attempt)) return;
      await controller.setLooping(true);
      if (!_owns(controller, attempt)) return;
      await controller.setVolume(0);
      if (!_owns(controller, attempt)) return;
      if (_foreground && isLetbuyySurfaceCurrent(context)) {
        await controller.play();
        if (!_owns(controller, attempt)) return;
        if (!_foreground || !isLetbuyySurfaceCurrent(context))
          await controller.pause();
      }
      if (_owns(controller, attempt)) setState(() => _isReady = true);
    } catch (_) {
      if (mounted && attempt == _attempt) setState(() => _hasError = true);
    }
  }

  Future<void> _control(
    Future<void> Function(VideoPlayerController) action,
  ) async {
    final controller = _controller, attempt = _attempt;
    if (controller == null ||
        !_foreground ||
        !_owns(controller, attempt) ||
        !isLetbuyySurfaceCurrent(context))
      return;
    try {
      await action(controller);
      if (_owns(controller, attempt) &&
          (!_foreground || !isLetbuyySurfaceCurrent(context)))
        await controller.pause();
    } catch (_) {
      if (_owns(controller, attempt)) setState(() => _hasError = true);
    }
  }

  @override
  void dispose() {
    ++_attempt;
    WidgetsBinding.instance.removeObserver(this);
    _controller?.dispose();
    super.dispose();
  }

  static String _videoTime(Duration value) {
    final seconds = value.inSeconds;
    return '${(seconds ~/ 60).toString().padLeft(2, '0')}:${(seconds % 60).toString().padLeft(2, '0')}';
  }

  Widget _failure() => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      const Text('Video could not load'),
      const SizedBox(height: 8),
      const Text(
        'Check your connection or try an MP4 (H.264) copy if this device does not support the format. Your file is unchanged.',
      ),
      const SizedBox(height: 12),
      FilledButton.icon(
        onPressed: _initialize,
        icon: const Icon(Icons.refresh),
        label: const Text('Retry video'),
      ),
    ],
  );

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    return SingleChildScrollView(
      child: Padding(
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
                    maxLines: 2,
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
            if (_hasError)
              _failure()
            else if (controller == null)
              const AspectRatio(
                aspectRatio: 16 / 9,
                child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
              )
            else
              ValueListenableBuilder<VideoPlayerValue>(
                valueListenable: controller,
                builder: (context, value, _) {
                  if (value.hasError) return _failure();
                  final ready = _isReady && value.isInitialized;
                  final duration = value.duration.inMilliseconds;
                  return Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      AspectRatio(
                        aspectRatio: ready ? value.aspectRatio : 16 / 9,
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: ColoredBox(
                            color: Colors.black,
                            // Keep the platform view mounted while metadata
                            // arrives; rebuilding it must not restart playback.
                            child: Stack(
                              fit: StackFit.expand,
                              children: [
                                if (controller is MerchantWebMVideoController)
                                  controller.view
                                else if (ready)
                                  VideoPlayer(controller),
                                if (!ready)
                                  const Center(
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      if (ready)
                        Wrap(
                          alignment: WrapAlignment.center,
                          spacing: 8,
                          children: [
                            IconButton(
                              tooltip: value.isPlaying
                                  ? 'Pause video'
                                  : 'Play video',
                              onPressed: () => _control(
                                (player) => value.isPlaying
                                    ? player.pause()
                                    : player.play(),
                              ),
                              icon: Icon(
                                value.isPlaying
                                    ? Icons.pause_rounded
                                    : Icons.play_arrow_rounded,
                              ),
                            ),
                            IconButton(
                              tooltip: value.volume == 0
                                  ? 'Unmute video'
                                  : 'Mute video',
                              onPressed: () => _control(
                                (player) =>
                                    player.setVolume(value.volume == 0 ? 1 : 0),
                              ),
                              icon: Icon(
                                value.volume == 0
                                    ? Icons.volume_off_outlined
                                    : Icons.volume_up_outlined,
                              ),
                            ),
                          ],
                        ),
                      if (ready && duration > 0)
                        Text(
                          '${_videoTime(value.position)} / ${_videoTime(value.duration)}',
                        ),
                      if (ready && duration > 0)
                        Semantics(
                          label: 'Video position',
                          child: Slider(
                            value: value.position.inMilliseconds
                                .clamp(0, duration)
                                .toDouble(),
                            max: duration.toDouble(),
                            label: '${value.position.inSeconds} seconds',
                            onChanged: (position) => _control(
                              (player) => player.seekTo(
                                Duration(milliseconds: position.round()),
                              ),
                            ),
                          ),
                        ),
                    ],
                  );
                },
              ),
          ],
        ),
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
