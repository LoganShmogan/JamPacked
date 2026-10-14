import 'package:flutter/material.dart';

import '../widgets/common.dart';
import 'delivery_detail_screen.dart';

/// Traceability "one step back": find where a product or batch came from (for recalls).
class TraceScreen extends StatefulWidget {
  const TraceScreen({super.key});
  @override
  State<TraceScreen> createState() => _TraceScreenState();
}

class _TraceScreenState extends State<TraceScreen> {
  final _search = TextEditingController();
  String _term = '';

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
                      return ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                        itemCount: list.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 8),
                        itemBuilder: (context, i) {
                          final it = list[i];
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
                                  'Batch ${it['batchCode'] ?? '—'} · ${fmtNum(it['quantity'])} ${it['unit']} · by ${it['receivedByName']}',
                                ),
                                isThreeLine: true,
                                trailing: it['voided'] == true
                                    ? const Pill('VOID')
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
