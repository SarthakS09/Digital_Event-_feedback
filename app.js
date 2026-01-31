/* DIGITAL EVENT FEEDBACK ANALYZER - Frontend with Backend API */

const API_BASE = window.API_BASE || 'http://localhost:3000';
let useApi = true;
let feedbackStore = [];
let sentimentChart = null;
let eventsList = [];
let sessionsList = [];

const feedbackForm = document.getElementById('feedbackForm');
const feedbackText = document.getElementById('feedbackText');
const charCountEl = document.getElementById('charCount');
const resultCard = document.getElementById('resultCard');
const resultSentiment = document.getElementById('resultSentiment');
const resultText = document.getElementById('resultText');
const feedbackList = document.getElementById('feedbackList');
const recommendations = document.getElementById('recommendations');
const totalFeedbackEl = document.getElementById('totalFeedback');
const avgSentimentEl = document.getElementById('avgSentiment');
const insightCountEl = document.getElementById('insightCount');
const ratingStars = document.getElementById('ratingStars');
const eventSelect = document.getElementById('eventSelect');
const sessionSelect = document.getElementById('sessionSelect');
const eventNameInput = document.getElementById('eventName');
const attendeeNameInput = document.getElementById('attendeeName');
const attendeeEmailInput = document.getElementById('attendeeEmail');
const insightEventFilter = document.getElementById('insightEventFilter');
const execSummary = document.getElementById('execSummary');
const npsRow = document.getElementById('npsRow');
const exportExcel = document.getElementById('exportExcel');
const exportPdf = document.getElementById('exportPdf');
const exportCsv = document.getElementById('exportCsv');
const apiStatusEl = document.getElementById('apiStatus');
const trendingKeywordsEl = document.getElementById('trendingKeywords');
const resultKeywordsEl = document.getElementById('resultKeywords');

let selectedRating = 0;
let backendConnected = false;
const categoryRatings = { venue: 0, content: 0, speakers: 0, organization: 0 };

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s == null ? '' : s;
  return div.innerHTML;
}

async function api(path, options = {}) {
  try {
    const res = await fetch(API_BASE + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  } catch (e) {
    console.warn('API error', path, e);
    throw e;
  }
}

function setApiStatus(connected) {
  backendConnected = connected;
  if (!apiStatusEl) return;
  if (connected) {
    apiStatusEl.textContent = 'Connected';
    apiStatusEl.className = 'api-status connected';
  } else {
    apiStatusEl.textContent = 'Backend offline';
    apiStatusEl.className = 'api-status offline';
  }
}

async function checkBackendConnection() {
  try {
    await fetch(API_BASE + '/api/health', { method: 'GET' });
    setApiStatus(true);
    return true;
  } catch {
    setApiStatus(false);
    return false;
  }
}

function prefillFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get('eventId');
  const sessionId = params.get('sessionId');
  const eventName = params.get('eventName');
  const sessionName = params.get('sessionName');
  if (eventId && eventSelect) eventSelect.value = eventId;
  if (sessionId && sessionSelect) sessionSelect.value = sessionId;
  if (eventName && eventNameInput) eventNameInput.value = decodeURIComponent(eventName);
  if (sessionName && sessionSelect) {
    const opt = [...sessionSelect.options].find(o => o.textContent === decodeURIComponent(sessionName));
    if (opt) sessionSelect.value = opt.value;
  }
}

function buildCategoryStars() {
  const container = document.querySelector('.category-ratings-grid');
  if (!container) return;
  ['venue', 'content', 'speakers', 'organization'].forEach(cat => {
    const wrap = container.querySelector(`[data-category="${cat}"]`);
    if (!wrap) return;
    wrap.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'star';
      btn.setAttribute('aria-label', i + ' star');
      btn.dataset.value = i;
      btn.textContent = '★';
      btn.addEventListener('click', () => {
        categoryRatings[cat] = categoryRatings[cat] === i ? 0 : i;
        wrap.querySelectorAll('.star').forEach((s, j) => s.classList.toggle('active', j < categoryRatings[cat]));
      });
      wrap.appendChild(btn);
    }
  });
}

