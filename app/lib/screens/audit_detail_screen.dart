import 'package:flutter/material.dart';

import '../theme.dart';
import '../widgets/audit_history.dart';
import '../widgets/common.dart';

class AuditDetailScreen extends StatelessWidget {
  const AuditDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Audit')),
      body: QueryBuilder(
        path: 'audits:get',
        args: {'id': id},
        builder: (context, a) {
          if (a == null) {
            return const EmptyState(
              icon: Icons.search_off,
              title: 'Audit not found',
            );
          }
          final locked = a['status'] == 'completed';
          final answers = a['answers'] as List;
          final sections = <String, List>{};
          for (final q in answers) {
            sections.putIfAbsent(q['section'], () => []).add(q);
          }
          final answered = answers.where((q) => q['value'] != null).length;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Responsive(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              a['title'],
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              a['standardRef'],
                              style: const TextStyle(
                                color: AppColors.muted,
                                fontSize: 12,
                              ),
                            ),
                            const SizedBox(height: 12),
                            LinearProgressIndicator(
                              value: answers.isEmpty
                                  ? 0
                                  : answered / answers.length,
                              color: AppColors.jam,
                              backgroundColor: AppColors.jamLight,
                              minHeight: 8,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Text(
                                  '$answered of ${answers.length} answered',
                                  style: const TextStyle(
                                    color: AppColors.muted,
                                  ),
                                ),
                                const Spacer(),
                                if (locked)
                                  Pill(
                                    'Score ${fmtNum(a['score'])}%',
                                    tone: a['score'] >= 90
                                        ? Tone.ok
                                        : Tone.warn,
                                  )
                                else
                                  TextButton.icon(
                                    onPressed: () => context.run(
                                      () => context.m(
                                        'audits:refreshAutoFill',
                                        {'id': id},
                                      ),
                                      success: 'Auto-filled answers refreshed',
                                    ),
                                    icon: const Icon(Icons.sync, size: 18),
                                    label: const Text('Refresh'),
                                  ),
                              ],
                            ),
                            if (locked)
                              Text(
                                'Completed by ${a['completedByName']} on ${fmtDateTime(a['completedAt'])}. Locked.',
                                style: const TextStyle(
                                  color: AppColors.muted,
                                  fontSize: 12,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                    for (final s in sections.entries) ...[
                      SectionTitle(s.key),
                      for (final q in s.value) ...[
                        _QuestionCard(auditId: id, q: q, locked: locked),
                        const SizedBox(height: 8),
                      ],
                    ],
                    const SizedBox(height: 12),
                    if (!locked)
                      FilledButton.icon(
                        icon: const Icon(Icons.verified),
                        label: const Text('Complete & sign off'),
                        onPressed: () async {
                          final ok = await showDialog<bool>(
                            context: context,
                            builder: (c) => AlertDialog(
                              title: const Text('Sign off audit?'),
                              content: const Text(
                                'The audit will be locked under your name. Any "No" answers will raise corrective actions.',
                              ),
                              actions: [
                                TextButton(
                                  onPressed: () => Navigator.pop(c, false),
                                  child: const Text('Cancel'),
                                ),
                                FilledButton(
                                  onPressed: () => Navigator.pop(c, true),
                                  child: const Text('Sign off'),
                                ),
                              ],
                            ),
                          );
                          if (ok == true && context.mounted) {
                            await context.run(
                              () => context.m('audits:complete', {'id': id}),
                              success: 'Audit completed',
                            );
                          }
                        },
                      ),
                    const SectionTitle('Audit trail'),
                    QueryBuilder(
                      path: 'auditLog:list',
                      args: {'entityType': 'audit', 'entityId': id},
                      refreshable: false,
                      builder: (context, entries) =>
                          AuditHistory(entries: entries),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _QuestionCard extends StatelessWidget {
  const _QuestionCard({
    required this.auditId,
    required this.q,
    required this.locked,
  });
  final String auditId;
  final dynamic q;
  final bool locked;

  Future<void> _set(BuildContext context, dynamic value, {String? notes}) =>
      context.run(
        () => context.m('audits:answer', {
          'id': auditId,
          'questionId': q['questionId'],
          'value': value,
          'notes': notes,
        }),
      );

  @override
  Widget build(BuildContext context) {
    final value = q['value'];
    final auto = q['autoFilled'] == true;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              q['text'],
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
            ),
            if (q['guidance'] != null) ...[
              const SizedBox(height: 4),
              Text(
                q['guidance'],
                style: const TextStyle(color: AppColors.muted, fontSize: 12),
              ),
            ],
            if (q['evidence'] != null) ...[
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.jamLight,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.auto_awesome,
                      size: 16,
                      color: AppColors.jamDark,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        q['evidence'],
                        style: const TextStyle(
                          color: AppColors.jamDark,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 10),
            switch (q['type']) {
              'yesno' => Row(
                children: [
                  _Choice(
                    label: 'Yes',
                    selected: value == true,
                    tone: Tone.ok,
                    onTap: locked ? null : () => _set(context, true),
                  ),
                  const SizedBox(width: 8),
                  _Choice(
                    label: 'No',
                    selected: value == false,
                    tone: Tone.bad,
                    onTap: locked ? null : () => _set(context, false),
                  ),
                ],
              ),
              _ => InkWell(
                onTap: locked
                    ? null
                    : () async {
                        final t = await promptText(
                          context,
                          title: q['text'],
                          label: 'Answer',
                        );
                        if (t == null || !context.mounted) return;
                        await _set(
                          context,
                          q['type'] == 'number' ? (double.tryParse(t) ?? t) : t,
                        );
                      },
                child: InputDecorator(
                  decoration: const InputDecoration(isDense: true),
                  child: Text(
                    value == null
                        ? 'Tap to answer'
                        : (value is num ? fmtNum(value) : '$value'),
                    style: TextStyle(
                      color: value == null ? AppColors.muted : AppColors.ink,
                    ),
                  ),
                ),
              ),
            },
            const SizedBox(height: 8),
            Row(
              children: [
                if (auto)
                  const Pill(
                    'Auto-filled',
                    tone: Tone.brand,
                    icon: Icons.auto_awesome,
                  ),
                if (!auto && q['answeredByName'] != null)
                  Text(
                    '${q['answeredByName']} · ${fmtDateTime(q['answeredAt'])}',
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 12,
                    ),
                  ),
                const Spacer(),
                if (!locked)
                  TextButton.icon(
                    onPressed: () async {
                      final n = await promptText(
                        context,
                        title: 'Add a note',
                        label: 'Note',
                      );
                      if (n != null && context.mounted) {
                        await _set(context, value, notes: n);
                      }
                    },
                    icon: const Icon(Icons.note_add_outlined, size: 18),
                    label: const Text('Note'),
                  ),
              ],
            ),
            if (q['notes'] != null)
              Text('Note: ${q['notes']}', style: const TextStyle(fontSize: 13)),
          ],
        ),
      ),
    );
  }
}

class _Choice extends StatelessWidget {
  const _Choice({
    required this.label,
    required this.selected,
    required this.tone,
    this.onTap,
  });
  final String label;
  final bool selected;
  final Tone tone;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final color = tone == Tone.ok ? AppColors.ok : AppColors.bad;
    return Expanded(
      child: Material(
        color: selected ? color : Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(
            color: selected ? color : AppColors.border,
            width: 1.5,
          ),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(10),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Center(
              child: Text(
                label,
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  color: selected ? Colors.white : AppColors.ink,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
