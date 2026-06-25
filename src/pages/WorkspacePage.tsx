import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import OptimizerPage from "./OptimizerPage";
import ResumesPage from "./ResumesPage";

type WorkspaceArtifact = "resume" | "cover-letter" | "job-description";

function readWorkspaceArtifact(value: string | null): WorkspaceArtifact {
  if (value === "cover-letter" || value === "job-description") return value;
  return "resume";
}

export default function WorkspacePage() {
  const { section, runId } = useParams();
  const [searchParams] = useSearchParams();
  const resumesSectionRef = useRef<HTMLDivElement>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(Boolean(runId));
  const preferredArtifact = readWorkspaceArtifact(searchParams.get("artifact"));

  const handleReviewOpenChange = useCallback((isOpen: boolean) => {
    setIsReviewOpen(isOpen);
  }, []);

  function scrollToResumes() {
    resumesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    if (runId) setIsReviewOpen(true);
  }, [runId]);

  useEffect(() => {
    if (section !== "resumes") return;

    requestAnimationFrame(() => {
      resumesSectionRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
    });
  }, [section]);

  return (
    <>
      <div className="workspace-flow">
        <OptimizerPage
          embedded
          onOpenResumes={scrollToResumes}
          onReviewOpenChange={handleReviewOpenChange}
          preferredArtifact={preferredArtifact}
          reviewRunId={runId}
        />
        {!runId && !isReviewOpen && (
          <div ref={resumesSectionRef} className="workspace-resumes-anchor">
            <ResumesPage embedded />
          </div>
        )}
      </div>
    </>
  );
}
