# InfraPulse - UI Upgrade Prompt (make it outstanding)

**How to use:** attach `InfraPulse-frontend.zip` to your coding assistant (or paste `src/index.css`, `App.tsx`, `state/store.ts`, `logic/*.ts`, `api/types.ts` and every file in `src/components`). Then paste everything between PROMPT START and PROMPT END. Let it deliver one phase per reply and answer `continue` after you have run each phase.

---

## PROMPT START

### 1. Role and mission

You are a principal product designer-engineer. Take the attached, working InfraPulse frontend (React 18, Vite, TypeScript strict, Tailwind 3, react-leaflet, zustand, zod, vitest) and turn its functional but basic UI into a jaw-dropping, projector-proof, hackathon-winning experience. The features already work. Your job is craft, motion, storytelling and performance. The app will be demoed live to judges in about 60 seconds, so the first 10 seconds and every paused frame must look striking.

### 2. What InfraPulse is

A map-based cascade simulator for city infrastructure (substations, water pumps, cell towers, traffic signal clusters, hospitals). The user picks a failing node, drags or plays a timeline, and sees what fails next and when, while an Action Board tells each department what to fix and by when. The story we must make unforgettable: one failure, a chain reaction, a window of time to act before it spreads.

### 3. Non-negotiables

- The backend contract v1 is frozen. Do not change `api/types.ts`, `api/schemas.ts`, request or response shapes, or `client.ts` behaviour (mock mode, validation, timeouts, Use demo data recovery).
- Do NOT add a cascade solver. Every number on screen must derive from `graph` + `SimulationResult` + the slider time T. Allowed derivations: counts at time T via `getStatus`; edge buffer progress = clamp((T - fails\_at of source) / buffer\_minutes, 0, 1); a breadth-first search over the static graph for dependency tracing; event text built from `result.nodes` and `caused_by`.
- `getStatus` and `isEdgeActive` keep their exact semantics. Existing tests stay green. Add Vitest tests for every new pure function.
- Keep existing store state and action names working. Add UI-only state freely.
- Mock mode stays as is: only the recorded trigger sets work and unsupported selections show the explanatory error.
- No UI kit, no chart library, no map-engine swap, no router, no localStorage. Allowed new dependencies, exact-pinned like the current package.json: `framer-motion` (or `motion`) compatible with React 18.3, self-hosted fonts via `@fontsource-variable/*` or `@fontsource/*`, and `prettier` (dev). Everything else is hand-built with SVG, canvas and CSS.
- Keep the footer disclaimer text, the `VITE_CARTO_API_KEY` behaviour and the basemap attribution.
- The Dispatch checklist (section 6C) is local-only and must be labelled so. It must never imply the simulation changed.
- Accessibility: WCAG AA contrast, never colour alone (keep icons and text labels), visible focus, `prefers-reduced-motion` reduces motion but still shows state changes.

### 4. Audit: what holds the current UI back (fix all of it)

1. **Type is too small.** Many sizes are 6-9 px (for example `.severity` 6px, timeline labels 7-8px, footer 6-7px). Unreadable on a projector. New floor: 12 px for body and labels, 11 px only for uppercase micro-labels with letter-spacing, and large tabular numerals for telemetry.
2. **The cascade, the whole point, is barely visible.** Edges are straight 1 px lines at about 23% opacity; active edges differ only slightly.
3. **Markers are small look-alike rounded squares.** No countdown, no sense of propagation, and status changes snap instantly.
4. **The timeline is a bare slider** with 5 px ticks. No chart, no narrative, no labels for what failed.
5. **The summary shows only full-window totals.** Nothing reacts as the slider moves.
6. **Layout is absolute-positioned magic numbers** (`right:397px`, `bottom:153px`, hard-coded fitBounds padding). The headline, intro copy, triggers and legend stack over the map and feel cluttered on a laptop.
7. **`index.css` is one minified line and components are one-liners.** Unmaintainable for two developers.
8. **Performance bug:** `NodeMarker` and `EdgeLayer` call `useStore()` with no selector, so every 50 ms time tick re-renders every marker and edge. This must be fixed before adding heavier visuals.
9. **Basemap and fonts:** the OSM fallback with a CSS invert filter looks muddy, and fonts load from Google at runtime, which is a demo-day risk on bad Wi-Fi.
10. **No story.** The app never tells the viewer what is happening or where to look.

