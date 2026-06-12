import { useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  Search,
  Users,
  CheckCircle,
  XCircle,
  Calendar,
  AlertCircle,
  Star,
} from "lucide-react";

function getInitials(name) {
  return (name || "CV")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }) +
    " " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  );
}

function ScoreBar({ value, max, color }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-600 w-10 text-right">
        {value}/{max}
      </span>
    </div>
  );
}

export default function CandidateHistory({ candidates, onBack }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");

  const shortlisted = candidates.filter((c) => c.decision === "SHORTLISTED");
  const rejected = candidates.filter((c) => c.decision === "REJECTED");
  const aiOverrideCount = candidates.filter(
    (c) => c.recommendation && c.decision && c.recommendation !== c.decision
  ).length;

  const filtered = candidates.filter((c) => {
    const matchesFilter = filter === "ALL" || c.decision === filter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      (c.candidate_name || "").toLowerCase().includes(q) ||
      (c.candidate_title || "").toLowerCase().includes(q) ||
      (c.rejectionReason || "").toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  const FILTER_TABS = [
    { key: "ALL", label: "All", count: candidates.length },
    { key: "SHORTLISTED", label: "Shortlisted", count: shortlisted.length },
    { key: "REJECTED", label: "Rejected", count: rejected.length },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-3">
          <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center flex-shrink-0">
            <Briefcase className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-sm">HR Screening AI</span>
          <span className="text-gray-300 mx-1">•</span>
          <span className="text-sm text-gray-600 font-medium">Candidate History</span>
          <button
            onClick={onBack}
            className="ml-auto flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Screening
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: Users,
              label: "Total Screened",
              value: candidates.length,
              bg: "bg-blue-50",
              ic: "text-blue-600",
            },
            {
              icon: CheckCircle,
              label: "Shortlisted",
              value: shortlisted.length,
              bg: "bg-emerald-50",
              ic: "text-emerald-600",
            },
            {
              icon: XCircle,
              label: "Rejected",
              value: rejected.length,
              bg: "bg-red-50",
              ic: "text-red-600",
            },
            {
              icon: AlertCircle,
              label: "AI Overrides",
              value: aiOverrideCount,
              bg: "bg-amber-50",
              ic: "text-amber-600",
            },
          ].map(({ icon: Icon, label, value, bg, ic }) => (
            <div
              key={label}
              className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center gap-4"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bg}`}>
                <Icon className={`w-5 h-5 ${ic}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, title, or rejection reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-1.5 bg-gray-100 p-1 rounded-lg">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  filter === tab.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
                <span
                  className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    filter === tab.key
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {candidates.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-600 font-semibold">No candidates screened yet</p>
            <p className="text-gray-400 text-sm mt-1">
              Screen a resume and click Shortlist or Reject to save history
            </p>
            <button
              onClick={onBack}
              className="mt-5 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start Screening
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No candidates match your search</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_160px_180px_140px] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <div className="w-10" />
              <div>Candidate</div>
              <div className="text-center">Score &amp; Decision</div>
              <div>Rejection Reason</div>
              <div className="text-right">Date &amp; Status</div>
            </div>

            <div className="divide-y divide-gray-100">
              {filtered.map((c, idx) => {
                const isShortlisted = c.decision === "SHORTLISTED";
                const aiRecommendation = c.recommendation || "N/A";
                const hasDecisionMismatch =
                  c.recommendation && c.decision && c.recommendation !== c.decision;
                const avatarGrad = isShortlisted
                  ? "from-blue-500 to-indigo-600"
                  : "from-red-400 to-rose-600";
                const initials = getInitials(c.candidate_name);

                return (
                  <div
                    key={idx}
                    className="grid grid-cols-[auto_1fr_160px_180px_140px] gap-4 px-5 py-4 items-start hover:bg-gray-50 transition-colors"
                  >
                    <div
                      className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarGrad} flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mt-0.5`}
                    >
                      {initials}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 text-sm leading-tight">
                          {c.candidate_name || "Unknown"}
                        </p>
                        {c.candidate_title && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[11px] font-medium rounded truncate max-w-[160px]">
                            {c.candidate_title}
                          </span>
                        )}
                      </div>
                      {c.location && (
                        <p className="text-xs text-gray-400 mt-0.5">{c.location}</p>
                      )}

                      <div className="mt-2 space-y-1 max-w-xs">
                        <ScoreBar value={c.experience_score ?? 0} max={30} color="bg-blue-400" />
                        <ScoreBar value={c.skills_score ?? 0} max={40} color="bg-violet-400" />
                        <ScoreBar value={c.education_score ?? 0} max={20} color="bg-emerald-400" />
                      </div>

                      {c.tags && c.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap mt-2">
                          {c.tags.slice(0, 4).map((tag, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-medium rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="text-center pt-1">
                      <p
                        className={`text-2xl font-black ${
                          (c.final_score ?? 0) >= 90
                            ? "text-emerald-600"
                            : (c.final_score ?? 0) >= 70
                            ? "text-amber-600"
                            : "text-red-600"
                        }`}
                      >
                        {c.final_score ?? "-"}
                      </p>
                      <p className="text-[10px] text-gray-400 font-medium">/ 100</p>
                      <span
                        className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          isShortlisted
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {isShortlisted ? "FINAL: SHORTLISTED" : "FINAL: REJECTED"}
                      </span>
                      <p
                        className={`mt-1 text-[10px] font-medium ${
                          hasDecisionMismatch ? "text-amber-700" : "text-gray-400"
                        }`}
                      >
                        AI: {aiRecommendation}
                      </p>
                      {hasDecisionMismatch && (
                        <span className="inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          Manual Override
                        </span>
                      )}
                    </div>

                    <div className="pt-1">
                      {isShortlisted ? (
                        <div className="flex items-center gap-1.5 text-emerald-600">
                          <Star className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="text-xs font-semibold">Moved to Interview</span>
                        </div>
                      ) : c.rejectionReason ? (
                        <div>
                          <div className="flex items-start gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs font-semibold text-red-700 leading-tight">
                              {c.rejectionReason}
                            </p>
                          </div>
                          {c.rejectionNotes && (
                            <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed pl-5 italic">
                              "{c.rejectionNotes}"
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </div>

                    <div className="text-right pt-1">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                          isShortlisted
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isShortlisted ? "bg-emerald-500" : "bg-red-500"
                          }`}
                        />
                        {isShortlisted ? "Shortlisted" : "Rejected"}
                      </span>
                      <p className="text-[11px] text-gray-400 mt-1.5 flex items-center justify-end gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(c.screenedAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
