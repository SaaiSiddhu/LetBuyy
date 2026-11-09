import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';
import 'package:letbuyy_models/letbuyy_models.dart' show PublicMediaUpload;
import 'package:path_provider/path_provider.dart';

import '../config/app_config.dart';
import 'api_client.dart';
import 'security_command_store.dart';

/// Local OS-selection recovery, never an upload/authorization authority. The
/// original operation continues through the existing SDK under current access.
class NativeMediaSelection extends ChangeNotifier {
  NativeMediaSelection({
    required MerchantSecurityContext? Function() contextProvider,
    SecurityCommandStore? commands,
    Future<LostDataResponse> Function()? retrieveLostData,
    Future<Directory> Function()? directoryProvider,
    TargetPlatform? platform,
  }) : _context = contextProvider,
       _commands = commands ?? SecurityCommandStore(),
       _retrieve = retrieveLostData ?? ImagePicker().retrieveLostData,
       _directory = directoryProvider ?? getApplicationSupportDirectory,
       _platform = platform ?? defaultTargetPlatform;

  static const _command = 'native-media-selection';
  final MerchantSecurityContext? Function() _context;
  final SecurityCommandStore _commands;
  final Future<LostDataResponse> Function() _retrieve;
  final Future<Directory> Function() _directory;
  final TargetPlatform _platform;
  PendingSecurityCommand? _pending;
  Future<void>? _initializing;
  Object? _deliveredVersion;
  String? _ownedRootPath;
  bool _picking = false, _disposed = false;
  String? _uploadKey;
  String? _error;
  String? get error => _error;
  MerchantSecurityContext captureContext() => _capture();
  void requireContext(MerchantSecurityContext c) => _check(c);
  bool get hasSelection => _pending != null;
  bool get busy => _picking || _uploadKey != null;
  bool get unclaimed => _pending?.intent['unclaimed'] == true;
  bool get belongsToCurrentOwner {
    final c = _context(), p = _pending;
    return c != null &&
        p != null &&
        p.intent['unclaimed'] != true &&
        c.actorId == p.actor &&
        c.storeId == p.store;
  }

  String? get purpose {
    final value = _pending?.intent['purpose'];
    return belongsToCurrentOwner && value is String ? value : null;
  }

  bool get canRecover =>
      _error == null &&
      belongsToCurrentOwner &&
      _pending?.intent['stage'] == 'selected' &&
      !busy;

  static ApiException _unavailable([String? message]) => ApiException(
    message:
        message ?? 'Review the saved file selection before choosing another.',
    statusCode: 409,
    code: 'NATIVE_SELECTION_PENDING',
  );
  MerchantSecurityContext _capture() {
    final c = _context();
    if (_disposed || c == null || c.actorId.isEmpty || c.storeId.isEmpty) {
      throw _unavailable(
        'Sign in and select the original store to review this file.',
      );
    }
    return c;
  }

  bool _current(MerchantSecurityContext c) => !_disposed && _context() == c;
  void _check(MerchantSecurityContext c) {
    if (!_current(c))
      throw _unavailable(
        'Account or store access changed. Reopen the original screen.',
      );
  }

  void _changed() {
    if (!_disposed) notifyListeners();
  }

  /// Run once at startup, before any new OS picker. iOS has no lost-data API.
  /// A failure is visible/retryable and never silently starts a fresh selection.
  Future<void> initialize() => _initializing ??= _initialize();
  Future<void> _initialize() async {
    try {
      await _commands.serialized(() async {
        _pending = await _commands.readExclusive(_command);
        final response = _platform == TargetPlatform.android
            ? await _retrieve()
            : LostDataResponse.empty();
        if (!response.isEmpty) {
          final files =
              response.files ??
              (response.file == null ? <XFile>[] : [response.file!]);
          final p = _pending;
          if (p == null) {
            // An old/unowned/private plugin result must never become public media.
            _pending = await _commands.prepareExclusive(
              (actorId: 'unclaimed', storeId: 'unclaimed', version: null),
              _command,
              {'unclaimed': true, 'stage': 'review'},
              check: () {},
            );
          } else if (p.intent['stage'] == 'picking' &&
              p.intent['os_provider'] == 'image_picker' &&
              response.exception == null &&
              files.length == 1 &&
              (p.intent['kind'] == 'video'
                  ? response.type == RetrieveType.video
                  : p.intent['kind'] == 'image' &&
                        response.type == RetrieveType.image)) {
            await _retain(files.single, p);
          } else if (p.intent['stage'] == 'picking') {
            _pending = await _commands.replaceExclusive(p, {
              ...p.intent,
              'stage': 'unavailable',
            });
          }
        } else if (_pending?.intent['stage'] == 'captured') {
          await _retain(
            XFile(_pending!.intent['source_path'] as String),
            _pending!,
          );
        } else if (_pending?.intent['stage'] == 'picking') {
          final p = _pending!;
          _pending = await _commands.replaceExclusive(p, {
            ...p.intent,
            'stage': 'unavailable',
          });
        }
        _error = null;
      });
    } catch (_) {
      _error =
          'Saved file selection could not be read. Retry recovery before choosing another file.';
    }
    _changed();
  }

