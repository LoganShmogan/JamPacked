import 'package:flutter/material.dart';

import '../theme.dart';
import '../widgets/common.dart';

class CorrectiveActionsScreen extends StatelessWidget {
  const CorrectiveActionsScreen({super.key});

  static const sourceLabels = {
    'goods_inward': 'Goods inwards',
    'temperature': 'Temperature',
    'audit': 'Audit',
    'manual': 'Manual',
  };

  Future<void> _new(BuildContext context) async {
    final title = TextEditingController();
    final desc = TextEditingController();
    var severity = 'medium';
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (c) => StatefulBuilder(
        builder: (c, setState) => Padding(
          padding: EdgeInsets.fromLTRB(
            16,
            16,
            16,
            MediaQuery.viewInsetsOf(c).bottom + 16,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Raise corrective action',
                style: Theme.of(c).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: title,
                decoration: const InputDecoration(
                  labelText: 'What went wrong?',
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: desc,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Details / what was done',
                ),
              ),
              const SizedBox(height: 10),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'low', label: Text('Low')),
                  ButtonSegment(value: 'medium', label: Text('Medium')),
                  ButtonSegment(value: 'high', label: Text('High')),
                ],
                selected: {severity},
                onSelectionChanged: (s) => setState(() => severity = s.first),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => Navigator.pop(c, true),
                child: const Text('Raise'),
              ),
            ],
          ),
        ),
      ),
    );
    if (ok != true || !context.mounted) return;
    await context.run(
      () => context.m('correctiveActions:create', {
        'title': title.text.trim(),
        'description': desc.text.trim().isEmpty ? null : desc.text.trim(),
        'severity': severity,
      }),
      success: 'Corrective action raised',
    );
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Corrective Actions'),
          bottom: const TabBar(
            labelColor: Colors.white,
            unselectedLabelColor: Colors.white70,
            indicatorColor: Colors.white,
            tabs: [
              Tab(text: 'Open'),
              Tab(text: 'Closed'),
            ],
          ),
        ),
        floatingActionButton: FloatingActionButton(
          onPressed: () => _new(context),
          child: const Icon(Icons.add),
        ),
        body: TabBarView(
          children: [
            for (final status in ['open', 'closed'])
              QueryBuilder(
                path: 'correctiveActions:list',
                args: {'status': status},
                builder: (context, data) {
                  final list = data as List;
                  if (list.isEmpty) {
                    return EmptyState(
                      icon: status == 'open' ? Icons.task_alt : Icons.inventory,
                      title: status == 'open'
                          ? 'Nothing outstanding'
                          : 'No closed actions yet',
                      message: status == 'open'
                          ? 'Problems from deliveries, temperature checks and audits appear here automatically.'
                          : null,
                    );
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                    itemCount: list.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, i) =>
                        Responsive(child: _CaCard(ca: list[i])),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}

class _CaCard extends StatelessWidget {
  const _CaCard({required this.ca});
  final dynamic ca;
  @override
  Widget build(BuildContext context) {
    final sev = ca['severity'] as String;
    final open = ca['status'] == 'open';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Pill(
                  sev.toUpperCase(),
                  tone: sev == 'high'
                      ? Tone.bad
                      : sev == 'medium'
                      ? Tone.warn
                      : Tone.neutral,
                ),
                const SizedBox(width: 6),
                Pill(
                  CorrectiveActionsScreen.sourceLabels[ca['source']] ??
                      ca['source'],
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              ca['title'],
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
            ),
            if (ca['description'] != null) ...[
              const SizedBox(height: 4),
              Text(
                ca['description'],
                style: const TextStyle(color: AppColors.muted),
              ),
            ],
            const SizedBox(height: 6),
            Text(
              'Raised by ${ca['raisedByName']} · ${fmtDateTime(ca['raisedAt'])}',
              style: const TextStyle(color: AppColors.muted, fontSize: 12),
            ),
            if (!open) ...[
              const Divider(height: 20),
              Text(
                '✓ ${ca['resolution']}',
                style: const TextStyle(
                  color: AppColors.ok,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                'Closed by ${ca['closedByName']} · ${fmtDateTime(ca['closedAt'])}',
                style: const TextStyle(color: AppColors.muted, fontSize: 12),
              ),
            ],
            if (open)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  icon: const Icon(Icons.check_circle_outline),
                  label: const Text('Close out'),
                  onPressed: () async {
                    final r = await promptText(
                      context,
                      title: 'How was it resolved?',
                      label: 'Resolution',
                      confirm: 'Close',
                      hint: 'e.g. Product discarded, supplier credited',
                    );
                    if (r == null || r.isEmpty || !context.mounted) return;
                    await context.run(
                      () => context.m('correctiveActions:close', {
                        'id': ca['_id'],
                        'resolution': r,
                      }),
                      success: 'Closed',
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
