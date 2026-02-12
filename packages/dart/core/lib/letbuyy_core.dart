/// Core utilities, constants, and extensions for LetBuyy apps
library;

// Config
export 'src/config/razorpay_config.dart';
export 'src/config/gemini_config.dart';
export 'src/config/supabase_config.dart';

// Constants
export 'src/constants/app_constants.dart';
export 'src/constants/firebase_constants.dart';
export 'src/constants/storage_constants.dart';
export 'src/constants/api_constants.dart';

// Error
export 'src/error/exceptions.dart';
export 'src/error/failures.dart';

// Utils
export 'src/utils/validators.dart';
export 'src/utils/snackbar_helper.dart';
export 'src/utils/dialog_helper.dart';
export 'src/utils/date_formatter.dart';
export 'src/utils/price_formatter.dart';
export 'src/utils/image_picker_helper.dart';
export 'src/utils/url_launcher_helper.dart';

// Responsive
export 'src/responsive/responsive.dart';

// Services
export 'src/services/shared_preferences_service.dart';

// Web Utilities (Mobile Web keyboard handling)
export 'src/web/web.dart';

// Re-export device_info_plus for convenience
export 'package:device_info_plus/device_info_plus.dart';
