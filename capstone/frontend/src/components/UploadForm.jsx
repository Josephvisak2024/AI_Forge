import { useState, useRef } from "react";
import {
  Upload,
  FileText,
  X,
  AlertCircle,
  Briefcase,
  ChevronRight,
  Zap,
  History,
} from "lucide-react";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_SIZE = 5 * 1024 * 1024;
const JD_MIN = 500;
const JD_MAX = 3000;

const AGENTS = [
  { icon: "💼", label: "Experience", desc: "Work history vs requirements" },
  { icon: "⚡", label: "Skills Match", desc: "Technical skills gap analysis" },
  { icon: "🎓", label: "Education", desc: "Qualification verification" },
  { icon: "🚩", label: "Red Flags", desc: "Risk & consistency check" },
  { icon: "🏆", label: "Final Score", desc: "Aggregated recommendation" },
];

export default function UploadForm({
  onSubmit,
  error,
  candidateCount,
  shortlistedCount,
  rejectedCount,
  onViewHistory,
}) {
  const [file, setFile] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [fileError, setFileError] = useState("");
  const [jdError, setJdError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const jdLen = jobDescription.length;

  const validateFile = (f) => {
    if (!ALLOWED_TYPES.includes(f.type))
      return "Only PDF and DOCX files are accepted.";
    if (f.size > MAX_SIZE) return "File size must not exceed 5 MB.";
    return "";
  };

  const handleFileChange = (f) => {
    if (!f) return;
    const err = validateFile(f);
    setFileError(err);
    setFile(err ? null : f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileChange(dropped);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let valid = true;

    if (!file) {
      setFileError("Please upload a resume (PDF or DOCX).");
      valid = false;
    }

    const jd = jobDescription.trim();
    if (jd.length < JD_MIN) {
      setJdError(
        `Job description must be at least ${JD_MIN} characters. Currently ${jd.length} characters.`
      );
      valid = false;
    } else if (jd.length > JD_MAX) {
      setJdError(`Job description must not exceed ${JD_MAX} characters.`);
      valid = false;
    } else {
      setJdError("");
    }

    if (!valid) return;
    setLoading(true);
    await onSubmit(file, jd);
    setLoading(false);
  };

  const jdPct = Math.min((jdLen / JD_MAX) * 100, 100);
  const jdBarColor =
    jdLen === 0
      ? "bg-gray-300"
      : jdLen < JD_MIN
      ? "bg-amber-400"
      : jdLen > JD_MAX
      ? "bg-red-500"
      : "bg-emerald-500";
  const jdCountColor =
    jdLen > JD_MAX
      ? "text-red-600 bg-red-50"
      : jdLen >= JD_MIN
      ? "text-emerald-700 bg-emerald-50"
      : "text-amber-700 bg-amber-50";

  const shortlistRate =
    candidateCount > 0
      ? Math.round((shortlistedCount / candidateCount) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Top nav ─────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-8 h-16 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">HR Screening AI</span>
          <div className="ml-auto flex items-center gap-4">
            <button
              type="button"
              onClick={onViewHistory}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors relative"
            >
              <History className="w-4 h-4" />
              History
              <span className="ml-0.5 px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-full">
                {candidateCount}
              </span>
            </button>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Powered by GPT-4o Swarm
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-8 py-10">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Resume Screening</h1>
          <p className="text-gray-500 mt-1.5 text-sm">
            Upload a candidate's resume and paste the job description. Five
            specialized AI agents will evaluate the candidate in parallel and
            stream results in real-time.
          </p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3 max-w-3xl">
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-blue-600 font-semibold">
                Total Screened
              </p>
              <p className="text-xl font-bold text-blue-900">{candidateCount}</p>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-emerald-600 font-semibold">
                Shortlisted
              </p>
              <p className="text-xl font-bold text-emerald-900">{shortlistedCount}</p>
            </div>
            <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-red-600 font-semibold">
                Rejected
              </p>
              <p className="text-xl font-bold text-red-900">{rejectedCount}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">
                Shortlist Rate
              </p>
              <p className="text-xl font-bold text-gray-900">{shortlistRate}%</p>
            </div>
          </div>
        </div>

        {/* Backend error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── Job Description ──────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    Job Description
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Min {JD_MIN.toLocaleString()} · Max {JD_MAX.toLocaleString()} characters
                  </p>
                </div>
                <span
                  className={`text-xs font-mono font-semibold px-2 py-1 rounded-md ${jdCountColor}`}
                >
                  {jdLen.toLocaleString()} / {JD_MAX.toLocaleString()}
                </span>
              </div>

              <textarea
                value={jobDescription}
                onChange={(e) => {
                  setJobDescription(e.target.value);
                  if (jdError) setJdError("");
                }}
                placeholder={
                  "Paste the complete job description here…\n\nInclude required skills, responsibilities, " +
                  "qualifications, and any other relevant details about the role."
                }
                className={`flex-1 w-full h-64 resize-none rounded-lg border text-sm text-gray-800 placeholder-gray-400 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                  jdError
                    ? "border-red-300 bg-red-50"
                    : "border-gray-200 bg-gray-50 focus:bg-white"
                }`}
              />

              {/* Character progress bar */}
              <div className="mt-2">
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${jdBarColor}`}
                    style={{ width: `${jdPct}%` }}
                  />
                </div>
              </div>

              {jdError ? (
                <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {jdError}
                </p>
              ) : (
                jdLen > 0 &&
                jdLen < JD_MIN && (
                  <p className="mt-2 text-xs text-amber-600">
                    {JD_MIN - jdLen} more characters needed
                  </p>
                )
              )}
            </div>

            {/* ── Resume Upload ────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col">
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-gray-900">
                  Candidate Resume
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  PDF or DOCX · Max 5 MB
                </p>
              </div>

              {!file ? (
                <div
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`flex-1 h-64 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all select-none ${
                    dragOver
                      ? "border-blue-400 bg-blue-50"
                      : fileError
                      ? "border-red-300 bg-red-50"
                      : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                  }`}
                >
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
                      dragOver ? "bg-blue-100" : "bg-gray-100"
                    }`}
                  >
                    <Upload
                      className={`w-7 h-7 ${
                        dragOver ? "text-blue-500" : "text-gray-400"
                      }`}
                    />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">
                    {dragOver ? "Drop to upload" : "Drag & drop resume here"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    or click to browse
                  </p>
                  <p className="text-xs text-gray-300 mt-3">
                    PDF, DOCX · Max 5 MB
                  </p>
                </div>
              ) : (
                <div className="flex-1 h-64 flex flex-col items-center justify-center gap-4">
                  <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100 flex flex-col items-center text-center w-full">
                    <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-3">
                      <FileText className="w-7 h-7 text-blue-500" />
                    </div>
                    <p className="text-sm font-semibold text-gray-900 break-all px-2">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setFileError("");
                    }}
                    className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 font-medium"
                  >
                    <X className="w-3.5 h-3.5" /> Remove file
                  </button>
                </div>
              )}

              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0])}
              />

              {fileError && (
                <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {fileError}
                </p>
              )}
            </div>
          </div>

          {/* ── Submit ───────────────────────────────────── */}
          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-sm hover:shadow-md text-sm"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Starting Analysis…
                </>
              ) : (
                <>
                  Screen Resume
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* ── Agent info strip ─────────────────────────── */}
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              5 AI Agents Run in Parallel
            </span>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {AGENTS.map((a, i) => (
              <div
                key={i}
                className="bg-white rounded-lg border border-gray-100 p-3 text-center shadow-sm"
              >
                <div className="text-xl mb-1">{a.icon}</div>
                <p className="text-xs font-semibold text-gray-700">{a.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
