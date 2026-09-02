import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
// ✅ Corrected Relative Imports
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'add_edit_app_update_dialog.dart';
import 'app_update_card.dart';

class AppUpdateManagementScreen extends StatefulWidget {
  const AppUpdateManagementScreen({super.key});

  @override
  State<AppUpdateManagementScreen> createState() => _AppUpdateManagementScreenState();
}

class _AppUpdateManagementScreenState extends State<AppUpdateManagementScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  bool _selectionMode = false;
  final Set<String> _selectedIds = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<AppUpdateProvider>(context, listen: false).loadUpdates();
    });
  }

  void _enterSelectionMode(String id) {
    setState(() {
      _selectionMode = true;
      _selectedIds.add(id);
    });
  }

  void _toggleSelect(String id) {
    setState(() {
      if (_selectedIds.contains(id)) {
        _selectedIds.remove(id);
      } else {
        _selectedIds.add(id);
      }
      if (_selectedIds.isEmpty) _selectionMode = false;
    });
  }

  void _clearSelection() {
    setState(() {
      _selectionMode = false;
      _selectedIds.clear();
    });
  }

  Future<void> _bulkDelete() async {
    final provider = Provider.of<AppUpdateProvider>(context, listen: false);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete selected updates'),
        content: Text(
          'Are you sure you want to delete ${_selectedIds.length} update(s)? This cannot be undone.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    for (final id in _selectedIds.toList()) {
      final update = provider.updates.firstWhere((u) => u.id == id);
      await provider.deleteUpdate(update);
    }
    _clearSelection();
    provider.loadUpdates();
  }

  void _navigateToAddUpdate() {
    showDialog(
      context: context,
      builder: (_) => AddEditAppUpdateDialog(
        onSave: (update, apkFile) async {
          Navigator.pop(context);
          final provider = Provider.of<AppUpdateProvider>(context, listen: false);
          await provider.createUpdate(update, apkFile: apkFile);
        },
      ),
    );
  }

  void _navigateToEditUpdate(AppUpdateModel update) {
    showDialog(
      context: context,
      builder: (_) => AddEditAppUpdateDialog(
        update: update,
        onSave: (editedUpdate, apkFile) async {
          Navigator.pop(context);
          final provider = Provider.of<AppUpdateProvider>(context, listen: false);
          await provider.updateUpdate(editedUpdate, apkFile: apkFile);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AppUpdateProvider>(
      builder: (context, provider, _) {
        final filtered = provider.updates.where((update) {
          if (_searchQuery.isEmpty) return true;
          return update.versionCode.toString().contains(_searchQuery) ||
              update.updateMessage.toLowerCase().contains(_searchQuery.toLowerCase());
        }).toList();

        return Scaffold(
          appBar: AppBar(
            title: _selectionMode
                ? Text('${_selectedIds.length} selected')
                : const Text('App Update Management'),
            actions: _selectionMode
                ? [
                    IconButton(
                      icon: const Icon(Icons.delete_outline),
                      tooltip: 'Delete',
                      onPressed: _bulkDelete,
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      tooltip: 'Cancel',
                      onPressed: _clearSelection,
                    ),
                  ]
                : [
                    IconButton(
                      icon: const Icon(Icons.refresh),
                      onPressed: provider.loadUpdates,
                    ),
                  ],
          ),
          floatingActionButton: !_selectionMode
              ? FloatingActionButton.extended(
                  icon: const Icon(Icons.add),
                  label: const Text('Add Update'),
                  onPressed: _navigateToAddUpdate,
                )
              : null,
          body: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(12),
                child: TextField(
                  controller: _searchController,
                  onChanged: (val) => setState(() => _searchQuery = val.trim()),
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.search),
                    hintText: 'Search updates...',
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              if (provider.isLoading)
                const Expanded(child: Center(child: CircularProgressIndicator()))
              else if (filtered.isEmpty)
                Expanded(
                  child: Center(
                    child: Text(_searchQuery.isEmpty
                        ? 'No app updates found'
                        : 'No matching updates found'),
                  ),
                )
              else
                Expanded(
                  child: ListView.builder(
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final update = filtered[index];
                      final isSelected = _selectedIds.contains(update.id);

                      return GestureDetector(
                        onLongPress: () => _enterSelectionMode(update.id),
                        child: Stack(
                          children: [
                            AppUpdateCard(
                              update: update,
                              onEdit: () => _navigateToEditUpdate(update),
                              onDelete: () => provider.deleteUpdate(update),
                              onToggle: () => provider.toggleUpdateActive(update, !update.isActive),
                            ),
                            if (_selectionMode)
                              Positioned(
                                left: 8,
                                top: 8,
                                child: Checkbox(
                                  value: isSelected,
                                  onChanged: (_) => _toggleSelect(update.id),
                                ),
                              ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}