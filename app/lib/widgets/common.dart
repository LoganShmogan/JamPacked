import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../services/convex_client.dart';
import '../theme.dart';

extension AppContext on BuildContext {
  ConvexClient get convex => read<ConvexClient>();
  AuthService get auth => read<AuthService>();
  String get token => read<AuthService>().token ?? '';

  /// Id of the business being worked in, or null on the business picker.
  String? get businessId => read<AuthService>().business?.id;

  /// Shorthands that add the session token, and the current business, to every call.
  Map<String, dynamic> _scoped(Map<String, dynamic> args) => {
    'businessId': ?businessId,
    ...args,
    'sessionToken': token,
  };
  Future<dynamic> q(String path, [Map<String, dynamic> args = const {}]) =>
      convex.query(path, _scoped(args));
  Future<dynamic> m(String path, [Map<String, dynamic> args = const {}]) =>
      convex.mutation(path, _scoped(args));
  Future<dynamic> a(String path, [Map<String, dynamic> args = const {}]) =>
      convex.action(path, _scoped(args));

  void toast(String msg, {bool error = false}) {
    ScaffoldMessenger.of(this)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(msg),
          backgroundColor: error ? AppColors.bad : AppColors.ink,
          behavior: SnackBarBehavior.floating,
        ),
      );
  }

  /// Runs [fn], showing server errors as a snackbar. Returns null on failure.
  Future<T?> run<T>(Future<T> Function() fn, {String? success}) async {
    try {
      final r = await fn();
      if (success != null && mounted) toast(success);
      return r;
    } on ConvexException catch (e) {
      if (mounted) toast(e.message, error: true);
      return null;
    }
  }
}

final _dt = DateFormat('d MMM yyyy, h:mm a');
final _d = DateFormat('d MMM yyyy');
DateTime fromMs(dynamic ms) =>
    DateTime.fromMillisecondsSinceEpoch((ms as num).toInt());
String fmtDateTime(dynamic ms) => ms == null ? '-' : _dt.format(fromMs(ms));
String fmtDate(dynamic ms) => ms == null ? '-' : _d.format(fromMs(ms));
int localDayStartMs() {
  final n = DateTime.now();
  return DateTime(n.year, n.month, n.day).millisecondsSinceEpoch;
}

String fmtNum(dynamic n) {
  if (n == null) return '-';
  final d = (n as num).toDouble();
  return d == d.roundToDouble() ? d.toInt().toString() : d.toStringAsFixed(1);
}

/// Fetches a Convex query and rebuilds when any mutation happens (pull-to-refresh too).
class QueryBuilder extends StatefulWidget {
  const QueryBuilder({
    super.key,
    required this.path,
    this.args = const {},
    required this.builder,
    this.refreshable = true,
  });
  final String path;
  final Map<String, dynamic> args;
  final Widget Function(BuildContext context, dynamic data) builder;
  final bool refreshable;

  @override
  State<QueryBuilder> createState() => _QueryBuilderState();
}

class _QueryBuilderState extends State<QueryBuilder> {
  dynamic _data;
  String? _error;
  bool _loading = true;
  late final ConvexClient _convex;

  @override
  void initState() {
    super.initState();
    _convex = context.convex;
    _convex.changes.addListener(_load);
    _load();
  }

  @override
  void didUpdateWidget(QueryBuilder old) {
    super.didUpdateWidget(old);
    if (old.path != widget.path ||
        old.args.toString() != widget.args.toString()) {
      _load();
    }
  }

  @override
  void dispose() {
    _convex.changes.removeListener(_load);
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final d = await context.q(widget.path, widget.args);
      if (mounted) setState(() => (_data = d, _error = null, _loading = false));
    } on ConvexException catch (e) {
      if (mounted) setState(() => (_error = e.message, _loading = false));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null && _data == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off, size: 48, color: AppColors.muted),
              const SizedBox(height: 12),
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              OutlinedButton(onPressed: _load, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }
    final child = widget.builder(context, _data);
    return widget.refreshable
        ? RefreshIndicator(
            color: AppColors.orange,
            onRefresh: _load,
            child: child,
          )
        : child;
  }
}