feedbackText.addEventListener('input', () => {
  if (charCountEl) charCountEl.textContent = feedbackText.value.length;
});

ratingStars.querySelectorAll('.star').forEach((btn, i) => {
  btn.addEventListener('click', () => {
    selectedRating = selectedRating === i + 1 ? 0 : i + 1;
    ratingStars.querySelectorAll('.star').forEach((s, j) => s.classList.toggle('active', j < selectedRating));
  });
});

function eventId(e) { return e && (e.id != null ? e.id : e.ID); }
function eventName(e) { return e && (e.name != null ? e.name : e.Name || e.eventName) || 'Unnamed'; }

// Fallback event list when API fails or returns empty (matches backend defaults)
const DEFAULT_EVENTS_FALLBACK = [
  { id: 'technavya-2', name: 'TECHNAVYA 2.0' },
  { id: 'dev-summit-2025', name: 'Dev Summit 2025' },
  { id: 'product-launch-q2', name: 'Product Launch Q2' },
  { id: 'annual-conference', name: 'Annual Company Conference' },
  { id: 'tech-workshop', name: 'Tech Workshop Series' },
  { id: 'customer-day', name: 'Customer Day' },
];

function renderEventOptions() {
  const eventOptions = eventsList.map(e => `<option value="${escapeHtml(eventId(e) || '')}">${escapeHtml(eventName(e))}</option>`).join('');
  if (eventSelect) {
    const current = eventSelect.value;
    eventSelect.innerHTML = '<option value="">— Type or select —</option>' + eventOptions;
    if (current) eventSelect.value = current;
  }
  if (insightEventFilter) {
    const cur = insightEventFilter.value;
    insightEventFilter.innerHTML = '<option value="">All events</option>' + eventOptions;
    if (cur) insightEventFilter.value = cur;
  }
}

async function loadEvents() {
  try {
    const res = await api('/api/events');
    const data = res && res.data;
    eventsList = Array.isArray(data) ? data : [];
    if (eventsList.length === 0) eventsList = [...DEFAULT_EVENTS_FALLBACK];
    renderEventOptions();
    return true;
  } catch {
    eventsList = [...DEFAULT_EVENTS_FALLBACK];
    renderEventOptions();
    return false;
  }
}

async function loadSessions(eventId) {
  try {
    const { data } = await api('/api/sessions?eventId=' + encodeURIComponent(eventId || ''));
    sessionsList = data || [];
    if (sessionSelect) {
      const current = sessionSelect.value;
      sessionSelect.innerHTML = '<option value="">— Select session —</option>' +
        sessionsList.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join('');
      if (current) sessionSelect.value = current;
    }
    return true;
  } catch {
    return false;
  }
}

if (eventSelect) {
  eventSelect.addEventListener('change', () => {
    loadSessions(eventSelect.value);
  });
}

async function loadFeedback(eventId) {
  try {
    const q = eventId ? '?eventId=' + encodeURIComponent(eventId) : '?limit=100';
    const { data } = await api('/api/feedback' + q);
    feedbackStore = data || [];
    return true;
  } catch {
    feedbackStore = JSON.parse(localStorage.getItem('feedbackAnalyzer') || '[]');
    return false;
  }
}

