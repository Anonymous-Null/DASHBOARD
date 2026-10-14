// Shared, dependency-free parsers for public Google Sheets.
export function sheetExportUrl(input) {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com' || url.port || url.username || url.password) throw new Error('Use an HTTPS Google Sheets link from docs.google.com.');
  const published = url.pathname.match(/^\/spreadsheets\/d\/e\/([a-zA-Z0-9_-]+)\/pub(?:html)?\/?$/);
  const ordinary = url.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]+)(?:\/.*)?$/);
  const gid = url.searchParams.get('gid') || new URLSearchParams(url.hash.slice(1)).get('gid') || '0';
  if (!/^\d+$/.test(gid)) throw new Error('The sheet tab ID must be numeric.');
  if (published) return `https://docs.google.com/spreadsheets/d/e/${published[1]}/pub?output=csv&gid=${gid}`;
  if (ordinary && ordinary[1] !== 'e') return `https://docs.google.com/spreadsheets/d/${ordinary[1]}/gviz/tq?tqx=out:csv&gid=${gid}`;
  throw new Error('That link does not identify a Google Sheet.');
}

export function parseCSV(text) {
  if (/^\s*</.test(text)) throw new Error('Google returned a sign-in page. This importer supports only public or published sheets; private sheets require a future sign-in connection.');
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if (c === '\n' && !quoted) { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (quoted) throw new Error('The CSV contains an unclosed quote.');
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows.filter(r => r.some(s => s.trim()));
}

export function calendarFromCSV(text, { schoolYearStart = 2026 } = {}) {
  const rows = parseCSV(text.replace(/^\uFEFF/, ''));
  const firstRow = rows[0]?.map(s => s.trim().toLowerCase()) ?? [];
  if (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].every(day => firstRow.some(s => s.startsWith(day)))) return calendarFromWeeklyGrid(rows, schoolYearStart);
  const headers = rows.shift()?.map(s => s.trim().toLowerCase()) ?? [];
  const titleIndex = headers.indexOf('title'), dateIndex = headers.indexOf('date');
  if (titleIndex < 0 || dateIndex < 0) throw new Error('Your sheet needs title and date columns. Use YYYY-MM-DD dates; time (HH:MM), notes and type are optional.');
  const events = []; let skipped = 0;
  for (const [i, row] of rows.entries()) {
    const get = name => (row[headers.indexOf(name)] ?? '').trim();
    const title = get('title').slice(0, 200), date = get('date'), time = get('time');
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
    if (!title || !validDate || (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) { skipped++; continue; }
    events.push({ id: `sheet-${i}`, title, date, time, notes: get('notes').slice(0, 1000), type: get('type') === 'break' ? 'break' : 'event', source: 'Google Sheets' });
    if (events.length >= 1000) break;
  }
  return { events, skipped, format: 'event-list' };
}

export function calendarFromWeeklyGrid(rows, schoolYearStart) {
  const headers = rows[0].map(s => s.trim().toLowerCase());
  const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const indexes = weekdays.map(day => headers.findIndex(h => h.startsWith(day)));
  const events = []; let skipped = 0, year = schoolYearStart, previousMonth = null;
  for (const [rowNumber, row] of rows.slice(1).entries()) {
    const rawDate = row[0]?.trim();
    const match = rawDate?.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/);
    if (!match) { if (row.some(v => v.trim())) skipped++; continue; }
    const month = Number(match[1]);
    if (match[3]) year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
    else if (previousMonth !== null && month < previousMonth && previousMonth - month > 6) year++;
    previousMonth = month;
    const monday = `${year}-${String(month).padStart(2, '0')}-${match[2].padStart(2, '0')}`;
    const mondayInstant = new Date(`${monday}T12:00:00Z`);
    if (!Number.isFinite(+mondayInstant) || mondayInstant.toISOString().slice(0, 10) !== monday || mondayInstant.getUTCDay() !== 1) { skipped++; continue; }
    for (const [day, col] of indexes.entries()) {
      const cell = row[col]?.trim(); if (!cell) continue;
      const dayInstant = new Date(mondayInstant); dayInstant.setUTCDate(dayInstant.getUTCDate() + day);
      const date = dayInstant.toISOString().slice(0, 10);
      for (const [lineNumber, line] of cell.split(/\r?\n/).map(s => s.trim()).filter(Boolean).entries()) {
        const explicit = line.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
        const hour = explicit ? Number(explicit[1]) % 12 + (explicit[3].toLowerCase() === 'pm' ? 12 : 0) : null;
        const validTime = explicit && Number(explicit[1]) >= 1 && Number(explicit[1]) <= 12 && Number(explicit[2] ?? 0) <= 59;
        const time = validTime ? `${String(hour).padStart(2, '0')}:${explicit[2] ?? '00'}` : '';
        const timeLabel = !time && /\b\d{1,2}:\d{2}\b/.test(line) ? 'Time as written; AM/PM not specified' : '';
        events.push({ id: `sheet-grid-${date}-${rowNumber}-${day}-${lineNumber}`, date, title: line.slice(0, 200), time, timeLabel, notes: '', source: 'Google Sheets', type: 'event' });
      }
    }
  }
  return { events, skipped, format: 'weekly-grid', schoolYearStart, note: `Weekly dates use the ${schoolYearStart}–${schoolYearStart + 1} school year. Times without AM/PM are kept as written.` };
}

