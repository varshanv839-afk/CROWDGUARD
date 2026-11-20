#!/usr/bin/env python3
"""
CROWGUARD Sample CCTV Video Generator.
Uses OpenCV + FFmpeg (libx264) to generate realistic synthetic CCTV MP4 clips
for Simulation Mode so the exact same Python OpenCV + Optical Flow analyzer
processes playable sample footage with zero external video dependencies.
"""

import argparse
import json
import math
import os
import random
import subprocess
import sys
import cv2
import numpy as np


WIDTH = 640
HEIGHT = 360
FPS = 18
DURATION_SEC = 5


def draw_concourse_background(scenario: str) -> np.ndarray:
    img = np.zeros((HEIGHT, WIDTH, 3), dtype=np.uint8)
    # Dark asphalt / terrazzo concourse floor
    img[:] = (56, 62, 72)

    # Subtle tile grid perspective lines
    for x in range(0, WIDTH, 48):
        cv2.line(img, (x, 0), (x, HEIGHT), (68, 75, 86), 1)
    for y in range(0, HEIGHT, 48):
        cv2.line(img, (0, y), (WIDTH, y), (68, 75, 86), 1)

    # Gate walls / barriers depending on scenario
    if scenario == "stadium_bottleneck":
        # Narrow funnel gate on the right side (Gate B2)
        cv2.rectangle(img, (WIDTH - 58, 0), (WIDTH, 115), (34, 38, 46), -1)
        cv2.rectangle(img, (WIDTH - 58, 245), (WIDTH, HEIGHT), (34, 38, 46), -1)
        cv2.rectangle(img, (WIDTH - 58, 115), (WIDTH - 46, 245), (42, 92, 168), 2)
        cv2.putText(img, "GATE B2", (WIDTH - 128, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (190, 210, 235), 1)
    elif scenario == "sudden_shockwave":
        # Corridor barrier lines
        cv2.rectangle(img, (0, 0), (WIDTH, 28), (32, 36, 44), -1)
        cv2.rectangle(img, (0, HEIGHT - 28), (WIDTH, HEIGHT), (32, 36, 44), -1)
        cv2.putText(img, "CORRIDOR N4", (WIDTH - 140, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (180, 200, 230), 1)
    elif scenario == "counterflow_surge":
        # Central plaza cross-walk markings
        cv2.line(img, (WIDTH // 2, 20), (WIDTH // 2, HEIGHT - 20), (85, 96, 112), 1, cv2.LINE_AA)
        cv2.putText(img, "CENTRAL PLAZA", (WIDTH - 155, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (180, 200, 230), 1)
    else:
        cv2.putText(img, "CONCOURSE A1", (WIDTH - 145, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (180, 200, 230), 1)

    return img


def draw_pedestrian(frame: np.ndarray, x: float, y: float, color: tuple, phase: float, scale: float = 1.0):
    ix, iy = int(x), int(y)
    # Shadow
    cv2.ellipse(frame, (ix + 2, iy + int(12 * scale)), (int(8 * scale), int(4 * scale)), 0, 0, 360, (36, 40, 48), -1)
    # Legs stride
    stride = int(math.sin(phase) * 4 * scale)
    cv2.line(frame, (ix - 3, iy + 2), (ix - 3 + stride, iy + int(12 * scale)), (30, 34, 42), 3)
    cv2.line(frame, (ix + 3, iy + 2), (ix + 3 - stride, iy + int(12 * scale)), (30, 34, 42), 3)
    # Torso / shoulders
    cv2.ellipse(frame, (ix, iy - int(2 * scale)), (int(8 * scale), int(10 * scale)), 0, 0, 360, color, -1)
    cv2.ellipse(frame, (ix, iy - int(2 * scale)), (int(8 * scale), int(10 * scale)), 0, 0, 360, (220, 226, 235), 1)
    # Head
    cv2.circle(frame, (ix, iy - int(13 * scale)), int(4.5 * scale), (205, 185, 170), -1)


def generate_scenario_video(scenario: str, out_mp4: str):
    os.makedirs(os.path.dirname(out_mp4), exist_ok=True)
    raw_mp4 = out_mp4 + ".raw.mp4"
    rng = random.Random(42 if scenario == "normal_plaza" else 77)

    palette = [
        (195, 130, 70),
        (80, 145, 210),
        (180, 95, 95),
        (110, 175, 130),
        (165, 165, 180),
        (210, 170, 85),
    ]

    agents = []
    if scenario == "normal_plaza":
        count = 20
        for i in range(count):
            direction = 1 if i % 2 == 0 else -1
            agents.append({
                "x": rng.uniform(30, WIDTH - 30),
                "y": rng.uniform(55, HEIGHT - 45),
                "vx": direction * rng.uniform(1.8, 2.8),
                "vy": rng.uniform(-0.35, 0.35),
                "color": rng.choice(palette),
                "phase": rng.uniform(0, 6.28),
            })
    elif scenario == "stadium_bottleneck":
        count = 54
        for i in range(count):
            agents.append({
                "x": rng.uniform(40, WIDTH - 140),
                "y": rng.uniform(45, HEIGHT - 45),
                "vx": rng.uniform(1.6, 2.7),
                "vy": 0.0,
                "color": rng.choice(palette),
                "phase": rng.uniform(0, 6.28),
            })
    elif scenario == "sudden_shockwave":
        count = 46
        for i in range(count):
            agents.append({
                "x": rng.uniform(30, WIDTH - 100),
                "y": rng.uniform(48, HEIGHT - 48),
                "vx": rng.uniform(2.6, 3.6),
                "vy": rng.uniform(-0.3, 0.3),
                "color": rng.choice(palette),
                "phase": rng.uniform(0, 6.28),
            })
    else:  # counterflow_surge
        count = 56
        for i in range(count):
            direction = 1 if i < count // 2 else -1
            agents.append({
                "x": rng.uniform(25, WIDTH // 2 - 20) if direction == 1 else rng.uniform(WIDTH // 2 + 20, WIDTH - 25),
                "y": rng.uniform(50, HEIGHT - 50),
                "vx": direction * rng.uniform(2.2, 3.4),
                "vy": rng.uniform(-0.8, 0.8),
                "color": rng.choice(palette),
                "phase": rng.uniform(0, 6.28),
            })

    bg = draw_concourse_background(scenario)
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(raw_mp4, fourcc, FPS, (WIDTH, HEIGHT))
    total_frames = FPS * DURATION_SEC

    for f in range(total_frames):
        frame = bg.copy()
        t_sec = f / float(FPS)

        for ag in agents:
            if scenario == "stadium_bottleneck":
                # Funnel toward Gate B2 (x -> WIDTH - 60, y -> 180)
                dy = (180.0 - ag["y"]) * 0.035
                # Compress and slow down near bottleneck
                if ag["x"] > WIDTH - 230:
                    ag["vx"] = max(0.35, ag["vx"] * 0.96)
                ag["x"] += ag["vx"]
                ag["y"] += dy + rng.uniform(-0.35, 0.35)
                if ag["x"] > WIDTH - 25:
                    ag["x"] = rng.uniform(20, 90)
                    ag["y"] = rng.uniform(45, HEIGHT - 45)
                    ag["vx"] = rng.uniform(1.8, 2.8)
            elif scenario == "sudden_shockwave":
                # Rapid flow for first 2 seconds, then sudden freeze & compression
                if t_sec >= 2.0:
                    ag["vx"] *= 0.72
                    ag["vy"] *= 0.72
                ag["x"] += ag["vx"]
                ag["y"] += ag["vy"]
                if ag["x"] > WIDTH - 25:
                    ag["x"] = 25
            elif scenario == "counterflow_surge":
                # Colliding turbulent flow in central plaza
                if abs(ag["x"] - WIDTH / 2.0) < 95:
                    ag["vy"] += rng.uniform(-0.9, 0.9)
                    ag["vx"] *= 0.95
                ag["x"] += ag["vx"]
                ag["y"] += ag["vy"]
                if ag["x"] < 15 or ag["x"] > WIDTH - 15:
                    ag["vx"] *= -1
                if ag["y"] < 40 or ag["y"] > HEIGHT - 40:
                    ag["vy"] *= -1
            else:
                ag["x"] += ag["vx"]
                ag["y"] += ag["vy"]
                if ag["x"] < 15 or ag["x"] > WIDTH - 15:
                    ag["vx"] *= -1
                if ag["y"] < 40 or ag["y"] > HEIGHT - 40:
                    ag["vy"] *= -1

            ag["phase"] += max(0.05, abs(ag["vx"]) * 0.32)
            draw_pedestrian(frame, ag["x"], ag["y"], ag["color"], ag["phase"])

        # Add subtle CCTV timestamp watermark
        cv2.rectangle(frame, (10, 8), (220, 28), (12, 16, 24), -1)
        cv2.putText(
            frame,
            f"CAM-SIM {scenario[:10].upper()} 00:0{int(t_sec)}.{int((t_sec % 1)*10)}",
            (16, 22),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.42,
            (220, 232, 248),
            1,
            cv2.LINE_AA,
        )
        writer.write(frame)

    writer.release()

    # Transcode with ffmpeg to browser-compatible H.264 MP4
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            raw_mp4,
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            out_mp4,
        ],
        check=True,
    )
    if os.path.exists(raw_mp4):
        os.remove(raw_mp4)


def main():
    parser = argparse.ArgumentParser(description="Generate CROWGUARD sample CCTV MP4")
    parser.add_argument(
        "--scenario",
        choices=["normal_plaza", "stadium_bottleneck", "sudden_shockwave", "counterflow_surge"],
        required=True,
    )
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    generate_scenario_video(args.scenario, args.out)
    print(json.dumps({"ok": True, "path": args.out, "scenario": args.scenario}))


if __name__ == "__main__":
    main()
