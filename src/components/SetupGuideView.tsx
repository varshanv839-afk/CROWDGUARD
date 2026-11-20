import React, { useEffect, useState } from 'react';
import { Server, Shield, Cpu, CheckCircle2, AlertCircle, Bot } from 'lucide-react';

interface SetupInfo {
  pythonAvailable: boolean;
  opencvVersion: string | null;
  numpyVersion: string | null;
  firebaseProjectId: string;
  geminiConfigured: boolean;
  firebaseTokenVerification?: boolean;
  pythonScript: string;
  sampleGenerator: string;
}

export const SetupGuideView: React.FC = () => {
  const [info, setInfo] = useState<SetupInfo | null>(null);

  useEffect(() => {
    fetch('/api/setup-info')
      .then((res) => res.json())
      .then((data) => setInfo(data))
      .catch(() => setInfo(null));
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#0D1424] border border-slate-800/80 rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Cpu className="w-4 h-4 text-blue-400" />
            Python OpenCV Engine
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            {info?.pythonAvailable ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">OpenCV {info.opencvVersion} · NumPy {info.numpyVersion}</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span className="text-slate-300">Checking Python runtime...</span>
              </>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Multi-camera HOG detection, Farneback Optical Flow, abnormal movement localization &amp; bottleneck classification.
          </p>
        </div>

        <div className="bg-[#0D1424] border border-slate-800/80 rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Server className="w-4 h-4 text-blue-400" />
            Express API Gateway
          </div>
          <p className="text-xs font-mono text-emerald-400">
            Active on Port 3000 · {info?.firebaseTokenVerification ? 'Token Check Ready' : 'Standard'}
          </p>
          <p className="text-xs text-slate-400">
            Serves `/api/analyze-videos`, `/api/auth/session`, `/api/admin/authorize-action`, and `/api/assistant`.
          </p>
        </div>

        <div className="bg-[#0D1424] border border-slate-800/80 rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Shield className="w-4 h-4 text-blue-400" />
            Firebase Auth &amp; Firestore
          </div>
          <p className="text-xs font-mono text-blue-400">
            Project: {info?.firebaseProjectId || 'configured'}
          </p>
          <p className="text-xs text-slate-400">
            Enforces ADMIN vs SECURITY OPERATOR RBAC, activity logs, incidents, notifications, and gate approvals.
          </p>
        </div>

        <div className="bg-[#0D1424] border border-slate-800/80 rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Bot className="w-4 h-4 text-blue-400" />
            AI Safety Assistant
          </div>
          <p className={`text-xs font-mono ${info?.geminiConfigured ? 'text-emerald-400' : 'text-amber-400'}`}>
            {info?.geminiConfigured ? 'Server-side Gemini Ready' : 'Configure GEMINI_API_KEY in Secrets'}
          </p>
          <p className="text-xs text-slate-400">
            Answers operator queries via `@google/genai` grounded in live zones, alerts, and evacuation paths.
          </p>
        </div>
      </div>

      <div className="bg-[#0D1424] border border-slate-800/80 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-white">Local, Firebase Auth &amp; Production Setup Instructions</h2>
          <p className="text-xs text-slate-400 mt-1">
            Architecture separates the React + Firebase frontend (`src/`) from the Node/Express API (`server.ts`) and Python OpenCV workers (`backend/`).
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
          <div className="bg-[#0A101D] border border-slate-800 rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-semibold text-white">1. Enable Firebase Email/Password &amp; Google Auth</h3>
            <ol className="list-decimal list-inside text-slate-300 space-y-1.5 leading-relaxed">
              <li>Open the Firebase Console for project <span className="font-mono text-blue-300">{info?.firebaseProjectId || 'inductive-nature-9q7xb'}</span>.</li>
              <li>Navigate to <span className="font-semibold text-white">Build → Authentication → Sign-in method</span>.</li>
              <li>Enable <span className="font-semibold text-white">Email/Password</span> (required for registration, password login, and password resets) alongside <span className="font-semibold text-white">Google</span>.</li>
              <li>Under <span className="font-semibold text-white">Authentication → Settings → Authorized domains</span>, verify your AI Studio preview domain is allowlisted.</li>
            </ol>
          </div>

          <div className="bg-[#0A101D] border border-slate-800 rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-semibold text-white">2. RBAC Authorization &amp; Security Rules</h3>
            <ul className="list-disc list-inside text-slate-300 space-y-1.5 leading-relaxed">
              <li>New registrations default to <span className="font-mono text-blue-300">role: &quot;operator&quot;</span>; Firestore Rules reject self-promotion to admin.</li>
              <li>Admins promote/demote roles by updating <span className="font-mono text-slate-200">/users/&#123;uid&#125;</span> and <span className="font-mono text-slate-200">/admins/&#123;uid&#125;</span> after Express <span className="font-mono text-slate-200">verifyIdToken</span> verification.</li>
              <li>Deactivated accounts (<span className="font-mono text-red-300">status: &quot;inactive&quot;</span>) are blocked at both Firestore Rules and client login.</li>
            </ul>
          </div>

          <div className="bg-[#0A101D] border border-slate-800 rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-semibold text-white">3. Python OpenCV &amp; Node Server</h3>
            <pre className="bg-[#070B14] border border-slate-800 rounded-md p-3 font-mono text-slate-300 overflow-x-auto">
{`pip install -r backend/requirements.txt
# Or on Debian/Ubuntu:
apt-get install -y python3-opencv python3-numpy ffmpeg
npm install && npm run dev`}
            </pre>
          </div>

          <div className="bg-[#0A101D] border border-slate-800 rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-semibold text-white">4. Real Analysis vs. Simulated Predictions</h3>
            <p className="text-slate-400 leading-relaxed">
              Multi-camera uploads and sample CCTV MP4s run through real OpenCV HOG detection and Farneback Optical Flow (`real_video_analysis`). Digital Twin interventions and 5–10 minute forecasts are explicitly marked as prototype statistical simulations (`simulated_prediction`).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
