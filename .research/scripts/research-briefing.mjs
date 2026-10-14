import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { researchNews } from '../lib/research.mjs';
import { selectBriefing } from '../public/news.js';
import { checkInWindow, localParts } from '../public/shared.js';

const inDeployment = process.argv.includes('--deployment');
const scheduled = process.argv.includes('--scheduled');
const now = new Date();
if (scheduled && !['07','19'].includes(localParts(now).hour)) {
  console.log('Skipping the extra UTC trigger outside 7 AM/7 PM Eastern.');
  process.exit(0);
}
const root = new URL('../', import.meta.url);
const target = inDeployment ? new URL('../briefing.json', root) : new URL('public/data/researched.json', root);
const historyTarget = inDeployment ? new URL('../briefing-history.json', root) : new URL('.local/briefing-history.json', root);
let previous = null, history = { seen: {}, editions: [] };
try { previous = JSON.parse(await readFile(target, 'utf8')); } catch { /* First research run. */ }
try { history = JSON.parse(await readFile(historyTarget, 'utf8')); } catch { /* No public-story history yet. */ }

const news = await researchNews({ now, previous: previous?.news?.stories || [] });
const key = checkInWindow(now).key;
const previousSources = history.editions.find(e => e.key !== key)?.sources || [];
const selected = selectBriefing(news.stories, { key, history: history.seen, previousSources, requireVerified: true, now });
news.selectedIds = selected.map(s => s.id);
news.stories = news.stories.filter(s => !history.seen[s.id] || history.seen[s.id].editionKey === key || s.majorUpdateVerified);
for (const story of selected) history.seen[story.id] = { id: story.id, title: story.title, source: story.source, eventDate: story.eventDate, eventRevision: story.eventRevision, editionKey: key, seenAt: now.toISOString() };
history.editions = [{ key, sources: selected.map(s => s.source) }, ...history.editions.filter(e => e.key !== key)].slice(0, 28);
history.seen = Object.fromEntries(Object.entries(history.seen).sort((a,b) => b[1].seenAt.localeCompare(a[1].seenAt)).slice(0, 1000));
const result = { fetchedAt: now.toISOString(), news };
await mkdir(new URL('.', target), { recursive: true });
await mkdir(new URL('.', historyTarget), { recursive: true });
await writeFile(target, JSON.stringify(result, null, 2));
await writeFile(historyTarget, JSON.stringify(history, null, 2));
if (inDeployment) {
  const htmlTarget = new URL('../index.html', root);
  const html = await readFile(htmlTarget, 'utf8');
  const safe = JSON.stringify(result).replace(/<\/script/gi, '<\\/script');
  const updated = html.replace(/globalThis\.DAYMARK_SNAPSHOT=.*?;\n/, () => `globalThis.DAYMARK_SNAPSHOT=${safe};\n`);
  if (updated === html && !html.includes(safe)) throw new Error('The embedded briefing could not be updated');
  await writeFile(htmlTarget, updated);
}
console.log(JSON.stringify({ edition: key, selected: selected.length, ...news.research }));
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY,
  `## Briefing ${key}\n\nGathered ${news.research.rawCandidates} live feed candidates; reviewed ${news.research.candidatesReviewed}; read ${news.research.sourcePagesRead} original source pages; checked ${news.research.primaryDatesChecked} primary publication dates.\n\n${selected.length} fresh stories selected. Shortfalls are shown without filler.\n`, { flag: 'a' });
