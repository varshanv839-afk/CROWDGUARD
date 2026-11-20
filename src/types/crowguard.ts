export type DensityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SafetyStatus = 'SAFE' | 'ELEVATED' | 'HIGH_RISK' | 'CRITICAL';
export type DangerLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertStatus = 'new' | 'acknowledged' | 'responding' | 'resolved';
export type GateActionType = 'OPEN_RELIEF' | 'RESTRICT_ENTRY' | 'REDIRECT_FLOW' | 'HOLD_CURRENT';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type SimulationScenarioId =
  | 'normal_plaza'
  | 'stadium_bottleneck'
  | 'sudden_shockwave'
  | 'counterflow_surge';

export type UserRole = 'admin' | 'operator';
export type AccountStatus = 'active' | 'inactive';

export type ActivityActionType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'REGISTER'
  | 'PROFILE_UPDATE'
  | 'PASSWORD_CHANGE'
  | 'ROLE_CHANGE'
  | 'STATUS_CHANGE'
  | 'INCIDENT_REPORT'
  | 'CCTV_ANALYSIS'
  | 'USER_CREATED';

export interface UserAccountRecord {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  role: UserRole;
  status: AccountStatus;
  emailVerified: boolean;
  createdAtLabel: string;
  lastLoginAtLabel: string;
  updatedAtLabel: string;
}

export interface ActivityLogRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  actionType: ActivityActionType;
  details: string;
  createdAtLabel: string;
}

export type NavSection =
  | 'overview'
  | 'cctv'
  | 'analytics'
  | 'evacuation'
  | 'alerts'
  | 'simulation'
  | 'profile'
  | 'admin'
  | 'setup';

export interface BoundingBoxDetection {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  confidence: number;
}

export interface RegionDensityCell {
  id: string;
  row: number;
  col: number;
  count: number;
  densityPerSqm: number;
  level: DensityLevel;
  speedMps?: number;
  turbulence?: number;
}

export interface SuspiciousRegion {
  id: string;
  row: number;
  col: number;
  reason: 'SUDDEN_STOPPING' | 'UNUSUAL_DIRECTION' | 'RAPID_CROWD_SURGE' | string;
  severity: 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
}

export interface BottleneckRegion {
  id: string;
  row: number;
  col: number;
  type: 'CONGESTED_ENTRANCE' | 'NARROW_PASSAGE' | 'BLOCKED_EXIT' | 'CONGESTED_EXIT' | string;
  densityPerSqm: number;
  speedMps: number;
}

export interface FlowVector {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mag: number;
}

export interface OpticalFlowData {
  avgSpeedPx: number;
  speedMps: number;
  dominantAngleDeg: number;
  directionalVariance: number;
  vectors: FlowVector[];
}

export interface AnalyzedFrame {
  frameIndex: number;
  timestampSec: number;
  peopleCount: number;
  detections: BoundingBoxDetection[];
  regions: RegionDensityCell[];
  suspiciousRegions?: SuspiciousRegion[];
  bottleneckRegions?: BottleneckRegion[];
  peakDensityPerSqm: number;
  avgDensityPerSqm: number;
  densityLevel: DensityLevel;
  opticalFlow: OpticalFlowData;
  anomalies: string[];
  dangerScore: number;
  safetyStatus: SafetyStatus;
  rawFrameUrl: string;
  heatmapFrameUrl: string;
}

export interface OpenCVAnalysisResult {
  engine: string;
  opencvVersion: string;
  analysisSource: 'real_opencv_video';
  totalVideoFrames: number;
  sampledFrames: number;
  fps: number;
  durationSec: number;
  width: number;
  height: number;
  fileName?: string;
  scenario?: SimulationScenarioId;
  videoUrl?: string;
  summary: {
    maxPeopleDetected: number;
    avgPeopleDetected: number;
    peakDensityPerSqm: number;
    densityLevel: DensityLevel;
    peakDangerScore: number;
    safetyStatus: SafetyStatus;
    movementPattern: string;
    anomalyFlags: string[];
    bottleneckRegions?: BottleneckRegion[];
  };
  frames: AnalyzedFrame[];
}

