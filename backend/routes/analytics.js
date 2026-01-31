import { Router } from 'express';
import { db } from '../db/index.js';
import { getExecutiveSummary, getRecommendations, getNPS, getPredictiveMetrics } from '../services/insights.js';

const router = Router();

router.get('/overview', (req, res) => {
  const { eventId } = req.query;
  const where = eventId ? 'WHERE event_id = ?' : 'WHERE 1=1';
  const params = eventId ? [eventId] : [];

  const total = db.prepare(`SELECT COUNT(*) as c FROM feedback ${where}`).get(...params);
  const sentiment = db.prepare(
    `SELECT sentiment_label, COUNT(*) as count FROM feedback ${where} GROUP BY sentiment_label`
  ).all(...params);
  const avgRating = db.prepare(
    `SELECT AVG(rating) as avg FROM feedback ${where} AND rating IS NOT NULL`
  ).get(...params);

  const counts = { positive: 0, neutral: 0, negative: 0 };
  sentiment.forEach(s => { counts[s.sentiment_label] = s.count; });

  res.json({
    success: true,
    data: {
      totalFeedback: total?.c ?? 0,
      sentimentCounts: counts,
      avgRating: avgRating?.avg != null ? Math.round(avgRating.avg * 10) / 10 : null,
    },
  });
});

router.get('/sentiment', (req, res) => {
  const { eventId, sessionId, from, to } = req.query;
  let sql = 'SELECT sentiment_label, COUNT(*) as count FROM feedback WHERE 1=1';
  const params = [];
  if (eventId) { sql += ' AND event_id = ?'; params.push(eventId); }
  if (sessionId) { sql += ' AND session_id = ?'; params.push(sessionId); }
  if (from) { sql += ' AND created_at >= ?'; params.push(from); }
  if (to) { sql += ' AND created_at <= ?'; params.push(to); }
  sql += ' GROUP BY sentiment_label';
  const rows = db.prepare(sql).all(...params);
  const counts = { positive: 0, neutral: 0, negative: 0 };
  rows.forEach(r => { counts[r.sentiment_label] = r.count; });
  res.json({ success: true, data: counts });
});

router.get('/sentiment-by-session', (req, res) => {
  const { eventId } = req.query;
  let sql = `SELECT COALESCE(session_name, 'General') as session_name, sentiment_label, COUNT(*) as count
             FROM feedback WHERE 1=1`;
  const params = [];
  if (eventId) { sql += ' AND event_id = ?'; params.push(eventId); }
  sql += ' GROUP BY COALESCE(session_name, event_name, "General"), sentiment_label';
  const rows = db.prepare(sql).all(...params);
  const bySession = {};
  rows.forEach(r => {
    const s = r.session_name || 'General';
    if (!bySession[s]) bySession[s] = { positive: 0, neutral: 0, negative: 0 };
    bySession[s][r.sentiment_label] = r.count;
  });
  res.json({ success: true, data: bySession });
});

router.get('/ratings', (req, res) => {
  const { eventId, sessionId } = req.query;
  let sql = 'SELECT rating, COUNT(*) as count FROM feedback WHERE rating IS NOT NULL';
  const params = [];
  if (eventId) { sql += ' AND event_id = ?'; params.push(eventId); }
  if (sessionId) { sql += ' AND session_id = ?'; params.push(sessionId); }
  sql += ' GROUP BY rating ORDER BY rating';
  const rows = db.prepare(sql).all(...params);
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  rows.forEach(r => { dist[r.rating] = r.count; });
  res.json({ success: true, data: dist });
});

router.get('/category-ratings', (req, res) => {
  const { eventId } = req.query;
  const categories = ['rating_venue', 'rating_content', 'rating_speakers', 'rating_organization'];
  const result = {};
  categories.forEach(col => {
    let sql = `SELECT ${col} as val, COUNT(*) as c FROM feedback WHERE ${col} IS NOT NULL`;
    const params = [];
    if (eventId) { sql += ' AND event_id = ?'; params.push(eventId); }
    sql += ' GROUP BY val';
    const rows = db.prepare(sql).all(...params);
    const key = col.replace('rating_', '');
    result[key] = rows.length ? rows.reduce((a, r) => a + r.val * r.c, 0) / rows.reduce((a, r) => a + r.c, 0) : null;
  });
  res.json({ success: true, data: result });
});

