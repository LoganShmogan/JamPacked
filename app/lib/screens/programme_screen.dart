import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/business_form.dart';
import '../widgets/common.dart';
import 'audits_screen.dart';
import 'custom_programme_editor.dart';
import 'records_screen.dart';
import 'temperature_screen.dart';

const frequencyLabels = {
  'daily': 'Every day',
  'weekly': 'Every week',
  'monthly': 'Every month',
  'yearly': 'Every 12 months',
};

/// Does whatever a "Due" item asks for: fill in a record, start a checklist, or take temperatures.
Future<void> openDue(BuildContext context, Map item, Map programme) async {
  final by = item['satisfiedBy'] as Map;
  switch (by['kind']) {
    case 'record':
      final type = (programme['recordTypes'] as List).firstWhere(
        (r) => r['key'] == by['recordType'],
      );
      await Navigator.of(
        context,
      ).push(MaterialPageRoute(builder: (_) => RecordFormScreen(type: type)));
    case 'audit':
      final t = (programme['templates'] as List).firstWhere(
        (x) => x['key'] == by['templateKey'],
      );
      await startAudit(context, t);
    default:
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => const TemperatureScreen(autoOpen: true),
        ),
      );
  }
}

/// The checks and records your programme asks for, what is due, and (for admins) changing it.
class ProgrammeScreen extends StatelessWidget {
  const ProgrammeScreen({super.key});

