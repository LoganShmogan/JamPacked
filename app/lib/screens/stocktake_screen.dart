import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// Count each line; completing corrects stock to the counts and flags big differences.
class StocktakeScreen extends StatelessWidget {
  const StocktakeScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthService>().user!;
    return QueryBuilder(
      path: 'stocktakes:get',
      args: {'id': id},
      builder: (context, s) {
        if (s == null) {
          return Scaffold(
            appBar: AppBar(title: const Text('Stocktake')),
            body: const EmptyState(
              icon: Icons.search_off,
              title: 'Stocktake not found',
            ),
          );
        }
        final done = s['status'] == 'completed';
        final lines = s['lines'] as List;
        final remaining = lines.where((l) => l['counted'] == null).length;
        return Scaffold(
          appBar: AppBar(title: Text(s['title'])),
          bottomNavigationBar: done || !user.isManager
              ? null
              : SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                    child: FilledButton(
                      onPressed: () => context.run(
                        () => context.m('stocktakes:complete', {'id': id}),
                        success: 'Stocktake complete. Stock corrected',
                      ),
                      child: Text(
                        remaining == 0
                            ? 'Complete stocktake'
                            : 'Complete ($remaining left to count)',
                      ),
                    ),
                  ),
                ),
          body: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Responsive(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      done
                          ? 'Completed ${fmtDateTime(s['completedAt'])} by ${s['completedByName']}'
                          : 'Started ${fmtDateTime(s['startedAt'])} by ${s['startedByName']}. '
                                'Enter what you actually count.',
                      style: const TextStyle(color: AppColors.muted),
                    ),
                    const SizedBox(height: 12),
                    for (final l in lines)
                      _LineCard(id: id, line: l, locked: done),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _LineCard extends StatelessWidget {
  const _LineCard({required this.id, required this.line, required this.locked});
  final String id;
  final Map line;
  final bool locked;

  @override
  Widget build(BuildContext context) {
    final counted = line['counted'];
    final diff = counted == null ? null : counted - line['expected'];
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    line['productName'],
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  Text(
                    'Expected ${fmtNum(line['expected'])} ${line['unit']}'
                    '${line['batchCode'] != null ? ' · Batch ${line['batchCode']}' : ''}',
                    style: const TextStyle(color: AppColors.muted),
                  ),
                  if (diff != null && diff != 0)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Pill(
                        '${diff > 0 ? '+' : ''}${fmtNum(diff)} ${line['unit']}',
                        tone: Tone.warn,
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            SizedBox(
              width: 96,
              child: locked
                  ? Text(
                      fmtNum(counted),
                      textAlign: TextAlign.end,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    )
                  : TextFormField(
                      key: ValueKey('count-${line['lotId']}'),
                      initialValue: counted == null ? '' : fmtNum(counted),
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      textAlign: TextAlign.end,
                      decoration: const InputDecoration(labelText: 'Count'),
                      onFieldSubmitted: (v) {
                        final n = double.tryParse(v);
                        if (n == null) return;
                        context.run(
                          () => context.m('stocktakes:count', {
                            'id': id,
                            'lotId': line['lotId'],
                            'counted': n,
                          }),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
