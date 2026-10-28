import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:jampacked/services/convex_client.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// Runs [body] with every `http.post` answered by [handler].
Future<T> withHttp<T>(
  Future<http.Response> Function(http.Request req) handler,
  Future<T> Function() body,
) => http.runWithClient(body, () => MockClient(handler));

http.Response json(Object body, [int status = 200]) =>
    http.Response(jsonEncode(body), status);

void main() {
  final client = ConvexClient('https://example.convex.cloud');

  test('posts path, cleaned args and json format to /api/<kind>', () async {
    late http.Request sent;
    final value = await withHttp(
      (req) async {
        sent = req;
        return json({'status': 'success', 'value': 42});
      },
      () => client.query('deliveries:list', {
        'a': 1,
        'drop': null,
        'nested': {'keep': 'x', 'drop': null},
        'list': [
          {'k': null, 'v': 2},
          3,
        ],
      }),
    );
    expect(value, 42);
    expect(sent.url.toString(), 'https://example.convex.cloud/api/query');
    expect(sent.headers['content-type'], startsWith('application/json'));
    expect(jsonDecode(sent.body), {
      'path': 'deliveries:list',
      'args': {
        'a': 1,
        'nested': {'keep': 'x'},
        'list': [
          {'v': 2},
          3,
        ],
      },
      'format': 'json',
    });
  });

  test('query with default args sends an empty object', () async {
    late Map body;
    await withHttp((req) async {
      body = jsonDecode(req.body);
      return json({'status': 'success', 'value': null});
    }, () => client.query('audits:templates'));
    expect(body['args'], isEmpty);
  });

  test('mutation and action hit their endpoints and bump changes', () async {
    final kinds = <String>[];
    final before = client.changes.value;
    await withHttp(
      (req) async {
        kinds.add(req.url.path);
        return json({'status': 'success', 'value': 'ok'});
      },
      () async {
        expect(await client.mutation('a:b'), 'ok');
        expect(await client.action('a:c'), 'ok');
      },
    );
    expect(kinds, ['/api/mutation', '/api/action']);
    expect(client.changes.value, before + 2);
  });

  test('a failed mutation does not bump changes', () async {
    final before = client.changes.value;
    await withHttp(
      (_) async => json({'status': 'error', 'errorData': 'Nope'}),
      () =>
          expectLater(client.mutation('a:b'), throwsA(isA<ConvexException>())),
    );
    expect(client.changes.value, before);
  });

  test('ConvexError messages (errorData strings) are surfaced as-is', () async {
    await withHttp(
      (_) async => json({'status': 'error', 'errorData': 'Supplier not found'}),
      () => expectLater(
        client.query('x:y'),
        throwsA(
          isA<ConvexException>()
              .having((e) => e.message, 'message', 'Supplier not found')
              .having((e) => e.toString(), 'toString', 'Supplier not found'),
        ),
      ),
    );
  });

  test('unexpected server errors become a generic message', () async {
    await withHttp(
      (_) async => json({'status': 'error', 'errorMessage': 'TypeError: boom'}),
      () => expectLater(
        client.action('x:y'),
        throwsA(
          isA<ConvexException>().having(
            (e) => e.message,
            'message',
            'Something went wrong. Please try again.',
          ),
        ),
      ),
    );
  });

  test('non-JSON responses report the HTTP status', () async {
    await withHttp(
      (_) async => http.Response('<html>Bad gateway</html>', 502),
      () => expectLater(
        client.query('x:y'),
        throwsA(
          isA<ConvexException>().having(
            (e) => e.message,
            'message',
            'Server error (502)',
          ),
        ),
      ),
    );
  });

  test('network failures report a connection problem', () async {
    await withHttp(
      (_) async => throw http.ClientException('offline'),
      () => expectLater(
        client.query('x:y'),
        throwsA(
          isA<ConvexException>().having(
            (e) => e.message,
            'message',
            contains('Cannot reach the server'),
          ),
        ),
      ),
    );
  });
}
