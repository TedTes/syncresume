import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import OptimizerPage from "./OptimizerPage";
import ResumesPage from "./ResumesPage";

export default function WorkspacePage() {
  const { section } = useParams();
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
      <header className="page-topbar">
        <div className="workspace-title-group">
          <span className="page-topbar-title">Workspace</span>
          <span>Manage resumes and tailor them to each job.</span>
        </div>
      </header>

      <div className="workspace-flow">
        <OptimizerPage embedded onOpenResumes={scrollToResumes} />
        <div ref={resumesSectionRef} className="workspace-resumes-anchor">
          <ResumesPage embedded />
        </div>
      </div>
    </>
  );
}
