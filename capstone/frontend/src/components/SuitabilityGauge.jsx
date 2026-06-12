import { useState, useEffect } from "react";

const RADIUS = 80;
const CX = 100;
const CY = 100;
const CIRCUMFERENCE = Math.PI * RADIUS; // 251.33
const PATH = `M ${CX - RADIUS} ${CY} A ${RADIUS} ${RADIUS} 0 0 1 ${CX + RADIUS} ${CY}`;

function SkeletonGauge() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm animate-pulse">
      <div className="h-3 bg-gray-100 rounded w-24 mb-4" />
      <div className="flex justify-center mb-4">
        <div className="w-40 h-24 bg-gray-100 rounded-xl" />
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-100 rounded w-3/4 mx-auto" />
        <div className="h-3 bg-gray-100 rounded w-1/2 mx-auto" />
        <div className="flex justify-center gap-2 mt-3">
          <div className="h-6 w-16 bg-gray-100 rounded-full" />
          <div className="h-6 w-16 bg-gray-100 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function SuitabilityGauge({ scoring }) {
  const score = scoring?.final_score;
  const [dashOffset, setDashOffset] = useState(CIRCUMFERENCE);

  useEffect(() => {
    if (score !== undefined && score !== null) {
      const t = setTimeout(
        () => setDashOffset(CIRCUMFERENCE * (1 - score / 100)),
        80
      );
      return () => clearTimeout(t);
    }
  }, [score]);

  if (!scoring && score === undefined) return <SkeletonGauge />;

  const arcColor =
    score >= 90
      ? "#2563eb"
      : score >= 70
      ? "#d97706"
      : "#dc2626";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      {/* Card header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          AI Suitability
        </span>
        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
        </div>
      </div>

      {/* SVG Gauge */}
      <div className="flex justify-center my-1">
        <svg viewBox="0 0 200 106" className="w-44">
          {/* Background track */}
          <path
            d={PATH}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="14"
            strokeLinecap="round"
          />
          {/* Progress arc */}
          {score !== undefined && (
            <path
              d={PATH}
              fill="none"
              stroke={arcColor}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 1.3s cubic-bezier(0.4,0,0.2,1)" }}
            />
          )}
          {/* Score text */}
          {score !== undefined ? (
            <text
              x={CX}
              y={CY - 8}
              textAnchor="middle"
              fill="#111827"
              fontSize="30"
              fontWeight="700"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {score}%
            </text>
          ) : (
            <text
              x={CX}
              y={CY - 8}
              textAnchor="middle"
              fill="#d1d5db"
              fontSize="18"
              fontFamily="system-ui, sans-serif"
            >
              …
            </text>
          )}
        </svg>
      </div>

      {/* Stats below gauge */}
      {scoring ? (
        <div className="text-center space-y-2 mt-1">
          <p className="text-sm text-gray-600 leading-snug">
            Matches{" "}
            <span className="font-bold text-blue-600">
              {scoring.matched_requirements}/{scoring.total_requirements}
            </span>{" "}
            critical job requirements
            {scoring.recommendation === "SHORTLISTED" && (
              <span className="ml-1 text-emerald-600 font-semibold">
                with exceptional expertise.
              </span>
            )}
          </p>
          {scoring.summary && (
            <p className="text-xs text-gray-500 leading-relaxed px-1 line-clamp-3">
              {scoring.summary}
            </p>
          )}
          {(scoring.tags || []).length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5 pt-1">
              {scoring.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-100"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="animate-pulse mt-3 space-y-2">
          <div className="h-3 bg-gray-100 rounded w-3/4 mx-auto" />
          <div className="h-3 bg-gray-100 rounded w-1/2 mx-auto" />
        </div>
      )}
    </div>
  );
}