router.get('/session-performance', (req, res) => {
  const { eventId } = req.query;
  let sql = `SELECT COALESCE(session_name, event_name, 'General') as name,
             COUNT(*) as total,
             SUM(CASE WHEN sentiment_label = 'positive' THEN 1 ELSE 0 END) as positive,
             SUM(CASE WHEN sentiment_label = 'negative' THEN 1 ELSE 0 END) as negative,
             AVG(rating) as avg_rating
             FROM feedback WHERE 1=1`;
  const params = [];
  if (eventId) { sql += ' AND event_id = ?'; params.push(eventId); }
  sql += ' GROUP BY COALESCE(session_name, event_name, "General") ORDER BY total DESC';
  const rows = db.prepare(sql).all(...params);
  res.json({ success: true, data: rows });
});

router.get('/timeline', (req, res) => {
  const { eventId, days = 7 } = req.query;
  let sql = `SELECT date(created_at) as day, sentiment_label, COUNT(*) as count
             FROM feedback WHERE created_at >= datetime('now', ?)`;
  const params = ['-' + (parseInt(days, 10) || 7) + ' days'];
  if (eventId) { sql += ' AND event_id = ?'; params.push(eventId); }
  sql += ' GROUP BY date(created_at), sentiment_label ORDER BY day';
  const rows = db.prepare(sql).all(...params);
  res.json({ success: true, data: rows });
});

router.get('/top-feedback', (req, res) => {
  const { eventId, type = 'all', limit = 5 } = req.query;
  let sql = `SELECT id, text, sentiment_label, sentiment_score, rating, created_at FROM feedback WHERE 1=1`;
  const params = [];
  if (eventId) { sql += ' AND event_id = ?'; params.push(eventId); }
  const lim = Math.min(parseInt(limit, 10) || 5, 20);
  let positive = [], negative = [];
  if (type === 'all' || type === 'positive') {
    positive = db.prepare(sql + ' AND sentiment_label = ? ORDER BY sentiment_score DESC, created_at DESC LIMIT ?').all(...params, 'positive', lim);
  }
  if (type === 'all' || type === 'negative') {
    negative = db.prepare(sql + ' AND sentiment_label = ? ORDER BY sentiment_score ASC, created_at DESC LIMIT ?').all(...params, 'negative', lim);
  }
  res.json({ success: true, data: { topPositive: positive, topNegative: negative } });
});

router.get('/trending-keywords', (req, res) => {
  const { eventId, limit = 15 } = req.query;
  let sql = `SELECT keywords FROM feedback WHERE keywords IS NOT NULL AND keywords != '[]'`;
  const params = [];
  if (eventId) { sql += ' AND event_id = ?'; params.push(eventId); }
  const rows = db.prepare(sql).all(...params);
  const freq = {};
  rows.forEach(r => {
    try {
      const arr = JSON.parse(r.keywords);
      (arr || []).forEach(w => { freq[w] = (freq[w] || 0) + 1; });
    } catch (_) {}
  });
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, parseInt(limit, 10) || 15).map(([word, count]) => ({ word, count }));
  res.json({ success: true, data: sorted });
});

router.get('/insights/summary', (req, res) => {
  const eventId = req.query.eventId || null;
  const data = getExecutiveSummary(eventId);
  res.json({ success: true, data });
});

router.get('/insights/recommendations', (req, res) => {
  const eventId = req.query.eventId || null;
  const data = getRecommendations(eventId);
  res.json({ success: true, data });
});

router.get('/insights/nps', (req, res) => {
  const eventId = req.query.eventId || null;
  const data = getNPS(eventId);
  res.json({ success: true, data });
});

router.get('/insights/predictive', (req, res) => {
  const eventId = req.query.eventId || null;
  const data = getPredictiveMetrics(eventId);
  res.json({ success: true, data });
});

export default router;
