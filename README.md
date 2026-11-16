# InfraPulse

City infrastructure cascade simulator: React/Vite frontend + FastAPI backend.

See [INTEGRATION_PLAN.md](INTEGRATION_PLAN.md) for the complete startup, verification and integration handoff.

## Fast start

Backend: `cd backend`, create a Python 3.11+ venv, install requirements, then `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`.

Frontend in another terminal: `cd frontend && npm ci`, then `VITE_USE_MOCK=false VITE_API_BASE=http://127.0.0.1:8000 npm run dev -- --port 5173`.

Open http://localhost:5173. Use `VITE_USE_MOCK=true` for the original recorded fallback.

## Checks

Frontend: `npm test`, `npm run build`, and with the backend running `npm run test:live`. Backend: `python -m pytest -q`.

`Space` plays/pauses; arrows step five minutes; `P` starts the presenter tour; `F` toggles follow; `?` opens help; `Esc` exits overlays.

Dependencies and backup durations are assumed for demonstration.
