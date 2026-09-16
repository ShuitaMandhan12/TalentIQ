# Resume Intelligence Platform

An AI-assisted recruitment intelligence platform that converts resumes into evidence-backed candidate evaluations while keeping recruiters in control of hiring decisions.

## Status

```text
Phase 0 — Foundation
```

The repository currently contains the project skeleton, design foundation, a single root page, and a backend health endpoint. No product features are implemented yet.

## Architecture

```text
frontend   Next.js frontend (App Router, TypeScript, Tailwind CSS)
backend    FastAPI backend
```

The two applications are independent and are run separately. They do not communicate yet.

## Requirements

- Node.js 20+ and npm
- Python 3.12+

## Local setup

Frontend (terminal 1):

```sh
cd frontend
npm install
npm run dev
```

Serves the app at http://localhost:3000.

Backend (terminal 2):

```sh
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS / Linux
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Serves the API at http://localhost:8000. Verify with `GET /health` → `{"status": "ok"}`.

## Verification

Frontend lint and production build:

```sh
cd frontend
npm run lint
npm run build
```

Backend tests:

```sh
cd backend
pytest
```

## Environment variables

None are required in Phase 0. See `.env.example`.
