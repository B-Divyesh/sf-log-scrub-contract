#!/usr/bin/env bash
set -euo pipefail
node scripts/verify-url.mjs "${1:-http://127.0.0.1:4173/}"
