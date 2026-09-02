import '../common/failures.dart';
import '../common/pagination.dart';
import '../common/result.dart';
import '../common/value_objects.dart';
import '../entities/entities.dart';
import '../api/contracts.dart';

final class UpdateProfileCommand {
  const UpdateProfileCommand({required this.fullName, this.avatarUrl});

  final String fullName;
  final Uri? avatarUrl;
}

final class SaveAddressCommand {
  const SaveAddressCommand({
    required this.label,
    required this.line1,
    required this.city,
    required this.state,
    required this.postalCode,
    required this.location,
    this.line2,
  });

  final String label;
  final String line1;
  final String? line2;
  final String city;
  final String state;
  final String postalCode;
  final GeoPoint location;
}

final class HomeFeedQuery {
  const HomeFeedQuery({required this.storeId});

  final EntityId storeId;
}

final class ProductSearchQuery {
  const ProductSearchQuery({
    required this.storeId,
    required this.query,
    this.cursor = const PageCursor(),
  });

  final EntityId storeId;
  final String query;
  final PageCursor cursor;
}

final class ProductAvailabilityPatch {
  const ProductAvailabilityPatch({
    required this.storeId,
    required this.variantId,
    required this.availableQuantity,
    required this.version,
  });

  final EntityId storeId;
  final EntityId variantId;
  final int availableQuantity;
  final int version;
}

final class InventoryQuery {
  const InventoryQuery(
      {required this.storeId, this.cursor = const PageCursor()});

  final EntityId storeId;
  final PageCursor cursor;
}

final class AdjustInventoryCommand {
  const AdjustInventoryCommand({
    required this.metadata,
    required this.storeId,
    required this.variantId,
    required this.delta,
    required this.reason,
  });

  final CommandMetadata metadata;
  final EntityId storeId;
  final EntityId variantId;
  final int delta;
  final String reason;
}

final class InventoryAdjustmentResult {
  const InventoryAdjustmentResult({
    required this.snapshot,
    required this.movementId,
  });

  final InventorySnapshot snapshot;
  final EntityId movementId;
}

final class InventoryPatch {
  const InventoryPatch({required this.snapshot});

  final InventorySnapshot snapshot;
}

final class UpdateCartItemCommand {
  const UpdateCartItemCommand({
    required this.metadata,
    required this.cartId,
    required this.variantId,
    required this.quantity,
  });

  final CommandMetadata metadata;
  final EntityId cartId;
  final EntityId variantId;
  final int quantity;
}

final class CreateCheckoutQuoteCommand {
  CreateCheckoutQuoteCommand({
    required this.metadata,
    required this.cartId,
    required this.addressId,
    required List<String> couponCodes,
    required this.walletAmount,
  }) : couponCodes = List.unmodifiable(couponCodes);

  final CommandMetadata metadata;
  final EntityId cartId;
  final EntityId addressId;
  final List<String> couponCodes;
  final Money walletAmount;
}

final class CreatePaymentIntentCommand {
  const CreatePaymentIntentCommand({
    required this.metadata,
    required this.quoteId,
    required this.provider,
  });

  final CommandMetadata metadata;
  final EntityId quoteId;
  final String provider;
}

final class ConfirmPaymentReturnCommand {
  const ConfirmPaymentReturnCommand({
    required this.metadata,
    required this.paymentIntentId,
    required this.providerReference,
  });

  final CommandMetadata metadata;
  final EntityId paymentIntentId;
  final String providerReference;
}

final class OrderQuery {
  const OrderQuery({this.cursor = const PageCursor()});

  final PageCursor cursor;
}

final class OrderPatch {
  const OrderPatch({
    required this.orderId,
    required this.status,
    required this.version,
  });

  final EntityId orderId;
  final OrderStatus status;
  final int version;
}

final class CancelOrderCommand {
  const CancelOrderCommand({
    required this.metadata,
    required this.orderId,
    required this.reason,
    required this.expectedVersion,
  });

  final CommandMetadata metadata;
  final EntityId orderId;
  final String reason;
  final int expectedVersion;
}

final class RequestReturnCommand {
  const RequestReturnCommand({
    required this.metadata,
    required this.orderId,
    required this.reason,
  });

  final CommandMetadata metadata;
  final EntityId orderId;
  final String reason;
}

final class OrderCommandResult {
  const OrderCommandResult({required this.order});

  final Order order;
}

final class SetAvailabilityCommand {
  const SetAvailabilityCommand({
    required this.metadata,
    required this.status,
    required this.location,
  });

  final CommandMetadata metadata;
  final RiderStatus status;
  final GeoPoint location;
}

final class RiderHeartbeatCommand {
  const RiderHeartbeatCommand({
    required this.traceId,
    required this.location,
    required this.status,
    this.activeDeliveryId,
    this.batteryPercent,
  });