### 5. Design direction: Operations room at night

Calm, precise, cinematic. Think mission control that a city operator would trust, not a generic dark dashboard.

- **Surfaces:** near-black navy base (`#060B10` to `#0B131B`) with a faint dot grid and subtle film grain on the map; glass panels (`rgba(14,22,30,.72)`, `backdrop-filter: blur(18px)`) with a 1 px gradient border and a soft inner highlight; small HUD corner marks on the main panels.
- **Colour:** keep brand teal `#61E1BB` as the single UI accent. Status colours stay `ok #22c55e`, `at_risk #f59e0b`, `down #ef4444`, used with restrained glow only where something is alive or critical. Keep department colours (electricity `#facc15`, water `#38bdf8`, telecom `#a78bfa`, traffic `#fb923c`, health `#f472b6`) and add relation colours for edges (powers = electricity colour, supplies\_water = water colour, telecom\_link = telecom colour, road\_access = traffic colour).
- **Type:** Manrope for headings, DM Sans for UI text, JetBrains Mono (tabular numerals) for all telemetry, clocks and counters. Self-host all three. Scale: 11 / 12 / 13 / 14 / 16 / 20 / 28 / 44.
- **Tokens:** define everything as CSS variables in `tokens.css` (colour, 4 px spacing scale, radii 8/12/16, shadows, blur, z-index layers, motion). Motion: ease `cubic-bezier(.16,1,.3,1)`, durations 120 / 200 / 360 / 600 ms. No magic numbers elsewhere.
- **Quality bar:** the app must be screenshot-worthy at any moment, including the idle state before a run and a paused frame mid-cascade.

### 6. Features to build

**A. Map cascade FX (the hero)** Build a custom canvas overlay layer inside the Leaflet map (a pane above tiles and below markers, hi-DPI aware, resize-safe, redrawn on pan/zoom, driven by `requestAnimationFrame` only while something animates).

1. **Curved dependency arcs** (quadratic bezier, perpendicular offset about 18% of length, sign alternated by edge id so parallel edges do not overlap) coloured by relation.
2. **Buffer consumption:** for an edge whose source is down, fill the arc from source to target with an amber-to-red gradient according to the buffer progress formula in section 3. At progress 1 the arc is solid red with bright energy pulses flowing source to target. Buffer 0 means instantly red.
3. **Idle life:** before any failure, dependencies breathe: slow, low-alpha pulses along arcs so the network feels alive.
4. **Shockwave ripples:** when a node transitions to down during playback (T crosses its `fails_at` forward), emit an expanding fading ring (700-1100 ms wall clock). Cap at 8 concurrent, skip when the scrub jump is larger than 30 simulated minutes, skip under reduced motion. Trigger nodes emit a larger first ripple on Run.
5. **Node markers v2:** distinct hexagon/circle silhouettes per type, glass fill, size by criticality. At-risk nodes show a circular countdown ring (`stroke-dashoffset`) of (T - lost\_input\_at) / (fails\_at - lost\_input\_at); when `fails_at` is null show a calm amber ring labelled backup holds. Down nodes desaturate with a one-time flicker on transition. Triggers get a beacon. Update ring progress imperatively through a CSS custom property or direct DOM write, not by recreating the Leaflet icon each frame.
6. **Lights-out mood:** a map overlay darkens smoothly as the share of nodes down grows (max about 45% darkening), with a soft red glow under each down node sized by criticality.
7. **Dependency trace:** hovering or focusing a node highlights its upstream and downstream chain (BFS over graph edges) and dims everything else to about 25%. The popup states Depends on N and Affects M.
8. **Camera:** on Run, fly to the trigger and then ease back to the fitted view. Add a Follow cascade toggle that pans smoothly to the latest failing node during playback only when it leaves the central 60% of the visible map.
9. **Basemap:** improve the dark treatment of the OSM fallback (tile filter chain plus overlay gradient and dot grid) so it looks intentional. Keep the CARTO-with-key path unchanged.

