import React, { useEffect, useRef, useState } from 'react';
import {
  Upload,
  Play,
  Layers,
  Grid,
  Navigation,
  Flame,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Film,
  Camera,
  Trash2,
  AlertOctagon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import type {
  CameraFeedItem,
  OpenCVAnalysisResult,
  SimulationScenarioId,
} from '../types/crowguard';
import { SIMULATION_SCENARIOS } from '../lib/crowdAnalytics';

interface CCTVAnalyzerViewProps {
  cameraFeeds: CameraFeedItem[];
  activeFeedId: string | null;
  onSelectFeed: (feedId: string) => void;
  onRemoveFeed: (feedId: string) => void;
  analyzing: boolean;
  analyzeError: string | null;
  onUploadVideos: (files: File[]) => Promise<void>;
  onRunSampleOpenCV: (scenario: SimulationScenarioId) => Promise<void>;
  onSaveAnalysisToRecords: (analysis: OpenCVAnalysisResult) => Promise<void>;
  isSignedIn: boolean;
  savingSession: boolean;
  saveMessage: string | null;
}

export const CCTVAnalyzerView: React.FC<CCTVAnalyzerViewProps> = ({
  cameraFeeds,
  activeFeedId,
  onSelectFeed,
  onRemoveFeed,
  analyzing,
  analyzeError,
  onUploadVideos,
  onRunSampleOpenCV,
  onSaveAnalysisToRecords,
  isSignedIn,
  savingSession,
  saveMessage,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [selectedFrameIdx, setSelectedFrameIdx] = useState(0);
  const [showBoxes, setShowBoxes] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showFlow, setShowFlow] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showSuspicious, setShowSuspicious] = useState(true);
  const [dragActive, setDragActive] = useState(false);

  const activeFeed =
    cameraFeeds.find((f) => f.id === activeFeedId) ?? cameraFeeds[0] ?? null;
  const analysis = activeFeed?.analysis ?? null;

  useEffect(() => {
    setSelectedFrameIdx(0);
  }, [activeFeedId]);

  const activeFrame =
    analysis?.frames[selectedFrameIdx] ?? analysis?.frames[0] ?? null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeFrame) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgSrc =
      showHeatmap && activeFrame.heatmapFrameUrl
        ? activeFrame.heatmapFrameUrl
        : activeFrame.rawFrameUrl;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width || 640;
      canvas.height = img.height || 360;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // 1. 4x3 Spatial Density Grid
      if (showGrid && activeFrame.regions.length > 0) {
        const cols = 4;
        const rows = 3;
        const cellW = canvas.width / cols;
        const cellH = canvas.height / rows;

        activeFrame.regions.forEach((cell) => {
          const x = cell.col * cellW;
          const y = cell.row * cellH;
          let fill = 'rgba(16, 185, 129, 0.06)';
          let stroke = 'rgba(148, 163, 184, 0.25)';
          let labelColor = '#34D399';
          if (cell.level === 'CRITICAL') {
            fill = 'rgba(239, 68, 68, 0.22)';
            stroke = 'rgba(239, 68, 68, 0.72)';
            labelColor = '#FCA5A5';
          } else if (cell.level === 'HIGH') {
            fill = 'rgba(245, 158, 11, 0.16)';
            stroke = 'rgba(245, 158, 11, 0.60)';
            labelColor = '#FCD34D';
          } else if (cell.level === 'MEDIUM') {
            fill = 'rgba(59, 130, 246, 0.12)';
            stroke = 'rgba(59, 130, 246, 0.45)';
            labelColor = '#93C5FD';
          }

          ctx.fillStyle = fill;
          ctx.fillRect(x, y, cellW, cellH);
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, cellW, cellH);

          ctx.fillStyle = 'rgba(7, 11, 20, 0.8)';
          ctx.fillRect(x + 4, y + 4, 88, 18);
          ctx.fillStyle = labelColor;
          ctx.font = '600 10px "JetBrains Mono", monospace';
          ctx.fillText(`${cell.id} ${cell.level}`, x + 8, y + 16);
        });
      }

      // 2. Abnormal Movement & Bottleneck Regions Highlight
      if (showSuspicious) {
        const cols = 4;
        const rows = 3;
        const cellW = canvas.width / cols;
        const cellH = canvas.height / rows;

        (activeFrame.suspiciousRegions || []).forEach((sr) => {
          const x = sr.col * cellW + 3;
          const y = sr.row * cellH + 3;
          ctx.save();
          ctx.setLineDash([5, 4]);
          ctx.strokeStyle = sr.severity === 'CRITICAL' ? '#EF4444' : '#F59E0B';
          ctx.lineWidth = 2.4;
          ctx.strokeRect(x, y, cellW - 6, cellH - 6);
          ctx.restore();

          ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
          ctx.fillRect(x + 2, y + cellH - 24, Math.min(cellW - 10, 128), 16);
          ctx.fillStyle = '#070B14';
          ctx.font = '700 9.5px "JetBrains Mono", monospace';
          ctx.fillText(sr.reason.replace(/_/g, ' '), x + 6, y + cellH - 12);
        });
      }

      // 3. Farneback Optical Flow Vectors
      if (showFlow && activeFrame.opticalFlow.vectors.length > 0) {
        activeFrame.opticalFlow.vectors.forEach((vec) => {
          const px = vec.x * canvas.width;
          const py = vec.y * canvas.height;
          const scale = 6.5;
          const ex = px + Math.max(-24, Math.min(24, vec.vx * scale));
          const ey = py + Math.max(-24, Math.min(24, vec.vy * scale));

          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          const angle = Math.atan2(ey - py, ex - px);
          ctx.fillStyle = '#38BDF8';
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex - 5 * Math.cos(angle - Math.PI / 6), ey - 5 * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(ex - 5 * Math.cos(angle + Math.PI / 6), ey - 5 * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fill();
        });
      }

      // 4. OpenCV People Bounding Boxes
      if (showBoxes && activeFrame.detections.length > 0) {
        activeFrame.detections.forEach((det) => {
          const bx = det.x * canvas.width;
          const by = det.y * canvas.height;
          const bw = det.w * canvas.width;
          const bh = det.h * canvas.height;

          ctx.strokeStyle = activeFrame.dangerScore >= 70 ? '#EF4444' : '#3B82F6';
          ctx.lineWidth = 1.8;
          ctx.strokeRect(bx, by, bw, bh);
        });
      }
    };
    img.src = imgSrc;
  }, [activeFrame, showBoxes, showGrid, showFlow, showHeatmap, showSuspicious]);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    await onUploadVideos(Array.from(fileList));
  };

  const comparisonData = cameraFeeds.map((f) => ({
    name: f.cameraLabel,
    zone: f.zoneName,
    dangerScore: f.analysis.summary.peakDangerScore,
    density: f.analysis.summary.peakDensityPerSqm,
    people: f.analysis.summary.maxPeopleDetected,
  }));

  return (
    <div className="space-y-6">
      {/* Multi-Video Upload & Sample Camera Builder */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            handleFilesSelected(e.dataTransfer.files);
          }}
          className={`xl:col-span-5 bg-[#0D1424] border rounded-xl p-5 flex flex-col justify-between gap-4 transition-colors ${
            dragActive ? 'border-blue-500 bg-blue-950/20' : 'border-slate-800/80'
          }`}
        >
          <div>
            <h2 className="text-base font-semibold text-white">Multi-Camera CCTV Upload</h2>
            <p className="text-xs text-slate-400 mt-1">
              Upload one or multiple CCTV clips simultaneously. Each feed runs through Python OpenCV pedestrian detection, bottleneck scanning, and Farneback Optical Flow.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,.mp4,.mov,.webm,.avi"
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={analyzing}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium transition-colors whitespace-nowrap"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing OpenCV Feeds...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload CCTV Video(s)
                </>
              )}
            </button>
            <span className="text-xs text-slate-400">Multi-select supported · MP4, MOV, WebM</span>
          </div>

          {analyzeError && (
            <div className="flex items-start gap-2 text-xs text-red-400 bg-red-950/30 border border-red-500/30 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{analyzeError}</span>
            </div>
          )}
        </div>

        <div className="xl:col-span-7 bg-[#0D1424] border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white">Add Sample Camera Feeds (OpenCV Pipeline)</h2>
            <p className="text-xs text-slate-400 mt-1">
              Add multiple simulated CCTV camera feeds side-by-side to monitor and compare zone risk levels simultaneously.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {SIMULATION_SCENARIOS.map((sc) => (
              <button
                key={sc.id}
                type="button"
                disabled={analyzing}
                onClick={() => onRunSampleOpenCV(sc.id)}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-[#0A101D] hover:bg-slate-800/70 border border-slate-800 hover:border-blue-500/40 text-left transition-colors disabled:opacity-50"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-100 truncate">{sc.title}</p>
                  <p className="text-[11px] text-slate-400 truncate">{sc.location}</p>
                </div>
                <Play className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Multi-Camera Feed Wall + Risk Comparison */}
      {cameraFeeds.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <div className="xl:col-span-8 bg-[#0D1424] border border-slate-800/80 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Active Camera Feed Matrix ({cameraFeeds.length})</h2>
                <p className="text-xs text-slate-400">Select any feed card to inspect frames, bounding boxes, and Optical Flow vectors below</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {cameraFeeds.map((feed) => {
                const isSelected = activeFeed?.id === feed.id;
                const s = feed.analysis.summary;
                const latestFrame = feed.analysis.frames[feed.analysis.frames.length - 1];
                return (
                  <div
                    key={feed.id}
                    onClick={() => onSelectFeed(feed.id)}
                    className={`rounded-xl border overflow-hidden cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#0E172A] border-blue-500'
                        : 'bg-[#0A101D] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="relative aspect-video bg-black">
                      {latestFrame?.rawFrameUrl && (
                        <img
                          src={latestFrame.heatmapFrameUrl || latestFrame.rawFrameUrl}
                          alt={feed.cameraLabel}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/80 text-[11px] font-mono text-white flex items-center gap-1.5">
                        <Camera className="w-3 h-3 text-blue-400" />
                        {feed.cameraLabel} · {feed.zoneName}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveFeed(feed.id);
                        }}
                        className="absolute top-2 right-2 p-1 rounded bg-black/75 text-slate-300 hover:text-red-400"
                        aria-label={`Remove ${feed.cameraLabel}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="p-3 flex items-center justify-between gap-2 text-xs">
                      <div className="font-mono text-slate-300">
                        <span className="text-white font-semibold">{s.maxPeopleDetected}</span> pax ·{' '}
                        <span className="text-amber-400">{s.peakDensityPerSqm.toFixed(1)} p/m²</span>
                      </div>
                      <span
                        className={`font-mono font-semibold ${
                          s.peakDangerScore >= 75
                            ? 'text-red-400'
                            : s.peakDangerScore >= 55
                            ? 'text-amber-400'
                            : s.peakDangerScore >= 30
                            ? 'text-blue-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        Risk {s.peakDangerScore}/100 ({s.densityLevel})
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="xl:col-span-4 bg-[#0D1424] border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Cross-Camera Zone Risk Comparison</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Live danger score comparison across monitored camera feeds
              </p>
            </div>

            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis dataKey="name" stroke="#64748B" tick={{ fontSize: 11 }} />
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
                  <Bar dataKey="dangerScore" name="Danger Score" radius={[4, 4, 0, 0]}>
                    {comparisonData.map((entry, idx) => (
                      <Cell
                        key={`cell-${idx}`}
                        fill={
                          entry.dangerScore >= 75
                            ? '#EF4444'
                            : entry.dangerScore >= 55
                            ? '#F59E0B'
                            : entry.dangerScore >= 30
                            ? '#3B82F6'
                            : '#10B981'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="text-xs text-slate-400 border-t border-slate-800/80 pt-3">
              Highest Risk Feed:{' '}
              <span className="font-semibold text-white">
                {comparisonData.slice().sort((a, b) => b.dangerScore - a.dangerScore)[0]?.name || '—'}
              </span>{' '}
              ({comparisonData.slice().sort((a, b) => b.dangerScore - a.dangerScore)[0]?.zone || '—'})
            </div>
          </div>
        </div>
      )}

      {/* Detailed Frame Inspector for Selected Camera Feed */}
      {analysis && activeFrame && activeFeed ? (
        <div className="bg-[#0D1424] border border-slate-800/80 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Film className="w-4 h-4 text-blue-400" />
                <span>
                  Inspecting {activeFeed.cameraLabel} — {activeFeed.zoneName}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Real Video Analysis · OpenCV {analysis.opencvVersion} · {analysis.sampledFrames} frames · Pattern: {analysis.summary.movementPattern}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBoxes((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                  showBoxes
                    ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Bounding Boxes
              </button>
              <button
                type="button"
                onClick={() => setShowGrid((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                  showGrid
                    ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                4×3 Density Grid
              </button>
              <button
                type="button"
                onClick={() => setShowFlow((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                  showFlow
                    ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                Optical Flow
              </button>
              <button
                type="button"
                onClick={() => setShowSuspicious((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                  showSuspicious
                    ? 'bg-amber-600/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                Abnormal Regions
              </button>
              <button
                type="button"
                onClick={() => setShowHeatmap((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                  showHeatmap
                    ? 'bg-red-600/20 text-red-300 border-red-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                Thermal &amp; Bottlenecks
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-5">
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Annotated Frame Canvas (OpenCV HOG + Farneback Optical Flow + Bottleneck Highlight)</span>
                <span className="font-mono text-slate-300">
                  t = {activeFrame.timestampSec.toFixed(2)}s · Frame #{activeFrame.frameIndex}
                </span>
              </div>
              <div className="bg-[#070B14] border border-slate-800 rounded-lg overflow-hidden">
                <canvas ref={canvasRef} className="w-full h-auto block" />
              </div>

              <div className="bg-[#0A101D] border border-slate-800/80 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Sampled Frame Scrubber</span>
                  <span className="font-mono text-slate-200">
                    {selectedFrameIdx + 1} / {analysis.frames.length}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, analysis.frames.length - 1)}
                  value={selectedFrameIdx}
                  onChange={(e) => setSelectedFrameIdx(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4">
              {activeFeed.videoUrl && (
                <div className="space-y-1.5">
                  <span className="text-xs text-slate-400">Camera Video Playback ({activeFeed.sourceLabel})</span>
                  <video
                    key={activeFeed.videoUrl}
                    src={activeFeed.videoUrl}
                    controls
                    loop
                    muted
                    playsInline
                    className="w-full rounded-lg border border-slate-800 bg-black aspect-video"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0A101D] border border-slate-800/80 rounded-lg p-3">
                  <p className="text-[11px] text-slate-400">Detected People (Frame)</p>
                  <p className="text-2xl font-mono font-semibold text-white mt-0.5">
                    {activeFrame.peopleCount}
                  </p>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                    Clip Max: {analysis.summary.maxPeopleDetected}
                  </p>
                </div>

                <div className="bg-[#0A101D] border border-slate-800/80 rounded-lg p-3">
                  <p className="text-[11px] text-slate-400">Peak Region Density</p>
                  <p
                    className={`text-2xl font-mono font-semibold mt-0.5 ${
                      activeFrame.densityLevel === 'CRITICAL'
                        ? 'text-red-400'
                        : activeFrame.densityLevel === 'HIGH'
                        ? 'text-amber-400'
                        : 'text-blue-400'
                    }`}
                  >
                    {activeFrame.peakDensityPerSqm.toFixed(2)} p/m²
                  </p>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                    Level: {activeFrame.densityLevel}
                  </p>
                </div>

                <div className="bg-[#0A101D] border border-slate-800/80 rounded-lg p-3">
                  <p className="text-[11px] text-slate-400">Optical Flow Speed</p>
                  <p className="text-2xl font-mono font-semibold text-blue-400 mt-0.5">
                    {activeFrame.opticalFlow.speedMps.toFixed(2)} m/s
                  </p>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                    Turbulence: {Math.round(activeFrame.opticalFlow.directionalVariance * 100)}%
                  </p>
                </div>

                <div className="bg-[#0A101D] border border-slate-800/80 rounded-lg p-3">
                  <p className="text-[11px] text-slate-400">Frame Danger Score</p>
                  <p
                    className={`text-2xl font-mono font-semibold mt-0.5 ${
                      activeFrame.dangerScore >= 75
                        ? 'text-red-400'
                        : activeFrame.dangerScore >= 55
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {activeFrame.dangerScore}/100
                  </p>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                    Status: {activeFrame.safetyStatus}
                  </p>
                </div>
              </div>

              <div className="bg-[#0A101D] border border-slate-800/80 rounded-lg p-3.5 space-y-2">
                <p className="text-xs font-medium text-slate-300">Abnormal Movement &amp; Bottleneck Regions</p>
                {(activeFrame.suspiciousRegions?.length || 0) > 0 || (activeFrame.bottleneckRegions?.length || 0) > 0 ? (
                  <div className="space-y-1 text-xs font-mono">
                    {activeFrame.suspiciousRegions?.map((sr, idx) => (
                      <p key={`sr-${idx}`} className="text-amber-300">
                        • {sr.id}: {sr.reason.replace(/_/g, ' ')} ({sr.severity})
                      </p>
                    ))}
                    {activeFrame.bottleneckRegions?.map((bn, idx) => (
                      <p key={`bn-${idx}`} className="text-red-300">
                        • {bn.id}: {bn.type.replace(/_/g, ' ')} ({bn.densityPerSqm.toFixed(1)} p/m²)
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    No abnormal movement pockets or blocked bottlenecks in this frame.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  disabled={savingSession}
                  onClick={() => onSaveAnalysisToRecords(analysis)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-medium transition-colors whitespace-nowrap"
                >
                  {savingSession ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  {isSignedIn ? 'Persist Feed & Alerts to Firestore' : 'Apply Feed Analysis to Dashboard'}
                </button>
                {saveMessage && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {saveMessage}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#0D1424] border border-slate-800/80 rounded-xl p-10 text-center space-y-3">
          <p className="text-sm font-medium text-white">No CCTV Camera Feeds Loaded Yet</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Upload multiple CCTV video clips or add sample camera scenarios above to compare zone risk levels and inspect OpenCV detections, abnormal movement regions, and bottlenecks.
          </p>
        </div>
      )}
    </div>
  );
};
