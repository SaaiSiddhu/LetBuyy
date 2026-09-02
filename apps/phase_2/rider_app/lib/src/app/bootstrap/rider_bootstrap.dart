import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

import '../../core/providers/rider_providers.dart';
import 'rider_environment.dart';

Future<void> bootstrapRider(Widget app) async {
  await runZonedGuarded<Future<void>>(
    () async {
      WidgetsFlutterBinding.ensureInitialized();
      final environment = RiderEnvironment.fromCompileTime();
      FlutterError.onError = (details) {
        FlutterError.presentError(details);
        Sentry.captureException(details.exception, stackTrace: details.stack);
      };
      PlatformDispatcher.instance.onError = (error, stack) {
        Sentry.captureException(error, stackTrace: stack);
        return true;
      };
      if (environment.sentryDsn.isNotEmpty) {
        await SentryFlutter.init(
          (options) {
            options.dsn = environment.sentryDsn;
            options.environment = environment.name;
            options.tracesSampleRate = environment.traceSampleRate;
          },
          appRunner: () => _run(app, environment),
        );
      } else {
        _run(app, environment);
      }
    },
    (error, stack) {
      Sentry.captureException(error, stackTrace: stack);
      debugPrint('rider_zone_error: $error');
    },
  );
}

void _run(Widget app, RiderEnvironment environment) {
  runApp(
    ProviderScope(
      overrides: [riderEnvironmentProvider.overrideWithValue(environment)],
      child: app,
    ),
  );
}
