import { Award, CheckCircle2, BookOpen, School, GraduationCap, FlaskConical } from "lucide-react";

const LEVEL_CONFIG = {
  SSC: {
    label: "10th / SSC",
    icon: BookOpen,
    color: "bg-slate-100 text-slate-600",
    dot: "bg-slate-400",
  },
  INTERMEDIATE: {
    label: "12th / Intermediate",
    icon: School,
    color: "bg-violet-100 text-violet-600",
    dot: "bg-violet-400",
  },
  DIPLOMA: {
    label: "Diploma",
    icon: Award,
    color: "bg-orange-100 text-orange-600",
    dot: "bg-orange-400",
  },
  BACHELOR: {
    label: "Bachelor's",
    icon: GraduationCap,
    color: "bg-blue-100 text-blue-600",
    dot: "bg-blue-500",
  },
  MASTER: {
    label: "Master's",
    icon: GraduationCap,
    color: "bg-indigo-100 text-indigo-600",
    dot: "bg-indigo-500",
  },
  DOCTORATE: {
    label: "Doctorate / PhD",
    icon: FlaskConical,
    color: "bg-purple-100 text-purple-700",
    dot: "bg-purple-500",
  },
  OTHER: {
    label: "Other",
    icon: BookOpen,
    color: "bg-gray-100 text-gray-500",
    dot: "bg-gray-400",
  },
};

const LEVEL_ORDER = ["SSC", "INTERMEDIATE", "DIPLOMA", "BACHELOR", "MASTER", "DOCTORATE", "OTHER"];

function SkeletonEducation() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="h-3.5 bg-gray-100 rounded w-24 mb-6" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4 mb-6 last:mb-0">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex-shrink-0" />
              {i < 3 && <div className="w-0.5 h-8 bg-gray-100 mt-2" />}
            </div>
            <div className="flex-1 pb-2 space-y-1.5">
              <div className="h-3.5 bg-gray-200 rounded w-48" />
              <div className="h-3 bg-gray-100 rounded w-32" />
              <div className="h-3 bg-gray-100 rounded w-20" />
            </div>
          </div>
        ))}
      </div>
      <div className="bg-gray-900 rounded-xl p-5">
        <div className="h-3.5 bg-gray-700 rounded w-28 mb-4" />
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2.5 mb-2.5">
            <div className="w-4 h-4 rounded-full bg-gray-700" />
            <div className="h-3 bg-gray-700 rounded w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EducationPanel({ education }) {
  if (!education) return <SkeletonEducation />;

  const degrees = [...(education.degrees || [])].sort(
    (a, b) =>
      LEVEL_ORDER.indexOf(a.level || "OTHER") -
      LEVEL_ORDER.indexOf(b.level || "OTHER")
  );
  const certs = education.certifications || [];
  const resultColor =
    education.result === "PASS"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-red-100 text-red-700";

  return (
    <div className="space-y-4">
      {/* Education timeline card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-gray-900">Education</h3>
          {education.result && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${resultColor}`}>
              {education.result}
            </span>
          )}
        </div>

        {degrees.length === 0 ? (
          <p className="text-xs text-gray-400">No education details found in resume.</p>
        ) : (
          <div className="relative">
            {degrees.map((deg, i) => {
              const cfg = LEVEL_CONFIG[deg.level || "OTHER"] || LEVEL_CONFIG.OTHER;
              const Icon = cfg.icon;
              const isLast = i === degrees.length - 1;

              return (
                <div key={i} className="flex gap-3">
                  {/* Timeline spine */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.color}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    {!isLast && (
                      <div className="w-0.5 flex-1 bg-gray-100 my-1 min-h-[16px]" />
                    )}
                  </div>

                  {/* Content */}
                  <div className={`flex-1 min-w-0 ${!isLast ? "pb-4" : ""}`}>
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 leading-snug">
                          {deg.degree}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {deg.institution}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {deg.year && (
                          <span className="text-xs text-gray-400 font-mono">{deg.year}</span>
                        )}
                        {deg.verified && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                            <CheckCircle2 className="w-3 h-3" />
                            Verified
                          </span>
                        )}
                      </div>
                    </div>
                    {deg.grade && (
                      <p className="text-xs text-blue-600 font-medium mt-1">
                        {deg.grade}
                      </p>
                    )}
                    <span
                      className={`inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${cfg.color}`}
                    >
                      {cfg.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {education.analysis && (
          <p className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500 leading-relaxed">
            {education.analysis}
          </p>
        )}
      </div>

      {/* Certifications — dark card */}
      <div className="bg-gray-900 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Certifications</h3>
        </div>

        {certs.length === 0 ? (
          <p className="text-xs text-gray-500">No certifications found in resume.</p>
        ) : (
          <div className="space-y-2.5">
            {certs.map((cert, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span className="text-sm text-gray-300">{cert}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
