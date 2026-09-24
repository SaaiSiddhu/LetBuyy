// lib/data/business_categories.dart
// GST-based business category access control for LetBuyy sellers

/// GST-EXEMPT Categories (No GSTIN Required)
/// Sellers without GST registration can only sell in these categories
const Map<String, List<String>> gstExemptCategories = {
  'Books & Stationery': [
    'Books',
    'Educational Materials',
    'Newspapers',
    'Magazines',
  ],
  'Handmade & Crafts': [
    'Handloom & Textiles',
    'Handmade Jewelry',
    'Art & Collectibles',
    'Customized Gifts',
  ],
  'Agricultural & Fresh': [
    'Fresh Fruits & Vegetables',
    'Unbranded Grains & Pulses',
    'Seeds & Plants',
  ],
  'Organic & Natural': [
    'Unbranded Honey',
    'Jaggery',
    'Unprocessed Spices',
  ],
};

/// GST-REQUIRED Categories (GSTIN Mandatory)
/// Sellers with GST registration can access all categories including these
const Map<String, List<String>> gstRequiredCategories = {
  'Fashion & Apparel': [
    "Men's Clothing",
    "Women's Clothing",
    "Kids' Clothing",
    'Footwear',
    'Bags & Luggage',
    'Watches',
    'Jewelry & Accessories',
    'Ethnic Wear',
    'Sportswear',
  ],
  'Electronics': [
    'Mobile Phones & Tablets',
    'Laptops & Computers',
    'Audio & Headphones',
    'Cameras & Photography',
    'TV & Home Entertainment',
    'Gaming & Consoles',
    'Wearables & Smartwatches',
    'Computer Accessories',
  ],
  'Home & Living': [
    'Furniture',
    'Home Decor',
    'Kitchen & Dining',
    'Bedding & Bath',
    'Lighting',
    'Storage & Organization',
    'Garden & Outdoor',
  ],
  'Beauty & Personal Care': [
    'Skincare',
    'Makeup & Cosmetics',
    'Haircare',
    'Fragrances',
    "Men's Grooming",
    'Personal Hygiene',
    'Wellness & Ayurveda',
  ],
  'Health & Wellness': [
    'Vitamins & Supplements',
    'Medical Devices',
    'Fitness Equipment',
    'Health Monitors',
    'Ayurvedic Products',
  ],
  'Grocery & Food (Branded)': [
    'Staples & Cooking Essentials',
    'Snacks & Beverages',
    'Dairy & Eggs',
    'Organic & Gourmet',
    'Spices & Masalas',
    'Ready to Eat',
  ],
  'Baby & Kids': [
    'Baby Clothing',
    'Diapers & Baby Care',
    'Toys & Games',
    'Baby Gear & Nursery',
    "Kids' Learning & Education",
  ],
  'Sports & Fitness': [
    'Exercise & Gym Equipment',
    'Sports Gear',
    'Outdoor & Adventure',
    'Cycling',
    'Yoga & Meditation',
  ],
  'Automotive': [
    'Car Accessories',
    'Bike Accessories',
    'Car Electronics',
    'Oils & Lubricants',
    'Tools & Equipment',
  ],
  'Pet Supplies': [
    'Pet Food',
    'Pet Accessories',
    'Pet Grooming',
    'Pet Health',
  ],
  'Industrial & Business': [
    'Office Equipment',
    'Industrial Tools',
    'Safety & Security',
    'Packaging Supplies',
  ],
};

/// Icons for each main category
const Map<String, String> categoryIcons = {
  // GST Exempt
  'Books & Stationery': '📚',
  'Handmade & Crafts': '🎨',
  'Agricultural & Fresh': '🌾',
  'Organic & Natural': '🍯',
  // GST Required
  'Fashion & Apparel': '👗',
  'Electronics': '📱',
  'Home & Living': '🏠',
  'Beauty & Personal Care': '💄',
  'Health & Wellness': '💊',
  'Grocery & Food (Branded)': '🛒',
  'Baby & Kids': '👶',
  'Sports & Fitness': '🏃',
  'Automotive': '🚗',
  'Pet Supplies': '🐕',
  'Industrial & Business': '🏭',
};

/// Get all categories based on GST status
Map<String, List<String>> getCategoriesForGstStatus(bool hasGstin) {
  if (hasGstin) {
    // All categories available
    return {...gstRequiredCategories, ...gstExemptCategories};
  } else {
    // Only exempt categories
    return gstExemptCategories;
  }
}

/// Get list of main category names based on GST status
List<String> getMainCategories(bool hasGstin) {
  if (hasGstin) {
    return [...gstRequiredCategories.keys, ...gstExemptCategories.keys];
  } else {
    return gstExemptCategories.keys.toList();
  }
}

/// Get sub-categories for a given main category
List<String> getSubCategories(String mainCategory) {
  if (gstRequiredCategories.containsKey(mainCategory)) {
    return gstRequiredCategories[mainCategory]!;
  } else if (gstExemptCategories.containsKey(mainCategory)) {
    return gstExemptCategories[mainCategory]!;
  }
  return [];
}

/// Check if a category requires GST
bool categoryRequiresGst(String mainCategory) {
  return gstRequiredCategories.containsKey(mainCategory);
}

/// GST State Codes (first 2 digits of GSTIN)
const Map<String, String> gstStateCodes = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

/// Validate GSTIN format
bool validateGstin(String gstin) {
  if (gstin.length != 15) return false;
  // GSTIN format: 33AABCU9603R1ZM (2 digits + 5 letters + 4 digits + 1 letter + 1 alphanumeric + Z + 1 alphanumeric)
  final regex = RegExp(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$');
  return regex.hasMatch(gstin.toUpperCase());
}

/// Get state name from GSTIN
String? getStateFromGstin(String gstin) {
  if (gstin.length < 2) return null;
  final stateCode = gstin.substring(0, 2);
  return gstStateCodes[stateCode];
}
