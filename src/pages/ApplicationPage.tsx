import { useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { TopbarAccount } from "../components/TopbarAccount";
import OptimizerPage from "./OptimizerPage";

type ApplicationArtifact = "resume" | "cover-letter" | "job-description";

function readPreferredArtifact(search: string): ApplicationArtifact {
  const artifact = new URLSearchParams(search).get("artifact");
  if (artifact === "cover-letter" || artifact === "job-description") return artifact;
  return "resume";
}

export default function ApplicationPage() {
  const { runId } = useParams();
  const location = useLocation();
  const [reviewToolbarHost, setReviewToolbarHost] = useState<HTMLDivElement | null>(null);

  const preferredArtifact = readPreferredArtifact(location.search);

  return (
    <>
      <header className="page-topbar workspace-topbar review-mode">
        <div className="review-toolbar-slot" ref={setReviewToolbarHost} />
        <TopbarAccount />
      </header>

      <div className="workspace-outer application-detail-outer">
        <div className="workspace-flow application-detail-flow">
          <OptimizerPage
            embedded
            preferredArtifact={preferredArtifact}
            reviewBackPath="/dashboard"
            reviewRunId={runId}
            reviewToolbarHost={reviewToolbarHost}
          />
        </div>
      </div>
    </>
  );
}