  final TraceId traceId;
  final GeoPoint location;
  final RiderStatus status;
  final EntityId? activeDeliveryId;
  final int? batteryPercent;
}

final class RiderEarningsQuery {
  const RiderEarningsQuery({this.period = 'today'});

  final String period;
}

final class AcceptAssignmentCommand {
  const AcceptAssignmentCommand({
    required this.metadata,
    required this.offerId,
    required this.deliveryId,
  });

  final CommandMetadata metadata;
  final EntityId offerId;
  final EntityId deliveryId;
}

final class RejectAssignmentCommand {
  const RejectAssignmentCommand({
    required this.metadata,
    required this.offerId,
    required this.deliveryId,
    required this.reason,
  });

  final CommandMetadata metadata;
  final EntityId offerId;
  final EntityId deliveryId;
  final String reason;
}

final class DeliveryTransitionCommand {
  const DeliveryTransitionCommand({
    required this.metadata,
    required this.deliveryId,
    required this.targetStatus,
    required this.expectedVersion,
  });

  final CommandMetadata metadata;
  final EntityId deliveryId;
  final DeliveryStatus targetStatus;
  final int expectedVersion;
}

final class CreateProofUploadCommand {
  const CreateProofUploadCommand({
    required this.metadata,
    required this.deliveryId,
    this.contentType = 'image/jpeg',
  });

  final CommandMetadata metadata;
  final EntityId deliveryId;
  final String contentType;
}

final class WalletLedgerQuery {
  const WalletLedgerQuery({this.cursor = const PageCursor()});

  final PageCursor cursor;
}

final class CouponEligibilityQuery {
  const CouponEligibilityQuery({required this.storeId, required this.cartId});

  final EntityId storeId;
  final EntityId cartId;
}

final class ValidateCouponCommand {
  const ValidateCouponCommand({
    required this.metadata,
    required this.cartId,
    required this.code,
  });

  final CommandMetadata metadata;
  final EntityId cartId;
  final String code;
}

final class NotificationQuery {
  const NotificationQuery({this.cursor = const PageCursor()});

  final PageCursor cursor;
}

final class RegisterDeviceCommand {
  const RegisterDeviceCommand({
    required this.metadata,
    required this.platform,
    required this.pushToken,
    required this.deviceFingerprint,
    required this.appVersion,
  });

  final CommandMetadata metadata;
  final String platform;
  final String pushToken;
  final String deviceFingerprint;
  final String appVersion;
}

final class OperationsQuery {
  const OperationsQuery({required this.cityId, this.storeId});

  final EntityId cityId;
  final EntityId? storeId;
}

final class OperationsSubscription {
  const OperationsSubscription({required this.cityId, this.storeId});

  final EntityId cityId;
  final EntityId? storeId;
}

final class OperationsPatch {
  const OperationsPatch({required this.summary});

  final OperationsSummary summary;
}

final class AuditLogQuery {
  const AuditLogQuery({this.cursor = const PageCursor(), this.entityId});

  final PageCursor cursor;
  final EntityId? entityId;
}

final class ManualOverrideCommand {
  const ManualOverrideCommand({
    required this.metadata,
    required this.entityType,
    required this.entityId,
    required this.action,
    required this.reason,
    required this.expectedVersion,
  });

  final CommandMetadata metadata;
  final String entityType;
  final EntityId entityId;
  final String action;
  final String reason;
  final int expectedVersion;
}

final class ManualOverrideResult {
  const ManualOverrideResult({required this.auditLogId});

  final EntityId auditLogId;
}

abstract interface class AuthRepository {
  Future<Result<void, AppFailure>> requestPhoneOtp({
    required String phone,
    required TraceId traceId,
  });

  Future<Result<AuthSession, AppFailure>> signInWithPhoneOtp({
    required String phone,
    required String otp,
    required TraceId traceId,
  });

  Future<Result<AuthSession, AppFailure>> refreshSession();

  Future<Result<void, AppFailure>> signOut();

  Stream<AuthSession?> watchSession();
}

abstract interface class ProfileRepository {
  Future<Result<UserProfile, AppFailure>> getProfile();
  Future<Result<UserProfile, AppFailure>> updateProfile(
      UpdateProfileCommand command);
}

abstract interface class AddressRepository {
  Future<Result<List<Address>, AppFailure>> listAddresses();
  Future<Result<Address, AppFailure>> saveAddress(SaveAddressCommand command);
  Future<Result<void, AppFailure>> setDefaultAddress(EntityId addressId);
  Future<Result<ServiceabilityResult, AppFailure>> checkServiceability(
      GeoPoint location);
}

