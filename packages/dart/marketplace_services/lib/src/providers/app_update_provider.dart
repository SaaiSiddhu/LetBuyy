import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:letbuyy_marketplace_models/src/app_update_model.dart';

class AppUpdateProvider with ChangeNotifier {
  FirebaseFirestore get _firestore => FirebaseFirestore.instance;
  FirebaseStorage get _storage => FirebaseStorage.instance;

  List<AppUpdateModel> _updates = [];
  List<AppUpdateModel> get updates => _updates;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  Future<void> loadUpdates() async {
    _isLoading = true;
    notifyListeners();

    try {
      final snapshot = await _firestore
          .collection('app_updates')
          .orderBy('versionCode', descending: true)
          .get();

      _updates = snapshot.docs
          .map((doc) => AppUpdateModel.fromMap(doc.id, doc.data()))
          .toList();
    } catch (e) {
      debugPrint('Error loading updates: $e');
    }

    _isLoading = false;
    notifyListeners();
  }

  /// Get updates filtered by app type
  List<AppUpdateModel> getUpdatesForApp(AppType appType) {
    return _updates.where((u) => u.appType == appType).toList();
  }

  /// Get the latest active update for a specific app
  AppUpdateModel? getLatestActiveUpdate(AppType appType) {
    final appUpdates = getUpdatesForApp(appType)
        .where((u) => u.isActive)
        .toList();
    return appUpdates.isEmpty ? null : appUpdates.first;
  }

  Future<void> createUpdate(AppUpdateModel update, {File? apkFile}) async {
    _isLoading = true;
    notifyListeners();

    try {
      String apkUrl = update.apkUrl;

      if (apkFile != null) {
        // Store APK in app-specific folder: apks/{appType}/app-v{versionCode}.apk
        final ref = _storage.ref().child('apks/${update.appType.name}/app-v${update.versionCode}.apk');
        await ref.putFile(apkFile);
        apkUrl = await ref.getDownloadURL();
      }

      await _firestore.collection('app_updates').add({
        ...update.toMap(),
        'apkUrl': apkUrl,
      });

      await loadUpdates();
    } catch (e) {
      debugPrint('Error creating update: $e');
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> updateUpdate(AppUpdateModel update, {File? apkFile}) async {
    _isLoading = true;
    notifyListeners();

    try {
      String apkUrl = update.apkUrl;

      if (apkFile != null) {
        // Store APK in app-specific folder: apks/{appType}/app-v{versionCode}.apk
        final ref = _storage.ref().child('apks/${update.appType.name}/app-v${update.versionCode}.apk');
        await ref.putFile(apkFile);
        apkUrl = await ref.getDownloadURL();
      }

      await _firestore.collection('app_updates').doc(update.id).update({
        ...update.toMap(),
        'apkUrl': apkUrl,
      });

      await loadUpdates();
    } catch (e) {
      debugPrint('Error updating update: $e');
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> deleteUpdate(AppUpdateModel update) async {
    try {
      await _firestore.collection('app_updates').doc(update.id).delete();
      // Delete APK from storage if exists
      if (update.apkUrl.isNotEmpty) {
        try {
          await _storage.refFromURL(update.apkUrl).delete();
        } catch (_) {}
      }
      _updates.removeWhere((u) => u.id == update.id);
      notifyListeners();
    } catch (e) {
      debugPrint('Error deleting update: $e');
      rethrow;
    }
  }

  Future<void> toggleUpdateActive(AppUpdateModel update, bool isActive) async {
    try {
      await _firestore.collection('app_updates').doc(update.id).update({
        'isActive': isActive,
      });
      final index = _updates.indexWhere((u) => u.id == update.id);
      if (index != -1) {
        // Create new instance to trigger listeners
        await loadUpdates(); 
      }
    } catch (e) {
      debugPrint('Error toggling active: $e');
      rethrow;
    }
  }
}