enum Tone { ok, warn, bad, neutral, brand }

class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, this.tone = Tone.neutral, this.icon});
  final String text;
  final Tone tone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (tone) {
      Tone.ok => (AppColors.okLight, AppColors.ok),
      Tone.warn => (AppColors.warnLight, AppColors.warn),
      Tone.bad => (AppColors.badLight, AppColors.bad),
      Tone.brand => (AppColors.orangeLight, AppColors.orangeDark),
      Tone.neutral => (const Color(0xFFF1F1F1), AppColors.muted),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: fg),
            const SizedBox(width: 4),
          ],
          // Flexible so long pills wrap instead of overflowing narrow screens.
          Flexible(
            child: Text(
              text,
              style: TextStyle(
                color: fg,
                fontWeight: FontWeight.w700,
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.trailing});
  final String text;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(4, 20, 4, 8),
    child: Row(
      children: [
        Expanded(
          child: Text(
            text.toUpperCase(),
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.8,
              color: AppColors.muted,
            ),
          ),
        ),
        ?trailing,
      ],
    ),
  );
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.message,
  });
  final IconData icon;
  final String title;
  final String? message;
  @override
  Widget build(BuildContext context) => ListView(
    // ListView so pull-to-refresh still works on empty screens
    padding: const EdgeInsets.all(32),
    children: [
      const SizedBox(height: 40),
      CircleAvatar(
        radius: 36,
        backgroundColor: AppColors.orangeLight,
        child: Icon(icon, size: 36, color: AppColors.orange),
      ),
      const SizedBox(height: 16),
      Text(
        title,
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.titleMedium,
      ),
      if (message != null) ...[
        const SizedBox(height: 6),
        Text(
          message!,
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.muted),
        ),
      ],
    ],
  );
}

class InfoRow extends StatelessWidget {
  const InfoRow(this.label, this.value, {super.key});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 130,
          child: Text(label, style: const TextStyle(color: AppColors.muted)),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ),
      ],
    ),
  );
}

/// Constrains content width on tablets/desktop web while staying full-width on phones.
class Responsive extends StatelessWidget {
  const Responsive({super.key, required this.child, this.maxWidth = 760});
  final Widget child;
  final double maxWidth;
  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.topCenter,
    child: ConstrainedBox(
      constraints: BoxConstraints(maxWidth: maxWidth),
      child: child,
    ),
  );
}

Future<String?> promptText(
  BuildContext context, {
  required String title,
  String? label,
  String confirm = 'Save',
  String? hint,
}) {
  final ctrl = TextEditingController();
  return showDialog<String>(
    context: context,
    builder: (c) => AlertDialog(
      title: Text(title),
      content: TextField(
        controller: ctrl,
        autofocus: true,
        maxLines: 3,
        minLines: 1,
        decoration: InputDecoration(labelText: label, hintText: hint),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(c),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(c, ctrl.text.trim()),
          child: Text(confirm),
        ),
      ],
    ),
  );
}

const storageLabels = {
  'chilled': 'Chilled',
  'frozen': 'Frozen',
  'hot': 'Hot',
  'ambient': 'Ambient / dry',
};
const storageIcons = {
  'chilled': Icons.ac_unit,
  'frozen': Icons.severe_cold,
  'hot': Icons.local_fire_department,
  'ambient': Icons.inventory_2_outlined,
};

/// FSANZ Std 1.2.3 mandatory allergen declarations (PEAL), applies in NZ & AU.
const allergenList = [
  'gluten',
  'wheat',
  'crustacea',
  'egg',
  'fish',
  'milk',
  'peanut',
  'soy',
  'sesame',
  'almond',
  'brazil nut',
  'cashew',
  'hazelnut',
  'macadamia',
  'pecan',
  'pine nut',
  'pistachio',
  'walnut',
  'lupin',
  'mollusc',
  'sulphites',
];
