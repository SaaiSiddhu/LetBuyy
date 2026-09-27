import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';

// C3 (Firebase SDK removal, 27 September 2026 review continuation): this was a full
// Firestore/Cloud Functions/Storage return-and-exchange service (create/approve/reject/schedule
// pickup/QC/refund/exchange/cancel/appeal, seller and customer streams, image upload). Returns are
// downstream of orders, which have no canonical backend yet either (see OrderProvider's own
// disposition, R1 corrective C2) -- there is no canonical returns capability to rewire onto.
//
// Grepping every real (non-comment) caller across the app found exactly 4 of this service's 25
// public methods still referenced anywhere, all already either unreachable or safely degraded
// before this pass: my_returns_screen.dart's own doc comment already reduced its body to an
// honest "Returns aren't available yet" state (userId hard-coded null, so getCustomerReturns()
// was already never actually invoked); return_request_screen.dart's own doc comment already made
// its submit path an immediate honest failure (getReturnReasons() was still reachable from
// initState, now fixed to match); return_tracking_screen.dart's streamReturnRequest()/
// cancelReturn() have no live in-app navigation trigger to it at all (my_returns_screen.dart's own
// push sits in that same dead branch; grepped every ReturnTrackingScreen( construction) -- kept as
// an honest stub only so its still-registered route doesn't crash if ever reached directly. Kept
// these 4 methods' exact original signatures so none of their callers need to change; all now
// return an honest "nothing here" without ever touching Firebase. The other 21 methods had zero
// callers anywhere and are not preserved even as stubs.
class ReturnService {
  static final ReturnService _instance = ReturnService._internal();
  factory ReturnService() => _instance;
  ReturnService._internal();

  Future<List<ReturnReasonModel>> getReturnReasons() async => const [];

  Stream<List<ReturnRequestModel>> getCustomerReturns(String userId) => Stream.value(const []);

  Stream<ReturnRequestModel?> streamReturnRequest(String returnId) => Stream.value(null);

  Future<void> cancelReturn(String returnId) async {
    throw Exception('Returns aren\'t available yet.');
  }
}
