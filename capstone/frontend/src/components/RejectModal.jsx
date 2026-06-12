import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";

const REJECT_REASONS = [
  { value: "skills_mismatch", label: "Skills Mismatch", desc: "Required skills not present or insufficient" },
  { value: "insufficient_experience", label: "Insufficient Experience", desc: "Does not meet the minimum years of experience" },
  { value: "education_requirements", label: "Education Requirements Not Met", desc: "Academic qualifications below required level" },
  { value: "employment_gaps", label: "Significant Employment Gaps", desc: "Unexplained gaps raise concern" },
  { value: "low_score", label: "Low Overall Score", desc: "AI score below acceptable threshold" },
  { value: "overqualified", label: "Overqualified for the Role", desc: "Experience level exceeds position requirements" },
  { value: "other", label: "Other", desc: "Custom reason (specify in notes below)" },
];

export default function RejectModal({ candidate, onConfirm, onCancel }) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState(false);

  const handleConfirm = () => {
    if (!reason) {
      setError(true);
      return;
    }
    const reasonLabel = REJECT_REASONS.find((r) => r.value === reason)?.label || reason;
    onConfirm({ reason: reasonLabel, reasonCode: reason, notes: notes.trim() });
  };

  const name = candidate?.candidate_name || "this candidate";
  const score = candidate?.final_score;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4.5 h-4.5 text-red-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Reject Candidate</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {name}
                {score !== undefined && (
                  <span className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono">
                    Score: {score}/100
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Reason selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {REJECT_REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    reason === r.value
                      ? "border-red-300 bg-red-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="reject_reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => {
                      setReason(r.value);
                      setError(false);
                    }}
                    className="mt-0.5 accent-red-500 flex-shrink-0"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{r.desc}</p>
                  </div>
                </label>
              ))}
            </div>
            {error && (
              <p className="mt-2 text-xs text-red-600">Please select a rejection reason.</p>
            )}
          </div>

          {/* Additional notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Additional Notes{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any specific observations or feedback for records..."
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6 pt-2 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-semibold text-white transition-colors"
          >
            Confirm Rejection
          </button>
        </div>
      </div>
    </div>
  );
}
