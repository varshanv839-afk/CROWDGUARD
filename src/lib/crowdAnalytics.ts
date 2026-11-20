import type {
  CrowdAlertRecord,
  DangerLevel,
  DangerPredictionSummary,
  DensityLevel,
  DigitalTwinComparison,
  EvacuationPathSegment,
  EvacuationRecommendation,
  GateRecommendationRecord,
  HistorySample,
  NotificationRecord,
  OpenCVAnalysisResult,
  SafetyStatus,
  SimulationScenarioId,
  ZoneTelemetry,
} from '../types/crowguard';

export const SECURITY_TEAMS = [
  'Unassigned',
  'Alpha Medical Unit',
  'Bravo Gate Marshals',
  'Charlie Perimeter Control',
  'Delta Evacuation Squad',
] as const;

export const SIMULATION_SCENARIOS: {
  id: SimulationScenarioId;
  title: string;
  subtitle: string;
  location: string;
  defaultCrowdSize: number;
  defaultInflow: number;
  defaultAperture: number;
  defaultTurbulence: number;
}[] = [
  {
    id: 'normal_plaza',
    title: 'Normal Concourse Flow',
    subtitle: 'Balanced bidirectional movement with open relief gates and low compression.',
    location: 'North Concourse A1',
    defaultCrowdSize: 95,
    defaultInflow: 45,
    defaultAperture: 85,
    defaultTurbulence: 14,
  },
  {
    id: 'stadium_bottleneck',
    title: 'Stadium Exit Bottleneck',
    subtitle: 'Heavy egress funneling into restricted Gate B2 causing progressive density climb.',
    location: 'South Gate B2 Funnel',
    defaultCrowdSize: 290,
    defaultInflow: 135,
    defaultAperture: 32,
    defaultTurbulence: 38,
  },
  {
    id: 'sudden_shockwave',
    title: 'Sudden Stoppage Shockwave',
    subtitle: 'Fast-moving corridor stream halts abruptly, triggering rear-compression spikes.',
    location: 'Transit Tunnel N4',
    defaultCrowdSize: 250,
    defaultInflow: 118,
    defaultAperture: 44,
    defaultTurbulence: 54,
  },
  {
    id: 'counterflow_surge',
    title: 'Opposing Counterflow Surge',
    subtitle: 'Two dense pedestrian streams collide at central plaza, elevating Optical Flow turbulence.',
    location: 'Central Plaza Crossway',
    defaultCrowdSize: 320,
    defaultInflow: 142,
    defaultAperture: 48,
    defaultTurbulence: 78,
  },
];

export function classifyDensityLevel(density: number): DensityLevel {
  if (density >= 4.5) return 'CRITICAL';
  if (density >= 3.0) return 'HIGH';
  if (density >= 1.5) return 'MEDIUM';
  return 'LOW';
}

export function classifyDangerLevel(score: number): DangerLevel {
  if (score >= 75) return 'CRITICAL';
  if (score >= 55) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}

export function classifySafetyStatus(score: number): SafetyStatus {
  if (score >= 75) return 'CRITICAL';
  if (score >= 55) return 'HIGH_RISK';
  if (score >= 30) return 'ELEVATED';
  return 'SAFE';
}

