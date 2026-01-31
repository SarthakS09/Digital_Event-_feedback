import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { initDb } from './db/index.js';
import eventsRouter from './routes/events.js';
import sessionsRouter from './routes/sessions.js';
import feedbackRouter from './routes/feedback.js';
import analyticsRouter from './routes/analytics.js';
import exportRouter from './routes/export.js';
import comparativeRouter from './routes/comparative.js';
import qrRouter from './routes/qr.js';
import alertSettingsRouter from './routes/alertSettings.js';

const app = express();

// Allow frontend origin; in development allow common localhost ports
const allowedOrigins = [
  config.frontendUrl,
  'http://localhost:8080',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5500',
].filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin) || config.nodeEnv === 'development') return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, error: 'Too many requests' },
});
app.use('/api/', limiter);

const feedbackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many feedback submissions' },
});
app.use('/api/feedback', feedbackLimiter);

app.use('/api/events', eventsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/export', exportRouter);
app.use('/api/comparative', comparativeRouter);
app.use('/api/qr', qrRouter);
app.use('/api/alert-settings', alertSettingsRouter);

app.get('/', (req, res) => {
  const frontendUrl = config.frontendUrl || 'http://localhost:8080';
  res.type('html').send(`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Feedback Analyzer API</title></head>
<body style="font-family: system-ui; max-width: 560px; margin: 3rem auto; padding: 0 1rem;">
  <h1>Digital Event Feedback Analyzer — API</h1>
  <p>This is the backend API server. There is no web UI here.</p>
  <p><strong>Open the frontend in your browser:</strong><br>
    <a href="${frontendUrl}">${frontendUrl}</a></p>
  <p><strong>API health:</strong> <a href="/api/health">/api/health</a></p>
  <p>Endpoints: <code>/api/events</code>, <code>/api/feedback</code>, <code>/api/analytics</code>, etc.</p>
</body>
</html>`);
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

const PORT = config.port;
async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`Digital Event Feedback Analyzer API running at http://localhost:${PORT}`);
    console.log(`Health: http://localhost:${PORT}/api/health`);
  });
}
start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
