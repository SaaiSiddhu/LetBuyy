import 'section_model.dart';

/// Model representing the complete template configuration for a store
/// Contains theme settings and all sections with their configurations
class StoreTemplateModel {
  final String storeId;
  final String themeId;
  final ThemeSettings themeSettings;
  final List<SectionModel> sections;
  final DateTime createdAt;
  final DateTime updatedAt;

  const StoreTemplateModel({
    required this.storeId,
    required this.themeId,
    required this.themeSettings,
    this.sections = const [],
    required this.createdAt,
    required this.updatedAt,
  });

  /// Create from a gateway/template map.
  factory StoreTemplateModel.fromMap(Map<String, dynamic> map) {
    return StoreTemplateModel(
      storeId: map['storeId'] as String? ?? '',
      themeId: map['themeId'] as String? ?? 'minimal_modern',
      themeSettings: ThemeSettings.fromMap(
        Map<String, dynamic>.from(map['themeSettings'] as Map? ?? {}),
      ),
      sections:
          (map['sections'] as List<dynamic>?)
              ?.map(
                (s) =>
                    SectionModel.fromMap(Map<String, dynamic>.from(s as Map)),
              )
              .toList() ??
          [],
      createdAt: _parseDateTime(map['createdAt']),
      updatedAt: _parseDateTime(map['updatedAt']),
    );
  }

  /// Helper to parse DateTime from gateway data or legacy timestamp objects.
  static DateTime _parseDateTime(dynamic value) {
    if (value == null) return DateTime.now();
    if (value is DateTime) return value;
    if (value is String) {
      try {
        return DateTime.parse(value);
      } catch (_) {
        return DateTime.now();
      }
    }
    if (value.runtimeType.toString().contains('Timestamp')) {
      try {
        return value.toDate() as DateTime;
      } catch (_) {
        return DateTime.now();
      }
    }
    return DateTime.now();
  }

