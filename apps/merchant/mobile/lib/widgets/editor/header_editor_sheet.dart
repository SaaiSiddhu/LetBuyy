import 'dart:io';
import 'dart:convert';
import 'package:crypto/crypto.dart';
import '../../theme/app_theme_colors.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../models/store_model.dart';
import '../../services/store_service.dart';
import '../../services/native_media_selection.dart';
import '../../services/security_command_store.dart';
import '../shared/cached_merchant_image.dart';
import '../shared/image_source_sheet.dart';
import '../shared/merchant_media_picker.dart';

/// Header Editor Bottom Sheet - Full Featured
class HeaderEditorSheet extends StatefulWidget {
  final StoreModel store;
  final Map<String, dynamic> settings;
  final Function(Map<String, dynamic>) onSave;

  const HeaderEditorSheet({
    super.key,
    required this.store,
    required this.settings,
    required this.onSave,
  });

  static Future<void> show(
    BuildContext context, {
    required StoreModel store,
    required Map<String, dynamic> settings,
    required Function(Map<String, dynamic>) onSave,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) =>
          HeaderEditorSheet(store: store, settings: settings, onSave: onSave),
    );
  }

  @override
  State<HeaderEditorSheet> createState() => _HeaderEditorSheetState();
}

class _HeaderEditorSheetState extends State<HeaderEditorSheet> {
  late Map<String, dynamic> _settings;
  late AppThemeColors colors;
  bool _isSaving = false;
  bool _isUploadingLogo = false;
  String? _logoUrl;
  MerchantSecurityContext? _selectionContext;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _selectionContext ??= context
        .read<NativeMediaSelection?>()
        ?.captureContext();
  }

  // Default nav pages
  final List<Map<String, dynamic>> _defaultNavPages = [
    {
      'id': 'home',
      'label': 'Home',
      'href': '/',
      'isDefault': true,
      'isVisible': true,
    },
    {
      'id': 'shop',
      'label': 'Shop',
      'href': '/shop',
      'isDefault': true,
      'isVisible': true,
    },
    {
      'id': 'privacy',
      'label': 'Privacy',
      'href': '/privacy',
      'isDefault': true,
      'isVisible': true,
    },
    {
      'id': 'terms',
      'label': 'Terms',
      'href': '/terms',
      'isDefault': true,
      'isVisible': true,
    },
    {
      'id': 'shipping',
      'label': 'Shipping Policy',
      'href': '/shipping',
      'isDefault': true,
      'isVisible': true,
    },
  ];

  @override
  void initState() {
    super.initState();
    _initSettings();
  }

  void _initSettings() {
    _settings = Map<String, dynamic>.from(widget.settings);

    // Set defaults if not present
    _settings['behavior'] ??= 'sticky';
    _settings['logoPlacement'] ??= 'left';
    _settings['displayMode'] ??= 'both';
    _settings['navPlacement'] ??= 'right';
    _settings['showSearch'] ??= true;
    _settings['showCart'] ??= true;
    _settings['showAccount'] ??= false;

    // Logo URL from store or settings
    _logoUrl = _settings['logoUrl'] ?? widget.store.logoUrl;

    // Initialize nav pages
    if (_settings['navPages'] == null) {
      _settings['navPages'] = List<Map<String, dynamic>>.from(_defaultNavPages);
    }
  }

  Future<void> _pickAndUploadLogo() async {
    final picker = ImagePicker();
    final source = await showImageSourceSheet(context, title: 'Logo source');
    if (source == null) return;

    if (!mounted || _isUploadingLogo) return;
    setState(() => _isUploadingLogo = true);
    NativeMediaSelection? nativeSelection;
    String? nativeUploadKey;
    try {
      if (_selectionContext?.storeId != widget.store.id) return;
      final pickedFile = await pickMerchantMedia(
        context,
        source: source,
        purpose:
            'theme-header:${widget.store.id}:${sha256.convert(utf8.encode(jsonEncode(widget.settings))).toString().substring(0, 24)}',
        expectedContext: _selectionContext,
        pick: () => picker.pickImage(source: source, maxWidth: 512),
      );
      if (!mounted || pickedFile == null) return;
      final file = File(pickedFile.path);
      final storeService = context.read<StoreService>();
      final selection = context.read<NativeMediaSelection>();
      nativeSelection = selection;
      final selectionKey = selection.claimUpload(pickedFile);
      nativeUploadKey = selectionKey;
      final downloadUrl = await storeService.uploadImage(
        file,
        folder: 'stores/${widget.store.id}',
        options: selection.optionsForFile(pickedFile),
      );

      if (!mounted) return;
      selection.keyForFile(pickedFile);
      setState(() {
        _logoUrl = downloadUrl;
        _settings['logoUrl'] = downloadUrl;
      });

      HapticFeedback.mediumImpact();
      await selection.completeKey(selectionKey);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Logo upload was not confirmed. Review the saved selection before trying again.',
            ),
          ),
        );
      }
    } finally {
      nativeSelection?.releaseUpload(nativeUploadKey);
      if (mounted) setState(() => _isUploadingLogo = false);
    }
  }

  void _addCustomPage() {
    showDialog(
      context: context,
      builder: (ctx) => _AddPageDialog(
        onAdd: (label, href) {
          setState(() {
            final pages = List<Map<String, dynamic>>.from(
              _settings['navPages'] ?? [],
            );
            pages.add({
              'id': DateTime.now().millisecondsSinceEpoch.toString(),
              'label': label,
              'href': href,
              'isDefault': false,
              'isVisible': true,
            });
            _settings['navPages'] = pages;
          });
        },
      ),
    );
  }

  void _removePage(int index) {
    final pages = List<Map<String, dynamic>>.from(_settings['navPages'] ?? []);
    if (!pages[index]['isDefault']) {
      setState(() {
        pages.removeAt(index);
        _settings['navPages'] = pages;
      });
    }
  }

  void _reorderPages(int oldIndex, int newIndex) {
    if (newIndex > oldIndex) newIndex--;
    final pages = List<Map<String, dynamic>>.from(_settings['navPages'] ?? []);
    final item = pages.removeAt(oldIndex);
    pages.insert(newIndex, item);
    setState(() {
      _settings['navPages'] = pages;
    });
  }

  Future<void> _save() async {
    setState(() => _isSaving = true);
    try {
      await widget.onSave(_settings);
      HapticFeedback.mediumImpact();
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error saving: $e')));
      }
    } finally {
      setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    return Container(
      height: MediaQuery.of(context).size.height * 0.9,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          // Handle
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: colors.divider,
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Icon(Icons.view_compact_outlined, color: AppColors.lavender),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Header Settings',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: colors.textPrimary,
                    ),
                  ),
                ),
                IconButton(
                  icon: Icon(Icons.close, color: colors.textSecondary),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),

          Divider(color: colors.divider, height: 1),

          // Content
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                // Live Preview
                _buildPreview(),
                const SizedBox(height: 24),

                // Behavior Section
                _buildSectionTitle('Behavior'),
                _buildBehaviorSelector(),
                const SizedBox(height: 24),

                // Logo & Branding Section
                _buildSectionTitle('Logo & Branding'),
                _buildLogoPlacementSelector(),
                const SizedBox(height: 16),
                _buildDisplayModeSelector(),
                const SizedBox(height: 16),
                _buildLogoUpload(),
                const SizedBox(height: 24),

                // Navigation Section
                _buildSectionTitle('Navigation'),
                _buildNavPlacementSelector(),
                const SizedBox(height: 16),
                _buildNavPagesEditor(),
                const SizedBox(height: 24),

                // Icons Section
                _buildSectionTitle('Header Icons'),
                _buildIconToggles(),
                const SizedBox(height: 32),
              ],
            ),
          ),

          // Save Button
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: colors.card,
              border: Border(top: BorderSide(color: colors.divider)),
            ),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isSaving ? null : _save,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.lavender,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _isSaving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text(
                        'Save Changes',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPreview() {
    final isLogoLeft = _settings['logoPlacement'] == 'left';
    final displayMode = _settings['displayMode'] ?? 'both';
    final navPlacement = _settings['navPlacement'] ?? 'right';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          // Mobile menu (always left)
          const Icon(Icons.menu, size: 20, color: Colors.black54),
          const SizedBox(width: 12),

          // Nav links (if left placement)
          if (navPlacement == 'left') ...[
            ..._buildPreviewNavLinks(),
            const SizedBox(width: 12),
          ],

          // Logo/Name
          if (!isLogoLeft) const Spacer(),
          _buildPreviewLogo(displayMode),
          if (isLogoLeft) const Spacer(),

          // Nav links (if right placement)
          if (navPlacement == 'right') ...[
            const Spacer(),
            ..._buildPreviewNavLinks(),
            const SizedBox(width: 12),
          ],

          // Icons
          if (_settings['showSearch'] == true)
            const Padding(
              padding: EdgeInsets.only(right: 8),
              child: Icon(Icons.search, size: 18, color: Colors.black54),
            ),
          if (_settings['showAccount'] == true)
            const Padding(
              padding: EdgeInsets.only(right: 8),
              child: Icon(
                Icons.person_outline,
                size: 18,
                color: Colors.black54,
              ),
            ),
          if (_settings['showCart'] == true)
            const Icon(
              Icons.shopping_bag_outlined,
              size: 18,
              color: Colors.black54,
            ),
        ],
      ),
    );
  }

  Widget _buildPreviewLogo(String displayMode) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (displayMode == 'logo' || displayMode == 'both')
          if (_logoUrl != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: CachedMerchantImage(
                imageUrl: _logoUrl!,
                height: 24,
                width: 24,
                fit: BoxFit.cover,
              ),
            )
          else
            Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                color: Colors.grey.shade200,
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Icon(Icons.image, size: 14, color: Colors.grey),
            ),
        if (displayMode == 'both') const SizedBox(width: 6),
        if (displayMode == 'name' || displayMode == 'both')
          Text(
            widget.store.name.length > 12
                ? '${widget.store.name.substring(0, 12)}...'
                : widget.store.name,
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 14,
              color: Colors.black87,
            ),
          ),
      ],
    );
  }

  List<Widget> _buildPreviewNavLinks() {
    final pages = List<Map<String, dynamic>>.from(_settings['navPages'] ?? []);
    return pages
        .take(3)
        .map(
          (page) => Padding(
            padding: const EdgeInsets.only(right: 8),
            child: Text(
              page['label'],
              style: TextStyle(fontSize: 10, color: Colors.grey.shade600),
            ),
          ),
        )
        .toList();
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: colors.textPrimary,
        ),
      ),
    );
  }

  Widget _buildBehaviorSelector() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          _buildBehaviorOption('sticky', 'Sticky', 'Always visible at top'),
          _buildBehaviorOption('scroll', 'Scroll', 'Scrolls with page'),
          _buildBehaviorOption(
            'hide-on-scroll',
            'Smart Hide',
            'Hides when scrolling down',
          ),
        ],
      ),
    );
  }

  Widget _buildBehaviorOption(String value, String title, String subtitle) {
    final isSelected = _settings['behavior'] == value;
    return GestureDetector(
      onTap: () => setState(() => _settings['behavior'] = value),
      child: Container(
        padding: const EdgeInsets.all(12),
        margin: const EdgeInsets.only(bottom: 4),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.lavender.withValues(alpha: 0.15)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: isSelected
              ? Border.all(color: AppColors.lavender.withValues(alpha: 0.5))
              : null,
        ),
        child: Row(
          children: [
            Icon(
              isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
              color: isSelected ? AppColors.lavender : colors.textTertiary,
              size: 20,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontWeight: FontWeight.w500,
                      color: colors.textPrimary,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: TextStyle(fontSize: 12, color: colors.textSecondary),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLogoPlacementSelector() {
    return Row(
      children: [
        Expanded(
          child: _buildToggleButton(
            'logoPlacement',
            'left',
            'Left',
            Icons.format_align_left,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _buildToggleButton(
            'logoPlacement',
            'center',
            'Center',
            Icons.format_align_center,
          ),
        ),
      ],
    );
  }

  Widget _buildDisplayModeSelector() {
    return Row(
      children: [
        Expanded(
          child: _buildToggleButton(
            'displayMode',
            'logo',
            'Logo Only',
            Icons.image_outlined,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _buildToggleButton(
            'displayMode',
            'name',
            'Name Only',
            Icons.text_fields,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _buildToggleButton(
            'displayMode',
            'both',
            'Both',
            Icons.view_agenda_outlined,
          ),
        ),
      ],
    );
  }

  Widget _buildNavPlacementSelector() {
    return Row(
      children: [
        Expanded(
          child: _buildToggleButton(
            'navPlacement',
            'left',
            'Left Side',
            Icons.format_indent_decrease,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _buildToggleButton(
            'navPlacement',
            'right',
            'Right Side',
            Icons.format_indent_increase,
          ),
        ),
      ],
    );
  }

  Widget _buildToggleButton(
    String key,
    String value,
    String label,
    IconData icon,
  ) {
    final isSelected = _settings[key] == value;
    return GestureDetector(
      onTap: () => setState(() => _settings[key] = value),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.lavender.withValues(alpha: 0.15)
              : colors.surfaceVariant,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected ? AppColors.lavender : colors.divider,
          ),
        ),
        child: Column(
          children: [
            Icon(
              icon,
              color: isSelected ? AppColors.lavender : colors.textSecondary,
              size: 20,
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                color: isSelected ? AppColors.lavender : colors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLogoUpload() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.divider),
      ),
      child: Row(
        children: [
          // Logo Preview
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: colors.divider),
              image: _logoUrl != null
                  ? DecorationImage(
                      image: cachedMerchantImageProvider(_logoUrl!),
                      fit: BoxFit.cover,
                    )
                  : null,
            ),
            child: _logoUrl == null
                ? Icon(Icons.image_outlined, color: colors.textTertiary)
                : null,
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Header Logo',
                  style: TextStyle(
                    fontWeight: FontWeight.w500,
                    color: colors.textPrimary,
                  ),
                ),
                Text(
                  'PNG or JPG, max 512px',
                  style: TextStyle(fontSize: 12, color: colors.textSecondary),
                ),
              ],
            ),
          ),
          OutlinedButton(
            onPressed: _isUploadingLogo ? null : _pickAndUploadLogo,
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.lavender,
              side: BorderSide(color: AppColors.lavender),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            child: _isUploadingLogo
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text('Upload'),
          ),
        ],
      ),
    );
  }

  Widget _buildNavPagesEditor() {
    final pages = List<Map<String, dynamic>>.from(
      _settings['navPages'] ?? _defaultNavPages,
    );

    return Container(
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.divider),
      ),
      child: Column(
        children: [
          ReorderableListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: pages.length,
            onReorder: _reorderPages,
            itemBuilder: (context, index) {
              final page = pages[index];
              return Container(
                key: ValueKey(page['id']),
                decoration: BoxDecoration(
                  border: index < pages.length - 1
                      ? Border(bottom: BorderSide(color: colors.divider))
                      : null,
                ),
                child: ListTile(
                  leading: Icon(Icons.drag_handle, color: colors.textTertiary),
                  title: Text(
                    page['label'],
                    style: TextStyle(color: colors.textPrimary),
                  ),
                  subtitle: Text(
                    page['href'],
                    style: TextStyle(fontSize: 12, color: colors.textSecondary),
                  ),
                  trailing: page['isDefault'] == true
                      ? Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: colors.card,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            'Default',
                            style: TextStyle(
                              fontSize: 10,
                              color: colors.textTertiary,
                            ),
                          ),
                        )
                      : IconButton(
                          icon: Icon(
                            Icons.delete_outline,
                            color: const Color(0xFFEF4444),
                          ),
                          onPressed: () => _removePage(index),
                        ),
                ),
              );
            },
          ),
          Divider(height: 1, color: colors.divider),
          TextButton.icon(
            onPressed: _addCustomPage,
            icon: Icon(Icons.add, color: AppColors.lavender),
            label: Text(
              'Add Custom Page',
              style: TextStyle(color: AppColors.lavender),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildIconToggles() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          _buildSwitchRow('showSearch', 'Search Icon', Icons.search),
          _buildSwitchRow('showCart', 'Cart Icon', Icons.shopping_bag_outlined),
          _buildSwitchRow('showAccount', 'Account Icon', Icons.person_outline),
        ],
      ),
    );
  }

  Widget _buildSwitchRow(String key, String label, IconData icon) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        children: [
          Icon(icon, color: colors.textSecondary, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Text(label, style: TextStyle(color: colors.textPrimary)),
          ),
          Switch(
            value: _settings[key] == true,
            onChanged: (value) => setState(() => _settings[key] = value),
            activeColor: AppColors.lavender,
          ),
        ],
      ),
    );
  }
}

