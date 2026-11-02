import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/record_fields.dart';

/// One field's value as text, for lists and summaries.
String fieldValue(Map field, dynamic v) => switch (v) {
  null => '-',
  true => 'Yes',
  false => 'No',
  _ when field['type'] == 'date' => fmtDate(v),
  _ => '${v is num ? fmtNum(v) : v}${field['unit'] ?? ''}',
};

/// History of one kind of programme record (pest checks, training...), newest first.
class RecordsScreen extends StatelessWidget {
  const RecordsScreen({super.key, required this.type});
  final Map type;

  Future<void> _void(BuildContext context, Map r) async {
    final reason = await promptText(
      context,
      title: 'Void this record?',
      label: 'Reason',
      confirm: 'Void',
    );
    if (reason == null || !context.mounted) return;
    await context.run(
      () => context.m('records:voidRecord', {'id': r['_id'], 'reason': reason}),
      success: 'Record voided',
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthService>().user!;
    final fields = (type['fields'] as List).cast<Map>();
    return Scaffold(
      appBar: AppBar(title: Text(type['name'])),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.of(
          context,
        ).push(MaterialPageRoute(builder: (_) => RecordFormScreen(type: type))),
        icon: const Icon(Icons.add),
        label: const Text('Add record'),
      ),
      body: QueryBuilder(
        path: 'records:list',
        args: {'recordType': type['key']},
        builder: (context, data) {
          final list = data as List;
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
            children: [
              Responsive(
                child: Text(
                  type['description'],
                  style: const TextStyle(color: AppColors.muted),
                ),
              ),
              const SizedBox(height: 12),
              if (list.isEmpty)
                const Responsive(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Text(
                      'Nothing recorded yet.',
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
              for (final r in list)
                Responsive(
                  child: Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  '${fmtDateTime(r['at'])} · ${r['byName']}',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              if (r['voided'] == true)
                                const Pill('VOID')
                              else if (user.isManager)
                                IconButton(
                                  tooltip: 'Void',
                                  icon: const Icon(Icons.block, size: 20),
                                  onPressed: () => _void(context, r),
                                ),
                            ],
                          ),
                          for (final f in fields)
                            InfoRow(
                              f['label'],
                              fieldValue(f, r['values'][f['key']]),
                            ),
                          for (final issue in r['issues'] as List)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Pill(
                                issue,
                                tone: Tone.bad,
                                icon: Icons.warning_amber,
                              ),
                            ),
                          Text(
                            'Kept until ${keptUntil(r['at'])}',
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 12,
                            ),
                          ),
                          if (r['voidReason'] != null)
                            Text(
                              'Voided: ${r['voidReason']}',
                              style: const TextStyle(color: AppColors.muted),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

/// Fill in a programme record. The fields come from the record type.
class RecordFormScreen extends StatefulWidget {
  const RecordFormScreen({super.key, required this.type});
  final Map type;
  @override
  State<RecordFormScreen> createState() => _RecordFormScreenState();
}

class _RecordFormScreenState extends State<RecordFormScreen> {
  late final fields = (widget.type['fields'] as List).cast<Map>();
  late final _answers = RecordAnswers(fields);
  bool _saving = false;
  final _started = DateTime.now(); // timed for Insights

  Future<void> _save() async {
    final (values, missing) = _answers.values();
    if (missing != null) {
      return context.toast('$missing is required', error: true);
    }
    setState(() => _saving = true);
    final nav = Navigator.of(context);
    final id = await context.run(
      () => context.m('records:create', {
        'recordType': widget.type['key'],
        'values': values,
      }),
      success: '${widget.type['name']} saved',
    );
    if (!mounted) return;
    setState(() => _saving = false);
    if (id == null) return;
    context.recordTask('record', _started);
    nav.pop();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(widget.type['name'])),
    bottomNavigationBar: SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: FilledButton(
          onPressed: _saving ? null : _save,
          child: const Text('Save record'),
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
                widget.type['description'],
                style: const TextStyle(color: AppColors.muted),
              ),
              const SizedBox(height: 16),
              for (final f in fields)
                _answers.field(context, f, () => setState(() {})),
            ],
          ),
        ),
      ],
    ),
  );
}
