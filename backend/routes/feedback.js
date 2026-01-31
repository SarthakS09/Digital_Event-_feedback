import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { feedbackSubmissionRules, handleValidation } from '../middleware/validation.js';
import { hasProfanity } from '../middleware/profanity.js';
import { analyzeSentiment } from '../services/sentiment.js';
import { checkAndFireAlerts, checkThresholdAlerts } from '../services/alerts.js';
import { config } from '../config/index.js';
import OpenAI from 'openai';

const router = Router();
const openaiClient = config.openaiApiKey ? new OpenAI({ apiKey: config.openaiApiKey }) : null;

function hashForSpam(str) {
  if (!str) return '';
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i) | 0;
  }
  return String(h);
}

router.post('/',
  feedbackSubmissionRules,
  handleValidation,
  (req, res, next) => {
    if (hasProfanity(req.body.text)) {
      return res.status(400).json({ success: false, error: 'Feedback contains inappropriate language.' });
    }
    next();
  },
  async (req, res) => {
    const {
      eventId, sessionId, eventName, sessionName, attendeeName, attendeeEmail,
      rating, ratingVenue, ratingContent, ratingSpeakers, ratingOrganization,
      text, isAnonymous,
    } = req.body;

    const ipHash = req.ip ? hashForSpam(req.ip + text?.slice(0, 50)) : null;
    const recentSame = ipHash ? db.prepare(
      `SELECT id FROM feedback WHERE ip_hash = ? AND created_at > datetime('now', '-5 minutes')`
    ).get(ipHash) : null;
    if (recentSame) {
      return res.status(429).json({ success: false, error: 'Duplicate submission. Please wait a few minutes.' });
    }

    const sentiment = await analyzeSentiment(text, {
      useOpenAI: !!config.openaiApiKey,
      openaiClient,
    });

    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO feedback (
        id, event_id, session_id, attendee_name, attendee_email, event_name, session_name,
        rating, rating_venue, rating_content, rating_speakers, rating_organization,
        text, sentiment_label, sentiment_score, sentiment_confidence,
        aspect_sentiment, emotions, urgency, keywords, language, is_anonymous, ip_hash, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      eventId || null,
      sessionId || null,
      isAnonymous ? null : (attendeeName || null),
      isAnonymous ? null : (attendeeEmail || null),
      eventName || null,
      sessionName || null,
      rating ?? null,
      ratingVenue ?? null,
      ratingContent ?? null,
      ratingSpeakers ?? null,
      ratingOrganization ?? null,
      text,
      sentiment.label,
      sentiment.score ?? 0,
      sentiment.confidence ?? 0.5,
      sentiment.aspectSentiment ? JSON.stringify(sentiment.aspectSentiment) : null,
      sentiment.emotions ? JSON.stringify(sentiment.emotions) : null,
      sentiment.urgency || null,
      sentiment.keywords ? JSON.stringify(sentiment.keywords) : null,
      null,
      isAnonymous ? 1 : 0,
      ipHash,
      now,
      now,
    );

    const row = db.prepare('SELECT * FROM feedback WHERE id = ?').get(id);
    const alerts = await checkAndFireAlerts(row, eventId || null);
    await checkThresholdAlerts(eventId || null);

    res.status(201).json({
      success: true,
      data: {
        id: row.id,
        sentiment_label: row.sentiment_label,
        sentiment_score: row.sentiment_score,
        sentiment_confidence: row.sentiment_confidence,
        aspect_sentiment: row.aspect_sentiment ? JSON.parse(row.aspect_sentiment) : null,
        keywords: row.keywords ? JSON.parse(row.keywords) : null,
        created_at: row.created_at,
      },
      alerts_fired: alerts.length,
    });
  }
);

router.get('/', (req, res) => {
  const { eventId, sessionId, from, to, limit = 50 } = req.query;
  let sql = `SELECT id, event_id, session_id, event_name, session_name, rating, text, sentiment_label, sentiment_score, created_at,
             rating_venue, rating_content, rating_speakers, rating_organization, keywords FROM feedback WHERE 1=1`;
  const params = [];
  if (eventId) { sql += ' AND event_id = ?'; params.push(eventId); }
  if (sessionId) { sql += ' AND session_id = ?'; params.push(sessionId); }
  if (from) { sql += ' AND created_at >= ?'; params.push(from); }
  if (to) { sql += ' AND created_at <= ?'; params.push(to); }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(Math.min(parseInt(limit, 10) || 50, 500));
  const rows = db.prepare(sql).all(...params);
  const list = rows.map(r => {
    let keywords = null;
    if (r.keywords) {
      try {
        keywords = typeof r.keywords === 'string' ? JSON.parse(r.keywords) : r.keywords;
        if (!Array.isArray(keywords)) keywords = null;
      } catch (_) {}
    }
    const { keywords: _kw, ...rest } = r;
    return { ...rest, keywords };
  });
  res.json({ success: true, data: list });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM feedback WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: 'Feedback not found' });
  const out = { ...row };
  if (out.aspect_sentiment) out.aspect_sentiment = JSON.parse(out.aspect_sentiment);
  if (out.emotions) out.emotions = JSON.parse(out.emotions);
  if (out.keywords) out.keywords = JSON.parse(out.keywords);
  res.json({ success: true, data: out });
});

export default router;
