import 'dart:typed_data';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_models/letbuyy_models.dart' hide JsonMap;
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';
import '../../services/api_client.dart';
import '../../services/product_service.dart';
import 'product_form_screen.dart';
import 'product_import_messages.dart';

/// CSV creation and original-job recovery; catalog selection remains separate.
class CsvImportScreen extends StatefulWidget {
  const CsvImportScreen({super.key, required this.storeId});
  final String storeId;
  @override
  State<CsvImportScreen> createState() => _CsvImportScreenState();
}

class _CsvImportScreenState extends State<CsvImportScreen> {
  final _source = TextEditingController();
  final _jobAnchor = GlobalKey();
  Object? _scope;
  bool _bound = false,
      _retired = false,
      _busy = false,
      _supported = false,
      _pending = false;
  String? _error, _supportError, _file;
  int _historyPage = 1, _rowPage = 1, _generation = 0;
  String _filter = 'all';
  ProductImportPage<ProductImportJob>? _history;
  ProductImportPage<ProductImportRow>? _rows;
  ProductImportJob? _job;
  bool get _current =>
      mounted &&
      !_retired &&
      context.read<StoreContext>().requestContextKey == _scope &&
      context.read<StoreContext>().selectedStoreId == widget.storeId;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_bound) {
      _bound = true;
      _scope = context.read<StoreContext>().requestContextKey;
      _source.addListener(_draftChanged);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_current) _refresh();
      });
    }
  }

  void _draftChanged() {
    if (_current) setState(() {});
  }

  @override
  void dispose() {
    _source.removeListener(_draftChanged);
    _source.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() work) async {
    if (!_current || _busy) return;
    final generation = ++_generation;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await work();
    } catch (error) {
      if (_current &&
          error is ApiException &&
          (error.statusCode == 401 || error.statusCode == 403)) {
        setState(() {
          _supported = false;
          _history = null;
          _job = null;
          _rows = null;
          _source.clear();
          _file = null;
          _pending = false;
          _supportError = 'Store access changed. Reload this store.';
        });
      }
      if (_current && generation == _generation)
        setState(
          () => _error = error is ApiException
              ? error.message
              : error is FormatException
              ? error.message
              : 'The import outcome could not be confirmed. Refresh the original request.',
        );
    } finally {
      if (_current && generation == _generation) setState(() => _busy = false);
    }
  }

  Future<void> _refresh() => _run(() async {
    final service = context.read<ProductService>();
    final history = await service.fetchCsvImports(
      widget.storeId,
      page: _historyPage,
    );
    if (!_current) return;
    final pending = await service.pendingCsvImport(widget.storeId);
    if (!_current) return;
    setState(() {
      _history = history;
      _pending = pending != null;
    });
    try {
      await service.verifyCsvImport(widget.storeId);
      if (_current)
        setState(() {
          _supported = true;
          _supportError = null;
        });
    } catch (error) {
      if (error is ApiException &&
          (error.statusCode == 401 || error.statusCode == 403))
        rethrow;
      if (_current)
        setState(() {
          _supported = false;
          _supportError = error is ApiException
              ? error.message
              : 'New imports are currently unavailable. Existing jobs can still be viewed.';
        });
    }
    if (!_current) return;
    final selected = _job;
    if (selected != null) await _readJob(selected.id);
  });
  Future<void> _readJob(String id, {bool reveal = false}) async {
    if (!_current) return;
    final page = _rowPage, filter = _filter;
    final service = context.read<ProductService>();
    final job = await service.fetchCsvImport(widget.storeId, id);
    if (!_current || _rowPage != page || _filter != filter) return;
    final rows = await service.fetchCsvRows(
      widget.storeId,
      id,
      page: page,
      status: filter,
    );
    if (_current && _rowPage == page && _filter == filter)
      setState(() {
        _job = job;
        _rows = rows;
      });
    if (reveal)
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final anchor = _jobAnchor.currentContext;
        if (_current && _job?.id == id && anchor != null)
          Scrollable.ensureVisible(
            anchor,
            duration: MediaQuery.disableAnimationsOf(context)
                ? Duration.zero
                : const Duration(milliseconds: 200),
            alignment: 0.1,
          );
      });
  }

  Future<void> _pick() => _run(() async {
    final picked = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['csv'],
      allowMultiple: false,
      withData: false,
      withReadStream: true,
    );
    if (!_current || picked == null) return;
    final file = picked.files.single;
    if (file.size <= 0 || file.size > productImportMaxBytes)
      throw const FormatException('Use a CSV of at most one MiB.');
    final builder = BytesBuilder(copy: false);
    int size = 0;
    await for (final chunk in file.readStream ?? file.xFile.openRead()) {
      if (!_current) return;
      size += chunk.length;
      if (size > productImportMaxBytes)
        throw const FormatException('This file exceeds one MiB.');
      builder.add(chunk);
    }
    final csv = decodeProductImportBytes(builder.takeBytes());
    if (_current)
      setState(() {
        _source.text = csv;
        _file = file.name;
      });
  });
  Future<void> _submit() => _run(() async {
    final service = context.read<ProductService>();
    try {
      final job = await service.importProductCsv(widget.storeId, _source.text);
      if (!_current) return;
      setState(() {
        _job = job;
        _rows = null;
        _rowPage = 1;
        _filter = 'all';
        _pending = false;
        _source.clear();
        _file = null;
      });
      await _readJob(job.id, reveal: true);
      if (!_current) return;
      final history = await service.fetchCsvImports(widget.storeId);
      if (_current)
        setState(() {
          _history = history;
          _historyPage = 1;
        });
    } finally {
      if (_current) {
        final pending = await service.pendingCsvImport(widget.storeId);
        if (_current) setState(() => _pending = pending != null);
      }
    }
  });
  Future<void> _recoverRegistration() => _run(() async {
    final job = await context.read<ProductService>().recoverCsvRegistration(
      widget.storeId,
    );
    if (!_current) return;
    if (job == null)
      throw const FormatException(
        'No registered job was found. Select the exact original CSV and submit with its retained request.',
      );
    setState(() {
      _job = job;
      _rows = null;
      _rowPage = 1;
      _filter = 'all';
      _pending = false;
    });
    await _readJob(job.id, reveal: true);
  });
  Future<void> _command(bool stop) async {
    final job = _job;
    if (job == null || !_current || _busy) return;
    if (stop) {
      final approved = await showLetbuyyConfirmation(
        context: context,
        title: 'Stop remaining import rows?',
        message:
            'Products already committed remain. Stopped rows will not be imported by this job.',
        cancelLabel: 'Keep importing',
        confirmLabel: 'Stop remaining rows',
        destructive: true,
        guard: _guardConfirmation,
      );
      if (approved != true || !_current) return;
    }
    await _run(() async {
      final current = await context.read<ProductService>().recoverCsvImport(
        job,
        stop: stop,
      );
      if (_current) setState(() => _job = current);
      await _readJob(job.id);
    });
  }

  Future<void> _stopRegistration() async {
    if (!_current || _busy || !_pending) return;
    final approved = await showLetbuyyConfirmation(
      context: context,
      title: 'Stop the original request?',
      message:
          'This also stops a late registration. Products already committed remain; review them before importing another file.',
      cancelLabel: 'Keep request',
      confirmLabel: 'Stop original request',
      destructive: true,
      guard: _guardConfirmation,
    );
    if (approved != true || !_current) return;
    await _run(() async {
      final job = await context.read<ProductService>().stopCsvRegistration(
        widget.storeId,
      );
      if (!_current) return;
      if (job == null)
        throw const FormatException(
          'The pending request changed. Refresh imports.',
        );
      setState(() {
        _job = job;
        _pending = false;
        _source.clear();
        _file = null;
        _rows = null;
        _rowPage = 1;
        _filter = 'all';
      });
      await _readJob(job.id, reveal: true);
      if (!_current) return;
      final history = await context.read<ProductService>().fetchCsvImports(
        widget.storeId,
      );
      if (_current)
        setState(() {
          _history = history;
          _historyPage = 1;
        });
    });
  }

  Widget _guardConfirmation(
    BuildContext dialog,
    Widget confirmation,
  ) => Consumer<StoreContext>(
    builder: (_, stores, __) => _current
        ? confirmation
        : AlertDialog(
            title: const Text('Store access changed'),
            content: const Text(
              'Close this confirmation and reopen imports from the current store.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialog, false),
                child: const Text('Close'),
              ),
            ],
          ),
  );

  @override
  Widget build(BuildContext context) {
    final stores = context.watch<StoreContext>();
    if (_scope != stores.requestContextKey ||
        stores.selectedStoreId != widget.storeId)
      _retired = true;
    if (_retired)
      return Scaffold(
        appBar: CustomAppBar.responsive(context: context, title: 'CSV imports'),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Account or store changed. Close this screen and reopen imports from the current store.',
            ),
          ),
        ),
      );
    final job = _job, rows = _rows, history = _history;
    return LetbuyyEditorScaffold(
      title: 'CSV imports',
      hasChanges: _source.text.isNotEmpty,
      currentHasChanges: () => _source.text.isNotEmpty,
      discardTitle: 'Leave CSV draft?',
      discardLabel: 'Leave imports',
      discardMessage:
          'The pasted CSV draft will be cleared on closing. Registered jobs continue independently. Keep the original file and recover an uncertain registration before submitting another request.',
      confirmationGuard: _guardConfirmation,
      headerActions: [
        IconButton(
          onPressed: _busy ? null : _refresh,
          tooltip: 'Refresh imports',
          icon: const Icon(Icons.refresh),
        ),
      ],
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_busy || (_history == null && _error == null))
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Row(
                  children: [
                    const LoadingIndicator(),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        _history == null
                            ? 'Loading imports…'
                            : 'Updating imports…',
                      ),
                    ),
                  ],
                ),
              ),
            const Text(
              'Registered imports continue when you leave this screen. Closing is not a stop request.',
            ),
            const SizedBox(height: 16),
            if (_error != null)
              Semantics(
                liveRegion: true,
                child: Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            if (_supportError != null) Text(_supportError!),
            Text(
              'Create products from CSV',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const Text(
              'Up to 500 rows and one MiB per request. Large quoted files may need to be split. Creates active products; existing products are not updated. Required: name. Optional: price (rupees), description, category, stock, tags and images. Separate tags and image URLs with semicolons. Unsupported columns are refused.',
            ),
            if (_pending)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'An original registration needs confirmation. Keep its CSV; a new request could duplicate products.',
                      ),
                      TextButton(
                        onPressed: _busy ? null : _recoverRegistration,
                        child: const Text('Recover original registration'),
                      ),
                      TextButton(
                        onPressed: _busy ? null : _stopRegistration,
                        child: const Text('Stop original request'),
                      ),
                    ],
                  ),
                ),
              ),
            Wrap(
              spacing: 8,
              children: [
                OutlinedButton.icon(
                  onPressed: _busy ? null : _pick,
                  icon: const Icon(Icons.upload_file),
                  label: const Text('Choose CSV'),
                ),
                TextButton(
                  onPressed: () => Clipboard.setData(
                    const ClipboardData(
                      text:
                          'name,price,description,category,stock,tags,images\nExample product,10.50,,,0,,\n',
                    ),
                  ),
                  child: const Text('Copy template'),
                ),
              ],
            ),
            const SizedBox(height: LetbuyySpacingTokens.space16),
            if (_file != null) ...[
              Text(_file!),
              const SizedBox(height: LetbuyySpacingTokens.space12),
            ],
            CustomTextField(
              controller: _source,
              enabled: !_busy,
              minLines: 3,
              maxLines: 7,
              maxLength: productImportMaxBytes,
              label: 'CSV contents',
              helperText: 'Choose a UTF-8 file or paste its exact contents.',
            ),
            FilledButton(
              onPressed: _busy || !_supported ? null : _submit,
              child: Text(_pending ? 'Submit original CSV' : 'Start import'),
            ),
            if (job != null) ...[
              SizedBox(key: _jobAnchor, height: 0),
              const Divider(),
              Text(
                'Import ${job.id}',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              Text(
                job.totalRows == 0
                    ? 'Registration was stopped before any rows were accepted.'
                    : '${job.status}: ${job.committedRows}/${job.totalRows} products committed; ${job.pendingRows} pending, ${job.failedRows} failed, ${job.stoppedRows} stopped.',
              ),
              if (job.errorCode != null)
                Text(productImportMessage(job.errorCode!)),
              Wrap(
                spacing: 8,
                children: [
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () => _run(() => _readJob(job.id)),
                    child: const Text('Refresh status'),
                  ),
                  if (job.resumable)
                    TextButton(
                      onPressed: _busy ? null : () => _command(false),
                      child: const Text('Resume original rows'),
                    ),
                  if (['queued', 'running', 'failed'].contains(job.status))
                    TextButton(
                      onPressed: _busy ? null : () => _command(true),
                      child: const Text('Stop remaining rows'),
                    ),
                ],
              ),
              LetbuyyChoiceField<String>(
                label: 'Row status',
                value: _filter,
                choices: const [
                  LetbuyyChoice(value: 'all', label: 'All'),
                  LetbuyyChoice(value: 'queued', label: 'Queued'),
                  LetbuyyChoice(value: 'completed', label: 'Completed'),
                  LetbuyyChoice(value: 'failed', label: 'Failed'),
                  LetbuyyChoice(value: 'stopped', label: 'Stopped'),
                ],
                onChanged: _busy
                    ? null
                    : (value) {
                        if (!_current || _busy || _job?.id != job.id) return;
                        setState(() {
                          _filter = value;
                          _rowPage = 1;
                          _rows = null;
                        });
                        _run(() => _readJob(job.id));
                      },
              ),
              if (rows != null) ...[
                for (final row in rows.items)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            'Row ${row.ordinal}: ${row.status}',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          Text(
                            row.productId != null
                                ? 'Product committed'
                                : row.errorCode != null
                                ? productImportMessage(row.errorCode!)
                                : 'Awaiting processing',
                          ),
                          if (row.productId != null)
                            Align(
                              alignment: AlignmentDirectional.centerStart,
                              child: TextButton(
                                onPressed: _busy
                                    ? null
                                    : () => _run(() async {
                                        final product = await context
                                            .read<ProductService>()
                                            .fetchProductForEdit(
                                              row.productId!,
                                              widget.storeId,
                                            );
                                        if (!_current) return;
                                        await Navigator.push(
                                          context,
                                          MaterialPageRoute(
                                            builder: (_) => ProductFormScreen(
                                              product: product,
                                            ),
                                          ),
                                        );
                                      }),
                                child: const Text('View product'),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                Wrap(
                  spacing: 12,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    TextButton(
                      onPressed: _busy || _rowPage <= 1
                          ? null
                          : () {
                              setState(() {
                                _rowPage--;
                                _rows = null;
                              });
                              _run(() => _readJob(job.id));
                            },
                      child: const Text('Previous rows'),
                    ),
                    Text('Page $_rowPage · ${rows.total} matching rows'),
                    TextButton(
                      onPressed: _busy || !rows.hasNext
                          ? null
                          : () {
                              setState(() {
                                _rowPage++;
                                _rows = null;
                              });
                              _run(() => _readJob(job.id));
                            },
                      child: const Text('Next rows'),
                    ),
                  ],
                ),
              ],
            ],
            const Divider(),
            Text(
              'Import history',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            if (history != null) ...[
              if (history.total == 0)
                const Text('No CSV imports for this account and store.'),
              for (final item in history.items)
                ListTile(
                  title: Text(
                    item.totalRows == 0
                        ? 'Registration stopped'
                        : '${item.status} · ${item.committedRows}/${item.totalRows} committed',
                  ),
                  subtitle: Text(item.createdAt.toLocal().toString()),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: _busy
                      ? null
                      : () {
                          setState(() {
                            _job = null;
                            _rows = null;
                            _rowPage = 1;
                            _filter = 'all';
                          });
                          _run(() => _readJob(item.id, reveal: true));
                        },
                ),
              Wrap(
                spacing: 12,
                runSpacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  TextButton(
                    onPressed: _busy || _historyPage <= 1
                        ? null
                        : () {
                            setState(() {
                              _historyPage--;
                              _history = null;
                            });
                            _refresh();
                          },
                    child: const Text('Previous imports'),
                  ),
                  Text('Page $_historyPage'),
                  TextButton(
                    onPressed: _busy || !history.hasNext
                        ? null
                        : () {
                            setState(() {
                              _historyPage++;
                              _history = null;
                            });
                            _refresh();
                          },
                    child: const Text('Next imports'),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
