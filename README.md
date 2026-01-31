# DIGITAL EVENT FEEDBACK ANALYZER

Turn unstructured event feedback into **clear, actionable insights** through AI-powered sentiment analysis, real-time alerting, and predictive analytics.

## Gaps this solution overcomes

| Gap | Other tools | This solution |
|-----|-------------|----------------|
| **1. Manual Analysis Paralysis** — Traditional tools require manual reading of hundreds of responses | Export to Excel → Read each feedback → Manually categorize | **Instant AI sentiment analysis on submission** with auto-categorization (positive/neutral/negative + aspect-based: venue, content, speakers, organization) and keyword extraction |
| **2. Delayed Actionable Insights** — Most platforms show raw data but don't tell you WHAT to do | "Here are your ratings" (no context) | **AI-generated Executive Summary** + prioritized **Recommendations** by area (Catering, Venue, Content, Tech, Schedule) with specific action items; worst-performing session called out |
| **3. Pattern Blindness** — Hidden trends buried in text feedback | No keyword extraction or trending topic analysis | **Automated keyword extraction** per feedback + **Trending keywords** API (`/api/analytics/trending-keywords`) with frequency; sentiment-by-session surfaces patterns across sessions |
| **4. Sentiment Context Missing** — A 3-star could be "good but cold" or "mediocre" | Just numerical ratings without WHY | **Text sentiment combined with ratings** — each response has both star rating and sentiment label + aspect sentiment and emotions; dashboard shows rating + sentiment + text together |
| **5. Session-Specific Blindspots** — Can't quickly see which sessions need improvement | Global averages hide problem areas | **Per-session performance** — `session-performance` and `sentiment-by-session` APIs; filter by event/session on dashboard; "General" or named sessions show avg rating and positive/negative counts |
| **6. Time-to-Insight Gap** — Feedback sits for days before review | Batch processing, manual export, delayed reporting | **Real-time analysis** — Submit feedback → instant sentiment on the server → response includes sentiment; dashboard refreshes when you load/refilter (refresh or re-open insights to see latest) |
| **7. Stakeholder Communication Friction** — Hard to share with non-technical teams | Raw spreadsheets or complex dashboards | **Visual dashboard** (sentiment chart, recommendations, executive summary) + **Export-ready insights** (PDF report, Excel, CSV) for sharing |
| **8. No Proactive Alerting** — Critical negative feedback gets lost | All feedback treated equally | **Top negative feedback** in analytics + **Email alerts** for critical keywords (refund, terrible, unsafe, etc.) and negative feedback when SMTP is configured; threshold alerts (e.g. 3 negative in 30 min) |

## What it does

- **Collect** — Multi-channel feedback: web form (event/session, name, email, ratings, category ratings), QR links for sessions.
- **Analyze** — AI sentiment (overall + aspect-based), keyword extraction, urgency/emotion; OpenAI optional with local fallback.
- **Insights** — Executive summary, recommendations, NPS-style score, sentiment chart, session performance, trending keywords.
- **Alerts** — Email alerts for critical keywords and negative feedback (configurable).
- **Export** — PDF, Excel, CSV, JSON.
- **Comparative** — Multi-event comparison and historical trends.

## Run locally (full stack)

### 1. Backend (API)

```bash
cd backend
npm install
npm start
```

API: **http://localhost:3000**  
Health: http://localhost:3000/api/health

Optional: copy `backend/.env.example` to `backend/.env` and set `OPENAI_API_KEY` and/or SMTP for alerts.

### 2. Frontend

Serve the project root (e.g. with Node):

```bash
npx serve -l 8080
```

Or Python: `python -m http.server 8080`  
Or open `index.html` in a browser (API must be at `http://localhost:3000` or set `window.API_BASE` before loading `app.js`).

Visit **http://localhost:8080**.

### 3. Quick test

1. Open http://localhost:8080  
2. Submit feedback (event name optional).  
3. Check insights: sentiment chart, recommendations, executive summary, export buttons.

## Project layout

- **Frontend**: `index.html`, `app.js`, `styles.css` — form, dashboard, API integration.
- **Backend**: `backend/` — Express API, SQLite (sql.js), sentiment service, alerts, analytics, export.
  - `backend/README.md` — API reference and env vars.

## Tech

- **Frontend**: HTML5, CSS3, JavaScript, Chart.js  
- **Backend**: Node 18+, Express, sql.js (SQLite), express-validator, bad-words, nodemailer, optional OpenAI, xlsx, pdfkit  

## Expected outcome

Actionable insights for event improvement: sentiment breakdown, theme-based recommendations, executive summary, NPS-style score, session comparison, and export (PDF/Excel/CSV).
