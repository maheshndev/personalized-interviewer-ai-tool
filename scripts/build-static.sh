#!/usr/bin/env sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

rm -rf dist
mkdir -p dist
cp -R css data js dist/
cp index.html dist/index.html
