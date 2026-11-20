import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  Menu,
  Users,
  Gauge,
  ShieldAlert,
  Activity,
  Upload,
  ArrowRight,
  DoorOpen,
  AlertTriangle,
  CheckCircle2,
  Bell,
  Volume2,
  VolumeX,
  Bot,
  FileDown,
  LogOut,
  Lock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthPortal } from './components/AuthPortal';
import { Sidebar } from './components/Sidebar';
import { VenueMapPanel } from './components/VenueMapPanel';
import { CCTVAnalyzerView } from './components/CCTVAnalyzerView';
import { DensityFlowView } from './components/DensityFlowView';
import { EvacuationPlannerView } from './components/EvacuationPlannerView';
import { AlertsGatesView } from './components/AlertsGatesView';
import { SimulationLabView } from './components/SimulationLabView';
import { AdminManagementView } from './components/AdminManagementView';
import { UserProfileView } from './components/UserProfileView';
import { SetupGuideView } from './components/SetupGuideView';
import { AISafetyAssistant } from './components/AISafetyAssistant';
import { NotificationCenter } from './components/NotificationCenter';
import {
  auth,
  createNotificationInFirestore,
  ensureAndLoadUserProfile,
  logUserActivity,
  markNotificationReadInFirestore,
  reviewGateRecommendationInFirestore,
  saveSessionAlertsAndGatesToFirestore,
  signOutOperator,
  subscribeActivityLogs,
  subscribeAllUsersForAdmin,
  subscribeOperatorData,
  testFirestoreConnection,
  updateIncidentInFirestore,
} from './lib/firebase';
import {
  INITIAL_ALERTS,
  INITIAL_GATE_RECOMMENDATIONS,
  INITIAL_HISTORY,
  INITIAL_NOTIFICATIONS,
  INITIAL_ZONES,
  classifyDangerLevel,
  classifyDensityLevel,
  classifySafetyStatus,
  computeDangerPrediction,
  computeEvacuationRoutes,
  deriveAlertsAndGatesFromOpenCV,
} from './lib/crowdAnalytics';
import { playAlertTone } from './lib/soundAlert';
import { exportIncidentPdfReport } from './lib/pdfReport';
import type {
  ActivityLogRecord,
  AlertStatus,
  CameraFeedItem,
  CrowdAlertRecord,
  DangerLevel,
  EvacuationRecommendation,
  GateRecommendationRecord,
  HistorySample,
  MonitoringSessionRecord,
  NavSection,
  NotificationRecord,
  OpenCVAnalysisResult,
  SimulationScenarioId,
  UserAccountRecord,
  ZoneTelemetry,
} from './types/crowguard';

