import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:provider/provider.dart';

import '../../models/store_model.dart';
import '../../services/store_service.dart';

import '../../theme/app_theme_colors.dart';
import '../../widgets/editor/website_preview.dart';
import '../../widgets/editor/device_frames/device_frame_preview.dart';
import '../../widgets/editor/editor_toolbar.dart';
import '../../widgets/editor/compact_settings_sheet.dart';
import '../../widgets/editor/layers_drawer.dart';
import '../../widgets/editor/add_section_sheet.dart';
import '../../widgets/editor/section_settings_sheet.dart';
import '../../widgets/editor/header_editor_sheet.dart';
import '../main/store_main_screen.dart';

/// Advanced Section Editor Screen - Website Preview Mode
/// Live website preview with tap-to-edit sections
class SectionEditorScreen extends StatefulWidget {
  const SectionEditorScreen({super.key});

  @override
  State<SectionEditorScreen> createState() => SectionEditorScreenState();
}

class SectionEditorScreenState extends State<SectionEditorScreen> {
  StoreModel? _store;
  List<SectionModel> _sections = [];
  bool _isLoading = true;
  bool _isSaving = false;
  bool _hasChanges = false;
  late AppThemeColors colors;
  
  // Selected section for editing
  SectionModel? _selectedSection;
  
  // Layers drawer visibility
  bool _showLayers = false;
  
  // Device frame state
  String _deviceMode = 'phone';
  double _zoomLevel = 0.7; // 0.35=50%, 0.7=100%, 1.05=150%
  
  // Undo/Redo history
  final List<List<SectionModel>> _history = [];
  int _historyIndex = -1;
  static const int _maxHistorySize = 50;
  
  // Undo/Redo state getters
  bool get _canUndo => _historyIndex > 0;
  bool get _canRedo => _historyIndex < _history.length - 1;

  @override
  void initState() {
    super.initState();
    _loadStore();
  }
  
  /// Save current state to history AFTER making changes
  /// This stores the new state so undo can restore previous, redo can restore this
  void _pushHistory() {
    // If we're not at the end, remove future states (redo history)
    if (_historyIndex >= 0 && _historyIndex < _history.length - 1) {
      _history.removeRange(_historyIndex + 1, _history.length);
    }
    
    // Add current state as deep copy
    _history.add(_sections.map((s) => s.copyWith()).toList());
    _historyIndex = _history.length - 1;
    
    // Limit history size
    if (_history.length > _maxHistorySize) {
      _history.removeAt(0);
      _historyIndex--;
    }
  }
  
  /// Undo last change - restore previous state
  void _undo() {
    if (!_canUndo) return;
    
    // Detect what section changed (for message)
    final currentSections = _sections.map((s) => s.id).toSet();
    final previousSections = _history[_historyIndex - 1].map((s) => s.id).toSet();
    
    // Find added sections (in current but not in previous = will be removed by undo)
    final addedIds = currentSections.difference(previousSections);
    String? sectionName;
    if (addedIds.isNotEmpty) {
      final addedSection = _sections.firstWhere((s) => s.id == addedIds.first);
      sectionName = addedSection.type.displayName;
    }
    
    _historyIndex--;
    setState(() {
      _sections = _history[_historyIndex].map((s) => s.copyWith()).toList();
      _hasChanges = true;
      _selectedSection = null;
    });
    HapticFeedback.lightImpact();
    
    if (sectionName != null) {
      _showMessage('$sectionName removed', isError: true);
    } else {
      _showMessage('Change undone', isError: true);
    }
  }
  