export const INITIAL_ZONES: ZoneTelemetry[] = [
  {
    id: 'zone-a1',
    name: 'North Concourse A1',
    cameraLabel: 'CAM-01',
    xPercent: 20,
    yPercent: 26,
    peopleCount: 28,
    densityPerSqm: 1.4,
    densityLevel: 'LOW',
    flowSpeedMps: 1.24,
    dangerScore: 19,
    connectedGate: 'Entrance Gate A1',
    nodeType: 'entrance',
  },
  {
    id: 'zone-b2',
    name: 'South Gate B2 Funnel',
    cameraLabel: 'CAM-02',
    xPercent: 72,
    yPercent: 28,
    peopleCount: 74,
    densityPerSqm: 4.1,
    densityLevel: 'HIGH',
    flowSpeedMps: 0.42,
    dangerScore: 66,
    connectedGate: 'Exit Gate B2',
    nodeType: 'exit',
  },
  {
    id: 'zone-c1',
    name: 'Central Plaza Crossway',
    cameraLabel: 'CAM-03',
    xPercent: 48,
    yPercent: 52,
    peopleCount: 86,
    densityPerSqm: 4.7,
    densityLevel: 'CRITICAL',
    flowSpeedMps: 0.28,
    dangerScore: 79,
    connectedGate: 'Gate C1',
    nodeType: 'junction',
  },
  {
    id: 'zone-n4',
    name: 'Transit Tunnel N4',
    cameraLabel: 'CAM-04',
    xPercent: 22,
    yPercent: 74,
    peopleCount: 51,
    densityPerSqm: 2.8,
    densityLevel: 'MEDIUM',
    flowSpeedMps: 0.85,
    dangerScore: 44,
    connectedGate: 'Exit Tunnel N4',
    nodeType: 'exit',
  },
  {
    id: 'zone-d1',
    name: 'East Relief Apron D1',
    cameraLabel: 'CAM-05',
    xPercent: 80,
    yPercent: 74,
    peopleCount: 19,
    densityPerSqm: 0.9,
    densityLevel: 'LOW',
    flowSpeedMps: 1.38,
    dangerScore: 14,
    connectedGate: 'Relief Exit D1',
    nodeType: 'exit',
  },
];

export const INITIAL_HISTORY: HistorySample[] = [
  { label: '-14m', minuteOffset: -14, peopleCount: 142, densityPerSqm: 1.8, flowSpeedMps: 1.22, turbulence: 0.18, dangerScore: 24 },
  { label: '-12m', minuteOffset: -12, peopleCount: 164, densityPerSqm: 2.1, flowSpeedMps: 1.15, turbulence: 0.22, dangerScore: 29 },
  { label: '-10m', minuteOffset: -10, peopleCount: 189, densityPerSqm: 2.6, flowSpeedMps: 0.96, turbulence: 0.29, dangerScore: 38 },
  { label: '-8m', minuteOffset: -8, peopleCount: 215, densityPerSqm: 3.1, flowSpeedMps: 0.78, turbulence: 0.36, dangerScore: 49 },
  { label: '-6m', minuteOffset: -6, peopleCount: 234, densityPerSqm: 3.7, flowSpeedMps: 0.59, turbulence: 0.44, dangerScore: 61 },
  { label: '-4m', minuteOffset: -4, peopleCount: 248, densityPerSqm: 4.2, flowSpeedMps: 0.44, turbulence: 0.51, dangerScore: 69 },
  { label: '-2m', minuteOffset: -2, peopleCount: 256, densityPerSqm: 4.5, flowSpeedMps: 0.34, turbulence: 0.57, dangerScore: 76 },
  { label: 'Now', minuteOffset: 0, peopleCount: 258, densityPerSqm: 4.7, flowSpeedMps: 0.28, turbulence: 0.61, dangerScore: 79 },
];

export const INITIAL_ALERTS: CrowdAlertRecord[] = [
  {
    id: 'sim_alert_central_c1',
    ownerId: 'local_preview',
    sessionId: 'sim_session_initial',
    location: 'Central Plaza Crossway (CAM-03)',
    zoneName: 'Central Plaza Crossway',
    densityLevel: 'CRITICAL',
    peoplePerSqm: 4.7,
    dangerScore: 79,
    dangerLevel: 'CRITICAL',
    status: 'new',
    assignedTeam: 'Bravo Gate Marshals',
    actionHistory: [
      '[Baseline] Critical density 4.7 p/m² detected in Central Plaza Crossway',
      '[Baseline] Recommended Relief Exit D1 diversion for operator review',
    ],
    suggestedAction: 'Open East Relief Apron D1 and pause westbound entry at Gate C1 until density drops below 3.2 p/m².',
    sourceKind: 'simulated_prediction',
    createdAtLabel: 'Sample Baseline',
    persistedToFirestore: false,
  },
  {
    id: 'sim_alert_gate_b2',
    ownerId: 'local_preview',
    sessionId: 'sim_session_initial',
    location: 'South Gate B2 Funnel (CAM-02)',
    zoneName: 'South Gate B2 Funnel',
    densityLevel: 'HIGH',
    peoplePerSqm: 4.1,
    dangerScore: 66,
    dangerLevel: 'HIGH',
    status: 'acknowledged',
    assignedTeam: 'Delta Evacuation Squad',
    actionHistory: [
      '[Baseline] Funnel compression reached 4.1 p/m² at South Gate B2',
      '[Baseline] Acknowledged by duty supervisor; Delta Evacuation Squad notified',
    ],
    suggestedAction: 'Deploy crowd marshals to widen Gate B2 egress lanes and redirect trailing arrivals toward Relief Exit D1.',
    sourceKind: 'simulated_prediction',
    createdAtLabel: 'Sample Baseline',
    persistedToFirestore: false,
  },
];

