import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { config } from '../config/index.js';
import { db } from '../db/index.js';

const router = Router();

function getOverrides() {
  try {
    db.exec('CREATE TABLE IF NOT EXISTS alert_config (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    const rows = db.prepare('SELECT key, value FROM alert_config').all();
    const o = {};
    rows.forEach(r => { o[r.key] = r.value; });
    return o;
  } catch (_) {
    return {};
  }
}

router.get('/', (req, res) => {
  try {
    const overrides = getOverrides();
    const defaultChannels = Array.isArray(config.alertChannels) ? config.alertChannels : ['email', 'sms', 'slack'];
    const channels = overrides.channels
      ? overrides.channels.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      : defaultChannels;
    const thresholds = config.alertThresholds || {};
    res.json({
      success: true,
      data: {
        channels,
        severityLevels: ['critical', 'high', 'medium', 'low'],
        minSeverity: overrides.minSeverity || config.alertMinSeverity || 'low',
        thresholds: {
          negativeInMinutes: overrides.negativeInMinutes != null ? parseInt(overrides.negativeInMinutes, 10) : (thresholds.negativeInMinutes ?? 30),
          negativeCount: overrides.negativeCount != null ? parseInt(overrides.negativeCount, 10) : (thresholds.negativeCount ?? 3),
          ratingBelow: overrides.ratingBelow != null ? parseFloat(overrides.ratingBelow) : (thresholds.ratingBelow ?? 3),
        },
        channelsConfigured: {
          email: !!(config.alertEmailTo || (config.smtp && config.smtp.host)),
          sms: !!(config.alertSmsTo && config.twilio && config.twilio.accountSid && config.twilio.fromNumber),
          slack: !!config.alertSlackWebhookUrl,
        },
      },
    });
  } catch (err) {
    console.error('GET /api/alert-settings error:', err);
    res.status(500).json({ success: false, error: 'Failed to load alert settings' });
  }
});

const putRules = [
  body('channels').optional().isArray(),
  body('channels.*').optional().isIn(['email', 'sms', 'slack']),
  body('minSeverity').optional().isIn(['critical', 'high', 'medium', 'low']),
  body('negativeInMinutes').optional().isInt({ min: 1, max: 1440 }),
  body('negativeCount').optional().isInt({ min: 1, max: 100 }),
  body('ratingBelow').optional().isFloat({ min: 1, max: 5 }),
];

router.put('/', putRules, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const updates = req.body;
  if (Array.isArray(updates.channels)) {
    const val = updates.channels.map(c => String(c).toLowerCase()).filter(c => ['email', 'sms', 'slack'].includes(c)).join(',');
    db.prepare('INSERT OR REPLACE INTO alert_config (key, value) VALUES (?, ?)').run('channels', val);
  }
  if (updates.minSeverity) {
    db.prepare('INSERT OR REPLACE INTO alert_config (key, value) VALUES (?, ?)').run('minSeverity', String(updates.minSeverity).toLowerCase());
  }
  if (updates.negativeInMinutes != null) {
    db.prepare('INSERT OR REPLACE INTO alert_config (key, value) VALUES (?, ?)').run('negativeInMinutes', String(updates.negativeInMinutes));
  }
  if (updates.negativeCount != null) {
    db.prepare('INSERT OR REPLACE INTO alert_config (key, value) VALUES (?, ?)').run('negativeCount', String(updates.negativeCount));
  }
  if (updates.ratingBelow != null) {
    db.prepare('INSERT OR REPLACE INTO alert_config (key, value) VALUES (?, ?)').run('ratingBelow', String(updates.ratingBelow));
  }

  const overrides = getOverrides();
  res.json({
    success: true,
    data: {
      channels: overrides.channels ? overrides.channels.split(',') : config.alertChannels,
      minSeverity: overrides.minSeverity || config.alertMinSeverity,
      thresholds: {
        negativeInMinutes: overrides.negativeInMinutes != null ? parseInt(overrides.negativeInMinutes, 10) : config.alertThresholds?.negativeInMinutes,
        negativeCount: overrides.negativeCount != null ? parseInt(overrides.negativeCount, 10) : config.alertThresholds?.negativeCount,
        ratingBelow: overrides.ratingBelow != null ? parseFloat(overrides.ratingBelow) : config.alertThresholds?.ratingBelow,
      },
    },
  });
});

export default router;
