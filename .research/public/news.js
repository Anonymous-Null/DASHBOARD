// Shared news selection for the server and downloadable dashboard.
export const NEWS_FEEDS = [
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC News', category: 'World' },
  { url: 'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml', source: 'BBC News', category: 'U.S.' },
  { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', source: 'BBC News', category: 'Technology' },
  { url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', source: 'BBC News', category: 'Science' },
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'BBC News', category: 'Business' },
  { url: 'https://feeds.bbci.co.uk/news/education/rss.xml', source: 'BBC News', category: 'Education' },
  { url: 'https://feeds.npr.org/1003/rss.xml', source: 'NPR', category: 'U.S.' },
  { url: 'https://feeds.npr.org/1007/rss.xml', source: 'NPR', category: 'Science' },
  { url: 'https://feeds.npr.org/1013/rss.xml', source: 'NPR', category: 'Education' },
  { url: 'https://feeds.arstechnica.com/arstechnica/index/', source: 'Ars Technica', category: 'Technology' },
  { url: 'https://www.theverge.com/rss/index.xml', source: 'The Verge', category: 'Technology' },
  { url: 'https://www.sciencenews.org/feed/', source: 'Science News', category: 'Science' },
  { url: 'https://www.sciencedaily.com/rss/top/science.xml', source: 'ScienceDaily', category: 'Science', coverage: 'Research summary' },
  { url: 'https://news.mit.edu/rss/research', source: 'MIT News', category: 'Science', coverage: 'University research release' },
  { url: 'https://www.highereddive.com/feeds/news/', source: 'Higher Ed Dive', category: 'Education' },
  { url: 'https://www.nasa.gov/news-release/feed/', source: 'NASA', category: 'Science', coverage: 'Institution announcement' },
  { url: 'https://www.nature.com/nature.rss', source: 'Nature', category: 'Science', coverage: 'Primary research' },
  { url: 'https://www.science.org/rss/news_current.xml', source: 'Science', category: 'Science' },
];

export function plainText(value) {
  return String(value ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();
}

const trivial = /\b(celebrity|celebrities|horoscope|red carpet|box office|gossip|reality tv|football results|premier league|transfer gossip|quiz|what to watch|shopping deals|prime day|black friday)\b|discovery\+.*prices|streaming.*prices|homeview ad/i;
const stopWords = new Set('the a an and or to of in on for with from as at by is are has have after over amid says say new us uk'.split(' '));
const routine = /\b(funding round|series [a-f] funding|raises? \$|acquisitions?|acquires?|partnership|partners with|unveils? new|launches? new|new smartphone|product launch|quarterly earnings|admissions experts|application tips|admissions advice|supplemental essays|extra application essays|campus update|college financial aid deadlines|scholarship deadlines?|student recruitment|admissions work|new degree program|college programs)\b/i;
const hype = /\b(what to expect|everything you need|the future of ai|ai will change everything|vague predictions|best .* to buy)\b/i;
const personnel = /\b(hires?|appoints?|named|joins?|steps down)\b.{0,90}\b(ceo|chief|executive|director|doug field)\b/i;
const extraordinary = /\b(world record|first ever|first-ever|first time|never before|reviv\w*.{0,30}extinct|breakthrough|unexpected|unprecedented|record-breaking|bizarre|unusual|rare|escaped|reversed|surviv\w*.{0,30}without|impossible|astonishingly)\b/i;
const consequences = /\b(ceasefire|invasion|war|missile|earthquake|hurricane|evacuation|nuclear|pandemic|federal|supreme court|ban|bans|banned|ruling|sanctions|tariffs|inflation|recession|millions|thousands|blackout|massive|overthrown|coup|resigns|collapsed)\b/i;
const novelty = /\b(discover\w*|breakthrough|robot\w*|quantum|fusion|space|planet|galax\w*|telescope|brain|biology|physics|engineering|new method|new material|first-ever|first time|gene|DNA|clon\w*|artificial intelligence)\b/i;
const interests = /\b(ai|artificial intelligence|electrical engineering|computer science|research|selective colleges|scholarships?|education|admissions|financial aid|semiconductor|chips|robot\w*)\b/i;

function tokens(title) { return new Set(title.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(t => t.length > 2 && !stopWords.has(t))); }

export function storyContext(story) {
  const text = `${story.title} ${story.summary}`;
  const rules = [
    [/\b(admissions?|applications?|sat|act|essays?)\b/i, 'This could affect how you prepare for college applications. Check the source for which schools, students and deadlines are involved.'],
    [/\b(tuition|financial aid|scholarships?|student loans?)\b/i, 'College costs and financial aid affect where you can apply and what attending could cost. Eligibility and dates matter.'],
    [/\b(sleep|exercise|health|vaccines?)\b/i, 'This may help you understand health and everyday habits. A research result is evidence to consider, rather than a personal medical recommendation.'],
    [/\b(phone|laptop|privacy|scams?|passwords?)\b/i, 'This concerns technology you may use for school or everyday life. Look for confirmed changes and practical steps in the report.'],
    [/\b(nasa|planets?|astronomers?|cosmic|galax\w*|telescope|space exploration|space flight)\b/i, 'A look at how scientists explore space and figure out what is out there. Follow the source for the evidence and what is still uncertain.'],
    [/\b(light|optics)\b/i, 'Light is central to cameras, communications and experiments. This is a research finding; the source explains how it was tested and what is still uncertain.'],
    [/\b(ceasefire|ukrain)\w*\b.*\b(energy|electric|power)\b|\b(energy|electric|power)\b.*\b(ceasefire|ukrain)\w*\b/i, 'Reliable power is critical to civilian heating and electricity. Attacks on energy sites also test whether ceasefire commitments protect people on the ground.'],
    [/\b(federal agents|law enforcement)\b.*\b(search|home)\b/i, 'Investigations involving elected officials raise questions about legal process and accountability. A search alone does not establish wrongdoing.'],
    [/\b(congo|m23)\b/i, 'Changes in rebel leadership can affect peace negotiations and civilian security in eastern DR Congo.'],
    [/\b(ai|artificial intelligence)\b.*\b(regulat|rules|safety)\w*\b/i, 'AI oversight concerns safety standards, responsibility for harm, and how quickly new systems reach the public.'],
    [/\b(beef|food|grocery|cost of living|inflation)\b/i, 'Household prices shape purchasing power and voters’ economic concerns. The report gives context to pressures people feel day to day.'],
    [/\b(admission|college|universit|student loan)\w*\b/i, 'Changes to education policy and college access can affect application decisions, costs, and opportunities for students.'],
    [/\b(cyber|hack|data breach)\w*\b/i, 'Cyber incidents can disrupt services and expose personal information. Follow the source for confirmed impacts and any recommended action.'],
    [/\b(missile|military|pentagon|invasion|war|ceasefire)\b/i, 'Military and diplomatic developments can change regional security and the risks faced by civilians.'],
    [/\b(nasa|space|discovery|breakthrough|research)\b/i, 'The significance depends on the evidence and what becomes possible next. The source explains the results and their limits.'],
    [/\b(tariff|economy|growth|imf|interest rate)\b/i, 'Economic policy and growth forecasts inform decisions about jobs, investment and household budgets.'],
  ];
  return rules.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}
export function similarStories(a, b) {
  if (a.id === b.id) return true;
  const x = tokens(a.title), y = tokens(b.title);
  const shared = [...x].filter(t => y.has(t)).length;
  return shared >= 3 && shared / Math.min(x.size, y.size) >= 0.6;
}

export function readableHeadline(title, summary = '') {
  if (/3 admissions experts.*supplemental essays/i.test(title)) return 'Three admissions experts explain why colleges keep or drop extra application essays';
  if (/James Webb reveals a massive cosmic structure/i.test(title) && /galaxy cluster.*dense/i.test(summary)) return 'Webb telescope finds an unexpectedly dense ancient group of galaxies';
  if (/Physicists discover.*property of light/i.test(title) && /spinning, twisting/i.test(summary)) return 'Scientists find an unexpected way light can twist as it travels';
  if (/war-gamed dimming the sun/i.test(title)) return 'A simulation explores the risks of trying to cool Earth by dimming sunlight';
  return title.replace(/\bsupplemental essays\b/gi, 'extra application essays').replace(/\bnixed\b/gi, 'removed');
}

export const NEWS_WEIGHTS = { surprise: 0.35, consequence: 0.30, novelty: 0.20, relevance: 0.15 };

export function interestScore(story) {
  const text = `${story.title} ${story.originalSummary || story.summary}`;
  const dimensions = {
    surprise: extraordinary.test(text) ? 90 : /\b(discover\w*|myster\w*|record|defies|unexpected|ceasefire|coup|overthrown|resigns|overturned|collapse)\b/i.test(text) ? 65 : 15,
    consequence: consequences.test(text) ? 90 : /\b(climate|energy|health|disease|cancer|privacy|hack|security|financial aid|student loan|cost)\b/i.test(text) ? 60 : 20,
    novelty: novelty.test(text) ? 85 : /\b(new law|new policy|unexpected decision|peace deal|ceasefire|coup|overthrown)\b/i.test(text) ? 65 : 15,
    relevance: interests.test(text) ? 90 : 10,
  };
  const score = Object.entries(NEWS_WEIGHTS).reduce((sum, [key, weight]) => sum + dimensions[key] * weight, 0);
  return { score, dimensions };
}

export function rankStories(items, now = new Date(), options = {}) {
  const unique = new Map();
  for (const story of items) {
    const age = (+now - Date.parse(story.publishedAt)) / 3600000;
    const eventAge = story.eventDate ? (+now - Date.parse(story.eventDate.length === 10 ? `${story.eventDate}T12:00:00Z` : story.eventDate)) / 3600000 : age;
    const text = `${story.title} ${story.originalSummary || story.summary}`;
    if (!Number.isFinite(age) || age < -1 || age > 48 || eventAge > 48 || eventAge < -24 || trivial.test(story.title) || hype.test(story.title)) continue;
    if (routine.test(story.title) && !(extraordinary.test(text) && consequences.test(text))) continue;
    if (['Technology', 'Business', 'Education'].includes(story.category) && personnel.test(story.title)) continue;
    if (/^(I |My |We tested )|\b(opinion|editorial|review:|best deals)\b/i.test(story.title)) continue;
    if (/\/videos\//.test(story.url || '')) continue;
    if (options.requireVerified && (!story.eventDateVerified || !story.eventDate || !story.dateEvidence)) continue;
    const { score, dimensions } = interestScore(story);
    if (['Science', 'Technology'].includes(story.category) && dimensions.surprise < 65 && dimensions.consequence < 60) continue;
    if (score < (options.minScore ?? 32)) continue;
    const freshness = age <= 24 && eventAge <= 24 ? '24h' : '48h';
    const old = unique.get(story.id);
    if (!old || score > old.score) unique.set(story.id, { ...story, score, dimensions, freshness });
  }
  const selected = [], pool = [...unique.values()];
  while (selected.length < (options.limit || 40) && pool.length) {
    pool.sort((a, b) => {
      const adjusted = story => story.score - selected.filter(p => p.source === story.source).length * 5 - selected.filter(p => p.category === story.category).length * 3 + (story.freshness === '24h' ? 6 : 0);
      return adjusted(b) - adjusted(a) || Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
    });
    const next = pool.shift();
    if (selected.some(s => similarStories(s, next))) continue;
    selected.push(next);
  }
  return selected.map(story => ({ ...story, displayTitle: readableHeadline(story.title, story.summary), originalSummary: story.originalSummary || story.summary,
    summary: story.explanation || plainLanguageSummary(story.summary), whyMatters: story.whyInteresting || null }));
}

export function selectBriefing(stories, { key, history = {}, previousSources = [], avoidPublishers = false, requireVerified = false, now = new Date() } = {}) {
  const ranked = rankStories(stories, now, { requireVerified });
  const prior = Object.values(history).filter(h => h.editionKey && h.editionKey !== key);
  const eligible = ranked.filter(story => {
    const seen = history[story.id];
    if (seen && seen.editionKey !== key && !(story.majorUpdateVerified && story.eventRevision && story.eventRevision !== seen.eventRevision)) return false;
    if (prior.some(old => old.title && similarStories(old, story)) && !story.majorUpdateVerified) return false;
    if (avoidPublishers && previousSources.includes(story.source)) return false;
    return true;
  });
  // A small source-variety preference never creates a topic quota or filler.
  eligible.sort((a, b) => (b.score + (previousSources.includes(b.source) ? 0 : 4)) - (a.score + (previousSources.includes(a.source) ? 0 : 4)));
  const fresh = eligible.filter(s => s.freshness === '24h');
  const backup = eligible.filter(s => s.freshness === '48h');
  const selected = [];
  for (const story of [...fresh, ...backup]) {
    if (selected.some(s => similarStories(s, story))) continue;
    selected.push(story);
    if (selected.length === 5) break;
  }
  return selected;
}

export function sourceImage(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || /(^|\.)(localhost|local)$/.test(url.hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) || /(?:logo|favicon|placeholder|default[-_/]image)/i.test(url.pathname)) return null;
    return url.href;
  } catch { return null; }
}

export function plainLanguageSummary(text) {
  const replacements = [
    [/\bartificial neural networks?\b/gi, 'AI models (computer systems trained to recognize patterns)'],
    [/\bmachine-learning algorithms?\b/gi, 'methods that help computers learn patterns from examples'],
    [/\bsemiconductors\b/gi, 'materials used to make computer chips'],
    [/\bdecarbonization\b/gi, 'reducing carbon emissions'],
    [/\bsolar geoengineering\b/gi, 'trying to cool Earth by reflecting some sunlight away'],
    [/\bgeopolitics\b/gi, 'competition and disagreements between countries'],
    [/\bgeopolitical\b/gi, 'international political'],
    [/\bsupplemental essays\b/gi, 'extra application essays required by individual colleges'],
    [/\bdark matter\b/i, 'dark matter (matter detected by its gravity, rather than by light)'],
    [/\bGOP\b/g, 'Republican Party'],
    [/\bsuper PACs?\b/gi, 'political fundraising group'],
    [/\bbipartisan\b/gi, 'supported by both major U.S. political parties'],
    [/\blawmakers\b/gi, 'elected officials'],
    [/\bmonetary policy\b/gi, 'central-bank decisions about interest rates and money'],
    [/\bfiscal policy\b/gi, 'government decisions about taxes and spending'],
    [/\btariffs\b/gi, 'taxes on imported goods'],
    [/\bLLMs\b/g, 'large language models (AI systems that work with text)'],
    [/\bLLM\b/g, 'large language model (an AI system that works with text)'],
    [/\bIPO\b/g, 'first public sale of a company’s shares'],
    [/\bexoplanets\b/gi, 'planets outside our solar system'],
    [/\bgenerative AI\b/gi, 'AI that creates text, images or other content'],
    [/\bgradient descent\b/gi, 'a method for adjusting an AI model to reduce mistakes'],
    [/\bphotovoltaic cells\b/gi, 'solar cells'],
  ];
  // Keep direct quotations unchanged. Expand known jargon, preserving the
  // source's claims, uncertainty and attribution rather than inventing a summary.
  const plain = String(text).split(/("[^"]*"|“[^”]*”)/g).map((part, i) => i % 2 ? part : replacements.reduce((s, [pattern, replacement]) => s.replace(pattern, replacement), part)).join('');
  const protectedText = plain.replace(/\b(?:[A-Z]\.){2,}|\b(?:Dr|Mr|Mrs|Ms|Prof|Rep|Sen)\./g, match => match.replace(/\./g, '\uE000'));
  const sentences = [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(protectedText)].map(s => s.segment);
  return sentences.slice(0, 2).join('').replace(/\uE000/g, '.').trim();
}

