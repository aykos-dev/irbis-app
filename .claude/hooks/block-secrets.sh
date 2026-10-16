#!/usr/bin/env bash
# PreToolUse hook: block reads of env/secret files and junk dirs in any irbis repo.
# Exit 2 = block the tool call; stderr is shown to Claude.
input="$(cat)"
tool="$(jq -r '.tool_name // empty' <<<"$input")"
case "$tool" in
  Read|Edit|Write) target="$(jq -r '.tool_input.file_path // empty' <<<"$input")" ;;
  Grep|Glob)       target="$(jq -r '.tool_input.path // empty' <<<"$input") $(jq -r '.tool_input.glob // .tool_input.pattern // empty' <<<"$input")" ;;
  Bash)            target="$(jq -r '.tool_input.command // empty' <<<"$input")" ;;
  *) exit 0 ;;
esac

# .env, .env.local, .env.production … but allow .env.example
if grep -Eq '(^|[/[:space:]"'"'"'])\.env(\.[A-Za-z0-9_-]+)?([[:space:]"'"'"']|$)' <<<"$target" \
   && ! grep -Eq '\.env\.example' <<<"$target"; then
  echo "Blocked: .env files hold secrets and must not enter context. Use .env.example for variable names." >&2
  exit 2
fi
if grep -Eq '\.(pem|key|p12|jks|keystore)([[:space:]"'"'"']|$)|google-services\.json|GoogleService-Info\.plist' <<<"$target"; then
  echo "Blocked: credential/key file. Ask the user to handle it outside the chat." >&2
  exit 2
fi
if [[ "$tool" == "Read" ]] && grep -Eq '/(node_modules|dist|\.next|\.expo|build|coverage)/' <<<"$target"; then
  echo "Blocked: generated/vendor directory. Read source or types instead." >&2
  exit 2
fi
exit 0
