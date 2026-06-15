import { FileText, KeyRound, Sparkles } from "lucide-react";

export default function App() {
  return (
    <main className="app-shell">
      <section className="workspace">
        <div className="brand-strip">
          <div className="brand-mark" aria-hidden="true">
            SR
          </div>
          <div>
            <p className="eyebrow">syncresume.io</p>
            <h1>Resume optimizer workspace</h1>
          </div>
        </div>

        <div className="starter-grid">
          <article>
            <KeyRound aria-hidden="true" />
            <h2>Session key</h2>
            <p>Validate a user-provided LLM key without storing it.</p>
          </article>
          <article>
            <FileText aria-hidden="true" />
            <h2>Resume inputs</h2>
            <p>Paste text or extract resume content from PDF and DOCX files.</p>
          </article>
          <article>
            <Sparkles aria-hidden="true" />
            <h2>AI rewrite</h2>
            <p>Optimize sections, review diffs, edit inline, and export clean files.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
