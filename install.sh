#!/usr/bin/env bash
# install.sh — Link the `ai` command globally

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "  Installing ai-router..."
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "  ✗ Node.js not found. Install from https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "  ✗ Node.js 18+ required. Current: $(node --version)"
  exit 1
fi

echo "  ✓ Node.js $(node --version)"

# Install deps
cd "$SCRIPT_DIR"
if [ ! -d "node_modules" ]; then
  echo "  Installing dependencies..."
  npm install --silent
fi

# Link globally
echo "  Linking ai command..."
npm link --silent 2>/dev/null || sudo npm link --silent

echo ""
echo "  ✓ Installed! Run: ai --help"
echo ""
echo "  Quick start:"
echo "    1. cd your-project"
echo "    2. ai init"
echo "    3. ai \"your coding task\""
echo ""
echo "  Check system status:"
echo "    ai status"
echo ""