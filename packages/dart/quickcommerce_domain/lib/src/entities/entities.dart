import '../common/value_objects.dart';
import 'contract_enums.dart';

export 'contract_enums.dart';

enum ReservationStatus { active, consumed, released, expired }

enum PaymentIntentStatus { pending, authorized, captured, failed, expired }

enum CouponType { fixedAmount, percentage, freeDelivery, cashback }

enum NotificationStatus { pending, sent, failed, read }

final class AuthSession {
  AuthSession({
    required this.userId,
    required this.accessToken,
    required this.refreshToken,
    required this.expiresAt,
    required List<UserRole> roles,
  }) : roles = List.unmodifiable(roles);

  final EntityId userId;
  final String accessToken;
  final String refreshToken;
  final DateTime expiresAt;
  final List<UserRole> roles;

  bool get isExpired => DateTime.now().isAfter(expiresAt);
  bool hasRole(UserRole role) => roles.contains(role);
}

final class UserProfile {
  const UserProfile({
    required this.id,
    required this.fullName,
    required this.isActive,
    required this.isBlocked,
    this.phone,
    this.email,
    this.avatarUrl,
  });

  final EntityId id;
  final String? phone;
  final String? email;
  final String fullName;
  final Uri? avatarUrl;
  final bool isActive;
  final bool isBlocked;
}

final class Address {
  const Address({
    required this.id,
    required this.userId,
    required this.label,
    required this.line1,
    required this.city,
    required this.state,
    required this.postalCode,
    required this.location,
    required this.isDefault,
    this.line2,
  });

  final EntityId id;
  final EntityId userId;
  final String label;
  final String line1;
  final String? line2;
  final String city;
  final String state;
  final String postalCode;
  final GeoPoint location;
  final bool isDefault;
}

final class ServiceabilityResult {
  const ServiceabilityResult({
    required this.serviceable,
    this.storeId,
    this.etaSeconds,
    this.reasonCode,
  });

  final bool serviceable;
  final EntityId? storeId;
  final int? etaSeconds;
  final String? reasonCode;
}

final class DarkStore {
  const DarkStore({
    required this.id,
    required this.code,
    required this.name,
    required this.cityId,
    required this.location,
    required this.acceptsOrders,
    required this.serviceRadiusMeters,
  });

  final EntityId id;
  final String code;
  final String name;
  final EntityId cityId;
  final GeoPoint location;
  final bool acceptsOrders;
  final int serviceRadiusMeters;
}

final class StoreAvailability {
  const StoreAvailability({
    required this.storeId,
    required this.acceptsOrders,
    required this.queueDepth,
    required this.estimatedSlaSeconds,
  });

  final EntityId storeId;
  final bool acceptsOrders;
  final int queueDepth;
  final int estimatedSlaSeconds;
}

final class Category {
  const Category({
    required this.id,
    required this.name,
    required this.slug,
    required this.sortOrder,
    this.parentId,
    this.iconUrl,
  });

  final EntityId id;
  final EntityId? parentId;
  final String name;
  final String slug;
  final Uri? iconUrl;
  final int sortOrder;
}

final class Brand {
  const Brand({
    required this.id,
    required this.name,
    required this.slug,
    this.logoUrl,
  });

  final EntityId id;
  final String name;
  final String slug;
  final Uri? logoUrl;
}

final class Product {
  Product({
    required this.id,
    required this.categoryId,
    required this.name,
    required this.slug,
    required this.description,
    required List<ProductVariant> variants,
    required List<Uri> media,
    this.brandId,
  })  : variants = List.unmodifiable(variants),
        media = List.unmodifiable(media);

  final EntityId id;
  final EntityId categoryId;
  final EntityId? brandId;
  final String name;
  final String slug;
  final String description;
  final List<ProductVariant> variants;
  final List<Uri> media;
}

final class ProductVariant {
  const ProductVariant({
    required this.id,
    required this.productId,
    required this.sku,
    required this.title,
    required this.unitLabel,
    required this.mrp,
    required this.salePrice,
    required this.inStock,
    this.availableQuantity,
  });

  final EntityId id;
  final EntityId productId;
  final String sku;
  final String title;
  final String unitLabel;
  final Money mrp;
  final Money salePrice;
  final bool inStock;
  final int? availableQuantity;
}

final class SearchFacet {
  const SearchFacet({
    required this.key,
    required this.label,
    required this.count,
  });

  final String key;
  final String label;
  final int count;
}

final class ProductSearchResult {
  ProductSearchResult({
    required List<ProductVariant> items,
    required this.nextCursor,
    required List<SearchFacet> facets,
  })  : items = List.unmodifiable(items),
        facets = List.unmodifiable(facets);

  final List<ProductVariant> items;
  final String? nextCursor;
  final List<SearchFacet> facets;
}

