#!/bin/bash
# Double-click to set a new password for a Solace account (close Solace first).
cd "$(dirname "$0")/app" || exit 1
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.volta/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
if ! command -v node >/dev/null 2>&1; then
  echo "  Node.js isn't installed. Follow step 1 of the README first."
  read -r -p "  Press Enter to close this window."
  exit 1
fi
node scripts/reset-password.mjs
read -r -p "  Press Enter to close this window."