export const INITIAL_GATE_RECOMMENDATIONS: GateRecommendationRecord[] = [
  {
    id: 'sim_gate_d1_open',
    ownerId: 'local_preview',
    alertId: 'sim_alert_central_c1',
    gateName: 'Gate D1 (East Relief Apron)',
    recommendedAction: 'OPEN_RELIEF',
    reason: 'Zone D1 operates at 0.9 p/m²; opening relief perimeter absorbs overflow from Central Plaza C1.',
    projectedDensityDrop: 28,
    approvalStatus: 'pending',
    reviewedBy: '',
    createdAtLabel: 'Sample Baseline',
    persistedToFirestore: false,
  },
  {
    id: 'sim_gate_c1_restrict',
    ownerId: 'local_preview',
    alertId: 'sim_alert_central_c1',
    gateName: 'Gate C1 (Central West Entry)',
    recommendedAction: 'RESTRICT_ENTRY',
    reason: 'Inflow exceeds egress throughput while Optical Flow speed dropped to 0.28 m/s.',
    projectedDensityDrop: 22,
    approvalStatus: 'pending',
    reviewedBy: '',
    createdAtLabel: 'Sample Baseline',
    persistedToFirestore: false,
  },
  {
    id: 'sim_gate_b2_redirect',
    ownerId: 'local_preview',
    alertId: 'sim_alert_gate_b2',
    gateName: 'Gate B2 (South Funnel)',
    recommendedAction: 'REDIRECT_FLOW',
    reason: 'Funnel compression at 4.1 p/m²; divert outer concourse stream toward East Relief D1.',
    projectedDensityDrop: 18,
    approvalStatus: 'pending',
    reviewedBy: '',
    createdAtLabel: 'Sample Baseline',
    persistedToFirestore: false,
  },
];

export const INITIAL_NOTIFICATIONS: NotificationRecord[] = [
  {
    id: 'notif_baseline_1',
    ownerId: 'local_preview',
    title: 'Critical Density in Central Plaza Crossway',
    message: 'Simulated baseline exceeded 4.5 p/m² (Danger Score 79/100). Relief Exit D1 recommended.',
    severity: 'CRITICAL',
    zoneName: 'Central Plaza Crossway',
    read: false,
    sourceKind: 'simulated_prediction',
    createdAtLabel: 'Sample Baseline',
    persistedToFirestore: false,
  },
  {
    id: 'notif_baseline_2',
    ownerId: 'local_preview',
    title: 'South Gate B2 Funnel Congestion',
    message: 'High density (4.1 p/m²) with slowed Optical Flow (0.42 m/s) detected on CAM-02.',
    severity: 'HIGH',
    zoneName: 'South Gate B2 Funnel',
    read: false,
    sourceKind: 'simulated_prediction',
    createdAtLabel: 'Sample Baseline',
    persistedToFirestore: false,
  },
];

