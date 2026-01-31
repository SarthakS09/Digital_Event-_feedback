import { db } from '../db/index.js';
import { config } from '../config/index.js';

export function getExecutiveSummary(eventId, options = {}) {
  const limit = options.limit ?? 100;
  const rows = db.prepare(
    `SELECT id, text, sentiment_label, sentiment_score, rating, created_at, session_name
     FROM feedback WHERE (? IS NULL OR event_id = ?) ORDER BY created_at DESC LIMIT ?`
  ).all(eventId || null, eventId || null, limit);

  const total = rows.length;
  if (total === 0) {
    return {
      summary: 'No feedback collected yet. Summary will appear once feedback is submitted.',
      topSuccesses: [],
      topImprovements: [],
      criticalIssues: [],
      surprisingInsights: [],
    };
  }

  const positive = rows.filter(r => r.sentiment_label === 'positive');
  const negative = rows.filter(r => r.sentiment_label === 'negative');
  const bySession = {};
  rows.forEach(r => {
    const s = r.session_name || 'General';
    if (!bySession[s]) bySession[s] = { positive: 0, negative: 0, total: 0 };
    bySession[s].total++;
    if (r.sentiment_label === 'positive') bySession[s].positive++;
    if (r.sentiment_label === 'negative') bySession[s].negative++;
  });

  const avgRating = rows.filter(r => r.rating != null).reduce((a, r) => a + r.rating, 0) / (rows.filter(r => r.rating != null).length || 1);
  const pctPositive = (positive.length / total) * 100;
  const pctNegative = (negative.length / total) * 100;

  let summary = `Collected ${total} feedback responses. `;
  if (pctPositive >= 50) summary += `Overall sentiment is positive (${pctPositive.toFixed(0)}% positive). `;
  else if (pctNegative >= 30) summary += `Notable negative feedback (${pctNegative.toFixed(0)}% negative). `;
  else summary += `Mixed sentiment (${pctPositive.toFixed(0)}% positive, ${pctNegative.toFixed(0)}% negative). `;
  summary += `Average rating: ${avgRating.toFixed(1)}/5. `;
  const worstSession = Object.entries(bySession)
    .filter(([, v]) => v.total >= 3)
    .sort((a, b) => (a[1].negative / a[1].total) - (b[1].negative / b[1].total))[0];
  if (worstSession) summary += `Session "${worstSession[0]}" shows lower satisfaction and may need attention.`;

  const topSuccesses = positive.slice(0, 3).map(r => r.text?.slice(0, 150) || '');
  const topImprovements = negative.slice(0, 3).map(r => r.text?.slice(0, 150) || '');
  const criticalIssues = negative.filter(r => /refund|unsafe|terrible|worst|never again/i.test(r.text || '')).slice(0, 5).map(r => r.text?.slice(0, 120));

  return {
    summary,
    topSuccesses,
    topImprovements,
    criticalIssues,
    surprisingInsights: worstSession ? [`Session "${worstSession[0]}" has the highest negative rate among sessions with 3+ responses.`] : [],
    metrics: { total, pctPositive, pctNegative, avgRating },
  };
}

export function getRecommendations(eventId, limit = 50) {
  const rows = db.prepare(
    `SELECT text, sentiment_label FROM feedback WHERE (? IS NULL OR event_id = ?) AND sentiment_label IN ('negative','neutral') ORDER BY created_at DESC LIMIT ?`
  ).all(eventId || null, eventId || null, limit);

  const text = rows.map(r => (r.text || '').toLowerCase()).join(' ');
  const recs = [];

  if (/\b(food|catering|lunch|coffee|snack)\b/.test(text)) recs.push({ priority: 'high', area: 'Catering', action: 'Improve catering and refreshments based on repeated feedback.' });
  if (/\b(venue|room|space|parking|location|ac|temperature)\b/.test(text)) recs.push({ priority: 'high', area: 'Venue', action: 'Review venue comfort, AC, and parking.' });
  if (/\b(session|content|agenda|speaker|presentation)\b/.test(text)) recs.push({ priority: 'medium', area: 'Content & Speakers', action: 'Refine session content and speaker selection.' });
  if (/\b(wifi|tech|connection|audio|stream)\b/.test(text)) recs.push({ priority: 'medium', area: 'Tech', action: 'Upgrade WiFi and AV support.' });
  if (/\b(schedule|time|break|long|short)\b/.test(text)) recs.push({ priority: 'medium', area: 'Schedule', action: 'Adjust timing and breaks.' });
  if (recs.length === 0) recs.push({ priority: 'low', area: 'General', action: 'Keep collecting feedback to identify improvement areas.' });

  return recs;
}

export function getNPS(eventId) {
  const rows = db.prepare(
    `SELECT rating FROM feedback WHERE (? IS NULL OR event_id = ?) AND rating IS NOT NULL`
  ).all(eventId || null, eventId || null);

  const promoters = rows.filter(r => r.rating >= 9 || r.rating === 5).length;
  const detractors = rows.filter(r => r.rating <= 6 || r.rating === 1).length;
  const total = rows.length;
  // Normalize 1-5 scale to NPS-like: 5->promoter, 1->detractor
  const p = rows.filter(r => r.rating >= 4).length;
  const d = rows.filter(r => r.rating <= 2).length;
  const nps = total === 0 ? 0 : Math.round(((p - d) / total) * 100);
  return { nps, promoters: p, detractors: d, total, scale: '1-5' };
}

export function getPredictiveMetrics(eventId) {
  const rows = db.prepare(
    `SELECT sentiment_label, rating FROM feedback WHERE (? IS NULL OR event_id = ?)`
  ).all(eventId || null, eventId || null);

  const total = rows.length;
  const positive = rows.filter(r => r.sentiment_label === 'positive').length;
  const avgRating = rows.filter(r => r.rating != null).length
    ? rows.filter(r => r.rating != null).reduce((a, r) => a + r.rating, 0) / rows.filter(r => r.rating != null).length
    : null;

  const repeatLikelihood = total === 0 ? 0.5 : Math.min(0.95, 0.5 + (positive / total) * 0.4);
  const successScore = total === 0 ? 0 : Math.min(100, (positive / total) * 40 + (avgRating ? (avgRating / 5) * 60 : 50));

  return {
    eventSuccessScore: Math.round(successScore),
    repeatAttendanceLikelihood: Math.round(repeatLikelihood * 100),
    avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
    sampleSize: total,
  };
}
