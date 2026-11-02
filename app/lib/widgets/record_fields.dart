import 'package:flutter/material.dart';

import 'common.dart';

/// The answers to a programme record's fields while it's being filled in.
class RecordAnswers {
  RecordAnswers(this.fields);
  final List<Map> fields;
  late final _text = {
    for (final f in fields)
      if (f['type'] == 'text' || f['type'] == 'number')
        f['key']: TextEditingController(),
  };
  final _picked = <String, Object?>{}; // yes/no and date answers

  /// The answers by field key, or the label of the first required field left empty.
  (Map<String, dynamic>, String?) values() {
    final out = <String, dynamic>{};
    for (final f in fields) {
      final k = f['key'] as String;
      final v = switch (f['type']) {
        'text' => _text[k]!.text.trim().isEmpty ? null : _text[k]!.text.trim(),
        'number' => double.tryParse(_text[k]!.text),
        _ => _picked[k],
      };
      if (f['required'] == true && v == null) {
        return (out, f['label'] as String);
      }
      out[k] = v;
    }
    return (out, null);
  }

  /// One field's input. [changed] rebuilds the form after a yes/no or date is picked.
  Widget field(BuildContext context, Map f, VoidCallback changed) {
    final k = f['key'] as String;
    final label = '${f['label']}${f['required'] == true ? ' *' : ''}';
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: switch (f['type']) {
        'yesno' => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              children: [
                for (final (v, text) in [(true, 'Yes'), (false, 'No')])
                  ChoiceChip(
                    label: Text(text),
                    selected: _picked[k] == v,
                    onSelected: (_) {
                      _picked[k] = v;
                      changed();
                    },
                  ),
              ],
            ),
          ],
        ),
        'date' => OutlinedButton.icon(
          icon: const Icon(Icons.event),
          label: Text(
            _picked[k] == null ? label : '$label: ${fmtDate(_picked[k])}',
          ),
          onPressed: () async {
            final now = DateTime.now();
            final d = await showDatePicker(
              context: context,
              firstDate: now.subtract(const Duration(days: 365 * 2)),
              lastDate: now.add(const Duration(days: 365)),
              initialDate: now,
            );
            if (d != null) {
              _picked[k] = d.millisecondsSinceEpoch;
              changed();
            }
          },
        ),
        _ => TextField(
          controller: _text[k],
          keyboardType: f['type'] == 'number'
              ? const TextInputType.numberWithOptions(
                  decimal: true,
                  signed: true,
                )
              : TextInputType.text,
          decoration: InputDecoration(labelText: label, suffixText: f['unit']),
        ),
      },
    );
  }
}
