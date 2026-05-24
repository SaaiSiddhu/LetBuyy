// ============================================================
// ORDER MODEL
// Data model for store orders in the builder app
// ============================================================



/// Helper to safely parse timestamps (handles ISO strings and DateTime).
DateTime? _parseTimestamp(dynamic value) {
  if (value == null) return null;
  if (value is DateTime) return value;
  if (value is String) {
    try {
      return DateTime.parse(value);
    } catch (_) {
      return null;
    }
  }
  return null;
}

/// Order status enum
enum OrderStatus {
  pending,
  confirmed,
  shipped,
  delivered,
  cancelled;

  String get displayName {
    switch (this) {
      case OrderStatus.pending:
        return 'Pending';
      case OrderStatus.confirmed:
        return 'Confirmed';
      case OrderStatus.shipped:
        return 'Shipped';
      case OrderStatus.delivered:
        return 'Delivered';
      case OrderStatus.cancelled:
        return 'Cancelled';
    }
  }

  String get color {
    switch (this) {
      case OrderStatus.pending:
        return '#f59e0b';
      case OrderStatus.confirmed:
        return '#3b82f6';
      case OrderStatus.shipped:
        return '#8b5cf6';
      case OrderStatus.delivered:
        return '#10b981';
      case OrderStatus.cancelled:
        return '#ef4444';
    }
  }
}

/// Shipping address model
class ShippingAddress {
  final String address;
  final String city;
  final String state;
  final String pincode;

  ShippingAddress({
    required this.address,
    required this.city,
    required this.state,
    required this.pincode,
  });

  factory ShippingAddress.fromJson(dynamic data) {
    // Handle if data is String instead of Map
    if (data is String) {
      return ShippingAddress(address: data, city: '', state: '', pincode: '');
    }
    final json = data is Map<String, dynamic> ? data : <String, dynamic>{};
    return ShippingAddress(
      address: json['address']?.toString() ?? '',
      city: json['city']?.toString() ?? '',
      state: json['state']?.toString() ?? '',
      pincode: json['pincode']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'address': address,
        'city': city,
        'state': state,
        'pincode': pincode,
      };

  String get fullAddress => '$address, $city, $state - $pincode';
}

/// Order customer model
class OrderCustomer {
  final String name;
  final String email;
  final String phone;
  final ShippingAddress address;

  OrderCustomer({
    required this.name,
    required this.email,
    required this.phone,
    required this.address,
  });

  factory OrderCustomer.fromJson(dynamic data) {
    // Handle if data is String instead of Map
    if (data is String) {
      return OrderCustomer(
        name: data,
        email: '',
        phone: '',
        address: ShippingAddress.fromJson({}),
      );
    }
    final json = data is Map<String, dynamic> ? data : <String, dynamic>{};
    return OrderCustomer(
      name: json['name']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      address: ShippingAddress.fromJson(json['address'] ?? {}),
    );
  }

  Map<String, dynamic> toJson() => {
        'name': name,
        'email': email,
        'phone': phone,
        'address': address.toJson(),
      };
}

/// Order item model
class OrderItem {
  final String productId;
  final String name;
  final double price;
  final int quantity;
  final String image;
  final Map<String, String>? variant;

  OrderItem({
    required this.productId,
    required this.name,
    required this.price,
    required this.quantity,
    required this.image,
    this.variant,
  });

  factory OrderItem.fromJson(dynamic data) {
    final json = data is Map<String, dynamic> ? data : 
                 data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
    
    // Parse price safely
    double parsePrice(dynamic val) {
      if (val is num) return val.toDouble();
      if (val is String) return double.tryParse(val) ?? 0.0;
      return 0.0;
    }
    
    // Parse quantity safely
    int parseQuantity(dynamic val) {
      if (val is int) return val;
      if (val is num) return val.toInt();
      if (val is String) return int.tryParse(val) ?? 1;
      return 1;
    }
    
    return OrderItem(
      productId: json['productId']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      price: parsePrice(json['price']),
      quantity: parseQuantity(json['quantity']),
      image: json['image']?.toString() ?? '',
      variant: json['variant'] != null && json['variant'] is Map
          ? Map<String, String>.from((json['variant'] as Map).map((k, v) => MapEntry(k.toString(), v.toString())))
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'productId': productId,
        'name': name,
        'price': price,
        'quantity': quantity,
        'image': image,
        if (variant != null) 'variant': variant,
      };

  double get total => price * quantity;
}

/// Order pricing model
class OrderPricing {
  final double subtotal;
  final double deliveryCharge;
  final double discount;
  final double total;

  OrderPricing({
    required this.subtotal,
    required this.deliveryCharge,
    required this.discount,
    required this.total,
  });

  factory OrderPricing.fromJson(dynamic data) {
    final json = data is Map<String, dynamic> ? data : 
                 data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
    double parseDouble(dynamic val) {
      if (val is num) return val.toDouble();
      if (val is String) return double.tryParse(val) ?? 0.0;
      return 0.0;
    }
    return OrderPricing(
      subtotal: parseDouble(json['subtotal']),
      deliveryCharge: parseDouble(json['deliveryCharge']),
      discount: parseDouble(json['discount']),
      total: parseDouble(json['total']),
    );
  }

