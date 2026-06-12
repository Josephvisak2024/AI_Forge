import { Filter, MoreVertical } from "lucide-react";

function SkeletonJourney() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm animate-pulse">
      <div className="flex justify-between mb-5">
        <div className="h-4 bg-gray-100 rounded w-40" />
        <div className="flex gap-1">
          <div className="w-7 h-7 bg-gray-100 rounded" />
          <div className="w-7 h-7 bg-gray-100 rounded" />
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4 pb-6">
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-gray-200 mt-1.5" />
            {i < 3 && <div className="w-0.5 flex-1 bg-gray-100 mt-1" />}
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="flex justify-between">
              <div className="h-3.5 bg-gray-200 rounded w-40" />
              <div className="h-3 bg-gray-100 rounded w-24" />
            </div>
            <div className="h-3 bg-gray-100 rounded w-28" />
            <div className="h-3 bg-gray-100 rounded w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProfessionalJourney({ experience }) {
  if (!experience) return <SkeletonJourney />;

  const history = experience.work_history || [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      {/* Card header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-gray-900">
          Professional Journey
        </h3>
        <div className="flex gap-1">
          <button className="p-1.5 rounded hover:bg-gray-100 transition-colors">
            <Filter className="w-4 h-4 text-gray-400" />
          </button>
          <button className="p-1.5 rounded hover:bg-gray-100 transition-colors">
            <MoreVertical className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Summary badge */}
      {experience.years_of_experience && (
        <div className="mb-4 flex items-center gap-2">
          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-100">
            {experience.years_of_experience}
          </span>
          {experience.alignment_score !== undefined && (
            <span className="px-2.5 py-1 bg-gray-50 text-gray-600 text-xs font-semibold rounded-full border border-gray-200">
              Alignment: {experience.alignment_score}/10
            </span>
          )}
        </div>
      )}

      {/* Timeline */}
      <div>
        {history.map((job, i) => (
          <div key={i} className="flex gap-4">
            {/* Timeline dot + line */}
            <div className="flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${
                  i === 0 ? "bg-blue-500" : "bg-gray-300"
                }`}
              />
              {i < history.length - 1 && (
                <div className="w-0.5 flex-1 bg-gray-200 mt-1 mb-0" />
              )}
            </div>

            {/* Job details */}
            <div className="pb-5 flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-semibold text-gray-900 leading-snug">
                  {job.title}
                </h4>
                <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0 pt-0.5">
                  {job.period}
                </span>
              </div>
              {job.company && (
                <p className="text-sm text-blue-600 font-medium mt-0.5">
                  {job.company}
                </p>
              )}
              {job.description && (
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  {job.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {experience.summary && (
        <div className="mt-2 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 leading-relaxed">
            {experience.summary}
          </p>
        </div>
      )}
    </div>
  );
}
