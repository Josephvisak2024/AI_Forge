import { useEffect, useMemo, useState } from "react";
import UploadForm from "./components/UploadForm";
import ScreeningDashboard from "./components/ScreeningDashboard";
import CandidateHistory from "./components/CandidateHistory";
import RejectModal from "./components/RejectModal";

const AGENT_KEYS = ["experience", "skills", "education", "red_flags"];
const HISTORY_STORAGE_KEY = "capstone-candidate-history-v1";

export default function App() {
  const [phase, setPhase] = useState("upload"); // upload | screening | complete
  const [agentResults, setAgentResults] = useState({});
  const [agentStatus, setAgentStatus] = useState({});
  const [scoring, setScoring] = useState(null);
  const [error, setError] = useState(null);
  const [candidates, setCandidates] = useState([]); // history
  const [showHistory, setShowHistory] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      setCandidates(parsed);
    } catch (_) {
      window.localStorage.removeItem(HISTORY_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(candidates));
  }, [candidates]);

  const shortlistedCount = useMemo(
    () => candidates.filter((c) => c.decision === "SHORTLISTED").length,
    [candidates]
  );

  const rejectedCount = useMemo(
    () => candidates.filter((c) => c.decision === "REJECTED").length,
    [candidates]
  );

  const reset = () => {
    setPhase("upload");
    setAgentResults({});
    setAgentStatus({});
    setScoring(null);
    setError(null);
  };

  const handleShortlist = () => {
    if (!scoring) return;
    setCandidates((prev) => [
      {
        ...scoring,
        decision: "SHORTLISTED",
        rejectionReason: null,
        rejectionNotes: null,
        screenedAt: new Date().toISOString(),
        agentResults,
      },
      ...prev,
    ]);
    reset();
  };

  // Opens the modal — actual save happens in handleRejectConfirm
  const handleReject = () => {
    if (!scoring) return;
    setShowRejectModal(true);
  };

  const handleRejectConfirm = ({ reason, reasonCode, notes }) => {
    setCandidates((prev) => [
      {
        ...scoring,
        decision: "REJECTED",
        rejectionReason: reason,
        rejectionReasonCode: reasonCode,
        rejectionNotes: notes || null,
        screenedAt: new Date().toISOString(),
        agentResults,
      },
      ...prev,
    ]);
    setShowRejectModal(false);
    reset();
  };

  const handleRejectCancel = () => {
    setShowRejectModal(false);
  };

  const handleSubmit = async (file, jobDescription) => {
    setAgentResults({});
    setAgentStatus({});
    setScoring(null);
    setError(null);
    setPhase("screening");

    const formData = new FormData();
    formData.append("resume", file);
    formData.append("jobDescription", jobDescription);

    try {
      const response = await fetch("/api/screen", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let detail = "Screening request failed.";
        try {
          const err = await response.json();
          detail = err.detail || detail;
        } catch (_) {}
        throw new Error(detail);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") { setPhase("complete"); break; }

          try {
            const event = JSON.parse(raw);
            const { type, data } = event;
            if (type === "scoring") {
              setScoring(data);
              setPhase("complete");
            } else if (AGENT_KEYS.includes(type)) {
              setAgentResults((prev) => ({ ...prev, [type]: data }));
              setAgentStatus((prev) => ({ ...prev, [type]: "done" }));
            }
          } catch (_) {}
        }
      }
      setPhase("complete");
    } catch (err) {
      setError(err.message);
      setPhase("upload");
    }
  };

  if (showHistory) {
    return (
      <CandidateHistory
        candidates={candidates}
        onBack={() => setShowHistory(false)}
      />
    );
  }

  if (phase === "upload") {
    return (
      <UploadForm
        onSubmit={handleSubmit}
        error={error}
        candidateCount={candidates.length}
        shortlistedCount={shortlistedCount}
        rejectedCount={rejectedCount}
        onViewHistory={() => setShowHistory(true)}
      />
    );
  }

  return (
    <>
      {showRejectModal && (
        <RejectModal
          candidate={scoring}
          onConfirm={handleRejectConfirm}
          onCancel={handleRejectCancel}
        />
      )}
      <ScreeningDashboard
        agentResults={agentResults}
        agentStatus={agentStatus}
        scoring={scoring}
        isComplete={phase === "complete"}
        onReset={reset}
        onShortlist={handleShortlist}
        onReject={handleReject}
        candidateCount={candidates.length}
        shortlistedCount={shortlistedCount}
        rejectedCount={rejectedCount}
        onViewHistory={() => setShowHistory(true)}
      />
    </>
  );
}
