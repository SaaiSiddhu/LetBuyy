import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' hide LoadingOverlay;
import 'package:letbuyy_models/letbuyy_models.dart';
import '../../services/store_service.dart';

import '../../models/store_model.dart';
import '../../models/store_theme_model.dart';
import '../../theme/app_theme_colors.dart';
import '../../widgets/shared/loading_overlay.dart';

/// Enhanced Theme Customization Screen
/// Premium dark design with glassmorphism
class ThemeScreen extends StatefulWidget {
  const ThemeScreen({super.key});

  @override
  State<ThemeScreen> createState() => _ThemeScreenState();
}

class _ThemeScreenState extends State<ThemeScreen> with SingleTickerProviderStateMixin {
  StoreModel? _store;
  ThemeSettings _themeSettings = const ThemeSettings();
  String _selectedPresetId = 'minimal_modern';
  bool _isLoading = true;
  bool _isSaving = false;
  bool _hasChanges = false;
  late AppThemeColors colors;
  
  late AnimationController _saveAnimController;

  // Use the 10 themes from StoreThemeModel
  List<StoreThemeModel> get _themes => StoreThemeModel.defaultThemes;

  @override
  void initState() {
    super.initState();
    _saveAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );
    _loadStore();
  }
  
  @override
  void dispose() {
    _saveAnimController.dispose();
    super.dispose();
  }

  Future<void> _loadStore() async {
    setState(() => _isLoading = true);
    try {
      final storeService = context.read<StoreService>();
      final store = await storeService.getFirstStore();
      setState(() {
        _store = store;
        if (store?.templateConfig != null) {
          _themeSettings = store!.templateConfig!.themeSettings;
          _selectedPresetId = store.templateConfig!.themeId;
        }
      });
    } catch (e) {
      debugPrint('Error loading store: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _selectPreset(StoreThemeModel theme) {
    setState(() {
      _selectedPresetId = theme.id;
      _themeSettings = ThemeSettings(
        primaryColor: theme.primaryColor,
        secondaryColor: theme.secondaryColor,
        accentColor: theme.accentColor,
        fontFamily: theme.fontFamily,
        headingFontFamily: theme.fontFamily,
      );
      _hasChanges = true;
    });
    HapticFeedback.lightImpact();
  }

  void _updateColor(String type, Color color) {
    final hex = '#${color.value.toRadixString(16).substring(2).toUpperCase()}';
    setState(() {
      switch (type) {
        case 'primary': _themeSettings = _themeSettings.copyWith(primaryColor: hex); break;
        case 'secondary': _themeSettings = _themeSettings.copyWith(secondaryColor: hex); break;
        case 'accent': _themeSettings = _themeSettings.copyWith(accentColor: hex); break;
      }
      _hasChanges = true;
    });
    HapticFeedback.selectionClick();
  }

  void _updateFont(String type, String fontFamily) {
    setState(() {
      if (type == 'body') {
        _themeSettings = _themeSettings.copyWith(fontFamily: fontFamily);
      } else if (type == 'heading') {
        _themeSettings = _themeSettings.copyWith(headingFontFamily: fontFamily);
      }
      _hasChanges = true;
    });
  }

  Future<void> _saveChanges() async {
    if (_store == null || _isSaving) return;
    
    setState(() => _isSaving = true);
    try {
      final storeService = context.read<StoreService>();
      
      final templateConfig = _store!.templateConfig?.copyWith(
        themeId: _selectedPresetId,
        themeSettings: _themeSettings,
      ) ?? StoreTemplateModel(
        storeId: _store!.id,
        themeId: _selectedPresetId,
        themeSettings: _themeSettings,
        sections: DefaultStoreTemplate.createMinimalSections(),
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
      
      final updatedStore = _store!.copyWith(templateConfig: templateConfig);
      await storeService.updateStore(updatedStore.id, updatedStore.toJson());
      
      setState(() {
        _store = updatedStore;
        _hasChanges = false;
      });
      
      HapticFeedback.heavyImpact();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Theme saved successfully!'),
            backgroundColor: colors.success,
            behavior: SnackBarBehavior.floating,
            margin: const EdgeInsets.all(16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: colors.error,
          ),
        );
      }
    } finally {
      setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    return LoadingOverlay(
      isLoading: _isLoading,
      child: Scaffold(
        backgroundColor: colors.bgStart,
        body: Container(
          decoration: colors.backgroundGradient,
          child: SafeArea(
            child: Column(
              children: [
                _buildHeader(),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                    children: [
                      // Live Preview
                      _buildLivePreview(),
                      const SizedBox(height: 28),
                      
                      // Theme Presets
                      _buildSectionHeader('Theme Presets', Icons.palette_outlined),
                      const SizedBox(height: 12),
                      _buildPresetGrid(),
                      const SizedBox(height: 28),
                      
                      // Brand Colors
                      _buildSectionHeader('Brand Colors', Icons.color_lens_outlined),
                      const SizedBox(height: 12),
                      _buildColorSection(),
                      const SizedBox(height: 28),
                      
                      // Typography
                      _buildSectionHeader('Typography', Icons.text_fields_rounded),
                      const SizedBox(height: 12),
                      _buildTypographySection(),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 8, 16, 4),
      child: Row(
        children: [
          // Title
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Customize Theme',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: colors.textPrimary,
                    letterSpacing: -0.5,
                  ),
                ),
                if (_store?.name != null)
                  Text(
                    _store!.name,
                    style: TextStyle(fontSize: 11, color: colors.textSecondary),
                  ),
              ],
            ),
          ),
          
          // Save Button
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            child: TextButton.icon(
              onPressed: _hasChanges && !_isSaving ? _saveChanges : null,
              style: TextButton.styleFrom(
                backgroundColor: _hasChanges ? AppColors.lavender : colors.surfaceVariant,
                foregroundColor: _hasChanges ? Colors.white : colors.textSecondary,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              icon: _isSaving 
                  ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Icon(Icons.check_rounded, size: 16),
              label: Text(_isSaving ? 'Saving...' : 'Save', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLivePreview() {
    final primary = _hexToColor(_themeSettings.primaryColor);
    final secondary = _hexToColor(_themeSettings.secondaryColor);
    
    return Container(
      height: 180,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [primary, secondary],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(color: primary.withValues(alpha: 0.4), blurRadius: 20, offset: const Offset(0, 8)),
        ],
      ),
      child: Stack(
        children: [
          // Store name and preview
          Positioned(
            left: 24,
            bottom: 24,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _store?.name ?? 'Your Store',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 24,
                    fontFamily: _themeSettings.headingFontFamily,
                    shadows: [Shadow(color: Colors.black26, blurRadius: 8)],
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(_themeSettings.borderRadius),
                    boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 8)],
                  ),
                  child: Text(
                    'Shop Now',
                    style: TextStyle(
                      color: primary,
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                      fontFamily: _themeSettings.fontFamily,
                    ),
                  ),
                ),
              ],
            ),
          ),
          // Preview label
          Positioned(
            right: 16,
            top: 16,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.black26,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text('Live Preview', style: TextStyle(color: Colors.white70, fontSize: 11)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title, IconData icon) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            gradient: LinearGradient(colors: [AppColors.lavender.withValues(alpha: 0.3), AppColors.indigo.withValues(alpha: 0.2)]),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: AppColors.lavender, size: 18),
        ),
        const SizedBox(width: 12),
        Text(
          title,
          style: TextStyle(
            fontWeight: FontWeight.w600,
            fontSize: 16,
            color: colors.textPrimary,
          ),
        ),
      ],
    );
  }

  Widget _buildPresetGrid() {
    return SizedBox(
      height: 130,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _themes.length,
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemBuilder: (context, index) {
          final theme = _themes[index];
          final isSelected = _selectedPresetId == theme.id;
          final primary = theme.primaryColorValue;
          final secondary = theme.secondaryColorValue;
          
          return GestureDetector(
            onTap: () => _selectPreset(theme),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 110,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [primary, secondary],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                border: isSelected 
                    ? Border.all(color: AppColors.lavender, width: 3)
                    : Border.all(color: Colors.white24, width: 1),
                boxShadow: isSelected ? [
                  BoxShadow(color: AppColors.lavender.withValues(alpha: 0.4), blurRadius: 12, offset: const Offset(0, 4)),
                ] : [],
              ),
              transform: isSelected ? (Matrix4.identity()..scale(1.02)) : Matrix4.identity(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  if (theme.isPremium)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      margin: const EdgeInsets.only(bottom: 4),
                      decoration: BoxDecoration(
                        color: Colors.amber.withValues(alpha: 0.9),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text('PRO', style: TextStyle(color: Colors.black, fontSize: 9, fontWeight: FontWeight.bold)),
                    ),
                  Text(
                    theme.name,
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                      fontSize: 12,
                      shadows: [const Shadow(color: Colors.black54, blurRadius: 4)],
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildColorSection() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.divider),
      ),
      child: Column(
        children: [
          _buildColorRow('Primary', _themeSettings.primaryColor, () => _showColorPicker('primary', _themeSettings.primaryColor)),
          Divider(color: colors.divider, height: 24),
          _buildColorRow('Secondary', _themeSettings.secondaryColor, () => _showColorPicker('secondary', _themeSettings.secondaryColor)),
          Divider(color: colors.divider, height: 24),
          _buildColorRow('Accent', _themeSettings.accentColor, () => _showColorPicker('accent', _themeSettings.accentColor)),
        ],
      ),
    );
  }

  Widget _buildColorRow(String label, String hexColor, VoidCallback onTap) {
    final color = _hexToColor(hexColor);
    return GestureDetector(
      onTap: onTap,
      child: Row(
        children: [
          Text(label, style: TextStyle(color: colors.textSecondary, fontSize: 14)),
          const Spacer(),
          Text(hexColor.toUpperCase(), style: TextStyle(color: colors.textTertiary, fontSize: 12, fontFamily: 'monospace')),
          const SizedBox(width: 12),
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white24, width: 2),
              boxShadow: [BoxShadow(color: color.withValues(alpha: 0.5), blurRadius: 8)],
            ),
          ),
        ],
      ),
    );
  }

  void _showColorPicker(String type, String currentHex) {
    final presetColors = [
      const Color(0xFF00B3B3), const Color(0xFF3B82F6), const Color(0xFF8B5CF6),
      const Color(0xFFEC4899), const Color(0xFFEF4444), const Color(0xFFF97316),
      const Color(0xFFEAB308), const Color(0xFF22C55E), const Color(0xFF1E293B),
    ];
    
    showModalBottomSheet(
      context: context,
      backgroundColor: colors.card,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Choose ${type.capitalize()} Color', style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 18)),
            const SizedBox(height: 20),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: presetColors.map((color) => GestureDetector(
                onTap: () {
                  _updateColor(type, color);
                  Navigator.pop(context);
                },
                child: Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: color,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white24, width: 2),
                  ),
                ),
              )).toList(),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildTypographySection() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.divider),
      ),
      child: Column(
        children: [
          _buildFontRow('Heading Font', _themeSettings.headingFontFamily, 'heading'),
          const SizedBox(height: 16),
          _buildFontRow('Body Font', _themeSettings.fontFamily, 'body'),
        ],
      ),
    );
  }

  Widget _buildFontRow(String label, String font, String type) {
    return GestureDetector(
      onTap: () => _showFontPicker(type, font),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(color: colors.textSecondary, fontSize: 12)),
                const SizedBox(height: 4),
                Text(
                  font,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    fontFamily: font,
                  ),
                ),
              ],
            ),
          ),
          Icon(Icons.chevron_right, color: colors.textTertiary),
        ],
      ),
    );
  }

  void _showFontPicker(String type, String currentFont) {
    final fonts = ['Outfit', 'Inter', 'Poppins', 'Roboto', 'Montserrat', 'Playfair Display', 'Lora'];
    
    showModalBottomSheet(
      context: context,
      backgroundColor: colors.card,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Choose ${type.capitalize()} Font', style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 18)),
            const SizedBox(height: 16),
            ...fonts.map((font) => ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(font, style: TextStyle(color: colors.textPrimary, fontFamily: font, fontSize: 18)),
              trailing: currentFont == font ? Icon(Icons.check_circle, color: AppColors.lavender) : null,
              onTap: () {
                _updateFont(type, font);
                Navigator.pop(context);
              },
            )),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Color _hexToColor(String hex) {
    hex = hex.replaceAll('#', '');
    if (hex.length == 6) hex = 'FF$hex';
    return Color(int.parse(hex, radix: 16));
  }
}



extension StringExtension on String {
  String capitalize() => '${this[0].toUpperCase()}${substring(1)}';
}
