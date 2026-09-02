import 'dart:async';

import 'package:agrimore_domain/agrimore_domain.dart';
import 'package:agrimore_observability/agrimore_observability.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rider_app/src/features/assignment/presentation/assignment_controller.dart';
import 'package:rider_app/src/features/delivery/presentation/active_delivery_controller.dart';
import 'package:rider_app/src/features/earnings/presentation/earnings_controller.dart';
import 'package:rider_app/src/features/shift/presentation/shift_controller.dart';

void main() {
  test('offer to accept to pickup to deliver transitions validly', () async {
    final ids = _Ids();
    final riderRepository = _FakeRiderRepository(ids);
    final deliveryRepository = _FakeDeliveryRepository(ids);
    final traceFactory = TraceFactory();

    final shift = ShiftController(
      repository: riderRepository,
      traceFactory: traceFactory,
      presencePolicy: const PresencePolicy(),
    );
    await shift.loadProfile();
    await shift.goOnline(GeoPoint(latitude: 12.9716, longitude: 77.5946));

    expect(shift.state.status, RiderStatus.available);
    expect(riderRepository.heartbeatCount, greaterThanOrEqualTo(0));

    final assignment = AssignmentController(
      riderRepository: riderRepository,
      deliveryRepository: deliveryRepository,
      traceFactory: traceFactory,
      presencePolicy: const PresencePolicy(),
    );
    riderRepository.emitOffer();
    await Future<void>.delayed(Duration.zero);

    expect(assignment.state.offer?.deliveryId, ids.deliveryId);

    await assignment.accept();
    expect(assignment.state.acceptedDelivery?.status, DeliveryStatus.accepted);

    final active = ActiveDeliveryController(
      repository: deliveryRepository,
      traceFactory: traceFactory,
    );
    await active.load();
    await active.transition(DeliveryStatus.arrivingAtStore);
    await active.transition(DeliveryStatus.pickedUp);
    await active.transition(DeliveryStatus.arrivingAtCustomer);
    await active.requestProofUpload();
    await active.transition(DeliveryStatus.delivered);

    expect(active.state.delivery?.status, DeliveryStatus.delivered);
    expect(active.state.proofUpload?.key, 'proofs/${ids.deliveryId.value}.jpg');

    final earnings = EarningsController(repository: riderRepository);
    await earnings.load(period: 'today');

    expect(earnings.state.summary?.totalOrders, 1);

    assignment.dispose();
    active.dispose();
    shift.dispose();
  });
}

final class _Ids {
  final riderId = EntityId('00000000-0000-4000-8000-000000000601');
  final cityId = EntityId('00000000-0000-4000-8000-000000000602');
  final storeId = EntityId('00000000-0000-4000-8000-000000000603');
  final deliveryId = EntityId('00000000-0000-4000-8000-000000000604');
  final orderId = EntityId('00000000-0000-4000-8000-000000000605');
  final offerId = EntityId('00000000-0000-4000-8000-000000000606');
}

final class _FakeRiderRepository implements RiderRepository {
  _FakeRiderRepository(this.ids);

  final _Ids ids;
  final _offers = StreamController<RiderAssignmentOffer>.broadcast();
  int heartbeatCount = 0;
  RiderStatus status = RiderStatus.offline;

  void emitOffer() {
    _offers.add(
      RiderAssignmentOffer(
        offerId: ids.offerId,
        deliveryId: ids.deliveryId,
        expiresAt: DateTime.now().add(const Duration(seconds: 45)),
      ),
    );
  }

  @override
  Future<Result<RiderProfile, AppFailure>> getProfile() async {
    return Ok(
      RiderProfile(
        userId: ids.riderId,
        cityId: ids.cityId,
        vehicleType: 'bike',
        status: status,
        isVerified: true,
      ),
    );
  }

  @override
  Future<Result<RiderEarningsSummary, AppFailure>> getEarnings(
    RiderEarningsQuery query,
  ) async {
    return Ok(
      RiderEarningsSummary(
        period: query.period,
        totalEarnings: const Money(paise: 4500),
        totalOrders: 1,
        totalDistanceMeters: 1800,
        deliveries: [
          RiderEarningLine(
            deliveryId: ids.deliveryId,
            orderId: ids.orderId,
            amount: const Money(paise: 4500),
            deliveredAt: DateTime.utc(2026, 6, 1, 8),
            distanceMeters: 1800,
          ),
        ],
      ),
    );
  }

  @override
  Future<Result<void, AppFailure>> sendHeartbeat(
    RiderHeartbeatCommand command,
  ) async {
    heartbeatCount += 1;
    return const Ok(null);
  }

  @override
  Future<Result<void, AppFailure>> setAvailability(
    SetAvailabilityCommand command,
  ) async {
    status = command.status;
    return const Ok(null);
  }

  @override
  Stream<RiderAssignmentOffer> watchAssignmentOffers() => _offers.stream;
}

final class _FakeDeliveryRepository implements DeliveryRepository {
  _FakeDeliveryRepository(this.ids) {
    _delivery = _deliveryWith(DeliveryStatus.accepted, version: 1);
  }

  final _Ids ids;
  final _live = StreamController<LiveDeliveryState>.broadcast();
  late Delivery _delivery;

  @override
  Future<Result<Delivery, AppFailure>> acceptAssignment(
    AcceptAssignmentCommand command,
  ) async {
    _delivery = _deliveryWith(DeliveryStatus.accepted, version: 1);
    return Ok(_delivery);
  }

  @override
  Future<Result<ProofUploadIntent, AppFailure>> createProofUpload(
    CreateProofUploadCommand command,
  ) async {
    return Ok(
      ProofUploadIntent(
        deliveryId: command.deliveryId,
        key: 'proofs/${command.deliveryId.value}.jpg',
        uploadUrl: Uri.parse('https://media.test/proof.jpg'),
        contentType: command.contentType,
      ),
    );
  }

  @override
  Future<Result<Delivery, AppFailure>> getActiveDelivery() async {
    return Ok(_delivery);
  }

  @override
  Future<Result<Delivery, AppFailure>> rejectAssignment(
    RejectAssignmentCommand command,
  ) async {
    _delivery = _deliveryWith(DeliveryStatus.rejected, version: 1);
    return Ok(_delivery);
  }

  @override
  Future<Result<Delivery, AppFailure>> transitionDelivery(
    DeliveryTransitionCommand command,
  ) async {
    _delivery = _deliveryWith(
      command.targetStatus,
      version: command.expectedVersion + 1,
    );
    return Ok(_delivery);
  }

  @override
  Stream<LiveDeliveryState> watchLiveDelivery(EntityId deliveryId) {
    return _live.stream;
  }

  Delivery _deliveryWith(DeliveryStatus status, {required int version}) {
    return Delivery(
      id: ids.deliveryId,
      orderId: ids.orderId,
      storeId: ids.storeId,
      riderId: ids.riderId,
      status: status,
      pickupLocation: GeoPoint(latitude: 12.97, longitude: 77.59),
      dropLocation: GeoPoint(latitude: 12.98, longitude: 77.6),
      version: version,
    );
  }
}
