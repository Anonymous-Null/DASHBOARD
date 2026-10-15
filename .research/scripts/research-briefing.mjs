import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { researchNews } from '../lib/research.mjs';
import { completeBriefing } from '../public/news.js';
import { checkInWindow } from '../public/shared.js';
import { briefingDue } from '../lib/briefing-schedule.mjs';

const inDeployment = process.argv.includes('--deployment');
const scheduled = process.argv.includes('--scheduled');
const now = new Date();
const root = new URL('../', import.meta.url);
const target = inDeployment ? new URL('../briefing.json', root) : new URL('public/data/researched.json', root);
const historyTarget = inDeployment ? new URL('../briefing-history.json', root) : new URL('.local/briefing-history.json', root);
let previous = null, history = { seen: {}, editions: [] };
try { previous = JSON.parse(await readFile(target, 'utf8')); } catch { /* First research run. */ }
try { history = JSON.parse(await readFile(historyTarget, 'utf8')); } catch { /* No public-story history yet. */ }
if (scheduled && !briefingDue(previous, now)) {
  console.log('This Eastern check-in already has a complete briefing.');
  process.exit(0);
}

const news = await researchNews({ now, previous: previous?.news?.stories || [], seen: history.seen });
const key = checkInWindow(now).key;
const previousSources = history.editions.find(e => e.key !== key)?.sources || [];
const reserve = [...(previous?.news?.stories || []), ...(previous?.news?.reserveStories || []), ...(history.archive || [])];
const selected = completeBriefing(news.stories, { key, history: history.seen, previousSources, now, fallback:reserve });
if (selected.length < 5) throw new Error(`Only ${selected.length} usable reports available; retaining the previous edition instead of publishing a short briefing.`);
news.minimumStories = 5;
news.freshCount = selected.filter(s => !s.carriedForward && !s.olderReport).length;
news.carriedCount = selected.filter(s => s.carriedForward).length;
news.olderCount = selected.filter(s => s.olderReport && !s.carriedForward).length;
news.reserveStories = [...selected, ...reserve].filter((s,i,all) => all.findIndex(old => old.id === s.id) === i).slice(0,30);
news.selectedIds = selected.map(s => s.id);
// Publish the actual selected edition. Alternative candidates must not let a
// browser reintroduce cross-publisher copies rejected by shared story history.
news.stories = selected;
for (const story of selected) if (!story.carriedForward) history.seen[story.id] = { id: story.id, title: story.title, source: story.source, eventDate: story.eventDate, eventRevision: story.eventRevision, editionKey: key, seenAt: now.toISOString() };
history.archive = news.reserveStories;
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
  `## Briefing ${key}\n\nGathered ${news.research.rawCandidates} candidates; read ${news.research.sourcePagesRead} original source pages.\n\n${selected.length} stories: ${news.freshCount} recent reports, ${news.olderCount} catch-up reports, ${news.carriedCount} carried forward. Unconfirmed event dates are labeled.\n`, { flag: 'a' });
