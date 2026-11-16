# InfraPulse - 3. Integration Plan (Frontend + Backend = MVP)

**For:** both devs | **Goal:** one working MVP where clicking a substation animates a cascade timeline with an Action Board, running from a single repo and a single demo laptop.

The golden rule: **integrate early and often, not at the end.** The backend ships a walking skeleton in the first hour, so the frontend flips from mock data to live data almost immediately and every later change is tested together.

---

## 1. Ownership

| Area | Owner | Notes |
| --- | --- | --- |
| /backend (API, engine, seed data) | Dev B | Also owns scenario tuning |
| /frontend (map, timeline, board) | Dev A | Also owns demo visuals |
| /contract (contract.md, fixtures) | Both | Changes only by agreement, see section 4 |
| Demo script and pitch | Both | Rehearse together in Phase 4 |

## 2. Repo layout and git workflow

```
infrapulse/
  backend/
  frontend/
  contract/
    contract.md          the frozen API contract (copy from the prompt docs)
    fixtures/            real API responses exported by the backend (graph.json, scenarios.json, simulate_*.json)
  README.md              run steps for both services
```

- One monorepo, `main` always runs. Work on branches named `be/<topic>` and `fe/<topic>`, merge small and often (at least after every milestone).
- Never both edit the same folder. The only shared folder is /contract.
- Commit messages start with `be:` or `fe:` or `contract:`.

## 3. Phase 0 - Contract freeze (first 30 minutes, together)

Checklist:

- [ ] Create the repo and the three folders; add contract/contract.md with the TypeScript contract from either prompt doc.
- [ ] Agree on ids: node ids are readable slugs (`sub_66_marathahalli`), edge ids `e001...`.
- [ ] Agree on units: **minutes** everywhere, integers; lat first, lng second.
- [ ] Agree on ports: backend 8000, frontend 5173.
- [ ] Agree that neither side changes the contract alone (section 4).
- [ ] Each dev pastes their prompt into the AI tool and starts.

## 4. Contract change protocol

If either side needs a field or behaviour change:

1. Write the request in /contract/CHANGES.md (what, why, example JSON).
2. Message the other dev and agree.
3. Update contract.md first, then bump to `v1.1`, then both sides update code in the same hour. Additive optional fields are cheap; renaming or removing fields is expensive, so avoid it.

## 5. Phase 1 - Parallel build with sync points

The two tracks run independently. Sync points are the moments you must stop and test together.

| Time block | Dev B (backend) | Dev A (frontend) |
| --- | --- | --- |
| Block 1 | B1 walking skeleton: all 4 endpoints, simulate returns a hand-made valid result | M1 scaffold, types, zod, mocks, status.ts + tests |
| **SYNC 1** | Backend is running locally. Tell Dev A. | Flip `VITE_USE_MOCK=false`, confirm graph loads and zod shows no errors |
| Block 2 | B2 real engine + tests | M2 map with nodes and edges |
| Block 3 | B3 actions, summary, briefing | M3 simulation, slider, status colours |
| **SYNC 2** | Real simulate responses for S1 | Verify cascade renders correctly against real data, not mock |
| Block 4 | B4 full seed + tuning | M4 Action Board, summary strip, scenario picker |
| **SYNC 3** | Run `export_fixtures.py`, commit fixtures | Replace hand-written mocks with /contract/fixtures, run tests |
| Block 5 | B5 and B6 export script, README | M5 polish: play/pause, ticks, briefing, errors |

Sizing: if the hackathon is about 24 hours, give each block roughly 2 to 3 hours and keep the last 4 hours free for Phases 3 and 4. If it is shorter, drop M5 polish items before dropping SYNC points.

## 6. Phase 2 - Full integration steps

**Run both services (two terminals):**

```
# terminal 1
cd backend && python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# terminal 2
cd frontend && cp .env.example .env     # set VITE_USE_MOCK=false
npm install && npm run dev
```

**Backend smoke test (Dev B runs, shares output):**

```
curl http://localhost:8000/api/health
curl http://localhost:8000/api/graph | head -c 600
curl http://localhost:8000/api/scenarios
curl -X POST http://localhost:8000/api/simulate -H 'Content-Type: application/json' -d '{"trigger_node_ids":["sub_66_marathahalli"],"horizon_minutes":360}'
```

**Frontend smoke test (Dev A runs):**

