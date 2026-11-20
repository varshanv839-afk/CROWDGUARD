import { jsPDF } from 'jspdf';
import type {
  CameraFeedItem,
  CrowdAlertRecord,
  DangerPredictionSummary,
  EvacuationRecommendation,
  GateRecommendationRecord,
  ZoneTelemetry,
} from '../types/crowguard';

export function exportIncidentPdfReport(params: {
  operatorName: string;
  analysisSourceLabel: string;
  totalPeopleDetected: number;
  peakDensity: number;
  dangerScore: number;
  safetyStatus: string;
  zones: ZoneTelemetry[];
  cameraFeeds: CameraFeedItem[];
  alerts: CrowdAlertRecord[];
  gates: GateRecommendationRecord[];
  evacuationRecommendations: EvacuationRecommendation[];
  prediction: DangerPredictionSummary;
}): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 42;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - marginX * 2;
  let y = 46;

  const ensurePageSpace = (needed = 60) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 42) {
      doc.addPage();
      y = 46;
    }
  };

  const addSectionTitle = (title: string) => {
    ensurePageSpace(42);
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 64, 175);
    doc.text(title, marginX, y);
    y += 6;
    doc.setDrawColor(203, 213, 225);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 14;
    doc.setTextColor(15, 23, 42);
  };

  const addWrappedLine = (text: string, fontSize = 9.5, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxWidth);
    ensurePageSpace(lines.length * (fontSize + 3) + 4);
    doc.text(lines, marginX, y);
    y += lines.length * (fontSize + 3) + 3;
  };

  // Header Banner
  doc.setFillColor(10, 16, 29);
  doc.rect(0, 0, pageWidth, 74, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('CROWGUARD — Crowd Safety & Incident Report', marginX, 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Generated: ${new Date().toLocaleString()}  |  Operator: ${params.operatorName}  |  Source: ${params.analysisSourceLabel}`,
    marginX,
    52
  );
  y = 96;
  doc.setTextColor(15, 23, 42);

  // Executive Crowd Telemetry
  addSectionTitle('1. Executive Crowd Telemetry Summary');
  addWrappedLine(
    `Total People Detected: ${params.totalPeopleDetected}   |   Peak Crowd Density: ${params.peakDensity.toFixed(2)} p/m2   |   Danger Score: ${params.dangerScore}/100 (${params.safetyStatus})`,
    10,
    true
  );
  addWrappedLine(
    `5-10 Min Projected Horizon: +5m = ${params.prediction.projectedDanger5m}/100, +10m = ${params.prediction.projectedDanger10m}/100 (${params.prediction.projectedRiskLevel}).`
  );
  addWrappedLine(`Prediction Rationale: ${params.prediction.explanation}`);
  addWrappedLine(`Notice: ${params.prediction.disclaimer}`, 8.5);

  // Zone Comparison
  addSectionTitle('2. Zone & Multi-Camera Risk Comparison');
  params.zones.forEach((z) => {
    addWrappedLine(
      `${z.cameraLabel} — ${z.name}: ${z.peopleCount} pax | ${z.densityPerSqm.toFixed(2)} p/m2 (${z.densityLevel}) | Flow ${z.flowSpeedMps.toFixed(2)} m/s | Risk ${z.dangerScore}/100`
    );
  });

  if (params.cameraFeeds.length > 0) {
    addWrappedLine(`Active Uploaded/Sample OpenCV Camera Feeds (${params.cameraFeeds.length}):`, 9.5, true);
    params.cameraFeeds.forEach((feed) => {
      const s = feed.analysis.summary;
      addWrappedLine(
        `  • ${feed.cameraLabel} (${feed.zoneName}): ${s.maxPeopleDetected} max pax, ${s.peakDensityPerSqm.toFixed(2)} p/m2, Danger ${s.peakDangerScore}/100, Pattern: ${s.movementPattern}`
      );
    });
  }

  // Evacuation Routes
  addSectionTitle('3. Smart Evacuation Route Advisories');
  if (params.evacuationRecommendations.length === 0) {
    addWrappedLine('All venue evacuation corridors currently operate within normal throughput thresholds.');
  } else {
    params.evacuationRecommendations.forEach((rec) => {
      addWrappedLine(
        `• Congested Sector: ${rec.congestedZone} (Blocked/Slow: ${rec.blockedRoute}) -> Divert via: ${rec.recommendedExit} (Est. -${rec.estimatedDensityDropPct}% density)`,
        9.5,
        true
      );
      addWrappedLine(`  Detail: ${rec.reason}`);
    });
  }

  // Emergency Response Incidents
  addSectionTitle('4. Emergency Response Incidents & Action History');
  if (params.alerts.length === 0) {
    addWrappedLine('No crowd safety alerts recorded.');
  } else {
    params.alerts.slice(0, 10).forEach((al) => {
      addWrappedLine(
        `[${al.status.toUpperCase()}] ${al.dangerLevel} (${al.dangerScore}/100) — ${al.location} | Team: ${al.assignedTeam} | Time: ${al.createdAtLabel}`,
        9.5,
        true
      );
      addWrappedLine(`  Action: ${al.suggestedAction}`);
      if (al.actionHistory.length > 0) {
        addWrappedLine(`  Audit Log: ${al.actionHistory.slice(-3).join(' ; ')}`, 8.5);
      }
    });
  }

  // Gate Management Recommendations
  addSectionTitle('5. Gate Management Recommendations (Human Approval Required)');
  if (params.gates.length === 0) {
    addWrappedLine('No pending or reviewed gate recommendations.');
  } else {
    params.gates.slice(0, 10).forEach((g) => {
      addWrappedLine(
        `• ${g.gateName} — ${g.recommendedAction} [${g.approvalStatus.toUpperCase()}] (Est. -${g.projectedDensityDrop}% peak density)`,
        9.5,
        true
      );
      addWrappedLine(`  Reason: ${g.reason}`);
    });
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  doc.save(`CROWGUARD-Incident-Report-${stamp}.pdf`);
}
