import 'package:flutter/material.dart';

import '../services/convex_client.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'programme_screen.dart';

/// A fresh key for something new in a programme. Keys never change once saved, so records
/// stay linked to their type even if it is renamed.
String newKey(String prefix) =>
    '$prefix${DateTime.now().microsecondsSinceEpoch}';

const _fieldTypes = {
  'yesno': 'Yes / No',
  'number': 'Number',
  'text': 'Text',
  'date': 'Date',
};

Widget _frequencyPicker(String? value, ValueChanged<String?> onChanged) =>
    DropdownButtonFormField<String?>(
      initialValue: value,
      decoration: const InputDecoration(labelText: 'How often'),
      items: [
        const DropdownMenuItem(value: null, child: Text('When needed')),
        for (final e in frequencyLabels.entries)
          DropdownMenuItem(value: e.key, child: Text(e.value)),
      ],
      onChanged: onChanged,
    );

/// Edit a custom programme you own. Changes apply to every business that uses it.
class CustomProgrammeEditor extends StatefulWidget {
  const CustomProgrammeEditor({super.key, required this.id});
  final String id;
  @override
  State<CustomProgrammeEditor> createState() => _CustomProgrammeEditorState();
}

class _CustomProgrammeEditorState extends State<CustomProgrammeEditor> {
  Map<String, dynamic>? _p;
  String? _error;
  final _name = TextEditingController();
  final _description = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final p = await context.userQ('customProgrammes:get', {'id': widget.id});
      if (!mounted) return;
      setState(() {
        // Copy the lists so edits never touch (or trip over the types of) the loaded data.
        _p = p == null
            ? null
            : {
                ...p,
                for (final k in [
                  'receivingPrompts',
                  'recordTypes',
                  'templates',
                ])
                  k: [...p[k]],
              };
        _error = p == null ? 'Programme not found' : null;
        _name.text = p?['name'] ?? '';
        _description.text = p?['description'] ?? '';
      });
    } on ConvexException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  List get _prompts => _p!['receivingPrompts'] as List;
  List get _records => _p!['recordTypes'] as List;
  List get _checklists => _p!['templates'] as List;

  Future<void> _save() async {
    final nav = Navigator.of(context);
    final ok = await context.run(() async {
      await context.userM('customProgrammes:update', {
        'id': widget.id,
        'name': _name.text.trim(),
        'description': _description.text.trim(),
        'dailyChilledCheck': _p!['dailyChilledCheck'],
        'receivingPrompts': _prompts,
        'recordTypes': _records,
        'templates': _checklists,
      });
      return true;
    }, success: 'Programme saved');
    if (ok != null) nav.pop();
  }

  Future<void> _addPrompt() async {
    final text = await promptText(
      context,
      title: 'Check at goods inwards',
      label: 'What should be checked?',
      confirm: 'Add',
    );
    if (text == null || text.isEmpty) return;
    setState(() => _prompts.add({'key': newKey('p'), 'text': text}));
  }

  Future<void> _editRecord([int? i]) async {
    final out = await Navigator.of(context).push<Map<String, dynamic>>(
      MaterialPageRoute(
        builder: (_) =>
            RecordTypeEditor(initial: i == null ? null : _records[i]),
      ),
    );
    if (out != null) {
      setState(() => i == null ? _records.add(out) : _records[i] = out);
    }
  }

  Future<void> _editChecklist([int? i]) async {
    final out = await Navigator.of(context).push<Map<String, dynamic>>(
      MaterialPageRoute(
        builder: (_) =>
            ChecklistEditor(initial: i == null ? null : _checklists[i]),
      ),
    );
    if (out != null) {
      setState(() => i == null ? _checklists.add(out) : _checklists[i] = out);
    }
  }

  Widget _row(
    String title,
    String sub,
    VoidCallback? onTap,
    VoidCallback onDelete,
  ) => ListTile(
    title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
    subtitle: Text(sub),
    onTap: onTap,
    trailing: IconButton(
      tooltip: 'Remove',
      icon: const Icon(Icons.delete_outline),
      onPressed: onDelete,
    ),
  );

  @override
  Widget build(BuildContext context) {
    if (_p == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Edit programme')),
        body: Center(
          child: _error == null
              ? const CircularProgressIndicator()
              : Text(_error!),
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(
        title: const Text('Edit programme'),
        actions: [TextButton(onPressed: _save, child: const Text('Save'))],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Responsive(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _name,
                  decoration: const InputDecoration(
                    labelText: 'Programme name',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _description,
                  maxLines: 2,
                  decoration: const InputDecoration(labelText: 'Description'),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Daily chilled temperature check'),
                  subtitle: const Text(
                    'Shows as due every day until a chiller or freezer is checked',
                  ),
                  value: _p!['dailyChilledCheck'] == true,
                  onChanged: (v) =>
                      setState(() => _p!['dailyChilledCheck'] = v),
                ),
                SectionTitle(
                  'Asked at goods inwards',
                  trailing: TextButton(
                    onPressed: _addPrompt,
                    child: const Text('Add'),
                  ),
                ),
                Card(
                  child: Column(
                    children: [
                      for (var i = 0; i < _prompts.length; i++)
                        _row(
                          _prompts[i]['text'],
                          'Yes / No / N/A on every delivery',
                          null,
                          () => setState(() => _prompts.removeAt(i)),
                        ),
                    ],
                  ),
                ),
                SectionTitle(
                  'Records',
                  trailing: TextButton(
                    onPressed: _editRecord,
                    child: const Text('Add'),
                  ),
                ),
                Card(
                  child: Column(
                    children: [
                      for (var i = 0; i < _records.length; i++)
                        _row(
                          _records[i]['name'],
                          '${(_records[i]['fields'] as List).length} fields · '
                          '${_records[i]['frequency'] == null ? 'When needed' : frequencyLabels[_records[i]['frequency']]}',
                          () => _editRecord(i),
                          () => setState(() => _records.removeAt(i)),
                        ),
                    ],
                  ),
                ),
                SectionTitle(
                  'Checklists',
                  trailing: TextButton(
                    onPressed: _editChecklist,
                    child: const Text('Add'),
                  ),
                ),
                Card(
                  child: Column(
                    children: [
                      for (var i = 0; i < _checklists.length; i++)
                        _row(
                          _checklists[i]['name'],
                          '${(_checklists[i]['questions'] as List).length} questions · '
                          '${_checklists[i]['frequency'] == null ? 'When needed' : frequencyLabels[_checklists[i]['frequency']]}',
                          () => _editChecklist(i),
                          () => setState(() => _checklists.removeAt(i)),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Removing something stops the app asking for it. Records already kept are never deleted.',
                  style: TextStyle(color: AppColors.muted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A kind of record: its name, how often it's due, and the fields to fill in, each with an
/// optional limit that flags a problem (and raises a corrective action).
class RecordTypeEditor extends StatefulWidget {
  const RecordTypeEditor({super.key, this.initial});
  final Map? initial;
  @override
  State<RecordTypeEditor> createState() => _RecordTypeEditorState();
}

class _RecordTypeEditorState extends State<RecordTypeEditor> {
  late final _key = widget.initial?['key'] ?? newKey('r');
  late final _name = TextEditingController(text: widget.initial?['name']);
  late final _description = TextEditingController(
    text: widget.initial?['description'],
  );
  late String? _frequency = widget.initial?['frequency'];
  late final List<Map<String, dynamic>> _fields = [
    for (final f in (widget.initial?['fields'] ?? []) as List)
      Map<String, dynamic>.from(f),
  ];

  void _done() {
    if (_name.text.trim().isEmpty) {
      return context.toast('Give the record a name', error: true);
    }
    if (_fields.isEmpty) {
      return context.toast('Add at least one field', error: true);
    }
    if (_fields.any((f) => (f['label'] as String).trim().isEmpty)) {
      return context.toast('Every field needs a label', error: true);
    }
    Navigator.pop(context, {
      'key': _key,
      'name': _name.text.trim(),
      'description': _description.text.trim(),
      'frequency': _frequency,
      'fields': [
        for (final f in _fields)
          {
            ...({...f}..remove('failIf')),
            'label': (f['label'] as String).trim(),
            'failIf': ?_failIf(f),
          },
      ],
    });
  }

  /// The field's "problem when..." rule as the server expects it.
  Map? _failIf(Map f) {
    final msg = '${(f['label'] as String).trim()} out of limits';
    if (f['type'] == 'yesno') {
      final rule = f['failIf']?['equals'];
      return rule == null
          ? null
          : {
              'equals': rule,
              'message': '${f['label']}: ${rule ? 'Yes' : 'No'}',
            };
    }
    if (f['type'] != 'number') return null;
    final above = f['failIf']?['above'], below = f['failIf']?['below'];
    if (above == null && below == null) return null;
    return {'above': ?above, 'below': ?below, 'message': msg};
  }

  Widget _fieldCard(int i) {
    final f = _fields[i];
    final rule = (f['failIf'] ?? {}) as Map;
    void setRule(String k, Object? v) => setState(() {
      final next = {...rule, k: v}..removeWhere((_, x) => x == null);
      f['failIf'] = next.keys.any((k) => k != 'message') ? next : null;
    });
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    initialValue: f['label'],
                    decoration: const InputDecoration(labelText: 'Field label'),
                    onChanged: (v) => f['label'] = v,
                  ),
                ),
                IconButton(
                  tooltip: 'Remove field',
                  icon: const Icon(Icons.delete_outline),
                  onPressed: () => setState(() => _fields.removeAt(i)),
                ),
              ],
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              initialValue: f['type'],
              decoration: const InputDecoration(labelText: 'Answer type'),
              items: [
                for (final e in _fieldTypes.entries)
                  DropdownMenuItem(value: e.key, child: Text(e.value)),
              ],
              onChanged: (v) =>
                  setState(() => (f['type'] = v, f['failIf'] = null)),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Required'),
              value: f['required'] == true,
              onChanged: (v) => setState(() => f['required'] = v),
            ),
            if (f['type'] == 'yesno')
              DropdownButtonFormField<bool?>(
                initialValue: rule['equals'],
                decoration: const InputDecoration(
                  labelText: 'Flag a problem when',
                ),
                items: const [
                  DropdownMenuItem(value: null, child: Text('Never')),
                  DropdownMenuItem(
                    value: true,
                    child: Text('The answer is Yes'),
                  ),
                  DropdownMenuItem(
                    value: false,
                    child: Text('The answer is No'),
                  ),
                ],
                onChanged: (v) => setRule('equals', v),
              ),
            if (f['type'] == 'number')
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      initialValue: f['unit'],
                      decoration: const InputDecoration(labelText: 'Unit'),
                      onChanged: (v) =>
                          f['unit'] = v.trim().isEmpty ? null : v.trim(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  for (final (k, label) in [
                    ('above', 'Problem above'),
                    ('below', 'Problem below'),
                  ]) ...[
                    Expanded(
                      child: TextFormField(
                        initialValue: rule[k] == null ? '' : fmtNum(rule[k]),
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                          signed: true,
                        ),
                        decoration: InputDecoration(labelText: label),
                        onChanged: (v) => setRule(k, double.tryParse(v)),
                      ),
                    ),
                    if (k == 'above') const SizedBox(width: 8),
                  ],
                ],
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(widget.initial == null ? 'New record' : 'Edit record'),
      actions: [TextButton(onPressed: _done, child: const Text('Done'))],
    ),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Responsive(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _name,
                decoration: const InputDecoration(labelText: 'Name'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _description,
                decoration: const InputDecoration(
                  labelText: 'What to do (shown on the form)',
                ),
              ),
              const SizedBox(height: 12),
              _frequencyPicker(
                _frequency,
                (v) => setState(() => _frequency = v),
              ),
              SectionTitle(
                'Fields',
                trailing: TextButton(
                  onPressed: () => setState(
                    () => _fields.add({
                      'key': newKey('f'),
                      'label': '',
                      'type': 'yesno',
                    }),
                  ),
                  child: const Text('Add field'),
                ),
              ),
              for (var i = 0; i < _fields.length; i++)
                KeyedSubtree(
                  key: ValueKey(_fields[i]['key']),
                  child: _fieldCard(i),
                ),
            ],
          ),
        ),
      ],
    ),
  );
}

