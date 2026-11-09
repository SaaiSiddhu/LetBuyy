# Local artifact retention

The exact observed source archives, installed-byte checksums, screenshots and logs remain retained. Earlier Android lanes reused Flutter's common APK output path without copying each original binary; those older APK bytes are not preserved here. Their installed-hash observations remain evidence, but no later rebuilt binary may be labelled the original artifact.

Current warehouse08c37b03d217 original debug APK bytes are now privately preserved at `/private/tmp/letbuyy-merchant-local-20261102-br1jhgh8/native-warehouse-v1/qualified-artifact/merchant-local-debug.apk`. Its SHA-256 is80cd10940f528686bf8ff5fc6c7a6a2e95bfaefaeb54880b29732b8baa172057. The original source archive and installed hash match the terminal passing run. No production credential is compiled into it.

Future Android lanes must copy the built APK into their fresh private run directory before installing it, verify the preserved and installed hashes against that copy, and record its binary path separately from the source archive. This evidence deficiency does not turn past hash/source observations into binary-retention proof.

Warehouse labels v11: source23b83f0f827178f495923b9cb9e07ddb48ff423179cdbdb34441461fb99cdad6/7414archived at /private/tmp/letbuyy-merchant-local-20261102-br1jhgh8/warehouse-labels-v2-qualified-source; original debug APK1561ad8e7049012deb841054aabd934e498eb57c000fd2637fb1f86cc04bdfc6retained at /private/tmp/letbuyy-merchant-local-20261102-br1jhgh8/native-warehouse-v11/qualified-artifact/merchant-local-debug.apk. Installed-byte readback and normal web/Android journey3acddf6ca92epassed. This is a local debug/Node-module API run, not signed release or compiled Workerd phone acceptance.
