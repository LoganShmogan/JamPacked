import 'package:flutter/material.dart';

import '../theme.dart';
import '../widgets/common.dart';

const taskLabels = {
  'goodsIn': 'Receiving goods',
  'production': 'Making a batch',
  'temperature': 'Temperature check',
  'record': 'Programme record',
};

/// "45 s", "3 min 20 s", "12 min", "1 h 5 min"; "-" when there's nothing to show.
String fmtDuration(num? ms) {
  if (ms == null) return '-';
  final s = (ms / 1000).round();
  if (s < 60) return '$s s';
  final m = s ~/ 60;
  if (m < 10) return s % 60 == 0 ? '$m min' : '$m min ${s % 60} s';
  if (m < 60) return '$m min';
  return m % 60 == 0 ? '${m ~/ 60} h' : '${m ~/ 60} h ${m % 60} min';
}

/// How long corrective actions typically stay open.
String fmtHours(num h) => h < 1
    ? 'under an hour'
    : h < 48
    ? '${h.round()} h'
    : '${(h / 24).round()} days';

/// Insights: what the business did over a period, and how long its everyday tasks take.
/// Business totals plus your own times: nobody is compared with anybody else.
class InsightsScreen extends StatefulWidget {
  const InsightsScreen({super.key});
  @override
  State<InsightsScreen> createState() => _InsightsScreenState();
}

class _InsightsScreenState extends State<InsightsScreen> {
  int _days = 30;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Insights')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Responsive(
              child: Wrap(
                spacing: 6,
                children: [
                  for (final d in [7, 30, 90])
                    ChoiceChip(
                      label: Text('$d days'),
                      selected: _days == d,
                      onSelected: (_) => setState(() => _days = d),
                    ),
                ],
              ),
            ),
          ),
          Expanded(
            child: QueryBuilder(
              path: 'analytics:insights',
              args: {'days': _days},
              builder: (context, i) => ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Responsive(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        SectionTitle('Last ${i['days']} days'),
                        _Stats(i),
                        const SectionTitle('How long tasks take'),
                        _TaskTimes(i['tasks']),
                        const Padding(
                          padding: EdgeInsets.fromLTRB(4, 8, 4, 0),
                          child: Text(
                            'The typical time from opening the form to saving it. '
                            'Your business\'s numbers and your own only: nobody is compared with anybody else.',
                            style: TextStyle(color: AppColors.muted),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Stats extends StatelessWidget {
  const _Stats(this.i);
  final Map i;

  @override
  Widget build(BuildContext context) {
    final ca = i['correctiveActions'];
    final temps = i['temperatureChecks'] as num;
    final items = i['itemsReceived'] as num;
    final tiles = [
      (
        'Deliveries',
        i['deliveries'],
        items == 0 ? null : '${fmtNum(items)} items',
        Icons.local_shipping,
      ),
      (
        'Items rejected',
        i['itemsRejected'],
        items == 0
            ? null
            : '${(i['itemsRejected'] * 100 / items).round()}% of items',
        Icons.block,
      ),
      ('Batches made', i['batchesMade'], null, Icons.soup_kitchen),
      (
        'Temperature checks',
        temps,
        temps == 0
            ? null
            : '${(i['temperatureInRange'] * 100 / temps).round()}% in range',
        Icons.thermostat,
      ),
      ('Programme records', i['records'], null, Icons.verified),
      ('Stock wasted', i['wasteMovements'], 'times', Icons.delete_outline),
      ('Dispatches', i['dispatches'], null, Icons.outbox),
      (
        'Corrective actions',
        ca['raised'],
        ca['medianHoursToClose'] == null
            ? '${fmtNum(ca['closed'])} closed'
            : '${fmtNum(ca['closed'])} closed, typically in ${fmtHours(ca['medianHoursToClose'])}',
        Icons.report_problem,
      ),
    ];
    return LayoutBuilder(
      builder: (context, box) {
        final width = (box.maxWidth - 10) / 2;
        return Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            for (final (label, value, sub, icon) in tiles)
              SizedBox(
                width: width,
                child: Card(
                  margin: EdgeInsets.zero,
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(icon, color: AppColors.jam),
                        const SizedBox(height: 8),
                        Text(
                          fmtNum(value),
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          label,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        if (sub != null)
                          Text(
                            sub,
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 12,
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _TaskTimes extends StatelessWidget {
  const _TaskTimes(this.tasks);
  final List tasks;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Column(
        children: [
          const ListTile(
            dense: true,
            title: Text('Task', style: TextStyle(color: AppColors.muted)),
            trailing: SizedBox(
              width: 170,
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Business',
                      textAlign: TextAlign.end,
                      style: TextStyle(color: AppColors.muted),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      'You',
                      textAlign: TextAlign.end,
                      style: TextStyle(color: AppColors.muted),
                    ),
                  ),
                ],
              ),
            ),
          ),
          for (final t in tasks) ...[
            const Divider(height: 1),
            ListTile(
              title: Text(
                taskLabels[t['task']] ?? t['task'],
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              subtitle: Text(
                t['count'] == 0
                    ? 'Not timed yet'
                    : '${fmtNum(t['count'])} timed, ${fmtNum(t['myCount'])} by you',
              ),
              trailing: SizedBox(
                width: 170,
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        fmtDuration(t['medianMs']),
                        textAlign: TextAlign.end,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                    Expanded(
                      child: Text(
                        fmtDuration(t['myMedianMs']),
                        textAlign: TextAlign.end,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
