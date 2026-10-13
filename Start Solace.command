#!/bin/bash
# Double-click to start Solace on a Mac (on Linux: run `bash "Start Solace.command"`).
# Keep the window open while you use Solace; close it to stop.
cd "$(dirname "$0")/app" || exit 1

# Apps opened from Finder don't always see the folders where Node.js is installed.
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.volta/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  Solace needs Node.js, which isn't installed on this computer yet."
  echo
  echo "  1. The Node.js download page is opening now."
  echo "  2. Download and install the \"LTS\" version (accept the default options)."
  echo "  3. Double-click \"Start Solace\" again."
  echo
  if command -v open >/dev/null 2>&1; then open "https://nodejs.org/en/download"; else xdg-open "https://nodejs.org/en/download" >/dev/null 2>&1; fi
  read -r -p "  Press Enter to close this window."
  exit 1
fi

node scripts/launch.mjs || read -r -p "  Press Enter to close this window."
