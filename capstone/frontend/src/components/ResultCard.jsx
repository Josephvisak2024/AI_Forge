import { CheckCircle, XCircle, AlertTriangle, Loader } from "lucide-react";

const AGENT_CONFIG = {
  experience: {
    title: "Experience Analysis",
    icon: "💼",
    borderColor: "border-blue-500/40",
    headerBg: "bg-blue-950/40",
    badgeColor: "bg-blue-900 text-blue-200",
  },
  skills: {
    title: "Skills Matching",
    icon: "⚡",
    borderColor: "border-purple-500/40",
    headerBg: "bg-purple-950/40",
    badgeColor: "bg-purple-900 text-purple-200",
  },
  education: {
    title: "Education Verification",
    icon: "🎓",
    borderColor: "border-green-500/40",
    headerBg: "bg-green-950/40",
    badgeColor: "bg-green-900 text-green-200",
  },
  red_flags: {
    title: "Red Flag Detection",
    icon: "🚩",
    borderColor: "border-orange-500/40",
    headerBg: "bg-orange-950/40",
    badgeColor: "bg-orange-900 text-orange-200",
  },
};

function ExperienceBody({ data }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4">
        <Stat label="Experience" value={data.years_of_experience} />
        <Stat
          label="Alignment Score"
          value={
            <span className="flex items-center gap-1">
              <ScoreBar value={data.alignment_score} max={10} />
              <span className="ml-2 font-bold text-white">
                {data.alignment_score}/10
              </span>
            </span>
          }
        />
      </div>
      {data.relevant_experience && (
        <p className="text-sm text-gray-300">
          <span className="text-gray-500">Relevant: </span>
          {data.relevant_experience}
        </p>
      )}
      {data.summary && (
        <p className="text-sm text-gray-400 italic">{data.summary}</p>
      )}
    </div>
  );
}

function SkillsBody({ data }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <ScoreBar value={data.match_percentage} max={100} wide />
        <span className="font-bold text-white whitespace-nowrap">
          {data.match_percentage}% match
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data.matching_skills?.length > 0 && (
          <div>
            <p className="text-xs text-green-400 font-semibold mb-1.5 uppercase tracking-wide">
              ✅ Matching Skills
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.matching_skills.map((s) => (
                <span
                  key={s}
                  className="px-2 py-0.5 bg-green-900/50 text-green-300 text-xs rounded-full border border-green-700/50"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
        {data.missing_skills?.length > 0 && (
          <div>
            <p className="text-xs text-red-400 font-semibold mb-1.5 uppercase tracking-wide">
              ❌ Missing Skills
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.missing_skills.map((s) => (
                <span
                  key={s}
                  className="px-2 py-0.5 bg-red-900/50 text-red-300 text-xs rounded-full border border-red-700/50"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {data.skill_gap_analysis && (
        <p className="text-sm text-gray-400 italic">{data.skill_gap_analysis}</p>
      )}
    </div>
  );
}

function EducationBody({ data }) {
  const passed = data.result?.toLowerCase() === "pass" || data.meets_requirements;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {passed ? (
          <CheckCircle className="w-6 h-6 text-green-400 shrink-0" />
        ) : (
          <XCircle className="w-6 h-6 text-red-400 shrink-0" />
        )}
        <span
          className={`font-bold text-lg ${
            passed ? "text-green-300" : "text-red-300"
          }`}
        >
          {data.result}
        </span>
      </div>
      {data.degree && (
        <p className="text-sm text-gray-300">
          <span className="text-gray-500">Degree: </span>
          {data.degree}
          {data.institution ? ` — ${data.institution}` : ""}
        </p>
      )}
      {data.analysis && (
        <p className="text-sm text-gray-400 italic">{data.analysis}</p>
      )}
    </div>
  );
}

function RedFlagsBody({ data }) {
  const riskColors = {
    Low: "text-green-400",
    Medium: "text-yellow-400",
    High: "text-red-400",
  };
  const severityBadge = {
    Low: "bg-green-900/50 text-green-300 border-green-700/50",
    Medium: "bg-yellow-900/50 text-yellow-300 border-yellow-700/50",
    High: "bg-red-900/50 text-red-300 border-red-700/50",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-gray-400 text-sm">Overall Risk:</span>
        <span
          className={`font-bold ${
            riskColors[data.overall_risk] || "text-gray-300"
          }`}
        >
          {data.overall_risk}
        </span>
        <span className="text-gray-500 text-sm">
          ({data.flags_found ?? data.flags?.length ?? 0} flag
          {(data.flags_found ?? data.flags?.length ?? 0) !== 1 ? "s" : ""}{" "}
          found)
        </span>
      </div>

      {data.flags?.length > 0 && (
        <div className="space-y-2">
          {data.flags.map((flag, i) => (
            <div
              key={i}
              className="flex items-start gap-2 p-3 bg-gray-800/60 rounded-lg border border-gray-700/50"
            >
              <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-200">
                    {flag.type}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      severityBadge[flag.severity] ||
                      "bg-gray-700 text-gray-300 border-gray-600"
                    }`}
                  >
                    {flag.severity}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {flag.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {data.flags?.length === 0 && (
        <p className="text-sm text-green-400 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> No red flags detected.
        </p>
      )}

      {data.summary && (
        <p className="text-sm text-gray-400 italic">{data.summary}</p>
      )}
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">
        {label}
      </p>
      <div className="text-sm text-gray-200">{value}</div>
    </div>
  );
}

function ScoreBar({ value, max = 10, wide = false }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const color =
    pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div
      className={`h-2 rounded-full bg-gray-700 overflow-hidden ${
        wide ? "flex-1" : "w-24"
      }`}
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────

const BODY_COMPONENTS = {
  experience: ExperienceBody,
  skills: SkillsBody,
  education: EducationBody,
  red_flags: RedFlagsBody,
};

export default function ResultCard({ type, data }) {
  const cfg = AGENT_CONFIG[type] || {
    title: type,
    icon: "🤖",
    borderColor: "border-gray-700",
    headerBg: "bg-gray-800",
    badgeColor: "bg-gray-700 text-gray-300",
  };

  const BodyComponent = BODY_COMPONENTS[type];

  if (data?.error) {
    return (
      <div
        className={`border rounded-xl overflow-hidden ${cfg.borderColor} animate-fadeIn`}
      >
        <div className={`px-5 py-3 ${cfg.headerBg} flex items-center gap-2`}>
          <span>{cfg.icon}</span>
          <span className="font-semibold text-white">{cfg.title}</span>
        </div>
        <div className="px-5 py-4 bg-gray-900">
          <p className="text-sm text-red-400">
            ⚠️ Agent error: {data.error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`border rounded-xl overflow-hidden ${cfg.borderColor} animate-fadeIn`}
      style={{ animation: "fadeSlideIn 0.35s ease-out both" }}
    >
      <div
        className={`px-5 py-3 ${cfg.headerBg} flex items-center justify-between`}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{cfg.icon}</span>
          <span className="font-semibold text-white">{cfg.title}</span>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badgeColor}`}
        >
          Complete
        </span>
      </div>

      <div className="px-5 py-4 bg-gray-900">
        {BodyComponent ? <BodyComponent data={data} /> : (
          <pre className="text-xs text-gray-400 whitespace-pre-wrap">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
