import 'package:intl/intl.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';

String orderText(Object? value, {String fallback = 'Unavailable'}) => value is String && value.trim().isNotEmpty ? value.trim() : fallback;

String orderTitle(JsonMap order) {
  final number = order['order_number'];
  if (number is String && number.trim().isNotEmpty) return number;
  final id = orderText(order['id'], fallback: '');
  return id.isEmpty ? 'Order' : 'Order ${id.length > 8 ? id.substring(0, 8) : id}';
}

String orderAmount(Object? amount, Object? currency) {
  if (amount is! num || !amount.isFinite) return 'Unavailable';
  if (currency is! String || !RegExp(r'^[A-Z]{3}$').hasMatch(currency)) {
    return '${amount.toStringAsFixed(2)} (currency unavailable)';
  }
  return NumberFormat.simpleCurrency(locale: 'en_IN', name: currency).format(amount);
}

String orderDate(Object? value) {
  final date = value is String ? DateTime.tryParse(value) : null;
  return date == null ? 'Date unavailable' : DateFormat.yMMMd().add_jm().format(date.toLocal());
}

/// The canonical checkout AddressSchema and stored CustomerAddress snapshot use
/// these published field names. Only display address fields from the owned read.
String orderShippingAddress(Object? value) {
  if (value is! Map) return '';
  return [value['name'] ?? value['full_name'], value['line1'] ?? value['address_line1'],
    value['line2'] ?? value['address_line2'], value['city'], value['state'],
    value['zip'] ?? value['postal_code'], value['country'], value['phone']]
      .whereType<String>().where((part) => part.trim().isNotEmpty).join('\n');
}