/// Dialog for adding custom nav pages
class _AddPageDialog extends StatefulWidget {
  final Function(String label, String href) onAdd;

  const _AddPageDialog({required this.onAdd});

  @override
  State<_AddPageDialog> createState() => _AddPageDialogState();
}

class _AddPageDialogState extends State<_AddPageDialog> {
  final _labelController = TextEditingController();
  final _hrefController = TextEditingController(text: '/');

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return AlertDialog(
      backgroundColor: colors.card,
      title: Text(
        'Add Custom Page',
        style: TextStyle(color: colors.textPrimary),
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _labelController,
            decoration: InputDecoration(
              labelText: 'Page Label',
              hintText: 'e.g., About Us',
              labelStyle: TextStyle(color: colors.textSecondary),
              hintStyle: TextStyle(color: colors.textTertiary),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: colors.divider),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: AppColors.lavender),
              ),
            ),
            style: TextStyle(color: colors.textPrimary),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _hrefController,
            decoration: InputDecoration(
              labelText: 'URL Path',
              hintText: '/about-us',
              labelStyle: TextStyle(color: colors.textSecondary),
              hintStyle: TextStyle(color: colors.textTertiary),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: colors.divider),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: AppColors.lavender),
              ),
            ),
            style: TextStyle(color: colors.textPrimary),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text('Cancel', style: TextStyle(color: colors.textSecondary)),
        ),
        ElevatedButton(
          onPressed: () {
            if (_labelController.text.isNotEmpty) {
              widget.onAdd(_labelController.text, _hrefController.text);
              Navigator.pop(context);
            }
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.lavender,
            foregroundColor: Colors.white,
          ),
          child: Text('Add'),
        ),
      ],
    );
  }

  @override
  void dispose() {
    _labelController.dispose();
    _hrefController.dispose();
    super.dispose();
  }
}
