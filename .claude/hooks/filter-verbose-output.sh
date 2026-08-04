#!/bin/bash
# Filters verbose command output before it enters Claude's context.
# Saves tokens on noisy commands (test runs, builds) by keeping only
# the lines that actually matter.

input=$(cat)
cmd=$(echo "$input" | jq -r '.tool_input.command')

# Test runners: show only failures, not full pass/fail logs
if [[ "$cmd" =~ ^(npm test|yarn test|pytest|go test|mvn test) ]]; then
  filtered_cmd="$cmd 2>&1 | grep -A 5 -E '(FAIL|ERROR|error:)' | head -150"
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"allow\",\"updatedInput\":{\"command\":\"$filtered_cmd\"}}}"
  exit 0
fi

# Build tools: drop progress/info noise, keep warnings and errors
if [[ "$cmd" =~ ^(npm run build|mvn package|gradle build|make) ]]; then
  filtered_cmd="$cmd 2>&1 | grep -viE '^(info|downloading|resolving)' | head -150"
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"allow\",\"updatedInput\":{\"command\":\"$filtered_cmd\"}}}"
  exit 0
fi

# Everything else: pass through unchanged
echo "{}"
