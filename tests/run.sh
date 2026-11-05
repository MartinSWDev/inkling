#!/bin/sh
# Run every test suite in the repo. Exits non-zero on any failure.
set -e
cd "$(dirname "$0")/.."

npm --prefix web test

# Python tests only if any exist (scripts/test_*.py or a pytest config).
if ls scripts/test_*.py >/dev/null 2>&1 || [ -f pytest.ini ] || [ -f pyproject.toml ] || [ -f setup.cfg ]; then
  python -m pytest scripts -q
fi
