import { Router } from 'express';
import XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import { db } from '../db/index.js';
import { getExecutiveSummary, getRecommendations, getNPS } from '../services/insights.js';

const router = Router();

router.get('/excel', (req, res) => {
  const { eventId } = req.query;
  let sql = `SELECT id, event_name, session_name, attendee_email, rating, rating_venue, rating_content, rating_speakers, rating_organization,
             text, sentiment_label, sentiment_score, created_at FROM feedback WHERE 1=1`;
  const params = eventId ? [eventId] : [];
  if (eventId) sql += ' AND event_id = ?';
  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...params);

  const ws = XLSX.utils.json_to_sheet(rows.map(r => ({
    ID: r.id,
    'Event Name': r.event_name,
    'Session Name': r.session_name,
    Email: r.attendee_email,
    'Overall Rating': r.rating,
    'Venue Rating': r.rating_venue,
    'Content Rating': r.rating_content,
    'Speakers Rating': r.rating_speakers,
    'Organization Rating': r.rating_organization,
    Feedback: r.text,
    Sentiment: r.sentiment_label,
    'Sentiment Score': r.sentiment_score,
    'Created At': r.created_at,
  })));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Feedback');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=feedback-export.xlsx');
  res.send(buf);
});

router.get('/csv', (req, res) => {
  const { eventId } = req.query;
  let sql = `SELECT event_name, session_name, rating, text, sentiment_label, created_at FROM feedback WHERE 1=1`;
  const params = eventId ? [eventId] : [];
  if (eventId) sql += ' AND event_id = ?';
  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...params);
  const header = 'Event Name,Session Name,Rating,Feedback,Sentiment,Created At\n';
  const csv = header + rows.map(r => {
    const esc = (v) => (v == null ? '' : String(v).replace(/"/g, '""'));
    return [r.event_name, r.session_name, r.rating, r.text, r.sentiment_label, r.created_at].map(esc).map(v => `"${v}"`).join(',');
  }).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=feedback-export.csv');
  res.send(csv);
});

router.get('/pdf', (req, res) => {
  try {
    const eventId = req.query.eventId || null;
    const summary = getExecutiveSummary(eventId);
    const recs = getRecommendations(eventId);
    const nps = getNPS(eventId);

    const margin = 50;
    const pageW = 595.28;
    const pageH = 841.89;
    const contentWidth = pageW - margin * 2;

    const doc = new PDFDocument({
      size: 'A4',
      margin: { top: 70, left: margin, right: margin, bottom: margin },
      bufferPages: true,
      info: { Title: 'Event Feedback Report', Author: 'Digital Event Feedback Analyzer' },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=feedback-report.pdf');
    doc.pipe(res);

    const dark = '#1a1a2e';
    const accent = '#00b87a';
    const lightGray = '#f0f0f0';
    const midGray = '#6b7280';

    function drawHeader() {
      doc.rect(0, 0, pageW, 56).fill(dark);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text('Event Feedback Report', margin, 16, { width: contentWidth, align: 'center' });
      doc.font('Helvetica').fontSize(9).text('Generated ' + new Date().toLocaleDateString('en-US', { dateStyle: 'long', timeStyle: 'short' }), margin, 38, { width: contentWidth, align: 'center' });
      doc.fillColor('black');
    }

    function sectionHead(title) {
      doc.moveDown(0.8);
      doc.fillColor(dark).font('Helvetica-Bold').fontSize(13).text(title);
      doc.moveDown(0.25);
      doc.strokeColor(accent).lineWidth(2).moveTo(margin, doc.y).lineTo(margin + 100, doc.y).stroke();
      doc.moveDown(0.5);
    }

    drawHeader();

    // ----- Executive Summary (in a box) -----
    sectionHead('Executive Summary');
    const sumY = doc.y;
    doc.fillColor('black').font('Helvetica').fontSize(10).text(summary.summary || 'No summary available.', { width: contentWidth - 20, lineGap: 6 });
    doc.y += 10;
    const sumH = doc.y - sumY + 14;
    doc.fillColor(lightGray).rect(margin, sumY - 4, contentWidth, sumH).fill();
    doc.strokeColor('#e5e7eb').rect(margin, sumY - 4, contentWidth, sumH).stroke();
    doc.fillColor('black');
    doc.moveDown(0.6);

    // ----- Key Metrics (card style) -----
    sectionHead('Key Metrics');
    const metricsY = doc.y;
    if (nps.total > 0) {
      doc.font('Helvetica').fontSize(10).fillColor('black');
      doc.text('NPS-style score: ' + nps.nps + '   •   Promoters: ' + nps.promoters + '   •   Detractors: ' + nps.detractors + '   •   Total: ' + nps.total, { width: contentWidth });
      if (summary.metrics && summary.metrics.avgRating != null) {
        doc.moveDown(0.3);
        doc.fontSize(9).fillColor(midGray).text('Avg rating: ' + summary.metrics.avgRating.toFixed(1) + '/5   •   Positive: ' + (summary.metrics.pctPositive || 0).toFixed(0) + '%   •   Negative: ' + (summary.metrics.pctNegative || 0).toFixed(0) + '%', { width: contentWidth });
      }
    } else {
      doc.font('Helvetica').fontSize(10).fillColor(midGray).text('No rating data yet.');
    }
    doc.y += 8;
    const metricsH = doc.y - metricsY + 10;
    doc.fillColor(lightGray).rect(margin, metricsY - 4, contentWidth, metricsH).fill();
    doc.strokeColor('#e5e7eb').rect(margin, metricsY - 4, contentWidth, metricsH).stroke();
    doc.fillColor('black');
    doc.moveDown(0.6);

    // ----- Recommendations -----
    sectionHead('Recommendations');
    doc.fillColor('black').font('Helvetica').fontSize(10);
    recs.forEach((r, i) => {
      doc.font('Helvetica-Bold').text((i + 1) + '. ' + (r.area || 'General'), { continued: true });
      doc.font('Helvetica').fillColor(midGray).text('  (' + (r.priority || 'medium') + ')');
      doc.fillColor('black').font('Helvetica').text(r.action || '', { width: contentWidth, indent: 18, lineGap: 5 });
      doc.moveDown(0.45);
    });

    // ----- Top feedback -----
    if (summary.topSuccesses && summary.topSuccesses.length > 0) {
      sectionHead('Top Positive Feedback');
      doc.fillColor('black').font('Helvetica').fontSize(9);
      summary.topSuccesses.slice(0, 3).forEach((t, i) => {
        if (t) doc.text('"' + String(t).slice(0, 140) + (String(t).length > 140 ? '…' : '') + '"', { width: contentWidth, indent: 8, lineGap: 4 });
        doc.moveDown(0.35);
      });
    }
    if (summary.topImprovements && summary.topImprovements.length > 0) {
      sectionHead('Areas for Improvement');
      doc.fillColor('black').font('Helvetica').fontSize(9);
      summary.topImprovements.slice(0, 3).forEach((t) => {
        if (t) doc.text('"' + String(t).slice(0, 140) + (String(t).length > 140 ? '…' : '') + '"', { width: contentWidth, indent: 8, lineGap: 4 });
        doc.moveDown(0.35);
      });
    }

    // ----- Footer on each page -----
    const pages = doc.bufferedPageRange();
    const footerY = pageH - 36;
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(margin, footerY - 8).lineTo(margin + contentWidth, footerY - 8).stroke();
      doc.font('Helvetica').fontSize(8).fillColor(midGray);
      doc.text('Digital Event Feedback Analyzer', margin, footerY, { width: contentWidth, align: 'left' });
      doc.text('Page ' + (i + 1) + ' of ' + pages.count, margin, footerY, { width: contentWidth, align: 'right' });
    }

    doc.end();
  } catch (err) {
    console.error('PDF export error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate PDF' });
  }
});

router.get('/json', (req, res) => {
  const { eventId, limit = 500 } = req.query;
  let sql = `SELECT * FROM feedback WHERE 1=1`;
  const params = eventId ? [eventId] : [];
  if (eventId) sql += ' AND event_id = ?';
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(Math.min(parseInt(limit, 10) || 500, 1000));
  const rows = db.prepare(sql).all(...params);
  const clean = rows.map(r => {
    const o = { ...r };
    if (o.aspect_sentiment) o.aspect_sentiment = JSON.parse(o.aspect_sentiment);
    if (o.emotions) o.emotions = JSON.parse(o.emotions);
    if (o.keywords) o.keywords = JSON.parse(o.keywords);
    return o;
  });
  res.json({ success: true, data: clean });
});

export default router;
