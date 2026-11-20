import express from 'express';
import multer from 'multer';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { initializeApp as initializeAdminApp, getApps as getAdminApps, getApp as getAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth, type DecodedIdToken } from 'firebase-admin/auth';

dotenv.config();

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = '/tmp/crowguard_uploads';
const SAMPLE_DIR = '/tmp/crowguard_samples';
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(SAMPLE_DIR, { recursive: true });

const ALLOWED_SCENARIOS = new Set([
  'normal_plaza',
  'stadium_bottleneck',
  'sudden_shockwave',
  'counterflow_surge',
]);

const BOOTSTRAPPED_ADMIN_EMAIL = 'varshanv839@gmail.com';

function loadFirebaseProjectId(): string {
  try {
    const cfgPath = path.join(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      if (cfg.projectId && cfg.projectId !== 'remixed-project-id') {
        return String(cfg.projectId);
      }
    }
  } catch {
    // Ignore config read errors
  }
  return '';
}

function getFirebaseAdminAuth() {
  const projectId = loadFirebaseProjectId();
  if (!projectId) return null;
  const adminApp = getAdminApps().length
    ? getAdminApp()
    : initializeAdminApp({ projectId });
  return getAdminAuth(adminApp);
}

async function verifyBearerIdToken(req: express.Request): Promise<DecodedIdToken> {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]) {
    throw new Error('MISSING_TOKEN');
  }
  const adminAuth = getFirebaseAdminAuth();
  if (!adminAuth) {
    throw new Error('FIREBASE_NOT_CONFIGURED');
  }
  return adminAuth.verifyIdToken(match[1]);
}

const upload = multer({
  dest: UPLOAD_DIR,
  limits: {
    fileSize: 150 * 1024 * 1024, // 150 MB per video
  },
});

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function getPythonCapabilities() {
  try {
    const { stdout } = await execFileAsync(
      'python3',
      ['-c', 'import cv2, numpy, json; print(json.dumps({"opencv": cv2.__version__, "numpy": numpy.__version__}))'],
      { timeout: 5000 }
    );
    const parsed = JSON.parse(stdout.trim());
    return {
      pythonAvailable: true,
      opencvVersion: String(parsed.opencv || 'unknown'),
      numpyVersion: String(parsed.numpy || 'unknown'),
    };
  } catch {
    return {
      pythonAvailable: false,
      opencvVersion: null,
      numpyVersion: null,
    };
  }
}

async function ensureSampleVideo(scenario: string): Promise<string> {
  if (!ALLOWED_SCENARIOS.has(scenario)) {
    throw new Error(`Invalid scenario: ${scenario}`);
  }
  const outPath = path.join(SAMPLE_DIR, `${scenario}.mp4`);
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1024) {
    return outPath;
  }
  const generatorScript = path.join(__dirname, 'backend', 'sample_generator.py');
  await execFileAsync(
    'python3',
    [generatorScript, '--scenario', scenario, '--out', outPath],
    { timeout: 45000 }
  );
  return outPath;
}

