#!/bin/zsh
# Installs (or, with --uninstall, removes) a LaunchAgent that runs scripts/weekly-audit.sh every Monday
# at 9:07. launchd runs a missed job when the Mac next wakes.
set -eu
label=com.arcataroger.steam-reviews-overlay.audit
plist=~/Library/LaunchAgents/$label.plist
launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
if [[ ${1:-} == --uninstall ]]; then
  rm -f "$plist"
  echo "Removed $label."
  exit 0
fi
script="${0:A:h}/weekly-audit.sh"
chmod +x "$script"
mkdir -p ~/Library/LaunchAgents
cat >"$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key><array><string>$script</string></array>
  <key>StartCalendarInterval</key><dict><key>Weekday</key><integer>1</integer><key>Hour</key><integer>9</integer><key>Minute</key><integer>7</integer></dict>
</dict>
</plist>
EOF
launchctl bootstrap "gui/$(id -u)" "$plist"
echo "Installed $label: Mondays at 9:07. Log: ~/Library/Logs/steam-reviews-overlay-audit.log"
