#!/usr/bin/env bash
# Quality gate: the same checks locally and in CI.
#   apps/api      — Maven verify (compile, unit + integration tests)
#   npm packages  — lint, typecheck, test, build for every workspace that has the script
# Prints only what failed. Ends with GATE PASS or GATE FAIL.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$(mktemp -d)"
trap 'rm -rf "$LOG_DIR"' EXIT
FAILED=0

run_step() {
  local name="$1"; shift
  local log="$LOG_DIR/${name//[\/:]/_}.log"
  if "$@" >"$log" 2>&1; then
    echo "ok   $name"
  else
    echo "FAIL $name"
    echo "----- $name (last 60 lines) -----"
    tail -n 60 "$log"
    echo "---------------------------------"
    FAILED=1
  fi
}

# Java API
if [ -f "$ROOT/apps/api/pom.xml" ]; then
  cd "$ROOT/apps/api" || exit 1
  run_step "apps/api:verify" ./mvnw -B -q verify
else
  echo "skip apps/api (no pom.xml yet)"
fi

# npm workspaces
cd "$ROOT" || exit 1
if [ -f package.json ]; then
  [ -d node_modules ] || run_step install npm ci --silent
  for pkg in $(node -e "for (const w of require('./package.json').workspaces || []) console.log(w)" \
               | while read -r pattern; do ls -d $pattern 2>/dev/null; done); do
    [ -f "$pkg/package.json" ] || continue
    for s in lint typecheck test build; do
      if node -e "process.exit(require('./$pkg/package.json').scripts?.['$s'] ? 0 : 1)"; then
        run_step "$pkg:$s" npm run "$s" --silent --workspace "$pkg"
      fi
    done
  done
else
  echo "skip npm packages (no package.json yet)"
fi

if [ "$FAILED" -eq 0 ]; then
  echo "GATE PASS"
else
  echo "GATE FAIL"
  exit 1
fi
