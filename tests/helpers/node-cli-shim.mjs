// A kernel shebang cannot quote an absolute interpreter path containing spaces.
// Resolve Node through the controlled test PATH so fake tools remain executable.
export const NODE_CLI_SHEBANG = '#!/usr/bin/env node\n';
