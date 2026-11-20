import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  XCircle,
  DoorOpen,
  Lock,
  FileDown,
  Users,
  Clock,
  Plus,
  X,
} from 'lucide-react';
import type {
  AlertStatus,
  CrowdAlertRecord,
  DangerLevel,
  GateRecommendationRecord,
} from '../types/crowguard';
import { SECURITY_TEAMS } from '../lib/crowdAnalytics';

interface AlertsGatesViewProps {
  alerts: CrowdAlertRecord[];
  gates: GateRecommendationRecord[];
  onUpdateIncident: (
    alertId: string,
    updates: { status: AlertStatus; assignedTeam: string; note?: string }
  ) => Promise<void>;
  onReportIncident: (params: {
    location: string;
    densityPerSqm: number;
    dangerLevel: DangerLevel;
    assignedTeam: string;
    suggestedAction: string;
  }) => Promise<void>;
  onReviewGate: (recId: string, decision: 'approved' | 'rejected') => Promise<void>;
  onExportPdf: () => void;
  isSignedIn: boolean;
}

export const AlertsGatesView: React.FC<AlertsGatesViewProps> = ({
  alerts,
  gates,
  onUpdateIncident,
  onReportIncident,
  onReviewGate,
  onExportPdf,
  isSignedIn,
}) => {
  const [alertFilter, setAlertFilter] = useState<'all' | AlertStatus>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  // Manual Incident Report Form
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportLocation, setReportLocation] = useState('South Gate B2 Funnel');
  const [reportDensity, setReportDensity] = useState(3.8);
  const [reportDangerLevel, setReportDangerLevel] = useState<DangerLevel>('HIGH');
  const [reportTeam, setReportTeam] = useState<string>(SECURITY_TEAMS[0]);
  const [reportAction, setReportAction] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const filteredAlerts =
    alertFilter === 'all' ? alerts : alerts.filter((a) => a.status === alertFilter);

  const handleIncidentChange = async (
    alert: CrowdAlertRecord,
    nextStatus: AlertStatus,
    nextTeam?: string,
    note?: string
  ) => {
    setBusyId(alert.id);
    try {
      await onUpdateIncident(alert.id, {
        status: nextStatus,
        assignedTeam: nextTeam ?? alert.assignedTeam,
        note,
      });
      if (note) {
        setNoteInputs((prev) => ({ ...prev, [alert.id]: '' }));
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportLocation.trim() || !reportAction.trim()) return;
    setSubmittingReport(true);
    try {
      await onReportIncident({
        location: reportLocation.trim(),
        densityPerSqm: reportDensity,
        dangerLevel: reportDangerLevel,
        assignedTeam: reportTeam,
        suggestedAction: reportAction.trim(),
      });
      setReportAction('');
      setShowReportForm(false);
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleGateDecision = async (id: string, decision: 'approved' | 'rejected') => {
    setBusyId(id);
    try {
      await onReviewGate(id, decision);
    } finally {
      setBusyId(null);
    }
  };

  const formatActionLabel = (action: GateRecommendationRecord['recommendedAction']) => {
    switch (action) {
      case 'OPEN_RELIEF':
        return 'Open Relief Gate';
      case 'RESTRICT_ENTRY':
        return 'Restrict Inflow Entry';
      case 'REDIRECT_FLOW':
        return 'Redirect Crowd Stream';
      default:
        return 'Hold Current State';
    }
  };

  return (
    <div className="space-y-6">
      {/* Safety Governance + Report Incident + PDF Report Header */}
      <div className="bg-[#0D1424] border border-blue-500/30 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs text-slate-200">
          <Lock className="w-4 h-4 text-blue-400 shrink-0" />
          <span>
            Emergency Response &amp; Gate Governance: Incidents follow New → Acknowledged → Responding → Resolved; gate controls always require human sign-off.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-mono text-slate-400">
            {isSignedIn ? 'Firestore Sync Active' : 'Local Session Mode'}
          </span>
          <button
            type="button"
            onClick={() => setShowReportForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-colors whitespace-nowrap"
          >
            {showReportForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showReportForm ? 'Cancel Report' : 'Report Incident'}
          </button>
          <button
            type="button"
            onClick={onExportPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors whitespace-nowrap"
          >
            <FileDown className="w-3.5 h-3.5" />
            Export PDF Report
          </button>
        </div>
      </div>

      {/* Operator Manual Incident Report Form */}
      {showReportForm && (
        <form
          onSubmit={handleCreateReport}
          className="bg-[#0D1424] border border-red-500/40 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Report Crowd Safety Incident</h3>
              <p className="text-xs text-slate-400">
                Log field observations directly into the Firestore emergency queue and alert response teams.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="block text-xs text-slate-400">Zone / Location</label>
              <input
                type="text"
                required
                value={reportLocation}
                onChange={(e) => setReportLocation(e.target.value)}
                className="w-full bg-[#070B14] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-slate-400">Est. Crowd Density (p/m²)</label>
              <input
                type="number"
                step="0.1"
                min="0.2"
                max="12"
                required
                value={reportDensity}
                onChange={(e) => setReportDensity(Number(e.target.value))}
                className="w-full bg-[#070B14] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-slate-400">Danger Level</label>
              <select
                value={reportDangerLevel}
                onChange={(e) => setReportDangerLevel(e.target.value as DangerLevel)}
                className="w-full bg-[#070B14] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-slate-400">Assign Security Team</label>
              <select
                value={reportTeam}
                onChange={(e) => setReportTeam(e.target.value)}
                className="w-full bg-[#070B14] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
              >
                {SECURITY_TEAMS.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs text-slate-400">
              Incident Details &amp; Recommended Preventive Action
            </label>
            <textarea
              required
              rows={2}
              value={reportAction}
              onChange={(e) => setReportAction(e.target.value)}
              placeholder="Describe bottleneck, crowd compression, or required gate/marshal intervention..."
              className="w-full bg-[#070B14] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submittingReport}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-xs font-medium transition-colors"
            >
              {submittingReport ? 'Submitting Incident...' : 'Submit Incident Report'}
            </button>
          </div>
        </form>
      )}

      {/* Emergency Response Management Section */}
      <div className="bg-[#0D1424] border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Emergency Response Incident Queue</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Assign response teams, advance incident status, and record timestamped operator actions
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#070B14] border border-slate-800 rounded-lg">
            {(['all', 'new', 'acknowledged', 'responding', 'resolved'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setAlertFilter(tab)}
                className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                  alertFilter === tab
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {filteredAlerts.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No incidents match the selected status filter.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filteredAlerts.map((alert) => {
              const isResolved = alert.status === 'resolved';
              return (
                <div key={alert.id} className="p-5 space-y-4 hover:bg-slate-900/20 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`inline-flex items-center gap-1 font-mono font-semibold ${
                            alert.dangerLevel === 'CRITICAL'
                              ? 'text-red-400'
                              : alert.dangerLevel === 'HIGH'
                              ? 'text-amber-400'
                              : 'text-blue-400'
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {alert.dangerLevel}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className="font-semibold text-white">{alert.location}</span>
                        <span className="text-slate-600">·</span>
                        <span className="font-mono text-slate-400">{alert.createdAtLabel}</span>
                        <span className="text-slate-600">·</span>
                        <span className="text-slate-400">
                          {alert.sourceKind === 'real_video_analysis'
                            ? 'Real OpenCV Video Analysis'
                            : alert.sourceKind === 'operator_manual_report'
                            ? 'Operator Incident Report'
                            : 'Simulated Prediction Data'}
                        </span>
                      </div>

                      <p className="text-sm text-slate-200">{alert.suggestedAction}</p>

                      <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
                        <span>Density: {alert.peoplePerSqm.toFixed(2)} p/m² ({alert.densityLevel})</span>
                        <span>Score: {alert.dangerScore}/100</span>
                        <span className="text-blue-300">Status: {alert.status.toUpperCase()}</span>
                      </div>
                    </div>

                    {/* Team Assignment + Status Stepper */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <label className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Users className="w-3.5 h-3.5 text-blue-400" />
                        <select
                          disabled={busyId === alert.id || isResolved}
                          value={alert.assignedTeam}
                          onChange={(e) =>
                            handleIncidentChange(
                              alert,
                              alert.status,
                              e.target.value,
                              `Assigned to ${e.target.value}`
                            )
                          }
                          className="bg-[#070B14] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none disabled:opacity-60"
                        >
                          {SECURITY_TEAMS.map((team) => (
                            <option key={team} value={team}>
                              {team}
                            </option>
                          ))}
                        </select>
                      </label>

                      {alert.status === 'new' && (
                        <button
                          type="button"
                          disabled={busyId === alert.id}
                          onClick={() =>
                            handleIncidentChange(alert, 'acknowledged', undefined, 'Incident acknowledged')
                          }
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 transition-colors whitespace-nowrap"
                        >
                          Acknowledge
                        </button>
                      )}

                      {(alert.status === 'new' || alert.status === 'acknowledged') && (
                        <button
                          type="button"
                          disabled={busyId === alert.id}
                          onClick={() =>
                            handleIncidentChange(
                              alert,
                              'responding',
                              undefined,
                              `${alert.assignedTeam} dispatched to sector`
                            )
                          }
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition-colors whitespace-nowrap"
                        >
                          Mark Responding
                        </button>
                      )}

                      {!isResolved && (
                        <button
                          type="button"
                          disabled={busyId === alert.id}
                          onClick={() =>
                            handleIncidentChange(alert, 'resolved', undefined, 'Incident resolved & cleared')
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-colors whitespace-nowrap"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Operator Action Log & Note Input */}
                  <div className="bg-[#0A101D] border border-slate-800/80 rounded-lg p-3 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-blue-400" />
                      <span>Incident Action History</span>
                    </div>
                    <ul className="space-y-1 text-xs font-mono text-slate-300">
                      {(alert.actionHistory.length > 0
                        ? alert.actionHistory
                        : ['No operator actions recorded yet.']
                      ).map((entry, idx) => (
                        <li key={idx}>{entry}</li>
                      ))}
                    </ul>

                    {!isResolved && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const note = (noteInputs[alert.id] || '').trim();
                          if (!note) return;
                          handleIncidentChange(alert, alert.status, undefined, note);
                        }}
                        className="flex items-center gap-2 pt-1"
                      >
                        <input
                          type="text"
                          value={noteInputs[alert.id] || ''}
                          onChange={(e) =>
                            setNoteInputs((prev) => ({ ...prev, [alert.id]: e.target.value }))
                          }
                          placeholder="Add operator dispatch note..."
                          className="flex-1 bg-[#070B14] border border-slate-800 focus:border-blue-500 focus:outline-none rounded-md px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500"
                        />
                        <button
                          type="submit"
                          disabled={busyId === alert.id || !(noteInputs[alert.id] || '').trim()}
                          className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs text-slate-200 font-medium whitespace-nowrap"
                        >
                          Log Note
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Gate Management Recommendations */}
      <div className="bg-[#0D1424] border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/80">
          <h2 className="text-base font-semibold text-white">Gate Management Recommendations (Operator Approval)</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Simulated relief &amp; inflow metering proposals awaiting human operator sign-off
          </p>
        </div>

        {gates.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No pending or reviewed gate recommendations yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {gates.map((gate) => (
              <div
                key={gate.id}
                className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <DoorOpen className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="font-semibold text-white">{gate.gateName}</span>
                    <span className="text-slate-600">·</span>
                    <span className="font-mono text-blue-400 font-medium">
                      {formatActionLabel(gate.recommendedAction)}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="font-mono text-emerald-400">
                      Est. -{gate.projectedDensityDrop}% peak density
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">{gate.reason}</p>
                  <p className="text-xs font-mono text-slate-400">
                    Approval Status: {gate.approvalStatus.toUpperCase()} · Logged {gate.createdAtLabel}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {gate.approvalStatus === 'pending' ? (
                    <>
                      <button
                        type="button"
                        disabled={busyId === gate.id}
                        onClick={() => handleGateDecision(gate.id, 'approved')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors whitespace-nowrap"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Approve Action
                      </button>
                      <button
                        type="button"
                        disabled={busyId === gate.id}
                        onClick={() => handleGateDecision(gate.id, 'rejected')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors whitespace-nowrap"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </>
                  ) : (
                    <span
                      className={`text-xs font-mono font-semibold ${
                        gate.approvalStatus === 'approved' ? 'text-emerald-400' : 'text-slate-400'
                      }`}
                    >
                      {gate.approvalStatus === 'approved' ? 'APPROVED BY OPERATOR' : 'REJECTED BY OPERATOR'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
