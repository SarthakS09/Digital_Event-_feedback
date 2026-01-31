import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8080',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'feedback.db'),
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  alertEmailTo: process.env.ALERT_EMAIL_TO || '',
  alertSmsTo: process.env.ALERT_SMS_TO || '',
  alertSlackWebhookUrl: process.env.SLACK_WEBHOOK_URL || '',
  alertChannels: (process.env.ALERT_CHANNELS || 'email,sms,slack').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  alertMinSeverity: process.env.ALERT_MIN_SEVERITY || 'low',
  alertThresholds: {
    negativeInMinutes: parseInt(process.env.ALERT_NEGATIVE_MINUTES || '30', 10),
    negativeCount: parseInt(process.env.ALERT_NEGATIVE_COUNT || '3', 10),
    ratingBelow: parseFloat(process.env.ALERT_RATING_BELOW || '3'),
  },
  criticalKeywords: (process.env.ALERT_CRITICAL_KEYWORDS || 'refund,terrible,unsafe,lawsuit,worst,disaster,never again,scam').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    fromNumber: process.env.TWILIO_FROM_NUMBER || '',
  },
};
