import React from 'react';
import { Route, AlertOctagon, ArrowRight, CheckCircle2, DoorOpen } from 'lucide-react';
import type {
  EvacuationPathSegment,
  EvacuationRecommendation,
  ZoneTelemetry,
} from '../types/crowguard';

interface EvacuationPlannerViewProps {
  zones: ZoneTelemetry[];
  segments: EvacuationPathSegment[];
  recommendations: EvacuationRecommendation[];
  onDispatchEvacuationNotice: (rec: EvacuationRecommendation) => void;
}

export const EvacuationPlannerView: React.FC<EvacuationPlannerViewProps> = ({
  zones,
  segments,
  recommendations,
  onDispatchEvacuationNotice,
}) => {
  const blockedCount = segments.filter((s) => s.status === 'blocked').length;
  const congestedCount = segments.filter((s) => s.status === 'congested').length;
  const clearExits = zones.filter(
    (z) => (z.nodeType === 'exit' || z.id === 'zone-d1' || z.id === 'zone-n4') && z.densityPerSqm < 3.0
  );

  return (
    <div className="space-y-6">
      {/* Top Status Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0D1424] border border-slate-800/80 rounded-xl p-4">
          <p className="text-xs text-slate-400">Blocked / Critical Corridors</p>
          <p className="text-2xl font-mono font-bold text-red-400 mt-1">{blockedCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Routes ≥ 4.4 p/m² or stalled flow</p>
        </div>
        <div className="bg-[#0D1424] border border-slate-800/80 rounded-xl p-4">
          <p className="text-xs text-slate-400">Congested Passages</p>
          <p className="text-2xl font-mono font-bold text-amber-400 mt-1">{congestedCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Slowed pedestrian throughput</p>
        </div>
        <div className="bg-[#0D1424] border border-slate-800/80 rounded-xl p-4">
          <p className="text-xs text-slate-400">Available Clear Exits</p>
          <p className="text-2xl font-mono font-bold text-emerald-400 mt-1">{clearExits.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Safe egress capacity &lt; 3.0 p/m²</p>
        </div>
      </div>

      {/* Interactive Evacuation Topology Map + Recommendations */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-7 bg-[#0D1424] border border-slate-800/80 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Venue Entrances, Exits &amp; Evacuation Routes</h2>
              <p className="text-xs text-slate-400">
                Red dashed corridors indicate congested/blocked bottlenecks · Emerald lines mark safer diversion paths
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-emerald-400 inline-block" /> Clear Exit Route
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-amber-400 inline-block" /> Congested
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-red-500 inline-block" /> Blocked
              </span>
            </div>
          </div>

          <div className="relative h-[360px] bg-[#080D18]">
            <svg viewBox="0 0 800 420" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
              <defs>
                <pattern id="evacGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#131D31" strokeWidth="1" />
                </pattern>
                <marker id="arrowClear" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L7,3 z" fill="#10B981" />
                </marker>
              </defs>
              <rect width="800" height="420" fill="url(#evacGrid)" />
              <rect x="55" y="40" width="690" height="340" rx="16" fill="#0B1221" stroke="#1E293B" strokeWidth="1.5" />

              {/* Corridor Segments */}
              {segments.map((seg) => {
                const x1 = (seg.x1 / 100) * 800;
                const y1 = (seg.y1 / 100) * 420;
                const x2 = (seg.x2 / 100) * 800;
                const y2 = (seg.y2 / 100) * 420;
                const stroke =
                  seg.status === 'blocked'
                    ? '#EF4444'
                    : seg.status === 'congested'
                    ? '#F59E0B'
                    : '#10B981';

                return (
                  <g key={seg.id}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={stroke}
                      strokeWidth={seg.status === 'clear' ? 3.5 : 4}
                      strokeDasharray={seg.status === 'clear' ? undefined : '8 6'}
                      strokeOpacity={0.85}
                      markerEnd={seg.status === 'clear' ? 'url(#arrowClear)' : undefined}
                    />
                    <rect
                      x={(x1 + x2) / 2 - 28}
                      y={(y1 + y2) / 2 - 10}
                      width="56"
                      height="18"
                      rx="4"
                      fill="#070B14"
                      stroke={stroke}
                      strokeOpacity={0.5}
                    />
                    <text
                      x={(x1 + x2) / 2}
                      y={(y1 + y2) / 2 + 3}
                      textAnchor="middle"
                      fill={stroke}
                      fontSize="9.5"
                      fontFamily="JetBrains Mono"
                    >
                      {seg.status.toUpperCase()}
                    </text>
                  </g>
                );
              })}

              {/* Nodes (Entrances, Junctions, Exits) */}
              {zones.map((z) => {
                const cx = (z.xPercent / 100) * 800;
                const cy = (z.yPercent / 100) * 420;
                const color =
                  z.densityLevel === 'CRITICAL'
                    ? '#EF4444'
                    : z.densityLevel === 'HIGH'
                    ? '#F59E0B'
                    : z.densityLevel === 'MEDIUM'
                    ? '#3B82F6'
                    : '#10B981';
                const badge =
                  z.nodeType === 'entrance'
                    ? 'ENTRANCE'
                    : z.nodeType === 'exit'
                    ? 'EXIT'
                    : 'JUNCTION';

                return (
                  <g key={z.id}>
                    <circle cx={cx} cy={cy} r="20" fill="#0A101D" stroke={color} strokeWidth="2.5" />
                    <text
                      x={cx}
                      y={cy + 3}
                      textAnchor="middle"
                      fill="#F8FAFC"
                      fontSize="10"
                      fontFamily="JetBrains Mono"
                      fontWeight="700"
                    >
                      {z.densityPerSqm.toFixed(1)}
                    </text>
                    <text
                      x={cx}
                      y={cy - 28}
                      textAnchor="middle"
                      fill="#CBD5E1"
                      fontSize="10"
                      fontFamily="Plus Jakarta Sans"
                      fontWeight="600"
                    >
                      {z.connectedGate} ({badge})
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Operator Recommendations List */}
        <div className="xl:col-span-5 bg-[#0D1424] border border-slate-800/80 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-800/80">
            <h2 className="text-sm font-semibold text-white">Operator Evacuation Advisories</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Safer alternative exit routes computed from live sector density &amp; Optical Flow speed
            </p>
          </div>

          <div className="flex-1 divide-y divide-slate-800/80 overflow-y-auto">
            {recommendations.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                <p className="text-sm font-medium text-white">All Evacuation Routes Clear</p>
                <p className="text-xs text-slate-400">
                  No congested or blocked corridors require crowd diversion right now.
                </p>
              </div>
            ) : (
              recommendations.map((rec) => (
                <div key={rec.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-red-400">
                      <AlertOctagon className="w-4 h-4 shrink-0" />
                      <span>Congested: {rec.congestedZone}</span>
                    </div>
                    <span className="font-mono text-xs text-emerald-400 shrink-0">
                      Est. -{rec.estimatedDensityDropPct}% load
                    </span>
                  </div>

                  <div className="bg-[#0A101D] border border-slate-800 rounded-lg p-3 space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <span>Avoid:</span>
                      <span className="font-mono text-red-300">{rec.blockedRoute}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-200 font-medium">
                      <DoorOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Use Alternative Exit:</span>
                      <span className="text-emerald-400">{rec.recommendedExit}</span>
                    </div>
                    <div className="flex items-center flex-wrap gap-1.5 pt-1 text-[11px] font-mono text-blue-300">
                      <Route className="w-3.5 h-3.5 shrink-0" />
                      {rec.pathWaypoints.map((wp, idx) => (
                        <React.Fragment key={wp}>
                          <span>{wp}</span>
                          {idx < rec.pathWaypoints.length - 1 && <ArrowRight className="w-3 h-3 text-slate-500" />}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{rec.reason}</p>

                  <button
                    type="button"
                    onClick={() => onDispatchEvacuationNotice(rec)}
                    className="w-full px-3 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-medium transition-colors"
                  >
                    Log Evacuation Route Advisory for Security Marshals
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
