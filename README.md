# inkling

A mobile-first web game that helps 16-18 year olds discover UK degree subjects: four quick rounds fill a halls bedroom with objects, then a tap-through reveal suggests subjects to explore.

## Run locally

Needs Python 3.11+ and Node 20+. Keys live in `.env` (`MODEL_API_KEY`, `BASETEN_API_KEY`) and never reach the browser.

```sh
python -m venv .venv && .venv/bin/pip install -r requirements.txt
cd web && npm install && cd ..
sh scripts/dev.sh
```

Open http://127.0.0.1:5173 in a browser (phone-sized is the design target). The API alone is `uvicorn api.main:app --reload` on port 8000; Vite proxies `/api` to it.

Tests: `.venv/bin/python -m pytest api/tests/ -q`. Room loop check: `.venv/bin/python -m api.room_demo CAH07-01-01 CAH25-02-02`.

## Data attribution

Contains public sector information licensed under the Open Government Licence v3.0. Apprenticeship standards © Skills England.