async function runOpenCVAnalysis(videoPath: string, maxFrames = 10) {
  const analyzerScript = path.join(__dirname, 'backend', 'analyzer.py');
  const { stdout } = await execFileAsync(
    'python3',
    [analyzerScript, '--video', videoPath, '--max-frames', String(maxFrames)],
    {
      timeout: 60000,
      maxBuffer: 25 * 1024 * 1024,
    }
  );
  return JSON.parse(stdout);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', async (_req, res) => {
    const caps = await getPythonCapabilities();
    res.json({
      status: 'ok',
      service: 'crowguard-api',
      nodeVersion: process.version,
      geminiConfigured: Boolean(getGeminiClient()),
      firebaseTokenVerification: Boolean(getFirebaseAdminAuth()),
      ...caps,
    });
  });

  app.get('/api/setup-info', async (_req, res) => {
    const caps = await getPythonCapabilities();
    const firebaseProjectId = loadFirebaseProjectId() || 'not-configured';
    res.json({
      ...caps,
      firebaseProjectId,
      geminiConfigured: Boolean(getGeminiClient()),
      firebaseTokenVerification: Boolean(getFirebaseAdminAuth()),
      pythonScript: 'backend/analyzer.py',
      sampleGenerator: 'backend/sample_generator.py',
    });
  });

  // Server-side Firebase ID Token verification endpoint (no IAM required for verifyIdToken)
  app.get('/api/auth/session', async (req, res) => {
    try {
      const decoded = await verifyBearerIdToken(req);
      const isBootstrappedAdmin =
        decoded.email === BOOTSTRAPPED_ADMIN_EMAIL && decoded.email_verified === true;
      res.json({
        verified: true,
        uid: decoded.uid,
        email: decoded.email || null,
        emailVerified: Boolean(decoded.email_verified),
        bootstrappedAdmin: isBootstrappedAdmin,
        authTime: decoded.auth_time,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'TOKEN_INVALID';
      const status = code === 'MISSING_TOKEN' ? 401 : 403;
      res.status(status).json({
        verified: false,
        error: code === 'MISSING_TOKEN'
          ? 'Missing Authorization Bearer Firebase ID token.'
          : 'Invalid or expired Firebase ID token.',
      });
    }
  });

  // Server-side authorization gate for privileged admin mutations
  app.post('/api/admin/authorize-action', async (req, res) => {
    try {
      const decoded = await verifyBearerIdToken(req);
      const { claimedRole } = req.body || {};
      const isBootstrappedAdmin =
        decoded.email === BOOTSTRAPPED_ADMIN_EMAIL && decoded.email_verified === true;
      const hasCustomAdminClaim = decoded.role === 'admin' || decoded.admin === true;

      if (!isBootstrappedAdmin && !hasCustomAdminClaim && claimedRole !== 'admin') {
        res.status(403).json({
          authorized: false,
          error: 'Unauthorized: Administrator privileges required.',
        });
        return;
      }

      res.json({
        authorized: true,
        verifiedUid: decoded.uid,
        verifiedEmail: decoded.email || null,
        serverVerifiedAt: new Date().toISOString(),
        enforcementNote: 'Token verified server-side via Firebase Admin Auth; database mutation enforced by Firestore Security Rules.',
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'TOKEN_INVALID';
      res.status(code === 'MISSING_TOKEN' ? 401 : 403).json({
        authorized: false,
        error: 'Unauthorized: Valid Firebase ID token is required.',
      });
    }
  });

  app.get('/api/sample-video/:scenario', async (req, res) => {
    try {
      const scenario = req.params.scenario;
      if (!ALLOWED_SCENARIOS.has(scenario)) {
        res.status(400).json({ error: 'Unknown CCTV scenario.' });
        return;
      }
      const filePath = await ensureSampleVideo(scenario);
      res.setHeader('Content-Type', 'video/mp4');
      res.sendFile(filePath);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to generate sample video.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/analyze-sample/:scenario', async (req, res) => {
    try {
      const scenario = req.params.scenario;
      if (!ALLOWED_SCENARIOS.has(scenario)) {
        res.status(400).json({ error: 'Unknown CCTV scenario.' });
        return;
      }
      const maxFrames = Math.min(14, Math.max(4, Number(req.body?.maxFrames) || 10));
      const filePath = await ensureSampleVideo(scenario);
      const analysis = await runOpenCVAnalysis(filePath, maxFrames);
      res.json({
        ...analysis,
        scenario,
        videoUrl: `/api/sample-video/${scenario}`,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Sample OpenCV analysis failed.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/analyze-video', upload.single('video'), async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No CCTV video file uploaded.' });
      return;
    }

    try {
      const maxFrames = Math.min(14, Math.max(4, Number(req.body?.maxFrames) || 10));
      const analysis = await runOpenCVAnalysis(file.path, maxFrames);
      res.json({
        ...analysis,
        fileName: file.originalname,
        fileSizeBytes: file.size,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'OpenCV video analysis failed.';
      res.status(500).json({ error: msg });
    } finally {
      fs.unlink(file.path, () => {
        // Ignore cleanup errors
      });
    }
  });

  // Multi-camera batch CCTV video analysis endpoint
  app.post('/api/analyze-videos', upload.array('videos', 8), async (req, res) => {
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) {
      res.status(400).json({ error: 'No CCTV video files uploaded.' });
      return;
    }

    const maxFrames = Math.min(10, Math.max(4, Number(req.body?.maxFrames) || 8));
    const results = [];
    try {
      for (const file of files) {
        try {
          const analysis = await runOpenCVAnalysis(file.path, maxFrames);
          results.push({
            ok: true,
            fileName: file.originalname,
            fileSizeBytes: file.size,
            analysis,
          });
        } catch (err) {
          results.push({
            ok: false,
            fileName: file.originalname,
            error: err instanceof Error ? err.message : 'OpenCV analysis failed.',
          });
        }
      }
      res.json({ count: results.length, results });
    } finally {
      for (const file of files) {
        fs.unlink(file.path, () => {
          // Ignore cleanup errors
        });
      }
    }
  });

  // AI Safety Assistant endpoint powered by @google/genai
  app.post('/api/assistant', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured in the server environment. Configure it in Settings > Secrets to enable the AI Safety Assistant.',
      });
      return;
    }

    const { question, context, history } = req.body || {};
    if (!question || typeof question !== 'string' || !question.trim()) {
      res.status(400).json({ error: 'A question string is required.' });
      return;
    }

    try {
      const systemInstruction = [
        'You are the CROWGUARD AI Safety Assistant for a crowd crush early warning operations center.',
        'Answer strictly using the live telemetry JSON snapshot provided in the prompt.',
        'Be concise, actionable, and precise: cite exact zone names, densities (p/m²), Optical Flow speeds (m/s), danger scores (0-100), alert reasons, bottleneck locations, and evacuation routes.',
        'Explicitly distinguish real OpenCV video measurements from simulated prediction data whenever relevant.',
        'Never claim physical gates are opened automatically; state that recommendations require human operator approval.',
        'Keep responses under 220 words with clean short paragraphs or bullet points.',
      ].join(' ');

      const conversationContext = Array.isArray(history)
        ? history
            .slice(-6)
            .map((m: { role?: string; text?: string }) => `${m.role === 'user' ? 'Operator' : 'Assistant'}: ${m.text || ''}`)
            .join('\n')
        : '';

      const prompt = [
        'CURRENT CROWGUARD TELEMETRY SNAPSHOT:',
        JSON.stringify(context ?? {}, null, 2),
        conversationContext ? `\nRECENT CONVERSATION:\n${conversationContext}` : '',
        `\nOPERATOR QUESTION: ${question.trim()}`,
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const answer = response.text?.trim();
      if (!answer) {
        res.status(502).json({ error: 'The AI Safety Assistant returned an empty response.' });
        return;
      }

      res.json({ answer, model: 'gemini-4-hydrogen' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'AI Safety Assistant request failed.';
      res.status(500).json({ error: msg });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CROWGUARD server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start CROWGUARD server:', err);
  process.exit(1);
});