export interface CameraFeedItem {
  id: string;
  cameraLabel: string;
  zoneName: string;
  sourceLabel: string;
  videoUrl: string | null;
  analysis: OpenCVAnalysisResult;
  addedAtLabel: string;
}

export interface ZoneTelemetry {
  id: string;
  name: string;
  cameraLabel: string;
  xPercent: number;
  yPercent: number;
  peopleCount: number;
  densityPerSqm: number;
  densityLevel: DensityLevel;
  flowSpeedMps: number;
  dangerScore: number;
  connectedGate: string;
  nodeType?: 'entrance' | 'junction' | 'exit';
}

export interface EvacuationPathSegment {
  id: string;
  fromZoneId: string;
  toZoneId: string;
  fromLabel: string;
  toLabel: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  status: 'clear' | 'congested' | 'blocked';
  densityPerSqm: number;
}

export interface EvacuationRecommendation {
  id: string;
  congestedZone: string;
  blockedRoute: string;
  recommendedExit: string;
  pathWaypoints: string[];
  estimatedDensityDropPct: number;
  reason: string;
}

export interface HistorySample {
  label: string;
  minuteOffset: number;
  peopleCount: number;
  densityPerSqm: number;
  flowSpeedMps: number;
  turbulence: number;
  dangerScore: number;
  isPrediction?: boolean;
  confidenceLow?: number;
  confidenceHigh?: number;
}

export interface DangerPredictionSummary {
  hasSufficientHistory: boolean;
  historyCount: number;
  requiredHistory: number;
  projectedDanger5m: number;
  projectedDanger10m: number;
  projectedDensity5m: number;
  projectedDensity10m: number;
  projectedRiskLevel: DangerLevel;
  explanation: string;
  factors: {
    densityContribution: number;
    stoppageContribution: number;
    turbulenceContribution: number;
    congestionContribution: number;
  };
  forecastSeries: HistorySample[];
  disclaimer: string;
}

export interface MonitoringSessionRecord {
  id: string;
  ownerId: string;
  title: string;
  sourceType: 'uploaded_video' | 'simulation_sample' | 'manual_report';
  analysisMode: 'real_opencv' | 'simulated_scenario' | 'operator_report';
  totalPeopleDetected: number;
  peakDensity: number;
  dangerScore: number;
  safetyStatus: SafetyStatus;
  movementPattern: string;
  anomalyFlags: string[];
  createdAtLabel: string;
  persistedToFirestore: boolean;
}

export interface CrowdAlertRecord {
  id: string;
  ownerId: string;
  sessionId: string;
  location: string;
  zoneName: string;
  densityLevel: DensityLevel;
  peoplePerSqm: number;
  dangerScore: number;
  dangerLevel: DangerLevel;
  status: AlertStatus;
  assignedTeam: string;
  actionHistory: string[];
  suggestedAction: string;
  sourceKind: 'real_video_analysis' | 'simulated_prediction' | 'operator_manual_report';
  createdAtLabel: string;
  persistedToFirestore: boolean;
}

export interface GateRecommendationRecord {
  id: string;
  ownerId: string;
  alertId: string;
  gateName: string;
  recommendedAction: GateActionType;
  reason: string;
  projectedDensityDrop: number;
  approvalStatus: ApprovalStatus;
  reviewedBy: string;
  createdAtLabel: string;
  persistedToFirestore: boolean;
}

export interface NotificationRecord {
  id: string;
  ownerId: string;
  title: string;
  message: string;
  severity: DangerLevel;
  zoneName: string;
  read: boolean;
  sourceKind: 'real_video_analysis' | 'simulated_prediction' | 'system_action';
  createdAtLabel: string;
  persistedToFirestore: boolean;
}

export interface DigitalTwinComparison {
  before: {
    peopleCount: number;
    densityPerSqm: number;
    flowSpeedMps: number;
    dangerScore: number;
    dangerLevel: DangerLevel;
    clearanceMinutes: number;
  };
  after: {
    peopleCount: number;
    densityPerSqm: number;
    flowSpeedMps: number;
    dangerScore: number;
    dangerLevel: DangerLevel;
    clearanceMinutes: number;
  };
  riskReductionPct: number;
  densityReduction: number;
}
