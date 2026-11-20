#!/usr/bin/env python3
"""
CROWGUARD Python OpenCV Video Processing & Optical Flow Engine.
Performs:
  1. Frame sampling from uploaded or sample CCTV video files
  2. Multi-stage pedestrian detection (HOG + foreground contour clustering + NMS)
  3. 4x3 spatial region crowd density estimation (LOW / MEDIUM / HIGH / CRITICAL)
  4. Dense Farneback Optical Flow velocity, direction & turbulence analysis
  5. Abnormal movement & bottleneck region detection (sudden stop, rapid surge, counterflow, congested exits)
  6. Thermal density heatmap generation (COLORMAP_JET overlay)
"""

import argparse
import base64
import json
import math
import os
import sys
import cv2
import numpy as np


GRID_COLS = 4
GRID_ROWS = 3
REGION_AREA_SQM = 3.2  # Calibrated spatial footprint per grid cell (~1.8m x 1.8m gate/corridor cell)


def classify_density(people_per_sqm: float) -> str:
    if people_per_sqm >= 4.5:
        return "CRITICAL"
    if people_per_sqm >= 3.0:
        return "HIGH"
    if people_per_sqm >= 1.5:
        return "MEDIUM"
    return "LOW"


def classify_safety(danger_score: float) -> str:
    if danger_score >= 75:
        return "CRITICAL"
    if danger_score >= 55:
        return "HIGH_RISK"
    if danger_score >= 30:
        return "ELEVATED"
    return "SAFE"


