import 'package:flutter/material.dart';

import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../widgets/common.dart';
import 'delivery_detail_screen.dart';

/// Traceability one step back (where a product or batch came from) and one step forward
/// (what is left and who it was dispatched to), with a one-tap recall that holds the stock.
class TraceScreen extends StatefulWidget {
  const TraceScreen({super.key});
  @override
  State<TraceScreen> createState() => _TraceScreenState();
}

class _TraceScreenState extends State<TraceScreen> {
  final _search = TextEditingController();
  String _term = '';

  Future<void> _recall(List lotIds) async {
    final reason = await promptText(
      context,
      title: 'Recall: put ${lotIds.length} lot(s) on hold',
      label: 'Reason (e.g. supplier recall notice)',
      confirm: 'Hold stock',
    );
    if (reason == null || !mounted) return;
    final res = await context.run(
      () => context.m('stock:recall', {'lotIds': lotIds, 'reason': reason}),
    );
    if (res != null && mounted) {
      context.toast('${res['held']} lot(s) on hold. Corrective action raised');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Trace & Recall')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Responsive(
              child: TextField(
                controller: _search,
                textInputAction: TextInputAction.search,
                onSubmitted: (v) => setState(() => _term = v.trim()),
                decoration: InputDecoration(
                  hintText: 'Batch code, product name or barcode',
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: IconButton(
                    icon: const Icon(Icons.arrow_forward),
                    onPressed: () =>
                        setState(() => _term = _search.text.trim()),
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: _term.isEmpty
                ? const EmptyState(
                    icon: Icons.manage_search,
                    title: 'Find affected stock',
                    message: 'If a supplier issues a recall, search the batch code to see when it arrived, who received it and how much.',
                  )
                : QueryBuilder(
                    path: 'deliveries:trace',
                    args: {'search': _term},
                    builder: (context, data) {
                      final list = data as List;
                      if (list.isEmpty) {
                        return const EmptyState(
                          icon: Icons.search_off,
                          title: 'No matches',
                        );
                      }
                      final holdable = [
                        for (final it in list)
                          if (it['lot']?['status'] == 'available')
                            it['lot']['_id'],
                      ];
                      final canRecall =
                          context.watch<AuthService>().user!.isManager &&
                          holdable.isNotEmpty;
                      return ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                        itemCount: list.length + (canRecall ? 1 : 0),
                        separatorBuilder: (_, _) => const SizedBox(height: 8),
                        itemBuilder: (context, i) {
                          if (canRecall && i == 0) {
                            return Responsive(
                              child: FilledButton.icon(
                                onPressed: () => _recall(holdable),
                                icon: const Icon(Icons.block),
                                label: Text(
                                  'Recall: hold ${holdable.length} lot(s) still in stock',
                                ),
                              ),
                            );
                          }
                          final it = list[i - (canRecall ? 1 : 0)];
                          final lot = it['lot'];
                          final dispatched = (lot?['dispatched'] ?? []) as List;
                          return Responsive(
                            child: Card(
                              child: ListTile(
                                onTap: () => Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => DeliveryDetailScreen(
                                      id: it['deliveryId'],
                                    ),
                                  ),
                                ),
                                title: Text(
                                  it['productName'],
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                subtitle: Text(
                                  '${it['supplierName']} · ${fmtDateTime(it['receivedAt'])}\n'
                                  'Batch ${it['batchCode'] ?? '-'} · ${fmtNum(it['quantity'])} ${it['unit']} · by ${it['receivedByName']}'
                                  '${lot == null ? '' : '\n${fmtNum(lot['qtyOnHand'])} ${it['unit']} still in stock'}'
                                  '${dispatched.isEmpty ? '' : '\nDispatched to ${dispatched.map((d) => '${d['customer']} (${fmtNum(d['qty'])})').join(', ')}'}',
                                ),
                                isThreeLine: true,
                                trailing: it['voided'] == true
                                    ? const Pill('VOID')
                                    : lot?['status'] == 'hold'
                                    ? const Pill('ON HOLD', tone: Tone.bad)
                                    : it['accepted']
                                    ? const Pill('Accepted', tone: Tone.ok)
                                    : const Pill('Rejected', tone: Tone.bad),
                              ),
                            ),
                          );
                        },
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
