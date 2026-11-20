import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  ReferenceLine,
} from 'recharts';
import { Info, AlertOctagon } from 'lucide-react';
import type {
  BottleneckRegion,
  DangerPredictionSummary,
  HistorySample,
  OpenCVAnalysisResult,
  RegionDensityCell,
} from '../types/crowguard';

interface DensityFlowViewProps {
  analysis: OpenCVAnalysisResult | null;
  history: HistorySample[];
  prediction: DangerPredictionSummary;
}

const DEFAULT_REGIONS: RegionDensityCell[] = [
  { id: 'R1-C1', row: 0, col: 0, count: 4, densityPerSqm: 1.25, level: 'LOW', speedMps: 1.21 },
  { id: 'R1-C2', row: 0, col: 1, count: 7, densityPerSqm: 2.19, level: 'MEDIUM', speedMps: 0.92 },
  { id: 'R1-C3', row: 0, col: 2, count: 6, densityPerSqm: 1.88, level: 'MEDIUM', speedMps: 0.96 },
  { id: 'R1-C4', row: 0, col: 3, count: 3, densityPerSqm: 0.94, level: 'LOW', speedMps: 1.32 },
  { id: 'R2-C1', row: 1, col: 0, count: 6, densityPerSqm: 1.88, level: 'MEDIUM', speedMps: 0.88 },
  { id: 'R2-C2', row: 1, col: 1, count: 15, densityPerSqm: 4.69, level: 'CRITICAL', speedMps: 0.28 },
  { id: 'R2-C3', row: 1, col: 2, count: 12, densityPerSqm: 3.75, level: 'HIGH', speedMps: 0.41 },
  { id: 'R2-C4', row: 1, col: 3, count: 5, densityPerSqm: 1.56, level: 'MEDIUM', speedMps: 0.95 },
  { id: 'R3-C1', row: 2, col: 0, count: 4, densityPerSqm: 1.25, level: 'LOW', speedMps: 1.18 },
  { id: 'R3-C2', row: 2, col: 1, count: 10, densityPerSqm: 3.13, level: 'HIGH', speedMps: 0.51 },
  { id: 'R3-C3', row: 2, col: 2, count: 8, densityPerSqm: 2.5, level: 'MEDIUM', speedMps: 0.72 },
  { id: 'R3-C4', row: 2, col: 3, count: 3, densityPerSqm: 0.94, level: 'LOW', speedMps: 1.26 },
];

const DEFAULT_BOTTLENECKS: BottleneckRegion[] = [
  { id: 'R2-C2', row: 1, col: 1, type: 'NARROW_PASSAGE', densityPerSqm: 4.69, speedMps: 0.28 },
  { id: 'R2-C3', row: 1, col: 2, type: 'CONGESTED_EXIT', densityPerSqm: 3.75, speedMps: 0.41 },
];

