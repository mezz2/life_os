#!/usr/bin/env bash
#
# Sets up LifeOS as an always-on local background service (macOS LaunchAgent).
# After running this once, http://localhost:3000 stays available with no terminal
# open, and comes back automatically after a reboot.
#
# Usage:  cd into the project, then run:  bash setup-service.sh
#
set -e

LABEL="com.lifeos.app"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$(command -v node)"
NODE_DIR="$(dirname "$NODE_BIN")"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

if [ -z "$NODE_BIN" ]; then
  echo "Error: node not found on PATH. Install Node.js first." >&2
  exit 1
fi

echo "Project: $PROJECT_DIR"
echo "Node:    $NODE_BIN"
echo

echo "==> Building the production bundle (this can take a minute)…"
( cd "$PROJECT_DIR" && npm run build )

mkdir -p "$HOME/Library/Logs/LifeOS"
mkdir -p "$HOME/Library/LaunchAgents"

echo "==> Writing the service definition…"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>$NODE_BIN</string>
        <string>$PROJECT_DIR/node_modules/next/dist/bin/next</string>
        <string>start</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$PROJECT_DIR</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>$NODE_DIR:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>PORT</key>
        <string>3000</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$HOME/Library/Logs/LifeOS/app.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME/Library/Logs/LifeOS/app.error.log</string>
</dict>
</plist>
EOF

echo "==> Starting the service…"
# Stop any previous copy, then start — works on both old and new macOS launchctl.
launchctl unload "$PLIST" 2>/dev/null || true
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl load "$PLIST" 2>/dev/null || launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo
echo "Done. Give it a few seconds, then open http://localhost:3000"
echo "Check status:  launchctl list | grep lifeos"
echo "Error log:     ~/Library/Logs/LifeOS/app.error.log"
