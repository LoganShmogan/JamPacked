// Fails unless coverage/lcov.info (from `flutter test --coverage`) reports 100% line coverage.
// test/app_test.dart imports main.dart, which pulls in every library, so a new file with no
// tests still shows up here with 0 hits rather than being silently left out.
//
//   flutter test --coverage && dart run tool/check_coverage.dart
import 'dart:io';

void main() {
  final lcov = File('coverage/lcov.info');
  if (!lcov.existsSync()) {
    stderr.writeln(
      'coverage/lcov.info not found. Run `flutter test --coverage` first.',
    );
    exit(2);
  }
  final missed = <String, List<int>>{};
  var total = 0, hit = 0;
  String? file;
  for (final line in lcov.readAsLinesSync()) {
    if (line.startsWith('SF:')) file = line.substring(3);
    if (!line.startsWith('DA:')) continue;
    final [n, count, ...] = line.substring(3).split(',');
    total++;
    if (int.parse(count) > 0) {
      hit++;
    } else {
      missed.putIfAbsent(file!, () => []).add(int.parse(n));
    }
  }
  final pct = total == 0 ? 0 : hit * 100 / total;
  stdout.writeln('Line coverage: $hit/$total (${pct.toStringAsFixed(1)}%)');
  if (missed.isEmpty) return;
  for (final e in missed.entries) {
    stdout.writeln('  ${e.key}: lines ${e.value.join(', ')}');
  }
  exit(1);
}
