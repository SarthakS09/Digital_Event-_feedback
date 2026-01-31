import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { sessionCreateRules, handleValidation, idParam } from '../middleware/validation.js';

const router = Router();

router.get('/', (req, res) => {
  const eventId = req.query.eventId;
  const stmt = eventId
    ? db.prepare('SELECT * FROM sessions WHERE event_id = ? ORDER BY start_time, name')
    : db.prepare('SELECT * FROM sessions ORDER BY created_at DESC');
  const list = eventId ? stmt.all(eventId) : stmt.all();
  res.json({ success: true, data: list });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: 'Session not found' });
  res.json({ success: true, data: row });
});

router.post('/', sessionCreateRules, handleValidation, (req, res) => {
  const id = uuidv4();
  const { eventId, name, description, startTime, endTime, speakerName } = req.body;
  db.prepare(
    `INSERT INTO sessions (id, event_id, name, description, start_time, end_time, speaker_name) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, eventId, name, description || null, startTime || null, endTime || null, speakerName || null);
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  res.status(201).json({ success: true, data: row });
});

router.patch('/:id', idParam, handleValidation, (req, res) => {
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: 'Session not found' });
  const fields = ['name', 'description', 'start_time', 'end_time', 'speaker_name'];
  const bodyMap = { name: 'name', description: 'description', start_time: 'startTime', end_time: 'endTime', speaker_name: 'speakerName' };
  const updates = [];
  const values = [];
  fields.forEach(f => {
    const key = bodyMap[f] || f;
    if (req.body[key] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(req.body[key]);
    }
  });
  if (updates.length) {
    updates.push("updated_at = datetime('now')");
    values.push(req.params.id);
    db.prepare(`UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }
  const updated = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: updated });
});

router.delete('/:id', idParam, handleValidation, (req, res) => {
  const r = db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
  if (r.changes === 0) return res.status(404).json({ success: false, error: 'Session not found' });
  res.json({ success: true });
});

export default router;
