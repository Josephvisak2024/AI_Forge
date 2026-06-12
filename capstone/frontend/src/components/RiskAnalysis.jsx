import { CheckCircle, AlertTriangle, XCircle, Globe } from "lucide-react";

const STATUS_CONFIG = {
  PASS: {
    Icon: CheckCircle,
    iconColor: "text-emerald-500",
    bg: "bg-emerald-50",
  },
  WARNING: {
    Icon: AlertTriangle,
    iconColor: "text-amber-500",
    bg: "bg-amber-50",
  },
  FAIL: {
    Icon: XCircle,
    iconColor: "text-red-500",
    bg: "bg-red-50",
  },
};

function RiskItem({ label, status = "PASS", detail }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PASS;
  const { Icon, iconColor, bg } = cfg;

  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0 border-gray-100">
      <div
        className={`w-7 h-7 rounded-full ${bg} flex items-center justify-center flex-shrink-0 mt-0.5`}
      >
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        {detail && (
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{detail}</p>
        )}
      </div>
    </div>
  );
}

function SkeletonRisk() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm animate-pulse">
      <div className="h-3 bg-gray-100 rounded w-24 mb-4" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 py-3 border-b last:border-0 border-gray-100">
          <div className="w-7 h-7 rounded-full bg-gray-100 flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-gray-100 rounded w-32" />
            <div className="h-3 bg-gray-100 rounded w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RiskAnalysis({ redFlags }) {
  if (!redFlags) return <SkeletonRisk />;

  const riskBadge = {
    Low: "bg-emerald-100 text-emerald-700",
    Medium: "bg-amber-100 text-amber-700",
    High: "bg-red-100 text-red-700",
  }[redFlags.overall_risk] || "bg-gray-100 text-gray-600";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Risk Analysis
        </span>
        <div className="flex items-center gap-2">
          {redFlags.overall_risk && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${riskBadge}`}>
              {redFlags.overall_risk} Risk
            </span>
          )}
          <Globe className="w-4 h-4 text-gray-400" />
        </div>
      </div>

      <RiskItem
        label="Tenure Stability"
        status={redFlags.tenure_stability?.status}
        detail={redFlags.tenure_stability?.detail}
      />
      <RiskItem
        label="Skills Authenticity"
        status={redFlags.skills_authenticity?.status}
        detail={redFlags.skills_authenticity?.detail}
      />
      <RiskItem
        label="Employment Gaps"
        status={redFlags.employment_gaps?.status}
        detail={redFlags.employment_gaps?.detail}
      />

      {redFlags.summary && (
        <p className="mt-3 text-xs text-gray-500 leading-relaxed">
          {redFlags.summary}
        </p>
      )}
    </div>
  );
}
