  Future<MediaUpdateInput?> _showMetadataEditor(
    MediaAssetContract asset,
  ) async {
    final colors = AppThemeColors.of(context), version = _readVersion;
    final ownerStores = _stores, ownerMedia = _media;
    final altController = TextEditingController(text: asset.altText ?? '');
    final captionController = TextEditingController(text: asset.caption ?? '');
    final folderController = TextEditingController(text: asset.folder);
    final tagsController = TextEditingController(text: asset.tags.join(', '));

    final result = await showDialog<MediaUpdateInput>(
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
              'Edit media',
              style: TextStyle(color: colors.textPrimary),
            ),
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
                  if (!_current(version) ||
                      !isLetbuyySurfaceCurrent(surfaceContext))
                    return;
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
          );
        },
      ),
    );

    altController.dispose();
    captionController.dispose();
    folderController.dispose();
    tagsController.dispose();
    return result;
  }

