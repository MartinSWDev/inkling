# Tests

## Where the suites live

- **Web (main suite):** `web/src/*.test.ts`, run with [vitest](https://vitest.dev). These cover the game flow, scoring, chips, aliases, feedback, the live-call helpers and the simulation data (including the live-student stream parser).
- **Python:** helper and smoke scripts live under `scripts/` (for example `scripts/smoke_test.py`). There is currently no pytest suite or pytest config; if `scripts/test_*.py` files or a pytest config are added, `tests/run.sh` will pick them up.

## How to run them

Everything, the same way CI does:

```sh
sh tests/run.sh
```

Or individually:

```sh
npm --prefix web test        # vitest suite
python -m pytest scripts -q  # only if Python tests/config exist
```
