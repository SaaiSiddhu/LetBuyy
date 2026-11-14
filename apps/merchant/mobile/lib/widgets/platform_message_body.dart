import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../services/notification_settings_service.dart';

/// Plain text from the existing account inbox. Reading is not legal acceptance.
class PlatformMessageBody extends StatelessWidget {
  const PlatformMessageBody({
    super.key,
    required this.notification,
    required this.onOpen,
  });
  final MerchantNotification notification;
  final ValueChanged<Uri> onOpen;

  @override
  Widget build(BuildContext context) {
    final candidate = Uri.tryParse(notification.actionUrl ?? '');
    final link =
        candidate != null &&
            candidate.scheme == 'https' &&
            candidate.host.isNotEmpty &&
            candidate.userInfo.isEmpty
        ? candidate
        : null;
    final expiry = DateTime.tryParse(
      notification.data['expires_at']?.toString() ?? '',
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SelectableText(notification.message ?? ''),
        const SizedBox(height: 6),
        Text(
          'From LetBuyy · ${notification.data['category']?.toString().replaceAll('_', ' ') ?? 'Platform update'}',
        ),
        if (expiry != null)
          Text(
            '${expiry.isBefore(DateTime.now()) ? 'Expired' : 'Valid until'} · ${DateFormat('dd MMM yyyy, h:mm a').format(expiry.toLocal())}',
          ),
        if (link != null)
          TextButton.icon(
            icon: const Icon(Icons.open_in_new_rounded),
            label: const Text('View details'),
            onPressed: () => onOpen(link),
          ),
      ],
    );
  }
}
