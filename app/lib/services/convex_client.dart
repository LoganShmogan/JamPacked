import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class ConvexException implements Exception {
  ConvexException(this.message);
  final String message;
  @override
  String toString() => message;
}

/// Minimal Convex client over the HTTP API (works on web, Android and iOS without native code).
/// Calls are named "module:function", e.g. `query('deliveries:list', {...})`.
///
/// Any successful mutation/action bumps [changes], which [QueryBuilder] widgets listen to so
/// open screens refetch — a lightweight stand-in for Convex's reactive subscriptions.
class ConvexClient {
  ConvexClient(this.baseUrl);
  final String baseUrl;
  final changes = ValueNotifier<int>(0);

  Future<dynamic> query(String path, [Map<String, dynamic> args = const {}]) =>
      _call('query', path, args);

  Future<dynamic> mutation(
    String path, [
    Map<String, dynamic> args = const {},
  ]) async {
    final result = await _call('mutation', path, args);
    changes.value++;
    return result;
  }

  Future<dynamic> action(
    String path, [
    Map<String, dynamic> args = const {},
  ]) async {
    final result = await _call('action', path, args);
    changes.value++;
    return result;
  }

  Future<dynamic> _call(
    String kind,
    String path,
    Map<String, dynamic> args,
  ) async {
    final http.Response res;
    try {
      res = await http.post(
        Uri.parse('$baseUrl/api/$kind'),
        headers: {'content-type': 'application/json'},
        body: jsonEncode({
          'path': path,
          'args': _clean(args),
          'format': 'json',
        }),
      );
    } catch (e) {
      throw ConvexException('Cannot reach the server. Check your connection.');
    }
    final Map<String, dynamic> body;
    try {
      body = jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {
      throw ConvexException('Server error (${res.statusCode})');
    }
    if (body['status'] == 'success') return body['value'];
    // ConvexError messages come through errorData; anything else is an unexpected server error.
    final data = body['errorData'];
    if (data is String) throw ConvexException(data);
    debugPrint('Convex $kind $path failed: ${body['errorMessage']}');
    throw ConvexException('Something went wrong. Please try again.');
  }

  /// Convex rejects explicit nulls for optional fields; drop them.
  static dynamic _clean(dynamic v) => switch (v) {
    Map m => {
      for (final e in m.entries)
        if (e.value != null) e.key: _clean(e.value),
    },
    List l => l.map(_clean).toList(),
    _ => v,
  };
}