  Map<String, dynamic> toJson() => {
        'subtotal': subtotal,
        'deliveryCharge': deliveryCharge,
        'discount': discount,
        'total': total,
      };
}

/// Order payment model
class OrderPayment {
  final String method;
  final String status;
  final String? razorpayOrderId;
  final String? razorpayPaymentId;

  OrderPayment({
    required this.method,
    required this.status,
    this.razorpayOrderId,
    this.razorpayPaymentId,
  });

  factory OrderPayment.fromJson(dynamic data) {
    final json = data is Map<String, dynamic> ? data : 
                 data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
    return OrderPayment(
      method: json['method']?.toString() ?? 'razorpay',
      status: json['status']?.toString() ?? 'pending',
      razorpayOrderId: json['razorpayOrderId']?.toString(),
      razorpayPaymentId: json['razorpayPaymentId']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'method': method,
        'status': status,
        if (razorpayOrderId != null) 'razorpayOrderId': razorpayOrderId,
        if (razorpayPaymentId != null) 'razorpayPaymentId': razorpayPaymentId,
      };
}

/// Order tracking model
class OrderTracking {
  final String? number;
  final String? carrier;
  final String? url;
  final DateTime? updatedAt;

  OrderTracking({
    this.number,
    this.carrier,
    this.url,
    this.updatedAt,
  });

  factory OrderTracking.fromJson(dynamic data) {
    final json = data is Map<String, dynamic> ? data : 
                 data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
    return OrderTracking(
      number: json['number']?.toString(),
      carrier: json['carrier']?.toString(),
      url: json['url']?.toString(),
      updatedAt: _parseTimestamp(json['updatedAt']),
    );
  }

  Map<String, dynamic> toJson() => {
        if (number != null) 'number': number,
        if (carrier != null) 'carrier': carrier,
        if (url != null) 'url': url,
        if (updatedAt != null) 'updatedAt': updatedAt!.toIso8601String(),
      };
}

/// Main order model
class OrderModel {
  final String id;
  final String storeId;
  final String sellerId;
  final String subdomain;
  final String orderNumber;
  final OrderCustomer customer;
  final List<OrderItem> items;
  final OrderPricing pricing;
  final OrderPayment payment;
  final OrderStatus status;
  final OrderTracking? tracking;
  final String? notes;
  final DateTime createdAt;
  final DateTime? updatedAt;

  OrderModel({
    required this.id,
    required this.storeId,
    required this.sellerId,
    required this.subdomain,
    required this.orderNumber,
    required this.customer,
    required this.items,
    required this.pricing,
    required this.payment,
    required this.status,
    this.tracking,
    this.notes,
    required this.createdAt,
    this.updatedAt,
  });

  factory OrderModel.fromJson(Map<String, dynamic> json, [String? docId]) {
    // Defensive parsing - handle cases where data might be String instead of Map
    Map<String, dynamic> parseMap(dynamic value) {
      if (value is Map<String, dynamic>) return value;
      if (value is Map) return Map<String, dynamic>.from(value);
      return {};
    }

    List<dynamic> parseList(dynamic value) {
      if (value is List) return value;
      return [];
    }

    return OrderModel(
      id: docId ?? json['id']?.toString() ?? '',
      storeId: json['storeId']?.toString() ?? '',
      sellerId: json['sellerId']?.toString() ?? '',
      subdomain: json['subdomain']?.toString() ?? '',
      orderNumber: json['orderNumber']?.toString() ?? '',
      customer: OrderCustomer.fromJson(parseMap(json['customer'])),
      items: parseList(json['items'])
              .map((e) => OrderItem.fromJson(parseMap(e)))
              .toList(),
      pricing: OrderPricing.fromJson(parseMap(json['pricing'])),
      payment: OrderPayment.fromJson(parseMap(json['payment'])),
      status: _parseStatus(json['status']?.toString()),
      tracking: json['tracking'] != null && json['tracking'] is Map
          ? OrderTracking.fromJson(parseMap(json['tracking']))
          : null,
      notes: json['notes']?.toString(),
      createdAt: _parseTimestamp(json['createdAt']) ?? DateTime.now(),
      updatedAt: _parseTimestamp(json['updatedAt']),
    );
  }

  static OrderStatus _parseStatus(String? status) {
    switch (status) {
      case 'confirmed':
        return OrderStatus.confirmed;
      case 'shipped':
        return OrderStatus.shipped;
      case 'delivered':
        return OrderStatus.delivered;
      case 'cancelled':
        return OrderStatus.cancelled;
      default:
        return OrderStatus.pending;
    }
  }

  Map<String, dynamic> toJson() => {
        'storeId': storeId,
        'sellerId': sellerId,
        'subdomain': subdomain,
        'orderNumber': orderNumber,
        'customer': customer.toJson(),
        'items': items.map((e) => e.toJson()).toList(),
        'pricing': pricing.toJson(),
        'payment': payment.toJson(),
        'status': status.name,
        if (tracking != null) 'tracking': tracking!.toJson(),
        if (notes != null) 'notes': notes,
        'createdAt': createdAt.toIso8601String(),
        if (updatedAt != null) 'updatedAt': updatedAt!.toIso8601String(),
      };

  int get itemCount => items.fold(0, (sum, item) => sum + item.quantity);
}
