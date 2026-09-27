// C3 (Firebase SDK removal, 27 September 2026 review continuation) -- regression coverage for a
// real, confirmed, reachable crash: AIChatService is a singleton whose `auth`/`firestore` fields
// used to be eager `final` initializers (`final auth = FirebaseAuth.instance;`), so merely touching
// `AIChatService.instance` for the first time -- which web_header.dart's own live "AI Chat" menu
// item does via ai_chat_screen.dart's `useMemoized(() => AIChatService.instance)` -- threw
// synchronously with no Firebase app ever initialized (confirmed empirically elsewhere this
// phase), before any try/catch anywhere in the class could run. Fixed by making `firestore` a lazy
// getter (each of its 4 call sites already has its own try/catch) and replacing every
// `auth.currentUser` read with a `_safeCurrentUser()` helper that never throws.
//
// This test cannot exercise the real pre-fix crash as a negative control that also compiles
// against the OLD source: the old field initializers are simply gone, an unavoidable
// API-shape change for a genuine crash fix, not a claimed behavioral regression control.

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('AIChatService.instance never throws just from being touched, with no Firebase app initialized', () {
    expect(() => AIChatService.instance, returnsNormally);
  });

  test('every session/message operation degrades honestly instead of throwing, with no signed-in Firebase user', () async {
    final service = AIChatService.instance;

    await expectLater(service.initSession(), completes);
    expect(await service.getAllSessions(), isEmpty);
    await expectLater(service.deleteSession('nonexistent'), completes);
    await expectLater(
      service.saveMessage(ChatMessage.user(text: 'hello', sessionId: 'local-only')),
      completes,
    );
    expect(await service.loadSessionHistory('nonexistent'), isEmpty);
  });
}
