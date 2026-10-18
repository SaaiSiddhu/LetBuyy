// lib/config/gemini_config.dart
class GeminiConfig {
  static const String apiKey = String.fromEnvironment('GEMINI_API_KEY');
  static const String baseUrl = String.fromEnvironment(
    'GEMINI_BASE_URL',
    defaultValue:
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
  );
  static const String modelName = String.fromEnvironment(
    'GEMINI_MODEL',
    defaultValue: 'gemini-2.5-flash',
  );
}
