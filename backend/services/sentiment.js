/**
 * Multi-level sentiment analysis:
 * - Overall sentiment (positive/neutral/negative)
 * - Aspect-based (venue, content, speakers, organization)
 * - Keyword extraction, urgency detection
 * - Optional OpenAI fallback for advanced context
 */

const POSITIVE_WORDS = [
  'great', 'awesome', 'amazing', 'love', 'excellent', 'fantastic', 'wonderful',
  'good', 'best', 'enjoyed', 'helpful', 'inspiring', 'valuable', 'recommend',
  'impressive', 'smooth', 'well organized', 'engaging', 'informative', 'outstanding'
];
const NEGATIVE_WORDS = [
  'bad', 'terrible', 'poor', 'disappointing', 'boring', 'waste', 'confusing',
  'slow', 'broken', 'messy', 'unclear', 'frustrating', 'lacking', 'weak',
  'improve', 'issues', 'problem', 'didn\'t like', 'could be better', 'worst', 'disaster'
];
const URGENT_WORDS = ['refund', 'unsafe', 'lawsuit', 'emergency', 'danger', 'never again', 'scam'];
const ASPECT_KEYWORDS = {
  venue: ['venue', 'room', 'space', 'location', 'parking', 'ac', 'temperature', 'seating'],
  content: ['session', 'content', 'agenda', 'topic', 'material', 'presentation'],
  speakers: ['speaker', 'presenter', 'host', 'keynote'],
  organization: ['organization', 'schedule', 'registration', 'check-in', 'logistics', 'wifi'],
};

function tokenize(text) {
  return (text || '').toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
}

function extractKeywords(text, topN = 10) {
  const words = tokenize(text);
  const stop = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'it', 'its']);
  const freq = {};
  words.forEach(w => {
    if (w.length > 2 && !stop.has(w)) freq[w] = (freq[w] || 0) + 1;
  });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({ word, count }));
}

function analyzeSentimentBasic(text) {
  if (!text || !text.trim()) return { label: 'neutral', score: 0, confidence: 0.5 };
  const lower = text.toLowerCase();
  let positive = 0, negative = 0;
  POSITIVE_WORDS.forEach(w => { if (lower.includes(w)) positive++; });
  NEGATIVE_WORDS.forEach(w => { if (lower.includes(w)) negative++; });
  const total = positive + negative;
  if (total === 0) return { label: 'neutral', score: 0, confidence: 0.5 };
  if (positive > negative) {
    const confidence = Math.min(0.95, 0.5 + (positive - negative) * 0.15);
    return { label: 'positive', score: 1, confidence };
  }
  if (negative > positive) {
    const confidence = Math.min(0.95, 0.5 + (negative - positive) * 0.15);
    return { label: 'negative', score: -1, confidence };
  }
  return { label: 'neutral', score: 0, confidence: 0.6 };
}

function getAspectSentiment(text) {
  const lower = (text || '').toLowerCase();
  const aspect = {};
  for (const [key, keywords] of Object.entries(ASPECT_KEYWORDS)) {
    const hasPos = keywords.some(k => lower.includes(k));
    if (!hasPos) continue;
    const sent = analyzeSentimentBasic(text);
    aspect[key] = sent.label;
  }
  return Object.keys(aspect).length ? aspect : null;
}

function getUrgency(text) {
  const lower = (text || '').toLowerCase();
  const found = URGENT_WORDS.find(w => lower.includes(w));
  return found ? 'critical' : null;
}

function getEmotions(text) {
  const lower = (text || '').toLowerCase();
  const emotions = [];
  if (/\b(happy|excited|love|great|awesome)\b/.test(lower)) emotions.push('excited');
  if (/\b(frustrated|angry|annoyed|disappointed)\b/.test(lower)) emotions.push('frustrated');
  if (/\b(disappointed|sad|unfortunate)\b/.test(lower)) emotions.push('disappointed');
  if (/\b(confused|unclear|unsure)\b/.test(lower)) emotions.push('confused');
  return emotions.length ? emotions : null;
}

export function analyzeSentiment(text, options = {}) {
  const useOpenAI = options.useOpenAI && options.openaiClient;
  if (useOpenAI && text.length > 20) {
    try {
      return analyzeWithOpenAI(text, options.openaiClient).catch(() => analyzeFullLocal(text));
    } catch {
      return analyzeFullLocal(text);
    }
  }
  return analyzeFullLocal(text);
}

async function analyzeWithOpenAI(text, openai) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a sentiment analyzer. Reply with ONLY a JSON object (no markdown):
{"label":"positive|neutral|negative","score":1|0|-1,"confidence":0.0-1.0,"aspects":{"venue":"positive|neutral|negative","content":"...","speakers":"...","organization":"..."},"urgency":"critical|null","emotions":["excited","frustrated",...] or null,"keywords":["word1","word2",...]}
Based on this feedback text.`,
      },
      { role: 'user', content: text.slice(0, 2000) },
    ],
    temperature: 0.1,
  });
  const raw = completion.choices[0]?.message?.content?.trim() || '{}';
  const json = raw.replace(/^```\w*\n?|\n?```$/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    return analyzeFullLocal(text);
  }
  return {
    label: ['positive', 'neutral', 'negative'].includes(parsed.label) ? parsed.label : analyzeSentimentBasic(text).label,
    score: typeof parsed.score === 'number' ? parsed.score : (parsed.label === 'positive' ? 1 : parsed.label === 'negative' ? -1 : 0),
    confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.7,
    aspectSentiment: parsed.aspects && typeof parsed.aspects === 'object' ? parsed.aspects : getAspectSentiment(text),
    urgency: parsed.urgency || getUrgency(text),
    emotions: Array.isArray(parsed.emotions) ? parsed.emotions : getEmotions(text),
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 15) : extractKeywords(text, 10).map(k => k.word),
  };
}

function analyzeFullLocal(text) {
  const basic = analyzeSentimentBasic(text);
  return {
    label: basic.label,
    score: basic.score,
    confidence: basic.confidence,
    aspectSentiment: getAspectSentiment(text),
    urgency: getUrgency(text),
    emotions: getEmotions(text),
    keywords: extractKeywords(text, 10).map(k => k.word),
  };
}

export { extractKeywords, getAspectSentiment, getUrgency, getEmotions };
