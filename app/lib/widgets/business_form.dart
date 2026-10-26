import 'package:flutter/material.dart';

import '../services/convex_client.dart';
import '../theme.dart';
import 'common.dart';

String programmeLabel(String key) => key == 'custom' ? 'Custom' : key;

/// Business name, where it is (country and region), the programme it follows (NP1/NP2/NP3
/// or custom) and which of that programme's sectors apply. Used at sign-up and when adding
/// another business; changing an existing business's programme shows only the programme part.
class BusinessForm extends StatefulWidget {
  const BusinessForm({
    super.key,
    this.showName = true,
    this.initialProgramme,
    this.initialSectors = const [],
  });

  /// False when only changing the programme of an existing business (no name or location).
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
  String _jurisdiction = 'NZ';
  String? _region;
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
    if ((widget.showName && (_name.text.trim().isEmpty || _region == null)) ||
        _programme == null) {
      return null;
    }
    return {
      if (widget.showName) ...{
        'name': _name.text.trim(),
        'jurisdiction': _jurisdiction,
        'region': _region,
      },
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
        if (widget.showName) ...[
          const SectionTitle('Where is it?'),
          CountryPicker(
            value: _jurisdiction,
            onChanged: (v) => setState(() {
              _jurisdiction = v;
              _region = null;
            }),
          ),
          const SizedBox(height: 12),
          RegionField(
            jurisdiction: _jurisdiction,
            value: _region,
            onChanged: (v) => setState(() => _region = v),
            showError: _showErrors,
          ),
        ],
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
        color: selected ? AppColors.jam : AppColors.border,
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
                  color: AppColors.jam,
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

/// New Zealand (MPI rules) or Australia (FSANZ rules).
class CountryPicker extends StatelessWidget {
  const CountryPicker({
    super.key,
    required this.value,
    required this.onChanged,
  });
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) => SegmentedButton<String>(
    segments: const [
      ButtonSegment(value: 'NZ', label: Text('New Zealand (MPI)')),
      ButtonSegment(value: 'AU', label: Text('Australia (FSANZ)')),
    ],
    selected: {value},
    onSelectionChanged: (v) => onChanged(v.first),
  );
}

/// The region (NZ) or state (AU) a business is in, from `businesses:regions`.
class RegionField extends StatefulWidget {
  const RegionField({
    super.key,
    required this.jurisdiction,
    required this.value,
    required this.onChanged,
    this.showError = false,
  });
  final String jurisdiction;
  final String? value;
  final ValueChanged<String> onChanged;

  /// Show "Required" when nothing is chosen.
  final bool showError;

  @override
  State<RegionField> createState() => _RegionFieldState();
}

class _RegionFieldState extends State<RegionField> {
  Map<String, dynamic>? _regions;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      // Public query: no session yet at sign-up.
      final r = await context.convex.query('businesses:regions');
      if (mounted) {
        setState(() {
          _regions = Map<String, dynamic>.from(r);
          _error = null;
        });
      }
    } on ConvexException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Row(
        children: [
          Expanded(child: Text(_error!)),
          TextButton(onPressed: _load, child: const Text('Retry')),
        ],
      );
    }
    if (_regions == null) return const LinearProgressIndicator();
    final options = List<String>.from(_regions![widget.jurisdiction]);
    final label = widget.jurisdiction == 'AU' ? 'State or territory' : 'Region';
    return DropdownButtonFormField<String>(
      // A new country starts with nothing chosen.
      key: ValueKey(widget.jurisdiction),
      initialValue: options.contains(widget.value) ? widget.value : null,
      isExpanded: true,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: const Icon(Icons.place_outlined),
        errorText: widget.showError && widget.value == null ? 'Required' : null,
      ),
      items: [
        for (final r in options) DropdownMenuItem(value: r, child: Text(r)),
      ],
      onChanged: (v) => widget.onChanged(v!),
    );
  }
}
