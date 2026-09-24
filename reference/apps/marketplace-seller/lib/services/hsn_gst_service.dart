// lib/services/hsn_gst_service.dart
// HSN Code to GST Rate Mapping Service

import 'package:cloud_firestore/cloud_firestore.dart';

/// GST Type for products
enum GstType { taxable, exempt, nil }

/// GST Rate Information from HSN lookup
class GstRateInfo {
  final String hsnCode;
  final double gstRate;
  final GstType gstType;
  final String description;

  const GstRateInfo({
    required this.hsnCode,
    required this.gstRate,
    required this.gstType,
    this.description = '',
  });

  bool get requiresGstin => gstType == GstType.taxable;
  bool get isExempt => gstType == GstType.exempt || gstType == GstType.nil;

  Map<String, dynamic> toMap() => {
    'hsnCode': hsnCode,
    'gstRate': gstRate,
    'gstType': gstType.name,
    'description': description,
  };

  factory GstRateInfo.fromMap(Map<String, dynamic> map) => GstRateInfo(
    hsnCode: map['hsnCode'] ?? '',
    gstRate: (map['gstRate'] ?? 0).toDouble(),
    gstType: GstType.values.firstWhere(
      (e) => e.name == map['gstType'],
      orElse: () => GstType.taxable,
    ),
    description: map['description'] ?? '',
  );

  static GstRateInfo unknown(String hsn) => GstRateInfo(
    hsnCode: hsn,
    gstRate: 18, // Default to 18%
    gstType: GstType.taxable,
    description: 'Default rate',
  );
}

/// GST Seller Status
enum SellerGstStatus { registered, unregistered }

/// Service for HSN to GST mapping
class HsnGstService {
  static final _firestore = FirebaseFirestore.instance;
  
  // Cache for HSN lookups
  static final Map<String, GstRateInfo> _cache = {};