export function computeDangerPrediction(
  history: HistorySample[],
  bottleneckCount = 2
): DangerPredictionSummary {
  const requiredHistory = 6;
  const latest = history[history.length - 1] ?? {
    label: 'Now',
    minuteOffset: 0,
    peopleCount: 0,
    densityPerSqm: 0,
    flowSpeedMps: 1.2,
    turbulence: 0.1,
    dangerScore: 10,
  };

  const densityContribution = Math.round(Math.min(40, (latest.densityPerSqm / 5.5) * 40));
  const stoppageContribution = Math.round(
    Math.min(
      25,
      (latest.densityPerSqm >= 1.5 ? Math.max(0, 1 - latest.flowSpeedMps / 1.1) : 0.15) *
        25 *
        Math.min(1, latest.densityPerSqm / 3.5)
    )
  );
  const turbulenceContribution = Math.round(Math.min(20, latest.turbulence * 20));
  const congestionContribution = Math.round(Math.min(15, bottleneckCount * 4.5));

  if (history.length < requiredHistory) {
    return {
      hasSufficientHistory: false,
      historyCount: history.length,
      requiredHistory,
      projectedDanger5m: latest.dangerScore,
      projectedDanger10m: latest.dangerScore,
      projectedDensity5m: latest.densityPerSqm,
      projectedDensity10m: latest.densityPerSqm,
      projectedRiskLevel: classifyDangerLevel(latest.dangerScore),
      explanation: `Insufficient temporal history (${history.length}/${requiredHistory} intervals). Collect at least ${requiredHistory} sequential snapshots before projecting a 5–10 minute trajectory.`,
      factors: {
        densityContribution,
        stoppageContribution,
        turbulenceContribution,
        congestionContribution,
      },
      forecastSeries: history,
      disclaimer:
        'Prototype momentum extrapolation only — not a validated real-world crowd safety forecast.',
    };
  }

  const window = history.slice(-6);
  const n = window.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let sumD = 0;
  let sumXD = 0;

  window.forEach((pt, idx) => {
    sumX += idx;
    sumY += pt.dangerScore;
    sumXY += idx * pt.dangerScore;
    sumXX += idx * idx;
    sumD += pt.densityPerSqm;
    sumXD += idx * pt.densityPerSqm;
  });

  const denom = Math.max(1e-6, n * sumXX - sumX * sumX);
  const slopeDangerPerStep = (n * sumXY - sumX * sumY) / denom;
  const slopeDensityPerStep = (n * sumXD - sumX * sumD) / denom;

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const stepPoints = [
    { label: '+2m', min: 2, mult: 0.9 },
    { label: '+4m', min: 4, mult: 1.7 },
    { label: '+6m', min: 6, mult: 2.35 },
    { label: '+8m', min: 8, mult: 2.9 },
    { label: '+10m', min: 10, mult: 3.35 },
  ];

  const predictedSamples: HistorySample[] = stepPoints.map((step, i) => {
    const projDanger = Number(clamp(latest.dangerScore + slopeDangerPerStep * step.mult, 5, 99).toFixed(1));
    const projDensity = Number(clamp(latest.densityPerSqm + slopeDensityPerStep * step.mult, 0.2, 8.5).toFixed(2));
    const spread = 4 + i * 2.4;
    return {
      label: step.label,
      minuteOffset: step.min,
      peopleCount: Math.round(latest.peopleCount * (projDensity / Math.max(0.2, latest.densityPerSqm))),
      densityPerSqm: projDensity,
      flowSpeedMps: Number(clamp(latest.flowSpeedMps - slopeDensityPerStep * 0.12 * (i + 1), 0.1, 2.2).toFixed(2)),
      turbulence: latest.turbulence,
      dangerScore: projDanger,
      isPrediction: true,
      confidenceLow: Number(clamp(projDanger - spread, 0, 100).toFixed(1)),
      confidenceHigh: Number(clamp(projDanger + spread, 0, 100).toFixed(1)),
    };
  });

  const proj5m = predictedSamples[1].dangerScore;
  const proj10m = predictedSamples[4].dangerScore;
  const projDensity5m = predictedSamples[1].densityPerSqm;
  const projDensity10m = predictedSamples[4].densityPerSqm;
  const trendDir =
    slopeDangerPerStep > 2.2
      ? 'accelerating upward'
      : slopeDangerPerStep < -2.0
      ? 'de-escalating'
      : 'holding steady';

  const explanation =
    slopeDangerPerStep > 2.2
      ? `Risk trajectory is ${trendDir} (+${slopeDensityPerStep.toFixed(2)} p/m² per interval) with Optical Flow speed at ${latest.flowSpeedMps.toFixed(2)} m/s and ${bottleneckCount} bottleneck sector(s). Without relief intervention, score is projected to reach ${proj10m.toFixed(0)}/100 within 10 minutes.`
      : slopeDangerPerStep < -2.0
      ? `Crowd pressure is ${trendDir} as egress clears (${latest.flowSpeedMps.toFixed(2)} m/s). Projected score eases toward ${proj10m.toFixed(0)}/100 over the next 10 minutes.`
      : `Crowd conditions are ${trendDir} near ${latest.densityPerSqm.toFixed(1)} p/m² (${Math.round(latest.turbulence * 100)}% turbulence). Continue monitoring bottlenecks for sudden stoppage waves.`;

  return {
    hasSufficientHistory: true,
    historyCount: history.length,
    requiredHistory,
    projectedDanger5m: proj5m,
    projectedDanger10m: proj10m,
    projectedDensity5m: projDensity5m,
    projectedDensity10m: projDensity10m,
    projectedRiskLevel: classifyDangerLevel(Math.max(proj5m, proj10m)),
    explanation,
    factors: {
      densityContribution,
      stoppageContribution,
      turbulenceContribution,
      congestionContribution,
    },
    forecastSeries: [...history, ...predictedSamples],
    disclaimer:
      'Prototype statistical momentum extrapolation based on observed frames — not a validated real-world safety forecast.',
  };
}