  /// Redo previously undone change
  void _redo() {
    if (!_canRedo) return;
    
    // Detect what section will be restored (for message)
    final currentSections = _sections.map((s) => s.id).toSet();
    final nextSections = _history[_historyIndex + 1].map((s) => s.id).toSet();
    
    // Find sections that will be added by redo
    final addedIds = nextSections.difference(currentSections);
    String? sectionName;
    if (addedIds.isNotEmpty) {
      final restoredSection = _history[_historyIndex + 1].firstWhere((s) => s.id == addedIds.first);
      sectionName = restoredSection.type.displayName;
    }
    
    _historyIndex++;
    setState(() {
      _sections = _history[_historyIndex].map((s) => s.copyWith()).toList();
      _hasChanges = true;
      _selectedSection = null;
    });
    HapticFeedback.lightImpact();
    
    if (sectionName != null) {
      _showMessage('$sectionName restored', isSuccess: true);
    } else {
      _showMessage('Change restored', isSuccess: true);
    }
  }
  
  /// Confirm before refresh if there are unsaved changes
  Future<void> _confirmRefresh() async {
    if (!_hasChanges) {
      _loadStore();
      return;
    }
    
    final shouldRefresh = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: colors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Discard Changes?', style: TextStyle(color: colors.textPrimary)),
        content: Text(
          'Refreshing will discard all unsaved changes.',
          style: TextStyle(color: colors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Cancel', style: TextStyle(color: colors.textSecondary)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text('Discard', style: TextStyle(color: colors.error)),
          ),
        ],
      ),
    );
    
    if (shouldRefresh == true) {
      _loadStore();
    }
  }

  Future<void> _loadStore() async {
    setState(() => _isLoading = true);
    try {
      final storeService = context.read<StoreService>();
      final store = await storeService.getFirstStore();
      
      if (store != null) {
        final loadedSections = store.templateConfig?.sections ?? [];
        
        // Ensure we have all required sections
        List<SectionModel> sections = List.from(loadedSections);
        bool needsSave = false;
        
        // If no sections, create minimal template
        if (sections.isEmpty) {
          sections = DefaultStoreTemplate.createMinimalSections();
          needsSave = true;
        } else {
          // Check for missing required sections (header, productGrid, footer)
          final hasHeader = sections.any((s) => s.type == SectionType.header);
          final hasProductGrid = sections.any((s) => s.type == SectionType.productGrid);
          final hasFooter = sections.any((s) => s.type == SectionType.footer);
          
          // Add missing header at the beginning
          if (!hasHeader) {
            final headerSection = SectionDefaults.createDefault(SectionType.header)
                .copyWith(order: 0);
            sections.insert(0, headerSection);
            // Reorder remaining sections
            for (int i = 1; i < sections.length; i++) {
              sections[i] = sections[i].copyWith(order: i);
            }
            needsSave = true;
          }
          
          if (!hasProductGrid) {
            final maxOrder = sections.map((s) => s.order).reduce((a, b) => a > b ? a : b);
            sections.add(SectionDefaults.createDefault(SectionType.productGrid)
                .copyWith(order: maxOrder + 1));
            needsSave = true;
          }
          if (!hasFooter) {
            final maxOrder = sections.map((s) => s.order).reduce((a, b) => a > b ? a : b);
            sections.add(SectionDefaults.createDefault(SectionType.footer)
                .copyWith(order: maxOrder + 1));
            needsSave = true;
          }
        }
        
        setState(() {
          _store = store;
          _sections = sections;
        });
        
        // Initialize history with loaded state
        _history.clear();
        _history.add(sections.map((s) => s.copyWith()).toList());
        _historyIndex = 0;
        
        // Auto-save default sections
        if (needsSave && mounted) {
          await _autoSaveDefaults(store, sections, storeService);
        }
      }
    } catch (_) {
    } finally {
      setState(() => _isLoading = false);
    }
  }
  
  /// Public method to reload store data (called from store_main_screen when tab switches)
  Future<void> reloadStore() async {
    if (_store == null) return;
    try {
      final storeService = context.read<StoreService>();
      final latestStore = await storeService.getStoreById(_store!.id);
      if (mounted) {
        final loadedSections = latestStore.templateConfig?.sections ?? [];
        setState(() {
          _store = latestStore;
          _sections = List.from(loadedSections);
        });
      }
    } catch (_) {}
  }
  
  /// Silently save default sections to the API (no UI feedback)
  Future<void> _autoSaveDefaults(StoreModel store, List<SectionModel> sections, StoreService storeService) async {
    try {
      final templateConfig = StoreTemplateModel(
        storeId: store.id,
        themeId: store.templateConfig?.themeId ?? 'modern',
        themeSettings: store.templateConfig?.themeSettings ?? const ThemeSettings(),
        sections: sections,
        createdAt: store.templateConfig?.createdAt ?? DateTime.now(),
        updatedAt: DateTime.now(),
      );
      
      final updatedStore = store.copyWith(templateConfig: templateConfig);
      await storeService.updateStore(updatedStore.id, updatedStore.toJson());
      
      if (mounted) {
        setState(() => _store = updatedStore);
      }
    } catch (_) {
      // Silent fail - user can still manually save
    }
  }

  void _selectSection(SectionModel section) {
    setState(() {
      _selectedSection = (_selectedSection?.id == section.id) ? null : section;
      _showLayers = false;
    });
    HapticFeedback.selectionClick();
  }

  void _updateSection(SectionModel updated) {
    final index = _sections.indexWhere((s) => s.id == updated.id);
    if (index != -1) {
      setState(() {
        _sections[index] = updated;
        _selectedSection = updated;
        _hasChanges = true;
      });
      _pushHistory();
    }
  }

  void _toggleVisibility(SectionModel section) {
    final index = _sections.indexWhere((s) => s.id == section.id);
    if (index != -1) {
      setState(() {
        _sections[index] = section.copyWith(isVisible: !section.isVisible);
        if (_selectedSection?.id == section.id) {
          _selectedSection = _sections[index];
        }
        _hasChanges = true;
      });
      _pushHistory();
    }
    HapticFeedback.lightImpact();
  }

  void _deleteSection(SectionModel section) {
    if (section.type.isRequired) {
      _showMessage('Cannot remove required section', isError: true);
      return;
    }

    setState(() {
      _sections.removeWhere((s) => s.id == section.id);
      _selectedSection = null;
      _hasChanges = true;
    });
    _pushHistory();
    HapticFeedback.mediumImpact();
  }

  /// Handle back button press with unsaved changes confirmation
  Future<void> _handleBackPressed() async {
    void navigateToHome() {
      // Use static method to switch to home tab
      StoreMainScreen.navigateToHome();
    }
    
    if (_hasChanges) {
      final shouldLeave = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          backgroundColor: colors.card,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text(
            'Unsaved Changes',
            style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600),
          ),
          content: Text(
            'You have unsaved changes. Do you want to save before leaving?',
            style: TextStyle(color: colors.textSecondary),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, true), // Leave without saving
              child: Text('Discard', style: TextStyle(color: colors.error)),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context, false), // Stay
              child: Text('Cancel', style: TextStyle(color: colors.textSecondary)),
            ),
            ElevatedButton(
              onPressed: () async {
                await _saveChanges();
                if (mounted) Navigator.pop(context, true); // Save and leave
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.lavender,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('Save & Leave'),
            ),
          ],
        ),
      );
      
      if (shouldLeave == true && mounted) {
        navigateToHome();
      }
    } else {
      navigateToHome();
    }
  }

  void _reorderSections(List<SectionModel> newOrder) {
    setState(() {
      _sections = newOrder;
      _hasChanges = true;
    });
    _pushHistory();
  }

  Future<void> _saveChanges() async {
    if (_store == null || _isSaving) return;
    
    setState(() => _isSaving = true);
    try {
      final storeService = context.read<StoreService>();
      
      final templateConfig = StoreTemplateModel(
        storeId: _store!.id,
        themeId: _store?.templateConfig?.themeId ?? 'modern',
        themeSettings: _store?.templateConfig?.themeSettings ?? const ThemeSettings(),
        sections: _sections,
        createdAt: _store?.templateConfig?.createdAt ?? DateTime.now(),
        updatedAt: DateTime.now(),
      );
      
      final updatedStore = _store!.copyWith(templateConfig: templateConfig);
      await storeService.updateStore(updatedStore.id, updatedStore.toJson());
      
      setState(() {
        _store = updatedStore;
        _hasChanges = false;
      });
      
      _showMessage('Changes saved!', isSuccess: true);
      HapticFeedback.heavyImpact();
    } catch (e) {
      _showMessage('Error saving: $e', isError: true);
    } finally {
      setState(() => _isSaving = false);
    }
  }

  void _showMessage(String message, {bool isSuccess = false, bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          message,
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w500,
          ),
        ),
        backgroundColor: isError 
            ? colors.error 
            : (isSuccess ? const Color(0xFF10B981) : colors.card),
        behavior: SnackBarBehavior.floating,
        // Position above toolbar (toolbar height ~68 + safe area)
        margin: const EdgeInsets.only(left: 16, right: 16, bottom: 80),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  /// Move section up or down by direction (-1 = up, +1 = down)
  void _moveSection(SectionModel section, int direction) {
    // Don't move header or footer
    if (section.type == SectionType.header || section.type == SectionType.footer) return;
    
    final index = _sections.indexWhere((s) => s.id == section.id);
    if (index == -1) return;
    
    final newIndex = index + direction;
    
    // Check bounds (skip header at 0 and footer at end)
    if (newIndex < 1 || newIndex >= _sections.length - 1) return;
    
    // Don't swap with header or footer
    if (_sections[newIndex].type == SectionType.header || 
        _sections[newIndex].type == SectionType.footer) return;
    
    setState(() {
      // Swap orders
      final currentOrder = _sections[index].order;
      final targetOrder = _sections[newIndex].order;
      
      _sections[index] = _sections[index].copyWith(order: targetOrder);
      _sections[newIndex] = _sections[newIndex].copyWith(order: currentOrder);
      
      // Swap positions in list
      final temp = _sections[index];
      _sections[index] = _sections[newIndex];
      _sections[newIndex] = temp;
      
      _hasChanges = true;
    });
    _pushHistory();
    
    HapticFeedback.lightImpact();
  }

  Future<void> _showAddSectionSheet() async {
    final existingTypes = _sections.map((s) => s.type).toList();
    final type = await AddSectionSheet.show(
      context,
      existingSectionTypes: existingTypes,
    );
    
    if (type != null) {
      final newSection = SectionDefaults.createDefault(type);
      setState(() {
        // Find insert position: before footer, after everything else
        int insertIndex = _sections.length;
        for (int i = 0; i < _sections.length; i++) {
          if (_sections[i].type == SectionType.footer) {
            insertIndex = i;
            break;
          }
        }
        
        // Insert at correct position
        _sections.insert(insertIndex, newSection);
        
        // Recalculate all orders to maintain proper sequence
        _recalculateOrders();
        _hasChanges = true;
      });
      _pushHistory();
      _showMessage('${type.displayName} added');
      HapticFeedback.mediumImpact();
    }
  }
  
  /// Recalculate order values for all sections (header=0, footer=last)
  void _recalculateOrders() {
    // Sort by type first (header first, footer last), then by current order
    _sections.sort((a, b) {
      if (a.type == SectionType.header) return -1;
      if (b.type == SectionType.header) return 1;
      if (a.type == SectionType.footer) return 1;
      if (b.type == SectionType.footer) return -1;
      return a.order.compareTo(b.order);
    });
    
    // Assign sequential orders
    for (int i = 0; i < _sections.length; i++) {
      _sections[i] = _sections[i].copyWith(order: i);
    }
  }

  void _openFullSettings() async {
    if (_selectedSection == null || _store == null) return;
    
    // Use HeaderEditorSheet for header sections
    if (_selectedSection!.type == SectionType.header) {
      await HeaderEditorSheet.show(
        context,
        store: _store!,
        settings: _selectedSection!.settings,
        onSave: (newSettings) async {
          final updated = _selectedSection!.copyWith(settings: newSettings);
          _updateSection(updated);
          
          // Also save to API immediately for sync
          final storeService = context.read<StoreService>();
          await storeService.updateHeaderSettings(_store!.id, newSettings);
        },
      );
      return;
    }
    
    final updated = await SectionSettingsSheet.show(
      context,
      section: _selectedSection!,
      store: _store,
    );
    
    if (updated != null) {
      _updateSection(updated);
    }
  }

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    if (_isLoading) {
      return Scaffold(
        backgroundColor: colors.bgStart,
        body: Container(
          decoration: colors.backgroundGradient,
          child: const Center(
            child: CircularProgressIndicator(color: Colors.white),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: colors.bgStart,
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          bottom: false,
          child: Stack(
            children: [
              // Main Content
              Column(
                children: [
                  // Header
                  _buildHeader(),
                  
                  // Website Preview with Device Frame
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                      child: DeviceFramePreview(
                        deviceMode: _deviceMode,
                        zoomLevel: _zoomLevel,
                        onDeviceChange: (mode) => setState(() => _deviceMode = mode),
                        onZoomChange: (zoom) => setState(() => _zoomLevel = zoom),
                        child: WebsitePreview(
                          store: _store,
                          sections: _sections,
                          selectedSectionId: _selectedSection?.id,
                          zoomLevel: _zoomLevel,
                          deviceMode: _deviceMode,
                          onSectionTap: _selectSection,
                          onMoveSection: _moveSection,
                          onAddSection: _showAddSectionSheet,
                        ),
                      ),
                    ),
                  ),
                  
                  // Compact Settings Sheet (when section selected)
                  if (_selectedSection != null)
                    CompactSettingsSheet(
                      section: _selectedSection!,
                      store: _store,
                      onUpdate: _updateSection,
                      onExpand: _openFullSettings,
                      onClose: () => setState(() => _selectedSection = null),
                      onDelete: () => _deleteSection(_selectedSection!),
                      onToggleVisibility: () => _toggleVisibility(_selectedSection!),
                    ),
                  
                  // Bottom Toolbar (when no section selected)
                  if (_selectedSection == null)
                    EditorToolbar(
                      onAddSection: _showAddSectionSheet,
                      onShowLayers: () => setState(() => _showLayers = true),
                      onUndo: _undo,
                      onRedo: _redo,
                      canUndo: _canUndo,
                      canRedo: _canRedo,
                      onRefresh: _confirmRefresh,
                    ),
                ],
              ),
              
              // Layers Drawer (overlay)
              if (_showLayers)
                Positioned.fill(
                  child: GestureDetector(
                    onTap: () => setState(() => _showLayers = false),
                    child: Container(
                      color: Colors.black.withValues(alpha: 0.5),
                    ),
                  ),
                ),
              
              if (_showLayers)
                Positioned(
                  right: 0,
                  top: 0,
                  bottom: 0,
                  child: SafeArea(
                    child: LayersDrawer(
                      sections: _sections,
                      selectedSectionId: _selectedSection?.id,
                      onSectionTap: (section) {
                        _selectSection(section);
                        setState(() => _showLayers = false);
                      },
                      onReorder: _reorderSections,
                      onVisibilityToggle: _toggleVisibility,
                      onClose: () => setState(() => _showLayers = false),
                    ),
                  ),
                ),
            ],
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
                  'Store Designer',
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
                    style: TextStyle(
                      fontSize: 11,
                      color: colors.textSecondary,
                    ),
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
                backgroundColor: _hasChanges ? AppColors.primary : colors.surfaceVariant,
                foregroundColor: _hasChanges ? Colors.white : colors.textSecondary,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              icon: _isSaving 
                ? const SizedBox(
                    width: 14, 
                    height: 14, 
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                  )
                : Icon(_hasChanges ? Icons.cloud_upload_outlined : Icons.check, size: 16),
              label: Text(
                _isSaving ? 'Saving...' : (_hasChanges ? 'Save' : 'Saved'),
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
