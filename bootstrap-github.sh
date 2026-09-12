#!/usr/bin/env bash
set -euo pipefail

REPO="sironekotoro/lookup-box"

if [[ ! -d .git ]]; then
  git init -b main
fi

git add .
git diff --cached --check
git commit -m "chore: initialize LookupBox"

gh repo create "$REPO" \
  --public \
  --source=. \
  --remote=origin \
  --push

echo
echo "Created: https://github.com/$REPO"
echo "Next: GitHub -> Settings -> Pages -> Source: GitHub Actions"
