import 'package:flutter/material.dart';

import '../theme.dart';
import '../widgets/common.dart';

class ExpiringScreen extends StatelessWidget {
  const ExpiringScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Expiring Stock')),
      body: QueryBuilder(
        path: 'deliveries:expiring',
        builder: (context, data) {
          final list = data as List;
          if (list.isEmpty) {
            return const EmptyState(
              icon: Icons.event_available,
              title: 'Nothing expiring soon',
            );
          }
          final now = DateTime.now();
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: list.length,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (context, i) {
              final it = list[i];
              final exp = fromMs(it['expiresAt']);
              final isUseBy = it['useBy'] != null;
              final past = exp.isBefore(now);
              final days = exp.difference(now).inHours / 24;
              return Responsive(
                child: Card(
                  child: ListTile(
                    leading: Icon(
                      storageIcons[it['storageType']],
                      color: AppColors.orange,
                    ),
                    title: Text(
                      it['productName'],
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    subtitle: Text(
                      '${isUseBy ? 'Use by' : 'Best before'} ${fmtDate(it['expiresAt'])}'
                      '${it['batchCode'] != null ? ' · Batch ${it['batchCode']}' : ''}\n'
                      'Received ${fmtDate(it['receivedAt'])} · ${fmtNum(it['quantity'])} ${it['unit']}',
                    ),
                    isThreeLine: true,
                    trailing: past
                        ? Pill(
                            isUseBy ? 'DISCARD' : 'PAST BB',
                            tone: isUseBy ? Tone.bad : Tone.warn,
                          )
                        : Pill(
                            days < 1 ? 'Today' : '${days.ceil()}d',
                            tone: Tone.warn,
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