/// A checklist (audit) of your own: questions grouped by section.
class ChecklistEditor extends StatefulWidget {
  const ChecklistEditor({super.key, this.initial});
  final Map? initial;
  @override
  State<ChecklistEditor> createState() => _ChecklistEditorState();
}

class _ChecklistEditorState extends State<ChecklistEditor> {
  late final _key = widget.initial?['key'] ?? newKey('c');
  late final _name = TextEditingController(text: widget.initial?['name']);
  late final _description = TextEditingController(
    text: widget.initial?['description'],
  );
  late final _period = TextEditingController(
    text: fmtNum(widget.initial?['defaultPeriodDays'] ?? 7),
  );
  late String? _frequency = widget.initial?['frequency'];
  late final List<Map<String, dynamic>> _questions = [
    for (final q in (widget.initial?['questions'] ?? []) as List)
      Map<String, dynamic>.from(q),
  ];

  void _done() {
    if (_name.text.trim().isEmpty) {
      return context.toast('Give the checklist a name', error: true);
    }
    if (_questions.isEmpty) {
      return context.toast('Add at least one question', error: true);
    }
    if (_questions.any((q) => (q['text'] as String).trim().isEmpty)) {
      return context.toast('Every question needs text', error: true);
    }
    Navigator.pop(context, {
      'key': _key,
      'name': _name.text.trim(),
      'description': _description.text.trim(),
      'defaultPeriodDays': int.tryParse(_period.text) ?? 7,
      'frequency': _frequency,
      'questions': [
        for (final q in _questions)
          {
            ...q,
            'text': (q['text'] as String).trim(),
            'section': (q['section'] as String).trim().isEmpty
                ? 'General'
                : (q['section'] as String).trim(),
          },
      ],
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(widget.initial == null ? 'New checklist' : 'Edit checklist'),
      actions: [TextButton(onPressed: _done, child: const Text('Done'))],
    ),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Responsive(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _name,
                decoration: const InputDecoration(labelText: 'Name'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _description,
                decoration: const InputDecoration(labelText: 'Description'),
              ),
              const SizedBox(height: 12),
              _frequencyPicker(
                _frequency,
                (v) => setState(() => _frequency = v),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _period,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Covers the last ... days',
                  helperText:
                      'Records from this period are used to pre-fill answers',
                ),
              ),
              SectionTitle(
                'Questions',
                trailing: TextButton(
                  onPressed: () => setState(
                    () => _questions.add({
                      'id': newKey('q'),
                      'section': '',
                      'text': '',
                      'type': 'yesno',
                    }),
                  ),
                  child: const Text('Add question'),
                ),
              ),
              for (var i = 0; i < _questions.length; i++)
                Card(
                  key: ValueKey(_questions[i]['id']),
                  margin: const EdgeInsets.only(bottom: 8),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: TextFormField(
                                initialValue: _questions[i]['text'],
                                decoration: const InputDecoration(
                                  labelText: 'Question',
                                ),
                                onChanged: (v) => _questions[i]['text'] = v,
                              ),
                            ),
                            IconButton(
                              tooltip: 'Remove question',
                              icon: const Icon(Icons.delete_outline),
                              onPressed: () =>
                                  setState(() => _questions.removeAt(i)),
                            ),
                          ],
                        ),
                        Row(
                          children: [
                            Expanded(
                              child: TextFormField(
                                initialValue: _questions[i]['section'],
                                decoration: const InputDecoration(
                                  labelText: 'Section',
                                ),
                                onChanged: (v) => _questions[i]['section'] = v,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: DropdownButtonFormField<String>(
                                initialValue: _questions[i]['type'],
                                decoration: const InputDecoration(
                                  labelText: 'Answer',
                                ),
                                items: [
                                  for (final t in ['yesno', 'number', 'text'])
                                    DropdownMenuItem(
                                      value: t,
                                      child: Text(_fieldTypes[t]!),
                                    ),
                                ],
                                onChanged: (v) => _questions[i]['type'] = v,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    ),
  );
}
