import 'package:flutter/material.dart';
import '../../services/api_client.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'merchant_store_view.dart';

/// A bounded selector over current canonical readers, with no option cache.
Future<T?> chooseMerchantOption<T>(
  BuildContext context,
  MerchantStoreView view,
  String title,
  Future<PaginatedResponse<T>> Function(int, String) read,
  String Function(T) label,
) => showLetbuyyFormSheet<T>(
  context: context,
  builder: (_) => guardMerchantStoreView(
    view,
    _MerchantChoices<T>(view: view, title: title, read: read, label: label),
    sheet: true,
  ),
);

class _MerchantChoices<T> extends StatefulWidget {
  const _MerchantChoices({
    required this.view,
    required this.title,
    required this.read,
    required this.label,
  });
  final MerchantStoreView view;
  final String title;
  final Future<PaginatedResponse<T>> Function(int, String) read;
  final String Function(T) label;
  @override
  State<_MerchantChoices<T>> createState() => _MerchantChoicesState<T>();
}

class _MerchantChoicesState<T> extends State<_MerchantChoices<T>> {
  final _search = TextEditingController();
  String _query = '';
  int _page = 1, _generation = 0;
  bool _busy = true, _more = false;
  String? _error;
  int? _total;
  List<T> _rows = [];
  bool get _current =>
      mounted &&
      merchantStoreViewCurrent(context, widget.view) &&
      isLetbuyySurfaceCurrent(context);
  void _searchCurrent() {
    if (!_current) return;
    _query = _search.text.trim();
    _page = 1;
    _load();
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (!mounted) return;
    final generation = ++_generation;
    setState(() {
      _busy = true;
      _error = null;
      _rows = [];
      _total = null;
      _more = false;
    });
    try {
      final result = await widget.read(_page, _query);
      if (!mounted ||
          generation != _generation ||
          !merchantStoreViewCurrent(context, widget.view))
        return;
      setState(() {
        _rows = result.data;
        _more = result.hasMore;
        _total = result.meta['total_is_exact'] == true ? result.total : null;
        _busy = false;
      });
    } catch (_) {
      if (mounted &&
          generation == _generation &&
          merchantStoreViewCurrent(context, widget.view))
        setState(() {
          _error =
              'Choices could not be loaded. Check your connection and current store access.';
          _busy = false;
        });
    }
  }

  @override
  Widget build(BuildContext context) {
    final generation = _generation;
    return LetbuyyFormSheet(
      title: widget.title,
      closeLabel: 'Close choices',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CustomTextField(
            controller: _search,
            maxLength: 80,
            label: 'Search ${widget.title.toLowerCase()}',
            onSubmitted: (_) => _searchCurrent(),
            suffixIcon: IconButton(
              tooltip: 'Search choices',
              onPressed: _searchCurrent,
              icon: const Icon(Icons.search),
            ),
          ),
          Row(
            children: [
              IconButton(
                tooltip: 'Previous choices',
                onPressed: _busy || _page == 1
                    ? null
                    : () {
                        if (!_current || _busy || generation != _generation)
                          return;
                        _page--;
                        _load();
                      },
                icon: const Icon(Icons.chevron_left),
              ),
              Expanded(
                child: Text(
                  _total == null
                      ? 'Page $_page'
                      : '$_total matching choices · Page $_page',
                  textAlign: TextAlign.center,
                ),
              ),
              IconButton(
                tooltip: 'Next choices',
                onPressed: _busy || !_more
                    ? null
                    : () {
                        if (!_current || _busy || generation != _generation)
                          return;
                        _page++;
                        _load();
                      },
                icon: const Icon(Icons.chevron_right),
              ),
            ],
          ),
          if (_busy) const LinearProgressIndicator(),
          if (_error != null) ...[
            Text(_error!),
            TextButton(
              onPressed: () {
                if (_current && !_busy && generation == _generation) _load();
              },
              child: const Text('Retry choices'),
            ),
          ],

          if (!_busy && _error == null && _rows.isEmpty)
            const ListTile(title: Text('No matching choices on this page.')),
          for (final row in _rows)
            ListTile(
              title: Text(widget.label(row)),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {
                if (_current && !_busy && generation == _generation)
                  completeLetbuyySurface(context, row);
              },
            ),
        ],
      ),
    );
  }
}
