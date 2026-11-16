# InfraPulse — integration plan and handoff

Updated 16 November 2026. Frontend changes are implemented in the original `techforge/frontend` folder. Backend application code and the frozen v1 transport/schemas are unchanged.

## Run the app

From the project root, use Python 3.11 or later (the system default here is Python 3.9, so select a newer interpreter explicitly).

Terminal 1:
```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Terminal 2:
```bash
cd frontend
npm ci
VITE_USE_MOCK=false VITE_API_BASE=http://127.0.0.1:8000 npm run dev -- --port 5173
```

Open http://localhost:5173. The badge must read LIVE. Both services are already running for the current session. Their processes are temporary; the commands above reproduce them later. For the recorded fallback, restart frontend with `VITE_USE_MOCK=true npm run dev -- --port 5173`.

## What connects to what

React components → zustand store → existing `src/api/client.ts` → FastAPI `/api` → engine, actions and briefing. The client validates JSON using the unchanged Zod schemas. The frontend does not solve cascades. Scrubbing is local and derives statuses from `lost_input_at`, `fails_at` and the slider time. All time units are minutes; map positions are latitude then longitude.

| Endpoint | UI consumer | Verification |
| --- | --- | --- |
| GET /api/health | operational smoke check | backend tests |
| GET /api/graph | map, dependencies, department and hospital panels | Zod + exported fixture test |
| GET /api/scenarios | preset picker | Zod + live HTTP test |
| POST /api/simulate | timeline, events, response board, briefing and tour | all three live presets + custom trigger + unknown-trigger test |

## Dataset boundary — keep these together

The recorded mock demo has 14 assets, 20 dependencies, trigger IDs `sub1`, `pump1`, and `sub1,sub2`, and a fixed 360-minute horizon. Only these recorded combinations are supported in mock mode; unsupported selections retain the explanatory error and recovery button.

The backend has 33 assets and its own readable IDs. S1 trips `sub_66_marathahalli` for 360 minutes; S2 trips `sub_220_whitefield` for 480 minutes; S3 trips Marathahalli and Bellandur for 360 minutes. LIVE mode loads both its graph and presets from the backend. Do not copy backend fixtures over the recorded mocks without also changing the mock lookup and tests in a separately reviewed change.

Real backend exports now live in `contract/fixtures/`. They are tested separately against the frontend schemas by `src/api/backendFixtures.test.ts`. The API contract is compatible; no v1 field changes were needed.

## Integration sequence

1. Start backend on 8000 and frontend on 5173 using the commands above. Backend CORS already permits localhost and 127.0.0.1 on frontend port 5173. A different frontend port requires an explicit CORS update.
2. Run `npm run test:live` inside frontend. This uses the real HTTP client, runs all backend presets, tests a custom tower trigger and checks unknown-ID handling. Backend must be running. The regular test suite skips this network-dependent test.
3. In the browser select S1, scrub through the first downstream failure, then hospital impact. Check that the trigger is down at T+0, buffers stay amber until their returned failure time, and unaffected nodes remain operational.
4. Repeat S2 and S3. Confirm S2 uses its returned 480-minute horizon rather than assuming six hours. Inspect network activity: moving time must not request another simulation.
5. Check action Locate asset, department filters, dispatch checkbox, briefing copy/download, and Use demo data recovery. Dispatch is explicitly local-only and must never mutate simulation results.
6. Refresh contract exports after backend seed or engine changes:
   `cd backend && python scripts/export_fixtures.py`
   Then run frontend tests and build. Keep graph, scenarios and simulation exports from the same backend version.
7. Before demo, verify the LIVE badge, rehearse the tour and keep mock mode ready. Map tiles still require network access; fonts are now self-hosted.

## Verification completed

- `npm ci`: dependency installation passed, with zero audit vulnerabilities at installation time.
- `npm run build`: production build passed.
- `npm test`: 20 tests passed, one live test intentionally skipped in default mock mode.
- `npm run test:live`: one HTTP integration test passed, covering all three presets, a custom trigger and an invalid trigger.
- Backend `python -m pytest -q`: 16 tests passed.
- Backend fixture exporter completed and all exports validate against frontend v1 schemas.
- Browser checked at desktop, tablet and phone dimensions; scrubbing updated live counts, hospital countdowns and action lanes. Final browser checks are recorded in DELIVERY.md.

## Frontend implementation

- Readable tokens/base/layout/component CSS, grid shell and responsive response drawer/bottom sheet.
- Self-hosted Manrope, DM Sans and JetBrains Mono. Exact pinned font packages 5.2.8 and Prettier 3.6.2; updated lockfile included.
- Canvas dependency curves with relation colors, arrows, source-driven buffer progress, flow particles, failure ripples, lights-out shading and dependency trace.
- Cached static canvas rendering and geometry; particle frames reuse buffers. Marker icons only rebuild on meaningful status changes. Store subscriptions use selectors; panel playback ticks at 10 Hz.
- Timeline stepped area chart, critical hospital window, event ticks, scrubbing, transport and mono clock.
- Live counters alongside end-of-window values, department bars, hospital watch, urgency lanes and a local dispatch readiness ring.
- Intro, generated six-chapter presenter tour (~66 seconds), follow control, layer toggles and shortcuts. Escape exits overlays/tour. Reduced motion suppresses decorative animation.
- Existing mock/live transport, validation, timeouts, fallback recovery, CARTO key behavior, attribution and disclaimer preserved.

## Limits and next work

The native scenario select remains functional; a scenario-card popover is not included. Counts change immediately rather than using numeric tweening; action lanes use CSS entry transitions rather than FLIP layout animation. Hospital watch uses explicit status/countdown text rather than a per-hospital ring. The grid gives the map its own measured ResizeObserver area, so it does not need to guess overlaid panel padding. No dedicated 60-fps profiling or exhaustive WCAG audit has been completed. Backend dependencies remain the original open-ended version ranges; an optional follow-up is to pin versions after team review. Current backend tests emit a dependency deprecation warning but pass. No deployment or backend feature changes were made.
