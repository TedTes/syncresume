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

## Browser Extension MVP

The Chrome extension captures the visible job post text from the active tab only
after the user clicks the extension button. The MVP copies the extracted job
description to the clipboard and opens the SyncResume workspace so the user can
paste/review it before optimizing.

```bash
npm run build:extension
```

Then open `chrome://extensions`, enable Developer mode, choose **Load unpacked**,
and select `dist-extension`.

Local test flow:

1. Open any job posting page.
2. Click the SyncResume extension.
3. Click **Send to SyncResume**.
4. Confirm the job description was copied.
5. Paste it into the workspace job description box and optimize.

The production workspace target is `https://app.syncresume.io/workspace/optimize`.
For local app testing, set `syncResumeWorkspaceUrl` in extension storage to
`http://localhost:5173/workspace/optimize`.

## Cloudflare Environment

The backend lives in `cloudflare/` and is configured by `wrangler.toml`. The
frontend is deployed to Cloudflare Pages from `dist/`. Production builds contain
Astro marketing pages at the root and the React app under `/app`.

Local development uses the frontend dev server plus a local Worker:

- Frontend: `http://localhost:5173`
- API Worker: `http://localhost:8787`

Production uses Cloudflare-hosted domains:

- Marketing: `https://syncresume.io`
- App: `https://app.syncresume.io`
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

If billing redirect vars are set explicitly, use the app domain:

```bash
BILLING_SUCCESS_URL=https://app.syncresume.io/settings?billing=success
BILLING_CANCEL_URL=https://app.syncresume.io/settings?billing=cancelled
BILLING_PORTAL_RETURN_URL=https://app.syncresume.io/settings
```

## Browser Extension

The Chrome extension source lives in `extension/`.

```bash
npm run build:extension
npm run package:extension
```

`build:extension` copies the extension into `dist-extension/`.
`package:extension` creates `syncresume-extension.zip` for Chrome Web Store upload.

Production capture flow:

1. Sign in to the SyncResume app.
2. Open Settings and create a browser extension token.
3. Paste that token into the extension popup once.
4. Open a job posting, click Capture current page, review the extracted text, then Send to SyncResume.
5. The extension sends the capture to `POST /api/job-captures`.
6. The app opens `https://app.syncresume.io/workspace/optimize?captureId=...` and preloads the captured job.

The extension falls back to copying the job text and opening the app if the token is missing,
expired, or the capture API is unavailable. Captured jobs expire after 14 days. Extension
tokens expire after 90 days.

## Jobs Feed API

The jobs feed API stores job posts discovered from future job APIs, scrapers, or automation
sources. It is separate from one-off browser captures.

- `GET /api/jobs?status=new&limit=20` lists the signed-in user's jobs.
- `POST /api/jobs` ingests one or more jobs.
- `POST /api/jobs/sync` fetches jobs from configured source adapters, applies match criteria, and ingests them.
- `PATCH /api/jobs/:id` updates a job status to `new`, `saved`, `dismissed`, or `applied`.
- `POST /api/jobs/:id/capture` converts a saved job into a workspace capture for optimization.

Supported sync adapters:

- `custom`: configurable JSON job search API for any-company search
- `apify`: requires `actorTaskId` or `actorId`, plus Worker secret `APIFY_API_TOKEN`
- `greenhouse`: requires `boardToken`
- `lever`: requires `boardToken`
- `ashby`: requires `boardToken`

Example ingest payload:

```json
{
  "jobs": [
    {
      "source": "apify-linkedin",
      "externalId": "job-123",
      "title": "Senior Software Engineer",
      "company": "Acme",
      "location": "Toronto, ON",
      "url": "https://example.com/jobs/123",
      "description": "Full job description text..."
    }
  ]
}
```

Example sync payload:

```json
{
  "criteria": {
    "targetTitles": ["Senior Software Engineer", "Platform Engineer"],
    "location": "remote-canada",
    "workType": "remote-hybrid",
    "seniority": "senior-staff",
    "salaryFloor": "160k",
    "sponsorship": "not-needed",
    "dailyLimit": 20
  },
  "sources": [
    {
      "provider": "custom",
      "source": "job-search-api",
      "url": "https://example.com/jobs/search",
      "method": "GET",
      "limit": 20,
      "headers": {
        "Authorization": "Bearer {{env.JOB_SEARCH_API_KEY}}"
      },
      "queryParams": {
        "q": "{{query}}",
        "location": "{{location}}",
        "limit": "{{limit}}"
      },
      "itemsPath": "jobs",
      "resultMapping": {
        "title": "title",
        "company": "company",
        "location": "location",
        "url": "url",
        "description": "description",
        "salary": "salary",
        "postedAt": "postedAt"
      }
    }
  ]
}
```

For production, store the source array in Worker var `JOB_SOURCE_CONFIG`. The web app
sends the current user's match criteria automatically when the Jobs page loads or the
user changes Settings. Use the `custom` adapter for any-company search APIs. It supports
configurable `url`, `method`, `headers`, `queryParams`, `body`, `itemsPath`, and
`resultMapping`, with placeholders such as `{{query}}`, `{{location}}`, `{{limit}}`,
`{{country}}`, and `{{env.JOB_SEARCH_API_KEY}}`.
Synced results are interleaved across configured sources before being saved, so one board
does not fill the daily list ahead of the rest.
Apify search actors are also supported with the same criteria placeholders in `input`.
Do not put reusable API tokens directly in JSON config; set them as Worker secrets and
reference them through `{{env.SECRET_NAME}}`.