  /// Convert to a gateway/template map.
  Map<String, dynamic> toMap() {
    return {
      'storeId': storeId,
      'themeId': themeId,
      'themeSettings': themeSettings.toMap(),
      'sections': sections.map((s) => s.toMap()).toList(),
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  /// Create a copy with updated fields
  StoreTemplateModel copyWith({
    String? storeId,
    String? themeId,
    ThemeSettings? themeSettings,
    List<SectionModel>? sections,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return StoreTemplateModel(
      storeId: storeId ?? this.storeId,
      themeId: themeId ?? this.themeId,
      themeSettings: themeSettings ?? this.themeSettings,
      sections: sections ?? this.sections,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? DateTime.now(),
    );
  }

  /// Get sections sorted by order
  List<SectionModel> get sortedSections {
    final sorted = List<SectionModel>.from(sections);
    sorted.sort((a, b) => a.order.compareTo(b.order));
    return sorted;
  }

  /// Get only visible sections
  List<SectionModel> get visibleSections {
    return sortedSections.where((s) => s.isVisible).toList();
  }

  /// Find section by ID
  SectionModel? getSectionById(String sectionId) {
    try {
      return sections.firstWhere((s) => s.id == sectionId);
    } catch (_) {
      return null;
    }
  }

  /// Find section by type
  List<SectionModel> getSectionsByType(SectionType type) {
    return sections.where((s) => s.type == type).toList();
  }

  /// Add a new section
  StoreTemplateModel addSection(SectionModel section) {
    // Get the max order value and add 1
    final maxOrder = sections.isEmpty
        ? 0
        : sections.map((s) => s.order).reduce((a, b) => a > b ? a : b);

    final newSection = section.copyWith(order: maxOrder + 1);
    return copyWith(sections: [...sections, newSection]);
  }

  /// Update an existing section
  StoreTemplateModel updateSection(SectionModel section) {
    return copyWith(
      sections: sections.map((s) => s.id == section.id ? section : s).toList(),
    );
  }

  /// Remove a section by ID
  StoreTemplateModel removeSection(String sectionId) {
    final section = getSectionById(sectionId);
    if (section != null && section.type.isRequired) {
      throw Exception(
        'Cannot remove required section: ${section.type.displayName}',
      );
    }
    return copyWith(
      sections: sections.where((s) => s.id != sectionId).toList(),
    );
  }

  /// Reorder sections
  StoreTemplateModel reorderSections(int oldIndex, int newIndex) {
    final sorted = sortedSections;
    final section = sorted.removeAt(oldIndex);
    sorted.insert(newIndex, section);

    // Update order values
    final reorderedSections = sorted.asMap().entries.map((entry) {
      return entry.value.copyWith(order: entry.key);
    }).toList();

    return copyWith(sections: reorderedSections);
  }

  /// Toggle section visibility
  StoreTemplateModel toggleSectionVisibility(String sectionId) {
    return copyWith(
      sections: sections.map((s) {
        if (s.id == sectionId) {
          return s.copyWith(isVisible: !s.isVisible);
        }
        return s;
      }).toList(),
    );
  }

  /// Check if a section type can be added (based on maxInstances)
  bool canAddSectionType(SectionType type) {
    final existingCount = getSectionsByType(type).length;
    return existingCount < type.maxInstances;
  }

  @override
  String toString() =>
      'StoreTemplateModel(storeId: $storeId, themeId: $themeId, sections: ${sections.length})';
}

/// Theme customization settings for a store
class ThemeSettings {
  final String primaryColor;
  final String secondaryColor;
  final String accentColor;
  final String backgroundColor;
  final String textColor;
  final String fontFamily;
  final String headingFontFamily;
  final double borderRadius;
  final bool enableAnimations;
  final bool enableShadows;

  const ThemeSettings({
    this.primaryColor = '#00B3B3',
    this.secondaryColor = '#008080',
    this.accentColor = '#A4E500',
    this.backgroundColor = '#FFFFFF',
    this.textColor = '#1A1A2E',
    this.fontFamily = 'Inter',
    this.headingFontFamily = 'Inter',
    this.borderRadius = 12.0,
    this.enableAnimations = true,
    this.enableShadows = true,
  });

  /// Create from a gateway/template map.
  factory ThemeSettings.fromMap(Map<String, dynamic> map) {
    return ThemeSettings(
      primaryColor: map['primaryColor'] as String? ?? '#00B3B3',
      secondaryColor: map['secondaryColor'] as String? ?? '#008080',
      accentColor: map['accentColor'] as String? ?? '#A4E500',
      backgroundColor: map['backgroundColor'] as String? ?? '#FFFFFF',
      textColor: map['textColor'] as String? ?? '#1A1A2E',
      fontFamily: map['fontFamily'] as String? ?? 'Inter',
      headingFontFamily: map['headingFontFamily'] as String? ?? 'Inter',
      borderRadius: (map['borderRadius'] as num?)?.toDouble() ?? 12.0,
      enableAnimations: map['enableAnimations'] as bool? ?? true,
      enableShadows: map['enableShadows'] as bool? ?? true,
    );
  }

  /// Convert to a gateway/template map.
  Map<String, dynamic> toMap() {
    return {
      'primaryColor': primaryColor,
      'secondaryColor': secondaryColor,
      'accentColor': accentColor,
      'backgroundColor': backgroundColor,
      'textColor': textColor,
      'fontFamily': fontFamily,
      'headingFontFamily': headingFontFamily,
      'borderRadius': borderRadius,
      'enableAnimations': enableAnimations,
      'enableShadows': enableShadows,
    };
  }

  /// Create a copy with updated fields
  ThemeSettings copyWith({
    String? primaryColor,
    String? secondaryColor,
    String? accentColor,
    String? backgroundColor,
    String? textColor,
    String? fontFamily,
    String? headingFontFamily,
    double? borderRadius,
    bool? enableAnimations,
    bool? enableShadows,
  }) {
    return ThemeSettings(
      primaryColor: primaryColor ?? this.primaryColor,
      secondaryColor: secondaryColor ?? this.secondaryColor,
      accentColor: accentColor ?? this.accentColor,
      backgroundColor: backgroundColor ?? this.backgroundColor,
      textColor: textColor ?? this.textColor,
      fontFamily: fontFamily ?? this.fontFamily,
      headingFontFamily: headingFontFamily ?? this.headingFontFamily,
      borderRadius: borderRadius ?? this.borderRadius,
      enableAnimations: enableAnimations ?? this.enableAnimations,
      enableShadows: enableShadows ?? this.enableShadows,
    );
  }

  /// Generate CSS variables from theme settings
  String toCssVariables() {
    return '''
:root {
  --primary-color: $primaryColor;
  --secondary-color: $secondaryColor;
  --accent-color: $accentColor;
  --background-color: $backgroundColor;
  --text-color: $textColor;
  --font-family: '$fontFamily', sans-serif;
  --heading-font-family: '$headingFontFamily', sans-serif;
  --border-radius: ${borderRadius}px;
}
''';
  }

  @override
  String toString() =>
      'ThemeSettings(primary: $primaryColor, font: $fontFamily)';
}

/// Predefined theme presets
class ThemePresets {
  ThemePresets._();

  static const ThemeSettings minimal = ThemeSettings(
    primaryColor: '#000000',
    secondaryColor: '#333333',
    accentColor: '#E5E5E5',
    fontFamily: 'Inter',
    borderRadius: 0,
    enableShadows: false,
  );

  static const ThemeSettings modern = ThemeSettings(
    primaryColor: '#00B3B3',
    secondaryColor: '#008080',
    accentColor: '#A4E500',
    fontFamily: 'Inter',
    borderRadius: 12,
  );

  static const ThemeSettings vibrant = ThemeSettings(
    primaryColor: '#FF6B6B',
    secondaryColor: '#4ECDC4',
    accentColor: '#FFE66D',
    fontFamily: 'Poppins',
    borderRadius: 16,
  );

  static const ThemeSettings elegant = ThemeSettings(
    primaryColor: '#2C3E50',
    secondaryColor: '#8E44AD',
    accentColor: '#F39C12',
    fontFamily: 'Playfair Display',
    headingFontFamily: 'Playfair Display',
    borderRadius: 8,
  );

  static const ThemeSettings tech = ThemeSettings(
    primaryColor: '#6366F1',
    secondaryColor: '#8B5CF6',
    accentColor: '#06B6D4',
    fontFamily: 'JetBrains Mono',
    borderRadius: 8,
    enableAnimations: true,
  );

  static const ThemeSettings nature = ThemeSettings(
    primaryColor: '#22C55E',
    secondaryColor: '#84CC16',
    accentColor: '#EAB308',
    fontFamily: 'Nunito',
    borderRadius: 20,
  );

  /// Get all available presets
  static Map<String, ThemeSettings> get all => {
    'minimal': minimal,
    'modern': modern,
    'vibrant': vibrant,
    'elegant': elegant,
    'tech': tech,
    'nature': nature,
  };

  /// Get preset by ID
  static ThemeSettings? getById(String id) => all[id];
}
