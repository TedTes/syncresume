# SyncResume

SyncResume is a resume optimization workspace. Users keep a resume library, add a target job description, run an LLM optimization, review structured sections, and export ATS-safe files.

## Implementation checkpoints

1. App shell and tooling.
2. Resume data model and scoring utilities.
3. Cloudflare auth and server-side provider credentials.
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

Create `.env.local` from `.env.example` before running the frontend:

```bash
VITE_CLOUDFLARE_API_URL=http://localhost:8787
```

## Cloudflare Environment

The backend lives in `cloudflare/` and is configured by `wrangler.toml`. The
frontend is deployed to Cloudflare Pages from `dist/`.

```bash
npm run cf:typecheck
npm run cf:d1:apply:local
npm run cf:dev
npm run cf:deploy
npm run cf:pages:deploy
```

Required Cloudflare resources:

- D1 database binding: `DB`
- R2 bucket binding: `RESUME_BUCKET`

Required Worker secrets:

```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put RESEND_API_KEY
```

For production, set `APP_ORIGIN` and `APP_BASE_URL` to the Pages URL, set
`AUTH_DEV_MODE = "false"`, and set the Pages build variable
`VITE_CLOUDFLARE_API_URL` to the deployed Worker URL.
