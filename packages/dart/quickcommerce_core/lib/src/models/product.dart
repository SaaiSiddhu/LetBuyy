import 'json_helpers.dart';

class Product {
  const Product({
    required this.id,
    required this.categoryId,
    required this.name,
    required this.slug,
    required this.variantId,
    required this.sku,
    required this.unitLabel,
    required this.mrp,
    required this.salePrice,
    this.brandId,
    this.description = '',
    this.title,
    this.imageUrl,
    this.mediaUrls = const [],
    this.searchKeywords = const [],
    this.isActive = true,
    this.isInStock = false,
    this.stockAvailable = 0,
    this.barcode,
    this.weightGrams,
    this.hsnCode,
    this.taxRate = 0,
    this.createdAt,
    this.updatedAt,
    this.version = 1,
  });

  final String id;
  final String categoryId;
  final String? brandId;
  final String name;
  final String slug;
  final String description;
  final String variantId;
  final String sku;
  final String? title;
  final String unitLabel;
  final double mrp;
  final double salePrice;
  final String? imageUrl;
  final List<String> mediaUrls;
  final List<String> searchKeywords;
  final bool isActive;
  final bool isInStock;
  final int stockAvailable;
  final String? barcode;
  final int? weightGrams;
  final String? hsnCode;
  final double taxRate;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final int version;

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json['id'].toString(),
      categoryId: json['category_id']?.toString() ?? json['categoryId']?.toString() ?? '',
      brandId: json['brand_id']?.toString() ?? json['brandId']?.toString(),
      name: json['name']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      variantId: json['variant_id']?.toString() ?? json['variantId']?.toString() ?? json['id'].toString(),
      sku: json['sku']?.toString() ?? '',
      title: json['title']?.toString(),
      unitLabel: json['unit_label']?.toString() ?? json['unitLabel']?.toString() ?? '',
      mrp: parseDouble(json['mrp']),
      salePrice: parseDouble(json['sale_price'] ?? json['default_sale_price'] ?? json['salePrice']),
      imageUrl: json['image_url']?.toString() ?? json['imageUrl']?.toString(),
      mediaUrls: parseStringList(json['media_urls'] ?? json['mediaUrls']),
      searchKeywords: parseStringList(json['search_keywords'] ?? json['searchKeywords']),
      isActive: parseBool(json['is_active'] ?? json['isActive'], true),
      isInStock: parseBool(json['is_in_stock'] ?? json['isInStock']),
      stockAvailable: parseInt(json['stock_available'] ?? json['stockAvailable']),
      barcode: json['barcode']?.toString(),
      weightGrams: json['weight_grams'] == null && json['weight_g'] == null && json['weightGrams'] == null
          ? null
          : parseInt(json['weight_grams'] ?? json['weight_g'] ?? json['weightGrams']),
      hsnCode: json['hsn_code']?.toString() ?? json['hsnCode']?.toString() ?? json['tax_code']?.toString(),
      taxRate: parseDouble(json['tax_rate'] ?? json['taxRate']),
      createdAt: parseDateTime(json['created_at'] ?? json['createdAt']),
      updatedAt: parseDateTime(json['updated_at'] ?? json['updatedAt']),
      version: parseInt(json['version'], 1),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'category_id': categoryId,
      'brand_id': brandId,
      'name': name,
      'slug': slug,
      'description': description,
      'variant_id': variantId,
      'sku': sku,
      'title': title,
      'unit_label': unitLabel,
      'mrp': mrp,
      'sale_price': salePrice,
      'image_url': imageUrl,
      'media_urls': mediaUrls,
      'search_keywords': searchKeywords,
      'is_active': isActive,
      'is_in_stock': isInStock,
      'stock_available': stockAvailable,
      'barcode': barcode,
      'weight_grams': weightGrams,
      'hsn_code': hsnCode,
      'tax_rate': taxRate,
      'created_at': createdAt?.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
      'version': version,
    };
  }

  Product copyWith({
    String? id,
    String? categoryId,
    String? brandId,
    String? name,
    String? slug,
    String? description,
    String? variantId,
    String? sku,
    String? title,
    String? unitLabel,
    double? mrp,
    double? salePrice,
    String? imageUrl,
    List<String>? mediaUrls,
    List<String>? searchKeywords,
    bool? isActive,
    bool? isInStock,
    int? stockAvailable,
    String? barcode,
    int? weightGrams,
    String? hsnCode,
    double? taxRate,
    DateTime? createdAt,
    DateTime? updatedAt,
    int? version,
  }) {
    return Product(
      id: id ?? this.id,
      categoryId: categoryId ?? this.categoryId,
      brandId: brandId ?? this.brandId,
      name: name ?? this.name,
      slug: slug ?? this.slug,
      description: description ?? this.description,
      variantId: variantId ?? this.variantId,
      sku: sku ?? this.sku,
      title: title ?? this.title,
      unitLabel: unitLabel ?? this.unitLabel,
      mrp: mrp ?? this.mrp,
      salePrice: salePrice ?? this.salePrice,
      imageUrl: imageUrl ?? this.imageUrl,
      mediaUrls: mediaUrls ?? this.mediaUrls,
      searchKeywords: searchKeywords ?? this.searchKeywords,
      isActive: isActive ?? this.isActive,
      isInStock: isInStock ?? this.isInStock,
      stockAvailable: stockAvailable ?? this.stockAvailable,
      barcode: barcode ?? this.barcode,
      weightGrams: weightGrams ?? this.weightGrams,
      hsnCode: hsnCode ?? this.hsnCode,
      taxRate: taxRate ?? this.taxRate,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      version: version ?? this.version,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is Product &&
        other.id == id &&
        other.categoryId == categoryId &&
        other.brandId == brandId &&
        other.name == name &&
        other.slug == slug &&
        other.description == description &&
        other.variantId == variantId &&
        other.sku == sku &&
        other.title == title &&
        other.unitLabel == unitLabel &&
        other.mrp == mrp &&
        other.salePrice == salePrice &&
        other.imageUrl == imageUrl &&
        listEquals(other.mediaUrls, mediaUrls) &&
        listEquals(other.searchKeywords, searchKeywords) &&
        other.isActive == isActive &&
        other.isInStock == isInStock &&
        other.stockAvailable == stockAvailable &&
        other.barcode == barcode &&
        other.weightGrams == weightGrams &&
        other.hsnCode == hsnCode &&
        other.taxRate == taxRate &&
        other.createdAt == createdAt &&
        other.updatedAt == updatedAt &&
        other.version == version;
  }

  @override
  int get hashCode => Object.hashAll([
        id,
        categoryId,
        brandId,
        name,
        slug,
        description,
        variantId,
        sku,
        title,
        unitLabel,
        mrp,
        salePrice,
        imageUrl,
        listHash(mediaUrls),
        listHash(searchKeywords),
        isActive,
        isInStock,
        stockAvailable,
        barcode,
        weightGrams,
        hsnCode,
        taxRate,
        createdAt,
        updatedAt,
        version,
      ]);

  @override
  String toString() => 'Product(${toJson()})';
}
