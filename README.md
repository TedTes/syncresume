# SyncResume

SyncResume is a resume optimization workspace. Users keep a resume library, add a target job description, run an LLM optimization, review structured sections, and export polished files.

The public marketing site is built with Astro and served from `https://syncresume.io`.
The authenticated React app is built with Vite and served from `https://syncresume.io/app`.

## Implementation checkpoints

1. App shell and tooling.
2. Resume data model and scoring utilities.
3. Clerk auth and Cloudflare server-side provider credentials.
4. Job description and resume inputs with PDF/DOCX extraction.
5. LLM optimization with structured JSON output.
6. Review, inline editing, targeted section revision, and keyword scoring.
7. DOCX, PDF, and plain-text export.
8. Production polish and GitHub publish.

## Development

```bash
npm install
npm run cf:d1:apply:local
npm run cf:dev
npm run dev
npm run build
```

Use `npm run dev:marketing` to work on the static marketing pages.

Create `.env.local` from `.env.example` before running the frontend:

```bash
VITE_CLOUDFLARE_API_URL=http://localhost:8787
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
```

## Cloudflare Environment

The backend lives in `cloudflare/` and is configured by `wrangler.toml`. The
frontend is deployed to Cloudflare Pages from `dist/`. Production builds contain
Astro marketing pages at the root and the React app under `/app`.

Local development uses the frontend dev server plus a local Worker:

- Frontend: `http://localhost:5173`
- API Worker: `http://localhost:8787`

Production uses Cloudflare-hosted domains:

- Marketing: `https://syncresume.io`
- App: `https://syncresume.io/app`
- API Worker: `https://api.syncresume.io`

```bash
npm run cf:typecheck
npm run cf:d1:apply:local
npm run cf:dev
npm run cf:deploy
npm run cf:pages:deploy
```

## Automated Worker Deploys

Worker deploys run through GitHub Actions on pushes to `main` when backend-related
files change. The workflow applies remote D1 migrations, then deploys the Worker.

Add these GitHub repository secrets before relying on the workflow:

```bash
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

Create the Cloudflare API token with the minimum permissions needed to edit the
Worker and apply D1 migrations for this account.

Required Cloudflare resources:

- D1 database binding: `DB`
- R2 bucket binding: `RESUME_BUCKET`

Required Worker secrets:

```bash
wrangler secret put OPENAI_API_KEY
```

Required Worker variables:

```bash
APP_ORIGIN=https://syncresume.io
CLERK_JWKS_URL=https://<your-clerk-frontend-api>/.well-known/jwks.json
CLERK_ISSUER=https://<your-clerk-issuer>
CLERK_AUTHORIZED_PARTIES=https://syncresume.io
```

For local development, keep these values in `.dev.vars` instead:

```bash
APP_ORIGIN=http://localhost:5173
CLERK_AUTHORIZED_PARTIES=http://localhost:5173
```

For production, set the Pages build variables:

```bash
VITE_CLOUDFLARE_API_URL=https://api.syncresume.io
VITE_CLERK_PUBLISHABLE_KEY=pk_live_your_clerk_publishable_key
```

If billing redirect vars are set explicitly, use the app path:

```bash
BILLING_SUCCESS_URL=https://syncresume.io/app/settings?billing=success
BILLING_CANCEL_URL=https://syncresume.io/app/settings?billing=cancelled
BILLING_PORTAL_RETURN_URL=https://syncresume.io/app/settings
```
