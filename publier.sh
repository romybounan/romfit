#!/bin/sh
# Usage : ./publier.sh "message"  — incrémente la version, commit et pousse sur GitHub Pages
set -e
cd "$(dirname "$0")"
N=$(( $(sed -n "s/.*\"v\":\"v\([0-9]*\)\".*/\1/p" version.json) + 1 ))
sed -i '' "s/const APP_VERSION = 'v[0-9]*';/const APP_VERSION = 'v$N';/" app.js
sed -i '' "s/const VERSION = 'romfit-v[0-9]*';/const VERSION = 'romfit-v$N';/" sw.js
printf '{"v":"v%s"}\n' "$N" > version.json
git add -A
git -c user.name="Romy" -c user.email="romybounan95@gmail.com" commit -q -m "$1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q
echo "Publié : v$N"
