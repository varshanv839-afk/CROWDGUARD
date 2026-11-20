import React, { useMemo, useState } from 'react';
import { Play, Sliders, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { SimulationScenarioId } from '../types/crowguard';
import {
  SIMULATION_SCENARIOS,
  computeDigitalTwinSimulation,
} from '../lib/crowdAnalytics';

interface SimulationLabViewProps {
  onApplySimulation: (params: {
    scenarioId: SimulationScenarioId;
    title: string;
    location: string;
    peopleCount: number;
    densityPerSqm: number;
    flowSpeedMps: number;
    turbulence: number;
    dangerScore: number;
  }) => void;
  onRunOpenCVOnSample: (scenario: SimulationScenarioId) => Promise<void>;
  analyzingOpenCV: boolean;
}

export const SimulationLabView: React.FC<SimulationLabViewProps> = ({
  onApplySimulation,
  onRunOpenCVOnSample,
  analyzingOpenCV,
}) => {
  const [selectedScenario, setSelectedScenario] = useState<SimulationScenarioId>('stadium_bottleneck');
  const [crowdSize, setCrowdSize] = useState(290);
  const [inflowRate, setInflowRate] = useState(135);
  const [exitCapacityPct, setExitCapacityPct] = useState(32);
  const [turbulencePct, setTurbulencePct] = useState(38);

  // Digital Twin Intervention Controls
  const [reliefGateOpen, setReliefGateOpen] = useState(true);
  const [inflowMeteringPct, setInflowMeteringPct] = useState(30);
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);

  const selectPreset = (id: SimulationScenarioId) => {
    const preset = SIMULATION_SCENARIOS.find((s) => s.id === id);
    if (!preset) return;
    setSelectedScenario(id);
    setCrowdSize(preset.defaultCrowdSize);
    setInflowRate(preset.defaultInflow);
    setExitCapacityPct(preset.defaultAperture);
    setTurbulencePct(preset.defaultTurbulence);
    setAppliedNotice(null);
  };

  const twin = useMemo(
    () =>
      computeDigitalTwinSimulation({
        crowdSize,
        inflowRate,
        exitCapacityPct,
        turbulencePct,
        reliefGateOpen,
        inflowMeteringPct,
      }),
    [crowdSize, inflowRate, exitCapacityPct, turbulencePct, reliefGateOpen, inflowMeteringPct]
  );

  const activePreset = SIMULATION_SCENARIOS.find((s) => s.id === selectedScenario)!;

  const comparisonChartData = [
    {
      metric: 'Danger Score',
      Before: twin.before.dangerScore,
      After: twin.after.dangerScore,
    },
    {
      metric: 'Density (×10)',
      Before: Number((twin.before.densityPerSqm * 10).toFixed(1)),
      After: Number((twin.after.densityPerSqm * 10).toFixed(1)),
    },
    {
      metric: 'Clearance (min×4)',
      Before: Number((twin.before.clearanceMinutes * 4).toFixed(1)),
      After: Number((twin.after.clearanceMinutes * 4).toFixed(1)),
    },
  ];

  const handleApplyState = (usePostIntervention: boolean) => {
    const target = usePostIntervention ? twin.after : twin.before;
    onApplySimulation({
      scenarioId: selectedScenario,
      title: `${activePreset.title} (${usePostIntervention ? 'Post-Intervention' : 'Unmitigated'})`,
      location: activePreset.location,
      peopleCount: target.peopleCount,
      densityPerSqm: target.densityPerSqm,
      flowSpeedMps: target.flowSpeedMps,
      turbulence: turbulencePct / 100,
      dangerScore: target.dangerScore,
    });
    setAppliedNotice(
      `Applied ${usePostIntervention ? 'Post-Intervention' : 'Baseline Unmitigated'} Digital Twin state to Dashboard.`
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#0D1424] border border-slate-800/80 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Digital Twin Scenarios &amp; Sample CCTV Runner</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulate crowd size, entrance flow, and exit capacity; compare unmitigated risk vs. gate &amp; metering interventions (Simulated Prediction Data)
            </p>
          </div>
          <button
            type="button"
            disabled={analyzingOpenCV}
            onClick={() => onRunOpenCVOnSample(selectedScenario)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-medium transition-colors whitespace-nowrap"
          >
            {analyzingOpenCV ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Running OpenCV on Sample MP4...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Run Real OpenCV on Scenario Video
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {SIMULATION_SCENARIOS.map((sc) => {
            const isSelected = sc.id === selectedScenario;
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => selectPreset(sc.id)}
                className={`p-4 rounded-xl border text-left transition-colors ${
                  isSelected
                    ? 'bg-blue-600/15 border-blue-500/50'
                    : 'bg-[#0A101D] border-slate-800 hover:border-slate-700'
                }`}
              >
                <p className="text-sm font-semibold text-white">{sc.title}</p>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{sc.subtitle}</p>
                <p className="text-[11px] font-mono text-blue-400 mt-2">{sc.location}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliders + Before/After Digital Twin Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-[#0D1424] border border-slate-800/80 rounded-xl p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Digital Twin Parameters &amp; Interventions</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Total Crowd Size</span>
                <span className="font-mono text-white font-semibold">{crowdSize} people</span>
              </div>
              <input
                type="range"
                min={50}
                max={600}
                step={10}
                value={crowdSize}
                onChange={(e) => setCrowdSize(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Entrance Inflow Rate</span>
                <span className="font-mono text-white font-semibold">{inflowRate} pax/min</span>
              </div>
              <input
                type="range"
                min={20}
                max={200}
                value={inflowRate}
                onChange={(e) => setInflowRate(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Baseline Exit Capacity</span>
                <span className="font-mono text-white font-semibold">{exitCapacityPct}% open</span>
              </div>
              <input
                type="range"
                min={15}
                max={100}
                value={exitCapacityPct}
                onChange={(e) => setExitCapacityPct(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Counterflow Turbulence</span>
                <span className="font-mono text-white font-semibold">{turbulencePct}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={95}
                value={turbulencePct}
                onChange={(e) => setTurbulencePct(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 space-y-3">
            <p className="text-xs font-semibold text-blue-300">Operator Intervention Controls</p>
            <label className="flex items-center justify-between text-xs text-slate-200 cursor-pointer">
              <span>Open Relief Exit D1 (+38% egress perimeter)</span>
              <input
                type="checkbox"
                checked={reliefGateOpen}
                onChange={(e) => setReliefGateOpen(e.target.checked)}
                className="accent-blue-500 w-4 h-4"
              />
            </label>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Upstream Entrance Metering Reduction</span>
                <span className="font-mono text-emerald-400 font-semibold">-{inflowMeteringPct}% inflow</span>
              </div>
              <input
                type="range"
                min={0}
                max={60}
                step={5}
                value={inflowMeteringPct}
                onChange={(e) => setInflowMeteringPct(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleApplyState(false)}
              className="px-3.5 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 text-xs font-medium transition-colors"
            >
              Inject Baseline Risk
            </button>
            <button
              type="button"
              onClick={() => handleApplyState(true)}
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
            >
              Inject Post-Intervention State
            </button>
          </div>
          {appliedNotice && (
            <p className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {appliedNotice}
            </p>
          )}
        </div>

        <div className="lg:col-span-7 bg-[#0D1424] border border-slate-800/80 rounded-xl p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-white">Before vs. After Intervention Comparison</h3>
              <p className="text-xs text-slate-400">Simulated Digital Twin impact summary</p>
            </div>
            <span className="text-xs font-mono font-semibold text-emerald-400">
              Risk Reduced by {twin.riskReductionPct}% (-{twin.densityReduction.toFixed(2)} p/m²)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#0A101D] border border-red-500/30 rounded-xl p-4 space-y-2">
              <p className="text-xs font-mono text-red-400 font-semibold">BEFORE INTERVENTION</p>
              <p className="text-3xl font-mono font-bold text-white">
                {twin.before.dangerScore}
                <span className="text-sm font-normal text-slate-400">/100</span>
              </p>
              <div className="text-xs font-mono text-slate-300 space-y-1">
                <p>Risk Level: {twin.before.dangerLevel}</p>
                <p>Peak Density: {twin.before.densityPerSqm.toFixed(2)} p/m²</p>
                <p>Flow Speed: {twin.before.flowSpeedMps.toFixed(2)} m/s</p>
                <p>Est. Clearance: {twin.before.clearanceMinutes} min</p>
              </div>
            </div>

            <div className="bg-[#0A101D] border border-emerald-500/30 rounded-xl p-4 space-y-2">
              <p className="text-xs font-mono text-emerald-400 font-semibold flex items-center gap-1.5">
                AFTER INTERVENTION <ArrowRight className="w-3.5 h-3.5" />
              </p>
              <p className="text-3xl font-mono font-bold text-white">
                {twin.after.dangerScore}
                <span className="text-sm font-normal text-slate-400">/100</span>
              </p>
              <div className="text-xs font-mono text-slate-300 space-y-1">
                <p>Risk Level: {twin.after.dangerLevel}</p>
                <p>Peak Density: {twin.after.densityPerSqm.toFixed(2)} p/m²</p>
                <p>Flow Speed: {twin.after.flowSpeedMps.toFixed(2)} m/s</p>
                <p>Est. Clearance: {twin.after.clearanceMinutes} min</p>
              </div>
            </div>
          </div>

          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonChartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="metric" stroke="#64748B" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748B" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0A101D',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#F1F5F9',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Before" name="Before Intervention" fill="#EF4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="After" name="After Intervention" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
