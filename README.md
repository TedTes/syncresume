# SyncResume

SyncResume is a resume optimization workspace. Users keep a resume library, add a target job description, run an LLM optimization, review structured sections, and export ATS-safe files.

## Implementation checkpoints

1. App shell and tooling.
2. Resume data model and scoring utilities.
3. Supabase auth and server-side provider credentials.
4. Job description and resume inputs with PDF/DOCX extraction.
5. LLM optimization with structured JSON output.
6. Review, inline editing, targeted section revision, and keyword scoring.
7. DOCX, PDF, and plain-text export.
8. Production polish and GitHub publish.

## Development

```bash
npm install
npm run dev
npm run build
```

## Cloudflare Environment

The Cloudflare backend lives in `cloudflare/` and is configured by `wrangler.toml`.

```bash
npm run cf:typecheck
npm run cf:d1:apply:local
npm run cf:dev
npm run cf:deploy
npm run cf:pages:deploy
```

Before deploying, create a D1 database and R2 bucket in Cloudflare, then replace
`REPLACE_WITH_D1_DATABASE_ID` in `wrangler.toml`. Store `OPENAI_API_KEY` as a
Worker secret. For production magic-link email, store `RESEND_API_KEY` as a
Worker secret and set `AUTH_DEV_MODE = "false"`.

## Supabase Environment

Create `.env.local` from `.env.example`:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Apply the database schema and configure Edge Function secrets:

```bash
supabase db push
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set OPENAI_MODEL=gpt-5.4-mini
```

The app calls these Edge Functions when Supabase is configured:

- `optimize-resume`: reads the active resume, calls the LLM, scores the result, increments usage, and stores run history.
- `revise-section`: revises one resume section with the same server-side provider secret.
- `fetch-job-page`: fetches and extracts readable text from job posting URLs without using a browser proxy.

Provider keys belong in Supabase secrets only, never in browser environment variables.