- [ ] Header badge shows LIVE and no zod errors in the console.
- [ ] Pick scenario S1: nodes recolour while dragging the slider; no network call on drag.
- [ ] Trigger node is red at T+0; a node with a buffer turns amber then red at exactly its fails\_at.
- [ ] Action cards sorted by priority; countdowns decrease as the slider moves.
- [ ] Click a node, press Fail this node, press Run: result changes accordingly.
- [ ] Unknown trigger (edit the request in dev tools) shows the error toast, not a crash.

**Contract check (do once per SYNC):** open /docs on the backend (Swagger UI), compare each response with the fixtures the frontend uses. Any zod mismatch is a contract bug: fix the code, not the contract, unless both agree.

## 7. Phase 3 - Tune the story (together, about 1-2 hours)

The tech works; now make it convincing.

- Pick the three demo scenarios (S1, S2, S3) and run each in the UI.
- For each, read the timeline aloud: does the order of failures make intuitive sense? Fix buffers in `city.json`, not the engine.
- Target for S1: failures at T+0 (signals), T+25 (first hospital access cut), T+120 to 240 (towers), at least 3 departments with `ACT NOW` or due within 30 minutes.
- Make sure the biggest scenario (S2) tells a bigger story with a visible depth of at least 3 levels.
- Re-export fixtures after any seed change and commit.

## 8. Phase 4 - Polish and demo prep

- Rehearse the 60-second pitch with the live app on the demo laptop. Dev A drives the map; Dev B talks (or swap).
- Prepare a **fallback**: a screen recording of a perfect run, and `VITE_USE_MOCK=true` ready as a one-line switch if the backend misbehaves.
- The map needs internet for tiles. Bring a mobile hotspot, or take a backup screenshot of the map area.
- Close everything else on the demo laptop; run both services from a fresh terminal 10 minutes before presenting.
- Pre-run the first scenario so the page is warm.

**Demo flow (60-90 seconds):**

1. Show the map at rest: green city, explain the node types.
2. Select S1, press Run: trigger node turns red.
3. Drag the slider slowly: signals go dark, ambulance route cut, towers turn amber then red.
4. Point at the Action Board: each department gets its card with a countdown.
5. Show the Briefing text. Close with the one-line pitch.

## 9. Common integration bugs (check these first)

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Browser blocks requests | CORS origin mismatch | Backend CORS must include http://localhost:5173 and http://127.0.0.1:5173 |
| Markers appear in the ocean | lat/lng swapped | Contract is lat first; Leaflet takes \[lat, lng\] |
| Everything is 60x too late or early | seconds vs minutes | Contract is minutes everywhere |
| Node stays amber forever | fails\_at is null (survives horizon) | Expected; UI must show 'running on backup' |
| Zod error on `caused_by` | Backend sends `{}` instead of null for triggers | Return null |
| Nodes missing from simulate result | They were unaffected (not listed) | Treat missing as ok |
| Slider and Action countdown disagree | Frontend uses wall-clock instead of T | Countdown = act\_by\_minute - slider T |
| Different results on repeat runs | Non-deterministic sorting | Stable tie-break by node id in backend |
| Fetch fails only on the demo laptop | Backend on another port or firewall | Use 127.0.0.1 and check VITE\_API\_BASE |

## 10. Definition of done (MVP)

- [ ] Both services start from a clean clone using the README steps.
- [ ] Three scenarios run end to end with plausible, explainable timelines.
- [ ] Slider, play/pause, popups, Action Board, Summary and Briefing all work in LIVE mode.
- [ ] Backend `pytest` and frontend `npm test` and `npm run build` pass.
- [ ] Fixtures in /contract/fixtures match the current backend output.
- [ ] Demo rehearsed twice, fallback mock mode verified.

## 11. Risks and fallbacks

- **Backend not ready for SYNC 1:** frontend keeps using mocks; nothing blocks, but do not skip the sync.
- **Contract disagreement mid-build:** freeze new asks until the next SYNC and handle them in one batch.
- **Seed data looks unrealistic:** disclose honestly that dependencies are assumed; judges value a clear model over fake precision.
- **Running out of time:** cut in this order: stretch items, play speed options, tick marks, briefing copy button, extra scenarios. Never cut the slider, Action Board, or the live demo path.
- **One dev blocked:** the other pairs on the blocker (for example tuning buffers or fixing zod mismatches) instead of starting new features.

## 12. After the MVP (if time remains)

- Mitigation what-if (backend v1.1 `mitigations`, then a toggle on each action card).
- LLM-written briefing with template fallback.
- Seed generated from real OpenStreetMap data for hospitals, substations and signals.
