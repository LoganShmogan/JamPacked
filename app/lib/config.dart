/// Convex deployment URL. Override per environment:
///   flutter run --dart-define=CONVEX_URL=https://your-deployment.convex.cloud
/// Android emulator reaching a local backend: --dart-define=CONVEX_URL=http://10.0.2.2:3210
const convexUrl = String.fromEnvironment(
  'CONVEX_URL',
  defaultValue: 'http://127.0.0.1:3210',
);
