export const TIME_ZONE = 'America/New_York';
export const WEATHER_REFRESH_MS = 15 * 60 * 1000;

export function themeAt(now = new Date()) {
  const hour = Number(localParts(now).hour);
  return hour >= 19 || hour < 7 ? 'dark' : 'light';
}

let localIdCounter = 0;
// IDs label saved entries and JSONP callbacks; they are not authentication tokens.
// randomUUID is absent in some browsers and non-secure HTML preview contexts.
export function entryId(randomSource = globalThis.crypto) {
  try { if (typeof randomSource?.randomUUID === 'function') return randomSource.randomUUID(); } catch { /* Use the compatible path below. */ }
  try {
    if (typeof randomSource?.getRandomValues === 'function') {
      const bytes = randomSource.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
      const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  } catch { /* Local records can still work if the browser disallows crypto. */ }
  return `${Date.now().toString(36)}-${(++localIdCounter).toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function localParts(now = new Date(), timeZone = TIME_ZONE) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
    minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
}

export function shiftDate(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function zonedInstant(date, time = '00:00', timeZone = TIME_ZONE) {
  const target = Date.parse(`${date}T${time}:00Z`);
  let guess = target;
  for (let i = 0; i < 4; i++) {
    const p = localParts(new Date(guess), timeZone);
    const wall = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    guess += target - wall;
  }
  return new Date(guess);
}

export function checkInWindow(now = new Date(), timeZone = TIME_ZONE) {
  const p = localParts(now, timeZone);
  const today = `${p.year}-${p.month}-${p.day}`;
  const hour = Number(p.hour);
  const date = hour < 7 ? shiftDate(today, -1) : today;
  const period = hour >= 7 && hour < 19 ? 'am' : 'pm';
  const nextDate = hour >= 19 ? shiftDate(today, 1) : today;
  const nextTime = hour >= 7 && hour < 19 ? '19:00' : '07:00';
  return { key: `${date}-${period}`, date, period, today, next: zonedInstant(nextDate, nextTime, timeZone) };
}

export function previousWindow(key) {
  const date = key.slice(0, 10);
  return key.endsWith('-pm') ? `${date}-am` : `${shiftDate(date, -1)}-pm`;
}

export function exerciseStreak(sessions, key) {
  const done = k => sessions[k]?.pushups === true && sessions[k]?.situps === true;
  let cursor = done(key) ? key : previousWindow(key);
  let streak = 0;
  while (done(cursor) && streak < 10000) { streak++; cursor = previousWindow(cursor); }
  return streak;
}

export function dailyIndex(date, length) {
  return Math.floor(Date.parse(`${date}T12:00:00Z`) / 86400000) % length;
}

export function storyChanges(stories, seen = {}) {
  return stories.map(story => {
    const old = seen[story.id];
    const changed = old && (old.title !== story.title || (old.originalSummary !== undefined && story.originalSummary !== undefined ? old.originalSummary !== story.originalSummary : old.summary !== story.summary));
    return { ...story, status: !old ? 'new' : changed ? 'updated' : 'ongoing', previous: changed ? old : null };
  });
}

export function sessionStatus(sessions, key, currentKey) {
  if (key > currentKey) return 'future';
  const entry = sessions[key];
  const count = Number(entry?.pushups === true) + Number(entry?.situps === true);
  return count === 2 ? 'complete' : count === 1 ? 'partial' : 'empty';
}

export function exerciseTotals(sessions) {
  const entries = Object.values(sessions);
  return {
    completed: entries.filter(s => s.pushups && s.situps).length,
    pushups: entries.filter(s => s.pushups).length * 25,
    situps: entries.filter(s => s.situps).length * 25,
  };
}

export function breakStatus(breaks, now = new Date()) {
  const today = checkInWindow(now).today;
  const ordered = [...breaks].sort((a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`));
  const ongoing = ordered.find(b => {
    if (!b.end) return false;
    const start = zonedInstant(b.date, b.time || '00:00');
    const finish = zonedInstant(b.end, b.endTime || '23:59');
    return now >= start && now < finish;
  });
  if (ongoing) return { ongoing, next: null, days: null };
  const next = ordered.find(b => zonedInstant(b.date, b.time || '00:00') > now);
  const days = next ? Math.round((Date.parse(`${next.date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000) : null;
  return { ongoing: null, next: next ?? null, days };
}

export function upcomingCalendarEvents(events, now = new Date(), days = 7) {
  const today = checkInWindow(now).today;
  const limit = shiftDate(today, days);
  return events.filter(e => e.date >= today && e.date < limit && (!e.time || zonedInstant(e.date, e.time) >= now))
    .sort((a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`));
}

export function weatherRisks(data, now = new Date()) {
  const today = checkInWindow(now).today;
  const p = localParts(now);
  const threshold = `${today}T${p.hour}:00`;
  const h = data?.hourly ?? {};
  return [today, shiftDate(today, 1)].map(date => {
    const rows = (h.time ?? []).flatMap((time, i) => {
      if (time.slice(0, 10) !== date || time < threshold) return [];
      const code = h.weather_code?.[i], chance = h.precipitation_probability?.[i];
      const snow = h.snowfall?.[i], rain = h.rain?.[i], precip = h.precipitation?.[i], gust = h.wind_gusts_10m?.[i];
      const frozen = [56, 57, 66, 67].includes(code);
      const snowCode = [71, 73, 75, 77, 85, 86].includes(code);
      const wet = typeof chance === 'number' && chance >= 35 || typeof precip === 'number' && precip >= 0.1 || typeof rain === 'number' && rain >= 0.1;
      const kind = code >= 95 ? 'storm' : frozen ? 'ice' : snowCode || typeof snow === 'number' && snow > 0 ? 'snow' : wet ? 'rain' : null;
      return [{ time, kind, chance: typeof chance === 'number' ? chance : null, gust: typeof gust === 'number' ? gust : null, known: typeof chance === 'number' || typeof precip === 'number' || typeof code === 'number' }];
    });
    const windows = [];
    for (const [index, row] of rows.entries()) {
      if (!row.kind) continue;
      const last = windows.at(-1);
      if (last && last.kind === row.kind && last.lastIndex === index - 1) {
        last.end = row.time; last.lastIndex = index; last.chance = last.chance === null && row.chance === null ? null : Math.max(last.chance ?? 0, row.chance ?? 0); last.gust = Math.max(last.gust ?? 0, row.gust ?? 0);
      } else windows.push({ kind: row.kind, start: row.time, end: row.time, lastIndex: index, chance: row.chance, gust: row.gust });
    }
    const wind = rows.filter(r => r.gust >= 30);
    const severe = windows.some(w => ['storm', 'snow', 'ice'].includes(w.kind));
    const peak = rows.reduce((max, r) => Math.max(max, r.chance ?? 0), 0);
    const gust = rows.reduce((max, r) => Math.max(max, r.gust ?? 0), 0);
    return { date, rows: rows.length, known: rows.some(r => r.known), windows, wind, peakChance: peak, maxGust: gust, severe };
  });
}
