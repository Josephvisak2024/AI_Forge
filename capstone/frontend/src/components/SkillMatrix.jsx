import { BarChart2 } from "lucide-react";

function SkeletonSkills() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm animate-pulse">
      <div className="h-3 bg-gray-100 rounded w-24 mb-5" />
      {[90, 75, 60, 45].map((w, i) => (
        <div key={i} className="mb-4">
          <div className="flex justify-between mb-1.5">
            <div className="h-2.5 bg-gray-100 rounded" style={{ width: `${w}%` }} />
            <div className="h-2.5 bg-gray-100 rounded w-8" />
          </div>
          <div className="h-2 bg-gray-100 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export default function SkillMatrix({ skills }) {
  if (!skills) return <SkeletonSkills />;

  const scores = skills.skill_scores || [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Skill Matrix
        </span>
        <BarChart2 className="w-4 h-4 text-gray-400" />
      </div>

      {/* Match percentage badge */}
      {skills.match_percentage !== undefined && (
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-1000"
              style={{ width: `${skills.match_percentage}%` }}
            />
          </div>
          <span className="text-sm font-bold text-blue-600 whitespace-nowrap">
            {skills.match_percentage}% match
          </span>
        </div>
      )}

      {/* Individual skill bars */}
      <div className="space-y-3">
        {scores.map((skill, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {skill.name}
              </span>
              <span className="text-xs font-bold text-gray-900">{skill.score}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${skill.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Missing / matching pills */}
      {(skills.missing_skills || []).length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-1.5">Missing Skills</p>
          <div className="flex flex-wrap gap-1">
            {skills.missing_skills.map((s, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded-full border border-red-100"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {skills.skill_gap_analysis && (
        <p className="mt-3 text-xs text-gray-500 leading-relaxed">
          {skills.skill_gap_analysis}
        </p>
      )}
    </div>
  );
}
