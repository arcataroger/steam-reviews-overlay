#!/bin/zsh
# Weekly label audit, run by the LaunchAgent that scripts/install-weekly-audit.sh installs.
# Builds both targets, runs npm run audit:home in Chromium and Firefox, appends everything to the log,
# and posts a macOS notification when either audit finds an unlabelled card or the run breaks.
set -u
cd "${0:A:h}/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
log=~/Library/Logs/steam-reviews-overlay-audit.log
# Firefox builds outside dist/: a running `npm run dev:firefox` would reload its add-on on any rebuild
ffdist=$(mktemp -d)
trap 'rm -rf "$ffdist"' EXIT

notify() { osascript -e "display notification \"$1\" with title \"Steam Reviews Overlay audit\"" }

{
  echo "=== $(date)"
  git log -1 --oneline
  failed=()
  if ! npm run --silent build:chrome >/dev/null; then failed+=(chrome-build); fi
  if ! TARGET_BROWSER=firefox npx vite build --outDir "$ffdist" --emptyOutDir >/dev/null; then failed+=(firefox-build); fi
  for b in chromium firefox; do
    SRO_FIREFOX_DIST="$ffdist" node scripts/audit-home.mjs --browser $b || failed+=($b)
  done
  if (( ${#failed} )); then
    echo "FAILED: ${failed[*]}"
    notify "Unlabelled cards or a broken run (${failed[*]}). See ~/Library/Logs/steam-reviews-overlay-audit.log"
  else
    echo "OK"
  fi
} >>"$log" 2>&1
