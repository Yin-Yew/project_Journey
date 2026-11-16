#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/../.."
command -v node >/dev/null || { echo 'Node.js 20+ is required'; exit 1; }
[ -f server/.env ] || cp .env.example server/.env
cd server
[ -f node_modules/mysql2/package.json ] && [ -f node_modules/express/package.json ] || npm ci
node setup-db.js
printf '\nSign up at http://localhost:3000/register.html\n'
npm start
