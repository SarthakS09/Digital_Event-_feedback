import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { config } from '../config/index.js';
import { db } from '../db/index.js';

const SEVERITY_ORDER = { critical: 4, high: 3, medium: 2, low: 1 };

function getAlertOverrides() {
  try {
    const rows = db.prepare('SELECT key, value FROM alert_config').all();
    const o = {};
    rows.forEach(r => { o[r.key] = r.value; });
    return o;
  } catch (_) {
    return {};
  }
}

function severityAllowed(alertSeverity) {
  const overrides = getAlertOverrides();
  const min = (overrides.minSeverity || config.alertMinSeverity || 'low').toLowerCase();
  const a = SEVERITY_ORDER[alertSeverity] ?? 1;
  const b = SEVERITY_ORDER[min] ?? 1;
  return a >= b;
}

function channelsEnabled() {
  const overrides = getAlertOverrides();
  const list = overrides.channels ? overrides.channels.split(',').map(s => s.trim().toLowerCase()) : (config.alertChannels || ['email']);
  return {
    email: list.includes('email') && (config.alertEmailTo || config.smtp?.host),
    sms: list.includes('sms') && config.alertSmsTo && config.twilio?.accountSid && config.twilio?.authToken && config.twilio?.fromNumber,
    slack: list.includes('slack') && config.alertSlackWebhookUrl,
  };
}

function getThresholds() {
  const overrides = getAlertOverrides();
  return {
    negativeInMinutes: overrides.negativeInMinutes != null ? parseInt(overrides.negativeInMinutes, 10) : (config.alertThresholds?.negativeInMinutes ?? 30),
    negativeCount: overrides.negativeCount != null ? parseInt(overrides.negativeCount, 10) : (config.alertThresholds?.negativeCount ?? 3),
    ratingBelow: overrides.ratingBelow != null ? parseFloat(overrides.ratingBelow) : (config.alertThresholds?.ratingBelow ?? 3),
  };
}

function getTransport() {
  if (!config.smtp?.host || !config.smtp?.user) return null;
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
}

export async function sendEmailAlert({ to, subject, text, html }) {
  const transport = getTransport();
  const recipient = to || config.alertEmailTo;
  if (!transport || !recipient) return { sent: false, reason: 'email not configured' };
  try {
    await transport.sendMail({
      from: config.smtp.user,
      to: recipient,
      subject: subject || 'Feedback Analyzer Alert',
      text: text || '',
      html: html || text,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

export async function sendSmsAlert({ to, body }) {
  const recipient = to || config.alertSmsTo;
  if (!recipient || !config.twilio?.accountSid || !config.twilio?.authToken || !config.twilio?.fromNumber) {
    return { sent: false, reason: 'SMS not configured (Twilio)' };
  }
  try {
    const client = twilio(config.twilio.accountSid, config.twilio.authToken);
    await client.messages.create({
      body: (body || 'Feedback alert').slice(0, 1600),
      from: config.twilio.fromNumber,
      to: recipient,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

export async function sendSlackAlert({ title, body, severity }) {
  const url = config.alertSlackWebhookUrl;
  if (!url) return { sent: false, reason: 'Slack webhook not configured' };
  try {
    const color = severity === 'critical' ? '#ff0000' : severity === 'high' ? '#ff6b6b' : severity === 'medium' ? '#ffb84d' : '#00e5a0';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: [{
          color,
          title: title || 'Feedback Analyzer Alert',
          text: body || '',
          footer: 'Digital Event Feedback Analyzer',
          ts: Math.floor(Date.now() / 1000),
        }],
      }),
    });
    if (!res.ok) throw new Error(res.statusText);
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

export function logAlert(eventId, type, title, body, channel, recipient, payload = {}) {
  db.prepare(
    `INSERT INTO alerts (event_id, type, title, body, channel, recipient, payload) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(eventId || null, type, title || '', body || '', channel || 'email', recipient || '', JSON.stringify(payload));
}

async function dispatchAlert({ severity, title, body, eventId, type }) {
  if (!severityAllowed(severity)) return [];
  const ch = channelsEnabled();
  const results = [];

  if (ch.email) {
    const r = await sendEmailAlert({ subject: title, text: body });
    logAlert(eventId, type, title, body, 'email', config.alertEmailTo, { severity });
    results.push({ channel: 'email', sent: r.sent });
  }
  if (ch.sms) {
    const r = await sendSmsAlert({ body: `[${severity?.toUpperCase()}] ${title}\n${(body || '').slice(0, 120)}` });
    logAlert(eventId, type, title, body, 'sms', config.alertSmsTo, { severity });
    results.push({ channel: 'sms', sent: r.sent });
  }
  if (ch.slack) {
    const r = await sendSlackAlert({ title, body, severity });
    logAlert(eventId, type, title, body, 'slack', 'webhook', { severity });
    results.push({ channel: 'slack', sent: r.sent });
  }

  return results;
}

export async function checkAndFireAlerts(feedback, eventId) {
  const alerts = [];
  const criticalKeywords = config.criticalKeywords || [];
  const textLower = (feedback.text || '').toLowerCase();
  const isCritical = criticalKeywords.some(k => textLower.includes(k));

  if (isCritical) {
    const title = `[Critical] Negative feedback - ${feedback.sentiment_label}`;
    const body = `Critical keywords detected.\n\nExcerpt: "${(feedback.text || '').slice(0, 300)}..."\n\nSentiment: ${feedback.sentiment_label}\nTime: ${feedback.created_at}`;
    const results = await dispatchAlert({ severity: 'critical', title, body, eventId, type: 'critical_keywords' });
    results.forEach(r => alerts.push({ type: 'critical_keywords', channel: r.channel, sent: r.sent }));
  }

  if (feedback.sentiment_label === 'negative' && feedback.sentiment_confidence > 0.6 && !criticalKeywords.some(k => textLower.includes(k))) {
    const title = `[High] Negative feedback received`;
    const body = `Negative feedback.\n\n"${(feedback.text || '').slice(0, 200)}..."\n\nRating: ${feedback.rating ?? 'N/A'}\nTime: ${feedback.created_at}`;
    const results = await dispatchAlert({ severity: 'high', title, body, eventId, type: 'negative_feedback' });
    results.forEach(r => alerts.push({ type: 'negative_feedback', channel: r.channel, sent: r.sent }));
  }

  return alerts;
}

export async function checkThresholdAlerts(eventId) {
  const ch = channelsEnabled();
  if (!ch.email && !ch.sms && !ch.slack) return [];
  if (!severityAllowed('medium')) return [];

  const thresholds = getThresholds();
  const windowMs = thresholds.negativeInMinutes * 60 * 1000;
  const threshold = thresholds.negativeCount;
  const since = new Date(Date.now() - windowMs).toISOString();

  const count = db.prepare(
    `SELECT COUNT(*) as c FROM feedback WHERE (event_id = ? OR event_id IS NULL) AND sentiment_label = 'negative' AND created_at >= ?`
  ).get(eventId || null, since);

  if (count && count.c >= threshold) {
    const title = `[Medium] ${count.c} negative feedback in last ${thresholds.negativeInMinutes} min`;
    const body = `Negative feedback count: ${count.c}. Consider reviewing recent feedback.`;
    const results = await dispatchAlert({ severity: 'medium', title, body, eventId, type: 'threshold_negative' });
    return results.map(r => ({ type: 'threshold_negative', channel: r.channel, sent: r.sent }));
  }
  return [];
}
