import Filter from 'bad-words';

const filter = new Filter();
// Extend with event-specific bad words if needed
filter.addWords('crappy', 'sucks');

export function hasProfanity(text) {
  if (!text || typeof text !== 'string') return false;
  return filter.isProfane(text);
}

export function sanitizeProfanity(text) {
  if (!text || typeof text !== 'string') return text;
  return filter.clean(text);
}
