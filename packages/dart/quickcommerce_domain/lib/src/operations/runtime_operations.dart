import '../common/value_objects.dart';
import '../entities/entities.dart';

enum StoreLoadState { normal, elevated, overloaded, paused }

enum OperationalDegradation {
  none,
  redisDegraded,
  dispatchBacklog,
  storeOverload,
  paymentProviderOutage,
  notificationFailures,
}

final class StoreQueueItem {
  const StoreQueueItem({
    required this.orderId,
    required this.storeId,
    required this.status,
    required this.createdAt,
    required this.promisedReadyAt,
    required this.itemCount,
    required this.version,
    this.assignedRiderId,
  });

  final EntityId orderId;
  final EntityId storeId;
  final OrderStatus status;
  final DateTime createdAt;
  final DateTime promisedReadyAt;
  final int itemCount;
  final int version;
  final EntityId? assignedRiderId;

  Duration slaRemaining(DateTime now) => promisedReadyAt.difference(now);
}

final class OperationalMetric {
  const OperationalMetric({
    required this.name,
    required this.value,
    required this.unit,
    required this.observedAt,
  });

  final String name;
  final num value;
  final String unit;
  final DateTime observedAt;
}

final class StoreLoadPolicy {
  const StoreLoadPolicy({
    this.elevatedQueueDepth = 12,
    this.overloadedQueueDepth = 24,
    this.pausedQueueDepth = 40,
  });

  final int elevatedQueueDepth;
  final int overloadedQueueDepth;
  final int pausedQueueDepth;

  StoreLoadState classify({
    required int queueDepth,
    required int delayedOrders,
    required bool manuallyPaused,
  }) {
    if (manuallyPaused || queueDepth >= pausedQueueDepth) {
      return StoreLoadState.paused;
    }
    if (queueDepth >= overloadedQueueDepth || delayedOrders >= 6) {
      return StoreLoadState.overloaded;
    }
    if (queueDepth >= elevatedQueueDepth || delayedOrders >= 2) {
      return StoreLoadState.elevated;
    }
    return StoreLoadState.normal;
  }
}

final class SlaPolicy {
  const SlaPolicy();

  int priorityScore(StoreQueueItem item, DateTime now) {
    final remainingSeconds = item.slaRemaining(now).inSeconds;
    final urgency = remainingSeconds <= 0 ? 1000 : 3600 - remainingSeconds;
    final statusBoost = switch (item.status) {
      OrderStatus.confirmed => 30,
      OrderStatus.picking => 60,
      OrderStatus.packing => 80,
      OrderStatus.readyForPickup => 100,
      _ => 0,
    };
    return urgency + statusBoost + item.itemCount;
  }
}

final class PresencePolicy {
  const PresencePolicy();

  static const staleAfter = Duration(seconds: 45);
  static const locationTtl = Duration(seconds: 60);
  static const assignmentOfferTtl = Duration(seconds: 30);

  Duration heartbeatInterval({
    required RiderStatus status,
    required bool assignmentOfferActive,
    required bool lowBattery,
  }) {
    if (status == RiderStatus.offline || status == RiderStatus.blocked) {
      return const Duration(days: 365);
    }
    if (assignmentOfferActive) {
      return const Duration(seconds: 10);
    }
    if (status == RiderStatus.onTrip) {
      return lowBattery
          ? const Duration(seconds: 10)
          : const Duration(seconds: 4);
    }
    if (status == RiderStatus.available || status == RiderStatus.assigned) {
      return lowBattery
          ? const Duration(seconds: 30)
          : const Duration(seconds: 15);
    }
    return const Duration(seconds: 45);
  }

  bool shouldRejectOffer({
    required DateTime now,
    required DateTime expiresAt,
    required int expectedVersion,
    required int currentVersion,
  }) {
    return !expiresAt.isAfter(now) || expectedVersion < currentVersion;
  }
}

final class DegradedModeDecision {
  const DegradedModeDecision({
    required this.degradation,
    required this.allowAutomation,
    required this.allowLiveOverlays,
    required this.reason,
  });

  final OperationalDegradation degradation;
  final bool allowAutomation;
  final bool allowLiveOverlays;
  final String reason;
}

final class DegradedModePolicy {
  const DegradedModePolicy();

