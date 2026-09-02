enum RealtimeChannelScope {
  user,
  delivery,
  rider,
  store,
  operations,
}

class RealtimeChannel {
  const RealtimeChannel({
    required this.scope,
    required this.name,
  });

  final RealtimeChannelScope scope;
  final String name;
}

final class RealtimeChannels {
  const RealtimeChannels._();

  static RealtimeChannel userOrders(String userId) => RealtimeChannel(
        scope: RealtimeChannelScope.user,
        name: 'user.orders.$userId',
      );

  static RealtimeChannel userNotifications(String userId) => RealtimeChannel(
        scope: RealtimeChannelScope.user,
        name: 'user.notifications.$userId',
      );

  static RealtimeChannel deliveryLive(String deliveryId) => RealtimeChannel(
        scope: RealtimeChannelScope.delivery,
        name: 'delivery.live.$deliveryId',
      );

  static RealtimeChannel riderOffer(String riderId) => RealtimeChannel(
        scope: RealtimeChannelScope.rider,
        name: 'rider.offer.$riderId',
      );

  static RealtimeChannel storeQueue(String storeId) => RealtimeChannel(
        scope: RealtimeChannelScope.store,
        name: 'store.queue.$storeId',
      );

  static RealtimeChannel opsCity(String cityId) => RealtimeChannel(
        scope: RealtimeChannelScope.operations,
        name: 'ops.city.$cityId',
      );
}