  Future<void> retryInitialization() async {
    if (_picking) return;
    _initializing = null;
    await initialize();
  }

  Future<Directory> _root() async {
    final base = await _directory();
    final namespace = sha256
        .convert(utf8.encode(AppConfig.persistenceNamespace()))
        .toString()
        .substring(0, 16);
    final root = Directory(
      '${base.path}/merchant-native-selections/$namespace',
    );
    _ownedRootPath = root.path;
    return root;
  }

  Future<File> _file(PendingSecurityCommand p) async {
    if (!RegExp(r'^[a-f0-9-]{36}$').hasMatch(p.key)) throw _unavailable();
    final name = p.intent['filename'];
    if (name is! String ||
        name.isEmpty ||
        name == '.' ||
        name == '..' ||
        name.contains('/') ||
        name.contains('\\') ||
        name.contains('\u0000')) {
      throw _unavailable();
    }
    return File('${(await _root()).path}/${p.key}/$name');
  }

  Future<void> _retain(XFile source, PendingSecurityCommand pending) async {
    final original = source.name;
    final filename = original.replaceAll(RegExp(r'[^a-zA-Z0-9._ -]'), '_');
    if (filename.isEmpty ||
        filename.length > 180 ||
        filename == '.' ||
        filename == '..') {
      throw _unavailable(
        'The selected file name could not be retained. Choose it again.',
      );
    }
    var p = pending;
    if (p.intent['stage'] != 'captured') {
      p = await _commands.replaceExclusive(p, {
        ...p.intent,
        'stage': 'captured',
        'source_path': source.path,
        'filename': filename,
      });
      _pending = p;
    }
    final maxBytes = p.intent['max_bytes'];
    if (maxBytes is! int ||
        maxBytes <= 0 ||
        maxBytes > PublicMediaUpload.videoLimitBytes)
      throw _unavailable();
    final from = File(source.path);
    final size = await from.length();
    if (size <= 0 || size > maxBytes) {
      _pending = await _commands.replaceExclusive(p, {
        ...p.intent,
        'stage': 'unavailable',
      });
      throw _unavailable(
        'The selected file exceeds this upload limit. Discard the selection and choose a smaller file.',
      );
    }
    final target = await _file(p);
    await target.parent.create(recursive: true);
    final partial = File('${target.path}.partial');
    var copied = 0;
    try {
      await from
          .openRead()
          .transform(
            StreamTransformer<List<int>, List<int>>.fromHandlers(
              handleData: (data, sink) {
                copied += data.length;
                if (copied > maxBytes) {
                  sink.addError(_unavailable());
                  return;
                }
                sink.add(data);
              },
            ),
          )
          .pipe(partial.openWrite());
      if (copied != size) throw _unavailable();
      await partial.rename(target.path);
      final digest = await sha256.bind(target.openRead()).first;
      final intent = {
        ...p.intent,
        'stage': 'selected',
        'size': size,
        'sha256': digest.toString(),
      }..remove('source_path');
      _pending = await _commands.replaceExclusive(p, intent);
    } catch (_) {
      if (await partial.exists()) await partial.delete();
      rethrow;
    }
  }

  Future<XFile?> pick({
    required String purpose,
    required String kind,
    required int maxBytes,
    required Future<XFile?> Function() pick,
    bool imagePickerSource = true,
    JsonMap draft = const {},
  }) async {
    final c = _capture();
    final capturedDraft = SecurityCommandStore.captureIntent(draft);
    await initialize();
    _check(c);
    if (_error != null || busy || _pending != null) throw _unavailable(_error);
    if (!RegExp(r'^[a-z0-9][a-z0-9:._-]{1,190}$').hasMatch(purpose) ||
        !['image', 'video', 'model'].contains(kind) ||
        maxBytes <= 0 ||
        maxBytes > PublicMediaUpload.videoLimitBytes)
      throw _unavailable();
    _picking = true;
    _changed();
    PendingSecurityCommand? armed;
    try {
      armed = await _commands.serialized(() async {
        final p = await _commands.prepareExclusive(c, _command, {
          'purpose': purpose,
          'kind': kind,
          'os_provider': imagePickerSource && kind != 'model'
              ? 'image_picker'
              : 'files',
          'max_bytes': maxBytes,
          'draft': capturedDraft,
          'stage': 'picking',
        }, check: () => _check(c));
        _pending = p;
        return p;
      });
      final selected = await pick();
      await _commands.serialized(() async {
        if (selected == null) {
          await _commands.completeExclusive(armed!);
          _pending = null;
        } else {
          await _retain(selected, armed!);
        }
      });
      if (selected == null || !_current(c)) return null;
      _deliveredVersion = c.version;
      return XFile((await _file(_pending!)).path);
    } catch (_) {
      if (armed != null && _pending?.intent['stage'] == 'picking') {
        await _commands.serialized(() async {
          await _commands.completeExclusive(armed!);
          _pending = null;
        });
      } else if (armed == null) {
        try {
          _pending = await _commands.readExclusive(_command);
        } catch (_) {
          _error =
              'Saved file selection could not be read. Retry recovery before choosing another file.';
        }
      }
      rethrow;
    } finally {
      _picking = false;
      _changed();
    }
  }