async function loadTrendingKeywords(eventId) {
  try {
    const q = eventId ? '?eventId=' + encodeURIComponent(eventId) + '&limit=20' : '?limit=20';
    const { data } = await api('/api/analytics/trending-keywords' + q);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function loadAnalytics(eventId) {
  try {
    const q = eventId ? '?eventId=' + encodeURIComponent(eventId) : '';
    const [overview, summary, recs, nps, trending] = await Promise.all([
      api('/api/analytics/overview' + q),
      api('/api/analytics/insights/summary' + q),
      api('/api/analytics/insights/recommendations' + q),
      api('/api/analytics/insights/nps' + q),
      loadTrendingKeywords(eventId),
    ]);
    return { overview: overview.data, summary: summary.data, recs: recs.data, nps: nps.data, trendingKeywords: trending };
  } catch {
    return null;
  }
}

function renderList() {
  const list = feedbackStore.slice(0, 20);
  if (list.length === 0) {
    feedbackList.innerHTML = '<p class="empty-state">No feedback yet. Be the first to submit!</p>';
    return;
  }
  feedbackList.innerHTML = list.map(f => {
    const sentClass = f.sentiment_label || f.sentiment || 'neutral';
    const sentLabel = sentClass.charAt(0).toUpperCase() + sentClass.slice(1);
    const date = new Date(f.created_at || f.at).toLocaleDateString(undefined, { dateStyle: 'short' });
    const name = f.event_name || f.eventName || 'General';
    const kw = f.keywords;
    const keywordsHtml = (Array.isArray(kw) && kw.length > 0)
      ? '<div class="feedback-keywords">' + kw.slice(0, 8).map(w => '<span class="kw-tag">' + escapeHtml(String(w)) + '</span>').join('') + '</div>'
      : '';
    return `<div class="feedback-item ${sentClass}">
      <div class="feedback-body">${escapeHtml(f.text || '')}</div>
      ${keywordsHtml}
      <div class="feedback-meta">${sentLabel} · ${escapeHtml(name)} · ${date}</div>
      </div>`;
  }).join('');
}

function getSentimentCounts() {
  const counts = { positive: 0, neutral: 0, negative: 0 };
  feedbackStore.forEach(f => {
    const s = f.sentiment_label || f.sentiment || 'neutral';
    counts[s] = (counts[s] || 0) + 1;
  });
  return counts;
}

function updateChart() {
  const counts = getSentimentCounts();
  const ctx = document.getElementById('sentimentChart');
  if (!ctx) return;
  const data = [counts.positive, counts.neutral, counts.negative];
  const labels = ['Positive', 'Neutral', 'Negative'];
  const colors = ['#34d399', '#fbbf24', '#f87171'];
  if (sentimentChart) {
    sentimentChart.data.datasets[0].data = data;
    sentimentChart.update();
  } else {
    sentimentChart = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: '#16181e', borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, cutout: '65%' },
    });
  }
  const legend = document.getElementById('chartLegend');
  if (legend) legend.innerHTML = labels.map((l, i) => `<span><span class="dot" style="background:${colors[i]}"></span> ${l}: ${data[i]}</span>`).join('');
}

function updateStats(overview) {
  if (overview) {
    totalFeedbackEl.textContent = overview.totalFeedback ?? 0;
    avgSentimentEl.textContent = overview.avgRating != null ? overview.avgRating.toFixed(1) + '/5' : '—';
    insightCountEl.textContent = overview.totalFeedback ?? 0;
  } else {
  totalFeedbackEl.textContent = feedbackStore.length;
  if (feedbackStore.length === 0) {
    avgSentimentEl.textContent = '—';
    insightCountEl.textContent = '0';
    } else {
      const sum = feedbackStore.reduce((a, f) => a + ((f.sentiment_label || f.sentiment) === 'positive' ? 1 : (f.sentiment_label || f.sentiment) === 'negative' ? -1 : 0), 0);
      const avg = sum / feedbackStore.length;
      avgSentimentEl.textContent = avg > 0.2 ? 'Positive' : avg < -0.2 ? 'Negative' : 'Neutral';
      insightCountEl.textContent = feedbackStore.length;
    }
  }
}

function updateRecommendations(recs) {
  if (Array.isArray(recs) && recs.length) {
    recommendations.innerHTML = recs.map(r => `<li>${escapeHtml(typeof r === 'object' ? (r.action || r.area) : r)}</li>`).join('');
  } else {
    const themes = ['Improve catering and refreshments.', 'Review venue and logistics.', 'Refine session content.', 'Upgrade tech support.', 'Adjust schedule.'];
    recommendations.innerHTML = feedbackStore.length ? themes.slice(0, 3).map(t => `<li>${escapeHtml(t)}</li>`).join('') : '<li>Submit feedback above to see recommendations.</li>';
  }
}

