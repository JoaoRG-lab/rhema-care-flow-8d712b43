#!/usr/bin/env bash
set -euo pipefail

echo "== Rhema robust check =="
node_major="$(node --version | sed 's/^v//' | cut -d. -f1)"
echo "node: $(node --version)"
echo "npm: $(npm --version)"
if [ "${node_major}" -lt 20 ]; then
  echo "warning: Node 20+ is recommended; several locked dependencies declare Node 20 engines."
fi
echo

echo "== TypeScript =="
npx tsc --noEmit
echo

echo "== Lint =="
npm run lint
echo

echo "== Tests =="
npm test
echo

echo "== Edge Functions =="
npm run edge:check
echo

echo "== Quality Gate =="
npm run quality:gate
echo

echo "== Build =="
npm run build
echo

echo "Rhema robust check passed."
