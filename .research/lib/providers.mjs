import { XMLParser } from 'fast-xml-parser';
import { NEWS_FEEDS, plainText, rankStories } from '../public/news.js';
export { NEWS_FEEDS, plainText, rankStories, storyContext, similarStories, plainLanguageSummary } from '../public/news.js';
import { sheetExportUrl, calendarFromCSV } from '../public/calendar.js';
export { sheetExportUrl, parseCSV, calendarFromCSV, calendarFromWeeklyGrid } from '../public/calendar.js';

export async function fetchText(url, { fetcher = fetch, maxBytes = 2_000_000 } = {}) {
  const response = await fetcher(url, {
    headers: { 'User-Agent': 'Daymark/1.0 (personal dashboard)', Accept: 'application/json, application/rss+xml, text/csv, */*' },
    signal: AbortSignal.timeout(12000), redirect: 'error',
  });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) { await reader.cancel(); throw new Error('Provider response is too large'); }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function parseFeed(xml, feed) {
  const doc = new XMLParser({ ignoreAttributes: false, processEntities: true }).parse(xml);
  const atom = Boolean(doc.feed);
  let items = doc.rss?.channel?.item ?? doc.feed?.entry ?? [];
  if (!Array.isArray(items)) items = [items];
  return items.flatMap(item => {
    const content = value => typeof value === 'object' ? value?.['#text'] ?? '' : value;
    const title = plainText(content(item.title));
    const summary = plainText(content(item.description ?? item.summary ?? item.content)).slice(0, 900);
    const published = new Date(item.pubDate ?? item.published ?? item.updated ?? item['dc:date']);
    const links = Array.isArray(item.link) ? item.link : [item.link];
    const link = atom ? links.find(l => l?.['@_rel'] === 'alternate' || !l?.['@_rel'])?.['@_href'] : content(item.link);
    let url;
    try { url = new URL(String(link)); } catch { return []; }
    if (!['https:', 'http:'].includes(url.protocol) || !title || !summary || !Number.isFinite(+published)) return [];
    for (const key of [...url.searchParams.keys()]) if (key.startsWith('utm_') || key === 'at_medium' || key === 'at_campaign') url.searchParams.delete(key);
    url.hash = '';
    return [{ id: url.href, url: url.href, title, summary, publishedAt: published.toISOString(), source: feed.source, category: feed.category,
      coverage: /\b(analysis|explainer)\b/i.test(title) ? 'Analysis / explainer' : feed.coverage ?? 'Source report' }];
  });
}

export async function loadNews(fetcher = fetch, now = new Date()) {
  const results = await Promise.allSettled(NEWS_FEEDS.map(async feed => parseFeed(await fetchText(feed.url, { fetcher }), feed)));
  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  if (!succeeded) throw new Error('News providers are unreachable. Check network access and try again.');
  return { stories: rankStories(results.flatMap(r => r.status === 'fulfilled' ? r.value : []), now), sources: NEWS_FEEDS.filter((_, i) => results[i].status === 'fulfilled').map(f => f.source).filter((s, i, list) => list.indexOf(s) === i), unavailableSources: NEWS_FEEDS.filter((_, i) => results[i].status === 'rejected').map(f => f.source).filter((s, i, list) => list.indexOf(s) === i), providersAvailable: succeeded, providersTotal: results.length, fetchedAt: now.toISOString() };
}

export function validateCoordinates(lat, lon) {
  const latitude = Number(lat), longitude = Number(lon);
  if (lat === null || lon === null || lat === '' || lon === '' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('A valid latitude and longitude are required.');
  return { latitude, longitude };
}

export async function loadWeather(lat, lon, fetcher = fetch) {
  const { latitude, longitude } = validateCoordinates(lat, lon);
  const query = new URLSearchParams({ latitude, longitude, current: 'temperature_2m,apparent_temperature,weather_code,is_day', daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_gusts_10m_max', hourly: 'temperature_2m,precipitation_probability,precipitation,rain,snowfall,weather_code,wind_gusts_10m', temperature_unit: 'fahrenheit', wind_speed_unit: 'mph', timezone: 'America/New_York', forecast_days: '2' });
  const data = JSON.parse(await fetchText(`https://api.open-meteo.com/v1/forecast?${query}`, { fetcher }));
  if (!data.current || !data.daily?.time?.length || !data.hourly?.time?.length) throw new Error('The weather provider returned an incomplete forecast.');
  return { ...data, fetchedAt: new Date().toISOString() };
}

export async function loadSheet(input, fetcher = fetch) {
  let url = sheetExportUrl(input);
  // Google exports can redirect to its content hosts. Validate each destination;
  // never turn this endpoint into an arbitrary URL fetcher.
  for (let i = 0; i < 4; i++) {
    const response = await fetcher(url, { redirect: 'manual', signal: AbortSignal.timeout(12000) });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const target = new URL(response.headers.get('location'), url);
      await response.body?.cancel();
      if (target.protocol !== 'https:' || target.port || target.username || target.password || !(target.hostname === 'docs.google.com' || target.hostname.endsWith('.googleusercontent.com'))) throw new Error('This sheet needs sign-in or redirected outside Google Sheets. Private sheet access is not connected.');
      url = target.href; continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`The sheet could not be read (HTTP ${response.status}). Check its sharing settings, or use manual events.`); }
    const csv = await fetchText(url, { fetcher: async () => response });
    return { ...calendarFromCSV(csv), fetchedAt: new Date().toISOString() };
  }
  throw new Error('Google Sheets redirected too many times.');
}
