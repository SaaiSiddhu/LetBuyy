// lib/widgets/update_dialog.dart

import 'package:flutter/material.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:url_launcher/url_launcher.dart';

class UpdateDialog extends StatelessWidget {
  final AppUpdateModel update;

  const UpdateDialog({super.key, required this.update});

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: () async => !update.mandatory, // Block close if mandatory update
      child: AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        title: const Text(
          "Update Available",
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        content: Text(
          update.updateMessage.isEmpty
              ? "A newer version of the app is available."
              : update.updateMessage,
          style: const TextStyle(fontSize: 15),
        ),
        actions: [
          if (!update.mandatory)
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text("Later"),
            ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.green,
              minimumSize: const Size(110, 42),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            onPressed: () async {
              final uri = Uri.parse(update.apkUrl);
              if (await canLaunchUrl(uri)) {
                await launchUrl(uri, mode: LaunchMode.externalApplication);
              }
            },
            child: const Text("Update Now"),
          ),
        ],
      ),
    );
  }
}
