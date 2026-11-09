import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
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
}) => showLetbuyyFormSheet<WarehouseFilterSelection>(
  context: context,
  builder: (_) => guardMerchantStoreView(
    view,
    _Filters(
      view: view,
      initial: initial,
      statuses: statuses,
      documents: documents,
    ),
    sheet: true,
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
    if (mounted &&
        merchantStoreViewCurrent(context, widget.view) &&
        isLetbuyySurfaceCurrent(context))
      completeLetbuyySurface(context, (
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
    final sorts = widget.documents
        ? const {'newest': 'Newest first', 'oldest': 'Oldest first'}
        : const {'name_asc': 'Name A to Z', 'name_desc': 'Name Z to A'};
    return LetbuyyFormSheet(
      title: 'Filter and sort',
      actions: [
        TextButton(
          onPressed: () => completeLetbuyySurface(context),
          child: const Text('Cancel'),
        ),
        TextButton(
          onPressed: () {
            if (mounted &&
                merchantStoreViewCurrent(context, widget.view) &&
                isLetbuyySurfaceCurrent(context))
              completeLetbuyySurface(context, (
                search: '',
                status: '',
                sort: widget.documents ? 'newest' : 'name_asc',
              ));
          },
          child: const Text('Clear filters'),
        ),
        FilledButton(onPressed: _apply, child: const Text('Apply filters')),
      ],
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CustomTextField(
            controller: _search,
            maxLength: 80,
            onSubmitted: (_) => _apply(),
            label: widget.documents ? 'Document number' : 'Name',
            helperText: 'Search the full matching population',
          ),
          DropdownButtonFormField<String>(
            initialValue: _status,
            isExpanded: true,
            isDense: false,
            itemHeight: null,
            decoration: const InputDecoration(labelText: 'Status'),
            items: [
              const DropdownMenuItem(value: '', child: Text('All statuses')),
              for (final status in widget.statuses)
                DropdownMenuItem(value: status, child: Text(_label(status))),
            ],
            onChanged: (value) {
              if (mounted && isLetbuyySurfaceCurrent(context))
                setState(() => _status = value ?? '');
            },
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _sort,
            isExpanded: true,
            isDense: false,
            itemHeight: null,
            decoration: const InputDecoration(labelText: 'Sort'),
            items: [
              for (final item in sorts.entries)
                DropdownMenuItem(value: item.key, child: Text(item.value)),
            ],
            onChanged: (value) {
              if (mounted && isLetbuyySurfaceCurrent(context))
                setState(() => _sort = value ?? _sort);
            },
          ),
        ],
      ),
    );
  }
}
