#!/bin/bash
# Runs the scripted checks in headless Edge or Chrome.
# Usage: tests/run.sh [width,height]   (default 1280,560)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SIZE="${1:-1280,560}"

BROWSER=""
for candidate in \
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "$(command -v microsoft-edge || true)" \
  "$(command -v google-chrome || true)"; do
  if [ -n "$candidate" ] && [ -x "$candidate" ]; then BROWSER="$candidate"; break; fi
done
[ -n "$BROWSER" ] || { echo "Edge or Chrome not found"; exit 2; }

# A copy of the page that loads the stand-in browser API before the page script, and the checks after it.
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cp -R "$ROOT"/newtab.css "$ROOT"/newtab.js "$ROOT"/mosaic.svg "$ROOT"/mosaic-dark.svg "$ROOT"/icons "$ROOT"/tests/mock.js "$ROOT"/tests/test.js "$WORK/"
sed 's|<script src="newtab.js"></script>|<script src="mock.js"></script><script src="newtab.js"></script><script src="test.js"></script>|' "$ROOT/newtab.html" > "$WORK/index.html"

RESULTS="$("$BROWSER" --headless=new --disable-gpu --user-data-dir="$WORK/profile" --allow-file-access-from-files \
  --virtual-time-budget=20000 --window-size="$SIZE" --dump-dom "file://$WORK/index.html#test" 2>/dev/null \
  | grep -o 'data-results="[^"]*"' | sed 's/^data-results="//; s/"$//' | tr '|' '\n' | sed 's/^ *//; s/ *$//' || true)"

PASSED="$(printf '%s\n' "$RESULTS" | grep -c '^PASS' || true)"
FAILED="$(printf '%s\n' "$RESULTS" | grep -c '^FAIL' || true)"
printf '%s\n' "$RESULTS" | grep '^FAIL' || true
echo "window $SIZE: $PASSED passed, $FAILED failed"
[ "$PASSED" -gt 0 ] && [ "$FAILED" -eq 0 ]