  Future<XFile> recover(String purpose) async {
    final c = _capture();
    await initialize();
    _check(c);
    final p = _pending;
    if (!canRecover || p == null || p.intent['purpose'] != purpose)
      throw _unavailable();
    final file = await _file(p);
    final size = await file.length();
    final digest = await sha256.bind(file.openRead()).first;
    _check(c);
    if (size != p.intent['size'] || digest.toString() != p.intent['sha256']) {
      throw _unavailable(
        'The saved file is missing or changed. Discard it and choose the original file again.',
      );
    }
    _deliveredVersion = c.version;
    return XFile(file.path);
  }

  String? keyForFile(XFile file) {
    if (!belongsToCurrentOwner || _context()?.version != _deliveredVersion)
      throw _unavailable();
    final p = _pending;
    if (p == null ||
        _ownedRootPath == null ||
        file.path != '$_ownedRootPath/${p.key}/${p.intent['filename']}' ||
        file.name != p.intent['filename'])
      throw _unavailable();
    return p.key;
  }

  ApiRequestOptions optionsForFile(XFile file) => ApiRequestOptions(
    storeId: _capture().storeId,
    expectedContextVersion: _deliveredVersion,
    idempotencyKey: 'native-media-upload-${keyForFile(file)}',
    maxRetries: 0,
  );
  String? operationKeyForFile(XFile file, String operation) {
    final localKey = keyForFile(file),
        draft = asJsonMap(_pending?.intent['draft']);
    final original = draft['operation_key'];
    if (original == null) return localKey;
    if (draft['operation'] != operation ||
        original is! String ||
        !RegExp(r'^[a-zA-Z0-9-]{8,200}$').hasMatch(original)) {
      throw _unavailable('The original upload request could not be confirmed.');
    }
    return original;
  }

  String? claimUpload(XFile file) {
    final key = keyForFile(file);
    if (busy)
      throw _unavailable(
        'This file is already being uploaded. Review its result first.',
      );
    _uploadKey = key;
    _changed();
    return key;
  }

  void releaseUpload(String? key) {
    if (key != null && _uploadKey == key) {
      _uploadKey = null;
      _changed();
    }
  }

  JsonMap draftForFile(XFile file) {
    keyForFile(file);
    return asJsonMap(_pending?.intent['input'] ?? _pending?.intent['draft']);
  }

  Future<void> bindInput(XFile file, JsonMap input) async {
    final c = _capture(), key = keyForFile(file);
    final captured = SecurityCommandStore.captureIntent(input);
    await _commands.serialized(() async {
      _check(c);
      final p = _pending!;
      if (p.key != key) throw _unavailable();
      final originalType = asJsonMap(p.intent['draft'])['document_type'];
      if (originalType != null && captured['document_type'] != originalType) {
        throw _unavailable(
          'Return to the original verification document type.',
        );
      }
      if (p.intent['input'] != null &&
          jsonEncode(
                SecurityCommandStore.captureIntent(
                  asJsonMap(p.intent['input']),
                ),
              ) !=
              jsonEncode(captured)) {
        throw _unavailable(
          'Recover the original file details before changing this request.',
        );
      }
      _pending = await _commands.replaceExclusive(p, {
        ...p.intent,
        'input': captured,
      });
      _check(c);
    });
  }

  Future<void> completeKey(String? key) async {
    if (key == null || !belongsToCurrentOwner || _pending?.key != key) return;
    releaseUpload(key);
    await discard();
  }

  Future<void> completeOperation(String? key, String operation) async {
    if (key == null || !belongsToCurrentOwner) return;
    final p = _pending!;
    final draft = asJsonMap(p.intent['draft']);
    final sameFamily = operation == 'kyc-upload'
        ? (purpose?.startsWith('private-kyc-') ?? false)
        : operation == 'media-upload' &&
              (purpose == 'original-media-upload' ||
                  (purpose?.startsWith('public-media-') ?? false) ||
                  (purpose?.startsWith('product-image') ?? false));
    if (sameFamily &&
        (p.key == key ||
            draft['operation'] == operation && draft['operation_key'] == key)) {
      await completeKey(p.key);
    }
  }

  Future<void> discard() async {
    final c = _capture();
    if (busy ||
        (_pending?.intent['unclaimed'] != true && !belongsToCurrentOwner))
      throw _unavailable();
    await _commands.serialized(() async {
      _check(c);
      final p = _pending;
      if (p == null) return;
      // Only our UUID-named private copy is removed; never OS Photos/cache inputs.
      File? owned;
      if (p.intent['filename'] != null) owned = await _file(p);
      _check(c);
      await _commands.completeExclusive(p);
      _pending = null;
      if (owned != null && await owned.exists()) await owned.delete();
      _error = null;
    });
    _changed();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
