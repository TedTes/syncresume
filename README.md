# SyncResume

SyncResume is a client-side resume optimization workspace. Users provide a session-only LLM API key, paste a job description and resume, optimize the resume into structured sections, review changes, edit targeted sections, and export the result.

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
