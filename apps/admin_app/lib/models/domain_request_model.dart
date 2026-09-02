import 'package:cloud_firestore/cloud_firestore.dart';

/// Model for domain provisioning requests
class DomainRequestModel {
  final String id;
  final String storeId;
  final String sellerId;
  final String storeName;
  final String sellerEmail;
  final String subdomain;
  final String? customDomain;
  final String status; // "pending" | "connected" | "rejected"
  final DateTime requestedAt;
  final DateTime? processedAt;
  final String? processedBy;
  final String? notes;

  const DomainRequestModel({
    required this.id,
    required this.storeId,
    required this.sellerId,
    required this.storeName,
    required this.sellerEmail,
    required this.subdomain,
    this.customDomain,
    this.status = 'pending',
    required this.requestedAt,
    this.processedAt,
    this.processedBy,
    this.notes,
  });

  factory DomainRequestModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return DomainRequestModel(
      id: doc.id,
      storeId: data['storeId'] ?? '',
      sellerId: data['sellerId'] ?? '',
      storeName: data['storeName'] ?? '',
      sellerEmail: data['sellerEmail'] ?? '',
      subdomain: data['subdomain'] ?? '',
      customDomain: data['customDomain'],
      status: data['status'] ?? 'pending',
      requestedAt: (data['requestedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      processedAt: (data['processedAt'] as Timestamp?)?.toDate(),
      processedBy: data['processedBy'],
      notes: data['notes'],
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'storeId': storeId,
      'sellerId': sellerId,
      'storeName': storeName,
      'sellerEmail': sellerEmail,
      'subdomain': subdomain,
      'customDomain': customDomain,
      'status': status,
      'requestedAt': Timestamp.fromDate(requestedAt),
      'processedAt': processedAt != null ? Timestamp.fromDate(processedAt!) : null,
      'processedBy': processedBy,
      'notes': notes,
    };
  }

  DomainRequestModel copyWith({
    String? id,
    String? storeId,
    String? sellerId,
    String? storeName,
    String? sellerEmail,
    String? subdomain,
    String? customDomain,
    String? status,
    DateTime? requestedAt,
    DateTime? processedAt,
    String? processedBy,
    String? notes,
  }) {
    return DomainRequestModel(
      id: id ?? this.id,
      storeId: storeId ?? this.storeId,
      sellerId: sellerId ?? this.sellerId,
      storeName: storeName ?? this.storeName,
      sellerEmail: sellerEmail ?? this.sellerEmail,
      subdomain: subdomain ?? this.subdomain,
      customDomain: customDomain ?? this.customDomain,
      status: status ?? this.status,
      requestedAt: requestedAt ?? this.requestedAt,
      processedAt: processedAt ?? this.processedAt,
      processedBy: processedBy ?? this.processedBy,
      notes: notes ?? this.notes,
    );
  }

  bool get isPending => status == 'pending';
  bool get isConnected => status == 'connected';
  bool get isRejected => status == 'rejected';
  bool get isCustomDomainRequest => customDomain != null && customDomain!.isNotEmpty;

  /// Get the domain URL that was requested
  String get requestedDomain {
    if (isCustomDomainRequest) return customDomain!;
    return '$subdomain.letbuyy.store';
  }

  /// Generate DNS instructions for Vercel
  String get dnsInstructions {
    if (isCustomDomainRequest) {
      return '''Add this DNS record to ${customDomain!}:
Type    Host    Value
CNAME   www     cname.vercel-dns.com
CNAME   @       cname.vercel-dns.com''';
    }
    // Subdomains use Cloudflare wildcard - no manual DNS needed
    return 'Subdomain $subdomain.letbuyy.store is auto-configured via Cloudflare wildcard DNS.';
  }
}