export function computeEvacuationRoutes(zones: ZoneTelemetry[]): {
  segments: EvacuationPathSegment[];
  recommendations: EvacuationRecommendation[];
} {
  const byId = new Map(zones.map((z) => [z.id, z]));
  const pairs: [string, string][] = [
    ['zone-a1', 'zone-c1'],
    ['zone-c1', 'zone-b2'],
    ['zone-c1', 'zone-n4'],
    ['zone-c1', 'zone-d1'],
    ['zone-a1', 'zone-n4'],
    ['zone-b2', 'zone-d1'],
  ];

  const segments: EvacuationPathSegment[] = pairs.map(([fromId, toId], idx) => {
    const a = byId.get(fromId) || zones[0];
    const b = byId.get(toId) || zones[zones.length - 1];
    const maxDensity = Math.max(a.densityPerSqm, b.densityPerSqm);
    const minSpeed = Math.min(a.flowSpeedMps, b.flowSpeedMps);
    const status: EvacuationPathSegment['status'] =
      maxDensity >= 4.4 || minSpeed < 0.32
        ? 'blocked'
        : maxDensity >= 2.9 || minSpeed < 0.65
        ? 'congested'
        : 'clear';

    return {
      id: `seg_${idx + 1}`,
      fromZoneId: a.id,
      toZoneId: b.id,
      fromLabel: a.name,
      toLabel: b.name,
      x1: a.xPercent,
      y1: a.yPercent,
      x2: b.xPercent,
      y2: b.yPercent,
      status,
      densityPerSqm: Number(maxDensity.toFixed(2)),
    };
  });

  const exits = zones
    .filter((z) => z.nodeType === 'exit' || z.id === 'zone-d1' || z.id === 'zone-n4' || z.id === 'zone-b2')
    .sort((a, b) => a.dangerScore - b.dangerScore);
  const safestExit = exits[0] || zones[zones.length - 1];

  const congestedZones = zones.filter((z) => z.dangerScore >= 50 || z.densityPerSqm >= 3.0);
  const recommendations: EvacuationRecommendation[] = congestedZones.map((cz, i) => {
    const altExit = exits.find((e) => e.id !== cz.id) || safestExit;
    const dropPct = Math.min(48, Math.max(15, Math.round((cz.densityPerSqm - altExit.densityPerSqm) * 8 + 12)));
    return {
      id: `evac_rec_${i + 1}`,
      congestedZone: cz.name,
      blockedRoute: `${cz.name} → ${cz.connectedGate}`,
      recommendedExit: `${altExit.name} (${altExit.connectedGate})`,
      pathWaypoints: [cz.name, altExit.name, altExit.connectedGate],
      estimatedDensityDropPct: dropPct,
      reason: `${cz.name} sits at ${cz.densityPerSqm.toFixed(1)} p/m² (${cz.flowSpeedMps.toFixed(2)} m/s), whereas ${altExit.name} has spare capacity at ${altExit.densityPerSqm.toFixed(1)} p/m².`,
    };
  });

  return { segments, recommendations };
}

