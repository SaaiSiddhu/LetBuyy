import 'dart:io';

import 'package:dio/dio.dart';
import 'package:dio/io.dart';

/// Test-only DNS isolation. The private fixture supplies a fresh real DNS answer.
/// The HTTPS URI, Host, SNI, default trust roots and certificate verification
/// retain the real BFF hostname. This is never imported by the application.
Dio resolvedStagingVerificationTransport(String ipv4) {
  final address = InternetAddress.tryParse(ipv4);
  if (address == null ||
      address.type != InternetAddressType.IPv4 ||
      address.isLoopback ||
      address.isLinkLocal) {
    throw ArgumentError('A resolved public staging IPv4 address is required.');
  }
  return Dio()
    ..httpClientAdapter = IOHttpClientAdapter(
      createHttpClient: () => HttpClient()
        ..connectionFactory = (uri, proxyHost, proxyPort) async {
          if (uri.scheme != 'https' ||
              uri.host != 'bff-staging.letbuyy.com' ||
              uri.port != 443 ||
              proxyHost != null ||
              proxyPort != null) {
            throw StateError(
              'Only the exact staging BFF transport is admitted.',
            );
          }
          final pending = await Socket.startConnect(address, uri.port);
          Socket? active;
          var cancelled = false;
          final secured = pending.socket.then<Socket>((raw) async {
            active = raw;
            if (cancelled) {
              raw.destroy();
              throw const SocketException('Staging connection cancelled.');
            }
            final socket = await SecureSocket.secure(raw, host: uri.host);
            active = socket;
            if (cancelled) {
              socket.destroy();
              throw const SocketException('Staging connection cancelled.');
            }
            return socket;
          });
          return ConnectionTask.fromSocket(secured, () {
            cancelled = true;
            pending.cancel();
            active?.destroy();
          });
        },
    );
}