export const DensityFlowView: React.FC<DensityFlowViewProps> = ({
  analysis,
  history,
  prediction,
}) => {
  const latestFrame = analysis?.frames[analysis.frames.length - 1] ?? null;
  const regions = latestFrame?.regions ?? DEFAULT_REGIONS;
  const bottlenecks = latestFrame?.bottleneckRegions ?? DEFAULT_BOTTLENECKS;
  const isRealData = Boolean(analysis);

  const flowTimelineData = analysis
    ? analysis.frames.map((f) => ({
        label: `${f.timestampSec.toFixed(1)}s`,
        speedMps: f.opticalFlow.speedMps,
        densityPerSqm: f.peakDensityPerSqm,
        turbulencePct: Math.round(f.opticalFlow.directionalVariance * 100),
        dangerScore: f.dangerScore,
      }))
    : history.map((h) => ({
        label: h.label,
        speedMps: h.flowSpeedMps,
        densityPerSqm: h.densityPerSqm,
        turbulencePct: Math.round(h.turbulence * 100),
        dangerScore: h.dangerScore,
      }));

  const cellStyle = (level: RegionDensityCell['level']) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-red-950/50 border-red-500/60 text-red-300';
      case 'HIGH':
        return 'bg-amber-950/40 border-amber-500/50 text-amber-300';
      case 'MEDIUM':
        return 'bg-blue-950/40 border-blue-500/40 text-blue-300';
      default:
        return 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* 12-Region Spatial Density & Bottleneck Matrix */}
      <div className="bg-[#0D1424] border border-slate-800/80 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">4×3 Spatial Crowd Density &amp; Bottleneck Matrix</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isRealData
                ? `Measured from Real OpenCV Video (${analysis?.fileName || analysis?.scenario})`
                : 'Simulated Baseline Matrix · Load CCTV video in Multi-Camera Monitor for real OpenCV measurements'}
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            LOW &lt; 1.5 · MEDIUM 1.5–3.0 · HIGH 3.0–4.5 · CRITICAL ≥ 4.5 p/m²
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {regions.map((cell) => {
            const bn = bottlenecks.find((b) => b.id === cell.id);
            return (
              <div
                key={cell.id}
                className={`rounded-lg border p-3.5 transition-colors ${cellStyle(cell.level)}`}
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-semibold">{cell.id}</span>
                  <span>{cell.level}</span>
                </div>
                <p className="text-xl font-mono font-bold text-white mt-1.5">
                  {cell.densityPerSqm.toFixed(2)} <span className="text-xs font-normal text-slate-300">p/m²</span>
                </p>
                <p className="text-[11px] font-mono text-slate-300 mt-0.5">
                  {cell.count} pax · {cell.speedMps !== undefined ? `${cell.speedMps.toFixed(2)} m/s` : 'Flow tracked'}
                </p>
                {bn && (
                  <p className="text-[10px] font-mono text-amber-300 mt-1.5 flex items-center gap-1">
                    <AlertOctagon className="w-3 h-3 shrink-0" />
                    {bn.type.replace(/_/g, ' ')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts Row: Optical Flow vs Density + 5-10 Min Prediction */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-6 bg-[#0D1424] border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Optical Flow Speed vs. Crowd Density</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Source: {isRealData ? 'Real OpenCV Farneback Flow' : 'Simulated Flow History'}
            </p>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={flowTimelineData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="label" stroke="#64748B" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" stroke="#64748B" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" stroke="#64748B" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0A101D',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#F1F5F9',
                  }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="densityPerSqm"
                  name="Peak Density (p/m²)"
                  stroke="#EF4444"
                  fill="#EF4444"
                  fillOpacity={0.18}
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="speedMps"
                  name="Optical Flow Speed (m/s)"
                  stroke="#3B82F6"
                  strokeWidth={2.2}
                  dot={{ r: 3, fill: '#3B82F6' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="xl:col-span-6 bg-[#0D1424] border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-white">5–10 Minute Advanced Risk Prediction</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {prediction.hasSufficientHistory
                  ? `Projected +5m: ${prediction.projectedDanger5m}/100 · +10m: ${prediction.projectedDanger10m}/100`
                  : `Awaiting ${prediction.requiredHistory - prediction.historyCount} more historical intervals`}
              </p>
            </div>
            <span
              className={`text-xs font-mono font-semibold ${
                prediction.projectedRiskLevel === 'CRITICAL'
                  ? 'text-red-400'
                  : prediction.projectedRiskLevel === 'HIGH'
                  ? 'text-amber-400'
                  : prediction.projectedRiskLevel === 'MEDIUM'
                  ? 'text-blue-400'
                  : 'text-emerald-400'
              }`}
            >
              Risk Level: {prediction.projectedRiskLevel}
            </span>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={prediction.forecastSeries} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="label" stroke="#64748B" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} stroke="#64748B" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0A101D',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#F1F5F9',
                  }}
                />
                <ReferenceLine x="Now" stroke="#3B82F6" strokeDasharray="4 4" />
                <ReferenceLine y={75} stroke="#EF4444" strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="confidenceHigh"
                  name="Upper Projection Bound"
                  stroke="none"
                  fill="#F59E0B"
                  fillOpacity={0.14}
                />
                <Line
                  type="monotone"
                  dataKey="dangerScore"
                  name="Danger Score (0-100)"
                  stroke="#F59E0B"
                  strokeWidth={2.4}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4-Factor Risk Explainability & Turbulence */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-5 bg-[#0D1424] border border-slate-800/80 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">4-Factor Danger Score Explainability</h3>
          <p className="text-xs text-slate-300 leading-relaxed">{prediction.explanation}</p>

          <div className="space-y-3 pt-1">
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-300">Spatial Density (max 40)</span>
                <span className="text-red-400">{prediction.factors.densityContribution} / 40</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all"
                  style={{ width: `${(prediction.factors.densityContribution / 40) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-300">Movement Speed Stall (max 25)</span>
                <span className="text-amber-400">{prediction.factors.stoppageContribution} / 25</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{ width: `${(prediction.factors.stoppageContribution / 25) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-300">Directional Turbulence (max 20)</span>
                <span className="text-blue-400">{prediction.factors.turbulenceContribution} / 20</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${(prediction.factors.turbulenceContribution / 20) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-slate-300">Bottleneck Congestion (max 15)</span>
                <span className="text-purple-400">{prediction.factors.congestionContribution} / 15</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${(prediction.factors.congestionContribution / 15) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 text-[11px] text-slate-400 bg-[#0A101D] border border-slate-800/80 rounded-lg p-3">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <span>{prediction.disclaimer}</span>
          </div>
        </div>

        <div className="xl:col-span-7 bg-[#0D1424] border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Optical Flow Directional Turbulence (%)</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Circular variance of Farneback Optical Flow vectors — spikes indicate counterflow collisions or irregular crowd motion
            </p>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flowTimelineData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="label" stroke="#64748B" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} stroke="#64748B" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0A101D',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#F1F5F9',
                  }}
                />
                <ReferenceLine y={48} stroke="#EF4444" strokeDasharray="3 3" />
                <Bar dataKey="turbulencePct" name="Directional Turbulence (%)" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
