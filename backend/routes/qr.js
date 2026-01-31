import { Router } from 'express';
import { db } from '../db/index.js';

const router = Router();

router.get('/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
  const feedbackUrl = `${baseUrl}/#collect?sessionId=${sessionId}&sessionName=${encodeURIComponent(session.name)}&eventId=${session.event_id || ''}`;
  res.json({
    success: true,
    data: {
      sessionId: session.id,
      sessionName: session.name,
      eventId: session.event_id,
      feedbackUrl,
      qrPayload: feedbackUrl,
    },
  });
});

router.get('/event/:eventId', (req, res) => {
  const { eventId } = req.params;
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
  const feedbackUrl = `${baseUrl}/#collect?eventId=${eventId}&eventName=${encodeURIComponent(event.name)}`;
  res.json({
    success: true,
    data: {
      eventId: event.id,
      eventName: event.name,
      feedbackUrl,
      qrPayload: feedbackUrl,
    },
  });
});

export default router;
