import 'package:flutter/material.dart';

import '../theme.dart';
import '../widgets/common.dart';
import 'delivery_detail_screen.dart';
import 'goods_in_form_screen.dart';

class GoodsInScreen extends StatelessWidget {
  const GoodsInScreen({super.key});

  static Tone toneFor(String status) => switch (status) {
    'accepted' => Tone.ok,
    'partial' => Tone.warn,
    _ => Tone.bad,
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Goods Inwards')),
      floatingActionButton: FloatingActionButton.extended(
        // Unique tag: HomeShell keeps every tab's FAB alive in one route.
        heroTag: 'goods-in-fab',
        onPressed: () => Navigator.of(context)
            .push(MaterialPageRoute(builder: (_) => const GoodsInFormScreen())),
        icon: const Icon(Icons.add),
        label: const Text('Receive goods'),
      ),
      body: QueryBuilder(
        path: 'deliveries:list',
        builder: (context, data) {
          final list = data as List;
          if (list.isEmpty) {
            return const EmptyState(
              icon: Icons.local_shipping,
              title: 'No deliveries yet',
              message: 'Record each delivery as it arrives. Audits fill themselves in from these records.',
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
            itemCount: list.length,
            separatorBuilder: (_, _) => const SizedBox(height: 10),
            itemBuilder: (context, i) {
              final d = list[i];
              final voided = d['voided'] == true;
              return Responsive(
                child: Card(
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => DeliveryDetailScreen(id: d['_id']),
                      ),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Row(
                        children: [
                          CircleAvatar(
                            backgroundColor: AppColors.jamLight,
                            child: const Icon(
                              Icons.local_shipping,
                              color: AppColors.jam,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  d['supplierName'],
                                  style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 16,
                                    decoration: voided
                                        ? TextDecoration.lineThrough
                                        : null,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${fmtDateTime(d['receivedAt'])} · ${fmtNum(d['itemCount'])} items · ${d['receivedByName']}',
                                  style: const TextStyle(
                                    color: AppColors.muted,
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              voided
                                  ? const Pill('VOID', tone: Tone.neutral)
                                  : Pill(
                                      d['status'].toString().toUpperCase(),
                                      tone: toneFor(d['status']),
                                    ),
                              if (d['tempIssues'] > 0) ...[
                                const SizedBox(height: 4),
                                const Pill(
                                  'TEMP',
                                  tone: Tone.bad,
                                  icon: Icons.thermostat,
                                ),
                              ],
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
