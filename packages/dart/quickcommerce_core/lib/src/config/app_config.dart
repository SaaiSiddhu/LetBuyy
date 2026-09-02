class AppConfig {
  const AppConfig._();

  static const appEnv = String.fromEnvironment(
    'APP_ENV',
    defaultValue: 'development',
  );

  static const supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://REPLACE_WITH_YOUR_PROJECT.supabase.co',
  );

  static const supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: 'REPLACE_WITH_ANON_KEY',
  );

  static const cloudflareWorkerUrl = String.fromEnvironment(
    'CLOUDFLARE_WORKER_URL',
    defaultValue: 'https://api.REPLACE_WITH_YOUR_DOMAIN.workers.dev',
  );

  static const googleMapsApiKey = String.fromEnvironment(
    'GOOGLE_MAPS_API_KEY',
    defaultValue: 'REPLACE_WITH_GOOGLE_MAPS_API_KEY',
  );

  static bool get isDevelopment => appEnv == 'development';
}
