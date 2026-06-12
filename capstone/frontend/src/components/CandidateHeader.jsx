import { X, CheckCircle, MapPin, Mail, Link } from "lucide-react";

function SkeletonHeader() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm animate-pulse">
      <div className="flex items-start gap-5">
        <div className="w-16 h-16 rounded-full bg-gray-200 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-6 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-100 rounded w-32" />
          <div className="h-3 bg-gray-100 rounded w-56" />
        </div>
        <div className="flex gap-3">
          <div className="h-9 w-20 bg-gray-100 rounded-lg" />
          <div className="h-9 w-24 bg-gray-100 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function CandidateHeader({ scoring, onReset, onShortlist, onReject }) {
  if (!scoring) return <SkeletonHeader />;

  const initials = (scoring.candidate_name || "CV")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isShortlisted = scoring.recommendation === "SHORTLISTED";

  const avatarGradient = isShortlisted
    ? "from-blue-500 to-indigo-600"
    : scoring.recommendation === "REJECTED"
    ? "from-red-400 to-rose-600"
    : "from-amber-400 to-orange-500";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-start gap-5">
        {/* Avatar */}
        <div
          className={`w-16 h-16 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white font-bold text-xl flex-shrink-0 ring-2 ring-white ring-offset-2`}
        >
          {initials}
        </div>

        {/* Candidate info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 truncate">
              {scoring.candidate_name || "Candidate"}
            </h1>
            {scoring.candidate_title && (
              <span className="px-2.5 py-0.5 bg-gray-900 text-white text-xs font-bold uppercase tracking-wider rounded whitespace-nowrap">
                {scoring.candidate_title}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
            {scoring.location && (
              <>
                <MapPin className="w-3.5 h-3.5" />
                <span>Based in {scoring.location}</span>
                {scoring.years_of_experience && (
                  <>
                    <span className="mx-1">•</span>
                    <span>{scoring.years_of_experience}</span>
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-4 mt-2 flex-wrap">
            {scoring.email && (
              <a
                href={`mailto:${scoring.email}`}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
              >
                <Mail className="w-3.5 h-3.5" />
                {scoring.email}
              </a>
            )}
            {scoring.linkedin && (
              <a
                href={
                  scoring.linkedin.startsWith("http")
                    ? scoring.linkedin
                    : `https://${scoring.linkedin}`
                }
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
              >
                <Link className="w-3.5 h-3.5" />
                {scoring.linkedin}
              </a>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 flex-shrink-0">
          <button
            onClick={onReject || onReset}
            className="flex items-center gap-2 px-4 py-2 border border-red-200 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <X className="w-4 h-4" />
            Reject
          </button>
          <button
            onClick={onShortlist}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            Shortlist
          </button>
        </div>
      </div>
    </div>
  );
}
