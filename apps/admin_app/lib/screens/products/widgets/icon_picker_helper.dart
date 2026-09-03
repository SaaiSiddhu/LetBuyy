// lib/screens/admin/products/widgets/icon_picker_helper.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart'; // Or any icon pack

class IconPickerHelper {
  // A map of string names to IconData
  // The 'key' is what's stored in Firestore.
  static final Map<String, IconData> kAppIcons = {
    'default': Icons.category_rounded,
    'grocery': Icons.shopping_basket_rounded,
    'dairy': Icons.icecream_rounded,
    'vegetables': FontAwesomeIcons.carrot.data,
    'fruits': FontAwesomeIcons.appleWhole.data,
    'meat': FontAwesomeIcons.drumstickBite.data,
    'drinks': Icons.local_drink_rounded,
    'snacks': Icons.fastfood_rounded,
    'household': Icons.home_rounded,
    'tools': Icons.build_rounded,
    'seeds': FontAwesomeIcons.seedling.data,
    'fertilizer': FontAwesomeIcons.leaf.data,
    'hygiene': Icons.clean_hands_rounded,
    'electronics': Icons.electrical_services_rounded,
    'pets': Icons.pets_rounded,
    'bakery': Icons.bakery_dining_rounded,
  };

  // Gets an icon by its string name, or returns a default
  static IconData getIcon(String? iconName) {
    if (iconName == null || iconName.isEmpty) {
      return kAppIcons['default']!;
    }
    return kAppIcons[iconName.toLowerCase()] ?? kAppIcons['default']!;
  }
}