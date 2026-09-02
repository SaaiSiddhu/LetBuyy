// lib/models/seller_model.dart
import 'package:cloud_firestore/cloud_firestore.dart';

enum BusinessType { individual, soleProprietorship, privateLimited }

enum VerificationStatus { pending, verified, rejected, suspended }

/// Seller tier for commission calculation
enum SellerTier { 
  newSeller,  // +2% modifier
  standard,   // 0% modifier
  verified,   // -1% modifier
  premium     // -2% modifier
}

/// Commission settings for a seller
class SellerCommission {
  final SellerTier tier;
  final double tierModifier;        // +2%, 0%, -1%, -2%
  final double? customOverride;     // Admin can set fixed % (null = use formula)
  final DateTime? lastTierUpdate;

  const SellerCommission({
    this.tier = SellerTier.newSeller,
    this.tierModifier = 2.0,
    this.customOverride,
    this.lastTierUpdate,
  });

  factory SellerCommission.fromMap(Map<String, dynamic>? map) {
    if (map == null) return const SellerCommission();
    return SellerCommission(
      tier: _parseTier(map['tier']),
      tierModifier: (map['tierModifier'] as num?)?.toDouble() ?? 2.0,
      customOverride: (map['customOverride'] as num?)?.toDouble(),
      lastTierUpdate: (map['lastTierUpdate'] as Timestamp?)?.toDate(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'tier': tier.name,
      'tierModifier': tierModifier,
      'customOverride': customOverride,
      'lastTierUpdate': lastTierUpdate != null ? Timestamp.fromDate(lastTierUpdate!) : null,
    };
  }

  SellerCommission copyWith({
    SellerTier? tier,
    double? tierModifier,
    double? customOverride,
    DateTime? lastTierUpdate,
  }) {
    return SellerCommission(
      tier: tier ?? this.tier,
      tierModifier: tierModifier ?? this.tierModifier,
      customOverride: customOverride ?? this.customOverride,
      lastTierUpdate: lastTierUpdate ?? this.lastTierUpdate,
    );
  }

  static SellerTier _parseTier(String? tier) {
    switch (tier?.toLowerCase()) {
      case 'standard': return SellerTier.standard;
      case 'verified': return SellerTier.verified;
      case 'premium': return SellerTier.premium;
      default: return SellerTier.newSeller;
    }
  }

  /// Get display name for tier
  String get tierDisplayName {
    switch (tier) {
      case SellerTier.newSeller: return 'New Seller';
      case SellerTier.standard: return 'Standard';
      case SellerTier.verified: return 'Verified';
      case SellerTier.premium: return 'Premium';
    }
  }

  /// Check if seller has custom commission override
  bool get hasCustomOverride => customOverride != null;
}

class SellerModel {
  // ✅ Core Identity
  final String sellerId;
  final String email;
  final String name;
  final String phone;
  final String? photoUrl;
  final DateTime createdAt;
  final DateTime? lastLogin;
  final bool isActive;

  // ✅ Business Information
  final String businessType;
  final String businessLegalName;
  final String storeName;
  final String businessAddress;
  final String? businessAddress2;      // ✅ NEW FIELD
  final String? businessLandmark;      // ✅ NEW FIELD
  final String businessContact;
  final String businessCity;
  final String businessPincode;
  final String businessState;
  final String? businessDistrict;      // ✅ NEW FIELD

  // ✅ Tax Details
  final String panNumber;
  final String gstNumber;
  final bool gstExempt;

  // ✅ Verification & Status
  final VerificationStatus verificationStatus;
  final DateTime? verifiedAt;
  final String? verifiedBy;
  final String? rejectionReason;
  final bool emailVerified;
  final DateTime? emailVerifiedAt;

  // ✅ Business Metrics
  final int totalProducts;
  final int totalOrders;
  final double totalRevenue;
  final double rating;
  final int reviewCount;

