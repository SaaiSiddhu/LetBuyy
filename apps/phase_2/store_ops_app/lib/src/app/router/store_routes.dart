final class StoreRoutes {
  const StoreRoutes._();

  static const queue = '/queue';
  static const pickPack = '/pick-pack';
  static const pickPackOrder = '/pick-pack/:orderId';
  static const inventory = '/inventory';
  static const handoff = '/handoff';
  static const onboarding = '/onboarding';

  static String pickPackForOrder(String orderId) => '/pick-pack/$orderId';
}
