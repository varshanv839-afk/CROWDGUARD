import React from 'react';
import { Camera, ArrowUpRight } from 'lucide-react';
import type { ZoneTelemetry } from '../types/crowguard';

interface VenueMapPanelProps {
  zones: ZoneTelemetry[];
  selectedZoneId: string;
  onSelectZone: (zoneId: string) => void;
  onInspectInCCTV: () => void;
}

export const VenueMapPanel: React.FC<VenueMapPanelProps> = ({
  zones,
  selectedZoneId,
  onSelectZone,
  onInspectInCCTV,
}) => {
  const selectedZone = zones.find((z) => z.id === selectedZoneId) || zones[0];

  const getHeatColors = (level: ZoneTelemetry['densityLevel']) => {
    switch (level) {
      case 'CRITICAL':
        return { ring: '#EF4444', glow: 'rgba(239, 68, 68, 0.34)', text: 'text-red-400' };
      case 'HIGH':
        return { ring: '#F59E0B', glow: 'rgba(245, 158, 11, 0.28)', text: 'text-amber-400' };
      case 'MEDIUM':
        return { ring: '#3B82F6', glow: 'rgba(59, 130, 246, 0.25)', text: 'text-blue-400' };
      default:
        return { ring: '#10B981', glow: 'rgba(16, 185, 129, 0.20)', text: 'text-emerald-400' };
    }
  };

  return (
    <div className="bg-[#0D1424] border border-slate-800/80 rounded-xl overflow-hidden flex flex-col">
      <div className="px-5 py-3.5 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Spatial Crowd Density Map</h2>
          <p className="text-xs text-slate-400">
            Interactive venue perimeter · Click any camera node to inspect sector telemetry
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400 font-mono">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> LOW
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> MED
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> HIGH
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" /> CRIT
          </span>
        </div>
      </div>

      <div className="relative h-[320px] sm:h-[360px] bg-[#080D18] select-none overflow-hidden">
        {/* Tactical Venue Floorplan SVG */}
        <svg
          viewBox="0 0 800 420"
          className="w-full h-full object-cover"
          preserveAspectRatio="xMidYMid slice"
          aria-label="Venue crowd density perimeter map"
        >
          <defs>
            <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="#141E33"
                strokeWidth="1"
              />
            </pattern>
            {zones.map((z) => {
              const colors = getHeatColors(z.densityLevel);
              return (
                <radialGradient key={`grad-${z.id}`} id={`heat-${z.id}`}>
                  <stop offset="0%" stopColor={colors.ring} stopOpacity="0.55" />
                  <stop offset="55%" stopColor={colors.ring} stopOpacity="0.18" />
                  <stop offset="100%" stopColor={colors.ring} stopOpacity="0" />
                </radialGradient>
              );
            })}
          </defs>

          <rect width="800" height="420" fill="url(#gridPattern)" />

          {/* Architectural concourse & gate outlines */}
          <rect
            x="60"
            y="45"
            width="680"
            height="330"
            rx="16"
            fill="#0B1221"
            stroke="#1E293B"
            strokeWidth="1.5"
          />
          {/* Inner stadium bowl / central concourse ring */}
          <rect
            x="240"
            y="120"
            width="320"
            height="180"
            rx="24"
            fill="#0F182C"
            stroke="#24334D"
            strokeWidth="1.5"
          />
          {/* Corridors connecting gates */}
          <path
            d="M 110 110 L 385 225 L 545 145 M 385 225 L 210 305 M 385 225 L 625 285"
            fill="none"
            stroke="#1E293B"
            strokeWidth="22"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 110 110 L 385 225 L 545 145 M 385 225 L 210 305 M 385 225 L 625 285"
            fill="none"
            stroke="#3B82F6"
            strokeOpacity="0.22"
            strokeWidth="2"
            strokeDasharray="6 6"
          />

          {/* Gate entry labels */}
          <text x="90" y="34" fill="#64748B" fontSize="11" fontFamily="JetBrains Mono">
            GATE A1 · NORTH ENTRY
          </text>
          <text x="530" y="34" fill="#64748B" fontSize="11" fontFamily="JetBrains Mono">
            GATE B2 · SOUTH FUNNEL
          </text>
          <text x="90" y="396" fill="#64748B" fontSize="11" fontFamily="JetBrains Mono">
            TUNNEL N4 · TRANSIT
          </text>
          <text x="540" y="396" fill="#64748B" fontSize="11" fontFamily="JetBrains Mono">
            GATE D1 · RELIEF APRON
          </text>

          {/* Dynamic radial thermal heat blobs */}
          {zones.map((z) => {
            const cx = (z.xPercent / 100) * 800;
            const cy = (z.yPercent / 100) * 420;
            const radius = 58 + Math.min(80, z.densityPerSqm * 16);
            return (
              <circle
                key={`blob-${z.id}`}
                cx={cx}
                cy={cy}
                r={radius}
                fill={`url(#heat-${z.id})`}
              />
            );
          })}
        </svg>

        {/* Interactive Camera Markers */}
        {zones.map((zone) => {
          const colors = getHeatColors(zone.densityLevel);
          const isSelected = zone.id === selectedZone.id;
          return (
            <button
              key={zone.id}
              type="button"
              onClick={() => onSelectZone(zone.id)}
              style={{
                left: `${zone.xPercent}%`,
                top: `${zone.yPercent}%`,
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg p-1 transition-transform ${
                isSelected ? 'scale-105 z-20' : 'z-10 hover:scale-105'
              }`}
            >
              <div
                className={`px-2.5 py-1.5 rounded-lg border text-left transition-colors ${
                  isSelected
                    ? 'bg-[#0F172A] border-blue-400 shadow-lg'
                    : 'bg-[#0B1120]/90 border-slate-700/80 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-300 whitespace-nowrap">
                  <Camera className="w-3 h-3 text-blue-400 shrink-0" />
                  <span>{zone.cameraLabel}</span>
                  <span className={`font-semibold ${colors.text}`}>
                    {zone.densityPerSqm.toFixed(1)} p/m²
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 truncate max-w-[140px]">
                  {zone.name}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Zone Telemetry Bar */}
      <div className="px-5 py-3.5 border-t border-slate-800/80 bg-[#0A101D] flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-5 text-xs">
          <div>
            <span className="text-slate-400">Selected Sector: </span>
            <span className="font-semibold text-white">{selectedZone.name}</span>
          </div>
          <div className="font-mono text-slate-300">
            Count: <span className="text-white font-semibold">{selectedZone.peopleCount}</span>
          </div>
          <div className="font-mono text-slate-300">
            Flow Speed: <span className="text-blue-400 font-semibold">{selectedZone.flowSpeedMps.toFixed(2)} m/s</span>
          </div>
          <div className="font-mono text-slate-300">
            Danger Score:{' '}
            <span
              className={`font-semibold ${
                selectedZone.dangerScore >= 70
                  ? 'text-red-400'
                  : selectedZone.dangerScore >= 45
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {selectedZone.dangerScore}/100
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onInspectInCCTV}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 border border-blue-500/30 transition-colors whitespace-nowrap"
        >
          Inspect in CCTV Monitor
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