function updateExecSummary(summary) {
  if (summary && summary.summary) {
    execSummary.textContent = summary.summary;
  } else {
    execSummary.textContent = feedbackStore.length ? 'Viewing feedback summary. Use the filter above for a specific event.' : 'No feedback yet. Summary will appear once feedback is submitted.';
  }
}

function updateNps(npsData) {
  if (npsData && npsData.total > 0) {
    npsRow.innerHTML = `<strong>NPS-style score:</strong> ${npsData.nps} (promoters: ${npsData.promoters}, detractors: ${npsData.detractors})`;
  } else {
    npsRow.innerHTML = '';
  }
}

function setExportLinks(eventId) {
  const q = eventId ? '?eventId=' + encodeURIComponent(eventId) : '';
  if (exportExcel) exportExcel.href = API_BASE + '/api/export/excel' + q;
  if (exportPdf) exportPdf.href = API_BASE + '/api/export/pdf' + q;
  if (exportCsv) exportCsv.href = API_BASE + '/api/export/csv' + q;
}

async function refreshData(eventId) {
  const eid = eventId || (insightEventFilter && insightEventFilter.value) || '';
  await loadFeedback(eid);
  renderList();
  updateChart();
  const analytics = await loadAnalytics(eid);
  if (analytics) {
    updateStats(analytics.overview);
    updateRecommendations(analytics.recs);
    updateExecSummary(analytics.summary);
    updateNps(analytics.nps);
    updateTrendingKeywords(analytics.trendingKeywords);
  } else {
    updateStats(null);
    updateRecommendations(null);
    updateExecSummary(null);
    updateNps(null);
    updateTrendingKeywords([]);
  }
  setExportLinks(eid);
}

function updateTrendingKeywords(list) {
  if (!trendingKeywordsEl) return;
  if (!list || list.length === 0) {
    trendingKeywordsEl.innerHTML = '<p class="empty-state">Submit feedback to see extracted keywords.</p>';
    return;
  }
  trendingKeywordsEl.innerHTML = list.map(({ word, count }) =>
    '<span class="trending-kw-tag" title="' + escapeHtml(String(count)) + ' mentions">' + escapeHtml(word) + ' <em>' + count + '</em></span>'
  ).join('');
}

feedbackForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = feedbackText.value.trim();
  if (!text) return;

  const eventId = eventSelect && eventSelect.value ? eventSelect.value : null;
  const sessionId = sessionSelect && sessionSelect.value ? sessionSelect.value : null;
  const eventName = eventNameInput ? eventNameInput.value.trim() : '';
  const sessionName = sessionSelect && sessionSelect.value ? [...sessionSelect.options].find(o => o.value === sessionSelect.value)?.textContent : '';
  const payload = {
    eventId: eventId || undefined,
    sessionId: sessionId || undefined,
    eventName: eventName || (eventSelect && eventSelect.value ? eventsList.find(ev => ev.id === eventSelect.value)?.name : '') || undefined,
    sessionName: sessionName || undefined,
    attendeeName: attendeeNameInput ? attendeeNameInput.value.trim() || undefined : undefined,
    attendeeEmail: attendeeEmailInput ? attendeeEmailInput.value.trim() || undefined : undefined,
    rating: selectedRating || undefined,
    ratingVenue: categoryRatings.venue || undefined,
    ratingContent: categoryRatings.content || undefined,
    ratingSpeakers: categoryRatings.speakers || undefined,
    ratingOrganization: categoryRatings.organization || undefined,
    text,
  };

  try {
    const { data } = await api('/api/feedback', { method: 'POST', body: JSON.stringify(payload) });
  resultCard.hidden = false;
    resultSentiment.textContent = 'Sentiment: ' + (data.sentiment_label || 'neutral').charAt(0).toUpperCase() + (data.sentiment_label || 'neutral').slice(1);
    resultSentiment.className = 'result-sentiment ' + (data.sentiment_label || 'neutral');
    resultText.textContent = (data.sentiment_label || 'neutral') === 'positive'
      ? 'Thank you! Your feedback was analyzed and submitted.'
      : (data.sentiment_label || 'neutral') === 'negative'
      ? 'We\'ll use this to improve. Your honesty is valued.'
      : 'Thanks for sharing. We\'ll keep working to make events better.';
    if (resultKeywordsEl) {
      const kw = data.keywords;
      resultKeywordsEl.innerHTML = (Array.isArray(kw) && kw.length > 0)
        ? '<p class="result-keywords-label">Extracted keywords:</p><div class="result-keywords-tags">' + kw.map(w => '<span class="kw-tag">' + escapeHtml(String(w)) + '</span>').join('') + '</div>'
        : '';
      resultKeywordsEl.style.display = (Array.isArray(kw) && kw.length > 0) ? 'block' : 'none';
    }
  feedbackForm.reset();
  feedbackText.value = '';
    if (charCountEl) charCountEl.textContent = '0';
  selectedRating = 0;
  ratingStars.querySelectorAll('.star').forEach(s => s.classList.remove('active'));
    Object.keys(categoryRatings).forEach(k => { categoryRatings[k] = 0; });
    document.querySelectorAll('.category-ratings-grid .rating-stars.small').forEach(w => w.querySelectorAll('.star').forEach(s => s.classList.remove('active')));
    await refreshData(eventId);
    // After every feedback: re-fetch and update AI Recommendations so they always reflect the latest
    const q = eventId ? '?eventId=' + encodeURIComponent(eventId) : '';
    try {
      const res = await api('/api/analytics/insights/recommendations' + q);
      const recsArray = res && Array.isArray(res.data) ? res.data : null;
      updateRecommendations(recsArray);
      if (recommendations && recommendations.parentElement) {
        recommendations.parentElement.classList.add('recommendations-updated');
        setTimeout(() => recommendations.parentElement.classList.remove('recommendations-updated'), 1200);
      }
    } catch (_) {
      updateRecommendations(null);
    }
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    resultCard.hidden = false;
    resultSentiment.textContent = 'Connection issue';
    resultSentiment.className = 'result-sentiment neutral';
    const isOffline = err && (err.message === 'Failed to fetch' || err.name === 'TypeError');
    const message = isOffline
      ? 'Backend may be offline. Start the backend (npm start in /backend) and try again, or we can save locally.'
      : (err && err.message) || 'Request failed. Check backend and try again.';
    resultText.textContent = message;
    feedbackStore.unshift({
      id: Date.now(),
      event_name: eventName || 'General',
      eventName: eventName || 'General',
      text,
      rating: selectedRating || null,
      sentiment_label: 'neutral',
      sentiment: 'neutral',
      created_at: new Date().toISOString(),
      at: new Date().toISOString(),
    });
    localStorage.setItem('feedbackAnalyzer', JSON.stringify(feedbackStore));
  renderList();
  updateChart();
    updateStats(null);
    updateRecommendations(null);
  }
});

  if (insightEventFilter) {
    insightEventFilter.addEventListener('change', () => refreshData(insightEventFilter.value));
  }


if (exportExcel) exportExcel.addEventListener('click', (e) => { if (exportExcel.href && exportExcel.href !== '#') window.open(exportExcel.href); e.preventDefault(); });
if (exportPdf) exportPdf.addEventListener('click', (e) => { if (exportPdf.href && exportPdf.href !== '#') window.open(exportPdf.href); e.preventDefault(); });
if (exportCsv) exportCsv.addEventListener('click', (e) => { if (exportCsv.href && exportCsv.href !== '#') window.open(exportCsv.href); e.preventDefault(); });

async function init() {
  prefillFromUrl();
  buildCategoryStars();
  await checkBackendConnection();
  const apiOk = await loadEvents();
  if (eventSelect && eventSelect.value) await loadSessions(eventSelect.value);
  else await loadSessions();
  await refreshData();
  if (!apiOk) setExportLinks('');
  // Periodically re-check backend health so the status updates if the server comes online later
  // This helps when the page loads before the backend has started
  setInterval(checkBackendConnection, 10000);
}

init();
