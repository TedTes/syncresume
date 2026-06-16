# SyncResume

SyncResume is a resume optimization workspace. Users keep a resume library, add a target job description, run an LLM optimization, review structured sections, and export ATS-safe files.

## Implementation checkpoints

1. App shell and tooling.
2. Resume data model and scoring utilities.
3. Session-only API key validation.
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

## Supabase Environment

Create `.env.local` from `.env.example`:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

LLM provider keys should be stored as Supabase Edge Function secrets, not browser environment variables.
