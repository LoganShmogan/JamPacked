import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'convex_client.dart';

class AppUser {
  AppUser(this.id, this.name, this.email, this.role);
  factory AppUser.fromJson(Map<String, dynamic> j) =>
      AppUser(j['_id'], j['name'], j['email'], j['role']);
  final String id, name, email, role;
  bool get isManager => role == 'admin' || role == 'manager';
  bool get isAdmin => role == 'admin';
}

/// Development auth: local accounts with PBKDF2-hashed passwords stored in Convex.
/// When moving to Clerk, replace login/register with Clerk sign-in and pass the Clerk JWT
/// to Convex (ctx.auth) instead of [token]; screens only depend on [user] and [token].
class AuthService extends ChangeNotifier {
  AuthService(this.convex);
  final ConvexClient convex;
  static const _key = 'session_token';

  String? token;
  AppUser? user;
  bool loading = true;

  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    token = prefs.getString(_key);
    if (token != null) {
      try {
        final me = await convex.query('auth:me', {'sessionToken': token});
        user = me == null ? null : AppUser.fromJson(me);
      } catch (_) {
        user = null;
      }
      if (user == null) {
        token = null;
        await prefs.remove(_key);
      }
    }
    loading = false;
    notifyListeners();
  }

  Future<void> login(String email, String password) => _start(
    convex.action('auth:login', {'email': email, 'password': password}),
  );

  Future<void> register(String name, String email, String password) => _start(
    convex.action('auth:register', {
      'name': name,
      'email': email,
      'password': password,
    }),
  );

  Future<void> _start(Future<dynamic> call) async {
    final res = await call;
    token = res['token'];
    final me = await convex.query('auth:me', {'sessionToken': token});
    user = AppUser.fromJson(me);
    (await SharedPreferences.getInstance()).setString(_key, token!);
    notifyListeners();
  }

  Future<void> logout() async {
    final t = token;
    token = null;
    user = null;
    (await SharedPreferences.getInstance()).remove(_key);
    notifyListeners();
    if (t != null) {
      try {
        await convex.mutation('auth:logout', {'sessionToken': t});
      } catch (_) {}
    }
  }
}