  void _push(BuildContext context, Widget w) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => w));

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthService>().user!;
    return Scaffold(
      appBar: AppBar(title: const Text('Your programme')),
      body: QueryBuilder(
        path: 'programmes:current',
        builder: (context, m) {
          final custom = m['key'] == 'custom';
          final records = m['recordTypes'] as List;
          final prompts = m['receivingPrompts'] as List;
          final templates = m['templates'] as List;
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
                            Row(
                              children: [
                                Pill(
                                  programmeLabel(m['key']),
                                  tone: Tone.brand,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    m['name'],
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleMedium,
                                  ),
                                ),
                              ],
                            ),
                            if ((m['sectorLabels'] as List).isNotEmpty) ...[
                              const SizedBox(height: 10),
                              Wrap(
                                spacing: 6,
                                runSpacing: 6,
                                children: [
                                  for (final s in m['sectorLabels']) Pill(s),
                                ],
                              ),
                            ],
                            if (user.isAdmin) ...[
                              const SizedBox(height: 8),
                              Wrap(
                                spacing: 8,
                                children: [
                                  TextButton.icon(
                                    icon: const Icon(Icons.swap_horiz),
                                    label: const Text('Change programme'),
                                    onPressed: () => _push(
                                      context,
                                      ChangeProgrammeScreen(
                                        programme: m['key'],
                                        sectors: List<String>.from(
                                          m['sectors'],
                                        ),
                                      ),
                                    ),
                                  ),
                                  if (custom && m['ownsProgramme'] == true)
                                    TextButton.icon(
                                      icon: const Icon(Icons.edit),
                                      label: const Text('Edit programme'),
                                      onPressed: () => _push(
                                        context,
                                        CustomProgrammeEditor(
                                          id: m['customProgrammeId'],
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                    if (custom && m['customProgrammeId'] == null)
                      user.isAdmin
                          ? const _BuildProgrammeCard()
                          : const Card(
                              child: Padding(
                                padding: EdgeInsets.all(16),
                                child: Text(
                                  'Your admin has not set up this business\'s programme yet.',
                                ),
                              ),
                            ),
                    if ((m['schedule'] as List).isNotEmpty) ...[
                      const SectionTitle('Due'),
                      DueList(programme: m),
                    ],
                    if (records.isNotEmpty) ...[
                      const SectionTitle('Records'),
                      Card(
                        child: Column(
                          children: [
                            for (final r in records)
                              ListTile(
                                leading: const Icon(
                                  Icons.assignment,
                                  color: AppColors.orange,
                                ),
                                title: Text(
                                  r['name'],
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                subtitle: Text(
                                  r['frequency'] == null
                                      ? 'When it happens'
                                      : frequencyLabels[r['frequency']]!,
                                ),
                                trailing: const Icon(Icons.chevron_right),
                                onTap: () =>
                                    _push(context, RecordsScreen(type: r)),
                              ),
                          ],
                        ),
                      ),
                    ],
                    if (prompts.isNotEmpty) ...[
                      const SectionTitle('Asked at goods inwards'),
                      Card(
                        child: Column(
                          children: [
                            for (final p in prompts)
                              ListTile(
                                leading: const Icon(
                                  Icons.local_shipping,
                                  color: AppColors.orange,
                                ),
                                title: Text(p['text']),
                                subtitle: p['guidance'] == null
                                    ? null
                                    : Text(p['guidance']),
                              ),
                          ],
                        ),
                      ),
                    ],
                    if (templates.isNotEmpty) ...[
                      const SectionTitle('Checklists'),
                      Card(
                        child: Column(
                          children: [
                            for (final t in templates)
                              ListTile(
                                leading: const Icon(
                                  Icons.fact_check,
                                  color: AppColors.orange,
                                ),
                                title: Text(
                                  t['name'],
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                subtitle: Text(
                                  '${t['questionCount']} questions'
                                  '${t['frequency'] == null ? '' : ' · ${frequencyLabels[t['frequency']]}'}',
                                ),
                                trailing: const Icon(Icons.play_arrow),
                                onTap: () => startAudit(context, t),
                              ),
                          ],
                        ),
                      ),
                    ],
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

/// The programme's schedule for this period: done (with when) or due. Tap to do it.
class DueList extends StatelessWidget {
  const DueList({super.key, required this.programme, this.onlyDue = false});
  final Map programme;

  /// On the dashboard, only what still needs doing.
  final bool onlyDue;

  @override
  Widget build(BuildContext context) => QueryBuilder(
    path: 'programmes:due',
    args: {'dayStart': localDayStartMs()},
    refreshable: false,
    builder: (context, data) {
      final items = (data as List)
          .where((d) => !onlyDue || d['done'] != true)
          .toList();
      if (items.isEmpty) {
        return const Card(
          child: ListTile(
            leading: Icon(Icons.check_circle, color: AppColors.ok),
            title: Text('Everything is up to date'),
          ),
        );
      }
      return Card(
        child: Column(
          children: [
            for (final d in items)
              ListTile(
                leading: Icon(
                  d['done'] == true
                      ? Icons.check_circle
                      : Icons.radio_button_unchecked,
                  color: d['done'] == true ? AppColors.ok : AppColors.warn,
                ),
                title: Text(
                  d['label'],
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: Text(
                  '${frequencyLabels[d['frequency']]}'
                  ' · ${d['lastAt'] == null ? 'never done' : 'last ${fmtDate(d['lastAt'])}'}',
                ),
                trailing: d['done'] == true
                    ? const Pill('Done', tone: Tone.ok)
                    : const Pill('Due', tone: Tone.warn),
                onTap: () => openDue(context, d, programme),
              ),
          ],
        ),
      );
    },
  );
}

/// For a business on a custom programme with nothing built yet.
class _BuildProgrammeCard extends StatelessWidget {
  const _BuildProgrammeCard();

  Future<void> _create(BuildContext context, String? copyFrom) async {
    final name = await promptText(
      context,
      title: 'Name your programme',
      label: 'Programme name',
      confirm: 'Create',
    );
    if (name == null || !context.mounted) return;
    final id = await context.run(
      () => context.m('customProgrammes:create', {
        'name': name,
        'copyFrom': copyFrom,
      }),
    );
    if (id != null && context.mounted) {
      Navigator.of(
        context,
      ).push(MaterialPageRoute(builder: (_) => CustomProgrammeEditor(id: id)));
    }
  }

  @override
  Widget build(BuildContext context) => Card(
    color: AppColors.orangeLight,
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Build your programme',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
          ),
          const SizedBox(height: 4),
          const Text(
            'Choose the checks asked at goods inwards, the records you keep and your checklists. '
            'Start from scratch or copy a National Programme and change it.',
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              FilledButton(
                onPressed: () => _create(context, null),
                child: const Text('Start blank'),
              ),
              for (final np in ['NP1', 'NP2', 'NP3'])
                OutlinedButton(
                  onPressed: () => _create(context, np),
                  child: Text('Copy $np'),
                ),
            ],
          ),
          QueryBuilder(
            path: 'customProgrammes:mine',
            refreshable: false,
            userScoped: true,
            builder: (context, data) => (data as List).isEmpty
                ? const SizedBox.shrink()
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SectionTitle('Or use one you have built'),
                      for (final p in data)
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(p['name']),
                          subtitle: Text(
                            '${p['records']} records · ${p['checklists']} checklists'
                            '${(p['usedBy'] as List).isEmpty ? '' : ' · used by ${(p['usedBy'] as List).join(', ')}'}',
                          ),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => context.run(
                            () => context.m('customProgrammes:useForBusiness', {
                              'id': p['_id'],
                            }),
                            success: 'Now following ${p['name']}',
                          ),
                        ),
                    ],
                  ),
          ),
        ],
      ),
    ),
  );
}

/// Admins: switch the business to another programme or change which sectors apply.
class ChangeProgrammeScreen extends StatefulWidget {
  const ChangeProgrammeScreen({
    super.key,
    required this.programme,
    required this.sectors,
  });
  final String programme;
  final List<String> sectors;
  @override
  State<ChangeProgrammeScreen> createState() => _ChangeProgrammeScreenState();
}

class _ChangeProgrammeScreenState extends State<ChangeProgrammeScreen> {
  final _form = GlobalKey<BusinessFormState>();

  Future<void> _save() async {
    final choice = _form.currentState!.collect()!;
    final auth = context.auth;
    final nav = Navigator.of(context);
    final ok = await context.run(() async {
      await context.m('settings:update', choice);
      return true;
    }, success: 'Programme updated');
    if (ok == null) return;
    await auth.refreshCurrent();
    nav.pop();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Change programme')),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Responsive(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Records you have already kept stay as they are. '
                'From now on the app will ask for what the new programme needs.',
                style: TextStyle(color: AppColors.muted),
              ),
              const SizedBox(height: 8),
              BusinessForm(
                key: _form,
                showName: false,
                initialProgramme: widget.programme,
                initialSectors: widget.sectors,
              ),
              const SizedBox(height: 16),
              FilledButton(onPressed: _save, child: const Text('Save')),
            ],
          ),
        ),
      ],
    ),
  );
}
