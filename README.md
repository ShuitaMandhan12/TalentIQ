# Resume Intelligence Platform

An AI-assisted recruitment intelligence platform that converts resumes into evidence-backed candidate evaluations while keeping recruiters in control of hiring decisions.

## Status

```text
Phase 2D — Permission authorization layer
```

Foundation, Supabase email/password authentication (sign in, protected `/app`, sign out, password recovery), and the multi-tenant database foundation in `supabase/migrations`: customer organizations with memberships, dynamic organization-defined roles over a system-defined permission catalog (users may hold several roles across several organizations), a separate platform-admin control plane, and per-organization service entitlements. Every table is protected by Row Level Security. After sign-in, `/app` resolves the user's workspaces and each tenant workspace lives at `/app/<organization-slug>`, where the user's effective permissions (union of their roles) are loaded once per request. Tenant authorization is permission-based: roles are dynamic bundles of system-defined permission keys (`frontend/src/lib/auth/permissions.ts`), and application guards complement — never replace — RLS. Platform and tenant administration screens arrive in the following Phase 2 subphases. The backend still exposes only `GET /health`. No recruitment features are implemented yet.

## Architecture

```text
frontend   Next.js frontend (App Router, TypeScript, Tailwind CSS)
backend    FastAPI backend
supabase   Database migrations and local RLS checks
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

## Database

Schema changes live in `supabase/migrations` and are applied to the hosted Supabase project through the dashboard SQL editor or `supabase db push`. `supabase/tests/rls_checks.sql` applies the migration to a throwaway local PostgreSQL and asserts tenant isolation (see its header for the command).

## Environment variables

The frontend reads `frontend/.env.local`; copy `frontend/.env.example` and fill in the Supabase URL and publishable key. `APP_URL` is the server-side base URL (`http://localhost:3000` locally) used for password-recovery links. The backend needs none yet.
