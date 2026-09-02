DateTime? parseDateTime(Object? value) {
  if (value == null) {
    return null;
  }
  if (value is DateTime) {
    return value;
  }
  if (value is String && value.isNotEmpty) {
    return DateTime.parse(value);
  }
  return null;
}

double parseDouble(Object? value, [double defaultValue = 0]) {
  if (value == null) {
    return defaultValue;
  }
  if (value is num) {
    return value.toDouble();
  }
  return double.tryParse(value.toString()) ?? defaultValue;
}

int parseInt(Object? value, [int defaultValue = 0]) {
  if (value == null) {
    return defaultValue;
  }
  if (value is num) {
    return value.toInt();
  }
  return int.tryParse(value.toString()) ?? defaultValue;
}

bool parseBool(Object? value, [bool defaultValue = false]) {
  if (value == null) {
    return defaultValue;
  }
  if (value is bool) {
    return value;
  }
  return value.toString() == 'true';
}

List<String> parseStringList(Object? value) {
  if (value is List) {
    return value.map((item) => item.toString()).toList(growable: false);
  }
  return const [];
}

Map<String, dynamic> parseMap(Object? value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return value.map((key, item) => MapEntry(key.toString(), item));
  }
  return const {};
}

bool listEquals<T>(List<T> left, List<T> right) {
  if (identical(left, right)) {
    return true;
  }
  if (left.length != right.length) {
    return false;
  }
  for (var index = 0; index < left.length; index += 1) {
    if (left[index] != right[index]) {
      return false;
    }
  }
  return true;
}

bool mapEquals(Map<String, dynamic> left, Map<String, dynamic> right) {
  if (identical(left, right)) {
    return true;
  }
  if (left.length != right.length) {
    return false;
  }
  for (final entry in left.entries) {
    if (!right.containsKey(entry.key) || right[entry.key] != entry.value) {
      return false;
    }
  }
  return true;
}

int listHash<T>(List<T> value) => Object.hashAll(value);

int mapHash(Map<String, dynamic> value) {
  return Object.hashAll(
    value.entries.map((entry) => Object.hash(entry.key, entry.value)),
  );
}
