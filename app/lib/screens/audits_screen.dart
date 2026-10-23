import 'package:flutter/material.dart';

import '../theme.dart';
import '../widgets/common.dart';
import 'audit_detail_screen.dart';
import 'programme_screen.dart';

/// Starts an audit from template [t] (pre-filled from records) and opens it.
Future<void> startAudit(BuildContext context, Map t) async {
  final id = await context.run(
    () => context.m('audits:start', {
      'templateKey': t['key'],
      'tzOffsetMinutes': DateTime.now().timeZoneOffset.inMinutes,
      // Daily checks cover "today" in local time rather than a rolling 24h.
      if (t['defaultPeriodDays'] == 1) 'periodStart': localDayStartMs(),
    }),
  );
  if (id != null && context.mounted) {
    Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => AuditDetailScreen(id: id)));
  }
}

class AuditsScreen extends StatelessWidget {
  const AuditsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Checks & Audits'),
          bottom: const TabBar(
            labelColor: Colors.white,
            unselectedLabelColor: Colors.white70,
            indicatorColor: Colors.white,
            tabs: [
              Tab(text: 'Start new'),
              Tab(text: 'History'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            QueryBuilder(
              path: 'audits:templates',
              builder: (context, data) => ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Responsive(
                    child: Card(
                      child: ListTile(
                        leading: const Icon(
                          Icons.verified,
                          color: AppColors.orange,
                        ),
                        title: const Text(
                          'Your programme',
                          style: TextStyle(fontWeight: FontWeight.w700),
                        ),
                        subtitle: const Text(
                          'What is due, records to keep and checklists',
                        ),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const ProgrammeScreen(),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Responsive(
                    child: Card(
                      color: AppColors.orangeLight,
                      child: Padding(
                        padding: EdgeInsets.all(14),
                        child: Row(
                          children: [
                            Icon(
                              Icons.auto_awesome,
                              color: AppColors.orangeDark,
                            ),
                            SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'Audits pre-fill from your goods inwards, temperature and corrective action records. '
                                'Just review the evidence and answer what\'s left.',
                                style: TextStyle(color: AppColors.orangeDark),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  for (final t in data as List) ...[
                    Responsive(
                      child: Card(
                        clipBehavior: Clip.antiAlias,
                        child: InkWell(
                          onTap: () => startAudit(context, t),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    const Icon(
                                      Icons.fact_check,
                                      color: AppColors.orange,
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Text(
                                        t['name'],
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w800,
                                          fontSize: 16,
                                        ),
                                      ),
                                    ),
                                    const Icon(
                                      Icons.play_circle_fill,
                                      color: AppColors.orange,
                                      size: 30,
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  t['description'],
                                  style: const TextStyle(
                                    color: AppColors.muted,
                                  ),
                                ),
                                const SizedBox(height: 10),
                                Wrap(
                                  spacing: 6,
                                  runSpacing: 6,
                                  children: [
                                    Pill(
                                      '${fmtNum(t['questionCount'])} questions',
                                    ),
                                    Pill(
                                      '${fmtNum(t['autoFillCount'])} auto-filled',
                                      tone: Tone.brand,
                                      icon: Icons.auto_awesome,
                                    ),
                                    Pill(
                                      'Last ${fmtNum(t['defaultPeriodDays'])} day(s)',
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  t['standardRef'],
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: AppColors.muted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],
                ],
              ),
            ),
            QueryBuilder(
              path: 'audits:list',
              builder: (context, data) {
                final list = data as List;
                if (list.isEmpty) {
                  return const EmptyState(
                    icon: Icons.fact_check,
                    title: 'No audits yet',
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: list.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final a = list[i];
                    final done = a['status'] == 'completed';
                    final score = a['score'];
                    return Responsive(
                      child: Card(
                        child: ListTile(
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => AuditDetailScreen(id: a['_id']),
                            ),
                          ),
                          title: Text(
                            a['title'],
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          subtitle: Text(
                            done
                                ? 'Completed by ${a['completedByName']} · ${fmtDateTime(a['completedAt'])}'
                                : 'Started by ${a['startedByName']} · ${fmtNum(a['answered'])}/${fmtNum(a['total'])} answered',
                          ),
                          trailing: done
                              ? Pill(
                                  '${fmtNum(score)}%',
                                  tone: score >= 90
                                      ? Tone.ok
                                      : score >= 70
                                      ? Tone.warn
                                      : Tone.bad,
                                )
                              : const Pill('In progress', tone: Tone.brand),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
