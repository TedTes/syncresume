import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import OptimizerPage from "./OptimizerPage";
import ResumesPage from "./ResumesPage";

export default function WorkspacePage() {
  const { section, runId } = useParams();
  const resumesSectionRef = useRef<HTMLDivElement>(null);

  function scrollToResumes() {
    resumesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    if (section !== "resumes") return;

    requestAnimationFrame(() => {
      resumesSectionRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
    });
  }, [section]);

  return (
    <>
      <div className="workspace-flow">
        <OptimizerPage embedded onOpenResumes={scrollToResumes} reviewRunId={runId} />
        <div ref={resumesSectionRef} className="workspace-resumes-anchor">
          <ResumesPage embedded />
        </div>
      </div>
    </>
  );
}
