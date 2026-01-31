import { Router } from 'express';
import { db } from '../db/index.js';
import { ensureDefaultEvents } from './events.js';

const router = Router();

router.get('/events', (req, res) => {
  try {
    ensureDefaultEvents();
  } catch (_) {}
  const { eventIds } = req.query;
  const ids = (eventIds && typeof eventIds === 'string') ? eventIds.split(',').map(s => s.trim()).filter(Boolean) : [];
  if (ids.length === 0) {
    const all = db.prepare('SELECT id, name FROM events ORDER BY created_at DESC LIMIT 10').all();
    const list = all.map(e => e.id);
    if (list.length === 0) {
      return res.json({ success: true, data: [], message: 'No events to compare' });
    }
    return res.redirect(302, req.path + '?eventIds=' + list.join(','));
  }

  const comparisons = [];
  for (const eid of ids.slice(0, 5)) {
    const event = db.prepare('SELECT id, name, start_date, end_date FROM events WHERE id = ?').get(eid);
    if (!event) continue;
    const total = db.prepare('SELECT COUNT(*) as c FROM feedback WHERE event_id = ?').get(eid);
    const sentiment = db.prepare(
      'SELECT sentiment_label, COUNT(*) as count FROM feedback WHERE event_id = ? GROUP BY sentiment_label'
    ).all(eid);
    const avgRating = db.prepare('SELECT AVG(rating) as avg FROM feedback WHERE event_id = ? AND rating IS NOT NULL').get(eid);
    const counts = { positive: 0, neutral: 0, negative: 0 };
    sentiment.forEach(s => { counts[s.sentiment_label] = s.count; });
    comparisons.push({
      eventId: event.id,
      eventName: event.name,
      startDate: event.start_date,
      endDate: event.end_date,
      totalFeedback: total?.c ?? 0,
      sentimentCounts: counts,
      avgRating: avgRating?.avg != null ? Math.round(avgRating.avg * 10) / 10 : null,
    });
  }
  res.json({ success: true, data: comparisons });
});

router.get('/trends', (req, res) => {
  const events = db.prepare(
    `SELECT id, name, start_date FROM events ORDER BY start_date ASC LIMIT 20`
  ).all();
  const trend = events.map(e => {
    const total = db.prepare('SELECT COUNT(*) as c FROM feedback WHERE event_id = ?').get(e.id);
    const sentiment = db.prepare(
      'SELECT sentiment_label, COUNT(*) as count FROM feedback WHERE event_id = ? GROUP BY sentiment_label'
    ).all(e.id);
    const avgRating = db.prepare('SELECT AVG(rating) as avg FROM feedback WHERE event_id = ? AND rating IS NOT NULL').get(e.id);
    const counts = { positive: 0, neutral: 0, negative: 0 };
    sentiment.forEach(s => { counts[s.sentiment_label] = s.count; });
    const totalF = total?.c ?? 0;
    const pctPos = totalF ? (counts.positive / totalF) * 100 : 0;
    return {
      eventId: e.id,
      eventName: e.name,
      startDate: e.start_date,
      totalFeedback: totalF,
      pctPositive: Math.round(pctPos * 10) / 10,
      avgRating: avgRating?.avg != null ? Math.round(avgRating.avg * 10) / 10 : null,
    };
  });
  res.json({ success: true, data: trend });
});

export default router;
