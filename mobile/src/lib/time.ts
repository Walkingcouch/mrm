// Timestamps are stored in UTC and shown in Australia/Darwin time. Darwin has
// no daylight saving (fixed UTC+09:30), so this avoids relying on the JS
// engine's time-zone database.
const DARWIN_OFFSET_MIN = 9 * 60 + 30;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function formatDarwin(isoUtc: string): string {
  const d = new Date(new Date(isoUtc).getTime() + DARWIN_OFFSET_MIN * 60_000);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getUTCHours();
  const hh = ((h + 11) % 12) + 1;
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}:${mm} ${h < 12 ? 'am' : 'pm'}`;
}