  /// Common HSN codes with their GST rates (200+ category-based fallback)
  static final Map<String, GstRateInfo> _commonHsnRates = {
    // ═══════════════════════════════════════════════════════════════
    // EXEMPT / NIL (0%) - Fresh produce, books, newspapers
    // ═══════════════════════════════════════════════════════════════
    '0401': const GstRateInfo(hsnCode: '0401', gstRate: 0, gstType: GstType.exempt, description: 'Fresh Milk'),
    '0406': const GstRateInfo(hsnCode: '0406', gstRate: 0, gstType: GstType.exempt, description: 'Curd, Lassi'),
    '0407': const GstRateInfo(hsnCode: '0407', gstRate: 0, gstType: GstType.exempt, description: 'Eggs'),
    '0701': const GstRateInfo(hsnCode: '0701', gstRate: 0, gstType: GstType.nil, description: 'Potatoes'),
    '0702': const GstRateInfo(hsnCode: '0702', gstRate: 0, gstType: GstType.nil, description: 'Tomatoes'),
    '0703': const GstRateInfo(hsnCode: '0703', gstRate: 0, gstType: GstType.nil, description: 'Onions, Garlic'),
    '0706': const GstRateInfo(hsnCode: '0706', gstRate: 0, gstType: GstType.nil, description: 'Carrots, Turnips'),
    '0803': const GstRateInfo(hsnCode: '0803', gstRate: 0, gstType: GstType.exempt, description: 'Bananas'),
    '0804': const GstRateInfo(hsnCode: '0804', gstRate: 0, gstType: GstType.exempt, description: 'Mangoes, Guavas'),
    '0805': const GstRateInfo(hsnCode: '0805', gstRate: 0, gstType: GstType.exempt, description: 'Citrus Fruits'),
    '0806': const GstRateInfo(hsnCode: '0806', gstRate: 0, gstType: GstType.exempt, description: 'Grapes'),
    '0807': const GstRateInfo(hsnCode: '0807', gstRate: 0, gstType: GstType.exempt, description: 'Melons'),
    '0808': const GstRateInfo(hsnCode: '0808', gstRate: 0, gstType: GstType.exempt, description: 'Apples, Pears'),
    '4901': const GstRateInfo(hsnCode: '4901', gstRate: 0, gstType: GstType.exempt, description: 'Printed Books'),
    '4902': const GstRateInfo(hsnCode: '4902', gstRate: 0, gstType: GstType.exempt, description: 'Newspapers'),
    
    // ═══════════════════════════════════════════════════════════════
    // 5% GST - Essential food, packaged items
    // ═══════════════════════════════════════════════════════════════
    '0402': const GstRateInfo(hsnCode: '0402', gstRate: 5, gstType: GstType.taxable, description: 'Milk Powder'),
    '0901': const GstRateInfo(hsnCode: '0901', gstRate: 5, gstType: GstType.taxable, description: 'Coffee'),
    '0902': const GstRateInfo(hsnCode: '0902', gstRate: 5, gstType: GstType.taxable, description: 'Tea'),
    '1001': const GstRateInfo(hsnCode: '1001', gstRate: 5, gstType: GstType.taxable, description: 'Wheat'),
    '1006': const GstRateInfo(hsnCode: '1006', gstRate: 5, gstType: GstType.taxable, description: 'Rice'),
    '1101': const GstRateInfo(hsnCode: '1101', gstRate: 5, gstType: GstType.taxable, description: 'Wheat Flour'),
    '1507': const GstRateInfo(hsnCode: '1507', gstRate: 5, gstType: GstType.taxable, description: 'Soybean Oil'),
    '1512': const GstRateInfo(hsnCode: '1512', gstRate: 5, gstType: GstType.taxable, description: 'Sunflower Oil'),
    '1517': const GstRateInfo(hsnCode: '1517', gstRate: 5, gstType: GstType.taxable, description: 'Margarine'),
    '1701': const GstRateInfo(hsnCode: '1701', gstRate: 5, gstType: GstType.taxable, description: 'Sugar'),
    '1905': const GstRateInfo(hsnCode: '1905', gstRate: 5, gstType: GstType.taxable, description: 'Bread, Biscuits'),
    '2201': const GstRateInfo(hsnCode: '2201', gstRate: 5, gstType: GstType.taxable, description: 'Mineral Water'),
    '3004': const GstRateInfo(hsnCode: '3004', gstRate: 5, gstType: GstType.taxable, description: 'Medicines'),
    '4820': const GstRateInfo(hsnCode: '4820', gstRate: 5, gstType: GstType.taxable, description: 'Notebooks'),
    
    // ═══════════════════════════════════════════════════════════════
    // 12% GST - Processed food, textiles, furniture
    // ═══════════════════════════════════════════════════════════════
    '1704': const GstRateInfo(hsnCode: '1704', gstRate: 12, gstType: GstType.taxable, description: 'Confectionery'),
    '1806': const GstRateInfo(hsnCode: '1806', gstRate: 12, gstType: GstType.taxable, description: 'Chocolate'),
    '1902': const GstRateInfo(hsnCode: '1902', gstRate: 12, gstType: GstType.taxable, description: 'Pasta, Noodles'),
    '2005': const GstRateInfo(hsnCode: '2005', gstRate: 12, gstType: GstType.taxable, description: 'Preserved Vegetables'),
    '2007': const GstRateInfo(hsnCode: '2007', gstRate: 12, gstType: GstType.taxable, description: 'Jams, Jellies'),
    '2009': const GstRateInfo(hsnCode: '2009', gstRate: 12, gstType: GstType.taxable, description: 'Fruit Juices'),
    '2106': const GstRateInfo(hsnCode: '2106', gstRate: 12, gstType: GstType.taxable, description: 'Food Preparations'),
    '4202': const GstRateInfo(hsnCode: '4202', gstRate: 12, gstType: GstType.taxable, description: 'Bags, Wallets'),
    '6101': const GstRateInfo(hsnCode: '6101', gstRate: 12, gstType: GstType.taxable, description: 'Men Jackets'),
    '6102': const GstRateInfo(hsnCode: '6102', gstRate: 12, gstType: GstType.taxable, description: 'Women Jackets'),
    '6103': const GstRateInfo(hsnCode: '6103', gstRate: 12, gstType: GstType.taxable, description: 'Men Suits'),
    '6104': const GstRateInfo(hsnCode: '6104', gstRate: 12, gstType: GstType.taxable, description: 'Women Suits'),
    '6105': const GstRateInfo(hsnCode: '6105', gstRate: 12, gstType: GstType.taxable, description: 'Men Shirts Knitted'),
    '6106': const GstRateInfo(hsnCode: '6106', gstRate: 12, gstType: GstType.taxable, description: 'Women Blouses'),
    '6107': const GstRateInfo(hsnCode: '6107', gstRate: 12, gstType: GstType.taxable, description: 'Men Underwear'),
    '6108': const GstRateInfo(hsnCode: '6108', gstRate: 12, gstType: GstType.taxable, description: 'Women Underwear'),
    '6109': const GstRateInfo(hsnCode: '6109', gstRate: 12, gstType: GstType.taxable, description: 'T-Shirts'),
    '6110': const GstRateInfo(hsnCode: '6110', gstRate: 12, gstType: GstType.taxable, description: 'Sweaters'),
    '6115': const GstRateInfo(hsnCode: '6115', gstRate: 12, gstType: GstType.taxable, description: 'Hosiery'),
    '6201': const GstRateInfo(hsnCode: '6201', gstRate: 12, gstType: GstType.taxable, description: 'Men Coats'),
    '6203': const GstRateInfo(hsnCode: '6203', gstRate: 12, gstType: GstType.taxable, description: 'Men Trousers'),
    '6204': const GstRateInfo(hsnCode: '6204', gstRate: 12, gstType: GstType.taxable, description: 'Women Trousers'),
    '6205': const GstRateInfo(hsnCode: '6205', gstRate: 12, gstType: GstType.taxable, description: 'Men Shirts'),
    '6206': const GstRateInfo(hsnCode: '6206', gstRate: 12, gstType: GstType.taxable, description: 'Women Blouses Woven'),
    '6211': const GstRateInfo(hsnCode: '6211', gstRate: 12, gstType: GstType.taxable, description: 'Track Suits'),
    '6212': const GstRateInfo(hsnCode: '6212', gstRate: 12, gstType: GstType.taxable, description: 'Brassieres, Girdles'),
    '9404': const GstRateInfo(hsnCode: '9404', gstRate: 12, gstType: GstType.taxable, description: 'Mattresses'),
    
    // ═══════════════════════════════════════════════════════════════
    // 18% GST - Electronics, cosmetics, most goods
    // ═══════════════════════════════════════════════════════════════
    '2202': const GstRateInfo(hsnCode: '2202', gstRate: 18, gstType: GstType.taxable, description: 'Soft Drinks'),
    '3301': const GstRateInfo(hsnCode: '3301', gstRate: 18, gstType: GstType.taxable, description: 'Essential Oils'),
    '3302': const GstRateInfo(hsnCode: '3302', gstRate: 18, gstType: GstType.taxable, description: 'Flavoring'),
    '3303': const GstRateInfo(hsnCode: '3303', gstRate: 18, gstType: GstType.taxable, description: 'Perfumes'),
    '3304': const GstRateInfo(hsnCode: '3304', gstRate: 18, gstType: GstType.taxable, description: 'Beauty Products'),
    '3305': const GstRateInfo(hsnCode: '3305', gstRate: 18, gstType: GstType.taxable, description: 'Hair Products'),
    '3306': const GstRateInfo(hsnCode: '3306', gstRate: 18, gstType: GstType.taxable, description: 'Oral Hygiene'),
    '3307': const GstRateInfo(hsnCode: '3307', gstRate: 18, gstType: GstType.taxable, description: 'Deodorants'),
    '3401': const GstRateInfo(hsnCode: '3401', gstRate: 18, gstType: GstType.taxable, description: 'Soap'),
    '3402': const GstRateInfo(hsnCode: '3402', gstRate: 18, gstType: GstType.taxable, description: 'Detergent'),
    '3923': const GstRateInfo(hsnCode: '3923', gstRate: 18, gstType: GstType.taxable, description: 'Plastic Containers'),
    '3924': const GstRateInfo(hsnCode: '3924', gstRate: 18, gstType: GstType.taxable, description: 'Plastic Household'),
    '3926': const GstRateInfo(hsnCode: '3926', gstRate: 18, gstType: GstType.taxable, description: 'Plastic Articles'),
    '4011': const GstRateInfo(hsnCode: '4011', gstRate: 18, gstType: GstType.taxable, description: 'Tyres'),
    '6401': const GstRateInfo(hsnCode: '6401', gstRate: 18, gstType: GstType.taxable, description: 'Waterproof Footwear'),
    '6402': const GstRateInfo(hsnCode: '6402', gstRate: 18, gstType: GstType.taxable, description: 'Rubber Footwear'),
    '6403': const GstRateInfo(hsnCode: '6403', gstRate: 18, gstType: GstType.taxable, description: 'Leather Footwear'),
    '6404': const GstRateInfo(hsnCode: '6404', gstRate: 18, gstType: GstType.taxable, description: 'Sports Footwear'),
    '6405': const GstRateInfo(hsnCode: '6405', gstRate: 18, gstType: GstType.taxable, description: 'Other Footwear'),
    '6501': const GstRateInfo(hsnCode: '6501', gstRate: 18, gstType: GstType.taxable, description: 'Hat Forms'),
    '6504': const GstRateInfo(hsnCode: '6504', gstRate: 18, gstType: GstType.taxable, description: 'Hats, Caps'),
    '6505': const GstRateInfo(hsnCode: '6505', gstRate: 18, gstType: GstType.taxable, description: 'Knitted Hats'),
    '6601': const GstRateInfo(hsnCode: '6601', gstRate: 18, gstType: GstType.taxable, description: 'Umbrellas'),
    '6802': const GstRateInfo(hsnCode: '6802', gstRate: 18, gstType: GstType.taxable, description: 'Stone Articles'),
    '6911': const GstRateInfo(hsnCode: '6911', gstRate: 18, gstType: GstType.taxable, description: 'Tableware Porcelain'),
    '6912': const GstRateInfo(hsnCode: '6912', gstRate: 18, gstType: GstType.taxable, description: 'Ceramic Tableware'),
    '7013': const GstRateInfo(hsnCode: '7013', gstRate: 18, gstType: GstType.taxable, description: 'Glassware'),
    '7113': const GstRateInfo(hsnCode: '7113', gstRate: 18, gstType: GstType.taxable, description: 'Jewellery Articles'),
    '7117': const GstRateInfo(hsnCode: '7117', gstRate: 18, gstType: GstType.taxable, description: 'Imitation Jewellery'),
    '7323': const GstRateInfo(hsnCode: '7323', gstRate: 18, gstType: GstType.taxable, description: 'Steel Utensils'),
    '7615': const GstRateInfo(hsnCode: '7615', gstRate: 18, gstType: GstType.taxable, description: 'Aluminium Cookware'),
    '8210': const GstRateInfo(hsnCode: '8210', gstRate: 18, gstType: GstType.taxable, description: 'Kitchen Appliances'),
    '8211': const GstRateInfo(hsnCode: '8211', gstRate: 18, gstType: GstType.taxable, description: 'Knives'),
    '8214': const GstRateInfo(hsnCode: '8214', gstRate: 18, gstType: GstType.taxable, description: 'Cutlery'),
    '8215': const GstRateInfo(hsnCode: '8215', gstRate: 18, gstType: GstType.taxable, description: 'Spoons, Forks'),
    '8302': const GstRateInfo(hsnCode: '8302', gstRate: 18, gstType: GstType.taxable, description: 'Door Fittings'),
    '8414': const GstRateInfo(hsnCode: '8414', gstRate: 18, gstType: GstType.taxable, description: 'Air Pumps, Fans'),
    '8415': const GstRateInfo(hsnCode: '8415', gstRate: 18, gstType: GstType.taxable, description: 'Air Conditioners'),
    '8418': const GstRateInfo(hsnCode: '8418', gstRate: 18, gstType: GstType.taxable, description: 'Refrigerators'),
    '8422': const GstRateInfo(hsnCode: '8422', gstRate: 18, gstType: GstType.taxable, description: 'Dish Washers'),
    '8450': const GstRateInfo(hsnCode: '8450', gstRate: 18, gstType: GstType.taxable, description: 'Washing Machines'),
    '8467': const GstRateInfo(hsnCode: '8467', gstRate: 18, gstType: GstType.taxable, description: 'Power Tools'),
    '8470': const GstRateInfo(hsnCode: '8470', gstRate: 18, gstType: GstType.taxable, description: 'Calculators'),
    '8471': const GstRateInfo(hsnCode: '8471', gstRate: 18, gstType: GstType.taxable, description: 'Computers'),
    '8473': const GstRateInfo(hsnCode: '8473', gstRate: 18, gstType: GstType.taxable, description: 'Computer Parts'),
    '8504': const GstRateInfo(hsnCode: '8504', gstRate: 18, gstType: GstType.taxable, description: 'Transformers'),
    '8506': const GstRateInfo(hsnCode: '8506', gstRate: 18, gstType: GstType.taxable, description: 'Batteries'),
    '8507': const GstRateInfo(hsnCode: '8507', gstRate: 18, gstType: GstType.taxable, description: 'Accumulators'),
    '8508': const GstRateInfo(hsnCode: '8508', gstRate: 18, gstType: GstType.taxable, description: 'Vacuum Cleaners'),
    '8509': const GstRateInfo(hsnCode: '8509', gstRate: 18, gstType: GstType.taxable, description: 'Household Appliances'),
    '8510': const GstRateInfo(hsnCode: '8510', gstRate: 18, gstType: GstType.taxable, description: 'Shavers, Trimmers'),
    '8516': const GstRateInfo(hsnCode: '8516', gstRate: 18, gstType: GstType.taxable, description: 'Electric Heaters'),
    '8517': const GstRateInfo(hsnCode: '8517', gstRate: 18, gstType: GstType.taxable, description: 'Mobile Phones'),
    '8518': const GstRateInfo(hsnCode: '8518', gstRate: 18, gstType: GstType.taxable, description: 'Audio Equipment'),
    '8519': const GstRateInfo(hsnCode: '8519', gstRate: 18, gstType: GstType.taxable, description: 'Sound Recording'),
    '8521': const GstRateInfo(hsnCode: '8521', gstRate: 18, gstType: GstType.taxable, description: 'Video Players'),
    '8523': const GstRateInfo(hsnCode: '8523', gstRate: 18, gstType: GstType.taxable, description: 'Storage Media'),
    '8525': const GstRateInfo(hsnCode: '8525', gstRate: 18, gstType: GstType.taxable, description: 'Cameras'),
    '8526': const GstRateInfo(hsnCode: '8526', gstRate: 18, gstType: GstType.taxable, description: 'Radar, GPS'),
    '8527': const GstRateInfo(hsnCode: '8527', gstRate: 18, gstType: GstType.taxable, description: 'Radio Receivers'),
    '8528': const GstRateInfo(hsnCode: '8528', gstRate: 18, gstType: GstType.taxable, description: 'TVs, Monitors'),
    '8529': const GstRateInfo(hsnCode: '8529', gstRate: 18, gstType: GstType.taxable, description: 'TV Parts'),
    '8531': const GstRateInfo(hsnCode: '8531', gstRate: 18, gstType: GstType.taxable, description: 'Electric Signalling'),
    '8539': const GstRateInfo(hsnCode: '8539', gstRate: 18, gstType: GstType.taxable, description: 'Electric Lamps'),
    '8543': const GstRateInfo(hsnCode: '8543', gstRate: 18, gstType: GstType.taxable, description: 'Electric Machines'),
    '8544': const GstRateInfo(hsnCode: '8544', gstRate: 18, gstType: GstType.taxable, description: 'Wires, Cables'),
    '9001': const GstRateInfo(hsnCode: '9001', gstRate: 18, gstType: GstType.taxable, description: 'Optical Fibres'),
    '9003': const GstRateInfo(hsnCode: '9003', gstRate: 18, gstType: GstType.taxable, description: 'Spectacle Frames'),
    '9004': const GstRateInfo(hsnCode: '9004', gstRate: 18, gstType: GstType.taxable, description: 'Spectacles'),
    '9005': const GstRateInfo(hsnCode: '9005', gstRate: 18, gstType: GstType.taxable, description: 'Binoculars'),
    '9006': const GstRateInfo(hsnCode: '9006', gstRate: 18, gstType: GstType.taxable, description: 'Cameras Photo'),
    '9007': const GstRateInfo(hsnCode: '9007', gstRate: 18, gstType: GstType.taxable, description: 'Cinematographic'),
    '9101': const GstRateInfo(hsnCode: '9101', gstRate: 18, gstType: GstType.taxable, description: 'Wrist Watches'),
    '9102': const GstRateInfo(hsnCode: '9102', gstRate: 18, gstType: GstType.taxable, description: 'Other Watches'),
    '9103': const GstRateInfo(hsnCode: '9103', gstRate: 18, gstType: GstType.taxable, description: 'Clocks'),
    '9201': const GstRateInfo(hsnCode: '9201', gstRate: 18, gstType: GstType.taxable, description: 'Pianos'),
    '9202': const GstRateInfo(hsnCode: '9202', gstRate: 18, gstType: GstType.taxable, description: 'String Instruments'),
    '9205': const GstRateInfo(hsnCode: '9205', gstRate: 18, gstType: GstType.taxable, description: 'Wind Instruments'),
    '9206': const GstRateInfo(hsnCode: '9206', gstRate: 18, gstType: GstType.taxable, description: 'Percussion'),
    '9207': const GstRateInfo(hsnCode: '9207', gstRate: 18, gstType: GstType.taxable, description: 'Electronic Music'),
    '9401': const GstRateInfo(hsnCode: '9401', gstRate: 18, gstType: GstType.taxable, description: 'Seats'),
    '9403': const GstRateInfo(hsnCode: '9403', gstRate: 18, gstType: GstType.taxable, description: 'Furniture'),
    '9405': const GstRateInfo(hsnCode: '9405', gstRate: 18, gstType: GstType.taxable, description: 'Lamps, Lighting'),
    '9503': const GstRateInfo(hsnCode: '9503', gstRate: 18, gstType: GstType.taxable, description: 'Toys'),
    '9504': const GstRateInfo(hsnCode: '9504', gstRate: 18, gstType: GstType.taxable, description: 'Video Games'),
    '9505': const GstRateInfo(hsnCode: '9505', gstRate: 18, gstType: GstType.taxable, description: 'Festive Articles'),
    '9506': const GstRateInfo(hsnCode: '9506', gstRate: 18, gstType: GstType.taxable, description: 'Sports Equipment'),
    '9507': const GstRateInfo(hsnCode: '9507', gstRate: 18, gstType: GstType.taxable, description: 'Fishing Equipment'),
    '9608': const GstRateInfo(hsnCode: '9608', gstRate: 18, gstType: GstType.taxable, description: 'Pens'),
    '9609': const GstRateInfo(hsnCode: '9609', gstRate: 18, gstType: GstType.taxable, description: 'Pencils'),
    '9613': const GstRateInfo(hsnCode: '9613', gstRate: 18, gstType: GstType.taxable, description: 'Lighters'),
    '9615': const GstRateInfo(hsnCode: '9615', gstRate: 18, gstType: GstType.taxable, description: 'Combs, Hair Pins'),
    '9617': const GstRateInfo(hsnCode: '9617', gstRate: 18, gstType: GstType.taxable, description: 'Vacuum Flasks'),
    '9619': const GstRateInfo(hsnCode: '9619', gstRate: 18, gstType: GstType.taxable, description: 'Sanitary Pads'),
    
    // ═══════════════════════════════════════════════════════════════
    // 28% GST - Luxury items, automobiles
    // ═══════════════════════════════════════════════════════════════
    '2402': const GstRateInfo(hsnCode: '2402', gstRate: 28, gstType: GstType.taxable, description: 'Cigars'),
    '2403': const GstRateInfo(hsnCode: '2403', gstRate: 28, gstType: GstType.taxable, description: 'Tobacco Products'),
    '8702': const GstRateInfo(hsnCode: '8702', gstRate: 28, gstType: GstType.taxable, description: 'Buses'),
    '8703': const GstRateInfo(hsnCode: '8703', gstRate: 28, gstType: GstType.taxable, description: 'Motor Cars'),
    '8711': const GstRateInfo(hsnCode: '8711', gstRate: 28, gstType: GstType.taxable, description: 'Motorcycles'),
    '8903': const GstRateInfo(hsnCode: '8903', gstRate: 28, gstType: GstType.taxable, description: 'Yachts'),
  };

