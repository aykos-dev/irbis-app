#!/usr/bin/env bash
# Stop hook: "done" means `npm run check` passed. Blocks once, then lets Claude stop and report.
input="$(cat)"
[[ "$(jq -r '.stop_hook_active // false' <<<"$input")" == "true" ]] && exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0
[[ -f package.json ]] && jq -e '.scripts.check' package.json >/dev/null 2>&1 || exit 0
[[ -z "$(git status --porcelain 2>/dev/null)" ]] && exit 0
if ! out="$(npm run --silent check 2>&1)"; then
  tail -n 40 <<<"$out" >&2
  echo "Not done: npm run check failed. Fix it (never edit tests to pass) or report it." >&2
  exit 2
fi
exit 0
