#!/usr/bin/env bash
# Clean article reader (Defuddle, MIT). Usage: bash scripts/dev/read_article.sh <url or saved .html file>
# Strips menus, cookie banners, ads and footers and prints clean Markdown, so research uses fewer tokens.
# Not an app dependency: runs through npx with a pinned version, nothing is added to package.json.
set -euo pipefail
[ $# -eq 1 ] || { echo "usage: read_article.sh <url or .html file>"; exit 1; }
exec npx --yes defuddle@0.19.6 parse "$1" --markdown
