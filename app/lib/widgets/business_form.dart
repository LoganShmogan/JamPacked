import 'package:flutter/material.dart';

import '../services/convex_client.dart';
import '../theme.dart';
import 'common.dart';

String programmeLabel(String key) => key == 'custom' ? 'Custom' : key;

/// Business name, the programme it follows (NP1/NP2/NP3 or custom) and which of that
/// programme's sectors apply. Used at sign-up and when adding another business.
class BusinessForm extends StatefulWidget {
  const BusinessForm({
    super.key,
    this.showName = true,
    this.initialProgramme,
    this.initialSectors = const [],
  });

  /// False when only changing the programme of an existing business.
  final bool showName;
  final String? initialProgramme;
  final List<String> initialSectors;
  @override
  State<BusinessForm> createState() => BusinessFormState();
}

class BusinessFormState extends State<BusinessForm> {
  final _name = TextEditingController();
  List<Map<String, dynamic>>? _programmes;
  String? _error;
  late String? _programme = widget.initialProgramme;
  late final _sectors = {...widget.initialSectors};
  bool _showErrors = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      // Public query: no session yet at sign-up.
      final list = await context.convex.query('businesses:programmes');
      if (mounted) {
        setState(() {
          _programmes = List<Map<String, dynamic>>.from(list);
          _error = null;
        });
      }
    } on ConvexException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  /// The business to create, or null (with errors shown) if incomplete.
  Map<String, dynamic>? collect() {
    setState(() => _showErrors = true);
    if ((widget.showName && _name.text.trim().isEmpty) || _programme == null) {
      return null;
    }
    return {
      if (widget.showName) 'name': _name.text.trim(),
      'programme': _programme,
      'sectors': _sectors.toList(),
    };
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Column(
        children: [
          Text(_error!, textAlign: TextAlign.center),
          TextButton(onPressed: _load, child: const Text('Retry')),
        ],
      );
    }
    if (_programmes == null) {
      return const Center(child: CircularProgressIndicator());
    }
    final chosen = _programmes!
        .where((p) => p['key'] == _programme)
        .firstOrNull;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.showName)
          TextField(
            controller: _name,
            textCapitalization: TextCapitalization.words,
            decoration: InputDecoration(
              labelText: 'Business name',
              prefixIcon: const Icon(Icons.storefront_outlined),
              errorText: _showErrors && _name.text.trim().isEmpty
                  ? 'Required'
                  : null,
            ),
          ),
        const SectionTitle('Which programme do you follow?'),
        if (_showErrors && _programme == null)
          const Padding(
            padding: EdgeInsets.only(bottom: 8),
            child: Text(
              'Choose a programme',
              style: TextStyle(color: AppColors.bad),
            ),
          ),
        for (final p in _programmes!)
          _ProgrammeCard(
            title: '${p['key']}: ${p['name']}',
            subtitle: p['risk'],
            points: List<String>.from(p['whoFor']),
            selected: _programme == p['key'],
            onTap: () => setState(() {
              _programme = p['key'];
              _sectors.clear();
            }),
          ),
        _ProgrammeCard(
          title: 'Custom programme',
          subtitle: 'Build your own checks',
          points: const [
            'Your own receiving checks, records and checklists',
            'For Food Control Plans, AU businesses or anything not covered by NP1-3',
          ],
          selected: _programme == 'custom',
          onTap: () => setState(() {
            _programme = 'custom';
            _sectors.clear();
          }),
        ),
        if (chosen != null) ...[
          const SectionTitle('What does your business do?'),
          const Text(
            'Pick any that apply. Some rules only apply to these types of business.',
            style: TextStyle(color: AppColors.muted),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final s in chosen['sectors'] as List)
                FilterChip(
                  label: Text(s['label']),
                  selected: _sectors.contains(s['key']),
                  onSelected: (on) => setState(
                    () =>
                        on ? _sectors.add(s['key']) : _sectors.remove(s['key']),
                  ),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

class _ProgrammeCard extends StatelessWidget {
  const _ProgrammeCard({
    required this.title,
    required this.subtitle,
    required this.points,
    required this.selected,
    required this.onTap,
  });
  final String title, subtitle;
  final List<String> points;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 8),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(12),
      side: BorderSide(
        color: selected ? AppColors.orange : AppColors.border,
        width: selected ? 2 : 1,
      ),
    ),
    child: InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  selected
                      ? Icons.radio_button_checked
                      : Icons.radio_button_off,
                  color: AppColors.orange,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                Pill(subtitle, tone: Tone.brand),
              ],
            ),
            const SizedBox(height: 6),
            for (final p in points)
              Padding(
                padding: const EdgeInsets.only(left: 32, top: 2),
                child: Text(
                  '• $p',
                  style: const TextStyle(color: AppColors.muted, fontSize: 13),
                ),
              ),
          ],
        ),
      ),
    ),
  );
}