abstract interface class StoreRepository {
  Future<Result<DarkStore, AppFailure>> selectBestStore(GeoPoint location);
  Future<Result<StoreAvailability, AppFailure>> getAvailability(
      EntityId storeId);
  Stream<StoreAvailability> watchAvailability(EntityId storeId);
}

abstract interface class CatalogRepository {
  Future<Result<List<Category>, AppFailure>> getCategoryTree();
  Future<Result<HomeFeed, AppFailure>> getHomeFeed(HomeFeedQuery query);
  Future<Result<Product, AppFailure>> getProduct(
      EntityId productId, EntityId storeId);
  Future<Result<ProductSearchResult, AppFailure>> searchProducts(
      ProductSearchQuery query);
  Stream<ProductAvailabilityPatch> watchAvailability(EntityId storeId);
}

abstract interface class InventoryRepository {
  Future<Result<List<InventorySnapshot>, AppFailure>> getStoreInventory(
      InventoryQuery query);
  Future<Result<InventoryAdjustmentResult, AppFailure>> adjustInventory(
      AdjustInventoryCommand command);
  Stream<InventoryPatch> watchStoreInventory(EntityId storeId);
}

abstract interface class CartRepository {
  Future<Result<Cart, AppFailure>> getActiveCart();
  Future<Result<Cart, AppFailure>> updateItem(UpdateCartItemCommand command);
  Future<Result<void, AppFailure>> clearCart(EntityId cartId);
  Stream<Cart> watchCart();
}

abstract interface class CheckoutRepository {
  Future<Result<CheckoutQuote, AppFailure>> createQuote(
      CreateCheckoutQuoteCommand command);
  Future<Result<PaymentIntent, AppFailure>> createPaymentIntent(
      CreatePaymentIntentCommand command);
  Future<Result<Order, AppFailure>> confirmClientReturnFromPayment(
      ConfirmPaymentReturnCommand command);
}

abstract interface class OrderRepository {
  Future<Result<Paginated<Order>, AppFailure>> listOrders(OrderQuery query);
  Future<Result<OrderDetails, AppFailure>> getOrder(EntityId orderId);
  Stream<OrderPatch> watchActiveOrders();
  Future<Result<OrderCommandResult, AppFailure>> cancelOrder(
      CancelOrderCommand command);
  Future<Result<OrderCommandResult, AppFailure>> requestReturn(
      RequestReturnCommand command);
}

abstract interface class RiderRepository {
  Future<Result<RiderProfile, AppFailure>> getProfile();
  Future<Result<RiderEarningsSummary, AppFailure>> getEarnings(
      RiderEarningsQuery query);
  Future<Result<void, AppFailure>> setAvailability(
      SetAvailabilityCommand command);
  Future<Result<void, AppFailure>> sendHeartbeat(RiderHeartbeatCommand command);
  Stream<RiderAssignmentOffer> watchAssignmentOffers();
}

abstract interface class DeliveryRepository {
  Future<Result<Delivery, AppFailure>> getActiveDelivery();
  Future<Result<Delivery, AppFailure>> acceptAssignment(
      AcceptAssignmentCommand command);
  Future<Result<Delivery, AppFailure>> rejectAssignment(
      RejectAssignmentCommand command);
  Future<Result<Delivery, AppFailure>> transitionDelivery(
      DeliveryTransitionCommand command);
  Future<Result<ProofUploadIntent, AppFailure>> createProofUpload(
      CreateProofUploadCommand command);
  Stream<LiveDeliveryState> watchLiveDelivery(EntityId deliveryId);
}

abstract interface class WalletRepository {
  Future<Result<WalletAccount, AppFailure>> getWallet();
  Future<Result<Paginated<LedgerEntry>, AppFailure>> listLedger(
      WalletLedgerQuery query);
}

abstract interface class CouponRepository {
  Future<Result<List<Coupon>, AppFailure>> listEligibleCoupons(
      CouponEligibilityQuery query);
  Future<Result<CouponValidationResult, AppFailure>> validateCoupon(
      ValidateCouponCommand command);
}

abstract interface class NotificationRepository {
  Future<Result<Paginated<AppNotification>, AppFailure>> listNotifications(
      NotificationQuery query);
  Future<Result<void, AppFailure>> markRead(EntityId notificationId);
  Stream<AppNotification> watchNewNotifications();
  Future<Result<void, AppFailure>> registerDevice(
      RegisterDeviceCommand command);
}

abstract interface class OperationsRepository {
  Future<Result<OperationsSummary, AppFailure>> getSummary(
      OperationsQuery query);
  Stream<OperationsPatch> watchOperations(OperationsSubscription query);
  Future<Result<Paginated<AuditLogEntry>, AppFailure>> listAuditLogs(
      AuditLogQuery query);
  Future<Result<ManualOverrideResult, AppFailure>> executeManualOverride(
      ManualOverrideCommand command);
}