**B. Timeline v2 (the narrative)** A bottom dock about 160 px tall on desktop with three zones.

1. **Transport (left):** play/pause, step back and forward 5 minutes, speed segmented control 1x / 4x / 16x, restart.
2. **Chart (centre):** hand-built SVG. A stepped area chart over time showing nodes down (red) and at risk (amber) computed per event time with `getStatus`. A shaded Critical window band from the first hospital impact. Below it, event markers (department-coloured dots with type icon) with hover tooltips such as `T+25m Bridge signals go dark`. A glowing playhead; click and drag anywhere on the chart to scrub; hovering shows a preview tooltip with the counts at that time. Time axis labels at least 11 px.
3. **Clock (right):** a large mono readout like `T+02:15` with the smaller `of 06:00` below.
4. **Live event feed:** a compact feed (map bottom-left or a tab in the response centre) that appends lines as T advances, newest highlighted and animated in, for example `T+0 Marathahalli substation tripped` or `T+10 Bridge signals lost power, backup 10 min`. Build with a pure `buildEvents(result, graph)`; visible events are those with time <= T. Use `aria-live='polite'` and throttle announcements.

**C. Response centre v2**

1. **Live counters:** Down and At risk now (at slider T) with animated count tweening, next to Peak (full window). Label both clearly.
2. **Department impact:** five stacked bars (down / at risk / ok) for the nodes of each department at T, animated.
3. **Hospital watch:** a card per hospital with status at T and a countdown ring or `Safe through window` state. Hospitals are the emotional core of the story.
4. **Action lanes:** group action cards into Act now (time left <= 0), Next 30 min, and Later. Cards animate between lanes with a layout animation as T moves. Each card keeps severity, department, detail, deadline progress bar and Locate asset.
5. **Dispatch checklist:** a checkbox on each card, stored in UI-only state, plus a Response readiness ring (dispatched / total actions) with the tooltip `Local checklist, does not change the simulation`.
6. **Briefing:** keep copy and download; style as a typewriter-reveal block on first open.

**D. Story layer (the pitch weapon)**

1. **Cinematic intro:** a full-screen splash on first load that plays a 4-second animated cascade over the dim map and the line `When the power goes off, what else stops?`, then `InfraPulse shows the chain before it breaks.` and a Start button. Skippable with a click or Esc. The first scenario loads in the background behind it. After Start, fly to the trigger and begin playback at 1x.
2. **Auto-demo (Presenter mode):** a top-bar button (shortcut `P`). It hides secondary chrome, enlarges type, and runs a scripted tour of about 60-75 seconds with large film-style captions at the bottom: (1) fly to the trigger, caption names it from data; (2) play to the first non-trigger failure and caption it; (3) pause at the first hospital impact with a callout on that hospital, or at the deepest chain if none; (4) play to the end; (5) open the response centre and highlight the top action; (6) closing caption with the one-line pitch. All captions are generated from data, never hard-coded numbers. Esc exits. Implement as a small pure state machine in `tour.ts` with tests for step generation.
3. **Shortcuts overlay** opened with `?`: Space play/pause, arrows step, P presenter, F follow cascade, Esc exit, ? help.

**E. Layers and controls** A compact Layers panel on the left rail with toggles: Arcs, Flow particles, Ripples, Lights-out, Follow cascade, Labels. Triggers and legend move into the same rail as collapsible sections. The big headline and intro copy live only in the intro splash; after that the rail shows a slim brand-aligned header.

**F. Layout and responsiveness**