def encode_jpeg_data_url(image: np.ndarray, quality: int = 76) -> str:
    ok, buf = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        return ""
    b64 = base64.b64encode(buf.tobytes()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


def detect_people_in_frame(
    frame: np.ndarray,
    prev_gray: np.ndarray | None,
    curr_gray: np.ndarray,
    hog: cv2.HOGDescriptor,
    fgbg: cv2.BackgroundSubtractorMOG2,
) -> list[dict]:
    h, w = frame.shape[:2]
    boxes = []
    scores = []

    # 1. HOG Default People Detector (upright pedestrians)
    rects, weights = hog.detectMultiScale(
        frame,
        winStride=(8, 8),
        padding=(8, 8),
        scale=1.06,
    )
    for (x, y, bw, bh), weight in zip(rects, weights):
        conf = float(weight) if np.ndim(weight) == 0 else float(weight[0])
        if conf > 0.35 and 14 <= bw <= w * 0.45 and 22 <= bh <= h * 0.85:
            boxes.append([int(x), int(y), int(bw), int(bh)])
            scores.append(min(0.98, 0.55 + conf * 0.25))

    # 2. Motion + Adaptive Contrast Foreground Clustering
    fg_mask = fgbg.apply(frame)
    if prev_gray is not None:
        diff = cv2.absdiff(curr_gray, prev_gray)
        _, diff_mask = cv2.threshold(diff, 16, 255, cv2.THRESH_BINARY)
        fg_mask = cv2.bitwise_or(fg_mask, diff_mask)

    blurred = cv2.GaussianBlur(curr_gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 40, 120)
    kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 7))
    kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))

    combined_mask = cv2.bitwise_or(fg_mask, cv2.dilate(edges, kernel_open, iterations=1))
    combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_OPEN, kernel_open)
    combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel_close)

    contours, _ = cv2.findContours(combined_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    min_area = max(95, int((w * h) * 0.0004))
    max_area = int((w * h) * 0.12)

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area or area > max_area:
            continue
        x, y, bw, bh = cv2.boundingRect(cnt)
        if y < int(h * 0.08) and bw > int(w * 0.18):
            continue
        aspect = bh / max(1.0, float(bw))
        if 0.35 <= aspect <= 3.8 and 10 <= bw <= w * 0.45 and 12 <= bh <= h * 0.55:
            single_person_area = max(240.0, (w * h) * 0.0012)
            est_people = max(1, min(8, int(round(area / single_person_area))))
            if est_people > 1 and (bw > 24 or bh > 28):
                cols_split = max(1, min(4, int(round(bw / 18.0))))
                rows_split = max(1, min(3, (est_people + cols_split - 1) // cols_split))
                sub_w = max(12, bw // cols_split)
                sub_h = max(14, bh // rows_split)
                emitted = 0
                for rr in range(rows_split):
                    for cc in range(cols_split):
                        if emitted >= est_people:
                            break
                        sx = x + cc * sub_w
                        sy = y + rr * sub_h
                        boxes.append([int(sx), int(sy), int(sub_w), int(sub_h)])
                        scores.append(0.74)
                        emitted += 1
            else:
                boxes.append([int(x), int(y), int(bw), int(bh)])
                scores.append(0.76)

    if not boxes:
        return []

    indices = cv2.dnn.NMSBoxes(boxes, scores, score_threshold=0.35, nms_threshold=0.42)
    detections = []
    if len(indices) > 0:
        flat_idx = indices.flatten() if hasattr(indices, "flatten") else [i[0] for i in indices]
        for idx in flat_idx:
            x, y, bw, bh = boxes[idx]
            detections.append(
                {
                    "x": round(x / w, 4),
                    "y": round(y / h, 4),
                    "w": round(bw / w, 4),
                    "h": round(bh / h, 4),
                    "cx": round((x + bw * 0.5) / w, 4),
                    "cy": round((y + bh * 0.5) / h, 4),
                    "confidence": round(float(scores[idx]), 2),
                }
            )

    return detections


def build_heatmap_overlay(frame: np.ndarray, detections: list[dict], bottlenecks: list[dict]) -> str:
    h, w = frame.shape[:2]
    heat = np.zeros((h, w), dtype=np.float32)

    sigma = max(18, int(min(w, h) * 0.065))
    for det in detections:
        cx = min(w - 1, max(0, int(det["cx"] * w)))
        cy = min(h - 1, max(0, int(det["cy"] * h)))
        cv2.circle(heat, (cx, cy), max(8, sigma // 2), 1.0, -1)

    if detections:
        ksize = sigma * 2 + 1
        heat = cv2.GaussianBlur(heat, (ksize, ksize), sigma * 0.55)
        max_val = float(np.max(heat))
        if max_val > 0:
            heat = np.clip((heat / max(max_val, 0.35)) * 255.0, 0, 255).astype(np.uint8)
        else:
            heat = heat.astype(np.uint8)
    else:
        heat = heat.astype(np.uint8)

    colored = cv2.applyColorMap(heat, cv2.COLORMAP_JET)
    alpha = np.clip(heat.astype(np.float32) / 255.0, 0.0, 0.72)[..., None]
    blended = (frame.astype(np.float32) * (1.0 - alpha * 0.75) + colored.astype(np.float32) * (alpha * 0.85))
    blended = np.clip(blended, 0, 255).astype(np.uint8)

    # Highlight congestion bottleneck regions directly on the heatmap image
    cell_w = w / GRID_COLS
    cell_h = h / GRID_ROWS
    for bn in bottlenecks:
        x0 = int(bn["col"] * cell_w) + 3
        y0 = int(bn["row"] * cell_h) + 3
        x1 = int((bn["col"] + 1) * cell_w) - 3
        y1 = int((bn["row"] + 1) * cell_h) - 3
        cv2.rectangle(blended, (x0, y0), (x1, y1), (0, 215, 255), 2)
        cv2.putText(
            blended,
            bn["type"].replace("_", " "),
            (x0 + 4, y1 - 8),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.34,
            (255, 255, 255),
            1,
            cv2.LINE_AA,
        )

    return encode_jpeg_data_url(blended, quality=72)


def compute_optical_flow_metrics(prev_gray: np.ndarray | None, curr_gray: np.ndarray) -> dict:
    h, w = curr_gray.shape[:2]
    if prev_gray is None:
        return {
            "avgSpeedPx": 0.0,
            "speedMps": 0.0,
            "dominantAngleDeg": 0.0,
            "directionalVariance": 0.0,
            "vectors": [],
            "regionMetrics": {},
        }

    flow = cv2.calcOpticalFlowFarneback(
        prev_gray,
        curr_gray,
        None,
        pyr_scale=0.5,
        levels=3,
        winsize=15,
        iterations=3,
        poly_n=5,
        poly_sigma=1.2,
        flags=0,
    )

    mag, ang = cv2.cartToPolar(flow[..., 0], flow[..., 1])
    active_mask = mag > 0.45
    active_mags = mag[active_mask]

    if active_mags.size > 0:
        avg_speed_px = float(np.mean(active_mags))
        active_angs = ang[active_mask]
        sin_mean = float(np.mean(np.sin(active_angs)))
        cos_mean = float(np.mean(np.cos(active_angs)))
        r_len = math.hypot(cos_mean, sin_mean)
        directional_variance = round(max(0.0, min(1.0, 1.0 - r_len)), 3)
        dom_angle = (math.degrees(math.atan2(sin_mean, cos_mean)) + 360.0) % 360.0
    else:
        avg_speed_px = 0.0
        directional_variance = 0.0
        dom_angle = 0.0

    # Per-region Optical Flow telemetry for abnormal movement & bottleneck localization
    region_metrics = {}
    cell_h = h // GRID_ROWS
    cell_w = w // GRID_COLS
    for r in range(GRID_ROWS):
        for c in range(GRID_COLS):
            y0, y1 = r * cell_h, (r + 1) * cell_h if r < GRID_ROWS - 1 else h
            x0, x1 = c * cell_w, (c + 1) * cell_w if c < GRID_COLS - 1 else w
            sub_mag = mag[y0:y1, x0:x1]
            sub_ang = ang[y0:y1, x0:x1]
            sub_active = sub_mag > 0.35
            if np.any(sub_active):
                rm_speed = float(np.mean(sub_mag[sub_active])) * 0.22
                sa = sub_ang[sub_active]
                r_vec = math.hypot(float(np.mean(np.cos(sa))), float(np.mean(np.sin(sa))))
                rm_var = max(0.0, min(1.0, 1.0 - r_vec))
            else:
                rm_speed = 0.0
                rm_var = 0.0
            region_metrics[f"R{r + 1}-C{c + 1}"] = {
                "speedMps": round(min(3.5, rm_speed), 2),
                "variance": round(rm_var, 3),
            }

    vectors = []
    cols, rows = 16, 10
    step_x = max(1, w // cols)
    step_y = max(1, h // rows)
    for r in range(rows):
        for c in range(cols):
            py = min(h - 1, r * step_y + step_y // 2)
            px = min(w - 1, c * step_x + step_x // 2)
            vx = float(flow[py, px, 0])
            vy = float(flow[py, px, 1])
            m = math.hypot(vx, vy)
            if m >= 0.35:
                vectors.append(
                    {
                        "x": round(px / w, 3),
                        "y": round(py / h, 3),
                        "vx": round(vx, 2),
                        "vy": round(vy, 2),
                        "mag": round(m, 2),
                    }
                )

    speed_mps = round(min(3.5, avg_speed_px * 0.22), 2)
    return {
        "avgSpeedPx": round(avg_speed_px, 2),
        "speedMps": speed_mps,
        "dominantAngleDeg": round(dom_angle, 1),
        "directionalVariance": directional_variance,
        "vectors": vectors,
        "regionMetrics": region_metrics,
    }


def detect_region_anomalies_and_bottlenecks(
    regions: list[dict],
    region_flow: dict,
    prev_region_speeds: dict,
) -> tuple[list[dict], list[dict]]:
    suspicious = []
    bottlenecks = []

    for reg in regions:
        rid = reg["id"]
        rf = region_flow.get(rid, {"speedMps": 0.0, "variance": 0.0})
        prev_sp = prev_region_speeds.get(rid)
        density = reg["densityPerSqm"]
        speed = rf["speedMps"]
        var = rf["variance"]

        # Abnormal movement localization
        if prev_sp is not None and prev_sp > 0.55 and speed < 0.25 and reg["count"] >= 4:
            suspicious.append({
                "id": rid,
                "row": reg["row"],
                "col": reg["col"],
                "reason": "SUDDEN_STOPPING",
                "severity": "CRITICAL" if density >= 3.0 else "HIGH",
            })
        elif var >= 0.5 and reg["count"] >= 4:
            suspicious.append({
                "id": rid,
                "row": reg["row"],
                "col": reg["col"],
                "reason": "UNUSUAL_DIRECTION",
                "severity": "HIGH" if density >= 2.5 else "MEDIUM",
            })
        elif speed >= 1.55 and reg["count"] >= 5:
            suspicious.append({
                "id": rid,
                "row": reg["row"],
                "col": reg["col"],
                "reason": "RAPID_CROWD_SURGE",
                "severity": "HIGH",
            })

        # Bottleneck classification by spatial position + compression
        if density >= 3.0:
            if reg["col"] == 0:
                btype = "CONGESTED_ENTRANCE"
            elif reg["col"] == GRID_COLS - 1:
                btype = "BLOCKED_EXIT" if speed < 0.4 else "CONGESTED_EXIT"
            else:
                btype = "NARROW_PASSAGE"
            bottlenecks.append({
                "id": rid,
                "row": reg["row"],
                "col": reg["col"],
                "type": btype,
                "densityPerSqm": density,
                "speedMps": speed,
            })

    return suspicious, bottlenecks


def analyze_video(video_path: str, max_frames: int = 10) -> dict:
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"OpenCV failed to open video: {video_path}")

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    fps = float(cap.get(cv2.CAP_PROP_FPS)) or 24.0
    if fps <= 0 or math.isnan(fps):
        fps = 24.0
    duration_sec = round(total_frames / fps, 2) if total_frames > 0 else 0.0

    hog = cv2.HOGDescriptor()
    hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
    fgbg = cv2.createBackgroundSubtractorMOG2(history=120, varThreshold=28, detectShadows=False)

    sample_stride = max(1, total_frames // max(1, max_frames)) if total_frames > 0 else 5

    frames_out = []
    prev_gray = None
    prev_speed_mps = None
    prev_region_speeds = {}
    frame_idx = 0
    target_width = 640
    out_w, out_h = 640, 360

    while len(frames_out) < max_frames:
        ok, frame = cap.read()
        if not ok:
            break

        h, w = frame.shape[:2]
        scale = target_width / float(w)
        resized = cv2.resize(frame, (target_width, max(180, int(h * scale))))
        out_h, out_w = resized.shape[:2]
        curr_gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)

        if frame_idx % sample_stride == 0 or len(frames_out) == 0:
            detections = detect_people_in_frame(resized, prev_gray, curr_gray, hog, fgbg)
            flow_metrics = compute_optical_flow_metrics(prev_gray, curr_gray)
            region_flow = flow_metrics.pop("regionMetrics", {})

            regions = []
            for r in range(GRID_ROWS):
                for c in range(GRID_COLS):
                    x0, x1 = c / GRID_COLS, (c + 1) / GRID_COLS
                    y0, y1 = r / GRID_ROWS, (r + 1) / GRID_ROWS
                    count = sum(
                        1
                        for d in detections
                        if x0 <= d["cx"] < x1 and y0 <= d["cy"] < y1
                    )
                    density = round(count / REGION_AREA_SQM, 2)
                    rid = f"R{r + 1}-C{c + 1}"
                    rf = region_flow.get(rid, {"speedMps": 0.0, "variance": 0.0})
                    regions.append(
                        {
                            "id": rid,
                            "row": r,
                            "col": c,
                            "count": count,
                            "densityPerSqm": density,
                            "level": classify_density(density),
                            "speedMps": rf["speedMps"],
                            "turbulence": rf["variance"],
                        }
                    )

            suspicious_regions, bottleneck_regions = detect_region_anomalies_and_bottlenecks(
                regions, region_flow, prev_region_speeds
            )

            peak_density = max((reg["densityPerSqm"] for reg in regions), default=0.0)
            avg_density = round(
                sum(reg["densityPerSqm"] for reg in regions) / max(1, len(regions)), 2
            )

            anomalies = []
            if peak_density >= 4.5 or any(reg["level"] == "CRITICAL" for reg in regions):
                anomalies.append("OVERCROWDING")
            if (
                prev_speed_mps is not None
                and prev_speed_mps > 0.55
                and flow_metrics["speedMps"] < 0.25
                and len(detections) >= 8
            ):
                anomalies.append("SUDDEN_STOPPING")
            if flow_metrics["directionalVariance"] >= 0.48 and len(detections) >= 8:
                anomalies.append("IRREGULAR_MOVEMENT")
            if flow_metrics["speedMps"] >= 1.55 and len(detections) >= 12:
                anomalies.append("RAPID_SURGE")
            if (
                peak_density >= 3.0
                and flow_metrics["speedMps"] < 0.35
                and len(detections) >= 12
            ):
                anomalies.append("BOTTLENECK_STALL")

            # Transparent Danger Score (0 - 100) incorporating density, speed stall, turbulence & bottlenecks
            density_score = min(40.0, (peak_density / 5.5) * 40.0)
            stall_factor = (
                max(0.0, 1.0 - (flow_metrics["speedMps"] / 1.1))
                if peak_density >= 1.5
                else 0.15
            )
            stall_score = min(25.0, stall_factor * 25.0 * min(1.0, peak_density / 3.5))
            turbulence_score = min(20.0, flow_metrics["directionalVariance"] * 20.0)
            congestion_score = min(15.0, len(bottleneck_regions) * 4.5)
            danger_score = round(
                min(100.0, density_score + stall_score + turbulence_score + congestion_score), 1
            )

            heatmap_url = build_heatmap_overlay(resized, detections, bottleneck_regions)
            raw_url = encode_jpeg_data_url(resized, quality=76)

            frames_out.append(
                {
                    "frameIndex": frame_idx,
                    "timestampSec": round(frame_idx / fps, 2),
                    "peopleCount": len(detections),
                    "detections": detections,
                    "regions": regions,
                    "suspiciousRegions": suspicious_regions,
                    "bottleneckRegions": bottleneck_regions,
                    "peakDensityPerSqm": peak_density,
                    "avgDensityPerSqm": avg_density,
                    "densityLevel": classify_density(peak_density),
                    "opticalFlow": flow_metrics,
                    "anomalies": anomalies,
                    "dangerScore": danger_score,
                    "safetyStatus": classify_safety(danger_score),
                    "rawFrameUrl": raw_url,
                    "heatmapFrameUrl": heatmap_url,
                }
            )
            prev_speed_mps = flow_metrics["speedMps"]
            prev_region_speeds = {
                rid: rf["speedMps"] for rid, rf in region_flow.items()
            }
        else:
            fgbg.apply(resized)

        prev_gray = curr_gray
        frame_idx += 1

    cap.release()

    if not frames_out:
        raise RuntimeError("No readable video frames found in uploaded file.")

    max_people = max(f["peopleCount"] for f in frames_out)
    avg_people = round(sum(f["peopleCount"] for f in frames_out) / len(frames_out))
    peak_density_overall = max(f["peakDensityPerSqm"] for f in frames_out)
    peak_danger = max(f["dangerScore"] for f in frames_out)
    all_anomalies = sorted({a for f in frames_out for a in f["anomalies"]})

    # Collect unique bottleneck locations across sampled frames
    bottleneck_map = {}
    for f in frames_out:
        for bn in f.get("bottleneckRegions", []):
            existing_bn = bottleneck_map.get(bn["id"])
            if not existing_bn or bn["densityPerSqm"] > existing_bn["densityPerSqm"]:
                bottleneck_map[bn["id"]] = bn

    if "SUDDEN_STOPPING" in all_anomalies:
        movement_pattern = "Sudden Crowd Stoppage / Shockwave"
    elif "RAPID_SURGE" in all_anomalies:
        movement_pattern = "Rapid Crowd Surge Velocity"
    elif "IRREGULAR_MOVEMENT" in all_anomalies:
        movement_pattern = "Turbulent Counterflow / Irregular Vectors"
    elif "BOTTLENECK_STALL" in all_anomalies:
        movement_pattern = "Bottleneck Compression & Slowdown"
    elif "OVERCROWDING" in all_anomalies:
        movement_pattern = "High-Density Convergence"
    else:
        movement_pattern = "Steady Laminar Pedestrian Flow"

    return {
        "engine": "opencv_python",
        "opencvVersion": cv2.__version__,
        "analysisSource": "real_opencv_video",
        "totalVideoFrames": total_frames,
        "sampledFrames": len(frames_out),
        "fps": round(fps, 2),
        "durationSec": duration_sec,
        "width": out_w,
        "height": out_h,
        "summary": {
            "maxPeopleDetected": max_people,
            "avgPeopleDetected": avg_people,
            "peakDensityPerSqm": peak_density_overall,
            "densityLevel": classify_density(peak_density_overall),
            "peakDangerScore": peak_danger,
            "safetyStatus": classify_safety(peak_danger),
            "movementPattern": movement_pattern,
            "anomalyFlags": all_anomalies,
            "bottleneckRegions": list(bottleneck_map.values()),
        },
        "frames": frames_out,
    }


def main():
    parser = argparse.ArgumentParser(description="CROWGUARD OpenCV Video Analyzer")
    parser.add_argument("--video", required=True, help="Path to CCTV video file")
    parser.add_argument("--max-frames", type=int, default=10, help="Max sampled frames")
    args = parser.parse_args()

    try:
        result = analyze_video(args.video, max_frames=args.max_frames)
        print(json.dumps(result))
    except Exception as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
