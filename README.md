# IntelliSpot

Context-aware venue and activity recommendation platform combining real-time context signals (location, weather, time, preferences) with feedback-driven learning.

## Monorepo Layout

- `frontend/` React Native mobile application (TypeScript)
- `backend/` Node.js + Express API (JavaScript w/ TS config for tooling)
- `ml-module/` Python-based ML / ranking helpers
- `database/` Database init & migrations (MongoDB + Firebase rules)
- `docs/` Architecture, API spec, user flows, roadmap
- `tests/` Cross-layer unit & integration tests

## Getting Started (High Level)

1. Copy `.env.example` to `.env` and fill secrets.
2. Install deps:
   - Frontend: `cd frontend && npm install`
   - Backend: `cd backend && npm install`
   - ML: (optional venv) `cd ml-module && pip install -r requirements.txt`
3. Run backend API: `npm run dev` inside `backend`.
4. Run mobile app (example): `npm start` inside `frontend` then choose platform (Expo or native CLI flow as you adapt).

## Environment Variables
See `.env.example` for required keys (Foursquare, Weather, MongoDB, Firebase, JWT secret, etc.).

## Scripts (Planned)
Will be expanded as implementation proceeds.

| Area | Script | Purpose |
|------|--------|---------|
| backend | `npm run dev` | Nodemon dev server |
| backend | `npm test` | Backend tests |
| frontend | `npm start` | Metro bundler |
| frontend | `npm test` | Frontend tests (Jest) |
| ml-module | `python training/train_example.py` | Example training run |

## Contributing
PRs should include or update tests when behavior changes. Lint & test before pushing.

## License
TBD.