  // ✅ Bank Details (optional)
  final String? bankAccountNumber;
  final String? bankIfscCode;
  final String? bankAccountHolderName;
  final String? bankName;

  // ✅ Wallet & Payout System
  final double walletBalance;           // Withdrawable balance
  final double pendingAmount;           // Not yet delivered orders
  final double inTransitAmount;         // Being transferred to bank
  final double lifetimeEarnings;        // Total ever earned (gross)
  final double lifetimeFees;            // Total fees paid
  final double netLifetimeEarnings;     // Net after fees
  final double weeklyWithdrawn;         // Withdrawn this week (manual only)
  final DateTime? lastWeeklyReset;      // Last Monday reset
  final double totalWithdrawn;          // Lifetime withdrawals
  final bool payoutEnabled;             // Payout eligibility
  final DateTime? lastPayoutDate;       // Last successful payout
  final double lastPayoutAmount;        // Last payout amount

  // ✅ Additional Info
  final Map<String, dynamic>? metadata;

  // ✅ Commission Settings
  final SellerCommission commission;

  SellerModel({
    required this.sellerId,
    required this.email,
    required this.name,
    required this.phone,
    this.photoUrl,
    required this.createdAt,
    this.lastLogin,
    this.isActive = true,
    required this.businessType,
    required this.businessLegalName,
    required this.storeName,
    required this.businessAddress,
    this.businessAddress2,              // ✅ NEW FIELD
    this.businessLandmark,              // ✅ NEW FIELD
    required this.businessContact,
    required this.businessCity,
    required this.businessPincode,
    required this.businessState,
    this.businessDistrict,              // ✅ NEW FIELD
    required this.panNumber,
    required this.gstNumber,
    this.gstExempt = false,
    this.verificationStatus = VerificationStatus.pending,
    this.verifiedAt,
    this.verifiedBy,
    this.rejectionReason,
    this.emailVerified = false,
    this.emailVerifiedAt,
    this.totalProducts = 0,
    this.totalOrders = 0,
    this.totalRevenue = 0.0,
    this.rating = 0.0,
    this.reviewCount = 0,
    this.bankAccountNumber,
    this.bankIfscCode,
    this.bankAccountHolderName,
    this.bankName,
    this.walletBalance = 0.0,
    this.pendingAmount = 0.0,
    this.inTransitAmount = 0.0,
    this.lifetimeEarnings = 0.0,
    this.lifetimeFees = 0.0,
    this.netLifetimeEarnings = 0.0,
    this.weeklyWithdrawn = 0.0,
    this.lastWeeklyReset,
    this.totalWithdrawn = 0.0,
    this.payoutEnabled = true,
    this.lastPayoutDate,
    this.lastPayoutAmount = 0.0,
    this.metadata,
    this.commission = const SellerCommission(),
  });

  // ✅ Helper: Safely parse String (handles Map storage format)
  static String? _parseString(dynamic value) {
    if (value == null) return null;
    if (value is String) return value;
    if (value is Map) {
      // If stored as a map, try common key names
      return (value['value'] ?? value['text'] ?? value['data'])?.toString();
    }
    return value.toString();
  }
  
  static String _parseStringRequired(dynamic value, String defaultValue) {
    return _parseString(value) ?? defaultValue;
  }