final class HomeFeed {
  HomeFeed({
    required this.storeId,
    required List<Category> categories,
    required List<ProductVariant> featuredVariants,
    required this.generatedAt,
  })  : categories = List.unmodifiable(categories),
        featuredVariants = List.unmodifiable(featuredVariants);

  final EntityId storeId;
  final List<Category> categories;
  final List<ProductVariant> featuredVariants;
  final DateTime generatedAt;
}

final class InventorySnapshot {
  const InventorySnapshot({
    required this.storeId,
    required this.variantId,
    required this.onHand,
    required this.reserved,
    required this.safetyStock,
    required this.version,
  });

  final EntityId storeId;
  final EntityId variantId;
  final int onHand;
  final int reserved;
  final int safetyStock;
  final int version;

  int get available => onHand - reserved - safetyStock;
}

final class InventoryReservationItem {
  const InventoryReservationItem({
    required this.variantId,
    required this.quantity,
  });

  final EntityId variantId;
  final int quantity;
}

final class InventoryReservation {
  InventoryReservation({
    required this.id,
    required this.storeId,
    required this.userId,
    required List<InventoryReservationItem> items,
    required this.status,
    required this.expiresAt,
  }) : items = List.unmodifiable(items);

  final EntityId id;
  final EntityId storeId;
  final EntityId userId;
  final List<InventoryReservationItem> items;
  final ReservationStatus status;
  final DateTime expiresAt;
}

final class Cart {
  Cart({
    required this.id,
    required this.userId,
    required List<CartItem> items,
    required this.updatedAt,
    this.storeId,
  }) : items = List.unmodifiable(items);

  final EntityId id;
  final EntityId userId;
  final EntityId? storeId;
  final List<CartItem> items;
  final DateTime updatedAt;
}

final class CartItem {
  const CartItem({
    required this.variantId,
    required this.quantity,
  });

  final EntityId variantId;
  final int quantity;
}

final class CheckoutQuote {
  CheckoutQuote({
    required this.id,
    required this.storeId,
    required this.reservationId,
    required this.addressId,
    required List<CheckoutQuoteItem> items,
    required this.subtotal,
    required this.discountTotal,
    required this.deliveryFee,
    required this.walletApplied,
    required this.payableTotal,
    required this.etaSeconds,
    required this.expiresAt,
  }) : items = List.unmodifiable(items);

  final EntityId id;
  final EntityId storeId;
  final EntityId reservationId;
  final EntityId addressId;
  final List<CheckoutQuoteItem> items;
  final Money subtotal;
  final Money discountTotal;
  final Money deliveryFee;
  final Money walletApplied;
  final Money payableTotal;
  final int etaSeconds;
  final DateTime expiresAt;

  bool get isExpired => DateTime.now().isAfter(expiresAt);
}

final class CheckoutQuoteItem {
  const CheckoutQuoteItem({
    required this.variantId,
    required this.quantity,
    required this.unitPrice,
    required this.mrp,
    required this.discount,
  });

  final EntityId variantId;
  final int quantity;
  final Money unitPrice;
  final Money mrp;
  final Money discount;
}

final class PaymentIntent {
  const PaymentIntent({
    required this.id,
    required this.quoteId,
    required this.provider,
    required this.providerOrderId,
    required this.amount,
    required this.status,
  });

  final EntityId id;
  final EntityId quoteId;
  final String provider;
  final String providerOrderId;
  final Money amount;
  final PaymentIntentStatus status;
}

final class Order {
  Order({
    required this.id,
    required this.publicOrderNumber,
    required this.userId,
    required this.storeId,
    required this.status,
    required this.paymentStatus,
    required List<OrderItem> items,
    required this.payableTotal,
    required this.createdAt,
    required this.version,
  }) : items = List.unmodifiable(items);

  final EntityId id;
  final String publicOrderNumber;
  final EntityId userId;
  final EntityId storeId;
  final OrderStatus status;
  final PaymentStatus paymentStatus;
  final List<OrderItem> items;
  final Money payableTotal;
  final DateTime createdAt;
  final int version;
}

final class OrderItem {
  const OrderItem({
    required this.variantId,
    required this.title,
    required this.quantity,
    required this.unitPrice,
    required this.mrp,
    required this.discount,
  });

  final EntityId variantId;
  final String title;
  final int quantity;
  final Money unitPrice;
  final Money mrp;
  final Money discount;
}

final class OrderTimelineEvent {
  const OrderTimelineEvent({
    required this.id,
    required this.orderId,
    required this.toStatus,
    required this.createdAt,
    this.fromStatus,
    this.reason,
  });

  final EntityId id;
  final EntityId orderId;
  final OrderStatus? fromStatus;
  final OrderStatus toStatus;
  final String? reason;
  final DateTime createdAt;
}

final class OrderDetails {
  OrderDetails({
    required this.order,
    required List<OrderTimelineEvent> timeline,
  }) : timeline = List.unmodifiable(timeline);

  final Order order;
  final List<OrderTimelineEvent> timeline;
}