export function computeDigitalTwinSimulation(params: {
  crowdSize: number;
  inflowRate: number;
  exitCapacityPct: number;
  turbulencePct: number;
  reliefGateOpen: boolean;
  inflowMeteringPct: number;
}): DigitalTwinComparison {
  const effectiveAreaSqm = 56.0;
  const baselineExitFlow = Math.max(18, params.exitCapacityPct * 1.45);
  const baselineRatio = params.inflowRate / baselineExitFlow;
  const beforeDensity = Number(
    Math.min(8.2, Math.max(0.6, (params.crowdSize / effectiveAreaSqm) * 0.72 + baselineRatio * 0.85)).toFixed(2)
  );
  const beforeSpeed = Number(
    Math.max(0.12, Math.min(1.55, 1.45 - baselineRatio * 0.44 - (params.turbulencePct / 100) * 0.36)).toFixed(2)
  );

  const calcScore = (density: number, speed: number, turbPct: number) => {
    const dScore = Math.min(40, (density / 5.5) * 40);
    const sFactor = density >= 1.5 ? Math.max(0, 1 - speed / 1.1) : 0.15;
    const sScore = Math.min(25, sFactor * 25 * Math.min(1, density / 3.5));
    const tScore = Math.min(20, (turbPct / 100) * 20);
    const bScore = density >= 3.0 ? Math.min(15, (density - 2.2) * 4.5) : 0;
    return Number(Math.min(100, dScore + sScore + tScore + bScore).toFixed(1));
  };

  const beforeDanger = calcScore(beforeDensity, beforeSpeed, params.turbulencePct);
  const beforeClearance = Number(Math.max(2, params.crowdSize / Math.max(15, baselineExitFlow * 0.85)).toFixed(1));

  // Post-intervention: relief gate adds +38% exit throughput & +18 sqm dispersal; inflow metering curbs arrival rate
  const meteredInflow = params.inflowRate * (1 - params.inflowMeteringPct / 100);
  const boostedCapacity = baselineExitFlow + (params.reliefGateOpen ? 58 : 0);
  const expandedArea = effectiveAreaSqm + (params.reliefGateOpen ? 18 : 0);
  const afterRatio = meteredInflow / Math.max(20, boostedCapacity);
  const afterTurbPct = Math.max(8, params.turbulencePct * (params.reliefGateOpen ? 0.72 : 0.88));

  const afterDensity = Number(
    Math.min(8.0, Math.max(0.4, (params.crowdSize / expandedArea) * 0.62 + afterRatio * 0.68)).toFixed(2)
  );
  const afterSpeed = Number(
    Math.max(0.2, Math.min(1.65, 1.48 - afterRatio * 0.36 - (afterTurbPct / 100) * 0.25)).toFixed(2)
  );
  const afterDanger = calcScore(afterDensity, afterSpeed, afterTurbPct);
  const afterClearance = Number(Math.max(1.5, params.crowdSize / Math.max(20, boostedCapacity * 0.92)).toFixed(1));

  const riskReductionPct =
    beforeDanger > 0 ? Math.max(0, Math.round(((beforeDanger - afterDanger) / beforeDanger) * 100)) : 0;

  return {
    before: {
      peopleCount: params.crowdSize,
      densityPerSqm: beforeDensity,
      flowSpeedMps: beforeSpeed,
      dangerScore: beforeDanger,
      dangerLevel: classifyDangerLevel(beforeDanger),
      clearanceMinutes: beforeClearance,
    },
    after: {
      peopleCount: Math.round(params.crowdSize * (1 - params.inflowMeteringPct / 300)),
      densityPerSqm: afterDensity,
      flowSpeedMps: afterSpeed,
      dangerScore: afterDanger,
      dangerLevel: classifyDangerLevel(afterDanger),
      clearanceMinutes: afterClearance,
    },
    riskReductionPct,
    densityReduction: Number(Math.max(0, beforeDensity - afterDensity).toFixed(2)),
  };
}

