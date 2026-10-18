import 'package:flutter/material.dart';

class PayoutStatementDetailSheet extends StatefulWidget {
  const PayoutStatementDetailSheet({super.key, required this.load});

  final Future<Map<String, dynamic>> Function() load;

  @override
  State<PayoutStatementDetailSheet> createState() =>
      _PayoutStatementDetailSheetState();
}

class _PayoutStatementDetailSheetState
    extends State<PayoutStatementDetailSheet> {
  late final Future<Map<String, dynamic>> _details = widget.load();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(context).height * 0.82,
          ),
          child: FutureBuilder<Map<String, dynamic>>(
            future: _details,
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done) {
                return const SizedBox(
                  height: 180,
                  child: Center(child: CircularProgressIndicator()),
                );
              }
              if (snapshot.hasError || !snapshot.hasData) {
                return const SizedBox(
                  height: 180,
                  child: Center(child: Text('Payout details are unavailable.')),
                );
              }

              final payout = snapshot.data!;
              final lineage = _maps(payout['source_order_lineage']);
              return ListView(
                shrinkWrap: true,
                children: [
                  Text(
                    payout['statement_number']?.toString() ??
                        'Payout statement',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${payout['status'] ?? 'unknown'} · ${payout['provider_mode'] ?? 'provider mode unavailable'}',
                    key: const ValueKey('payout-detail-status'),
                  ),
                  const SizedBox(height: 16),
                  _amount('Gross recorded', payout['gross_amount_minor']),
                  _amount(
                    'Platform fee recorded',
                    payout['platform_fee_minor'],
                  ),
                  _amount('Tax recorded', payout['tax_minor']),
                  _amount('Net statement amount', payout['net_amount_minor']),
                  if ((payout['utr'] ?? payout['provider_reference']) != null)
                    _detail(
                      'Provider reference',
                      (payout['utr'] ?? payout['provider_reference'])
                          .toString(),
                    ),
                  const SizedBox(height: 12),
                  Text(
                    'Source-order ledger detail',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  if (lineage.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 12),
                      child: Text('No source-order lineage is recorded.'),
                    ),
                  for (final order in lineage) ...[
                    const Divider(),
                    Text('Order ${order['order_id'] ?? 'unknown'}'),
                    _amount(
                      'Source order gross',
                      order['source_order_gross_minor'],
                    ),
                    _amount(
                      'Canonical payable change',
                      order['canonical_merchant_payable_delta_minor'],
                    ),
                    _detail(
                      'Lineage status',
                      order['lineage_status']?.toString() ?? 'unknown',
                    ),
                    for (final transaction in _maps(
                      order['ledger_transactions'],
                    ))
                      _detail(
                        transaction['source_type']?.toString() ??
                            'Ledger transaction',
                        _formatMinor(
                          transaction['merchant_payable_delta_minor'],
                        ),
                      ),
                  ],
                  const SizedBox(height: 12),
                  const Text(
                    'These are recorded statement and ledger values. Source lineage does not determine payout eligibility.',
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _amount(String label, Object? value) =>
      _detail(label, _formatMinor(value));

  Widget _detail(String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: Text(label)),
        const SizedBox(width: 12),
        Flexible(child: Text(value, textAlign: TextAlign.end)),
      ],
    ),
  );

  List<Map<String, dynamic>> _maps(Object? value) => value is List
      ? value.whereType<Map>().map(Map<String, dynamic>.from).toList()
      : const [];

  String _formatMinor(Object? value) {
    final minor = value is num ? value.toInt() : int.tryParse('$value') ?? 0;
    final absolute = minor.abs();
    return '${minor < 0 ? '-' : ''}₹${absolute ~/ 100}.${(absolute % 100).toString().padLeft(2, '0')}';
  }
}
