import 'package:flutter/material.dart';
import '../../theme/app_theme_colors.dart';
import 'merchant_store_view.dart';

typedef WarehouseFilterSelection = ({
  String search,
  String status,
  String sort,
});
Future<WarehouseFilterSelection?> showWarehouseListFilters(
  BuildContext context, {
  required MerchantStoreView view,
  required WarehouseFilterSelection initial,
  required List<String> statuses,
  required bool documents,
}) => showModalBottomSheet<WarehouseFilterSelection>(
  context: context,
  isScrollControlled: true,
  builder: (_) => guardMerchantStoreView(
    view,
    _Filters(
      view: view,
      initial: initial,
      statuses: statuses,
      documents: documents,
    ),
  ),
);

class _Filters extends StatefulWidget {
  const _Filters({
    required this.view,
    required this.initial,
    required this.statuses,
    required this.documents,
  });
  final MerchantStoreView view;
  final WarehouseFilterSelection initial;
  final List<String> statuses;
  final bool documents;
  @override
  State<_Filters> createState() => _FiltersState();
}

class _FiltersState extends State<_Filters> {
  late final _search = TextEditingController(text: widget.initial.search);
  late String _status = widget.initial.status, _sort = widget.initial.sort;
  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _apply() {
    if (merchantStoreViewCurrent(context, widget.view))
      Navigator.pop(context, (
        search: _search.text.trim(),
        status: _status,
        sort: _sort,
      ));
  }

  String _label(String status) => status
      .split('_')
      .map((word) => '${word[0].toUpperCase()}${word.substring(1)}')
      .join(' ');
  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final sorts = widget.documents
        ? const {'newest': 'Newest first', 'oldest': 'Oldest first'}
        : const {'name_asc': 'Name A to Z', 'name_desc': 'Name Z to A'};
    return Material(
      color: colors.card,
      child: SafeArea(
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            18,
            18,
            18,
            MediaQuery.of(context).viewInsets.bottom + 18,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Filter and sort',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _search,
                  maxLength: 80,
                  onSubmitted: (_) => _apply(),
                  decoration: InputDecoration(
                    labelText: widget.documents ? 'Document number' : 'Name',
                    hintText: 'Search the full matching population',
                  ),
                ),
                DropdownButtonFormField<String>(
                  initialValue: _status,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Status'),
                  items: [
                    const DropdownMenuItem(
                      value: '',
                      child: Text('All statuses'),
                    ),
                    for (final status in widget.statuses)
                      DropdownMenuItem(
                        value: status,
                        child: Text(_label(status)),
                      ),
                  ],
                  onChanged: (value) => setState(() => _status = value ?? ''),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _sort,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Sort'),
                  items: [
                    for (final item in sorts.entries)
                      DropdownMenuItem(
                        value: item.key,
                        child: Text(item.value),
                      ),
                  ],
                  onChanged: (value) => setState(() => _sort = value ?? _sort),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _apply,
                  child: const Text('Apply filters'),
                ),
                TextButton(
                  onPressed: () {
                    if (merchantStoreViewCurrent(context, widget.view))
                      Navigator.pop(context, (
                        search: '',
                        status: '',
                        sort: widget.documents ? 'newest' : 'name_asc',
                      ));
                  },
                  child: const Text('Clear filters'),
                ),
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