- Replace magic-number positioning with a CSS grid shell: top bar (about 56 px), a workspace row, and the timeline dock. Floating glass panels sit in a `pointer-events: none` overlay container whose children use `pointer-events: auto`.
- The map fits bounds using padding measured from the real panel rectangles with a ResizeObserver, not hard-coded pixels.
- 1366x768 and 1920x1080: full layout. 768-1279: left rail collapses to icons, response centre becomes a right drawer. Below 768: the response centre becomes a draggable bottom sheet (peek / half / full), the timeline condenses to transport plus slider with event ticks, and the chart is hidden.
- Top bar: logo, scenario picker as a popover of scenario cards (name plus description from the data), Run, Auto-demo, MOCK/LIVE badge, help.

### 7. Architecture and performance rules

- Create `state/selectors.ts` with memoised derived data: `statusMap` for T, counts, department impact, hospital watch, events, timeline series, dependency trace. Pure functions live in `logic/` with tests: `timeline.ts`, `events.ts`, `trace.ts`, `edgeProgress.ts`, `counts.ts`, `tour.ts`.
- Use zustand selectors (and `useShallow` where needed). No component calls `useStore()` without a selector.
- Time updates drive two consumers differently: React panels re-render at about 10 fps (throttled), while the canvas layer and marker rings read `useStore.getState()` inside their own animation frame (transient updates).
- Target 60 fps during playback on an integrated-GPU laptop with the 14-node demo data. No layout thrash, no per-frame allocations in the canvas hot path, cancel `requestAnimationFrame` when idle or when the tab is hidden.
- Reformat everything with Prettier (add `.prettierrc`). Split styles into `styles/tokens.css`, `base.css`, `layout.css` and per-component CSS (or the Tailwind component layer). Components and functions are readable multi-line TypeScript with no `any`.
- Self-host fonts and remove the Google Fonts `@import`.

### 8. Phases (one per reply)

1. **Foundation:** tokens, self-hosted fonts, Prettier reformat, CSS split, grid layout shell, selector refactor, performance fix, readable type scale.
2. **Map FX:** canvas overlay, arcs with buffer consumption, particles, ripples, markers v2, lights-out, dependency trace, camera and follow, layers toggles.
3. **Timeline v2:** chart, event markers, scrubbing, critical window, clock, event feed.
4. **Response centre v2:** live counters, department bars, hospital watch, action lanes, dispatch checklist, briefing.
5. **Story layer:** intro splash, Auto-demo with captions, shortcuts overlay.
6. **Responsive, accessibility and polish:** breakpoints and bottom sheet, focus order, aria, reduced motion, micro-interactions, empty and error states, README update.

Before Phase 1, print a plan of at most 15 lines (files to create or change, risks). Then proceed.

### 9. Acceptance criteria

- `npm ci`, `npm run build`, `npm test` pass after every phase; `VITE_USE_MOCK=true` works with no backend; live mode still works unchanged.
- No font below 11 px anywhere and no body or label text below 12 px; AA contrast verified on key text.
- Scrubbing and playback feel instant and smooth; no console errors; no leaks (listeners, observers and animation frames are cleaned up).
- The cascade is legible from across a room: a viewer can see which edge is carrying failure, how much backup is left, and which hospital is next, without reading small text.
- Auto-demo runs end to end in about 60-75 seconds and ends cleanly; Esc always exits.
- Visual checks pass at 1366x768, 1920x1080, 1024x768 and 390x844, in idle, mid-cascade paused, and end-of-window states.
- Every on-screen number is derivable from the API result and graph; nothing is faked or hard-coded.

### 10. Output format

- One phase per reply. For each phase list the files created or changed, then give the **full content** of each changed or new file (no ellipses, no `rest unchanged`).
- Show new dependencies with exact pinned versions and the install command, and remind me to commit the updated lockfile.
- End every reply with: the exact commands to run, a 5-line visual checklist of what I should see, and the question `Ready for the next phase?`.
- If you cannot run the code, say so and self-review it against the acceptance criteria before replying.

## PROMPT END