  /// Lookup GST rate by HSN code
  static Future<GstRateInfo> lookupHsn(String hsnCode) async {
    if (hsnCode.isEmpty) return GstRateInfo.unknown(hsnCode);
    
    // Check cache first
    if (_cache.containsKey(hsnCode)) {
      return _cache[hsnCode]!;
    }
    
    // Check local fallback (first 4 digits)
    final prefix = hsnCode.length >= 4 ? hsnCode.substring(0, 4) : hsnCode;
    if (_commonHsnRates.containsKey(prefix)) {
      _cache[hsnCode] = _commonHsnRates[prefix]!;
      return _commonHsnRates[prefix]!;
    }
    
    // Try Firestore lookup
    try {
      final doc = await _firestore.collection('hsn_codes').doc(prefix).get();
      if (doc.exists) {
        final info = GstRateInfo.fromMap(doc.data()!);
        _cache[hsnCode] = info;
        return info;
      }
    } catch (e) {
      // Firestore lookup failed, use default
    }
    
    // Return default 18%
    return GstRateInfo.unknown(hsnCode);
  }

  /// Check if seller can list product (based on GST status)
  static bool canSellerListProduct({
    required SellerGstStatus sellerStatus,
    required GstRateInfo gstInfo,
  }) {
    // If product is exempt, any seller can list
    if (gstInfo.isExempt) return true;
    
    // If taxable, seller must be registered
    return sellerStatus == SellerGstStatus.registered;
  }

  /// Get validation message for seller/product combination
  static String? getValidationMessage({
    required SellerGstStatus sellerStatus,
    required GstRateInfo gstInfo,
  }) {
    if (gstInfo.isExempt) {
      return null; // No issue
    }
    
    if (sellerStatus == SellerGstStatus.unregistered) {
      return 'This product requires GST registration. Please update your GST details or choose GST-exempt products.';
    }
    
    return null;
  }

  /// Get invoice type based on seller status
  static String getInvoiceType(SellerGstStatus sellerStatus) {
    return sellerStatus == SellerGstStatus.registered
        ? 'Tax Invoice'
        : 'Bill of Supply';
  }

  /// Common GST rates for dropdown
  static const List<double> commonGstRates = [0, 5, 12, 18, 28];
}
