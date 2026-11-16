#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
cd server
[ -d node_modules ] || npm ci
node database-snapshot.js backup