function AppShell() {
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Assistant & Notification Drawers
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);

  // Firebase Auth, Role Profile & Admin State
  const [user, setUser] = useState<User | null>(null);
  const [currentProfile, setCurrentProfile] = useState<UserAccountRecord | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [adminUsers, setAdminUsers] = useState<UserAccountRecord[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogRecord[]>([]);
  const redirectedUidRef = useRef<string | null>(null);

  // Multi-Camera & Live Monitoring State
  const [zones, setZones] = useState<ZoneTelemetry[]>(INITIAL_ZONES);
  const [selectedZoneId, setSelectedZoneId] = useState<string>(INITIAL_ZONES[2].id);
  const [history, setHistory] = useState<HistorySample[]>(INITIAL_HISTORY);
  const [cameraFeeds, setCameraFeeds] = useState<CameraFeedItem[]>([]);
  const [activeFeedId, setActiveFeedId] = useState<string | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [savingSession, setSavingSession] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [monitoringActive, setMonitoringActive] = useState(true);

  // Local + Firestore-synced records
  const [localAlerts, setLocalAlerts] = useState<CrowdAlertRecord[]>(INITIAL_ALERTS);
  const [localGates, setLocalGates] = useState<GateRecommendationRecord[]>(INITIAL_GATE_RECOMMENDATIONS);
  const [localSessions, setLocalSessions] = useState<MonitoringSessionRecord[]>([]);
  const [localNotifications, setLocalNotifications] = useState<NotificationRecord[]>(INITIAL_NOTIFICATIONS);

  const [cloudAlerts, setCloudAlerts] = useState<CrowdAlertRecord[]>([]);
  const [cloudGates, setCloudGates] = useState<GateRecommendationRecord[]>([]);
  const [cloudSessions, setCloudSessions] = useState<MonitoringSessionRecord[]>([]);
  const [cloudNotifications, setCloudNotifications] = useState<NotificationRecord[]>([]);

  useEffect(() => {
    testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setCurrentProfile(null);
        setAdminUsers([]);
        setActivityLogs([]);
        redirectedUidRef.current = null;
        setAuthReady(true);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      try {
        const loadedProfile = await ensureAndLoadUserProfile(currentUser, { recordLogin: false });
        setCurrentProfile(loadedProfile);
        if (loadedProfile.status === 'active' && redirectedUidRef.current !== currentUser.uid) {
          redirectedUidRef.current = currentUser.uid;
          setActiveSection(loadedProfile.role === 'admin' ? 'admin' : 'overview');
        }
      } catch (err) {
        console.error(err);
        setAuthError(err instanceof Error ? err.message : 'Unable to load operator profile.');
      } finally {
        setProfileLoading(false);
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user || !currentProfile || currentProfile.status !== 'active') {
      setCloudAlerts([]);
      setCloudGates([]);
      setCloudSessions([]);
      setCloudNotifications([]);
      setAdminUsers([]);
      setActivityLogs([]);
      return;
    }

    const unsubData = subscribeOperatorData(user, currentProfile.role, {
      onSessions: setCloudSessions,
      onAlerts: setCloudAlerts,
      onGates: setCloudGates,
      onNotifications: setCloudNotifications,
    });
    const unsubLogs = subscribeActivityLogs(user, currentProfile.role, setActivityLogs);
    const unsubUsers =
      currentProfile.role === 'admin' ? subscribeAllUsersForAdmin(setAdminUsers) : () => undefined;

    return () => {
      unsubData();
      unsubLogs();
      unsubUsers();
    };
  }, [authReady, user, currentProfile]);

  const alerts = useMemo(
    () => [...cloudAlerts, ...localAlerts.filter((l) => !cloudAlerts.some((c) => c.id === l.id))],
    [cloudAlerts, localAlerts]
  );

  const gates = useMemo(
    () => [...cloudGates, ...localGates.filter((l) => !cloudGates.some((c) => c.id === l.id))],
    [cloudGates, localGates]
  );

  const sessions = useMemo(
    () => [...cloudSessions, ...localSessions.filter((l) => !cloudSessions.some((c) => c.id === l.id))],
    [cloudSessions, localSessions]
  );

  const notifications = useMemo(
    () => [
      ...cloudNotifications,
      ...localNotifications.filter((l) => !cloudNotifications.some((c) => c.id === l.id)),
    ],
    [cloudNotifications, localNotifications]
  );

  const activeFeed = useMemo(
    () => cameraFeeds.find((f) => f.id === activeFeedId) ?? cameraFeeds[0] ?? null,
    [cameraFeeds, activeFeedId]
  );
  const latestAnalysis = activeFeed?.analysis ?? null;

  const bottleneckCount = latestAnalysis?.summary.bottleneckRegions?.length ?? 2;
  const prediction = useMemo(
    () => computeDangerPrediction(history, bottleneckCount),
    [history, bottleneckCount]
  );

  const evacuation = useMemo(() => computeEvacuationRoutes(zones), [zones]);

  // Aggregate KPI Metrics
  const totalPeopleDetected = useMemo(() => {
    if (cameraFeeds.length > 0) {
      return cameraFeeds.reduce((sum, f) => sum + f.analysis.summary.maxPeopleDetected, 0);
    }
    return zones.reduce((sum, z) => sum + z.peopleCount, 0);
  }, [cameraFeeds, zones]);

  const currentPeakDensity = useMemo(() => {
    if (latestAnalysis) {
      return Math.max(...cameraFeeds.map((f) => f.analysis.summary.peakDensityPerSqm));
    }
    return Math.max(...zones.map((z) => z.densityPerSqm));
  }, [latestAnalysis, cameraFeeds, zones]);

  const currentDangerScore = useMemo(() => {
    if (latestAnalysis) {
      return Math.max(...cameraFeeds.map((f) => f.analysis.summary.peakDangerScore));
    }
    return Math.max(...zones.map((z) => z.dangerScore));
  }, [latestAnalysis, cameraFeeds, zones]);

  const currentSafetyStatus = classifySafetyStatus(currentDangerScore);
  const currentDensityLevel = classifyDensityLevel(currentPeakDensity);
  const activeAlerts = alerts.filter((a) => a.status !== 'resolved');
  const pendingGates = gates.filter((g) => g.approvalStatus === 'pending');
  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  const emitNotification = async (params: {
    title: string;
    message: string;
    severity: DangerLevel;
    zoneName: string;
    sourceKind: NotificationRecord['sourceKind'];
  }) => {
    const notif: NotificationRecord = {
      id: `notif_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      ownerId: user?.uid || 'local_preview',
      title: params.title,
      message: params.message,
      severity: params.severity,
      zoneName: params.zoneName,
      read: false,
      sourceKind: params.sourceKind,
      createdAtLabel: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      persistedToFirestore: Boolean(user),
    };

    if (params.severity === 'HIGH' || params.severity === 'CRITICAL') {
      playAlertTone(params.severity, soundMuted);
    }

    if (user) {
      try {
        await createNotificationInFirestore(user, notif);
      } catch (err) {
        console.error(err);
      }
    } else {
      setLocalNotifications((prev) => [notif, ...prev]);
    }
  };

  const handleAuthSuccess = (profile: UserAccountRecord) => {
    setAuthError(null);
    setCurrentProfile(profile);
    redirectedUidRef.current = profile.uid;
    setActiveSection(profile.role === 'admin' ? 'admin' : 'overview');
  };

  const handleSignOut = async () => {
    await signOutOperator(currentProfile);
    setAuthError(null);
    setCurrentProfile(null);
    redirectedUidRef.current = null;
    setActiveSection('overview');
  };

  const registerCameraFeed = (
    analysis: OpenCVAnalysisResult,
    options: { zoneName: string; sourceLabel: string; videoUrl: string | null }
  ) => {
    const newId = `feed_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    setCameraFeeds((prev) => {
      const camNum = prev.length + 1;
      const item: CameraFeedItem = {
        id: newId,
        cameraLabel: `CAM-0${camNum}`,
        zoneName: options.zoneName,
        sourceLabel: options.sourceLabel,
        videoUrl: options.videoUrl,
        analysis,
        addedAtLabel: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      return [...prev, item];
    });
    setActiveFeedId(newId);

    const frameHistory: HistorySample[] = analysis.frames.map((f, idx) => ({
      label: idx === analysis.frames.length - 1 ? 'Now' : `${f.timestampSec.toFixed(1)}s`,
      minuteOffset: idx - (analysis.frames.length - 1),
      peopleCount: f.peopleCount,
      densityPerSqm: f.peakDensityPerSqm,
      flowSpeedMps: f.opticalFlow.speedMps,
      turbulence: f.opticalFlow.directionalVariance,
      dangerScore: f.dangerScore,
    }));
    if (frameHistory.length > 0) {
      setHistory(frameHistory);
    }

    // Update matching zone on Spatial Map
    setZones((prev) =>
      prev.map((z, idx) =>
        idx === 2
          ? {
              ...z,
              peopleCount: analysis.summary.maxPeopleDetected,
              densityPerSqm: analysis.summary.peakDensityPerSqm,
              densityLevel: analysis.summary.densityLevel,
              flowSpeedMps:
                analysis.frames[analysis.frames.length - 1]?.opticalFlow.speedMps ?? z.flowSpeedMps,
              dangerScore: analysis.summary.peakDangerScore,
            }
          : z
      )
    );

    if (analysis.summary.peakDangerScore >= 55) {
      emitNotification({
        title: `OpenCV Alert: ${options.zoneName}`,
        message: `${analysis.summary.movementPattern} · ${analysis.summary.peakDensityPerSqm.toFixed(1)} p/m² (Danger ${analysis.summary.peakDangerScore}/100).`,
        severity: classifyDangerLevel(analysis.summary.peakDangerScore),
        zoneName: options.zoneName,
        sourceKind: 'real_video_analysis',
      });
    }
  };

  const handleUploadVideos = async (files: File[]) => {
    setAnalyzing(true);
    setAnalyzeError(null);
    setSaveMessage(null);
    try {
      const form = new FormData();
      files.forEach((f) => form.append('videos', f));
      form.append('maxFrames', '8');
      const res = await fetch('/api/analyze-videos', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Multi-camera video analysis failed.');
      }

      const items = (data.results || []) as {
        ok: boolean;
        fileName: string;
        analysis?: OpenCVAnalysisResult;
        error?: string;
      }[];

      const failures = items.filter((i) => !i.ok);
      if (failures.length > 0 && failures.length === items.length) {
        throw new Error(failures[0].error || 'Failed to analyze uploaded video files.');
      }

      items.forEach((item, idx) => {
        if (item.ok && item.analysis) {
          const matchingFile = files.find((f) => f.name === item.fileName) || files[idx];
          const objUrl = matchingFile ? URL.createObjectURL(matchingFile) : null;
          registerCameraFeed(
            { ...item.analysis, fileName: item.fileName },
            {
              zoneName: item.fileName.replace(/\.[^/.]+$/, '').slice(0, 28),
              sourceLabel: item.fileName,
              videoUrl: objUrl,
            }
          );
        }
      });
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Failed to analyze CCTV video(s).');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRunSampleOpenCV = async (scenario: SimulationScenarioId) => {
    setAnalyzing(true);
    setAnalyzeError(null);
    setSaveMessage(null);
    try {
      const res = await fetch(`/api/analyze-sample/${scenario}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxFrames: 8 }),
      });
      const data = (await res.json()) as OpenCVAnalysisResult & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Sample OpenCV analysis failed.');
      }
      const zoneLabelMap: Record<SimulationScenarioId, string> = {
        normal_plaza: 'North Concourse A1',
        stadium_bottleneck: 'South Gate B2 Funnel',
        sudden_shockwave: 'Transit Tunnel N4',
        counterflow_surge: 'Central Plaza Crossway',
      };
      registerCameraFeed(data, {
        zoneName: zoneLabelMap[scenario],
        sourceLabel: `Sample: ${scenario}`,
        videoUrl: data.videoUrl || `/api/sample-video/${scenario}`,
      });
      setActiveSection('cctv');
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Failed to process sample CCTV footage.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRemoveFeed = (feedId: string) => {
    setCameraFeeds((prev) => {
      const next = prev.filter((f) => f.id !== feedId);
      if (activeFeedId === feedId) {
        setActiveFeedId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  const handleSaveAnalysisToRecords = async (analysis: OpenCVAnalysisResult) => {
    setSavingSession(true);
    setSaveMessage(null);
    try {
      const sessionId = `sess_${Date.now()}`;
      const ownerId = user?.uid || 'local_preview';
      const title = analysis.fileName || `Sample CCTV (${analysis.scenario || 'analysis'})`;
      const sourceType = analysis.fileName ? 'uploaded_video' : 'simulation_sample';

      const sessionObj: MonitoringSessionRecord = {
        id: sessionId,
        ownerId,
        title,
        sourceType,
        analysisMode: 'real_opencv',
        totalPeopleDetected: analysis.summary.maxPeopleDetected,
        peakDensity: analysis.summary.peakDensityPerSqm,
        dangerScore: analysis.summary.peakDangerScore,
        safetyStatus: analysis.summary.safetyStatus,
        movementPattern: analysis.summary.movementPattern,
        anomalyFlags: analysis.summary.anomalyFlags,
        createdAtLabel: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        persistedToFirestore: Boolean(user),
      };

      const derived = deriveAlertsAndGatesFromOpenCV(analysis, ownerId, sessionId);

      if (user) {
        await saveSessionAlertsAndGatesToFirestore({
          user,
          session: sessionObj,
          alerts: derived.alerts,
          gates: derived.gates,
        });
        await logUserActivity({
          userId: user.uid,
          userName: currentProfile?.displayName || user.displayName || 'Operator',
          userEmail: currentProfile?.email || user.email || '',
          actionType: 'CCTV_ANALYSIS',
          details: `Saved OpenCV analysis "${title}" (${analysis.summary.peakDensityPerSqm.toFixed(2)} p/m², score ${analysis.summary.peakDangerScore}/100).`,
        });
        setSaveMessage('Saved to Firestore & synced live');
      } else {
        setLocalSessions((prev) => [sessionObj, ...prev]);
        if (derived.alerts.length > 0) {
          setLocalAlerts((prev) => [...derived.alerts, ...prev]);
        }
        if (derived.gates.length > 0) {
          setLocalGates((prev) => [...derived.gates, ...prev]);
        }
        setSaveMessage('Applied locally (Sign in to sync Firestore)');
      }
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Failed to save session.');
    } finally {
      setSavingSession(false);
    }
  };

  const handleApplySimulation = async (params: {
    scenarioId: SimulationScenarioId;
    title: string;
    location: string;
    peopleCount: number;
    densityPerSqm: number;
    flowSpeedMps: number;
    turbulence: number;
    dangerScore: number;
  }) => {
    setZones((prev) =>
      prev.map((z, idx) =>
        idx === 2
          ? {
              ...z,
              name: params.location,
              peopleCount: params.peopleCount,
              densityPerSqm: params.densityPerSqm,
              densityLevel: classifyDensityLevel(params.densityPerSqm),
              flowSpeedMps: params.flowSpeedMps,
              dangerScore: params.dangerScore,
            }
          : z
      )
    );

    const newPoint: HistorySample = {
      label: 'Now',
      minuteOffset: 0,
      peopleCount: params.peopleCount,
      densityPerSqm: params.densityPerSqm,
      flowSpeedMps: params.flowSpeedMps,
      turbulence: params.turbulence,
      dangerScore: params.dangerScore,
    };

    setHistory((prev) => {
      const shifted = prev.slice(-7).map((item, i, arr) => ({
        ...item,
        label: `-${(arr.length - i) * 2}m`,
        minuteOffset: -(arr.length - i) * 2,
      }));
      return [...shifted, newPoint];
    });

    if (params.dangerScore >= 45) {
      const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const sessId = `sim_sess_${Date.now()}`;
      const alertId = `sim_alert_${Date.now()}`;
      const gateId = `sim_gate_${Date.now()}`;
      const ownerId = user?.uid || 'local_preview';

      const newSession: MonitoringSessionRecord = {
        id: sessId,
        ownerId,
        title: `Digital Twin: ${params.title}`,
        sourceType: 'simulation_sample',
        analysisMode: 'simulated_scenario',
        totalPeopleDetected: params.peopleCount,
        peakDensity: params.densityPerSqm,
        dangerScore: params.dangerScore,
        safetyStatus: classifySafetyStatus(params.dangerScore),
        movementPattern:
          params.turbulence > 0.5 ? 'Simulated Counterflow Turbulence' : 'Simulated Bottleneck Compression',
        anomalyFlags: params.dangerScore >= 70 ? ['OVERCROWDING', 'BOTTLENECK_STALL'] : ['ELEVATED_DENSITY'],
        createdAtLabel: ts,
        persistedToFirestore: Boolean(user),
      };

      const dangerLvl = classifyDangerLevel(params.dangerScore);
      const newAlert: CrowdAlertRecord = {
        id: alertId,
        ownerId,
        sessionId: sessId,
        location: params.location,
        zoneName: params.location,
        densityLevel: classifyDensityLevel(params.densityPerSqm),
        peoplePerSqm: params.densityPerSqm,
        dangerScore: params.dangerScore,
        dangerLevel: dangerLvl,
        status: 'new',
        assignedTeam: params.dangerScore >= 70 ? 'Delta Evacuation Squad' : 'Bravo Gate Marshals',
        actionHistory: [
          `[${ts}] Digital Twin threshold reached (${params.densityPerSqm.toFixed(1)} p/m², score ${params.dangerScore}/100)`,
        ],
        suggestedAction:
          params.dangerScore >= 70
            ? 'Open adjacent relief gate immediately and halt primary concourse inflow.'
            : 'Monitor bottleneck aperture and prepare secondary diversion marshals.',
        sourceKind: 'simulated_prediction',
        createdAtLabel: ts,
        persistedToFirestore: Boolean(user),
      };

      const newGate: GateRecommendationRecord = {
        id: gateId,
        ownerId,
        alertId,
        gateName: 'Relief Gate D1',
        recommendedAction: params.dangerScore >= 70 ? 'OPEN_RELIEF' : 'REDIRECT_FLOW',
        reason: `Digital Twin "${params.title}" reached ${params.densityPerSqm.toFixed(1)} p/m² at ${params.flowSpeedMps.toFixed(2)} m/s.`,
        projectedDensityDrop: params.dangerScore >= 70 ? 27 : 16,
        approvalStatus: 'pending',
        reviewedBy: '',
        createdAtLabel: ts,
        persistedToFirestore: Boolean(user),
      };

      if (user) {
        await saveSessionAlertsAndGatesToFirestore({
          user,
          session: newSession,
          alerts: [newAlert],
          gates: [newGate],
        });
      } else {
        setLocalSessions((prev) => [newSession, ...prev]);
        setLocalAlerts((prev) => [newAlert, ...prev]);
        setLocalGates((prev) => [newGate, ...prev]);
      }

      emitNotification({
        title: `Simulation Alert: ${params.location}`,
        message: `${params.title} hit ${dangerLvl} risk (${params.dangerScore}/100).`,
        severity: dangerLvl,
        zoneName: params.location,
        sourceKind: 'simulated_prediction',
      });
    }
  };

  const handleUpdateIncident = async (
    alertId: string,
    updates: { status: AlertStatus; assignedTeam: string; note?: string }
  ) => {
    const target = alerts.find((a) => a.id === alertId);
    if (!target) return;

    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const operatorTag = user?.displayName || user?.email?.split('@')[0] || 'Operator';
    const actionText = updates.note || `Updated status to ${updates.status.toUpperCase()}`;
    const nextHistory = [...target.actionHistory, `[${ts}] ${operatorTag}: ${actionText}`].slice(-20);

    if (target.persistedToFirestore && user) {
      await updateIncidentInFirestore(alertId, {
        status: updates.status,
        assignedTeam: updates.assignedTeam,
        actionHistory: nextHistory,
      });
    } else {
      setLocalAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId
            ? {
                ...a,
                status: updates.status,
                assignedTeam: updates.assignedTeam,
                actionHistory: nextHistory,
              }
            : a
        )
      );
    }
  };

  const handleReportManualIncident = async (params: {
    location: string;
    densityPerSqm: number;
    dangerLevel: DangerLevel;
    assignedTeam: string;
    suggestedAction: string;
  }) => {
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const sessId = `rep_sess_${Date.now()}`;
    const alertId = `rep_alert_${Date.now()}`;
    const ownerId = user?.uid || 'local_preview';
    const reporter = currentProfile?.displayName || user?.email || 'Operator';
    const dangerScore =
      params.dangerLevel === 'CRITICAL'
        ? 88
        : params.dangerLevel === 'HIGH'
        ? 68
        : params.dangerLevel === 'MEDIUM'
        ? 44
        : 22;

    const newSession: MonitoringSessionRecord = {
      id: sessId,
      ownerId,
      title: `Field Report: ${params.location}`,
      sourceType: 'manual_report',
      analysisMode: 'operator_report',
      totalPeopleDetected: Math.round(params.densityPerSqm * 40),
      peakDensity: params.densityPerSqm,
      dangerScore,
      safetyStatus: classifySafetyStatus(dangerScore),
      movementPattern: 'Operator Field Observation',
      anomalyFlags: [params.dangerLevel === 'CRITICAL' ? 'OVERCROWDING' : 'FIELD_REPORT'],
      createdAtLabel: ts,
      persistedToFirestore: Boolean(user),
    };

    const newAlert: CrowdAlertRecord = {
      id: alertId,
      ownerId,
      sessionId: sessId,
      location: params.location,
      zoneName: params.location,
      densityLevel: classifyDensityLevel(params.densityPerSqm),
      peoplePerSqm: params.densityPerSqm,
      dangerScore,
      dangerLevel: params.dangerLevel,
      status: 'new',
      assignedTeam: params.assignedTeam,
      actionHistory: [`[${ts}] ${reporter}: Submitted field incident report (${params.dangerLevel})`],
      suggestedAction: params.suggestedAction,
      sourceKind: 'operator_manual_report',
      createdAtLabel: ts,
      persistedToFirestore: Boolean(user),
    };

    if (user) {
      await saveSessionAlertsAndGatesToFirestore({
        user,
        session: newSession,
        alerts: [newAlert],
        gates: [],
      });
      await logUserActivity({
        userId: user.uid,
        userName: reporter,
        userEmail: currentProfile?.email || user.email || '',
        actionType: 'INCIDENT_REPORT',
        details: `Reported ${params.dangerLevel} incident at ${params.location} (${params.densityPerSqm.toFixed(1)} p/m²).`,
      });
    } else {
      setLocalSessions((prev) => [newSession, ...prev]);
      setLocalAlerts((prev) => [newAlert, ...prev]);
    }

    emitNotification({
      title: `Incident Reported: ${params.location}`,
      message: `${reporter} logged ${params.dangerLevel} crowd incident (${params.densityPerSqm.toFixed(1)} p/m²).`,
      severity: params.dangerLevel,
      zoneName: params.location,
      sourceKind: 'system_action',
    });
  };

  const handleReviewGate = async (recId: string, decision: 'approved' | 'rejected') => {
    const target = gates.find((g) => g.id === recId);
    if (target?.persistedToFirestore && user) {
      await reviewGateRecommendationInFirestore(recId, decision, user.uid);
    } else {
      setLocalGates((prev) =>
        prev.map((g) =>
          g.id === recId
            ? { ...g, approvalStatus: decision, reviewedBy: user?.uid || 'local_operator' }
            : g
        )
      );
    }
    if (target) {
      emitNotification({
        title: `Gate Action ${decision === 'approved' ? 'Approved' : 'Rejected'}`,
        message: `${target.gateName}: ${target.recommendedAction.replace(/_/g, ' ')} marked ${decision}.`,
        severity: 'LOW',
        zoneName: target.gateName,
        sourceKind: 'system_action',
      });
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (target?.persistedToFirestore && user) {
      await markNotificationReadInFirestore(id, true);
    } else {
      setLocalNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    for (const item of unread) {
      await handleMarkNotificationRead(item.id);
    }
  };

  const handleDispatchEvacuationNotice = (rec: EvacuationRecommendation) => {
    emitNotification({
      title: `Evacuation Diversion Logged: ${rec.congestedZone}`,
      message: `Security marshals advised to route crowd toward ${rec.recommendedExit} (est. -${rec.estimatedDensityDropPct}% load).`,
      severity: 'HIGH',
      zoneName: rec.congestedZone,
      sourceKind: 'system_action',
    });
  };

  const handleExportPdf = () => {
    exportIncidentPdfReport({
      operatorName: user?.displayName || user?.email || 'Local Duty Operator',
      analysisSourceLabel: latestAnalysis ? 'Real OpenCV Video Analysis' : 'Simulated Baseline Telemetry',
      totalPeopleDetected,
      peakDensity: currentPeakDensity,
      dangerScore: currentDangerScore,
      safetyStatus: currentSafetyStatus,
      zones,
      cameraFeeds,
      alerts,
      gates,
      evacuationRecommendations: evacuation.recommendations,
      prediction,
    });
  };

  const telemetryContextForAssistant = useMemo(
    () => ({
      dataSource: latestAnalysis ? 'Real OpenCV Video Analysis' : 'Simulated Baseline Telemetry',
      summary: {
        totalPeopleDetected,
        peakDensityPerSqm: currentPeakDensity,
        densityLevel: currentDensityLevel,
        dangerScore: currentDangerScore,
        safetyStatus: currentSafetyStatus,
      },
      highestRiskZone: zones.slice().sort((a, b) => b.dangerScore - a.dangerScore)[0],
      zones: zones.map((z) => ({
        name: z.name,
        camera: z.cameraLabel,
        peopleCount: z.peopleCount,
        densityPerSqm: z.densityPerSqm,
        flowSpeedMps: z.flowSpeedMps,
        dangerScore: z.dangerScore,
      })),
      activeCameraFeeds: cameraFeeds.map((f) => ({
        camera: f.cameraLabel,
        zone: f.zoneName,
        maxPeople: f.analysis.summary.maxPeopleDetected,
        peakDensity: f.analysis.summary.peakDensityPerSqm,
        dangerScore: f.analysis.summary.peakDangerScore,
        movementPattern: f.analysis.summary.movementPattern,
        anomalies: f.analysis.summary.anomalyFlags,
        bottlenecks: f.analysis.summary.bottleneckRegions,
      })),
      activeAlerts: activeAlerts.slice(0, 6).map((a) => ({
        location: a.location,
        status: a.status,
        assignedTeam: a.assignedTeam,
        dangerLevel: a.dangerLevel,
        dangerScore: a.dangerScore,
        peoplePerSqm: a.peoplePerSqm,
        suggestedAction: a.suggestedAction,
        sourceKind: a.sourceKind,
      })),
      evacuationRecommendations: evacuation.recommendations,
      prediction5to10Min: {
        projectedDanger5m: prediction.projectedDanger5m,
        projectedDanger10m: prediction.projectedDanger10m,
        projectedRiskLevel: prediction.projectedRiskLevel,
        explanation: prediction.explanation,
      },
    }),
    [
      latestAnalysis,
      totalPeopleDetected,
      currentPeakDensity,
      currentDensityLevel,
      currentDangerScore,
      currentSafetyStatus,
      zones,
      cameraFeeds,
      activeAlerts,
      evacuation.recommendations,
      prediction,
    ]
  );

  const pageTitles: Record<NavSection, string> = {
    overview: 'Operations Command Overview',
    cctv: 'Multi-Camera CCTV & OpenCV Monitor',
    analytics: 'Crowd Density & Advanced Risk Prediction',
    evacuation: 'Smart Evacuation Route Planner',
    alerts: 'Emergency Response & Gate Control',
    simulation: 'Digital Twin Crowd Simulation Lab',
    admin: 'Administrator User & RBAC Management',
    profile: 'Operator Profile & Security',
    setup: 'System Setup & Architecture',
  };

  if (!authReady || (user && profileLoading && !currentProfile)) {
    return (
      <div className="min-h-screen bg-[#070B14] text-slate-100 flex items-center justify-center p-6">
        <div className="bg-[#0D1424] border border-slate-800 rounded-2xl px-8 py-6 text-center space-y-2">
          <p className="text-sm font-semibold text-white">Verifying CROWGUARD Authentication...</p>
          <p className="text-xs text-slate-400">Checking Firebase session and role authorization.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPortal onAuthenticated={handleAuthSuccess} externalNotice={authError} />;
  }

  if (currentProfile && currentProfile.status === 'inactive') {
    return (
      <div className="min-h-screen bg-[#070B14] text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#0D1424] border border-red-500/40 rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-red-950/60 border border-red-500/40 flex items-center justify-center text-red-400 mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-display font-bold text-white">Account Deactivated</h1>
          <p className="text-sm text-slate-400">
            Access for <span className="text-white">{currentProfile.email}</span> has been deactivated by a CROWGUARD Administrator.
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white border border-slate-700"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen h-screen bg-[#070B14] text-slate-100 flex overflow-hidden">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        activeAlertCount={activeAlerts.length}
        pendingGateCount={pendingGates.length}
        profile={currentProfile}
        onSignOut={handleSignOut}
        onOpenAssistant={() => setAssistantOpen(true)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Command Header */}
        <header className="h-16 px-4 sm:px-6 border-b border-slate-800/80 bg-[#0A101D] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base sm:text-lg font-display font-semibold text-white truncate">
              {pageTitles[activeSection]}
            </h1>
          </div>

          <div className="hidden xl:flex items-center gap-3 text-xs text-slate-400 font-mono whitespace-nowrap">
            <span>
              Source: {latestAnalysis ? `Real OpenCV (${cameraFeeds.length} feed${cameraFeeds.length === 1 ? '' : 's'})` : 'Simulated Baseline'}
            </span>
            <span aria-hidden="true">·</span>
            <span>{monitoringActive ? 'Monitoring Active' : 'Monitoring Paused'}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSoundMuted((m) => !m)}
              className="p-2 rounded-lg bg-[#0D1424] hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
              title={soundMuted ? 'Unmute Alert Sound' : 'Mute Alert Sound'}
              aria-label={soundMuted ? 'Unmute Alert Sound' : 'Mute Alert Sound'}
            >
              {soundMuted ? (
                <VolumeX className="w-4 h-4 text-slate-500" />
              ) : (
                <Volume2 className="w-4 h-4 text-blue-400" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setNotificationsOpen((o) => !o)}
              className="relative p-2 rounded-lg bg-[#0D1424] hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
              aria-label="Open Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-[10px] font-mono font-bold text-white flex items-center justify-center">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0D1424] hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap"
            >
              <FileDown className="w-3.5 h-3.5 text-blue-400" />
              PDF Report
            </button>

            <button
              type="button"
              onClick={() => setAssistantOpen(true)}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0D1424] hover:bg-slate-800 border border-blue-500/40 text-blue-300 text-xs font-medium transition-colors whitespace-nowrap"
            >
              <Bot className="w-3.5 h-3.5 text-blue-400" />
              AI Assistant
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('cctv')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              Analyze CCTV
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('profile')}
              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#0D1424] hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap"
              title="Open Profile & Account Settings"
              aria-label="Open Profile"
            >
              {currentProfile?.photoURL ? (
                <img
                  src={currentProfile.photoURL}
                  alt={currentProfile.displayName}
                  referrerPolicy="no-referrer"
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-300 flex items-center justify-center text-[11px] font-semibold">
                  {(currentProfile?.displayName || user.email || 'U')[0].toUpperCase()}
                </span>
              )}
              <span className="hidden lg:inline truncate max-w-[110px]">
                {currentProfile?.role === 'admin' ? 'ADMIN' : 'OPERATOR'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0D1424] hover:bg-red-950/50 border border-slate-800 hover:border-red-500/40 text-slate-300 hover:text-red-300 text-xs font-medium transition-colors whitespace-nowrap"
              aria-label="Logout"
              title="Secure Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Main Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {authError && (
            <div className="bg-red-950/40 border border-red-500/40 rounded-lg px-4 py-2.5 text-xs text-red-300">
              Authentication notice: {authError}
            </div>
          )}

          {activeSection === 'overview' && (
            <>
              {/* 5-Metric Executive KPI Strip */}
              <section aria-label="Key Safety Indicators" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                <div className="bg-[#0D1424] border border-slate-800/80 rounded-xl p-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Total People Detected</span>
                    <Users className="w-4 h-4 text-blue-400" />
                  </div>
                  <p className="text-2xl font-mono font-bold text-white">{totalPeopleDetected}</p>
                  <p className="text-[11px] text-slate-400">
                    {cameraFeeds.length > 0
                      ? `Across ${cameraFeeds.length} OpenCV camera feed(s)`
                      : 'Across 5 monitored sectors'}
                  </p>
                </div>

                <div className="bg-[#0D1424] border border-slate-800/80 rounded-xl p-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Current Crowd Density</span>
                    <Activity className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-2xl font-mono font-bold text-white">
                    {currentPeakDensity.toFixed(2)} <span className="text-sm font-normal text-slate-400">p/m²</span>
                  </p>
                  <p
                    className={`text-[11px] font-mono font-semibold ${
                      currentDensityLevel === 'CRITICAL'
                        ? 'text-red-400'
                        : currentDensityLevel === 'HIGH'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    Classification: {currentDensityLevel}
                  </p>
                </div>

                <div className="bg-[#0D1424] border border-slate-800/80 rounded-xl p-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Crowd Safety Status</span>
                    <Gauge className="w-4 h-4 text-red-400" />
                  </div>
                  <p
                    className={`text-2xl font-mono font-bold ${
                      currentSafetyStatus === 'CRITICAL'
                        ? 'text-red-400'
                        : currentSafetyStatus === 'HIGH_RISK'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {currentSafetyStatus.replace('_', ' ')}
                  </p>
                  <p className="text-[11px] font-mono text-slate-400">
                    Danger Score: {currentDangerScore}/100
                  </p>
                </div>

                <div className="bg-[#0D1424] border border-slate-800/80 rounded-xl p-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Active Incidents</span>
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                  </div>
                  <p className="text-2xl font-mono font-bold text-white">{activeAlerts.length}</p>
                  <p className="text-[11px] text-slate-400">
                    {pendingGates.length} gate actions awaiting approval
                  </p>
                </div>

                <div className="bg-[#0D1424] border border-slate-800/80 rounded-xl p-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Live Monitoring Status</span>
                    <CheckCircle2
                      className={`w-4 h-4 ${monitoringActive ? 'text-emerald-400' : 'text-slate-500'}`}
                    />
                  </div>
                  <p className="text-2xl font-mono font-bold text-white">
                    {monitoringActive ? 'ACTIVE' : 'PAUSED'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setMonitoringActive((v) => !v)}
                    className="text-[11px] font-medium text-blue-400 hover:text-blue-300"
                  >
                    {monitoringActive ? 'Pause Telemetry Stream' : 'Resume Telemetry Stream'}
                  </button>
                </div>
              </section>

              {/* Center Tactical Venue Map + 5-10 Min Trend Chart */}
              <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                <div className="xl:col-span-7">
                  <VenueMapPanel
                    zones={zones}
                    selectedZoneId={selectedZoneId}
                    onSelectZone={setSelectedZoneId}
                    onInspectInCCTV={() => setActiveSection('cctv')}
                  />
                </div>

                <div className="xl:col-span-5 bg-[#0D1424] border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold text-white">Danger Score &amp; 10-Min Horizon</h2>
                      <span className="text-xs font-mono text-amber-400">
                        +10m Est: {prediction.projectedDanger10m}/100 ({prediction.projectedRiskLevel})
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{prediction.explanation}</p>
                  </div>

                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={prediction.forecastSeries} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
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
                        <Area
                          type="monotone"
                          dataKey="dangerScore"
                          name="Danger Score"
                          stroke="#3B82F6"
                          fill="#3B82F6"
                          fillOpacity={0.2}
                          strokeWidth={2.2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-xs">
                    <span className="text-slate-400 truncate">{prediction.disclaimer}</span>
                    <button
                      type="button"
                      onClick={() => setActiveSection('analytics')}
                      className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 font-medium whitespace-nowrap shrink-0"
                    >
                      Full Analytics
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </section>

              {/* Bottom Operational Row: Incidents & Gate Approvals */}
              <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                <div className="xl:col-span-6 bg-[#0D1424] border border-slate-800/80 rounded-xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">Active Emergency Incidents</h2>
                    <button
                      type="button"
                      onClick={() => setActiveSection('alerts')}
                      className="text-xs text-blue-400 hover:text-blue-300 font-medium whitespace-nowrap"
                    >
                      Manage Response
                    </button>
                  </div>
                  <div className="divide-y divide-slate-800/80">
                    {activeAlerts.slice(0, 3).map((alert) => (
                      <div key={alert.id} className="p-4 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-white">
                            <AlertTriangle
                              className={`w-3.5 h-3.5 ${
                                alert.dangerLevel === 'CRITICAL' ? 'text-red-400' : 'text-amber-400'
                              }`}
                            />
                            {alert.location}
                          </span>
                          <span className="font-mono text-slate-400">
                            {alert.status.toUpperCase()} · {alert.assignedTeam}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">{alert.suggestedAction}</p>
                      </div>
                    ))}
                    {activeAlerts.length === 0 && (
                      <p className="p-6 text-xs text-slate-400 text-center">No active crowd danger incidents.</p>
                    )}
                  </div>
                </div>

                <div className="xl:col-span-6 bg-[#0D1424] border border-slate-800/80 rounded-xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">Pending Gate Control Recommendations</h2>
                    <button
                      type="button"
                      onClick={() => setActiveSection('evacuation')}
                      className="text-xs text-blue-400 hover:text-blue-300 font-medium whitespace-nowrap"
                    >
                      Evacuation Planner
                    </button>
                  </div>
                  <div className="divide-y divide-slate-800/80">
                    {pendingGates.slice(0, 3).map((gate) => (
                      <div key={gate.id} className="p-4 flex items-center justify-between gap-4">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 text-xs">
                            <DoorOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span className="font-semibold text-white truncate">{gate.gateName}</span>
                            <span className="font-mono text-emerald-400 shrink-0">
                              -{gate.projectedDensityDrop}% est.
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 truncate">{gate.reason}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleReviewGate(gate.id, 'approved')}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                        >
                          Approve
                        </button>
                      </div>
                    ))}
                    {pendingGates.length === 0 && (
                      <p className="p-6 text-xs text-slate-400 text-center">
                        All gate recommendations have been reviewed by an operator.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {sessions.length > 0 && (
                <section className="bg-[#0D1424] border border-slate-800/80 rounded-xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-800/80">
                    <h2 className="text-sm font-semibold text-white">Recorded Monitoring Sessions</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0A101D] text-slate-400 border-b border-slate-800/80">
                        <tr>
                          <th className="px-4 py-2.5 font-medium">Session</th>
                          <th className="px-4 py-2.5 font-medium">Analysis Mode</th>
                          <th className="px-4 py-2.5 font-medium text-right">People</th>
                          <th className="px-4 py-2.5 font-medium text-right">Peak Density</th>
                          <th className="px-4 py-2.5 font-medium text-right">Danger Score</th>
                          <th className="px-4 py-2.5 font-medium">Movement Pattern</th>
                          <th className="px-4 py-2.5 font-medium text-right">Storage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {sessions.slice(0, 6).map((s) => (
                          <tr key={s.id} className="hover:bg-slate-900/30">
                            <td className="px-4 py-2.5 font-medium text-white">{s.title}</td>
                            <td className="px-4 py-2.5 font-mono text-slate-300">{s.analysisMode}</td>
                            <td className="px-4 py-2.5 font-mono text-right text-white">{s.totalPeopleDetected}</td>
                            <td className="px-4 py-2.5 font-mono text-right text-amber-400">
                              {s.peakDensity.toFixed(2)} p/m²
                            </td>
                            <td className="px-4 py-2.5 font-mono text-right text-red-400">{s.dangerScore}/100</td>
                            <td className="px-4 py-2.5 text-slate-300">{s.movementPattern}</td>
                            <td className="px-4 py-2.5 font-mono text-right text-slate-400">
                              {s.persistedToFirestore ? 'Firestore' : 'Local'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}

          {activeSection === 'cctv' && (
            <CCTVAnalyzerView
              cameraFeeds={cameraFeeds}
              activeFeedId={activeFeed?.id ?? null}
              onSelectFeed={setActiveFeedId}
              onRemoveFeed={handleRemoveFeed}
              analyzing={analyzing}
              analyzeError={analyzeError}
              onUploadVideos={handleUploadVideos}
              onRunSampleOpenCV={handleRunSampleOpenCV}
              onSaveAnalysisToRecords={handleSaveAnalysisToRecords}
              isSignedIn={Boolean(user)}
              savingSession={savingSession}
              saveMessage={saveMessage}
            />
          )}

          {activeSection === 'analytics' && (
            <DensityFlowView
              analysis={latestAnalysis}
              history={history}
              prediction={prediction}
            />
          )}

          {activeSection === 'evacuation' && (
            <EvacuationPlannerView
              zones={zones}
              segments={evacuation.segments}
              recommendations={evacuation.recommendations}
              onDispatchEvacuationNotice={handleDispatchEvacuationNotice}
            />
          )}

          {activeSection === 'alerts' && (
            <AlertsGatesView
              alerts={alerts}
              gates={gates}
              onUpdateIncident={handleUpdateIncident}
              onReportIncident={handleReportManualIncident}
              onReviewGate={handleReviewGate}
              onExportPdf={handleExportPdf}
              isSignedIn={Boolean(user)}
            />
          )}

          {activeSection === 'simulation' && (
            <SimulationLabView
              onApplySimulation={handleApplySimulation}
              onRunOpenCVOnSample={handleRunSampleOpenCV}
              analyzingOpenCV={analyzing}
            />
          )}

          {activeSection === 'admin' && (
            <AdminManagementView
              currentUser={user}
              currentProfile={currentProfile}
              users={adminUsers}
              activityLogs={activityLogs}
              alerts={alerts}
              onReturnOperator={() => setActiveSection('overview')}
              onInspectIncidents={() => setActiveSection('alerts')}
            />
          )}

          {activeSection === 'profile' && currentProfile && (
            <UserProfileView
              currentUser={user}
              profile={currentProfile}
              activityLogs={activityLogs.filter((l) => l.userId === user.uid)}
              onProfileUpdated={(next) => setCurrentProfile(next)}
            />
          )}

          {activeSection === 'setup' && <SetupGuideView />}
        </main>
      </div>

      {/* Overlays: Real-time Notifications Drawer + AI Safety Assistant */}
      <NotificationCenter
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notifications}
        muted={soundMuted}
        onToggleMute={() => setSoundMuted((m) => !m)}
        onMarkRead={handleMarkNotificationRead}
        onMarkAllRead={handleMarkAllRead}
      />

      <AISafetyAssistant
        open={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        telemetryContext={telemetryContextForAssistant}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