final class RiderProfile {
  const RiderProfile({
    required this.userId,
    required this.cityId,
    required this.vehicleType,
    required this.status,
    required this.isVerified,
  });

  final EntityId userId;
  final EntityId cityId;
  final String vehicleType;
  final RiderStatus status;
  final bool isVerified;
}

final class RiderEarningsSummary {
  RiderEarningsSummary({
    required this.period,
    required this.totalEarnings,
    required this.totalOrders,
    required this.totalDistanceMeters,
    required List<RiderEarningLine> deliveries,
  }) : deliveries = List.unmodifiable(deliveries);

  final String period;
  final Money totalEarnings;
  final int totalOrders;
  final int totalDistanceMeters;
  final List<RiderEarningLine> deliveries;
}

final class RiderEarningLine {
  const RiderEarningLine({
    required this.deliveryId,
    required this.orderId,
    required this.amount,
    required this.deliveredAt,
    this.distanceMeters,
  });

  final EntityId deliveryId;
  final EntityId orderId;
  final Money amount;
  final DateTime deliveredAt;
  final int? distanceMeters;
}

final class Delivery {
  const Delivery({
    required this.id,
    required this.orderId,
    required this.storeId,
    required this.status,
    required this.pickupLocation,
    required this.dropLocation,
    required this.version,
    this.riderId,
    this.promisedEtaAt,
  });

  final EntityId id;
  final EntityId orderId;
  final EntityId storeId;
  final EntityId? riderId;
  final DeliveryStatus status;
  final GeoPoint pickupLocation;
  final GeoPoint dropLocation;
  final DateTime? promisedEtaAt;
  final int version;
}

final class LiveDeliveryState {
  const LiveDeliveryState({
    required this.deliveryId,
    required this.riderId,
    required this.location,
    required this.etaSeconds,
    required this.updatedAt,
  });

  final EntityId deliveryId;
  final EntityId riderId;
  final GeoPoint location;
  final int etaSeconds;
  final DateTime updatedAt;
}

final class ProofUploadIntent {
  const ProofUploadIntent({
    required this.deliveryId,
    required this.key,
    required this.uploadUrl,
    required this.contentType,
    this.skipped = false,
    this.reason,
  });

  final EntityId deliveryId;
  final String key;
  final Uri uploadUrl;
  final String contentType;
  final bool skipped;
  final String? reason;
}

final class RiderAssignmentOffer {
  const RiderAssignmentOffer({
    required this.offerId,
    required this.deliveryId,
    required this.expiresAt,
  });

  final EntityId offerId;
  final EntityId deliveryId;
  final DateTime expiresAt;
}

final class WalletAccount {
  const WalletAccount({
    required this.userId,
    required this.balance,
    required this.lockedBalance,
  });

  final EntityId userId;
  final Money balance;
  final Money lockedBalance;
}

final class LedgerEntry {
  const LedgerEntry({
    required this.id,
    required this.userId,
    required this.amount,
    required this.entryType,
    required this.createdAt,
    this.orderId,
    this.balanceAfter,
  });

  final EntityId id;
  final EntityId userId;
  final EntityId? orderId;
  final Money amount;
  final String entryType;
  final Money? balanceAfter;
  final DateTime createdAt;
}

final class Coupon {
  const Coupon({
    required this.id,
    required this.code,
    required this.title,
    required this.type,
    required this.validity,
  });

  final EntityId id;
  final String code;
  final String title;
  final CouponType type;
  final DateRange validity;
}

final class CouponValidationResult {
  const CouponValidationResult({
    required this.valid,
    required this.discount,
    this.reasonCode,
  });

  final bool valid;
  final Money discount;
  final String? reasonCode;
}

final class AppNotification {
  const AppNotification({
    required this.id,
    required this.userId,
    required this.channel,
    required this.templateKey,
    required this.payload,
    required this.status,
    required this.createdAt,
    this.readAt,
  });

  final EntityId id;
  final EntityId userId;
  final String channel;
  final String templateKey;
  final Map<String, Object?> payload;
  final NotificationStatus status;
  final DateTime createdAt;
  final DateTime? readAt;
}

final class OperationsSummary {
  const OperationsSummary({
    required this.cityId,
    required this.activeOrders,
    required this.delayedOrders,
    required this.availableRiders,
    required this.busyRiders,
    required this.stockoutCount,
    required this.grossMerchandiseValue,
    this.storeId,
  });

  final EntityId cityId;
  final EntityId? storeId;
  final int activeOrders;
  final int delayedOrders;
  final int availableRiders;
  final int busyRiders;
  final int stockoutCount;
  final Money grossMerchandiseValue;
}

final class AuditLogEntry {
  const AuditLogEntry({
    required this.id,
    required this.action,
    required this.entityType,
    required this.createdAt,
    this.actorId,
    this.entityId,
  });

  final EntityId id;
  final EntityId? actorId;
  final String action;
  final String entityType;
  final EntityId? entityId;
  final DateTime createdAt;
}
