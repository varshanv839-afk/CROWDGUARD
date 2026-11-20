# CROWGUARD — Intelligent Crowd Crush Early Warning & Prevention System

CROWGUARD is a full-stack crowd safety monitoring prototype combining a **React + TypeScript + Tailwind CSS** command dashboard, **Firebase Authentication & Firestore**, an **Express API gateway**, **Gemini AI Safety Assistant** (server-side `@google/genai`), and a **Python + OpenCV** computer vision & Optical Flow worker.

## Key Capabilities
1. **Admin Operations Dashboard**: Displays total people detected, peak spatial density (`p/m²`), crowd safety status, active danger alerts, cross-zone risk comparison, interactive venue perimeter map, and live monitoring status.
2. **Multi-Camera CCTV Video Monitoring (Python OpenCV)**: Upload single or multiple `.mp4`, `.mov`, `.webm`, or `.avi` CCTV clips (`/api/analyze-video`, `/api/analyze-videos`) for frame-by-frame pedestrian detection (`HOGDescriptor` + foreground contour clustering + NMS) with per-camera feeds, zone density comparison, and toggleable bounding boxes.
3. **Crowd Density & Bottleneck Detection**: Divides frames into a `4×3` spatial matrix (`R1-C1` to `R3-C4`), classifies density as `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL`, generates `COLORMAP_JET` thermal density heatmaps, and flags congested entrances, narrow passages, and blocked exits.
4. **Optical Flow & Abnormal Movement Detection**: Uses `cv2.calcOpticalFlowFarneback` to compute crowd speed (`m/s`), dominant flow direction, directional variance/turbulence, and localize suspicious movement regions (`SUDDEN_STOPPING`, `UNUSUAL_DIRECTION`, `RAPID_CROWD_SURGE`).
5. **Advanced Risk Prediction (0–100)**: Combines spatial density, movement stoppage/speed, congestion/bottlenecks, and historical trends with clear factor-by-factor explanations and projects a 5–10 minute trajectory (`>= 6` intervals). Explicitly separates real OpenCV telemetry from simulated forecast projections.
6. **Smart Evacuation Route Planner**: Maps venue entrances and exits, highlights congested/blocked corridors, and recommends safer alternative exit paths for operator review.
7. **Emergency Response & Gate Approvals**: Supports incident team assignment (`new` → `acknowledged` → `responding` → `resolved`) with timestamped operator action logs alongside human-approved gate recommendations (`OPEN_RELIEF`, `RESTRICT_ENTRY`, `REDIRECT_FLOW`).
8. **AI Safety Assistant**: Server-side Gemini chatbot grounded in live dashboard telemetry to identify the highest-risk zone, explain alert triggers, and suggest preventive actions.
9. **Digital Twin Simulation Lab**: Synthesizes playable H.264 CCTV clips via OpenCV + FFmpeg and simulates crowd size, entrance flow, exit capacity, and interventions with before/after risk score comparisons.
10. **PDF Incident Reports & Real-Time Notifications**: Exports multi-section PDF incident reports via `jsPDF` and delivers Firestore-backed dashboard notifications with muteable Web Audio alert chimes.
11. **Authentication, RBAC & Admin Management**: Full Firebase Email/Password & Google Auth login, new operator registration, password reset, User Profile & password change, server-side ID token verification (`/api/auth/session`, `/api/admin/authorize-action`), Firestore RBAC rules, and an Admin-only User Management console (search, role assignment, account activation/deactivation, and activity/login audit logs).

## Architecture & Setup

### Prerequisites
- Node.js 20+
- Python 3.10+ with `opencv-python` (or `python3-opencv`), `numpy`, and `ffmpeg`
- `GEMINI_API_KEY` (configured server-side in environment secrets for the AI Safety Assistant)

### Installation
```bash
# 1. Install Python dependencies
pip install -r backend/requirements.txt
# Or on Debian/Ubuntu:
sudo apt-get install -y python3-opencv python3-numpy ffmpeg

# 2. Install Node.js dependencies
npm install

# 3. Start full-stack dev server (Express + Vite + OpenCV worker on port 3000)
npm run dev

# 4. Production build & start
npm run build
npm start
```

### Firebase Configuration
- `firebase-applet-config.json` provides the Firebase client configuration (`Auth` + `Firestore`).
- `firestore.rules` enforces strict schema validation, owner/admin RBAC, PII isolation (`/users/{uid}/private/contact`), parent existence checks on alerts/gate recommendations, operator notification access, and terminal-state locking on operator gate decisions.

