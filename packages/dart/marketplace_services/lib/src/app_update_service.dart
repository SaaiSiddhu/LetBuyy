// lib/services/app_update_service.dart

import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';

class AppUpdateService {
  static bool _dialogShown = false; // Prevent duplicate dialogs

  static Future<void> checkForUpdate(BuildContext context) async {
    if (_dialogShown) return; // Avoid multiple popups
    if (!mounted(context)) return;

    try {
      // ❌ Skip update check on Web & iOS
      if (!Platform.isAndroid) {
        print("ℹ️ Update check skipped (Not Android platform)");
        return;
      }

      // Fetch the latest ACTIVE update
      final snapshot = await FirebaseFirestore.instance
          .collection("app_updates")
          .where("isActive", isEqualTo: true)
          .orderBy("versionCode", descending: true)
          .limit(1)
          .get();

      if (snapshot.docs.isEmpty) {
        print("ℹ️ No active updates found.");
        return;
      }

      final data = snapshot.docs.first;
      final update = AppUpdateModel.fromMap(data.id, data.data());

      // Get current version from device
      final info = await PackageInfo.fromPlatform();
      int currentVersionCode = int.tryParse(info.buildNumber) ?? 0;

      print("🔥 Current VersionCode: $currentVersionCode");
      print("🔥 Latest VersionCode: ${update.versionCode}");

      if (update.versionCode > currentVersionCode) {
        if (!mounted(context)) return;

        _dialogShown = true;

        Future.delayed(const Duration(milliseconds: 100), () {
          if (mounted(context)) {
            showDialog(
              context: context,
              barrierDismissible: !update.mandatory,
              barrierColor: Colors.black87,
              builder: (dialogContext) => PopScope(
                canPop: !update.mandatory,
                child: _buildUpdateDialog(dialogContext, update, info.buildNumber),
              ),
            );
          }
        });
      }
    } catch (e) {
      print("❌ Update check failed: $e");
    }
  }

  /// Build the update dialog (inline for services package compatibility)
  static Widget _buildUpdateDialog(BuildContext context, AppUpdateModel update, String currentVersion) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      backgroundColor: Colors.white,
      child: Container(
        width: MediaQuery.of(context).size.width * 0.85,
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Icon
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF1A472A), Color(0xFF2D5A3D)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF1A472A).withValues(alpha: 0.3),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: const Icon(
                Icons.system_update_rounded,
                size: 40,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 20),

            // Title
            Text(
              update.mandatory ? 'Update Required' : 'Update Available',
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 12),

            // Version Info
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.grey[100],
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                'v$currentVersion → v${update.versionCode}',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Colors.grey[700],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Update Message
            Text(
              update.updateMessage.isNotEmpty
                  ? update.updateMessage
                  : 'A new version is available with improvements and bug fixes.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey[600],
                height: 1.5,
              ),
            ),
            const SizedBox(height: 24),

            // Download Button
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: () => launchUpdateUrl(update.apkUrl),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1A472A),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.download_rounded, size: 20),
                    SizedBox(width: 8),
                    Text(
                      'Download & Update',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Skip Button (only for non-mandatory)
            if (!update.mandatory) ...[
              const SizedBox(height: 12),
              TextButton(
                onPressed: () {
                  _dialogShown = false;
                  Navigator.of(context).pop();
                },
                child: Text(
                  'Remind me later',
                  style: TextStyle(
                    color: Colors.grey[600],
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  // ---- OPEN UPDATE URL -----
  static Future<void> launchUpdateUrl(String url) async {
    if (url.isEmpty) {
      print("❌ APK URL is empty");
      return;
    }

    final Uri uri = Uri.parse(url);

    try {
      if (!await canLaunchUrl(uri)) {
        print("❌ Cannot launch update URL");
        return;
      }

      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (e) {
      print("❌ Failed launching update URL: $e");
    }
  }

  // Check if widget is still in tree
  static bool mounted(BuildContext context) {
    return context.mounted;
  }
}
