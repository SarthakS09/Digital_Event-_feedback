-- Events
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  start_date TEXT,
  end_date TEXT,
  total_attendees INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Sessions (tracks within an event)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  start_time TEXT,
  end_time TEXT,
  speaker_name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Feedback
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  event_id TEXT REFERENCES events(id),
  session_id TEXT REFERENCES sessions(id),
  attendee_name TEXT,
  attendee_email TEXT,
  event_name TEXT,
  session_name TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  rating_venue INTEGER CHECK (rating_venue >= 1 AND rating_venue <= 5),
  rating_content INTEGER CHECK (rating_content >= 1 AND rating_content <= 5),
  rating_speakers INTEGER CHECK (rating_speakers >= 1 AND rating_speakers <= 5),
  rating_organization INTEGER CHECK (rating_organization >= 1 AND rating_organization <= 5),
  text TEXT NOT NULL,
  sentiment_label TEXT CHECK (sentiment_label IN ('positive', 'neutral', 'negative')),
  sentiment_score REAL,
  sentiment_confidence REAL,
  aspect_sentiment TEXT,
  emotions TEXT,
  urgency TEXT,
  keywords TEXT,
  language TEXT,
  is_anonymous INTEGER DEFAULT 0,
  device_metadata TEXT,
  ip_hash TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_feedback_event ON feedback(event_id);
CREATE INDEX IF NOT EXISTS idx_feedback_session ON feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_sentiment ON feedback(sentiment_label);

-- Alerts (log of sent alerts)
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT,
  type TEXT NOT NULL,
  title TEXT,
  body TEXT,
  channel TEXT,
  recipient TEXT,
  payload TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Alert rules (configurable thresholds per event)
CREATE TABLE IF NOT EXISTS alert_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT,
  rule_type TEXT NOT NULL,
  threshold_value REAL,
  window_minutes INTEGER,
  recipients TEXT,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Alert config overrides (key-value; keys: channels, minSeverity, negativeInMinutes, negativeCount)
CREATE TABLE IF NOT EXISTS alert_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- AI summaries cache
CREATE TABLE IF NOT EXISTS ai_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT,
  scope TEXT,
  content TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
