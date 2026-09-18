import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** The PreToolUse payload from stdin. Unreadable input allows the call: these guards catch mistakes, and a
 *  guard that blocks every tool call when its own input is odd would stop a run dead. */
export const readInput = async () => {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try { return JSON.parse(raw).tool_input ?? {}; } catch { return {}; }
};

export const deny = (reason) => process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
}));

/** True when this module is the script being run. Compared by real path: a checkout reached through a
 *  symlink (macOS `/var` → `/private/var`) otherwise never matches and the guard silently does nothing. */
export const isMain = (metaUrl) => {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(metaUrl)); } catch { return false; }
};