export function deriveAlertsAndGatesFromOpenCV(
  analysis: OpenCVAnalysisResult,
  ownerId: string,
  sessionId: string
): {
  alerts: CrowdAlertRecord[];
  gates: GateRecommendationRecord[];
} {
  const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const frames = analysis.frames;
  const worstFrame = frames.reduce(
    (best, cur) => (cur.dangerScore > best.dangerScore ? cur : best),
    frames[0]
  );
  const hotspot = worstFrame.regions.reduce(
    (best, cur) => (cur.densityPerSqm > best.densityPerSqm ? cur : best),
    worstFrame.regions[0]
  );

  const alerts: CrowdAlertRecord[] = [];
  const gates: GateRecommendationRecord[] = [];
  const sourceLabel = analysis.fileName || analysis.scenario || 'CCTV Stream';

  if (analysis.summary.peakDangerScore >= 30 || analysis.summary.anomalyFlags.length > 0) {
    const alertId = `alert_${Date.now()}_1`;
    const isCritical = analysis.summary.peakDangerScore >= 70;
    const suggestedAction = analysis.summary.anomalyFlags.includes('SUDDEN_STOPPING')
      ? 'Halt upstream entry immediately and open nearest lateral relief gate to dissipate compression wave.'
      : analysis.summary.anomalyFlags.includes('IRREGULAR_MOVEMENT')
      ? 'Separate opposing pedestrian streams with temporary barriers and marshal counterflow lanes.'
      : analysis.summary.anomalyFlags.includes('RAPID_SURGE')
      ? 'Slow upstream concourse arrivals and open overflow exit corridors ahead of surge front.'
      : 'Open adjacent relief gate and meter incoming concourse flow until peak density drops below 3.0 p/m².';

    alerts.push({
      id: alertId,
      ownerId,
      sessionId,
      location: `${sourceLabel} (${hotspot?.id || 'R2-C2'})`,
      zoneName: `Sector ${hotspot?.id || 'R2-C2'}`,
      densityLevel: analysis.summary.densityLevel,
      peoplePerSqm: analysis.summary.peakDensityPerSqm,
      dangerScore: analysis.summary.peakDangerScore,
      dangerLevel: classifyDangerLevel(analysis.summary.peakDangerScore),
      status: 'new',
      assignedTeam: isCritical ? 'Delta Evacuation Squad' : 'Bravo Gate Marshals',
      actionHistory: [
        `[${ts}] OpenCV detected ${analysis.summary.maxPeopleDetected} pax, ${analysis.summary.peakDensityPerSqm.toFixed(1)} p/m² (${analysis.summary.movementPattern})`,
      ],
      suggestedAction,
      sourceKind: 'real_video_analysis',
      createdAtLabel: ts,
      persistedToFirestore: false,
    });

    gates.push({
      id: `gate_${Date.now()}_1`,
      ownerId,
      alertId,
      gateName: isCritical ? 'Relief Gate D1 (Overflow)' : 'Perimeter Gate B2',
      recommendedAction: isCritical ? 'OPEN_RELIEF' : 'REDIRECT_FLOW',
      reason: `OpenCV detected ${analysis.summary.maxPeopleDetected} people (${analysis.summary.peakDensityPerSqm.toFixed(1)} p/m²) with pattern "${analysis.summary.movementPattern}".`,
      projectedDensityDrop: isCritical ? 29 : 18,
      approvalStatus: 'pending',
      reviewedBy: '',
      createdAtLabel: ts,
      persistedToFirestore: false,
    });

    if (isCritical || analysis.summary.peakDensityPerSqm >= 4.0) {
      gates.push({
        id: `gate_${Date.now()}_2`,
        ownerId,
        alertId,
        gateName: 'Primary Entry Gate C1',
        recommendedAction: 'RESTRICT_ENTRY',
        reason: `Sector ${hotspot?.id || 'R2-C2'} reached ${analysis.summary.densityLevel} density; metering inflow prevents progressive crush build-up.`,
        projectedDensityDrop: 24,
        approvalStatus: 'pending',
        reviewedBy: '',
        createdAtLabel: ts,
        persistedToFirestore: false,
      });
    }
  }

  return { alerts, gates };
}
