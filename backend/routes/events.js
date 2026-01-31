import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { handleValidation, eventCreateRules, idParam } from '../middleware/validation.js';

const router = Router();

// Default events to ensure frontend always has options
const DEFAULT_EVENTS = [
  ['technavya-2', 'TECHNAVYA 2.0', 'Annual tech conference', null, null, 0],
  ['dev-summit-2025', 'Dev Summit 2025', 'Developer conference: keynotes, workshops, and networking', '2025-03-15', '2025-03-17', 0],
  ['product-launch-q2', 'Product Launch Q2', 'New product reveal and customer demos', '2025-04-10', '2025-04-10', 0],
  ['annual-conference', 'Annual Company Conference', 'Company-wide all-hands and breakout sessions', '2025-05-20', '2025-05-22', 0],
  ['tech-workshop', 'Tech Workshop Series', 'Hands-on technical workshops and training', null, null, 0],
  ['customer-day', 'Customer Day', 'Customer appreciation and feedback sessions', '2025-06-05', '2025-06-05', 0],
];

export function ensureDefaultEvents() {
  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO events (id, name, description, start_date, end_date, total_attendees, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const row of DEFAULT_EVENTS) {
    insert.run(...row, now, now);
  }
}

router.get('/', (req, res) => {
  try {
    ensureDefaultEvents();
  } catch (_) {}
  const list = db.prepare(
    `SELECT id, name, description, start_date, end_date, total_attendees, created_at FROM events ORDER BY created_at DESC`
  ).all();
  res.json({ success: true, data: list || [] });
});

router.get('/:id', (req, res) => {
  const row = db.prepare(
    `SELECT * FROM events WHERE id = ?`
  ).get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: 'Event not found' });
  res.json({ success: true, data: row });
});

router.post('/', eventCreateRules, handleValidation, (req, res) => {
  const id = uuidv4();
  const { name, description, startDate, endDate, totalAttendees } = req.body;
  db.prepare(
    `INSERT INTO events (id, name, description, start_date, end_date, total_attendees) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, name || '', description || null, startDate || null, endDate || null, totalAttendees ?? 0);
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  res.status(201).json({ success: true, data: row });
});

const eventBodyKeys = { name: 'name', description: 'description', start_date: 'startDate', end_date: 'endDate', total_attendees: 'totalAttendees' };
router.patch('/:id', idParam, handleValidation, (req, res) => {
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: 'Event not found' });
  const updates = [];
  const values = [];
  Object.entries(eventBodyKeys).forEach(([col, key]) => {
    if (req.body[key] !== undefined) {
      updates.push(`${col} = ?`);
      values.push(req.body[key]);
    }
  });
  if (updates.length) {
    updates.push("updated_at = datetime('now')");
    values.push(req.params.id);
    db.prepare(`UPDATE events SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }
  const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: updated });
});

router.delete('/:id', idParam, handleValidation, (req, res) => {
  const r = db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ success: false, error: 'Event not found' });
  res.json({ success: true });
});

// List images for an event
router.get('/:id/images', (req, res) => {
  const event = db.prepare('SELECT id FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
  const rows = db.prepare('SELECT id, url, caption, created_at FROM event_images WHERE event_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json({ success: true, data: rows || [] });
});

// Add an image URL for an event
router.post('/:id/images', (req, res) => {
  const event = db.prepare('SELECT id FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
  const { url, caption } = req.body || {};
  if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ success: false, error: 'Valid image URL is required (http/https)' });
  }
  const id = uuidv4();
  db.prepare('INSERT INTO event_images (id, event_id, url, caption) VALUES (?, ?, ?, ?)').run(id, req.params.id, url, caption || null);
  const row = db.prepare('SELECT id, url, caption, created_at FROM event_images WHERE id = ?').get(id);
  res.status(201).json({ success: true, data: row });
});

export default router;
