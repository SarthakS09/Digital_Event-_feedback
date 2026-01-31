# Digital Event Feedback Analyzer — Backend

Node.js/Express API for the Digital Event Feedback Analyzer: feedback collection, AI sentiment analysis, real-time alerts, analytics, and export.

## Features

- **Feedback collection**: Multi-field form with validation, profanity filter, spam/duplicate detection
- **AI sentiment**: Multi-level sentiment (overall + aspect-based), keyword extraction, urgency/emotion; OpenAI optional with local fallback
- **Real-time alerts**: Multi-channel (Email/Nodemailer, SMS/Twilio, Slack webhooks); configurable thresholds and severity (critical/high/medium/low)
- **Analytics**: Overview, sentiment by session, ratings, timeline, trending keywords, session performance
- **AI insights**: Executive summary, recommendations, NPS-style score, predictive metrics
- **Comparative analytics**: Multi-event comparison and historical trends
- **Export**: Excel, CSV, PDF, JSON
- **Events & sessions**: CRUD; QR payload endpoints for session/event feedback links

## Quick start

```bash
cd backend
cp .env.example .env   # edit .env if you need OpenAI or email
npm install
npm run init-db       # create SQLite DB (optional; auto-created on first run)
npm start
```

API: `http://localhost:3000`

## Environment (.env)

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default 3000) |
| `FRONTEND_URL` | Frontend origin for CORS (e.g. http://localhost:8080) |
| `OPENAI_API_KEY` | Optional; enables GPT-based sentiment (otherwise local keyword analysis) |
| `SMTP_*` / `ALERT_EMAIL_TO` | Email alerts (Nodemailer) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `ALERT_SMS_TO` | SMS alerts (Twilio) |
| `SLACK_WEBHOOK_URL` | Slack notifications (incoming webhook) |
| `ALERT_CHANNELS` | Comma-separated: `email`, `sms`, `slack` (default: all) |
| `ALERT_MIN_SEVERITY` | `critical` \| `high` \| `medium` \| `low` (default: low) |
| `ALERT_NEGATIVE_MINUTES`, `ALERT_NEGATIVE_COUNT` | Threshold: fire when N negative in M minutes (overridable via API) |
| `DB_PATH` | SQLite file path (default ./data/feedback.db) |

## API overview

- `GET/POST /api/events` — List / create events
- `GET/POST /api/sessions` — List / create sessions (`?eventId=`)
- `POST /api/feedback` — Submit feedback (body: eventId, sessionId, eventName, sessionName, attendeeName, attendeeEmail, rating, ratingVenue, ratingContent, ratingSpeakers, ratingOrganization, text, isAnonymous)
- `GET /api/feedback` — List feedback (`?eventId=`, `?sessionId=`, `?limit=`)
- `GET /api/analytics/overview` — Total count, sentiment counts, avg rating
- `GET /api/analytics/sentiment` — Sentiment distribution
- `GET /api/analytics/sentiment-by-session` — Sentiment per session
- `GET /api/analytics/ratings` — Rating distribution
- `GET /api/analytics/session-performance` — Session comparison
- `GET /api/analytics/insights/summary` — Executive summary
- `GET /api/analytics/insights/recommendations` — Action recommendations
- `GET /api/analytics/insights/nps` — NPS-style score
- `GET /api/analytics/insights/predictive` — Success score, repeat likelihood
- `GET /api/comparative/events?eventIds=id1,id2` — Compare events
- `GET /api/comparative/trends` — Historical trend
- `GET /api/qr/session/:sessionId` — Feedback URL for QR (session)
- `GET /api/alert-settings` — Current alert config (channels, severity, thresholds)
- `PUT /api/alert-settings` — Update channels, minSeverity, negativeCount, negativeInMinutes (body: JSON)
- `GET /api/qr/event/:eventId` — Feedback URL for QR (event)
- `GET /api/export/excel` — Download Excel
- `GET /api/export/csv` — Download CSV
- `GET /api/export/pdf` — Download PDF report
- `GET /api/export/json` — JSON export

## Tech

- **Runtime**: Node 18+
- **Framework**: Express
- **DB**: SQLite (better-sqlite3)
- **Validation**: express-validator
- **Alerts**: nodemailer
- **Optional NLP**: OpenAI (gpt-4o-mini)
- **Export**: xlsx, pdfkit
