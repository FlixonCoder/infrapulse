# InfraPulse

A map-based infrastructure cascade viewer for Marathahalli, Bengaluru. React 18, strict TypeScript, Vite, Tailwind CSS, React Leaflet, Zustand, Zod, and Vitest. All app source stays in `frontend/`; no backend or contract changes.

## Run

Use Node 20 or newer (Node 22 LTS recommended).

```sh
cd frontend
npm ci
cp .env.example .env
npm run dev
```

Open the Local URL printed by Vite. Mock mode defaults to enabled, including when `.env` is absent.

```sh
npm test
npm run build
npm run preview
```

## Explore

The first scenario runs on load. Choose one of three presets to run another recorded simulation. Click a map node to inspect it or toggle its trigger; select at most five triggers. Run submits the selected triggers. Slide time without network calls; play advances six hours in approximately 25 seconds at 1×, with 4× and 16× options. Space toggles playback and left/right arrows step five minutes when a control is not focused. Action cards focus the asset and open its popup. Filter by department; expand and copy the briefing, or download it as text.

On narrow screens, open **Action board** for the response panel. The map remains interactive and all playback controls remain available.

## Recorded demo data

The mock client delays each response by 300 ms and validates it with the same Zod schemas used for the live API. Fixtures contain 14 assets, 20 directed dependencies, and redundant power groups. Presets cover a single substation outage, a pump outage, and two simultaneous substation outages. The default simulation has 11 affected assets and eight actions across five departments.

Mock mode supports precisely the recorded trigger sets and a 360-minute horizon. Other selections show an explanatory error instead of inventing a cascade or returning an unrelated result. Arbitrary triggers require the backend. No runtime cascade solver exists in this frontend.

Summary figures cover the full simulation window. Marker status and action deadlines use the current slider time. Nodes with `fails_at: null` stay at risk once input is lost; unaffected nodes remain operational.

## Live backend

Set and restart Vite (or rebuild for production):

```dotenv
VITE_API_BASE=http://localhost:8000
VITE_USE_MOCK=false
```

The API must allow the frontend origin via CORS. Requests use `/api/graph`, `/api/scenarios`, and `/api/simulate`, with snake_case JSON matching v1. Errors, timeouts, and malformed responses show a toast with **Use demo data** recovery. Development validation errors log field paths. A deployed HTTPS site needs an HTTPS API base accessible to its visitors.

## Basemap setup

The brief's CARTO tile service now requires a key. Set `VITE_CARTO_API_KEY` to use the requested CARTO dark tiles. Obtain a key from https://carto.com/basemaps/apikey/ under CARTO's terms. This frontend setting is browser-visible, so use a basemap key configured for the intended domains, never a secret backend credential.

Without a key the app uses the OpenStreetMap standard basemap with a dark CSS treatment and visible fallback label. CARTO/OpenStreetMap attribution is kept visible for the active provider. This is the only provider deviation from the brief, necessary to avoid CARTO's missing-key watermarks. Both providers require network access; no offline tile cache is included.

## Validation and scope

`npm test` covers every specified status boundary, active edge behavior, schema/reference integrity of all fixtures, priority ordering, summary counts, and rejection of unsupported mock triggers. `npm run build` performs strict TypeScript checking and creates `dist/`.

Backend integration (M6) awaits a running backend. Real infrastructure locations, failure propagation, and response advice are illustrative assumptions, not operational data. No mitigation API, localStorage, router, or UI kit is used.


## Operations-room UI upgrade

The frontend now includes the canvas cascade, narrative timeline, live response panels, local dispatch checklist, presenter mode, self-hosted fonts and responsive styles. See `../INTEGRATION_PLAN.md` for the current startup instructions, integration checks and known limits. Run `npm run test:live` with the backend on port 8000. Run `npm run format:check` for editable frontend sources; frozen transport/schema files are intentionally excluded.
