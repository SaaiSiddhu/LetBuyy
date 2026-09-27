/// Shared UI components, themes, and widgets for LetBuyy apps
library;

// Themes
export 'src/themes/app_colors.dart';
export 'src/themes/app_fonts.dart';
export 'src/themes/app_theme.dart';
export 'src/themes/app_text_styles.dart';

// Common Widgets
export 'src/widgets/network_image_widget.dart';
export 'src/widgets/loading_indicator.dart';
export 'src/widgets/loading_overlay.dart';
export 'src/widgets/error_widget.dart';
export 'src/widgets/error_view.dart';
export 'src/widgets/empty_state.dart';
export 'src/widgets/empty_state_widget.dart';
export 'src/widgets/shimmer_loading.dart';
export 'src/widgets/custom_button.dart';
export 'src/widgets/custom_text_field.dart';
// update_dialog.dart retired (C3 corrective, 27 September 2026 review continuation): zero live
// callers -- app_update_model.dart (its only reason to exist) was deleted alongside it.
export 'src/widgets/glass_container.dart';
export 'src/widgets/custom_app_bar.dart';
export 'src/widgets/custom_bottom_nav.dart';
export 'src/widgets/custom_drawer.dart';
export 'src/widgets/badge_widget.dart';
export 'src/widgets/confirmation_dialog.dart';
export 'src/widgets/rating_widget.dart';
export 'src/widgets/search_bar_widget.dart';
