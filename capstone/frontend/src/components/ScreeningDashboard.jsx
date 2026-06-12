import { Briefcase, ArrowLeft, History } from "lucide-react";
import CandidateHeader from "./CandidateHeader";
import SuitabilityGauge from "./SuitabilityGauge";
import RiskAnalysis from "./RiskAnalysis";
import SkillMatrix from "./SkillMatrix";
import ProfessionalJourney from "./ProfessionalJourney";
import EducationPanel from "./EducationPanel";

const AGENT_LABELS = {
  experience: "Experience",
  skills: "Skills",
  education: "Education",
  red_flags: "Red Flags",
};

const REC_STYLES = {
  SHORTLISTED: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-800",
    badge: "bg-emerald-500 text-white",
    scoreColor: "text-emerald-700",
  },
  "REVIEW REQUIRED": {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
    badge: "bg-amber-500 text-white",
    scoreColor: "text-amber-700",
  },
  REJECTED: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    badge: "bg-red-500 text-white",
    scoreColor: "text-red-700",
  },
};

export default function ScreeningDashboard({
  agentResults,
  agentStatus,
  scoring,
  isComplete,
  onReset,
  onShortlist,
  onReject,
  candidateCount,
  onViewHistory,
}) {
  const { experience, skills, education, red_flags } = agentResults;
  const completedCount = Object.values(agentStatus).filter(
    (s) => s === "done"
  ).length;
  const totalSteps = 5; // 4 agents + 1 scoring
  const progress = completedCount + (scoring ? 1 : 0);

  const rec = scoring?.recommendation;
  const rc = REC_STYLES[rec] || REC_STYLES["REVIEW REQUIRED"];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Sticky header ──────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-3">
          <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center flex-shrink-0">
            <Briefcase className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-sm">HR Screening AI</span>

          {/* Live progress bar */}
          {!isComplete && (
            <div className="flex items-center gap-3 flex-1 max-w-sm mx-6">
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-700"
                  style={{ width: `${(progress / totalSteps) * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {progress}/{totalSteps} agents
              </span>
            </div>
          )}

          {/* Agent pills (while streaming) */}
          {!isComplete && (
            <div className="hidden lg:flex gap-1.5">
              {Object.entries(AGENT_LABELS).map(([key, label]) => {
                const done = agentStatus[key] === "done";
                return (
                  <span
                    key={key}
                    className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-all ${
                      done
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 text-gray-400 animate-pulse"
                    }`}
                  >
                    {done ? "✓ " : ""}
                    {label}
                  </span>
                );
              })}
            </div>
          )}

          {isComplete && scoring && (
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${rc.badge}`}
            >
              {scoring.recommendation}
            </span>
          )}

          <button
            onClick={onViewHistory}
            className="ml-auto flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors relative"
          >
            <History className="w-4 h-4" />
            History
            {candidateCount > 0 && (
              <span className="absolute -top-1.5 -right-2 w-4 h-4 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {candidateCount > 9 ? "9+" : candidateCount}
              </span>
            )}
          </button>
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            New Screening
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* ── Candidate profile header ─────────────────── */}
        <CandidateHeader scoring={scoring} onReset={onReset} onShortlist={onShortlist} onReject={onReject} />

        {/* ── Final recommendation banner ──────────────── */}
        {scoring && (
          <div
            className={`${rc.bg} border ${rc.border} rounded-xl px-6 py-4 flex items-center gap-6`}
          >
            <div className={`text-4xl font-black ${rc.scoreColor}`}>
              {scoring.final_score}
              <span className="text-2xl">/100</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${rc.badge}`}
                >
                  {scoring.recommendation}
                </span>
                {scoring.recommendation === "SHORTLISTED" && (
                  <span className="text-xs text-emerald-600 font-medium">
                    Score ≥ 90 — Shortlisted for interview
                  </span>
                )}
              </div>
              <p className={`text-sm ${rc.text} leading-relaxed line-clamp-2`}>
                {scoring.summary}
              </p>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <div className="text-center">
                <p className={`text-xs font-semibold ${rc.text} opacity-70`}>
                  Experience
                </p>
                <p className={`text-lg font-bold ${rc.text}`}>
                  {scoring.experience_score}/30
                </p>
              </div>
              <div className="text-center">
                <p className={`text-xs font-semibold ${rc.text} opacity-70`}>
                  Skills
                </p>
                <p className={`text-lg font-bold ${rc.text}`}>
                  {scoring.skills_score}/40
                </p>
              </div>
              <div className="text-center">
                <p className={`text-xs font-semibold ${rc.text} opacity-70`}>
                  Education
                </p>
                <p className={`text-lg font-bold ${rc.text}`}>
                  {scoring.education_score}/20
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Three-panel row ──────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SuitabilityGauge scoring={scoring} />
          <RiskAnalysis redFlags={red_flags} />
          <SkillMatrix skills={skills} />
        </div>

        {/* ── Bottom row: Journey + Education ─────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ProfessionalJourney experience={experience} />
          </div>
          <EducationPanel education={education} />
        </div>
      </main>
    </div>
  );
}