  DegradedModeDecision evaluate({
    required bool redisHealthy,
    required int dispatchBacklog,
    required StoreLoadState worstStoreLoad,
    required bool paymentProviderHealthy,
    required bool notificationProviderHealthy,
  }) {
    if (!redisHealthy) {
      return const DegradedModeDecision(
        degradation: OperationalDegradation.redisDegraded,
        allowAutomation: false,
        allowLiveOverlays: false,
        reason: 'redis_unhealthy',
      );
    }
    if (!paymentProviderHealthy) {
      return const DegradedModeDecision(
        degradation: OperationalDegradation.paymentProviderOutage,
        allowAutomation: true,
        allowLiveOverlays: true,
        reason: 'payment_provider_unhealthy',
      );
    }
    if (worstStoreLoad == StoreLoadState.paused ||
        worstStoreLoad == StoreLoadState.overloaded) {
      return const DegradedModeDecision(
        degradation: OperationalDegradation.storeOverload,
        allowAutomation: true,
        allowLiveOverlays: true,
        reason: 'store_overload',
      );
    }
    if (dispatchBacklog >= 50) {
      return const DegradedModeDecision(
        degradation: OperationalDegradation.dispatchBacklog,
        allowAutomation: true,
        allowLiveOverlays: true,
        reason: 'dispatch_backlog',
      );
    }
    if (!notificationProviderHealthy) {
      return const DegradedModeDecision(
        degradation: OperationalDegradation.notificationFailures,
        allowAutomation: true,
        allowLiveOverlays: true,
        reason: 'notification_provider_unhealthy',
      );
    }
    return const DegradedModeDecision(
      degradation: OperationalDegradation.none,
      allowAutomation: true,
      allowLiveOverlays: true,
      reason: 'healthy',
    );
  }
}

final class RunbookAction {
  const RunbookAction({
    required this.code,
    required this.label,
    required this.requiresAdmin,
  });

  final String code;
  final String label;
  final bool requiresAdmin;
}

final class RunbookPolicy {
  const RunbookPolicy();

  List<RunbookAction> actionsFor(OperationalDegradation degradation) {
    return switch (degradation) {
      OperationalDegradation.redisDegraded => const [
          RunbookAction(
            code: 'disable_live_overlays',
            label: 'Disable non-critical live overlays',
            requiresAdmin: true,
          ),
          RunbookAction(
            code: 'fallback_durable_delivery',
            label: 'Fall back to durable delivery states',
            requiresAdmin: false,
          ),
          RunbookAction(
            code: 'pause_dispatch_automation',
            label: 'Pause dispatch automation if freshness is unsafe',
            requiresAdmin: true,
          ),
        ],
      OperationalDegradation.dispatchBacklog => const [
          RunbookAction(
            code: 'inspect_queue_depth',
            label: 'Inspect city and store queue depth',
            requiresAdmin: false,
          ),
          RunbookAction(
            code: 'expand_assignment_radius',
            label: 'Increase assignment radius within policy',
            requiresAdmin: true,
          ),
          RunbookAction(
            code: 'enable_manual_dispatch',
            label: 'Enable manual dispatch control',
            requiresAdmin: true,
          ),
        ],
      OperationalDegradation.storeOverload => const [
          RunbookAction(
            code: 'throttle_store',
            label: 'Set store throttle or pause new orders',
            requiresAdmin: true,
          ),
          RunbookAction(
            code: 'prioritize_sla_queue',
            label: 'Prioritize SLA-breaching pick queue',
            requiresAdmin: false,
          ),
          RunbookAction(
            code: 'rebalance_serviceability',
            label: 'Rebalance serviceability to adjacent stores',
            requiresAdmin: true,
          ),
        ],
      OperationalDegradation.paymentProviderOutage => const [
          RunbookAction(
            code: 'pause_payment_retries',
            label: 'Pause risky payment retries',
            requiresAdmin: true,
          ),
          RunbookAction(
            code: 'monitor_pending_intents',
            label: 'Monitor pending payment intents',
            requiresAdmin: false,
          ),
        ],
      OperationalDegradation.notificationFailures => const [
          RunbookAction(
            code: 'inspect_notification_dlq',
            label: 'Inspect notification retry and DLQ counts',
            requiresAdmin: false,
          ),
          RunbookAction(
            code: 'pause_campaigns',
            label: 'Pause campaigns if transactional messaging is affected',
            requiresAdmin: true,
          ),
        ],
      OperationalDegradation.none => const [],
    };
  }
}
