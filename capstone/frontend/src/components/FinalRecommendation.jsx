import { Trophy, CheckCircle, AlertCircle, XCircle } from "lucide-react";

const REC_CONFIG = {
  SHORTLISTED: {
    icon: <CheckCircle className="w-7 h-7 text-green-400" />,
    label: "SHORTLISTED FOR INTERVIEW",
    bg: "bg-green-950/50",
    border: "border-green-500/50",
    scoreColor: "text-green-400",
    badgeBg: "bg-green-500",
  },
  "REVIEW REQUIRED": {
    icon: <AlertCircle className="w-7 h-7 text-yellow-400" />,
    label: "REVIEW REQUIRED",
    bg: "bg-yellow-950/40",
    border: "border-yellow-500/50",
    scoreColor: "text-yellow-400",
    badgeBg: "bg-yellow-500",
  },
  REJECTED: {
    icon: <XCircle className="w-7 h-7 text-red-400" />,
    label: "NOT RECOMMENDED",
    bg: "bg-red-950/40",
    border: "border-red-500/50",
    scoreColor: "text-red-400",
    badgeBg: "bg-red-500",
  },
};

function ScoreDonut({ score }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color =
    score >= 85 ? "#22c55e" : score >= 70 ? "#eab308" : "#ef4444";

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#374151"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          style={{ transition: "stroke-dasharray 1s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-2xl font-bold"
          style={{ color }}
        >
          {score}
        </span>
        <span className="text-xs text-gray-500">/ 100</span>
      </div>
    </div>
  );
}

function ScoreBreakdown({ data }) {
  const items = [
    {
      label: "Experience",
      score: data.experience_score,
      max: 30,
      color: "bg-blue-500",
    },
    {
      label: "Skills",
      score: data.skills_score,
      max: 40,
      color: "bg-purple-500",
    },
    {
      label: "Education",
      score: data.education_score,
      max: 20,
      color: "bg-green-500",
    },
    {
      label: "Red Flags",
      score: data.red_flags_deduction,
      max: 0,
      color: "bg-orange-500",
      isDeduction: true,
    },
  ];

  return (
    <div className="space-y-2 mt-4">
      {items.map((item) => {
        const pct = item.isDeduction
          ? Math.abs(item.score / 10) * 100
          : (item.score / item.max) * 100;
        return (
          <div key={item.label} className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-20 shrink-0">
              {item.label}
            </span>
            <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${item.color}`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
            <span className="text-xs font-mono text-gray-300 w-12 text-right shrink-0">
              {item.isDeduction
                ? item.score
                : `${item.score}/${item.max}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function FinalRecommendation({ scoring }) {
  const rec = scoring.recommendation || "REJECTED";
  const cfg = REC_CONFIG[rec] || REC_CONFIG["REJECTED"];

  return (
    <div
      className={`mt-8 border-2 rounded-2xl overflow-hidden ${cfg.border} ${cfg.bg}`}
      style={{ animation: "fadeSlideIn 0.5s ease-out both" }}
    >
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-3 border-b border-gray-700/50">
        <Trophy className="w-5 h-5 text-yellow-400" />
        <span className="font-bold text-white text-lg">Final Assessment</span>
      </div>

      {/* Body */}
      <div className="px-6 py-5">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Score donut */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <ScoreDonut score={scoring.final_score} />
            <span className="text-xs text-gray-500">Final Score</span>
          </div>

          {/* Right side */}
          <div className="flex-1 w-full">
            {/* Recommendation badge */}
            <div className="flex items-center gap-3 mb-3">
              {cfg.icon}
              <span className={`text-xl font-bold ${cfg.scoreColor}`}>
                {cfg.label}
              </span>
            </div>

            {/* Summary */}
            {scoring.summary && (
              <p className="text-sm text-gray-300 leading-relaxed">
                {scoring.summary}
              </p>
            )}

            {/* Score breakdown */}
            <ScoreBreakdown data={scoring} />
          </div>
        </div>
      </div>
    </div>
  );
}