  // ✅ FROM FIRESTORE
  factory SellerModel.fromMap(Map<String, dynamic> map, String sellerId) {
    return SellerModel(
      sellerId: sellerId,
      email: _parseStringRequired(map['email'], ''),
      name: _parseStringRequired(map['name'], ''),
      phone: _parseStringRequired(map['phone'], ''),
      photoUrl: _parseString(map['photoUrl']),
      createdAt: (map['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      lastLogin: (map['lastLogin'] as Timestamp?)?.toDate(),
      isActive: map['isActive'] ?? true,
      businessType: _parseStringRequired(map['businessType'], 'individual'),
      businessLegalName: _parseStringRequired(map['businessLegalName'], ''),
      storeName: _parseStringRequired(map['storeName'], ''),
      businessAddress: _parseStringRequired(map['businessAddress'], ''),
      businessAddress2: _parseString(map['businessAddress2']),        // ✅ NEW FIELD
      businessLandmark: _parseString(map['businessLandmark']),        // ✅ NEW FIELD
      businessContact: _parseStringRequired(map['businessContact'], ''),
      businessCity: _parseStringRequired(map['businessCity'], ''),
      businessPincode: _parseStringRequired(map['businessPincode'], ''),
      businessState: _parseStringRequired(map['businessState'], ''),
      businessDistrict: _parseString(map['businessDistrict']),        // ✅ NEW FIELD
      panNumber: _parseStringRequired(map['panNumber'], ''),
      gstNumber: _parseStringRequired(map['gstNumber'], ''),
      gstExempt: map['gstExempt'] ?? false,
      verificationStatus: _parseVerificationStatus(map['verificationStatus']),
      verifiedAt: (map['verifiedAt'] as Timestamp?)?.toDate(),
      verifiedBy: _parseString(map['verifiedBy']),
      rejectionReason: _parseString(map['rejectionReason']),
      emailVerified: map['emailVerified'] ?? false,
      emailVerifiedAt: (map['emailVerifiedAt'] as Timestamp?)?.toDate(),
      totalProducts: map['totalProducts'] ?? 0,
      totalOrders: map['totalOrders'] ?? 0,
      totalRevenue: (map['totalRevenue'] ?? 0).toDouble(),
      rating: (map['rating'] ?? 0).toDouble(),
      reviewCount: map['reviewCount'] ?? 0,
      bankAccountNumber: _parseString(map['bankAccountNumber']),
      bankIfscCode: _parseString(map['bankIfscCode']),
      bankAccountHolderName: _parseString(map['bankAccountHolderName']),
      bankName: _parseString(map['bankName']),
      walletBalance: (map['walletBalance'] ?? 0).toDouble(),
      pendingAmount: (map['pendingAmount'] ?? 0).toDouble(),
      inTransitAmount: (map['inTransitAmount'] ?? 0).toDouble(),
      lifetimeEarnings: (map['lifetimeEarnings'] ?? 0).toDouble(),
      lifetimeFees: (map['lifetimeFees'] ?? 0).toDouble(),
      netLifetimeEarnings: (map['netLifetimeEarnings'] ?? 0).toDouble(),
      weeklyWithdrawn: (map['weeklyWithdrawn'] ?? 0).toDouble(),
      lastWeeklyReset: (map['lastWeeklyReset'] as Timestamp?)?.toDate(),
      totalWithdrawn: (map['totalWithdrawn'] ?? 0).toDouble(),
      payoutEnabled: map['payoutEnabled'] ?? true,
      lastPayoutDate: (map['lastPayoutDate'] as Timestamp?)?.toDate(),
      lastPayoutAmount: (map['lastPayoutAmount'] ?? 0).toDouble(),
      metadata: map['metadata'],
      commission: SellerCommission.fromMap(map['commission'] as Map<String, dynamic>?),
    );
  }

  // ✅ TO FIRESTORE
  Map<String, dynamic> toMap() {
    return {
      'email': email,
      'name': name,
      'phone': phone,
      'photoUrl': photoUrl,
      'createdAt': Timestamp.fromDate(createdAt),
      'lastLogin': lastLogin != null ? Timestamp.fromDate(lastLogin!) : null,
      'isActive': isActive,
      'businessType': businessType,
      'businessLegalName': businessLegalName,
      'storeName': storeName,
      'businessAddress': businessAddress,
      'businessAddress2': businessAddress2,              // ✅ NEW FIELD
      'businessLandmark': businessLandmark,              // ✅ NEW FIELD
      'businessContact': businessContact,
      'businessCity': businessCity,
      'businessPincode': businessPincode,
      'businessState': businessState,
      'businessDistrict': businessDistrict,              // ✅ NEW FIELD
      'panNumber': panNumber,
      'gstNumber': gstNumber,
      'gstExempt': gstExempt,
      'verificationStatus': verificationStatus.toString().split('.').last,
      'verifiedAt': verifiedAt != null ? Timestamp.fromDate(verifiedAt!) : null,
      'verifiedBy': verifiedBy,
      'rejectionReason': rejectionReason,
      'emailVerified': emailVerified,
      'emailVerifiedAt': emailVerifiedAt != null ? Timestamp.fromDate(emailVerifiedAt!) : null,
      'totalProducts': totalProducts,
      'totalOrders': totalOrders,
      'totalRevenue': totalRevenue,
      'rating': rating,
      'reviewCount': reviewCount,
      'bankAccountNumber': bankAccountNumber,
      'bankIfscCode': bankIfscCode,
      'bankAccountHolderName': bankAccountHolderName,
      'bankName': bankName,
      'walletBalance': walletBalance,
      'pendingAmount': pendingAmount,
      'inTransitAmount': inTransitAmount,
      'lifetimeEarnings': lifetimeEarnings,
      'lifetimeFees': lifetimeFees,
      'netLifetimeEarnings': netLifetimeEarnings,
      'weeklyWithdrawn': weeklyWithdrawn,
      'lastWeeklyReset': lastWeeklyReset != null ? Timestamp.fromDate(lastWeeklyReset!) : null,
      'totalWithdrawn': totalWithdrawn,
      'payoutEnabled': payoutEnabled,
      'lastPayoutDate': lastPayoutDate != null ? Timestamp.fromDate(lastPayoutDate!) : null,
      'lastPayoutAmount': lastPayoutAmount,
      'metadata': metadata,
      'commission': commission.toMap(),
    };
  }

  // ✅ TO JSON (for local caching - uses ISO strings instead of Timestamps)
  Map<String, dynamic> toJson() {
    return {
      'sellerId': sellerId,
      'email': email,
      'name': name,
      'phone': phone,
      'photoUrl': photoUrl,
      'createdAt': createdAt.toIso8601String(),
      'lastLogin': lastLogin?.toIso8601String(),
      'isActive': isActive,
      'businessType': businessType,
      'businessLegalName': businessLegalName,
      'storeName': storeName,
      'businessAddress': businessAddress,
      'businessAddress2': businessAddress2,
      'businessLandmark': businessLandmark,
      'businessContact': businessContact,
      'businessCity': businessCity,
      'businessPincode': businessPincode,
      'businessState': businessState,
      'businessDistrict': businessDistrict,
      'panNumber': panNumber,
      'gstNumber': gstNumber,
      'gstExempt': gstExempt,
      'verificationStatus': verificationStatus.toString().split('.').last,
      'verifiedAt': verifiedAt?.toIso8601String(),
      'verifiedBy': verifiedBy,
      'rejectionReason': rejectionReason,
      'emailVerified': emailVerified,
      'emailVerifiedAt': emailVerifiedAt?.toIso8601String(),
      'totalProducts': totalProducts,
      'totalOrders': totalOrders,
      'totalRevenue': totalRevenue,
      'rating': rating,
      'reviewCount': reviewCount,
      'bankAccountNumber': bankAccountNumber,
      'bankIfscCode': bankIfscCode,
      'bankAccountHolderName': bankAccountHolderName,
      'bankName': bankName,
      'walletBalance': walletBalance,
      'pendingAmount': pendingAmount,
      'inTransitAmount': inTransitAmount,
      'lifetimeEarnings': lifetimeEarnings,
      'lifetimeFees': lifetimeFees,
      'netLifetimeEarnings': netLifetimeEarnings,
      'weeklyWithdrawn': weeklyWithdrawn,
      'lastWeeklyReset': lastWeeklyReset?.toIso8601String(),
      'totalWithdrawn': totalWithdrawn,
      'payoutEnabled': payoutEnabled,
      'lastPayoutDate': lastPayoutDate?.toIso8601String(),
      'lastPayoutAmount': lastPayoutAmount,
      'metadata': metadata,
      'commission': commission.toMap(),
    };
  }
  
  // ✅ FROM JSON (for local caching - uses ISO strings instead of Timestamps)
  factory SellerModel.fromJson(Map<String, dynamic> json) {
    return SellerModel(
      sellerId: json['sellerId'] ?? '',
      email: json['email'] ?? '',
      name: json['name'] ?? '',
      phone: json['phone'] ?? '',
      photoUrl: json['photoUrl'],
      createdAt: json['createdAt'] != null ? DateTime.parse(json['createdAt']) : DateTime.now(),
      lastLogin: json['lastLogin'] != null ? DateTime.parse(json['lastLogin']) : null,
      isActive: json['isActive'] ?? true,
      businessType: json['businessType'] ?? 'individual',
      businessLegalName: json['businessLegalName'] ?? '',
      storeName: json['storeName'] ?? '',
      businessAddress: json['businessAddress'] ?? '',
      businessAddress2: json['businessAddress2'],
      businessLandmark: json['businessLandmark'],
      businessContact: json['businessContact'] ?? '',
      businessCity: json['businessCity'] ?? '',
      businessPincode: json['businessPincode'] ?? '',
      businessState: json['businessState'] ?? '',
      businessDistrict: json['businessDistrict'],
      panNumber: json['panNumber'] ?? '',
      gstNumber: json['gstNumber'] ?? '',
      gstExempt: json['gstExempt'] ?? false,
      verificationStatus: _parseVerificationStatus(json['verificationStatus']),
      verifiedAt: json['verifiedAt'] != null ? DateTime.parse(json['verifiedAt']) : null,
      verifiedBy: json['verifiedBy'],
      rejectionReason: json['rejectionReason'],
      emailVerified: json['emailVerified'] ?? false,
      emailVerifiedAt: json['emailVerifiedAt'] != null ? DateTime.parse(json['emailVerifiedAt']) : null,
      totalProducts: json['totalProducts'] ?? 0,
      totalOrders: json['totalOrders'] ?? 0,
      totalRevenue: (json['totalRevenue'] ?? 0).toDouble(),
      rating: (json['rating'] ?? 0).toDouble(),
      reviewCount: json['reviewCount'] ?? 0,
      bankAccountNumber: json['bankAccountNumber'],
      bankIfscCode: json['bankIfscCode'],
      bankAccountHolderName: json['bankAccountHolderName'],
      bankName: json['bankName'],
      walletBalance: (json['walletBalance'] ?? 0).toDouble(),
      pendingAmount: (json['pendingAmount'] ?? 0).toDouble(),
      inTransitAmount: (json['inTransitAmount'] ?? 0).toDouble(),
      lifetimeEarnings: (json['lifetimeEarnings'] ?? 0).toDouble(),
      lifetimeFees: (json['lifetimeFees'] ?? 0).toDouble(),
      netLifetimeEarnings: (json['netLifetimeEarnings'] ?? 0).toDouble(),
      weeklyWithdrawn: (json['weeklyWithdrawn'] ?? 0).toDouble(),
      lastWeeklyReset: json['lastWeeklyReset'] != null ? DateTime.parse(json['lastWeeklyReset']) : null,
      totalWithdrawn: (json['totalWithdrawn'] ?? 0).toDouble(),
      payoutEnabled: json['payoutEnabled'] ?? true,
      lastPayoutDate: json['lastPayoutDate'] != null ? DateTime.parse(json['lastPayoutDate']) : null,
      lastPayoutAmount: (json['lastPayoutAmount'] ?? 0).toDouble(),
      metadata: json['metadata'],
      commission: SellerCommission.fromMap(json['commission'] as Map<String, dynamic>?),
    );
  }

  // ✅ COPY WITH
  SellerModel copyWith({
    String? name,
    String? phone,
    String? photoUrl,
    DateTime? lastLogin,
    bool? isActive,
    String? businessType,
    String? businessLegalName,
    String? storeName,
    String? businessAddress,
    String? businessAddress2,            // ✅ NEW FIELD
    String? businessLandmark,            // ✅ NEW FIELD
    String? businessContact,
    String? businessCity,
    String? businessPincode,
    String? businessState,
    String? businessDistrict,            // ✅ NEW FIELD
    String? panNumber,
    String? gstNumber,
    bool? gstExempt,
    VerificationStatus? verificationStatus,
    DateTime? verifiedAt,
    String? verifiedBy,
    String? rejectionReason,
    bool? emailVerified,
    DateTime? emailVerifiedAt,
    int? totalProducts,
    int? totalOrders,
    double? totalRevenue,
    double? rating,
    int? reviewCount,
    String? bankAccountNumber,
    String? bankIfscCode,
    String? bankAccountHolderName,
    String? bankName,
    double? walletBalance,
    double? pendingAmount,
    double? inTransitAmount,
    double? lifetimeEarnings,
    double? lifetimeFees,
    double? netLifetimeEarnings,
    double? weeklyWithdrawn,
    DateTime? lastWeeklyReset,
    double? totalWithdrawn,
    bool? payoutEnabled,
    DateTime? lastPayoutDate,
    double? lastPayoutAmount,
  }) {
    return SellerModel(
      sellerId: sellerId,
      email: email,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      photoUrl: photoUrl ?? this.photoUrl,
      createdAt: createdAt,
      lastLogin: lastLogin ?? this.lastLogin,
      isActive: isActive ?? this.isActive,
      businessType: businessType ?? this.businessType,
      businessLegalName: businessLegalName ?? this.businessLegalName,
      storeName: storeName ?? this.storeName,
      businessAddress: businessAddress ?? this.businessAddress,
      businessAddress2: businessAddress2 ?? this.businessAddress2,        // ✅ NEW FIELD
      businessLandmark: businessLandmark ?? this.businessLandmark,        // ✅ NEW FIELD
      businessContact: businessContact ?? this.businessContact,
      businessCity: businessCity ?? this.businessCity,
      businessPincode: businessPincode ?? this.businessPincode,
      businessState: businessState ?? this.businessState,
      businessDistrict: businessDistrict ?? this.businessDistrict,        // ✅ NEW FIELD
      panNumber: panNumber ?? this.panNumber,
      gstNumber: gstNumber ?? this.gstNumber,
      gstExempt: gstExempt ?? this.gstExempt,
      verificationStatus: verificationStatus ?? this.verificationStatus,
      verifiedAt: verifiedAt ?? this.verifiedAt,
      verifiedBy: verifiedBy ?? this.verifiedBy,
      rejectionReason: rejectionReason ?? this.rejectionReason,
      emailVerified: emailVerified ?? this.emailVerified,
      emailVerifiedAt: emailVerifiedAt ?? this.emailVerifiedAt,
      totalProducts: totalProducts ?? this.totalProducts,
      totalOrders: totalOrders ?? this.totalOrders,
      totalRevenue: totalRevenue ?? this.totalRevenue,
      rating: rating ?? this.rating,
      reviewCount: reviewCount ?? this.reviewCount,
      bankAccountNumber: bankAccountNumber ?? this.bankAccountNumber,
      bankIfscCode: bankIfscCode ?? this.bankIfscCode,
      bankAccountHolderName: bankAccountHolderName ?? this.bankAccountHolderName,
      bankName: bankName ?? this.bankName,
      walletBalance: walletBalance ?? this.walletBalance,
      pendingAmount: pendingAmount ?? this.pendingAmount,
      inTransitAmount: inTransitAmount ?? this.inTransitAmount,
      lifetimeEarnings: lifetimeEarnings ?? this.lifetimeEarnings,
      lifetimeFees: lifetimeFees ?? this.lifetimeFees,
      netLifetimeEarnings: netLifetimeEarnings ?? this.netLifetimeEarnings,
      weeklyWithdrawn: weeklyWithdrawn ?? this.weeklyWithdrawn,
      lastWeeklyReset: lastWeeklyReset ?? this.lastWeeklyReset,
      totalWithdrawn: totalWithdrawn ?? this.totalWithdrawn,
      payoutEnabled: payoutEnabled ?? this.payoutEnabled,
      lastPayoutDate: lastPayoutDate ?? this.lastPayoutDate,
      lastPayoutAmount: lastPayoutAmount ?? this.lastPayoutAmount,
      metadata: metadata,
    );
  }

  // ✅ GETTERS
  bool get isVerified => verificationStatus == VerificationStatus.verified;
  bool get isPending => verificationStatus == VerificationStatus.pending;
  bool get isRejected => verificationStatus == VerificationStatus.rejected;
  bool get isSuspended => verificationStatus == VerificationStatus.suspended;
  
  String get displayName => storeName.isNotEmpty ? storeName : name;
  
  String get verificationBadge {
    switch (verificationStatus) {
      case VerificationStatus.verified:
        return '✅ Verified';
      case VerificationStatus.pending:
        return '⏳ Pending';
      case VerificationStatus.rejected:
        return '❌ Rejected';
      case VerificationStatus.suspended:
        return '🚫 Suspended';
    }
  }

  // ✅ Full Business Address Getter
  String get fullBusinessAddress {
    final parts = <String>[
      businessAddress,
      if (businessAddress2?.isNotEmpty ?? false) businessAddress2!,
      if (businessLandmark?.isNotEmpty ?? false) 'Near ${businessLandmark!}',
      businessCity,
      if (businessDistrict?.isNotEmpty ?? false) businessDistrict!,
      businessState,
      businessPincode,
    ];
    return parts.where((p) => p.isNotEmpty).join(', ');
  }

  // ✅ HELPER: Parse Verification Status
  static VerificationStatus _parseVerificationStatus(dynamic status) {
    // Handle different storage formats
    String? statusString;
    if (status is String) {
      statusString = status;
    } else if (status is Map) {
      // If stored as a map, try to get the status field
      statusString = status['status'] as String?;
    }
    
    switch (statusString?.toLowerCase()) {
      case 'verified':
        return VerificationStatus.verified;
      case 'rejected':
        return VerificationStatus.rejected;
      case 'suspended':
        return VerificationStatus.suspended;
      default:
        return VerificationStatus.pending;
    }
  }

  // ✅ DEBUG INFO
  String get debugInfo => '''
  📊 Seller Debug Info:
  ━━━━━━━━━━━━━━━━━━━━━━━━
  🆔 ID: $sellerId
  👤 Name: $name
  🏪 Store: $storeName
  📧 Email: $email
  📱 Phone: $phone
  🏢 Business: $businessLegalName ($businessType)
  📍 Location: $fullBusinessAddress
  📋 PAN: $panNumber
  🧾 GST: $gstNumber ${gstExempt ? '(Exempt)' : ''}
  ✅ Status: ${verificationStatus.toString().split('.').last}
  📦 Products: $totalProducts
  🛒 Orders: $totalOrders
  💰 Revenue: ₹$totalRevenue
  ⭐ Rating: $rating ($reviewCount reviews)
  💵 Wallet: ₹$walletBalance (Pending: ₹$pendingAmount)
  🔓 Active: $isActive
  📅 Created: ${createdAt.toLocal()}
  🕒 Last Login: ${lastLogin?.toLocal() ?? 'Never'}
  ━━━━━━━━━━━━━━━━━━━━━━━━
  ''';
}
