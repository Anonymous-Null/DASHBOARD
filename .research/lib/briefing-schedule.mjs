import { checkInWindow } from '../public/shared.js';

// GitHub cron can start late. Catch up by edition, never by the arrival hour.
export function briefingDue(previous, now = new Date()) {
  if (previous?.news?.schemaVersion !== 2 || previous.news.editionKey !== checkInWindow(now).key) return true;
  // A short edition can gain genuinely new reporting later in the window.
  return previous.news.stories?.length < 5 && +now - Date.parse(previous.fetchedAt) >= 60 * 60 * 1000;
}
